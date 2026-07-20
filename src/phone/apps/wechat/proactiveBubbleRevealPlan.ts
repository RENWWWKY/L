import type { Character, WeChatChatMessage, WeChatImageMime, WeChatVoicePayload, WeChatMusicSyncInvitePayload, WeChatLocationPayload, WeChatTakeoutOrderPayload } from './newFriendsPersona/types'
import { personaDb } from './newFriendsPersona/idb'
import type { ProactiveMessageRevealBubble } from './proactiveMessageRevealBridge'
import { parseCharacterStickerLine, ensureStickerStoreHydrated } from './stickers/stickerStore'
import {
  formatStickerTranscriptLine,
  wasCharacterStickerRefUsedRecently,
} from './stickers/stickerAntiRepeat'
import { parseCharacterImageGenLine } from './wechatCharacterImageGen'
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
  applyPulseCommentDirective,
  isPulseCommentDirectiveArtifactLine,
  parsePulseCommentDirective,
  stripPulseCommentDirectivesFromBubbles,
} from './pulse/pulseShareAiDirective'
import {
  applyPulseFollowDirective,
  isPulseFollowDirectiveArtifactLine,
  parsePulseFollowDirective,
  stripPulseFollowDirectivesFromBubbles,
} from './pulse/pulseFollowAiDirective'
import {
  isPulseDmScreenshotDirectiveArtifactLine,
  parsePulseDmScreenshotPlaceholderId,
  preparePulseDmScreenshotPlaceholders,
  PULSE_DM_SCREENSHOT_TRANSCRIPT,
  stripPulseDmScreenshotDirectivesFromBubbles,
  takePulseDmScreenshotCachedImage,
} from './pulse/pulseDmScreenshotAiDirective'
import {
  buildCharacterTakeoutOrderBundle,
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
  imageGenPending?: boolean
  imageGenAwaitingConfirm?: boolean
  imageGenFailed?: boolean
  /** 给用户看的中文画面描述（占位） */
  imageDescription?: string
  /** 英文生图提示词缓存（点生成后写入） */
  imageGenPrompt?: string
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
  /** 当前会话玩家身份（微博关注指令） */
  playerIdentityId?: string
  playerDisplayName?: string
  playerAvatarUrl?: string
  /** 会话开启「微博私信截图」时才合成图片 */
  pulseDmScreenshotEnabled?: boolean
}

async function planProactiveBubbleLineAsync(
  line: string,
  meta: { id: string; thinking?: string; timestamp: number },
  takeoutCtx?: ProactiveTakeoutContext,
  recentCharacterStickerRefs: string[] = [],
  _character?: Character | null,
): Promise<PlannedProactiveBubble | null> {
  const trimmed = String(line ?? '').trim()
  if (!trimmed) return null
  if (
    parseCharacterMusicSyncDirectiveFromArtifactLine(trimmed) ||
    isCharacterMusicSyncDirectiveArtifactLine(trimmed) ||
    parseCharacterMiniGameInviteDirectiveFromArtifactLine(trimmed) ||
    isCharacterMiniGameInviteDirectiveArtifactLine(trimmed) ||
    isLocationShareDirectiveArtifactLine(trimmed)
  ) {
    return null
  }

  const pulseCommentDirective = parsePulseCommentDirective(trimmed)
  if (pulseCommentDirective) {
    if (takeoutCtx?.characterId?.trim()) {
      void applyPulseCommentDirective(pulseCommentDirective, {
        characterId: takeoutCtx.characterId,
        characterName: takeoutCtx.characterName,
      }).catch(() => {
        /* ignore */
      })
    }
    return null
  }
  if (isPulseCommentDirectiveArtifactLine(trimmed)) return null

  const pulseFollowDirective = parsePulseFollowDirective(trimmed)
  if (pulseFollowDirective) {
    const pid = takeoutCtx?.playerIdentityId?.trim()
    if (takeoutCtx?.characterId?.trim() && pid && pid !== '__none__') {
      void applyPulseFollowDirective(pulseFollowDirective, {
        characterId: takeoutCtx.characterId,
        characterName: takeoutCtx.characterName,
        playerIdentityId: pid,
        playerDisplayName: takeoutCtx.playerDisplayName,
        playerAvatarUrl: takeoutCtx.playerAvatarUrl,
      }).catch(() => {
        /* ignore */
      })
    }
    return null
  }
  if (isPulseFollowDirectiveArtifactLine(trimmed)) return null

  const pulseDmShotId = parsePulseDmScreenshotPlaceholderId(trimmed)
  if (pulseDmShotId) {
    const payload = takePulseDmScreenshotCachedImage(pulseDmShotId)
    if (!payload) return null
    return {
      id: meta.id,
      content: PULSE_DM_SCREENSHOT_TRANSCRIPT,
      thinking: meta.thinking,
      timestamp: meta.timestamp,
      images: [{ base64: payload.base64, type: payload.mime }],
    }
  }
  if (isPulseDmScreenshotDirectiveArtifactLine(trimmed)) return null

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
  if (charImageGen) {
    return {
      id: meta.id,
      content: '',
      thinking: meta.thinking,
      timestamp: meta.timestamp,
      imageGenPending: false,
      imageGenAwaitingConfirm: true,
      imageDescription: charImageGen.description,
      imageGenPrompt: charImageGen.prompt,
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
    const stripped = stripPulseCommentDirectivesFromBubbles([bubble.content])
    if (stripped.directives.length && takeoutCtx?.characterId?.trim()) {
      for (const directive of stripped.directives) {
        void applyPulseCommentDirective(directive, {
          characterId: takeoutCtx.characterId,
          characterName: takeoutCtx.characterName,
        }).catch(() => {
          /* ignore */
        })
      }
    }
    const followStripped = stripPulseFollowDirectivesFromBubbles(stripped.bubbles)
    if (followStripped.directives.length && takeoutCtx?.characterId?.trim()) {
      const pid = takeoutCtx.playerIdentityId?.trim()
      if (pid && pid !== '__none__') {
        for (const directive of followStripped.directives) {
          void applyPulseFollowDirective(directive, {
            characterId: takeoutCtx.characterId,
            characterName: takeoutCtx.characterName,
            playerIdentityId: pid,
            playerDisplayName: takeoutCtx.playerDisplayName,
            playerAvatarUrl: takeoutCtx.playerAvatarUrl,
          }).catch(() => {
            /* ignore */
          })
        }
      }
    }
    const dmShotStripped = stripPulseDmScreenshotDirectivesFromBubbles(followStripped.bubbles)
    const dmShotEnabled = takeoutCtx?.pulseDmScreenshotEnabled === true
    if (dmShotEnabled && dmShotStripped.pending.length) {
      await preparePulseDmScreenshotPlaceholders(dmShotStripped.pending)
    }
    const lines = dmShotEnabled
      ? dmShotStripped.bubbles
      : dmShotStripped.bubbles.filter((ln) => !parsePulseDmScreenshotPlaceholderId(ln))
    if (!lines.length) continue
    for (let i = 0; i < lines.length; i += 1) {
      const planned = await planProactiveBubbleLineAsync(
        lines[i]!,
        {
          id: i === 0 ? bubble.id : `${bubble.id}-l${i}`,
          thinking: i === 0 ? bubble.thinking : undefined,
          timestamp: bubble.timestamp + i,
        },
        takeoutCtx,
        recentCharacterStickerRefs,
        character,
      )
      if (!planned) continue
      if (planned.voice) {
        const transcript = planned.voice.transcriptText?.trim() || planned.content.trim()
        if (voiceTranscriptDuplicatesPlainTexts(transcript, plainTextsThisBatch)) continue
      } else if (
        !planned.images?.length &&
        !planned.imageGenPending &&
        !planned.imageGenAwaitingConfirm &&
        !planned.locationShare &&
        !planned.takeoutOrder
      ) {
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
