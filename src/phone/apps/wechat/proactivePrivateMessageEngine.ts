import { loadResolvedApiConfig } from '../api/loadResolvedApiConfig'
import { isCharacterImageGenEnabled } from '../api/imageGenPresetUtils'
import { loadResolvedImageGenSettings } from '../api/loadResolvedImageGenSettings'
import { resolveCharacterMediaImageStyleHint } from '../../../components/moments/momentsImagePromptEnhancer'
import { characterHasAppearanceReference } from './characterAppearanceImageGen'
import { buildCharacterMomentsPinCatalogBlock } from '../../../components/moments/momentPinService'
import { buildUserMomentsVisibleToCharacterCatalogBlock } from '../../../components/moments/userMomentChatCatalog'
import { setBackgroundNotifyPendingWork } from '../backgroundNotify/backgroundNotifyPendingWork'
import { resolveWorldBookUserBinding } from './charUserPlaceholders'
import {
  buildMeetWechatPrivateChatContinuityBlock,
  isMeetSyncedCharacter,
  loadMeetUserProfileSnapshotFromKv,
} from '../lumiMeet/meetUserProfileSnapshot'
import { personaDb } from './newFriendsPersona/idb'
import type { ChatConversationSettingsRow, WeChatChatMessage, WeChatMusicSyncInvitePayload } from './newFriendsPersona/types'
import { formatWorldBackgroundForPrompt } from './newFriendsPersona/worldBackgroundFormat'
import { loadAccountsBundle } from './wechatAccountPersistence'
import { buildFriendRequestPrivatePromptPack } from './wechatFriendRequestPrivatePromptPack'
import {
  requestWeChatPeerReplyBubbles,
  type ChatTranscriptTurn,
} from './wechatChatAi'
import { stripAndApplyCharacterMomentPinDirectives } from './wechatCharacterMomentPinApply'
import { stripAndApplyCharacterMomentPublishDirectives } from './wechatCharacterMomentPublishApply'
import {
  buildCharacterProfileImageCatalogBlock,
  stripAndApplyCharacterProfileImageActions,
} from './wechatCharacterProfileImageApply'
import { stripCharacterImageGenLinesFromBubbles, limitCharacterImageGenLinesFromBubbles } from './wechatCharacterImageGen'
import {
  drawRoundImageCount,
  parseStoredImageRoundCountRange,
  rollImageRoundTriggerAllowed,
} from './wechatMediaSendFrequency'
import {
  buildCharacterWechatProfileStateBlock,
  stripAndApplyCharacterWechatProfileUpdates,
} from './wechatCharacterProfileUpdateApply'
import {
  isWechatGroupConversationKey,
  parsePrivateWeChatConversationCharacterAndSession,
  parseWechatAccountPrivateConversationKey,
  WECHAT_LUMI_PEER_CHARACTER_ID,
  WECHAT_SELF_PEER_CHARACTER_ID,
} from './wechatConversationKey'
import {
  isCharacterTimePerceptionEnabled,
  normalizeWeChatTimeConfig,
  resolveWeChatCurrentTimeMs,
} from './time/wechatTimeUtils'
import { loadCharacterPsycheState } from './characterPsyche/characterPsycheStore'
import {
  buildProactiveCatchUpReplyBias,
  buildProactivePrivateMessageReplyBias,
  computeMsSinceLastUserMessage,
  hasProactiveMessageScheduleSaved,
  resolveProactiveMessageAiRound,
} from './proactivePrivateMessageTypes'
import { persistProactiveRevealPayload } from './proactiveBubbleRevealPersistence'
import { stickerTranscriptTextFromFields } from './stickers/stickerAntiRepeat'
import { buildSyncListeningPlaybackBias } from './musicSync/syncListeningPlaybackBias'
import { WECHAT_CHARACTER_MUSIC_SYNC_OUTPUT_BLOCK, buildCharacterMusicSyncInviteStateBias } from './musicSync/wechatCharacterMusicSyncAi'
import {
  buildCharacterMusicSyncSessionContextForProactive,
  stripAndApplyCharacterMusicSyncDirectives,
} from './musicSync/applyCharacterMusicSyncDirective'
import {
  stripAndApplyCharacterMomentSongShareDirectives,
  WECHAT_CHARACTER_MOMENT_SONG_SHARE_APPENDIX,
} from './wechatCharacterMomentSongShareApply'
import {
  drawProactiveVariableIntervalSeconds,
  isProactiveVariableIntervalEnabled,
  resolveCharacterExplicitBusyForProactive,
  resolveProactiveMessageEffectiveIntervalSeconds,
} from './proactiveVariableInterval'
import {
  tryHandoffProactiveMessageReveal,
  stashProactiveMessageReveal,
  installProactiveMessageRevealLifecycle,
  type ProactiveMessageRevealBubble,
} from './proactiveMessageRevealBridge'
import {
  computeMissedProactiveMessageRoundCount,
  computeProactiveMessageSlotScheduledAtMs,
  resolveProactiveHistoricalDisplayTimestampMs,
  resolveProactiveMessageIntervalMs,
} from './proactiveScheduling'

const TICK_MS = 5_000

let installed = false
let runningTick = false
const inFlightKeys = new Set<string>()
const aiBusyKeys = new Set<string>()
const inFlightListeners = new Set<() => void>()

function notifyProactiveMessageInFlightChange(): void {
  for (const fn of inFlightListeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function subscribeProactiveMessageInFlight(listener: () => void): () => void {
  inFlightListeners.add(listener)
  return () => {
    inFlightListeners.delete(listener)
  }
}

function newMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `wx-proactive-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function markProactiveMessageConversationAiBusy(conversationKey: string, busy: boolean): void {
  const k = conversationKey.trim()
  if (!k) return
  if (busy) aiBusyKeys.add(k)
  else aiBusyKeys.delete(k)
}

/** 用户手动触发角色回复时，将主动消息倒计时锚点重置为当前时刻，避免与即将到来的角色回复重复。 */
export async function resetProactiveMessageCountdown(conversationKey: string): Promise<void> {
  const key = conversationKey.trim()
  if (!key || isWechatGroupConversationKey(key)) return
  if (!parsePrivateWeChatConversationCharacterAndSession(key)) return
  const row = await personaDb.getChatConversationSettings(key)
  if (!row?.proactiveMessageEnabled) return
  if (!hasProactiveMessageScheduleSaved(row)) return
  const now = Date.now()
  const patch: Parameters<typeof personaDb.upsertChatConversationSettings>[0] = {
    conversationKey: key,
    peerCharacterId: row.peerCharacterId,
    playerIdentityId: row.playerIdentityId,
    proactiveMessageLastFiredAtMs: now,
  }
  if (isProactiveVariableIntervalEnabled(row)) {
    const explicitBusy = await resolveCharacterExplicitBusyForProactive({ row, now })
    patch.proactiveMessageNextIntervalSeconds = drawProactiveVariableIntervalSeconds(explicitBusy, row)
  }
  await personaDb.upsertChatConversationSettings(patch)
}

export function isProactiveMessageInFlight(conversationKey: string): boolean {
  return inFlightKeys.has(conversationKey.trim())
}

function isPersonaPrivateConversation(row: ChatConversationSettingsRow): boolean {
  const k = row.conversationKey.trim()
  if (!k || isWechatGroupConversationKey(k)) return false
  const peer = row.peerCharacterId.trim()
  if (!peer || peer === WECHAT_LUMI_PEER_CHARACTER_ID || peer === WECHAT_SELF_PEER_CHARACTER_ID) return false
  return !!parsePrivateWeChatConversationCharacterAndSession(k)
}

function storedMessagesToTranscript(messages: WeChatChatMessage[]): ChatTranscriptTurn[] {
  return messages
    .filter((m) => !m.isRecalled && !m.ext?.centerSystemStrip)
    .map((m) => {
      const from = m.type === 'player' ? ('self' as const) : ('other' as const)
      if (m.voice) {
        const txt = m.voice.transcriptText?.trim() || m.content?.trim() || '（语音）'
        const emo = m.voice.emotionLabel?.trim()
        const who = m.type === 'player' ? '用户语音' : '对方语音'
        const voiceText = emo ? `（${who}，情绪：${emo}）${txt}` : `（${who}）${txt}`
        return { id: m.id, from, text: voiceText, replyTo: m.replyTo }
      }
      const stickerLine = stickerTranscriptTextFromFields(m.content, m.stickerRef)
      if (stickerLine) return { id: m.id, from, text: stickerLine, replyTo: m.replyTo }
      const text = m.content?.trim()
      if (text) return { id: m.id, from, text, replyTo: m.replyTo }
      if (m.images?.length) return { id: m.id, from, text: '（发送了一张图片）', replyTo: m.replyTo }
      return { id: m.id, from, text: '', replyTo: m.replyTo }
    })
    .filter((t) => t.text.trim())
}

async function shouldFire(row: ChatConversationSettingsRow, now: number): Promise<boolean> {
  if (!row.proactiveMessageEnabled) return false
  const key = row.conversationKey.trim()
  if (!key || inFlightKeys.has(key) || aiBusyKeys.has(key)) return false

  if (!hasProactiveMessageScheduleSaved(row)) return false

  const explicitBusy = await resolveCharacterExplicitBusyForProactive({ row, now })
  const intervalMs =
    resolveProactiveMessageEffectiveIntervalSeconds(row, {
      characterExplicitlyBusy: explicitBusy,
    }) * 1000
  const lastFired = row.proactiveMessageLastFiredAtMs ?? 0
  if (now - lastFired < intervalMs) return false

  const gs = await personaDb.getGlobalSettings()
  let busyEnabled = true
  let isBusy = false
  let busyEnd = 0
  if (gs.busyMode === 'character') {
    const busyRow = await personaDb.getCharacterBusySettings(row.peerCharacterId)
    busyEnabled = busyRow?.enabled ?? true
    isBusy = !!busyRow?.isBusy
    busyEnd = busyRow?.busyEndTime ?? 0
  } else {
    const kv = await personaDb.getPhoneKv(`busy-conv:${key}`)
    busyEnabled = typeof kv === 'boolean' ? kv : true
    const busyRow = await personaDb.getCharacterBusySettings(row.peerCharacterId)
    isBusy = !!busyRow?.isBusy
    busyEnd = busyRow?.busyEndTime ?? 0
  }
  if (busyEnabled && isBusy && busyEnd > now) return false

  return true
}

async function fireProactiveMessage(row: ChatConversationSettingsRow): Promise<void> {
  const key = row.conversationKey.trim()
  const parsed = parsePrivateWeChatConversationCharacterAndSession(key)
  if (!parsed) return

  const freshRow = (await personaDb.getChatConversationSettings(key)) ?? row
  const scheduleNow = Date.now()
  if (!(await shouldFire(freshRow, scheduleNow))) return

  const explicitBusyForSchedule = await resolveCharacterExplicitBusyForProactive({
    row: freshRow,
    now: scheduleNow,
  })
  const scheduleOptions = { characterExplicitlyBusy: explicitBusyForSchedule }
  const roundCount = computeMissedProactiveMessageRoundCount(freshRow, scheduleNow, scheduleOptions)
  if (roundCount <= 0) return

  if (inFlightKeys.has(key) || aiBusyKeys.has(key)) return

  const characterId = parsed.characterId.trim()
  const sessionPid = parsed.sessionPlayerId.trim() || '__none__'
  const peerCharacterId = freshRow.peerCharacterId.trim() || characterId
  const playerIdentityId =
    sessionPid !== '__none__' ? sessionPid : freshRow.playerIdentityId.trim() || sessionPid
  const scoped = parseWechatAccountPrivateConversationKey(key)
  const wechatAccountId = scoped?.wechatAccountId ?? null

  const apiConfig = await loadResolvedApiConfig('chatCard')
  if (!apiConfig?.apiUrl?.trim() || !apiConfig.apiKey?.trim() || !apiConfig.modelId?.trim()) {
    return
  }

  const character = await personaDb.getCharacter(characterId)
  if (!character) return

  const latestRow = (await personaDb.getChatConversationSettings(key)) ?? freshRow
  const fireNow = Date.now()
  if (!(await shouldFire(latestRow, fireNow))) return
  if (inFlightKeys.has(key) || aiBusyKeys.has(key)) return

  inFlightKeys.add(key)
  notifyProactiveMessageInFlightChange()
  setBackgroundNotifyPendingWork({ wechatTyping: true })
  let activeRow = latestRow
  try {
    const bundle = await loadAccountsBundle()

    const account =
      wechatAccountId && bundle?.accounts
        ? bundle.accounts.find((a) => a.accountId === wechatAccountId)
        : undefined
    const playerDisplayName = account?.nickname?.trim() || '我'
    const wechatHome = {
      displayName: playerDisplayName,
      signature: account?.signature?.trim() || '',
    }

    let worldBackgroundPrompt: string | undefined
    if (character.worldBackgroundEnabled !== false && character.worldBackgroundId?.trim()) {
      const wbg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
      const block = formatWorldBackgroundForPrompt(wbg)
      if (block.trim()) worldBackgroundPrompt = block
    }

    const playerIdentity =
      sessionPid && sessionPid !== '__none__' && wechatAccountId
        ? await personaDb.getPlayerIdentityForWechatAccount(sessionPid, wechatAccountId)
        : null

    const fromMeet = isMeetSyncedCharacter(characterId, character.worldBooks ?? [])
    let meetWechatContinuityBlock: string | undefined
    if (fromMeet) {
      const meetSnap = await loadMeetUserProfileSnapshotFromKv(characterId)
      meetWechatContinuityBlock = buildMeetWechatPrivateChatContinuityBlock({
        meetSnapshot: meetSnap,
        wechatProfile: wechatHome,
        forFriendRequest: false,
      })
    }

    const worldBookBinding = await resolveWorldBookUserBinding(character)
    const charTimeRow = await personaDb.getCharacterTimeSettings(characterId)
    const timePerceptionEnabled = isCharacterTimePerceptionEnabled(charTimeRow)
    const [global, charTime] = await Promise.all([
      personaDb.getGlobalSettings(),
      personaDb.getCharacterTimeSettings(characterId),
    ])
    const timeCfg = normalizeWeChatTimeConfig(charTime?.config ?? global.globalTimeConfig)

    const resolvedImageGenSettings = await loadResolvedImageGenSettings()
    const characterImageGenEnabled = isCharacterImageGenEnabled(resolvedImageGenSettings)
    const characterImageGenStyleHint = resolveCharacterMediaImageStyleHint(
      resolvedImageGenSettings,
      characterHasAppearanceReference(character),
    )

    const characterMomentsPinCatalog =
      wechatAccountId && characterId
        ? await buildCharacterMomentsPinCatalogBlock(wechatAccountId, characterId)
        : ''
    const userMomentsViewerCatalog =
      wechatAccountId && characterId
        ? await buildUserMomentsVisibleToCharacterCatalogBlock({
            accountId: wechatAccountId,
            characterId,
            playerIdentityId: sessionPid,
            playerDisplayName,
          })
        : ''
    const characterWechatProfileBlock = [
      buildCharacterWechatProfileStateBlock(character),
      buildCharacterProfileImageCatalogBlock(character),
    ]
      .filter((x) => x.trim())
      .join('\n\n')

    const imageCountRange = parseStoredImageRoundCountRange(
      activeRow.imageRoundCountMin,
      activeRow.imageRoundCountMax,
    )

    const realNow = Date.now()
    const intervalMs = resolveProactiveMessageIntervalMs(activeRow, scheduleOptions)
    const anchorLastFired = activeRow.proactiveMessageLastFiredAtMs ?? 0

    const isCatchUpBatch = roundCount > 1
    const notifyTitle =
      character.wechatNickname?.trim() || character.name?.trim() || '聊天'

    let psycheAffection: number | null = null
    let psycheRelationshipDef: string | null = null
    try {
      const psyche = await loadCharacterPsycheState({
        conversationCharacterId: characterId,
        playerIdentityId,
        personaCharacterId: characterId,
        characterFullName: character.name?.trim() || 'TA',
      })
      psycheAffection = psyche.state?.affection ?? null
      psycheRelationshipDef = psyche.state?.relationshipDef ?? null
    } catch {
      /* ignore */
    }

    let completedRounds = 0

    for (let slot = 1; slot <= roundCount; slot += 1) {
      const scheduledRealAt =
        anchorLastFired > 0
          ? computeProactiveMessageSlotScheduledAtMs(anchorLastFired, intervalMs, slot)
          : realNow
      const displayRealBase = isCatchUpBatch
        ? scheduledRealAt
        : resolveProactiveHistoricalDisplayTimestampMs(scheduledRealAt, realNow)
      const gameNowForRound = timePerceptionEnabled
        ? resolveWeChatCurrentTimeMs(timeCfg, displayRealBase)
        : displayRealBase
      const tsBase = gameNowForRound

      const messages = await personaDb.listWeChatChatMessagesByConversationKey(key)
      const transcript = storedMessagesToTranscript(messages).slice(-48)
      const msSinceLastUserMessage = computeMsSinceLastUserMessage(messages, gameNowForRound)

      const replyBias = [
        buildProactivePrivateMessageReplyBias(messages, {
          msSinceLastUserMessage,
          affection: psycheAffection,
          relationshipDef: psycheRelationshipDef,
        }),
        buildProactiveCatchUpReplyBias(slot, roundCount),
        buildSyncListeningPlaybackBias(characterId, { forProactive: true }),
        buildCharacterMusicSyncInviteStateBias(characterId, messages),
        WECHAT_CHARACTER_MUSIC_SYNC_OUTPUT_BLOCK,
        WECHAT_CHARACTER_MOMENT_SONG_SHARE_APPENDIX,
      ]
        .filter((x) => x.trim())
        .join('\n\n')
      const aiRound = resolveProactiveMessageAiRound(messages)

      const pack = await buildFriendRequestPrivatePromptPack({
        characterId: peerCharacterId,
        conversationKey: key,
        sessionPlayerIdentityId: sessionPid,
        apiConfig,
        transcript,
        biasTextForMemoryHaystack: replyBias,
        strangerMemoryGuard: false,
        crossAccountContext:
          wechatAccountId && bundle?.accounts
            ? { currentAccountId: wechatAccountId, allAccounts: bundle.accounts }
            : undefined,
      })

      const imageRoundAllowed = rollImageRoundTriggerAllowed(activeRow.imageRoundTriggerPercent)
      const imageRoundCountTarget = imageRoundAllowed ? drawRoundImageCount(imageCountRange) : 0

      const ai = await requestWeChatPeerReplyBubbles({
        apiConfig,
        character,
        playerIdentity,
        playerDisplayName,
        wechatHomeProfile: wechatHome,
        meetWechatContinuityBlock,
        transcript,
        promptMode: 'persona',
        longTermMemoryNotes: pack.memory || undefined,
        longTermMemoryMomentImages: pack.momentImageUrls?.length ? pack.momentImageUrls : undefined,
        worldBackgroundPrompt,
        offlineDatingPlotsContext: pack.offlineDatingPlotsContext || undefined,
        meetEncounterMemoriesContext: pack.meetEncounterMemoriesContext || undefined,
        unsummarizedPrivateNotes: pack.unsPrivate || undefined,
        unsummarizedGroupNotes: pack.unsGroup || undefined,
        unsummarizedMeetNotes: pack.unsMeet || undefined,
        storyTimelineNotes: pack.storyTimeline || undefined,
        recentPrivateAiRoundsNotes: pack.recentPrivateAiRounds || undefined,
        recentOfflineAiRoundsNotes: pack.recentOfflineAiRounds || undefined,
        recentMeetAiRoundsNotes: pack.recentMeetAiRounds || undefined,
        recentGroupChatsReference: pack.recentGroupChatsReference || undefined,
        replyBias,
        includeThinkingChain: true,
        currentTimeMs: gameNowForRound,
        timePerceptionEnabled,
        chatMemberIds: [peerCharacterId],
        globalWechatPlate: 'private_chat',
        worldBookPlayerIdentity: worldBookBinding?.row ?? null,
        worldBookUserLineLabel: worldBookBinding?.lineLabel,
        stickerRoundTriggerPercent: activeRow.stickerRoundTriggerPercent,
        voiceRoundTriggerPercent: activeRow.voiceRoundTriggerPercent,
        ...(activeRow.classicEmojiRoundTriggerPercent !== undefined
          ? { classicEmojiRoundTriggerPercent: activeRow.classicEmojiRoundTriggerPercent }
          : { applyClassicEmojiDefault: true }),
        ...(activeRow.stickerTargetedModeEnabled ? { stickerTargetedModeEnabled: true } : {}),
        ...(activeRow.stickerTargetedGroups?.length ? { stickerTargetedGroups: activeRow.stickerTargetedGroups } : {}),
        ...(activeRow.stickerTargetedEntries ? { stickerTargetedEntries: activeRow.stickerTargetedEntries } : {}),
        ...(activeRow.stickerBannedRefs?.length ? { stickerBannedRefs: activeRow.stickerBannedRefs } : {}),
        ...(activeRow.classicEmojiBannedNames?.length
          ? { classicEmojiBannedNames: activeRow.classicEmojiBannedNames }
          : {}),
        ...(characterImageGenEnabled
          ? {
              characterImageGenEnabled: true,
              characterImageGenStyleHint,
              imageRoundTriggerPercent: activeRow.imageRoundTriggerPercent,
              imageRoundCountMin: imageCountRange.min,
              imageRoundCountMax: imageCountRange.max,
              ...(imageRoundCountTarget > 0 ? { imageRoundCountTarget: imageRoundCountTarget } : {}),
              ...(imageRoundAllowed ? { imageRoundAllowed: true } : {}),
            }
          : {}),
        ...(characterMomentsPinCatalog.trim()
          ? { characterMomentsPinCatalog }
          : {}),
        ...(userMomentsViewerCatalog.trim()
          ? { userMomentsViewerCatalog }
          : {}),
        ...(characterWechatProfileBlock.trim()
          ? { characterWechatProfileBlock }
          : {}),
        proactiveInitiation: aiRound.proactiveInitiation,
        proactiveInitiationNudge: aiRound.proactiveInitiationNudge,
      })

      let bubbles = (ai.bubbles ?? []).map((s) => String(s ?? '').trim()).filter(Boolean)
      if (characterImageGenEnabled && !imageRoundAllowed) {
        bubbles = stripCharacterImageGenLinesFromBubbles(bubbles)
      } else if (characterImageGenEnabled && imageRoundAllowed) {
        bubbles = limitCharacterImageGenLinesFromBubbles(bubbles, imageCountRange.max)
      }
      let musicSyncInvites: WeChatMusicSyncInvitePayload[] = []
      if (wechatAccountId && characterId) {
        if (bubbles.length) {
          const profileImageApplied = await stripAndApplyCharacterProfileImageActions({
            characterId,
            bubbles,
          })
          bubbles = profileImageApplied.bubbles
          const profileApplied = await stripAndApplyCharacterWechatProfileUpdates({
            characterId,
            bubbles,
          })
          bubbles = profileApplied.bubbles
          bubbles = await stripAndApplyCharacterMomentPublishDirectives({
            accountId: wechatAccountId,
            characterId,
            playerIdentityId,
            playerDisplayName,
            apiConfig,
            bubbles,
          })
          bubbles = await stripAndApplyCharacterMomentSongShareDirectives({
            accountId: wechatAccountId,
            characterId,
            playerIdentityId,
            playerDisplayName,
            apiConfig,
            bubbles,
          })
          bubbles = await stripAndApplyCharacterMomentPinDirectives({
            accountId: wechatAccountId,
            characterId,
            bubbles,
          })
        }
        const musicSyncStripped = await stripAndApplyCharacterMusicSyncDirectives({
          bubbles,
          ctx: buildCharacterMusicSyncSessionContextForProactive({
            characterId: peerCharacterId,
            characterDisplayName:
              character.wechatNickname?.trim() || character.remark?.trim() || character.name?.trim() || '对方',
            characterAvatarUrl: character.avatarUrl,
            playerDisplayName,
            playerAvatarUrl: account?.avatarUrl,
          }),
        })
        bubbles = musicSyncStripped.bubbles
        musicSyncInvites = musicSyncStripped.invites
      }
      if (!bubbles.length && !musicSyncInvites.length) {
        completedRounds = slot
        continue
      }

      let ts = tsBase
      const revealBubbles: ProactiveMessageRevealBubble[] = []
      for (let i = 0; i < bubbles.length; i += 1) {
        const content = bubbles[i]!
        ts += i === 0 ? 0 : 800 + Math.floor(Math.random() * 1200)
        revealBubbles.push({
          id: newMessageId(),
          content,
          thinking: i === 0 ? ai.thinking : undefined,
          timestamp: ts,
        })
      }
      for (const invite of musicSyncInvites) {
        ts += 800 + Math.floor(Math.random() * 1200)
        revealBubbles.push({
          id: newMessageId(),
          content: bubbles[bubbles.length - 1]?.trim() || '[音乐共听邀约]',
          timestamp: ts,
          musicSync: invite,
        })
      }

      const revealPayload = {
        conversationKey: key,
        characterId: peerCharacterId,
        playerIdentityId,
        playerDisplayName,
        notifyPeerTitle: notifyTitle,
        bubbles: revealBubbles,
      }

      if (isCatchUpBatch) {
        await persistProactiveRevealPayload(revealPayload, false)
      } else {
        const handedOff = tryHandoffProactiveMessageReveal(revealPayload)
        if (!handedOff) {
          stashProactiveMessageReveal(revealPayload)
        }
      }

      completedRounds = slot
      const slotLastFiredMs =
        anchorLastFired > 0 ? anchorLastFired + slot * intervalMs : Date.now()
      await personaDb.upsertChatConversationSettings({
        conversationKey: key,
        peerCharacterId: activeRow.peerCharacterId,
        playerIdentityId: activeRow.playerIdentityId,
        proactiveMessageLastFiredAtMs: slotLastFiredMs,
      })
    }

    if (completedRounds <= 0) return

    const explicitBusy = await resolveCharacterExplicitBusyForProactive({ row: activeRow, now: realNow })
    const nextPatch: Parameters<typeof personaDb.upsertChatConversationSettings>[0] = {
      conversationKey: key,
      peerCharacterId: activeRow.peerCharacterId,
      playerIdentityId: activeRow.playerIdentityId,
    }
    if (isProactiveVariableIntervalEnabled(activeRow)) {
      nextPatch.proactiveMessageNextIntervalSeconds = drawProactiveVariableIntervalSeconds(explicitBusy, activeRow)
    }
    await personaDb.upsertChatConversationSettings(nextPatch)
  } catch (err) {
    console.warn('[proactivePrivateMessage]', err)
  } finally {
    inFlightKeys.delete(key)
    notifyProactiveMessageInFlightChange()
    setBackgroundNotifyPendingWork({ wechatTyping: false })
  }
}

async function runTick(): Promise<void> {
  if (runningTick) return
  runningTick = true
  try {
    const all = await personaDb.listAllChatConversationSettings()
    const now = Date.now()
    const candidates = all.filter((row) => row && isPersonaPrivateConversation(row) && row.proactiveMessageEnabled)
    for (const row of candidates) {
      if (!(await shouldFire(row, now))) continue
      void fireProactiveMessage(row)
    }
  } finally {
    runningTick = false
  }
}

export function installProactivePrivateMessageEngine(): void {
  if (installed) return
  installed = true

  installProactiveMessageRevealLifecycle()

  const onStorage = () => void runTick()
  window.addEventListener('wechat-storage-changed', onStorage)
  document.addEventListener('visibilitychange', onStorage)

  void runTick()
  setInterval(() => void runTick(), TICK_MS)
}
