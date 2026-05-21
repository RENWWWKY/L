import type { ApiConfig } from '../api/types'
import {
  collectCharacterMentionSearchTokens,
  resolveOfflineDatingArchiveContext,
  textMentionsAnyToken,
} from './dating/offlineDatingArchiveResolve'
import { splitDatingAssistantOutput } from './dating/plotCoT'
import { extractVnVoiceParamsBlock } from './dating/vnVoiceParamsStrip'
import { findGroupMember } from './groupChatUtils'
import { buildNpcLinkedOfflineExcerptUserBlock } from './memory/linkedOfflineExcerptsForAutoSummary'
import { personaDb, pullPhoneKvWithLocalStorageLegacy } from './newFriendsPersona/idb'
import type {
  Character,
  GroupChatRow,
  GroupMember,
  WeChatChatMessage,
  WorldBookUserPlaceholderBinding,
} from './newFriendsPersona/types'
import { dispatchMeetMemorySummarySuccess } from '../lumiMeet/meetMemorySummarySuccessEvents'
import {
  parseUnifiedMemorySummaryWithLinkedModelOutput,
  requestGroupChatMemorySummary,
  requestUnifiedMemorySummaryWithLinked,
  type ChatTranscriptTurn,
  type UnifiedMemorySummaryWithLinkedResult,
} from './wechatChatAi'
import {
  groupMemoryBucketCharacterId,
  parseWechatAccountGroupConversationKey,
  parseWechatAccountPrivateConversationKey,
  resolvePrivateChatSessionPlayerIdentityId,
  resolvePrivateWeChatStorageConversationKey,
  WECHAT_GROUP_BOT_CHARACTER_ID,
  WECHAT_GROUP_USER_CHAR_ID,
} from './wechatConversationKey'
import { resolveMemoryUserInsertContextFromSource } from './memoryUserPlaceholderBindings'
import { buildAutoSummaryMemoryKeywordsBackup } from './memory/memoryTriggerUtils'
import {
  sanitizeGroupMemorySummaryBody,
  sanitizeUnifiedLinkedMemoryBody,
  sanitizeUnifiedPrimaryMemoryBody,
} from './memory/autoSummaryPlaceholderSanitize'
import { loadMeetPersisted } from '../lumiMeet/meetPersistLoad'
import { meetMessagesToAiTranscript } from '../lumiMeet/meetEncounterTranscript'
import type { MeetChatMessage } from '../lumiMeet/meetTypes'

const DATING_ARCHIVES_KV = 'wechat-dating-archives-v1'

async function resolveAutoSummaryMemoryTriggerMode(): Promise<'always' | 'keyword'> {
  const s = await personaDb.getMemorySettings()
  return s.autoSummaryDefaultMemoryTriggerMode === 'always' ? 'always' : 'keyword'
}

export type DatingPlotSnapshotItem = {
  type: string
  content: string
  timestamp?: number
  /** 剧情气泡 id；约会关联记忆按轮覆盖时需要 */
  id?: string
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
    if (!content.trim()) continue
    if (type !== 'player' && type !== 'ai') continue
    out.push({ type, content, timestamp, ...(id ? { id } : {}) })
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
}): Promise<UnifiedMemoryGatherResult | null> {
  const cid = params.characterId.trim()
  if (!cid) return null
  const row = await personaDb.getCharacter(cid)
  const explicit = params.sessionPlayerIdentityId?.trim() || ''
  const fromGlobal = (await personaDb.getCurrentIdentityId()).trim()
  const appHint = explicit || fromGlobal || null
  const pidForConv = resolvePrivateChatSessionPlayerIdentityId(row, appHint)
  const conversationKey =
    params.conversationKey?.trim() ||
    resolvePrivateWeChatStorageConversationKey(cid, params.wechatAccountId, pidForConv)

  const cursorTs = await personaDb.getMemorySummaryCursorTimestamp(conversationKey)
  const fromTs = (cursorTs ?? 0) + 1
  const chunkMessages = await personaDb.listWeChatChatMessagesFromTimestampAsc({
    conversationKey,
    fromTimestampInclusive: fromTs,
    limit: 500,
  })

  const onlineTranscript: ChatTranscriptTurn[] = chunkMessages.flatMap((m) => {
    const text = String(m.content || '').trim()
    if (!text) return []
    const turn: ChatTranscriptTurn = {
      id: m.id,
      from: m.type === 'player' ? 'self' : 'other',
      text,
    }
    return [turn]
  })

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

  const peer = params.characterRealName.trim() || '对方'
  const offlineLines: string[] = []
  for (const p of offlinePlotsPrior) {
    let t = String(p.content || '').trim()
    if (!t) continue
    if (p.type === 'ai') {
      const prose = splitDatingAssistantOutput(t).content.trim()
      t = extractVnVoiceParamsBlock(prose).cleanedText.trim()
    }
    if (!t) continue
    if (p.type === 'player') offlineLines.push(`我：${t}`)
    else offlineLines.push(`${peer}：${t}`)
  }
  const offlineBlock = offlineLines.join('\n')

  const hadOnline = onlineTranscript.length > 0
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
  const meetTranscript: ChatTranscriptTurn[] = meetMessagesToAiTranscript(meetMessagesPrior).flatMap(
    (row) => {
      const text = String(row.content || '').trim()
      if (!text || text.length <= 2) return []
      return [{ from: row.role === 'user' ? 'self' : 'other', text } satisfies ChatTranscriptTurn]
    },
  )
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
    offlinePlotsPrior,
    offlineBlock,
    npcLinked: {
      linkedArchiveOwnerId: npcLinked.linkedArchiveOwnerId,
      allowedNpcIds: npcLinked.allowedNpcIds,
      block: npcLinked.block,
    },
    plotsArchiveId,
    chunkMessages,
  }
}

/** 删除约会某轮关联记忆时须匹配的 `linkedFromCharacterId` 集合（存档根 / 线下 KV id / 当前视角人设 id 可能不一致） */
export function linkedMemoryOwnerIdsForGather(gather: UnifiedMemoryGatherResult): string[] {
  const a = gather.npcLinked.linkedArchiveOwnerId.trim()
  const b = gather.plotsArchiveId.trim()
  const c = gather.characterId.trim()
  return [...new Set([a, b, c].filter(Boolean))]
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
  },
): Promise<boolean> {
  const skipBump = opts.skipConversationRoundBump === true
  const defer = opts.deferPrimaryAndUnifiedCursors === true
  const cid = gather.characterId
  const ck = gather.conversationKey
  const linkedOwnerId = gather.npcLinked.linkedArchiveOwnerId.trim() || gather.plotsArchiveId
  const archiveForSanitize = gather.plotsArchiveId.trim() || linkedOwnerId

  const memSource = parseWechatAccountPrivateConversationKey(ck)
  const userBindCtx = await resolveMemoryUserInsertContextFromSource(
    memSource?.wechatAccountId,
    memSource?.sessionPlayerId,
  )

  let primaryBody = summary.primary.content.trim().slice(0, 2000)
  let primaryUserBindings: WorldBookUserPlaceholderBinding[] = []
  if (primaryBody) {
    try {
      const sanitized = await sanitizeUnifiedPrimaryMemoryBody(
        primaryBody,
        cid,
        archiveForSanitize,
        userBindCtx,
      )
      primaryBody = sanitized.content.slice(0, 2000)
      primaryUserBindings = sanitized.userPlaceholderBindings
    } catch {
      /* 保持原文，避免总结整体失败 */
    }
  }
  const allowedNpc = gather.npcLinked.allowedNpcIds
  const networkRows = await personaDb.listNpcsFor(linkedOwnerId)
  const networkNpcIdSet = new Set(networkRows.map((n) => n.id.trim()).filter(Boolean))
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

    let accept = allowedNpc.has(id)
    if (!accept && networkNpcIdSet.has(id) && offlineMentionCorpus.length > 0) {
      const npcRow = networkRows.find((n) => n.id.trim() === id) as Character | undefined
      const toks = collectCharacterMentionSearchTokens(npcRow ?? null)
      if (toks.length > 0 && textMentionsAnyToken(offlineMentionCorpus, toks)) accept = true
    }
    if (!accept) continue
    seenNpc.add(id)
    linkedWrites.push(entry)
  }

  const memSettingsForLinked = await personaDb.getMemorySettings()
  const linkedMemoryPersistEnabled = memSettingsForLinked.linkedMemoryAutoSummaryEnabled !== false
  const linkedWritesToPersist = linkedMemoryPersistEnabled ? linkedWrites : []

  const hadOfflineTag = gather.hadOfflinePrior || opts.tagOfflineIncludesNewAiTurn
  const datingRound = opts.datingAiPlotId?.trim()
  const linkedDeleteOwners = linkedMemoryOwnerIdsForGather(gather)

  /** 未到间隔且无 linked：若带约会 plot id，仍清空该轮旧关联记忆（重新生成后模型未再给 linked） */
  if (defer && linkedWritesToPersist.length === 0) {
    if (datingRound && linkedDeleteOwners.length) {
      await personaDb.deleteAutoLinkedMemoriesForDatingRoundMulti(linkedDeleteOwners, datingRound)
      return true
    }
    return false
  }

  const wroteAny = defer
    ? linkedWritesToPersist.length > 0
    : !!(primaryBody || linkedWritesToPersist.length)

  if (!wroteAny) {
    if (!skipBump) await personaDb.rollbackMemoryAiRoundCountForRetry(ck)
    else {
      const plots = opts.offlinePlotsForCursorAdvance
      if (
        plots.length > 0 &&
        (gather.hadOfflinePrior || opts.tagOfflineIncludesNewAiTurn)
      ) {
        const maxPlotTs = Math.max(
          ...plots.map((p) =>
            typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : 1,
          ),
        )
        if (maxPlotTs > 0) {
          await personaDb.setDatingPlotSummaryCursor(gather.plotsArchiveId, maxPlotTs)
        }
      }
      if (skipBump) await personaDb.resetMemoryAiRoundCountForConversation(ck)
    }
    return false
  }

  if (datingRound && linkedDeleteOwners.length) {
    await personaDb.deleteAutoLinkedMemoriesForDatingRoundMulti(linkedDeleteOwners, datingRound)
  }

  const now = Date.now()
  const triggerMode = await resolveAutoSummaryMemoryTriggerMode()

  if (!defer && primaryBody) {
    const tagPrefix =
      `${gather.hadMeet ? '[遇见]' : ''}${gather.hadOnline ? '[私聊]' : ''}${hadOfflineTag ? '[线下]' : ''}${gather.hadMeet || gather.hadOnline || hadOfflineTag ? ' ' : ''}`
    const trimmed = tagPrefix + primaryBody
    const meetOnlyScope =
      gather.hadMeet && !gather.hadOnline && !hadOfflineTag ? ('meet' as const) : undefined
    const kwBackup = buildAutoSummaryMemoryKeywordsBackup({
      memoryTriggerCategory: summary.primary.memoryTriggerCategory,
      memoryTriggerPrecise: summary.primary.memoryTriggerPrecise,
      memoryTriggerEmotionNeed: summary.primary.memoryTriggerEmotionNeed,
      memorySupplementKeywords: summary.primary.memorySupplementKeywords,
    })
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
    })
  }

  for (const entry of linkedWritesToPersist) {
    let lb = entry.content.trim().slice(0, 2000)
    if (!lb) continue
    let linkedBindings: import('./newFriendsPersona/types').WorldBookUserPlaceholderBinding[] = []
    try {
      const sanitized = await sanitizeUnifiedLinkedMemoryBody(
        lb,
        entry.characterId.trim(),
        linkedOwnerId,
        cid,
        userBindCtx,
      )
      lb = sanitized.content.slice(0, 2000)
      linkedBindings = sanitized.userPlaceholderBindings
    } catch {
      /* 保持原文 */
    }
    const trimmedLinked = `[关联线下] ${lb}`
    const kwLinked = buildAutoSummaryMemoryKeywordsBackup({
      memoryTriggerCategory: entry.memoryTriggerCategory,
      memoryTriggerPrecise: entry.memoryTriggerPrecise,
      memoryTriggerEmotionNeed: entry.memoryTriggerEmotionNeed,
      memorySupplementKeywords: entry.memorySupplementKeywords,
    })
    const npcCid = entry.characterId.trim()
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

  if (!defer && gather.hadOnline && gather.chunkMessages.length) {
    const latestTs = gather.chunkMessages[gather.chunkMessages.length - 1]!.timestamp
    if (typeof latestTs === 'number' && Number.isFinite(latestTs)) {
      await personaDb.setMemorySummaryCursorTimestamp(ck, latestTs)
    }
  }

  if (!defer && gather.hadMeet && gather.meetMessagesPrior.length) {
    const maxMeetTs = Math.max(
      ...gather.meetMessagesPrior.map((m) =>
        typeof m.ts === 'number' && Number.isFinite(m.ts) && m.ts > 0 ? m.ts : 1,
      ),
    )
    if (maxMeetTs > 0) {
      await personaDb.setMeetSummaryCursorTimestamp(cid, maxMeetTs)
    }
  }

  const plotsCursor = opts.offlinePlotsForCursorAdvance
  if (
    !defer &&
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

  if (skipBump) {
    await personaDb.resetMemoryAiRoundCountForConversation(ck)
  }

  if (!defer && gather.hadMeet) {
    dispatchMeetMemorySummarySuccess({ characterName: gather.characterRealName })
  }

  return wroteAny
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
}): Promise<boolean> {
  try {
    const summary = parseUnifiedMemorySummaryWithLinkedModelOutput(params.memoryJsonText)
    const full = params.writePrimaryAndAdvanceCursors === true
    return await applyUnifiedMemoryFromParsedSummary(summary, params.gather, {
      offlinePlotsForCursorAdvance: params.offlinePlotsForCursorAdvance,
      tagOfflineIncludesNewAiTurn: true,
      skipConversationRoundBump: false,
      deferPrimaryAndUnifiedCursors: !full,
      datingAiPlotId: params.datingAiPlotId,
    })
  } catch {
    return false
  }
}

/**
 * 在「已达到自动总结间隔」之后调用（调用方须先 `bumpMemoryAiRoundCount` 且得到 `shouldSummarize: true`）。
 * 合并未游标覆盖的微信消息与约会线下剧情，写入一条长期记忆，并分别推进两条游标。
 * 若线上与线下均无新材料，则回滚计数，避免白消耗一次间隔。
 */
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
}): Promise<void> {
  const cid = params.characterId.trim()
  const skipBump = params.skipConversationRoundBump === true
  if (!cid) return

  const gather = await gatherUnifiedMemoryInputsForDatingTurn({
    characterId: cid,
    characterRealName: params.characterRealName,
    datingPlotsSnapshot: params.datingPlotsSnapshot ?? null,
    sessionPlayerIdentityId: params.sessionPlayerIdentityId ?? null,
    conversationKey: params.conversationKey ?? null,
    wechatAccountId: params.wechatAccountId ?? null,
  })
  if (!gather) return
  const ck = gather.conversationKey

  if (!gather.hadOnline && !gather.hadOfflinePrior && !gather.hadMeet) {
    if (!skipBump) await personaDb.rollbackMemoryAiRoundCountForRetry(ck)
    return
  }

  const summary = await requestUnifiedMemorySummaryWithLinked({
    apiConfig: params.apiConfig,
    onlineTranscript: gather.onlineTranscript,
    meetTranscript: gather.hadMeet ? gather.meetTranscript : [],
    offlineTextBlock: gather.hadOfflinePrior ? gather.offlineBlock : '',
    npcLinkedExcerptsBlock: gather.npcLinked.block,
    peerFallback: gather.characterRealName,
    peerCharacterId: gather.characterId,
  })

  const ok = await applyUnifiedMemoryFromParsedSummary(summary, gather, {
    offlinePlotsForCursorAdvance: gather.offlinePlotsPrior,
    tagOfflineIncludesNewAiTurn: false,
    skipConversationRoundBump: skipBump,
    datingAiPlotId: params.datingAiPlotId,
  })

  if (!ok && !skipBump) {
    await personaDb.rollbackMemoryAiRoundCountForRetry(ck)
  }
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

function chunkMessagesToGroupTranscript(
  chunkMessages: WeChatChatMessage[],
  group: GroupChatRow | null,
): ChatTranscriptTurn[] {
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
    let text = String(m.content || '').trim()
    const ext = (m as { ext?: { mutedMessageVisibleToModeratorsOnly?: boolean } }).ext
    if (ext?.mutedMessageVisibleToModeratorsOnly === true) {
      const who = fromSelf ? '我' : speakerLabel || '群成员'
      text = `（${who}在禁言期间尝试发言；群内未展示原文）`
    } else if (m.isRecalled) {
      const who = fromSelf ? '我' : speakerLabel || '群成员'
      text = `（${who}撤回了一条消息）`
    } else if (m.voice) {
      const vt = m.voice.transcriptText?.trim() || text || '（语音）'
      const emo = m.voice.emotionLabel?.trim()
      text = emo ? `（语音，情绪：${emo}）${vt}` : `（语音）${vt}`
    } else if (m.images?.length && !text) {
      text = '（发送了图片）'
    } else if (m.redPacket) {
      if (!text) text = `（红包，约 ¥${m.redPacket.amountYuan}）`
    } else if (m.transfer && !text) {
      text = '（转账）'
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
}): Promise<void> {
  const gid = params.groupId.trim()
  const ck = params.conversationKey.trim()
  const pid = params.playerIdentityId.trim()
  if (!gid || !ck) return

  const group = await personaDb.getGroupChat(gid)
  if (group && group.playerIdentityId.trim() && pid && group.playerIdentityId.trim() !== pid) {
    await personaDb.rollbackMemoryAiRoundCountForRetry(ck)
    return
  }

  const cursorTs = await personaDb.getMemorySummaryCursorTimestamp(ck)
  const fromTs = (cursorTs ?? 0) + 1
  const chunkMessages = await personaDb.listWeChatChatMessagesFromTimestampAsc({
    conversationKey: ck,
    fromTimestampInclusive: fromTs,
    limit: 500,
  })

  const onlineTranscript = chunkMessagesToGroupTranscript(chunkMessages, group)
  const archiveBlock = buildGroupArchiveText(group)

  const hadOnline = onlineTranscript.length > 0
  const hadArchive = archiveBlock.trim().length > 0
  if (!hadOnline && !hadArchive) {
    await personaDb.rollbackMemoryAiRoundCountForRetry(ck)
    return
  }

  const summary = await requestGroupChatMemorySummary({
    apiConfig: params.apiConfig,
    onlineTranscript,
    groupArchiveBlock: hadArchive ? archiveBlock : '',
    group,
  })

  const grpSource = parseWechatAccountGroupConversationKey(ck)
  const groupUserBindCtx = await resolveMemoryUserInsertContextFromSource(
    grpSource?.wechatAccountId,
    pid,
  )

  let body = summary.content.trim().slice(0, 2000)
  let groupUserBindings: WorldBookUserPlaceholderBinding[] = []
  try {
    const sanitized = await sanitizeGroupMemorySummaryBody(body, group, pid, groupUserBindCtx)
    body = sanitized.content.slice(0, 2000)
    groupUserBindings = sanitized.userPlaceholderBindings
  } catch {
    /* 保持原文 */
  }
  if (!body) {
    await personaDb.rollbackMemoryAiRoundCountForRetry(ck)
    return
  }

  const tagPrefix =
    `${hadOnline ? '[私聊]' : ''}${hadArchive ? '[群聊]' : ''}${hadOnline || hadArchive ? ' ' : ''}`
  const trimmed = tagPrefix + body

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
    const kwBackup = buildAutoSummaryMemoryKeywordsBackup({
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
}
