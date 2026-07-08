import { generateMomentsImage } from '../../../components/moments/momentsImageGen'
import type { MomentsImageGenSettings } from '../../../components/moments/useMomentsSettingsStore'
import { isCharacterImageGenEnabled } from '../api/imageGenPresetUtils'
import { loadResolvedImageGenSettings } from '../api/loadResolvedImageGenSettings'
import type { Character, WeChatChatMessage, WeChatImageMime, WeChatVoicePayload, WeChatMusicSyncInvitePayload, WeChatLocationPayload, WeChatTakeoutOrderPayload } from './newFriendsPersona/types'
import { buildCharacterMediaImageGenParams } from './characterAppearanceImageGen'
import { personaDb } from './newFriendsPersona/idb'
import type { ProactiveMessageRevealBubble } from './proactiveMessageRevealBridge'
import { parseCharacterStickerLine, ensureStickerStoreHydrated } from './stickers/stickerStore'
import {
  formatStickerTranscriptLine,
  wasCharacterStickerRefUsedRecently,
} from './stickers/stickerAntiRepeat'
import { imageGenDataUrlToPayload, parseCharacterImageGenLine } from './wechatCharacterImageGen'
import {
  isImageGenQuotaOrRateLimitBlocked,
  markImageGenQuotaOrRateLimitBlocked,
  isImageGenThrottleOrQuotaError,
} from './wechatMediaSendFrequency'
import { stickerUrlToImagePayload } from './wechatStickerImagePayload'
import {
  isCharacterMusicSyncDirectiveArtifactLine,
  parseCharacterMusicSyncDirectiveFromArtifactLine,
} from './musicSync/wechatCharacterMusicSyncAi'
import {
  isCharacterMiniGameInviteDirectiveArtifactLine,
  parseCharacterMiniGameInviteDirectiveFromArtifactLine,
} from './miniGame/wechatCharacterMiniGameInviteAi'
import { emitTasteOrderPlaced } from '../takeout/tasteOrderBridge'
import {
  buildCharacterTakeoutOrderBundle,
  isTakeoutOrderDirectiveArtifactLine,
  parseTakeoutOrderDirective,
  takeoutOrderContentFallback,
} from './takeout/takeoutOrderShareAiDirective'
import {
  buildWeChatLocationPayloadFromAiDirective,
  isLocationShareDirectiveArtifactLine,
  parseLocationShareDirective,
} from './location/locationShareAiDirective'
import { locationShareContentFallback } from './location/wechatLocationUtils'
import {
  normalizeVoiceScriptForTts,
  sanitizeVoiceControlForTextBubble,
  sanitizeVoiceTranscriptDisplay,
  voiceTranscriptDuplicatesPlainTexts,
} from './wechatVoiceScript'

export type PlannedProactiveBubble = {
  id: string
  content: string
  thinking?: string
  timestamp: number
  voice?: WeChatVoicePayload
  images?: { base64: string; type: WeChatImageMime }[]
  musicSync?: WeChatMusicSyncInvitePayload
  locationShare?: WeChatLocationPayload
  takeoutOrder?: WeChatTakeoutOrderPayload
  stickerRef?: string
}

export type ProactiveTakeoutContext = {
  characterId: string
  characterName: string
  /** 未指定 recipientName 时的默认收货昵称 */
  defaultRecipientName: string
  /** @deprecated */
  userLabel?: string
}

function flattenProactiveBubbleContent(content: string): string[] {
  const out: string[] = []
  const normalizedRawLine = String(content ?? '').trim().replace(/\\n/g, '\n').trim()
  const parts = normalizedRawLine
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (parts.length > 1) out.push(...parts)
  else if (normalizedRawLine) out.push(normalizedRawLine)
  return out
}

async function planProactiveBubbleLineAsync(
  line: string,
  meta: { id: string; thinking?: string; timestamp: number },
  imageGen: { enabled: boolean; settings: MomentsImageGenSettings },
  takeoutCtx?: ProactiveTakeoutContext,
  recentCharacterStickerRefs: string[] = [],
  character?: Character | null,
): Promise<PlannedProactiveBubble | null> {
  const trimmed = String(line ?? '').trim()
  if (!trimmed) return null
  if (
    parseCharacterMusicSyncDirectiveFromArtifactLine(trimmed) ||
    isCharacterMusicSyncDirectiveArtifactLine(trimmed) ||
    parseCharacterMiniGameInviteDirectiveFromArtifactLine(trimmed) ||
    isCharacterMiniGameInviteDirectiveArtifactLine(trimmed) ||
    isLocationShareDirectiveArtifactLine(trimmed) ||
    isTakeoutOrderDirectiveArtifactLine(trimmed)
  ) {
    return null
  }

  const takeoutDirective = parseTakeoutOrderDirective(trimmed)
  if (takeoutDirective && takeoutCtx) {
    const bundle = buildCharacterTakeoutOrderBundle(takeoutDirective, {
      characterId: takeoutCtx.characterId,
      characterName: takeoutCtx.characterName,
      defaultRecipientName: takeoutCtx.defaultRecipientName ?? takeoutCtx.userLabel ?? '我',
    })
    if (!bundle) return null
    void emitTasteOrderPlaced(bundle.order)
    return {
      id: meta.id,
      content: takeoutOrderContentFallback(bundle.card),
      thinking: meta.thinking,
      timestamp: meta.timestamp,
      takeoutOrder: bundle.card,
    }
  }

  const locDirective = parseLocationShareDirective(trimmed)
  if (locDirective) {
    const payload = buildWeChatLocationPayloadFromAiDirective(locDirective)
    if (!payload) return null
    return {
      id: meta.id,
      content: locationShareContentFallback(payload),
      thinking: meta.thinking,
      timestamp: meta.timestamp,
      locationShare: payload,
    }
  }

  const voiceLineMatch = trimmed.match(/^(?:\[语音\]|【语音】)\s*(.*)$/)
  if (voiceLineMatch) {
    const rawScript = String(voiceLineMatch[1] ?? '').trim()
    if (!rawScript) return null
    const normalizedScript = normalizeVoiceScriptForTts(rawScript)
    const seg = sanitizeVoiceTranscriptDisplay(normalizedScript)
    const estimatedVoiceSec = Math.max(1, Math.min(30, Math.round(seg.length / 6)))
    const voice: WeChatVoicePayload = {
      durationSec: estimatedVoiceSec,
      emotionAnalyzed: true,
      ttsScript: normalizedScript,
      transcriptText: seg || '（语音）',
    }
    return {
      id: meta.id,
      content: seg || '[语音]',
      thinking: meta.thinking,
      timestamp: meta.timestamp,
      voice,
    }
  }

  const charImageGen = parseCharacterImageGenLine(trimmed)
  if (charImageGen && imageGen.enabled) {
    if (isImageGenQuotaOrRateLimitBlocked()) return null
    try {
      const dataUrl = await generateMomentsImage(
        buildCharacterMediaImageGenParams({
          prompt: charImageGen.prompt,
          settings: imageGen.settings,
          character,
        }),
      )
      const payloadImage = imageGenDataUrlToPayload(dataUrl)
      return {
        id: meta.id,
        content: '',
        thinking: meta.thinking,
        timestamp: meta.timestamp,
        images: [{ base64: payloadImage.base64, type: payloadImage.mime }],
      }
    } catch (err) {
      if (isImageGenThrottleOrQuotaError(err)) {
        markImageGenQuotaOrRateLimitBlocked(err)
      }
      return null
    }
  }

  const charSticker = parseCharacterStickerLine(trimmed)
  if (charSticker) {
    if (wasCharacterStickerRefUsedRecently(charSticker.ref, recentCharacterStickerRefs)) {
      return null
    }
    try {
      const payloadSticker = await stickerUrlToImagePayload(charSticker.url)
      recentCharacterStickerRefs.push(charSticker.ref)
      return {
        id: meta.id,
        content: formatStickerTranscriptLine(charSticker.ref),
        stickerRef: charSticker.ref,
        thinking: meta.thinking,
        timestamp: meta.timestamp,
        images: [{ base64: payloadSticker.base64, type: payloadSticker.mime }],
      }
    } catch {
      return null
    }
  }

  const seg = sanitizeVoiceControlForTextBubble(trimmed) || trimmed
  if (!seg.trim()) return null
  return {
    id: meta.id,
    content: seg,
    thinking: meta.thinking,
    timestamp: meta.timestamp,
  }
}

export async function planProactiveRevealBubblesAsync(
  bubbles: ProactiveMessageRevealBubble[],
  takeoutCtx?: ProactiveTakeoutContext,
  recentCharacterStickerRefs: string[] = [],
): Promise<PlannedProactiveBubble[]> {
  await ensureStickerStoreHydrated()
  const imageGenSettings = await loadResolvedImageGenSettings()
  const imageGenEnabled = isCharacterImageGenEnabled(imageGenSettings)
  const imageGen = { enabled: imageGenEnabled, settings: imageGenSettings }
  const characterId = takeoutCtx?.characterId?.trim()
  const character = characterId ? await personaDb.getCharacter(characterId) : null

  const out: PlannedProactiveBubble[] = []
  const plainTextsThisBatch: string[] = []
  for (const bubble of bubbles) {
    if (bubble.musicSync) {
      out.push({
        id: bubble.id,
        content: bubble.content.trim() || '[音乐共听邀约]',
        thinking: bubble.thinking,
        timestamp: bubble.timestamp,
        musicSync: bubble.musicSync,
      })
      continue
    }
    const lines = flattenProactiveBubbleContent(bubble.content)
    if (!lines.length) continue
    for (let i = 0; i < lines.length; i += 1) {
      const planned = await planProactiveBubbleLineAsync(
        lines[i]!,
        {
          id: i === 0 ? bubble.id : `${bubble.id}-l${i}`,
          thinking: i === 0 ? bubble.thinking : undefined,
          timestamp: bubble.timestamp + i,
        },
        imageGen,
        takeoutCtx,
        recentCharacterStickerRefs,
        character,
      )
      if (!planned) continue
      if (planned.voice) {
        const transcript = planned.voice.transcriptText?.trim() || planned.content.trim()
        if (voiceTranscriptDuplicatesPlainTexts(transcript, plainTextsThisBatch)) continue
      } else if (!planned.images?.length && !planned.locationShare && !planned.takeoutOrder) {
        const plain = planned.content.trim()
        if (plain) plainTextsThisBatch.push(plain)
      }
      out.push(planned)
      if (planned.voice) {
        const transcript = planned.voice.transcriptText?.trim() || planned.content.trim()
        if (transcript) plainTextsThisBatch.push(transcript)
      }
    }
  }
  return out
}

/** 修复落库时未解析 voice 字段的 `[语音]` 行，避免气泡显示原始脚本。 */
export function repairStoredVoiceMessageRow(m: WeChatChatMessage): WeChatChatMessage {
  if (m.voice) return m
  const content = String(m.content ?? '').trim()
  if (!/^(?:\[语音\]|【语音】)/.test(content)) return m
  const voiceLineMatch = content.match(/^(?:\[语音\]|【语音】)\s*(.*)$/)
  if (!voiceLineMatch) return m
  const rawScript = String(voiceLineMatch[1] ?? '').trim()
  if (!rawScript) return m
  const normalizedScript = normalizeVoiceScriptForTts(rawScript)
  const seg = sanitizeVoiceTranscriptDisplay(normalizedScript)
  const estimatedVoiceSec = Math.max(1, Math.min(30, Math.round(seg.length / 6)))
  return {
    ...m,
    content: seg || '[语音]',
    voice: {
      durationSec: estimatedVoiceSec,
      emotionAnalyzed: true,
      ttsScript: normalizedScript,
      transcriptText: seg || '（语音）',
    },
  }
}

/** 修复落库时未带 images 的 `[表情包]` 行，避免气泡显示引用名原文。 */
export async function repairStoredStickerMessageRow(m: WeChatChatMessage): Promise<WeChatChatMessage> {
  if (m.images?.length) return m
  const content = String(m.content ?? '').trim()
  if (!content.startsWith('[表情包]')) return m
  const charSticker = parseCharacterStickerLine(content)
  if (!charSticker) return m
  try {
    const payloadSticker = await stickerUrlToImagePayload(charSticker.url)
    return {
      ...m,
      content: formatStickerTranscriptLine(charSticker.ref),
      stickerRef: m.stickerRef?.trim() || charSticker.ref,
      images: [{ base64: payloadSticker.base64, type: payloadSticker.mime }],
    }
  } catch {
    return m
  }
}

export async function repairStoredMediaMessageRow(m: WeChatChatMessage): Promise<WeChatChatMessage> {
  const voiceFixed = repairStoredVoiceMessageRow(m)
  return await repairStoredStickerMessageRow(voiceFixed)
}
