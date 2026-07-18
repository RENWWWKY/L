import type { ApiConfig } from '../api/types'
import {
  collectCharacterMentionSearchTokens,
  resolveOfflineDatingArchiveContext,
  textMentionsAnyToken,
} from './dating/offlineDatingArchiveResolve'
import { buildOfflinePlotsFullText } from './dating/loadOfflineDatingPlotsForWechatPrompt'
import { offlinePlotBodyRelevantToNpcForLinkedExcerpt } from './dating/offlineDatingNpcSpeakerDetect'
import { splitDatingAssistantOutput } from './dating/plotCoT'
import { extractVnVoiceParamsBlock } from './dating/vnVoiceParamsStrip'
import { findGroupMember } from './groupChatUtils'
import { buildNpcLinkedOfflineExcerptUserBlock } from './memory/linkedOfflineExcerptsForAutoSummary'
import { resolveAutoSummaryApiConfig } from './memory/memorySummaryApi'
import { isOfflineDatingRowPerRoundMode, isLinkedMemoryAutoSummaryEnabled, isWeChatOnlineRowPerRoundMode } from './memory/memoryRowPerRoundMode'
import { buildEligibleLinkedMemoryRosterForDatingAppendix } from './memory/linkedMemoryEligiblePeers'
import {
  listAllLinkedMemoryEligibleCharacters,
  buildMemoryIdPlaceholderCorrections,
  buildMemorySummaryPrimaryIdRoster,
} from './memory/linkedMemoryEligiblePeers'
import { applyMemoryIdPlaceholderCorrections } from './memory/memoryIdPlaceholderNormalize'
import { plotBodyMentionsCharacter } from './dating/offlineDatingArchiveResolve'
import { personaDb, pullPhoneKvWithLocalStorageLegacy } from './newFriendsPersona/idb'
import type {
  Character,
  GroupChatRow,
  GroupMember,
  WeChatChatMessage,
  WorldBookUserPlaceholderBinding,
} from './newFriendsPersona/types'
import { dispatchDatingLinkedMemorySummarySuccess } from './dating/datingLinkedMemorySummarySuccessEvents'
import {
  type MemoryAiRoundCountChannel,
  resetMemoryAiRoundCountForChannel,
  rollbackMemoryAiRoundCountForChannel,
} from '../lumiMeet/meetMemorySummarySettings'
import { notifyMemorySummaryAttempt } from './memory/memorySummaryRetry'
import {
  formatLinkedMemorySummaryParsedPreview,
  formatMemorySummaryParsedPreview,
} from './memory/memorySummaryDebug'
import type { MemorySummaryRetryKind } from './newFriendsPersona/types'
import {
  parseUnifiedMemorySummaryWithLinkedModelOutput,
  requestDatingLinkedMemoryFallbackSummary,
  requestGroupChatMemorySummary,
  formatUnifiedMemoryOnlineBlock,
  buildDatingCombinedMemoryUserAppendix,
  splitDatingAiResponseAndUnifiedMemoryJson,
  requestUnifiedMemorySummaryWithLinked,
  requestUnifiedMemorySummary,
  requestSimpleOnlineMemorySummary,
  type ChatTranscriptTurn,
  type UnifiedMemorySummaryWithLinkedResult,
} from './wechatChatAi'
import {
  formatOnlineMemorySummaryStorageBody,
  onlineMemoryKeywordsFromSummary,
  resolveMemorySummaryRowKeywordsFromParsed,
} from './memory/onlineMemorySummaryFormat'
import {
  getCharacterLinkedPlayerIdentityIds,
  resolveActivePrivateChatSessionPlayerIdentityId,
} from './wechatCharacterPlayerIdentity'
import { identityBelongsToWechatAccount } from './wechatAccountScope'
import {
  groupMemoryBucketCharacterId,
  parseWechatAccountGroupConversationKey,
  parseWechatAccountPrivateConversationKey,
  resolvePrivateWeChatStorageConversationKey,
  wechatAccountPrivateConversationKey,
  WECHAT_GROUP_BOT_CHARACTER_ID,
  WECHAT_GROUP_USER_CHAR_ID,
} from './wechatConversationKey'
import {
  buildMemoryUserPlaceholderBindingsForContent,
  hasMemoryUserPlaceholderBindIds,
  resolveDatingLinkedMemoryUserBindCtx,
  resolveMemoryUserInsertContextFromSource,
} from './memoryUserPlaceholderBindings'
import { buildAutoSummaryMemoryKeywordsBackup } from './memory/memoryTriggerUtils'
import { writePerRoundStoryTimelineWithSeparateAttempt } from './memory/storyTimelinePerRoundSync'
import { dispatchStoryTimelinePerRoundSyncResult } from './memory/storyTimelinePerRoundResultEvents'
import { persistStoryTimelineFromSummaryDelta, loadStoryTimelineOpenAnchorsBlockForSummary } from './memory/storyTimelinePersist'
import { dualNarrativeStoryFieldsFromDelta } from './memory/dualNarrativeTime'
import {
  buildDatingStoryTimelineFallbackMaterial,
  buildUnifiedStoryTimelineFallbackMaterial,
  fetchStoryTimelineSummaryFallback,
  type StoryTimelineSummaryFallbackParams,
} from './memory/storyTimelineSummaryFallback'
import {
  deleteStoryTimelineLinkedRowsForDatingRound,
  fanOutStoryTimelineLinkedRows,
  resolveNpcDisplayLabel,
  type StoryTimelineLinkedFanOutEntry,
} from './memory/storyTimelineLinkedFanOut'
import { hasTimelineDeltaContent, parseStoryTimelineSummaryDelta, type StoryTimelineEventScope } from './memory/storyTimelineTypes'
import {
  resolveStoryCalendarAnchorFromPlots,
  buildStoryTimelineCalendarContextBlock,
} from './memory/storyTimelineCalendarContext'
import {
  applyEpiloguePatchesFromAutoSummary,
  finalizeWorldBookAfterAutoSummaryPhase,
  finalizeWorldBookAfterPerAiRound,
} from './newFriendsPersona/worldBookAfterSync'
import {
  sanitizeGroupMemorySummaryBody,
  sanitizeUnifiedLinkedMemoryBody,
  sanitizeUnifiedPrimaryMemoryBody,
} from './memory/autoSummaryPlaceholderSanitize'
import {
  collectSharedRecordOriginCharacterIds,
  formatWeChatMessageTextForMemorySummary,
} from './favorites/formatWeChatMessageForMemorySummary'
import { loadMeetPersisted } from '../lumiMeet/meetPersistLoad'
import { meetMessagesToAiTranscript } from '../lumiMeet/meetEncounterTranscript'
import type { MeetChatMessage } from '../lumiMeet/meetTypes'
import { isMeetImportedWeChatMessageId } from '../lumiMeet/meetMemoryConstants'
import {
  MEMORY_UNSUMMARIZED_BLOCK_CHAR_CAP,
  MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT,
} from './wechatMemoryPromptBlocks'
import { discoverOtherAccountPrivateConversationKeys } from './wechatCrossAccountChatDigest'
import { loadAccountsBundle } from './wechatAccountPersistence'

const DATING_ARCHIVES_KV = 'wechat-dating-archives-v1'

async function resolveAutoSummaryMemoryTriggerMode(): Promise<'keyword'> {
  return 'keyword'
}

export type DatingPlotSnapshotItem = {
  type: 'player' | 'ai'
  content: string
  timestamp?: number
  /** 剧情气泡 id；约会关联记忆按轮覆盖时需要 */
  id?: string
  planSummary?: string
  /** 故事内时间轴 JSON（供承接锚点，非落库时刻） */
  timelineDelta?: import('./memory/storyTimelineTypes').StoryTimelineSummaryDelta
  timelineSnapshot?: string
}

/** 从快照末尾向前找最近一条 AI 剧情 id（用于约会关联记忆按气泡覆盖） */
export function lastAiDatingPlotIdInSnapshot(plots: DatingPlotSnapshotItem[]): string | undefined {
  for (let i = plots.length - 1; i >= 0; i--) {
    const p = plots[i]
    if (p?.type === 'ai' && typeof p.id === 'string' && p.id.trim()) return p.id.trim()
  }
  return undefined
}

function extractPlotsFromArchives(raw: unknown, characterId: string): DatingPlotSnapshotItem[] {
  if (!raw || typeof raw !== 'object') return []
  const entry = (raw as Record<string, unknown>)[characterId]
  if (!entry || typeof entry !== 'object') return []
  const plots = (entry as { plots?: unknown }).plots
  if (!Array.isArray(plots)) return []
  const out: DatingPlotSnapshotItem[] = []
  for (const p of plots) {
    if (!p || typeof p !== 'object') continue
    const o = p as Record<string, unknown>
    const type = typeof o.type === 'string' ? o.type : ''
    const content = typeof o.content === 'string' ? o.content : ''
    const timestamp =
      typeof o.timestamp === 'number' && Number.isFinite(o.timestamp) ? o.timestamp : 1
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : undefined
    const planSummary = typeof o.planSummary === 'string' ? o.planSummary : undefined
    const timelineSnapshot =
      typeof o.timelineSnapshot === 'string' && o.timelineSnapshot.trim()
        ? o.timelineSnapshot.trim()
        : undefined
    const timelineDelta =
      o.timelineDelta && typeof o.timelineDelta === 'object'
        ? parseStoryTimelineSummaryDelta(o.timelineDelta)
        : undefined
    if (!content.trim()) continue
    if (type !== 'player' && type !== 'ai') continue
    out.push({
      type,
      content,
      timestamp,
      ...(id ? { id } : {}),
      ...(planSummary ? { planSummary } : {}),
      ...(timelineDelta ? { timelineDelta } : {}),
      ...(timelineSnapshot ? { timelineSnapshot } : {}),
    })
  }
  return out
}

export async function loadDatingPlotsFromKv(characterId: string): Promise<DatingPlotSnapshotItem[]> {
  const cid = characterId.trim()
  if (!cid) return []
  let raw: unknown = await personaDb.getPhoneKv(DATING_ARCHIVES_KV)
  if (raw == null) {
    raw = await pullPhoneKvWithLocalStorageLegacy(DATING_ARCHIVES_KV, [DATING_ARCHIVES_KV])
  }
  return extractPlotsFromArchives(raw, cid)
}

/** 供约会「剧情+合并记忆」同一 HTTP 或独立总结共用：游标后的线上 / 线下与人脉摘录等。 */
export type UnifiedMemoryGatherResult = {
  conversationKey: string
  characterId: string
  characterRealName: string
  hadOnline: boolean
  hadOfflinePrior: boolean
  hadMeet: boolean
  onlineTranscript: ChatTranscriptTurn[]
  meetTranscript: ChatTranscriptTurn[]
  meetMessagesPrior: MeetChatMessage[]
  offlinePlotsPrior: DatingPlotSnapshotItem[]
  offlineBlock: string
  npcLinked: { linkedArchiveOwnerId: string; allowedNpcIds: Set<string>; block: string }
  plotsArchiveId: string
  chunkMessages: WeChatChatMessage[]
  /** 本轮 chunk 内各身份线私聊各自应推进到的游标（多马甲/多扮演档合并总结时用） */
  onlineCursorAdvancesByConversationKey: Record<string, number>
  /** 本轮纳入总结的遇见消息（游标推进与模型输入一致） */
  meetMessagesSummarized: MeetChatMessage[]
}

async function buildSummarizedOnlineBatchFromChunk(
  chunkMessages: WeChatChatMessage[],
  charCap = MEMORY_UNSUMMARIZED_BLOCK_CHAR_CAP,
): Promise<{
  onlineTranscript: ChatTranscriptTurn[]
  summarizedMessages: WeChatChatMessage[]
  onlineCursorAdvancesByConversationKey: Record<string, number>
}> {
  const onlineTranscript: ChatTranscriptTurn[] = []
  const summarizedMessages: WeChatChatMessage[] = []
  let bodyLen = 0
  for (const m of chunkMessages) {
    if (isMeetImportedWeChatMessageId(m.id)) continue
    const text = await formatWeChatMessageTextForMemorySummary(m)
    if (!text?.trim()) continue
    const who = m.type === 'player' ? '我' : '对方'
    const line = `${who}：${text.trim()}`
    const addLen = (onlineTranscript.length ? 1 : 0) + line.length
    if (bodyLen + addLen > charCap && onlineTranscript.length > 0) break
    bodyLen += addLen
    onlineTranscript.push({
      id: m.id,
      from: m.type === 'player' ? 'self' : 'other',
      text,
    })
    summarizedMessages.push(m)
  }
  const onlineCursorAdvancesByConversationKey: Record<string, number> = {}
  for (const m of summarizedMessages) {
    const ck = m.conversationKey?.trim()
    if (!ck) continue
    const ts = m.timestamp
    if (typeof ts === 'number' && Number.isFinite(ts)) {
      onlineCursorAdvancesByConversationKey[ck] = Math.max(onlineCursorAdvancesByConversationKey[ck] ?? 0, ts)
    }
  }
  return { onlineTranscript, summarizedMessages, onlineCursorAdvancesByConversationKey }
}

function buildSummarizedMeetBatch(
  meetMessagesPrior: MeetChatMessage[],
  charCap = MEMORY_UNSUMMARIZED_BLOCK_CHAR_CAP,
): { meetTranscript: ChatTranscriptTurn[]; meetMessagesSummarized: MeetChatMessage[] } {
  const meetTranscript: ChatTranscriptTurn[] = []
  const meetMessagesSummarized: MeetChatMessage[] = []
  let bodyLen = 0
  for (const m of meetMessagesPrior) {
    const rows = meetMessagesToAiTranscript([m])
    let includedThisMessage = false
    for (const row of rows) {
      const text = String(row.content || '').trim()
      if (!text || text.length <= 2) continue
      const who = row.role === 'user' ? '我' : '对方'
      const line = `${who}：${text}`
      const addLen = (meetTranscript.length ? 1 : 0) + line.length
      if (bodyLen + addLen > charCap && meetTranscript.length > 0) break
      bodyLen += addLen
      meetTranscript.push({ from: row.role === 'user' ? 'self' : 'other', text })
      includedThisMessage = true
    }
    if (includedThisMessage) meetMessagesSummarized.push(m)
    if (bodyLen >= charCap && meetTranscript.length > 0) break
  }
  return { meetTranscript, meetMessagesSummarized }
}

async function listPrivateConversationKeysForMemoryGather(
  characterId: string,
  wechatAccountId: string | null | undefined,
  primaryConversationKey: string,
): Promise<string[]> {
  const cid = characterId.trim()
  const primary = primaryConversationKey.trim()
  const keys = new Set<string>()
  if (primary) keys.add(primary)
  const acc = wechatAccountId?.trim()
  if (!acc || !cid) return [...keys]
  const ch = await personaDb.getCharacter(cid).catch(() => null)
  for (const pid of getCharacterLinkedPlayerIdentityIds(ch)) {
    if (!pid || pid === '__none__') continue
    const row = await personaDb.getPlayerIdentity(pid).catch(() => null)
    if (row && !identityBelongsToWechatAccount(row, acc)) continue
    keys.add(wechatAccountPrivateConversationKey(acc, cid, pid))
  }
  const bundle = await loadAccountsBundle()
  if (bundle && bundle.accounts.length > 1) {
    const others = await discoverOtherAccountPrivateConversationKeys({
      characterId: cid,
      currentAccountId: acc,
      currentConversationKey: primary,
      allAccounts: bundle.accounts,
    })
    for (const sec of others) keys.add(sec.conversationKey)
  }
  return [...keys]
}

/** 合并同角色在本马甲下各身份线的未总结私聊，避免约会总结只推进「最近活跃线」游标。 */
async function gatherPrivateChatChunkAcrossIdentityLines(params: {
  characterId: string
  wechatAccountId: string | null | undefined
  primaryConversationKey: string
  limit?: number
}): Promise<{
  chunkMessages: WeChatChatMessage[]
}> {
  const lim = Math.max(
    1,
    Math.min(MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT, Math.floor(params.limit ?? MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT)),
  )
  const keys = await listPrivateConversationKeysForMemoryGather(
    params.characterId,
    params.wechatAccountId,
    params.primaryConversationKey,
  )
  const byId = new Map<string, WeChatChatMessage>()
  for (const ck of keys) {
    const cursorTs = await personaDb.getMemorySummaryCursorTimestamp(ck)
    const fromTs = (cursorTs ?? 0) + 1
    const rows = await personaDb.listWeChatChatMessagesFromTimestampAsc({
      conversationKey: ck,
      fromTimestampInclusive: fromTs,
      limit: lim,
    })
    for (const m of rows) {
      const tagged =
        m.conversationKey?.trim() === ck
          ? m
          : { ...m, conversationKey: ck }
      byId.set(tagged.id, tagged)
    }
  }
  const merged = [...byId.values()]
    .filter((m) => !isMeetImportedWeChatMessageId(m.id))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, lim)
  return { chunkMessages: merged }
}

export async function gatherUnifiedMemoryInputsForDatingTurn(params: {
  characterId: string
  characterRealName: string
  datingPlotsSnapshot: DatingPlotSnapshotItem[] | null | undefined
  /**
   * 与 ChatRoom 私聊一致：角色未绑定身份时用于拼 `conversationKey` 的「当前会话身份」；
   * 未传时回退为全局当前身份（IndexedDB），再否则 `__none__`。
   */
  sessionPlayerIdentityId?: string | null
  /** 与私聊存储键一致（优先）；未传则按 wechatAccountId + 会话身份拼键 */
  conversationKey?: string | null
  wechatAccountId?: string | null
  /** 仅收集微信私聊未总结消息（线上总结进度 · 手动总结）；不含线下/遇见/人脉线下摘录 */
  onlineOnly?: boolean
}): Promise<UnifiedMemoryGatherResult | null> {
  const cid = params.characterId.trim()
  if (!cid) return null
  const explicit = params.conversationKey?.trim()
  const fromGlobal = (await personaDb.getCurrentIdentityId()).trim()
  const pidForConv = explicit
    ? params.sessionPlayerIdentityId?.trim() || fromGlobal || '__none__'
    : await resolveActivePrivateChatSessionPlayerIdentityId({
        characterId: cid,
        wechatAccountId: params.wechatAccountId ?? null,
        appPlayerIdentityId: params.sessionPlayerIdentityId?.trim() || fromGlobal || null,
      })
  const conversationKey =
    explicit || resolvePrivateWeChatStorageConversationKey(cid, params.wechatAccountId, pidForConv)

  const { chunkMessages: pendingChunk } = await gatherPrivateChatChunkAcrossIdentityLines({
      characterId: cid,
      wechatAccountId: params.wechatAccountId ?? null,
      primaryConversationKey: conversationKey,
    })

  const {
    onlineTranscript,
    summarizedMessages: chunkMessages,
    onlineCursorAdvancesByConversationKey,
  } = await buildSummarizedOnlineBatchFromChunk(pendingChunk)

  const peer = params.characterRealName.trim() || '对方'
  const hadOnline = onlineTranscript.length > 0

  if (params.onlineOnly) {
    return {
      conversationKey,
      characterId: cid,
      characterRealName: peer,
      hadOnline,
      hadOfflinePrior: false,
      hadMeet: false,
      onlineTranscript,
      meetTranscript: [],
      meetMessagesPrior: [],
      meetMessagesSummarized: [],
      offlinePlotsPrior: [],
      offlineBlock: '',
      npcLinked: {
        linkedArchiveOwnerId: cid,
        allowedNpcIds: new Set<string>(),
        block: '',
      },
      plotsArchiveId: cid,
      chunkMessages,
      onlineCursorAdvancesByConversationKey,
    }
  }

  const archCtx = await resolveOfflineDatingArchiveContext(cid)
  const plotsArchiveId = archCtx?.archiveCharacterId?.trim() || cid

  const datingCursor = await personaDb.getDatingPlotSummaryCursor(plotsArchiveId)
  const dMin = datingCursor ?? 0

  const plotsSource: DatingPlotSnapshotItem[] =
    params.datingPlotsSnapshot && params.datingPlotsSnapshot.length > 0
      ? params.datingPlotsSnapshot
      : await loadDatingPlotsFromKv(plotsArchiveId)

  const offlinePlotsPrior = plotsSource
    .filter((p) => {
      const ts =
        typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : 1
      return ts > dMin
    })
    .sort((a, b) => (a.timestamp ?? 1) - (b.timestamp ?? 1))

  const borrowed =
    !!(archCtx && archCtx.perspectiveCharacterId !== archCtx.archiveCharacterId)
  const plotBuildCommon = {
    plots: offlinePlotsPrior,
    plotCursorMin: dMin,
    borrowed,
    rootName: (archCtx?.archiveOwner?.name ?? '').trim() || '主角',
    peerLabel: peer,
    filterNpc:
      borrowed && archCtx?.perspective
        ? (_plot: DatingPlotSnapshotItem, body: string) =>
            offlinePlotBodyRelevantToNpcForLinkedExcerpt(
              body,
              archCtx.perspective!,
              collectCharacterMentionSearchTokens(archCtx.perspective),
            )
        : undefined,
    maxChars: 7500,
  }
  const offlineBlock = buildOfflinePlotsFullText(plotBuildCommon)

  const hadOfflinePrior = offlineBlock.trim().length > 0

  const meetCursor = await personaDb.getMeetSummaryCursorTimestamp(cid)
  const meetFromTs = (meetCursor ?? 0) + 1
  let meetMessagesPrior: MeetChatMessage[] = []
  const meetPersist = await loadMeetPersisted()
  const meetThread = meetPersist?.chatThreads[cid] ?? []
  if (meetThread.length) {
    meetMessagesPrior = meetThread
      .filter((m) => {
        const ts = typeof m.ts === 'number' && Number.isFinite(m.ts) && m.ts > 0 ? m.ts : 1
        return ts > meetFromTs
      })
      .sort((a, b) => a.ts - b.ts)
  }
  const { meetTranscript, meetMessagesSummarized } = buildSummarizedMeetBatch(meetMessagesPrior)
  const hadMeet = meetTranscript.length > 0

  const npcLinked = await buildNpcLinkedOfflineExcerptUserBlock({
    archiveCharacterId: plotsArchiveId,
    perspectiveCharacterId: cid,
    offlinePlots: offlinePlotsPrior,
  })

  return {
    conversationKey,
    characterId: cid,
    characterRealName: peer,
    hadOnline,
    hadOfflinePrior,
    hadMeet,
    onlineTranscript,
    meetTranscript,
    meetMessagesPrior,
    meetMessagesSummarized,
    offlinePlotsPrior,
    offlineBlock,
    npcLinked: {
      linkedArchiveOwnerId: npcLinked.linkedArchiveOwnerId,
      allowedNpcIds: npcLinked.allowedNpcIds,
      block: npcLinked.block,
    },
    plotsArchiveId,
    chunkMessages,
    onlineCursorAdvancesByConversationKey,
  }
}

function plotSnapshotBodyText(plot: DatingPlotSnapshotItem): string {
  const raw = String(plot.content || '').trim()
  if (!raw) return ''
  const prose = splitDatingAssistantOutput(raw).content.trim()
  return extractVnVoiceParamsBlock(prose).cleanedText.trim()
}

export function latestAiPlotBodyFromSnapshot(plots: DatingPlotSnapshotItem[]): string {
  for (let i = plots.length - 1; i >= 0; i--) {
    const p = plots[i]
    if (p?.type !== 'ai') continue
    return plotSnapshotBodyText(p)
  }
  return ''
}

/** 指定 AI 剧情气泡 id 的正文；未命中时回退为快照末尾 AI 条。 */
export function aiPlotBodyFromSnapshotById(
  plots: DatingPlotSnapshotItem[],
  plotId: string | null | undefined,
): string {
  const id = plotId?.trim()
  if (id) {
    const hit = plots.find((p) => p?.type === 'ai' && p.id === id)
    if (hit) return plotSnapshotBodyText(hit)
  }
  return latestAiPlotBodyFromSnapshot(plots)
}

/** 本轮线下是否可能出现需写 linked 的可关联角色（人脉 NPC / 已绑定主角；摘录或正文提及均可）。 */
export async function datingTurnMayNeedLinkedMemoryWrite(
  gather: UnifiedMemoryGatherResult,
  plotsSnapshotAfterAi: DatingPlotSnapshotItem[],
  turnAiPlotId?: string | null,
): Promise<boolean> {
  if (gather.npcLinked.allowedNpcIds.size > 0) return true
  const owner = gather.npcLinked.linkedArchiveOwnerId.trim() || gather.plotsArchiveId.trim()
  if (!owner) return false
  const latestBody = aiPlotBodyFromSnapshotById(plotsSnapshotAfterAi, turnAiPlotId)
  if (!latestBody.trim()) return false
  try {
    const { all: eligible } = await listAllLinkedMemoryEligibleCharacters(owner)
    const peer = gather.characterId.trim()
    const others = eligible.filter((n) => {
      const id = String(n.id || '').trim()
      return id && id !== peer
    })
    if (!others.length) return false
    for (const row of others) {
      const toks = collectCharacterMentionSearchTokens(row)
      if (offlinePlotBodyRelevantToNpcForLinkedExcerpt(latestBody, row, toks)) return true
    }
    /** 有可关联角色且本轮 AI 正文足够长时仍尝试补救（部分模型不写真名，避免关联记忆永不触发） */
    if (latestBody.length >= 48) return true
  } catch {
    return false
  }
  return false
}

/**
 * 约会同轮 HTTP 未带合并记忆 JSON 时的补救：单独请求只写 linked（不写 primary、不推进游标）。
 */
export async function runDatingLinkedMemoryFallbackWhenNoJsonTail(params: {
  apiConfig: ApiConfig | null
  gather: UnifiedMemoryGatherResult
  offlinePlotsForCursorAdvance: DatingPlotSnapshotItem[]
  datingAiPlotId?: string | null
  eligibleLinkedNpcRoster: string
  /** 本轮 AI 剧情正文（去思维链），补救请求必带 */
  latestAiPlotBody?: string
}): Promise<{ applied: boolean; linkedNpcNamesWritten: string[] }> {
  const summaryApi = await resolveAutoSummaryApiConfig(params.apiConfig)
  if (!summaryApi?.apiUrl?.trim() || !summaryApi.apiKey?.trim() || !summaryApi.modelId?.trim()) {
    return { applied: false, linkedNpcNamesWritten: [] }
  }
  const memSettings = await personaDb.getMemorySettings()
  if (!isLinkedMemoryAutoSummaryEnabled(memSettings)) {
    return { applied: false, linkedNpcNamesWritten: [] }
  }
  try {
    const summary = await requestDatingLinkedMemoryFallbackSummary({
      apiConfig: summaryApi,
      offlineTextBlock: params.gather.offlineBlock,
      npcLinkedExcerptsBlock: params.gather.npcLinked.block,
      eligibleLinkedNpcRoster: params.eligibleLinkedNpcRoster,
      datingPeerCharacterId: params.gather.characterId,
      peerFallback: params.gather.characterRealName,
      peerCharacterId: params.gather.characterId,
      latestAiPlotBody: params.latestAiPlotBody,
    })
    const r = await applyUnifiedMemoryFromParsedSummary(summary, params.gather, {
      offlinePlotsForCursorAdvance: params.offlinePlotsForCursorAdvance,
      tagOfflineIncludesNewAiTurn: true,
      skipConversationRoundBump: false,
      deferPrimaryAndUnifiedCursors: true,
      datingAiPlotId: params.datingAiPlotId,
      suppressLinkedMemoryToast: true,
      timelineFallback: buildTimelineFallbackParamsFromGather(
        params.gather,
        params.apiConfig,
        params.latestAiPlotBody,
        params.offlinePlotsForCursorAdvance,
      ),
    })
    return {
      applied: !!r?.wroteAny,
      linkedNpcNamesWritten: Array.isArray(r?.linkedNpcNamesWritten) ? r.linkedNpcNamesWritten : [],
    }
  } catch (e) {
    console.warn('[dating] linked memory fallback failed', e)
    return { applied: false, linkedNpcNamesWritten: [] }
  }
}

/** 删除约会某轮关联记忆时须匹配的 `linkedFromCharacterId` 集合（存档根 / 线下 KV id / 当前视角人设 id 可能不一致） */
export function linkedMemoryOwnerIdsForGather(gather: UnifiedMemoryGatherResult): string[] {
  const a = gather.npcLinked.linkedArchiveOwnerId.trim()
  const b = gather.plotsArchiveId.trim()
  const c = gather.characterId.trim()
  return [...new Set([a, b, c].filter(Boolean))]
}

function resolveStoryTimelineScopeForGather(
  gather: UnifiedMemoryGatherResult,
  hadOfflineTag: boolean,
): StoryTimelineEventScope {
  if (gather.hadMeet && !gather.hadOnline && !hadOfflineTag) return 'meet'
  if (hadOfflineTag || gather.hadOfflinePrior) return 'offline'
  return 'private'
}

/** 剧情时间轴（档案馆「线下摘要」）仅在线下约会/本轮约会 AI 剧情存在时写入。 */
function gatherHasOfflineDatingTimelineContext(
  gather: UnifiedMemoryGatherResult,
  opts: { tagOfflineIncludesNewAiTurn?: boolean; datingAiPlotId?: string | null },
): boolean {
  return (
    gather.hadOfflinePrior ||
    opts.tagOfflineIncludesNewAiTurn === true ||
    !!opts.datingAiPlotId?.trim()
  )
}

/** 纯线上（微信/遇见、无线下约会摘录）走扁平总结，不调用 primary+linked 合并接口。 */
function shouldUseSimpleOnlineMemorySummary(
  gather: UnifiedMemoryGatherResult,
  params: { onlineOnly?: boolean; datingAiPlotId?: string | null },
): boolean {
  if (params.datingAiPlotId?.trim()) return false
  if (gather.hadOfflinePrior) return false
  if (String(gather.npcLinked.block || '').trim()) return false
  return params.onlineOnly === true || gather.hadOnline || gather.hadMeet
}

/** 线上 + 线下合并、但无人脉 linked 摘录：走 prose 三行结构，不走 primary+linked JSON。 */
function shouldUseUnifiedProseWithoutLinked(
  gather: UnifiedMemoryGatherResult,
  params: { onlineOnly?: boolean; datingAiPlotId?: string | null },
): boolean {
  if (params.datingAiPlotId?.trim()) return false
  if (params.onlineOnly === true) return false
  if (String(gather.npcLinked.block || '').trim()) return false
  return gather.hadOfflinePrior && (gather.hadOnline || gather.hadMeet)
}

export function buildTimelineFallbackParamsFromGather(
  gather: UnifiedMemoryGatherResult,
  chatFallback: ApiConfig | null,
  latestRoundBody?: string,
  plotsForTimeHint?: DatingPlotSnapshotItem[],
): StoryTimelineSummaryFallbackParams {
  const plots = plotsForTimeHint?.length ? plotsForTimeHint : gather.offlinePlotsPrior
  return {
    chatFallback,
    materialBlock: buildUnifiedStoryTimelineFallbackMaterial({
      onlineBlock: formatUnifiedMemoryOnlineBlock(
        gather.onlineTranscript,
        gather.characterRealName || '对方',
      ),
      meetBlock:
        gather.hadMeet && gather.meetTranscript.length
          ? formatUnifiedMemoryOnlineBlock(gather.meetTranscript, gather.characterRealName || '对方')
          : '',
      offlineBlock: gather.hadOfflinePrior ? gather.offlineBlock : '',
      npcLinkedBlock: gather.npcLinked.block,
    }),
    peerCharacterId: gather.characterId,
    latestRoundBody,
    storyCalendarAnchor: resolveStoryCalendarAnchorFromPlots(plots),
  }
}

/**
 * 将已解析的合并总结写入 DB 并推进游标（约会同一 HTTP 尾段 JSON 与独立 {@link requestUnifiedMemorySummaryWithLinked} 共用）。
 */
export async function applyUnifiedMemoryFromParsedSummary(
  summary: UnifiedMemorySummaryWithLinkedResult,
  gather: UnifiedMemoryGatherResult,
  opts: {
    offlinePlotsForCursorAdvance: DatingPlotSnapshotItem[]
    tagOfflineIncludesNewAiTurn: boolean
    skipConversationRoundBump?: boolean
    /**
     * 约会：未到「自动总结间隔」时只落人脉 linked，不写主角 primary，也不推进私聊/约会总结游标，
     * 以便达到间隔时仍能合并未游标覆盖的线上+线下再写 primary。
     */
    deferPrimaryAndUnifiedCursors?: boolean
    /** 当前这段 AI 剧情气泡 id：写入前会先删掉本轮此前自动生成的关联记忆，便于「重新生成」覆盖 */
    datingAiPlotId?: string | null
    /** 为 true 时不派发关联记忆成功 toast（由约会剧情后台完成弹窗合并展示） */
    suppressLinkedMemoryToast?: boolean
    /** 回滚/清零计数时使用的通道；默认微信私聊 */
    aiRoundCountChannel?: MemoryAiRoundCountChannel
    /** 为 true 时不弹出总结结果 toast（由外层统一通知） */
    suppressSummaryNotify?: boolean
    summaryNotifyKind?: MemorySummaryRetryKind
    /** 手动补跑总结失败时不回滚计轮（外层 runUnified 已处理） */
    suppressRoundRollbackOnFailure?: boolean
    /** 仅线上 prose 总结：不写剧情时间轴摘要、不推进线下游标 */
    onlineOnly?: boolean
    timelineFallback?: StoryTimelineSummaryFallbackParams
  },
): Promise<{
  wroteAny: boolean
  linkedNpcNamesWritten: string[]
  primaryWritten: boolean
  epiloguePatchesApplied: number
  /** 本轮 JSON 尾声补丁写库前快照（主角）；挂到对应 AI 剧情供删除/重生成回滚 */
  epilogueRevertEntries?: import('./dating/types').WorldBookAfterRevertEntry[]
  timelineWritten: boolean
}> {
  const skipBump = opts.skipConversationRoundBump === true
  const roundChannel: MemoryAiRoundCountChannel = opts.aiRoundCountChannel ?? 'wechat'
  const defer = opts.deferPrimaryAndUnifiedCursors === true
  const memSettingsRow = await personaDb.getMemorySettings()
  /** 线下约会「每轮 AI 剧情」摘要表模式；间隔触发的 prose 合并不走此项（即使存在未总结线下 backlog）。 */
  const rowPerRoundMode =
    isOfflineDatingRowPerRoundMode(memSettingsRow) &&
    opts.onlineOnly !== true &&
    (opts.tagOfflineIncludesNewAiTurn === true || !!opts.datingAiPlotId?.trim())
  const cid = gather.characterId
  const ck = gather.conversationKey
  const linkedOwnerId = gather.npcLinked.linkedArchiveOwnerId.trim() || gather.plotsArchiveId
  const archiveForSanitize = gather.plotsArchiveId.trim() || linkedOwnerId

  const memSource = parseWechatAccountPrivateConversationKey(ck)
  const userBindCtx = await resolveDatingLinkedMemoryUserBindCtx({
    conversationKey: ck,
    datingPeerCharacterId: cid,
    archiveRootId: archiveForSanitize || linkedOwnerId,
  })

  let primaryBody = summary.primary.content.trim().slice(0, 2000)
  const primaryBodyRaw = primaryBody
  let primaryUserBindings: WorldBookUserPlaceholderBinding[] = []
  const sharedOriginIds = collectSharedRecordOriginCharacterIds(gather.chunkMessages)
  const { allIds: networkEligibleIdSet, all: networkEligibleRows, boundProtagonists } =
    await listAllLinkedMemoryEligibleCharacters(linkedOwnerId)
  const memoryIdResolvePool = [
    ...networkEligibleIdSet,
    ...sharedOriginIds,
    cid,
    archiveForSanitize,
    linkedOwnerId,
  ]
  if (primaryBody) {
    try {
      const idCorrections = await buildMemoryIdPlaceholderCorrections(
        [primaryBody, ...summary.linked.map((e) => e.content)],
        memoryIdResolvePool,
      )
      primaryBody = applyMemoryIdPlaceholderCorrections(primaryBody, idCorrections).trim().slice(0, 2000)
      const sanitized = await sanitizeUnifiedPrimaryMemoryBody(
        primaryBody,
        cid,
        archiveForSanitize,
        userBindCtx,
        sharedOriginIds,
      )
      primaryBody = sanitized.content.slice(0, 2000)
      primaryUserBindings = sanitized.userPlaceholderBindings
    } catch {
      /* 保持原文，避免总结整体失败 */
    }
  }
  if (!primaryBody.trim() && primaryBodyRaw.trim()) {
    primaryBody = primaryBodyRaw.trim().slice(0, 2000)
  }
  if (primaryBody) {
    const resolvedRowKeywords = resolveMemorySummaryRowKeywordsFromParsed({
      rowKeywords: summary.primary.rowKeywords,
      memoryTriggerCategory: summary.primary.memoryTriggerCategory,
      memoryTriggerPrecise: summary.primary.memoryTriggerPrecise,
      memoryTriggerEmotionNeed: summary.primary.memoryTriggerEmotionNeed,
      memorySupplementKeywords: summary.primary.memorySupplementKeywords,
      content: summary.primary.content,
    })
    const storyForBody = dualNarrativeStoryFieldsFromDelta(summary.primary.timeline)
    if (summary.primary.rowTitle || resolvedRowKeywords.length > 0 || storyForBody.storyTimeLabel) {
      primaryBody = formatOnlineMemorySummaryStorageBody(primaryBody, {
        rowTitle: summary.primary.rowTitle,
        rowKeywords: resolvedRowKeywords,
        storyTimeLabel: storyForBody.storyTimeLabel,
      }).slice(0, 4000)
    }
  }
  if (rowPerRoundMode) primaryBody = ''

  const allowedNpc = gather.npcLinked.allowedNpcIds
  const boundProtagonistIdSet = new Set(
    boundProtagonists.map((p) => p.id.trim()).filter((id) => id && id !== cid),
  )
  const latestAiPlotBody = aiPlotBodyFromSnapshotById(
    opts.offlinePlotsForCursorAdvance,
    opts.datingAiPlotId,
  )
  /** 用于摘录漏检时：线下 + 人脉摘录 + 线上未总结摘录 是否出现该 NPC 可检索称呼 */
  const onlineMentionBits = gather.onlineTranscript
    .map((t) => String(t.text || '').trim())
    .filter(Boolean)
    .join('\n')
  const offlineMentionCorpus = `${gather.offlineBlock}\n${gather.npcLinked.block}\n${onlineMentionBits}`.trim()

  const seenNpc = new Set<string>()
  const linkedWrites: typeof summary.linked = []
  for (const entry of summary.linked) {
    const id = entry.characterId.trim()
    if (!id || !entry.content.trim()) continue
    if (seenNpc.has(id)) continue
    if (id === cid) continue

    let accept = networkEligibleIdSet.has(id)
    if (!accept && allowedNpc.has(id)) accept = true
    const peerRow = networkEligibleRows.find((n) => n.id.trim() === id) as Character | undefined
    if (!accept && peerRow && offlineMentionCorpus.length > 0) {
      const toks = collectCharacterMentionSearchTokens(peerRow)
      if (toks.length > 0 && textMentionsAnyToken(offlineMentionCorpus, toks)) accept = true
    }
    if (!accept && boundProtagonistIdSet.has(id) && peerRow) {
      const corpus = `${latestAiPlotBody}\n${offlineMentionCorpus}`.trim()
      if (plotBodyMentionsCharacter(peerRow, corpus)) accept = true
    }
    if (!accept) continue
    seenNpc.add(id)
    linkedWrites.push(entry)
  }

  const memSettingsForLinked = await personaDb.getMemorySettings()
  const linkedMemoryPersistEnabled =
    !opts.onlineOnly && isLinkedMemoryAutoSummaryEnabled(memSettingsForLinked)
  const linkedWritesToPersist = linkedMemoryPersistEnabled ? linkedWrites : []

  const hadOfflineTag = gather.hadOfflinePrior || opts.tagOfflineIncludesNewAiTurn
  const datingRound = opts.datingAiPlotId?.trim()
  const linkedDeleteOwners = linkedMemoryOwnerIdsForGather(gather)
  const offlineTimelineEligible =
    !opts.onlineOnly && gatherHasOfflineDatingTimelineContext(gather, opts)
  let timelineDelta = offlineTimelineEligible ? summary.primary.timeline : undefined
  if (
    offlineTimelineEligible &&
    (!timelineDelta || !hasTimelineDeltaContent(timelineDelta)) &&
    opts.timelineFallback
  ) {
    const fetched = await fetchStoryTimelineSummaryFallback(opts.timelineFallback)
    if (fetched) timelineDelta = fetched
  }
  const hasTimeline =
    offlineTimelineEligible && timelineDelta != null && hasTimelineDeltaContent(timelineDelta)

  const wroteAny = rowPerRoundMode
    ? hasTimeline ||
      linkedWritesToPersist.length > 0 ||
      (summary.epiloguePatches?.length ?? 0) > 0
    : defer
      ? linkedWritesToPersist.length > 0 || hasTimeline
      : !!(primaryBody || linkedWritesToPersist.length || hasTimeline)

  if (!wroteAny) {
    /**
     * defer=true：未到总结间隔，仅尝试落 linked；本轮已在 finalize 中 +1 计轮，此处不得 rollback。
     * 旧逻辑在 defer 且 skipBump=false 时 rollback 到 interval-1，导致「第一轮后就显示 9/10、第二轮就触发总结」。
     */
    if (!defer && skipBump && !opts.suppressRoundRollbackOnFailure) {
      await rollbackMemoryAiRoundCountForChannel(ck, roundChannel)
    }
    return {
      wroteAny: false,
      linkedNpcNamesWritten: [],
      primaryWritten: false,
      epiloguePatchesApplied: 0,
      timelineWritten: false,
    }
  }

  let timelinePersisted = false
  if (datingRound && linkedDeleteOwners.length) {
    if (rowPerRoundMode) {
      const npcIds = linkedWritesToPersist.map((e) => e.characterId.trim()).filter(Boolean)
      await deleteStoryTimelineLinkedRowsForDatingRound({
        characterIds: [...new Set([...linkedDeleteOwners, ...npcIds, cid])],
        plotId: datingRound,
      })
    } else {
      await personaDb.deleteAutoLinkedMemoriesForDatingRoundMulti(linkedDeleteOwners, datingRound)
    }
  }

  const now = Date.now()
  const triggerMode = await resolveAutoSummaryMemoryTriggerMode()

  if (!defer && primaryBody && !rowPerRoundMode) {
    const tagPrefix =
      `${gather.hadMeet ? '[遇见]' : ''}${gather.hadOnline ? '[私聊]' : ''}${hadOfflineTag ? '[线下]' : ''}${gather.hadMeet || gather.hadOnline || hadOfflineTag ? ' ' : ''}`
    const trimmed = tagPrefix + primaryBody
    const meetOnlyScope =
      gather.hadMeet && !gather.hadOnline && !hadOfflineTag ? ('meet' as const) : undefined
    const kwBackup =
      onlineMemoryKeywordsFromSummary({
        rowKeywords: summary.primary.rowKeywords,
        memoryTriggerCategory: summary.primary.memoryTriggerCategory,
        memoryTriggerPrecise: summary.primary.memoryTriggerPrecise,
        memoryTriggerEmotionNeed: summary.primary.memoryTriggerEmotionNeed,
        memorySupplementKeywords: summary.primary.memorySupplementKeywords,
        content: summary.primary.content,
      }) ??
      buildAutoSummaryMemoryKeywordsBackup({
        memoryTriggerCategory: summary.primary.memoryTriggerCategory,
        memoryTriggerPrecise: summary.primary.memoryTriggerPrecise,
        memoryTriggerEmotionNeed: summary.primary.memoryTriggerEmotionNeed,
        memorySupplementKeywords: summary.primary.memorySupplementKeywords,
      })
    const storyFields = dualNarrativeStoryFieldsFromDelta(
      timelineDelta ?? summary.primary.timeline,
    )
    await personaDb.upsertCharacterMemory({
      id: `mem-${now}-${Math.random().toString(36).slice(2, 9)}`,
      characterId: cid,
      content: trimmed,
      createdAt: now,
      updatedAt: now,
      isAutoGenerated: true,
      ...(meetOnlyScope ? { memoryScope: meetOnlyScope } : {}),
      ...(memSource
        ? {
            sourceWechatAccountId: memSource.wechatAccountId,
            sourceSessionPlayerIdentityId: memSource.sessionPlayerId,
          }
        : {}),
      ...(primaryUserBindings.length ? { userPlaceholderBindings: primaryUserBindings } : {}),
      memoryTriggerMode: triggerMode,
      memoryTriggerCategory: summary.primary.memoryTriggerCategory,
      memoryTriggerPrecise: summary.primary.memoryTriggerPrecise,
      memoryTriggerEmotionNeed: summary.primary.memoryTriggerEmotionNeed,
      memoryKeywords: kwBackup,
      ...(storyFields.storyDay ? { storyDay: storyFields.storyDay } : {}),
      ...(storyFields.storyTime ? { storyTime: storyFields.storyTime } : {}),
      ...(storyFields.storyTimeLabel ? { storyTimeLabel: storyFields.storyTimeLabel } : {}),
    })
  }

  if (timelineDelta && offlineTimelineEligible) {
    const plotIdForRow = defer ? opts.datingAiPlotId?.trim() : undefined
    if (defer && plotIdForRow) {
      /** 约会每轮：行表与 state 由 {@link rebuildStoryTimelineFromDatingPlots} 统一重建 */
    } else {
      await persistStoryTimelineFromSummaryDelta(
        cid,
        timelineDelta,
        resolveStoryTimelineScopeForGather(gather, hadOfflineTag),
        {
          ...(plotIdForRow ? { plotId: plotIdForRow } : {}),
          ...(gather.conversationKey?.trim()
            ? { conversationKey: gather.conversationKey.trim() }
            : {}),
          recordedAtMs: now,
        },
      )
      timelinePersisted = true
    }
  }

  if (rowPerRoundMode && hasTimeline && gather.hadOnline && gather.chunkMessages.length && !datingRound) {
    const perKey = gather.onlineCursorAdvancesByConversationKey ?? {}
    const entries = Object.entries(perKey).filter(
      ([key, ts]) => key.trim() && typeof ts === 'number' && Number.isFinite(ts),
    )
    if (entries.length > 0) {
      for (const [key, latestTs] of entries) {
        await personaDb.setMemorySummaryCursorTimestamp(key, latestTs)
      }
    } else {
      const latestTs = gather.chunkMessages[gather.chunkMessages.length - 1]!.timestamp
      if (typeof latestTs === 'number' && Number.isFinite(latestTs)) {
        await personaDb.setMemorySummaryCursorTimestamp(ck, latestTs)
      }
    }
  }

  let epiloguePatchesApplied = 0
  let epilogueRevertEntries: import('./dating/types').WorldBookAfterRevertEntry[] | undefined
  if (!opts.onlineOnly && summary.epiloguePatches?.length) {
    try {
      const epi = await applyEpiloguePatchesFromAutoSummary(
        summary.epiloguePatches,
        cid,
        networkEligibleIdSet,
      )
      epiloguePatchesApplied = epi.applied
      const primarySnap = epi.revertByCharacterId.get(cid.trim())
      if (primarySnap?.length) epilogueRevertEntries = primarySnap
    } catch {
      /* 尾声补丁写库失败不阻断 */
    }
  }

  const linkedNpcNamesWritten: string[] = []
  const fanOutEntries: StoryTimelineLinkedFanOutEntry[] = []
  for (const entry of linkedWritesToPersist) {
    let lb = applyMemoryIdPlaceholderCorrections(
      entry.content.trim(),
      await buildMemoryIdPlaceholderCorrections([entry.content], memoryIdResolvePool),
    )
      .trim()
      .slice(0, 2000)
    if (!lb) continue
    if (rowPerRoundMode) {
      try {
        const sanitized = await sanitizeUnifiedLinkedMemoryBody(
          lb,
          entry.characterId.trim(),
          linkedOwnerId,
          cid,
          userBindCtx,
          { conversationKey: ck },
        )
        lb = sanitized.content.slice(0, 2000)
      } catch {
        /* keep lb */
      }
      fanOutEntries.push({
        characterId: entry.characterId.trim(),
        content: lb,
        timelineDelta: entry.timeline,
      })
      continue
    }
    let linkedBindings: import('./newFriendsPersona/types').WorldBookUserPlaceholderBinding[] = []
    try {
      const sanitized = await sanitizeUnifiedLinkedMemoryBody(
        lb,
        entry.characterId.trim(),
        linkedOwnerId,
        cid,
        userBindCtx,
        { conversationKey: ck },
      )
      lb = sanitized.content.slice(0, 2000)
      linkedBindings = sanitized.userPlaceholderBindings
      if (
        !linkedBindings.length &&
        lb.includes('{{user') &&
        hasMemoryUserPlaceholderBindIds(userBindCtx)
      ) {
        linkedBindings = buildMemoryUserPlaceholderBindingsForContent(lb, userBindCtx)
      }
    } catch {
      if (lb.includes('{{user') && hasMemoryUserPlaceholderBindIds(userBindCtx)) {
        linkedBindings = buildMemoryUserPlaceholderBindingsForContent(lb, userBindCtx)
      }
    }
    const trimmedLinked = `[关联线下] ${lb}`
    const kwLinked = buildAutoSummaryMemoryKeywordsBackup({
      memoryTriggerCategory: entry.memoryTriggerCategory,
      memoryTriggerPrecise: entry.memoryTriggerPrecise,
      memoryTriggerEmotionNeed: entry.memoryTriggerEmotionNeed,
      memorySupplementKeywords: entry.memorySupplementKeywords,
    })
    const npcCid = entry.characterId.trim()
    try {
      const npcRow = await personaDb.getCharacter(npcCid)
      const npcLabel =
        String(npcRow?.name ?? npcRow?.wechatNickname ?? '').trim() || npcCid.slice(0, 8)
      linkedNpcNamesWritten.push(npcLabel)
    } catch {
      linkedNpcNamesWritten.push(npcCid.slice(0, 8))
    }
    const stableLinkedId =
      datingRound && linkedOwnerId
        ? `mem-dlk--${encodeURIComponent(linkedOwnerId)}--${encodeURIComponent(datingRound)}--${encodeURIComponent(npcCid)}`
        : `mem-l-${npcCid}-${now}-${Math.random().toString(36).slice(2, 9)}`
    await personaDb.upsertCharacterMemory({
      id: stableLinkedId,
      characterId: npcCid,
      content: trimmedLinked,
      createdAt: now,
      updatedAt: now,
      isAutoGenerated: true,
      memoryScope: 'linked',
      linkedFromCharacterId: linkedOwnerId,
      ...(datingRound ? { datingLinkedSourcePlotId: datingRound } : {}),
      ...(memSource
        ? {
            sourceWechatAccountId: memSource.wechatAccountId,
            sourceSessionPlayerIdentityId: memSource.sessionPlayerId,
          }
        : {}),
      ...(linkedBindings.length ? { userPlaceholderBindings: linkedBindings } : {}),
      memoryTriggerMode: triggerMode,
      memoryTriggerCategory: entry.memoryTriggerCategory,
      memoryTriggerPrecise: entry.memoryTriggerPrecise,
      memoryTriggerEmotionNeed: entry.memoryTriggerEmotionNeed,
      memoryKeywords: kwLinked,
    })
  }

  if (rowPerRoundMode && fanOutEntries.length) {
    linkedNpcNamesWritten.push(
      ...(await fanOutStoryTimelineLinkedRows({
        entries: fanOutEntries,
        scope: 'linked',
        plotId: datingRound,
        recordedAtMs: now,
        resolveNpcLabel: resolveNpcDisplayLabel,
        apiConfig: opts.timelineFallback?.chatFallback ?? null,
        sharedPrimaryDelta: timelineDelta ?? undefined,
        latestPlotBody: latestAiPlotBody,
      })),
    )
  }

  const primaryWritten = !rowPerRoundMode && !defer && !!primaryBody
  const advanceUnifiedCursors = primaryWritten

  if (advanceUnifiedCursors && gather.hadOnline && gather.chunkMessages.length) {
    const perKey = gather.onlineCursorAdvancesByConversationKey ?? {}
    const entries = Object.entries(perKey).filter(
      ([key, ts]) => key.trim() && typeof ts === 'number' && Number.isFinite(ts),
    )
    if (entries.length > 0) {
      for (const [key, latestTs] of entries) {
        await personaDb.setMemorySummaryCursorTimestamp(key, latestTs)
      }
    } else {
      const latestTs = gather.chunkMessages[gather.chunkMessages.length - 1]!.timestamp
      if (typeof latestTs === 'number' && Number.isFinite(latestTs)) {
        await personaDb.setMemorySummaryCursorTimestamp(ck, latestTs)
      }
    }
  }

  if (advanceUnifiedCursors && gather.hadMeet && gather.meetMessagesSummarized.length) {
    const maxMeetTs = Math.max(
      ...gather.meetMessagesSummarized.map((m) =>
        typeof m.ts === 'number' && Number.isFinite(m.ts) && m.ts > 0 ? m.ts : 1,
      ),
    )
    if (maxMeetTs > 0) {
      await personaDb.setMeetSummaryCursorTimestamp(cid, maxMeetTs)
    }
  }

  const plotsCursor = opts.offlinePlotsForCursorAdvance
  if (
    advanceUnifiedCursors &&
    plotsCursor.length > 0 &&
    (gather.hadOfflinePrior || opts.tagOfflineIncludesNewAiTurn)
  ) {
    const maxPlotTs = Math.max(
      ...plotsCursor.map((p) =>
        typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : 1,
      ),
    )
    if (maxPlotTs > 0) {
      await personaDb.setDatingPlotSummaryCursor(gather.plotsArchiveId, maxPlotTs)
    }
  }

  if (skipBump && primaryWritten) {
    await resetMemoryAiRoundCountForChannel(ck, roundChannel)
  }

  if (primaryWritten && gather.hadMeet) {
    /* 遇见成功 toast 由 notifyMemorySummaryAttempt 统一弹出 */
  }

  if (!opts.suppressSummaryNotify && !defer) {
    const memSourceForNotify = parseWechatAccountPrivateConversationKey(ck)
    const notifyKind =
      opts.summaryNotifyKind ??
      (gather.hadMeet && !gather.hadOnline && !hadOfflineTag ? 'meet' : 'private')
    await notifyMemorySummaryAttempt({
      ok: primaryWritten,
      primaryWritten,
      conversationKey: ck,
      characterId: cid,
      displayName: gather.characterRealName,
      kind: notifyKind,
      sessionPlayerIdentityId: memSourceForNotify?.sessionPlayerId,
      wechatAccountId: memSourceForNotify?.wechatAccountId,
      datingAiPlotId: opts.datingAiPlotId ?? undefined,
      failureReason: primaryWritten ? undefined : '模型未返回可入库的总结正文',
    })
  }

  if (!opts.suppressLinkedMemoryToast && linkedNpcNamesWritten.length) {
    dispatchDatingLinkedMemorySummarySuccess({
      npcNames: linkedNpcNamesWritten,
      protagonistName: gather.characterRealName,
    })
  }

  return {
    wroteAny,
    linkedNpcNamesWritten,
    primaryWritten,
    epiloguePatchesApplied,
    ...(epilogueRevertEntries?.length ? { epilogueRevertEntries } : {}),
    timelineWritten: timelinePersisted,
  }
}

/** 解析约会同一 HTTP 返回尾部的合并记忆 JSON 并落库；失败返回 false（调用方可改跑独立总结）。 */
export async function tryApplyDatingCombinedMemoryJsonTail(params: {
  memoryJsonText: string
  gather: UnifiedMemoryGatherResult
  offlinePlotsForCursorAdvance: DatingPlotSnapshotItem[]
  /**
   * true：本已达「自动总结间隔」，写主角 primary 并推进私聊/约会游标（与私聊一致）。
   * false：仅写入校验通过的 linked，不写 primary、不推进游标。
   */
  writePrimaryAndAdvanceCursors: boolean
  /** 当前 AI 剧情气泡 id；重新生成同一段时会先删掉该轮旧关联记忆 */
  datingAiPlotId?: string | null
  summaryNotifyKind?: MemorySummaryRetryKind
  /**
   * 调用方已在本次剧情后 `bumpMemoryAiRoundCount` 且得到 `shouldSummarize: true` 时为 true：
   * 避免 JSON 尾解析失败时 rollback 把计数设回 interval-1（如 9），而后续补跑总结成功后仍显示 9/10。
   */
  skipConversationRoundBump?: boolean
  chatFallback?: ApiConfig | null
  latestAiPlotBody?: string
}): Promise<{
  applied: boolean
  linkedNpcNamesWritten: string[]
  primaryWritten: boolean
  epiloguePatchesApplied: number
  epilogueRevertEntries?: import('./dating/types').WorldBookAfterRevertEntry[]
  timelineWritten: boolean
}> {
  try {
    const summary = parseUnifiedMemorySummaryWithLinkedModelOutput(params.memoryJsonText)
    const full = params.writePrimaryAndAdvanceCursors === true
    const plotBody = String(params.latestAiPlotBody || '').trim()
    const r = await applyUnifiedMemoryFromParsedSummary(summary, params.gather, {
      offlinePlotsForCursorAdvance: params.offlinePlotsForCursorAdvance,
      tagOfflineIncludesNewAiTurn: true,
      skipConversationRoundBump: params.skipConversationRoundBump === true,
      deferPrimaryAndUnifiedCursors: !full,
      datingAiPlotId: params.datingAiPlotId,
      suppressLinkedMemoryToast: true,
      summaryNotifyKind: params.summaryNotifyKind ?? 'dating',
      timelineFallback: params.chatFallback
        ? {
            chatFallback: params.chatFallback,
            materialBlock: buildDatingStoryTimelineFallbackMaterial({
              offlineBlock: params.gather.offlineBlock,
              plotBody,
            }),
            peerCharacterId: params.gather.characterId,
            latestRoundBody: plotBody,
          }
        : undefined,
    })
    return {
      applied: !!r?.wroteAny,
      primaryWritten: !!r?.primaryWritten,
      linkedNpcNamesWritten: Array.isArray(r?.linkedNpcNamesWritten) ? r.linkedNpcNamesWritten : [],
      epiloguePatchesApplied: r?.epiloguePatchesApplied ?? 0,
      ...(r?.epilogueRevertEntries?.length ? { epilogueRevertEntries: r.epilogueRevertEntries } : {}),
      timelineWritten: !!r?.timelineWritten,
    }
  } catch {
    return {
      applied: false,
      linkedNpcNamesWritten: [],
      primaryWritten: false,
      epiloguePatchesApplied: 0,
      timelineWritten: false,
    }
  }
}

/**
 * 在「已达到自动总结间隔」之后调用（调用方须先 `bumpMemoryAiRoundCount` 且得到 `shouldSummarize: true`）。
 * 合并未游标覆盖的微信消息与约会线下剧情，写入一条长期记忆，并分别推进两条游标。
 * 若线上与线下均无新材料，则回滚计数，避免白消耗一次间隔。
 */
export type UnifiedMemorySummaryRunResult = {
  ok: boolean
  primaryWritten: boolean
  failureReason?: string
}

export async function runUnifiedAutoMemorySummaryAfterThreshold(params: {
  apiConfig: ApiConfig | null
  /** 保留兼容；回滚与游标一律使用 gather 内解析的会话键（与私聊列表/ChatRoom 一致） */
  conversationKey?: string
  characterId: string
  characterRealName: string
  /** 约会页刚写入、KV 可能尚未同步时，传入当前完整 plots */
  datingPlotsSnapshot?: DatingPlotSnapshotItem[] | null
  /** 与 ChatRoom 传入的 `playerIdentityId`（chatRoute 会话身份）对齐，避免未绑身份时错用 `__none__` 键 */
  sessionPlayerIdentityId?: string | null
  /** 遇见联络绑定微信马甲 accountId，与私聊存储键一致 */
  wechatAccountId?: string | null
  /**
   * 约会页在每段剧情生成后触发：不消耗「私聊 N 轮一条总结」计数，失败时也不回滚该计数；
   * 成功后清零该会话计数，避免与已合并进总结的私聊气泡错位。
   */
  skipConversationRoundBump?: boolean
  /** 约会补跑总结时传入，用于覆盖该 AI 轮次旧关联记忆 */
  datingAiPlotId?: string | null
  /** 回滚计数通道：遇见触发时为 `meet`，默认微信私聊 */
  aiRoundCountChannel?: MemoryAiRoundCountChannel
  /** 手动补跑：不再次回滚/消耗计轮 */
  isManualRetry?: boolean
  /** 仅总结微信私聊未总结消息（线上总结进度 · 手动总结） */
  onlineOnly?: boolean
  summaryNotifyKind?: MemorySummaryRetryKind
  suppressSummaryNotify?: boolean
}): Promise<UnifiedMemorySummaryRunResult> {
  const cid = params.characterId.trim()
  const skipBump = params.skipConversationRoundBump === true
  const roundChannel: MemoryAiRoundCountChannel = params.aiRoundCountChannel ?? 'wechat'
  if (!cid) return { ok: false, primaryWritten: false, failureReason: '无效角色' }

  const gather = await gatherUnifiedMemoryInputsForDatingTurn({
    characterId: cid,
    characterRealName: params.characterRealName,
    datingPlotsSnapshot: params.datingPlotsSnapshot ?? null,
    sessionPlayerIdentityId: params.sessionPlayerIdentityId ?? null,
    conversationKey: params.conversationKey ?? null,
    wechatAccountId: params.wechatAccountId ?? null,
    onlineOnly: params.onlineOnly === true,
  })
  if (!gather) return { ok: false, primaryWritten: false, failureReason: '无法读取待总结上下文' }
  const ck = gather.conversationKey

  const summaryApi = await resolveAutoSummaryApiConfig(params.apiConfig)
  if (!summaryApi) {
    if (!skipBump && !params.isManualRetry) await rollbackMemoryAiRoundCountForChannel(ck, roundChannel)
    const failureReason = '未配置总结模型'
    if (!params.suppressSummaryNotify) {
      await notifyMemorySummaryAttempt({
        ok: false,
        primaryWritten: false,
        conversationKey: ck,
        characterId: cid,
        displayName: params.characterRealName,
        kind:
          params.summaryNotifyKind ??
          (params.datingPlotsSnapshot || params.datingAiPlotId
            ? 'dating'
            : roundChannel === 'meet'
              ? 'meet'
              : 'private'),
        sessionPlayerIdentityId: params.sessionPlayerIdentityId ?? undefined,
        wechatAccountId: params.wechatAccountId ?? undefined,
        datingAiPlotId: params.datingAiPlotId ?? undefined,
        failureReason,
        suppressNotify: params.suppressSummaryNotify,
      })
    }
    return { ok: false, primaryWritten: false, failureReason }
  }

  if (params.onlineOnly) {
    if (!gather.hadOnline) {
      if (!skipBump && !params.isManualRetry) await rollbackMemoryAiRoundCountForChannel(ck, roundChannel)
      const failureReason = '暂无待总结的线上消息'
      if (!params.suppressSummaryNotify) {
        await notifyMemorySummaryAttempt({
          ok: false,
          primaryWritten: false,
          conversationKey: ck,
          characterId: cid,
          displayName: params.characterRealName,
          kind: params.summaryNotifyKind ?? 'private',
          sessionPlayerIdentityId: params.sessionPlayerIdentityId ?? undefined,
          wechatAccountId: params.wechatAccountId ?? undefined,
          failureReason,
          suppressNotify: params.suppressSummaryNotify,
        })
      }
      return { ok: false, primaryWritten: false, failureReason }
    }
  } else if (!gather.hadOnline && !gather.hadOfflinePrior && !gather.hadMeet) {
    if (!skipBump && !params.isManualRetry) await rollbackMemoryAiRoundCountForChannel(ck, roundChannel)
    const failureReason = '暂无待总结内容'
    if (!params.suppressSummaryNotify) {
      await notifyMemorySummaryAttempt({
        ok: false,
        primaryWritten: false,
        conversationKey: ck,
        characterId: cid,
        displayName: params.characterRealName,
        kind:
          params.summaryNotifyKind ??
          (params.datingPlotsSnapshot || params.datingAiPlotId
            ? 'dating'
            : roundChannel === 'meet'
              ? 'meet'
              : 'private'),
        sessionPlayerIdentityId: params.sessionPlayerIdentityId ?? undefined,
        wechatAccountId: params.wechatAccountId ?? undefined,
        datingAiPlotId: params.datingAiPlotId ?? undefined,
        failureReason,
        suppressNotify: params.suppressSummaryNotify,
      })
    }
    return { ok: false, primaryWritten: false, failureReason }
  }

  const summary = shouldUseSimpleOnlineMemorySummary(gather, params)
    ? await (async () => {
        const attempt = await requestSimpleOnlineMemorySummary({
          apiConfig: summaryApi,
          onlineTranscript: gather.onlineTranscript,
          meetTranscript:
            params.onlineOnly || !gather.hadMeet ? [] : gather.meetTranscript,
          peerFallback: gather.characterRealName,
          peerCharacterId: gather.characterId,
        })
        return {
          bundle: { primary: attempt.summary, linked: [] as UnifiedMemorySummaryWithLinkedResult['linked'] },
          modelOutput: attempt.rawModelOutput,
          parsedPreview: formatMemorySummaryParsedPreview(attempt.summary),
        }
      })()
    : shouldUseUnifiedProseWithoutLinked(gather, params)
      ? await (async () => {
          const attempt = await requestUnifiedMemorySummary({
            apiConfig: summaryApi,
            onlineTranscript: gather.onlineTranscript,
            offlineTextBlock: gather.offlineBlock,
          })
          return {
            bundle: { primary: attempt.summary, linked: [] as UnifiedMemorySummaryWithLinkedResult['linked'] },
            modelOutput: attempt.rawModelOutput,
            parsedPreview: formatMemorySummaryParsedPreview(attempt.summary),
          }
        })()
      : await (async () => {
          const attempt = await requestUnifiedMemorySummaryWithLinked({
            apiConfig: summaryApi,
            onlineTranscript: gather.onlineTranscript,
            meetTranscript: params.onlineOnly ? [] : gather.hadMeet ? gather.meetTranscript : [],
            offlineTextBlock: params.onlineOnly ? '' : gather.hadOfflinePrior ? gather.offlineBlock : '',
            npcLinkedExcerptsBlock: params.onlineOnly ? '' : gather.npcLinked.block,
            peerFallback: gather.characterRealName,
            peerCharacterId: gather.characterId,
            primaryIdRoster: await buildMemorySummaryPrimaryIdRoster({
              archiveRootId: gather.plotsArchiveId,
              peerCharacterId: gather.characterId,
              extraCharacterIds: collectSharedRecordOriginCharacterIds(gather.chunkMessages),
            }),
            priorOpenAnchorsBlock: await loadStoryTimelineOpenAnchorsBlockForSummary(gather.characterId),
          })
          return {
            bundle: attempt.result,
            modelOutput: attempt.rawModelOutput,
            parsedPreview: formatLinkedMemorySummaryParsedPreview({
              ...attempt.result.primary,
              linked: attempt.result.linked,
            }),
          }
        })()

  const applied = await applyUnifiedMemoryFromParsedSummary(summary.bundle, gather, {
    offlinePlotsForCursorAdvance: params.onlineOnly ? [] : gather.offlinePlotsPrior,
    tagOfflineIncludesNewAiTurn: false,
    skipConversationRoundBump: skipBump,
    datingAiPlotId: params.datingAiPlotId,
    aiRoundCountChannel: roundChannel,
    suppressSummaryNotify: true,
    suppressRoundRollbackOnFailure: params.isManualRetry,
    onlineOnly: params.onlineOnly === true,
    summaryNotifyKind:
      params.summaryNotifyKind ??
      (params.datingPlotsSnapshot || params.datingAiPlotId
        ? 'dating'
        : roundChannel === 'meet'
          ? 'meet'
          : 'private'),
    timelineFallback:
      params.onlineOnly || !gatherHasOfflineDatingTimelineContext(gather, { datingAiPlotId: params.datingAiPlotId })
        ? undefined
        : buildTimelineFallbackParamsFromGather(gather, params.apiConfig),
  })

  const primaryWritten = applied.primaryWritten
  const failureReason = primaryWritten
    ? undefined
    : summary.bundle.primary.content.trim()
      ? '总结正文未通过入库校验'
      : '总结模型返回空正文'

  if (primaryWritten) {
    await resetMemoryAiRoundCountForChannel(ck, roundChannel)
    try {
      const mainRow = await personaDb.getCharacter(cid)
      const peerName = params.characterRealName.trim() || '对方'
      const recentTranscript = gather.onlineTranscript
        .slice(-12)
        .map((t) => {
          const who = t.from === 'self' ? '我' : peerName
          const body = String(t.text ?? '').trim().slice(0, 800)
          return body ? `${who}：${body}` : ''
        })
        .filter(Boolean)
        .join('\n')
      const summaryMaterials = params.onlineOnly
        ? ''
        : [
            gather.hadOfflinePrior && gather.offlineBlock.trim()
              ? `【线下】\n${gather.offlineBlock.trim()}`
              : '',
            gather.npcLinked.block?.trim() ? `【人脉】\n${gather.npcLinked.block.trim()}` : '',
            gather.hadMeet && gather.meetTranscript.length
              ? `【遇见】\n${gather.meetTranscript
                  .slice(-8)
                  .map((t) => {
                    const who = t.from === 'self' ? '我' : peerName
                    return `${who}：${String(t.text ?? '').trim()}`
                  })
                  .filter(Boolean)
                  .join('\n')}`
              : '',
          ]
            .filter(Boolean)
            .join('\n\n')
      const latestReplyHint =
        [...gather.onlineTranscript].reverse().find((t) => t.from === 'other')?.text?.trim() ||
        summary.bundle.primary.content.trim() ||
        recentTranscript.split('\n').pop()?.trim() ||
        ''
      await finalizeWorldBookAfterAutoSummaryPhase({
        apiConfig: params.apiConfig,
        conversationKey: ck,
        character: mainRow,
        epiloguePatchesApplied: applied.epiloguePatchesApplied,
        recentTranscript,
        latestReplyHint,
        summaryMaterialsBlock: summaryMaterials,
      })
    } catch {
      /* 尾声补救失败不阻断总结成功 */
    }
  } else if (!params.isManualRetry) {
    await rollbackMemoryAiRoundCountForChannel(ck, roundChannel)
  }

  const notifyKind =
    params.summaryNotifyKind ??
    (params.datingPlotsSnapshot || params.datingAiPlotId
      ? 'dating'
      : roundChannel === 'meet'
        ? 'meet'
        : 'private')

  if (!params.suppressSummaryNotify) {
    await notifyMemorySummaryAttempt({
      ok: primaryWritten,
      primaryWritten,
      conversationKey: ck,
      characterId: cid,
      displayName: params.characterRealName,
      kind: notifyKind,
      sessionPlayerIdentityId: params.sessionPlayerIdentityId ?? undefined,
      wechatAccountId: params.wechatAccountId ?? undefined,
      datingAiPlotId: params.datingAiPlotId ?? undefined,
      failureReason,
      modelOutput: summary.modelOutput,
      parsedPreview: summary.parsedPreview,
      suppressNotify: params.suppressSummaryNotify,
    })
  }

  return { ok: primaryWritten, primaryWritten, failureReason }
}

function buildGroupArchiveText(group: GroupChatRow | null): string {
  if (!group) return ''
  const lines: string[] = []
  lines.push(`群名：${group.name.trim() || '群聊'}`)
  const userGn = group.members.find((m) => m.charId === WECHAT_GROUP_USER_CHAR_ID)?.groupNickname?.trim()
  if (userGn) lines.push(`用户在本群的昵称：${userGn}`)
  const roleLabel = (r: GroupMember['role']) =>
    r === 'owner' ? '群主' : r === 'admin' ? '管理员' : '成员'
  const roster = group.members
    .map((m) => {
      const rl = roleLabel(m.role)
      const mute = m.isMuted ? '（禁言中）' : ''
      return `${(m.groupNickname || m.charId).trim()}（${rl}）${mute}`
    })
    .join('；')
  lines.push(`成员与身份：${roster}`)
  const ann = (group.announcement ?? '').trim()
  if (ann) {
    lines.push(`群公告：${ann.slice(0, 400)}${ann.length > 400 ? '…' : ''}`)
  }
  const muted = group.members.filter(
    (m) => m.isMuted && m.charId.trim() !== WECHAT_GROUP_USER_CHAR_ID,
  )
  if (muted.length) {
    lines.push(`当前被禁言的成员（不含系统占位）：${muted.map((m) => m.groupNickname).join('、')}`)
  }
  return lines.join('\n')
}

async function chunkMessagesToGroupTranscript(
  chunkMessages: WeChatChatMessage[],
  group: GroupChatRow | null,
): Promise<ChatTranscriptTurn[]> {
  const out: ChatTranscriptTurn[] = []
  for (const m of chunkMessages) {
    const fromSelf = m.type === 'player'
    let speakerLabel: string | undefined
    if (!fromSelf) {
      const cid = m.characterId.trim()
      if (cid === WECHAT_GROUP_BOT_CHARACTER_ID) speakerLabel = '群管家'
      else if (group) {
        const mem = findGroupMember(group, cid)
        speakerLabel = mem?.groupNickname?.trim() || cid.slice(0, 12)
      }
    }
    const ext = (m as { ext?: { mutedMessageVisibleToModeratorsOnly?: boolean } }).ext
    let text: string | null = null
    if (ext?.mutedMessageVisibleToModeratorsOnly === true) {
      const who = fromSelf ? '我' : speakerLabel || '群成员'
      text = `（${who}在禁言期间尝试发言；群内未展示原文）`
    } else if (m.sharedRecord) {
      text = await formatWeChatMessageTextForMemorySummary(m)
    } else if (m.chatHistory?.messages?.length) {
      text = await formatWeChatMessageTextForMemorySummary(m)
    } else if (m.isRecalled) {
      const who = fromSelf ? '我' : speakerLabel || '群成员'
      text = `（${who}撤回了一条消息）`
    } else if (m.voice) {
      const raw = String(m.content || '').trim()
      const vt = m.voice.transcriptText?.trim() || raw || '（语音）'
      const emo = m.voice.emotionLabel?.trim()
      text = emo ? `（语音，情绪：${emo}）${vt}` : `（语音）${vt}`
    } else if (m.images?.length && !String(m.content || '').trim()) {
      text = '（发送了图片）'
    } else if (m.redPacket) {
      text = String(m.content || '').trim() || `（红包，约 ¥${m.redPacket.amountYuan}）`
    } else if (m.transfer && !String(m.content || '').trim()) {
      text = '（转账）'
    } else {
      text = String(m.content || '').trim() || null
    }
    if (!text) continue
    out.push({ id: m.id, from: fromSelf ? 'self' : 'other', text, speakerLabel })
  }
  return out
}

/**
 * 群聊：在达到自动总结阈值后调用（与私聊共用 `bumpMemoryAiRoundCount` / 会话游标）。
 * 将未游标群消息与当前群成员/禁言等快照合并总结，并为每位**真实角色成员**各写入一条相同内容的长期记忆（便于在记忆管理页按联系人查看）。
 */
export async function runGroupChatMemorySummaryAfterThreshold(params: {
  apiConfig: ApiConfig | null
  conversationKey: string
  groupId: string
  playerIdentityId: string
  isManualRetry?: boolean
  suppressSummaryNotify?: boolean
}): Promise<UnifiedMemorySummaryRunResult> {
  const gid = params.groupId.trim()
  const ck = params.conversationKey.trim()
  const pid = params.playerIdentityId.trim()
  if (!gid || !ck) return { ok: false, primaryWritten: false, failureReason: '无效群聊会话' }

  const summaryApi = await resolveAutoSummaryApiConfig(params.apiConfig)
  if (!summaryApi) {
    if (!params.isManualRetry) await personaDb.rollbackMemoryAiRoundCountForRetry(ck)
    const failureReason = '未配置总结模型'
    if (!params.suppressSummaryNotify) {
      await notifyMemorySummaryAttempt({
        ok: false,
        primaryWritten: false,
        conversationKey: ck,
        characterId: gid,
        displayName: '群聊',
        kind: 'group',
        groupId: gid,
        sessionPlayerIdentityId: pid,
        failureReason,
      })
    }
    return { ok: false, primaryWritten: false, failureReason }
  }

  const group = await personaDb.getGroupChat(gid)
  if (group && group.playerIdentityId.trim() && pid && group.playerIdentityId.trim() !== pid) {
    if (!params.isManualRetry) await personaDb.rollbackMemoryAiRoundCountForRetry(ck)
    const failureReason = '群聊身份不匹配'
    if (!params.suppressSummaryNotify) {
      await notifyMemorySummaryAttempt({
        ok: false,
        primaryWritten: false,
        conversationKey: ck,
        characterId: gid,
        displayName: group.name?.trim() || '群聊',
        kind: 'group',
        groupId: gid,
        sessionPlayerIdentityId: pid,
        failureReason,
      })
    }
    return { ok: false, primaryWritten: false, failureReason }
  }

  const cursorTs = await personaDb.getMemorySummaryCursorTimestamp(ck)
  const fromTs = (cursorTs ?? 0) + 1
  const chunkMessages = await personaDb.listWeChatChatMessagesFromTimestampAsc({
    conversationKey: ck,
    fromTimestampInclusive: fromTs,
    limit: MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT,
  })

  const onlineTranscript = await chunkMessagesToGroupTranscript(chunkMessages, group)
  const archiveBlock = buildGroupArchiveText(group)

  const hadOnline = onlineTranscript.length > 0
  const hadArchive = archiveBlock.trim().length > 0
  if (!hadOnline && !hadArchive) {
    if (!params.isManualRetry) await personaDb.rollbackMemoryAiRoundCountForRetry(ck)
    const failureReason = '暂无待总结内容'
    if (!params.suppressSummaryNotify) {
      await notifyMemorySummaryAttempt({
        ok: false,
        primaryWritten: false,
        conversationKey: ck,
        characterId: gid,
        displayName: group?.name?.trim() || '群聊',
        kind: 'group',
        groupId: gid,
        sessionPlayerIdentityId: pid,
        failureReason,
      })
    }
    return { ok: false, primaryWritten: false, failureReason }
  }

  const summaryAttempt = await requestGroupChatMemorySummary({
    apiConfig: summaryApi,
    onlineTranscript,
    groupArchiveBlock: hadArchive ? archiveBlock : '',
    group,
  })
  const summary = summaryAttempt.summary
  const groupModelOutput = summaryAttempt.rawModelOutput
  const groupParsedPreview = formatMemorySummaryParsedPreview(summary)

  const grpSource = parseWechatAccountGroupConversationKey(ck)
  const groupUserBindCtx = await resolveMemoryUserInsertContextFromSource(
    grpSource?.wechatAccountId,
    pid,
  )

  let body = summary.content.trim().slice(0, 2000)
  let groupUserBindings: WorldBookUserPlaceholderBinding[] = []
  try {
    const sharedOriginIds = collectSharedRecordOriginCharacterIds(chunkMessages)
    const sanitized = await sanitizeGroupMemorySummaryBody(body, group, pid, groupUserBindCtx, sharedOriginIds)
    body = sanitized.content.slice(0, 2000)
    groupUserBindings = sanitized.userPlaceholderBindings
  } catch {
    /* 保持原文 */
  }
  if (!body) {
    if (!params.isManualRetry) await personaDb.rollbackMemoryAiRoundCountForRetry(ck)
    const failureReason = '模型未返回可入库的总结正文'
    if (!params.suppressSummaryNotify) {
      await notifyMemorySummaryAttempt({
        ok: false,
        primaryWritten: false,
        conversationKey: ck,
        characterId: gid,
        displayName: group?.name?.trim() || '群聊',
        kind: 'group',
        groupId: gid,
        sessionPlayerIdentityId: pid,
        failureReason,
        modelOutput: groupModelOutput,
        parsedPreview: groupParsedPreview,
      })
    }
    return { ok: false, primaryWritten: false, failureReason }
  }

  const tagPrefix =
    `${hadOnline ? '[私聊]' : ''}${hadArchive ? '[群聊]' : ''}${hadOnline || hadArchive ? ' ' : ''}`
  const resolvedRowKeywords = resolveMemorySummaryRowKeywordsFromParsed({
    rowKeywords: summary.rowKeywords,
    memoryTriggerCategory: summary.memoryTriggerCategory,
    memoryTriggerPrecise: summary.memoryTriggerPrecise,
    memoryTriggerEmotionNeed: summary.memoryTriggerEmotionNeed,
    memorySupplementKeywords: summary.memorySupplementKeywords,
    content: summary.content,
  })
  const trimmed =
    tagPrefix +
    (resolvedRowKeywords.length || summary.rowTitle
      ? formatOnlineMemorySummaryStorageBody(body, {
          rowTitle: summary.rowTitle,
          rowKeywords: resolvedRowKeywords,
        })
      : body)

  const memoryTargets =
    group?.members
      .map((m) => m.charId.trim())
      .filter(
        (cid) =>
          cid &&
          cid !== WECHAT_GROUP_USER_CHAR_ID &&
          cid !== WECHAT_GROUP_BOT_CHARACTER_ID,
      ) ?? []

  const now = Date.now()
  if (memoryTargets.length) {
    const triggerMode = await resolveAutoSummaryMemoryTriggerMode()
    const kwBackup =
      onlineMemoryKeywordsFromSummary({
        rowKeywords: summary.rowKeywords,
        memoryTriggerCategory: summary.memoryTriggerCategory,
        memoryTriggerPrecise: summary.memoryTriggerPrecise,
        memoryTriggerEmotionNeed: summary.memoryTriggerEmotionNeed,
        memorySupplementKeywords: summary.memorySupplementKeywords,
        content: summary.content,
      }) ??
      buildAutoSummaryMemoryKeywordsBackup({
      memoryTriggerCategory: summary.memoryTriggerCategory,
      memoryTriggerPrecise: summary.memoryTriggerPrecise,
      memoryTriggerEmotionNeed: summary.memoryTriggerEmotionNeed,
      memorySupplementKeywords: summary.memorySupplementKeywords,
    })
    await personaDb.upsertCharacterMemory({
      id: `mem-g-${gid}-${now}-${Math.random().toString(36).slice(2, 9)}`,
      characterId: groupMemoryBucketCharacterId(gid),
      content: trimmed,
      createdAt: now,
      updatedAt: now,
      isAutoGenerated: true,
      memoryScope: 'group',
      groupId: gid,
      involvedCharIds: [...memoryTargets],
      ...(grpSource
        ? {
            sourceWechatAccountId: grpSource.wechatAccountId,
            sourceSessionPlayerIdentityId: pid,
          }
        : {}),
      ...(groupUserBindings.length ? { userPlaceholderBindings: groupUserBindings } : {}),
      memoryTriggerMode: triggerMode,
      memoryTriggerCategory: summary.memoryTriggerCategory,
      memoryTriggerPrecise: summary.memoryTriggerPrecise,
      memoryTriggerEmotionNeed: summary.memoryTriggerEmotionNeed,
      memoryKeywords: kwBackup,
    })
  }

  if (hadOnline && chunkMessages.length) {
    const latestTs = chunkMessages[chunkMessages.length - 1]!.timestamp
    if (typeof latestTs === 'number' && Number.isFinite(latestTs)) {
      await personaDb.setMemorySummaryCursorTimestamp(ck, latestTs)
    }
  } else if (!hadOnline && hadArchive) {
    // 仅群档案、无新消息游标时仍须推进，否则会反复触发同一段总结
    await personaDb.setMemorySummaryCursorTimestamp(ck, Date.now())
  }

  const primaryWritten = memoryTargets.length > 0
  const displayName = group?.remark?.trim() || group?.name?.trim() || '群聊'
  const failureReason = primaryWritten ? undefined : '群聊无可写入记忆的目标成员'

  if (!params.suppressSummaryNotify) {
    await notifyMemorySummaryAttempt({
      ok: primaryWritten,
      primaryWritten,
      conversationKey: ck,
      characterId: gid,
      displayName,
      kind: 'group',
      groupId: gid,
      sessionPlayerIdentityId: pid,
      wechatAccountId: grpSource?.wechatAccountId,
      failureReason,
      modelOutput: primaryWritten ? undefined : groupModelOutput,
      parsedPreview: primaryWritten ? undefined : groupParsedPreview,
    })
  }

  return { ok: primaryWritten, primaryWritten, failureReason }
}

export async function buildPrivateChatPerRoundMemoryAppendixForTurn(params: {
  characterId: string
  characterRealName: string
  conversationKey: string
  sessionPlayerIdentityId?: string | null
  wechatAccountId?: string | null
}): Promise<string> {
  const memSettings = await personaDb.getMemorySettings()
  if (!isWeChatOnlineRowPerRoundMode(memSettings)) return ''
  if (memSettings.autoSummaryEnabled === false) return ''

  const gather = await gatherUnifiedMemoryInputsForDatingTurn({
    characterId: params.characterId,
    characterRealName: params.characterRealName,
    datingPlotsSnapshot: [],
    sessionPlayerIdentityId: params.sessionPlayerIdentityId ?? null,
    wechatAccountId: params.wechatAccountId ?? null,
    conversationKey: params.conversationKey,
  })
  if (!gather) return ''

  let roster = '（当前无可关联角色）'
  try {
    roster = await buildEligibleLinkedMemoryRosterForDatingAppendix(gather.plotsArchiveId, params.characterId)
  } catch {
    /* keep default */
  }

  const calendarContextBlock = await buildStoryTimelineCalendarContextBlock({
    peerCharacterId: params.characterId,
    sessionPlayerIdentityId: params.sessionPlayerIdentityId,
    storyCalendarAnchor: resolveStoryCalendarAnchorFromPlots(gather.offlinePlotsPrior),
  })

  return buildDatingCombinedMemoryUserAppendix({
    onlineTranscript: gather.onlineTranscript,
    peerLabel: params.characterRealName.trim() || '对方',
    offlinePriorBlock: gather.offlineBlock,
    npcLinkedExcerptsBlock: gather.npcLinked.block,
    datingPeerCharacterId: params.characterId,
    eligibleLinkedNpcRoster: roster,
    summaryRoundDue: false,
    calendarContextBlock,
  })
}

export async function finalizePerRoundMemoryAfterAiReply(params: {
  apiConfig: ApiConfig | null
  rawAiText: string
  characterId: string
  characterRealName: string
  conversationKey: string
  sessionPlayerIdentityId?: string | null
  wechatAccountId?: string | null
  inlineWorldBookPatchApplied?: boolean
  timelineScope?: StoryTimelineEventScope
  summaryNotifyKind?: MemorySummaryRetryKind
  /** 无尾段 JSON 时优先用于 timeline fallback 的本轮正文 */
  latestRoundBodyHint?: string
}): Promise<void> {
  const memSettings = await personaDb.getMemorySettings()
  if (!isOfflineDatingRowPerRoundMode(memSettings)) return
  if (memSettings.autoSummaryEnabled === false) return

  const timelineScope = params.timelineScope ?? 'private'
  const summaryNotifyKind = params.summaryNotifyKind ?? 'private'

  const gather = await gatherUnifiedMemoryInputsForDatingTurn({
    characterId: params.characterId,
    characterRealName: params.characterRealName,
    datingPlotsSnapshot: [],
    sessionPlayerIdentityId: params.sessionPlayerIdentityId ?? null,
    wechatAccountId: params.wechatAccountId ?? null,
    conversationKey: params.conversationKey,
  })
  if (!gather) return

  const split = splitDatingAiResponseAndUnifiedMemoryJson(params.rawAiText)
  const latestRoundBody =
    split.plotRaw.trim() || params.latestRoundBodyHint?.trim() || params.rawAiText.trim()
  let epiloguePatchesApplied = 0
  let timelineWritten = false

  const hint = params.latestRoundBodyHint?.trim()
  const latestLines =
    hint ||
    gather.onlineTranscript
      .slice(-4)
      .map((t) => {
        const who = t.from === 'self' ? '我' : params.characterRealName || '对方'
        return `${who}：${String(t.text || '').trim()}`
      })
      .filter((s) => s.length > 3)
      .join('\n')

  const advanceTimelineCursors = async () => {
    if (timelineScope === 'meet' && gather.meetMessagesSummarized.length) {
      const lastMeet = gather.meetMessagesSummarized[gather.meetMessagesSummarized.length - 1]
      const meetTs = lastMeet?.ts
      if (typeof meetTs === 'number' && Number.isFinite(meetTs)) {
        await personaDb.setMeetSummaryCursorTimestamp(params.characterId.trim(), meetTs)
      }
    } else if (gather.chunkMessages.length) {
      const latestTs = gather.chunkMessages[gather.chunkMessages.length - 1]!.timestamp
      if (typeof latestTs === 'number' && Number.isFinite(latestTs)) {
        await personaDb.setMemorySummaryCursorTimestamp(gather.conversationKey, latestTs)
      }
    }
  }

  const onlineBlock =
    timelineScope === 'meet' && gather.meetTranscript.length
      ? formatUnifiedMemoryOnlineBlock(gather.meetTranscript, params.characterRealName || '对方')
      : formatUnifiedMemoryOnlineBlock(gather.onlineTranscript, params.characterRealName || '对方')
  const fallbackMaterial = buildUnifiedStoryTimelineFallbackMaterial({
    onlineBlock,
    offlineBlock: gather.offlineBlock,
    npcLinkedBlock: gather.npcLinked.block,
  })

  if (split.memoryJsonText?.trim()) {
    const r = await tryApplyDatingCombinedMemoryJsonTail({
      memoryJsonText: split.memoryJsonText.trim(),
      gather,
      offlinePlotsForCursorAdvance: [],
      writePrimaryAndAdvanceCursors: false,
      summaryNotifyKind,
      chatFallback: params.apiConfig,
      latestAiPlotBody: latestRoundBody,
    })
    epiloguePatchesApplied = r.epiloguePatchesApplied
    timelineWritten = r.timelineWritten
    if (!timelineWritten && latestLines.trim()) {
      dispatchStoryTimelinePerRoundSyncResult({
        ok: false,
        displayName: params.characterRealName || '对方',
        failureReason: undefined,
      })
    }
  } else if (latestLines.trim()) {
    timelineWritten = await writePerRoundStoryTimelineWithSeparateAttempt({
      chatFallback: params.apiConfig,
      characterId: params.characterId,
      displayName: params.characterRealName || '对方',
      timelineScope,
      fallback: {
        materialBlock: fallbackMaterial,
        peerCharacterId: params.characterId,
        latestRoundBody: latestLines,
      },
      persistOpts: {
        conversationKey: params.conversationKey || gather.conversationKey,
        recordedAtMs: Date.now(),
      },
      advanceCursors: advanceTimelineCursors,
      notifyOnFailure: true,
    })
  }

  try {
    const ch = await personaDb.getCharacter(params.characterId)
    await finalizeWorldBookAfterPerAiRound({
      apiConfig: params.apiConfig,
      character: ch,
      latestRoundBody,
      displayName: params.characterRealName,
      inlinePatchApplied: params.inlineWorldBookPatchApplied,
      epiloguePatchesApplied,
    })
  } catch (e) {
    console.warn(`[wechat] per-round epilogue sync failed (${timelineScope})`, e)
  }
}

export async function finalizeGroupChatPerRoundMemoryAfterAiTurn(params: {
  apiConfig: ApiConfig | null
  conversationKey: string
  groupId: string
  playerIdentityId: string
  speakerTurns: Array<{ characterId: string; displayName: string; bubbleText: string }>
  inlinePatchAppliedByCharacterId?: Map<string, boolean>
}): Promise<void> {
  const gid = params.groupId.trim()
  const ck = params.conversationKey.trim()
  if (!gid || !ck) return
  const group = await personaDb.getGroupChat(gid)
  const seen = new Set<string>()
  for (const turn of params.speakerTurns) {
    const cid = turn.characterId.trim()
    const text = turn.bubbleText.trim()
    if (!cid || !text || seen.has(cid)) continue
    if (cid === WECHAT_GROUP_BOT_CHARACTER_ID || cid === WECHAT_GROUP_USER_CHAR_ID) continue
    seen.add(cid)
    const displayName =
      turn.displayName.trim() ||
      findGroupMember(group, cid)?.groupNickname?.trim() ||
      '群成员'
    await finalizePerRoundMemoryAfterAiReply({
      apiConfig: params.apiConfig,
      rawAiText: text,
      characterId: cid,
      characterRealName: displayName,
      conversationKey: ck,
      sessionPlayerIdentityId: params.playerIdentityId,
      timelineScope: 'group',
      summaryNotifyKind: 'group',
      latestRoundBodyHint: text,
      inlineWorldBookPatchApplied: params.inlinePatchAppliedByCharacterId?.get(cid) === true,
    })
  }
}

export async function finalizePrivateChatPerRoundMemoryAfterAiReply(params: {
  apiConfig: ApiConfig | null
  rawAiText: string
  characterId: string
  characterRealName: string
  conversationKey: string
  sessionPlayerIdentityId?: string | null
  wechatAccountId?: string | null
  inlineWorldBookPatchApplied?: boolean
}): Promise<void> {
  await finalizePerRoundMemoryAfterAiReply({
    ...params,
    timelineScope: 'private',
    summaryNotifyKind: 'private',
  })
}
