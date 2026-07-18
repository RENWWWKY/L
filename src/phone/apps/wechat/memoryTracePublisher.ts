import type { ApiConfig } from '../api/types'
import { buildWorldbookContext } from '../../worldbook/buildWorldbookContext'
import { getWorldbookLoreEntriesSnapshot } from '../../worldbook/worldbookLoreStore'
import type { GlobalWechatPlate } from '../../worldbook/globalWorldBookTypes'
import type { Character } from './newFriendsPersona/types'
import { personaDb } from './newFriendsPersona/idb'
import {
  expandCharUserPlaceholders,
  resolveCharUserNamesForPrompt,
  resolveWorldBookUserBinding,
} from './charUserPlaceholders'
import { getCharacterMemoryRelevanceTraceForPromptInjection } from './memory/formatCharacterMemoriesForPromptInjection'
import { buildMemoryRelevanceHaystack } from './wechatMemoryPromptBlocks'
import { stripPromptPolicyBlocksForTraceDisplay, stripUnsummarizedOnlineTimestampsForDisplay } from './memoryTraceDisplaySanitize'
import {
  buildPrivateUnsummarizedTraceBlocks,
  lineRelationUiLabel,
  normalizeMemoryPromptLineScope,
  parseLineScopedUnsummarizedTextForTrace,
} from './wechatMemoryLineScope'

function traceOnlineUnsummarizedSnippetForDisplay(snippet: string): string {
  return stripUnsummarizedOnlineTimestampsForDisplay(snippet.trim())
}
import {
  buildOfflinePlotTraceRowsFromInjectedContext,
  listInjectedOfflinePlotTraceRowsForMemoryTrace,
  stripOfflineDatingPlotsInjectHeaderForTraceDisplay,
} from './dating/loadOfflineDatingPlotsForWechatPrompt'
import type {
  MemoryTraceData,
  MemoryTraceInjectionSummary,
  MemoryTraceRecentRoundRef,
  MemoryTraceWorldBookAfterChat,
  MemoryTraceWorldBookAfterInjectedEntry,
  MemoryTraceWorldBookAfterPatchRow,
} from './memoryTraceTypes'
import {
  formatStoryTimelineTodoLedgerForPrompt,
  parseStoryTimelineInjectBodyForTrace,
} from './memory/storyTimelineTypes'
import type { MemoryTraceStoryTimeline, MemoryTraceTodoLedger } from './memoryTraceTypes'
import {
  hasChatAfterWorldBookItems,
  listChatAfterWorldBookItems,
  type WorldBookAfterPatch,
} from './newFriendsPersona/worldBookAfterPatch'
import { setLastMemoryTrace, getLastMemoryTrace } from './memoryTraceStore'
import { buildPrivateChatNetworkRelationshipsTrace } from './networkRelationshipsPrompt'
import type { ChatTranscriptTurn } from './wechatChatAi'
import {
  WECHAT_HISTORY_MAX_MESSAGES,
  buildCharacterCard,
  buildWorldBookTextForPrompt,
} from './wechatChatAi'
import { resolveDatingAssistantDisplayText } from './dating/plotCoT'

function buildStoryTimelineTraceBlock(
  raw: string,
  expand: (s: string) => string,
): MemoryTraceStoryTimeline {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return { injected: false, promptExcerpt: '' }
  const promptExcerpt = expand(trimmed)
  const rows = parseStoryTimelineInjectBodyForTrace(promptExcerpt)
  return {
    injected: true,
    promptExcerpt,
    ...(rows.length ? { rows } : {}),
  }
}

async function buildTodoLedgerTraceBlock(
  characterId: string,
  expand: (s: string) => string,
): Promise<MemoryTraceTodoLedger> {
  const cid = characterId.trim()
  if (!cid) return { injected: false, promptExcerpt: '', openCount: 0, resolvedCount: 0 }
  try {
    const state = await personaDb.getStoryTimelineState(cid)
    const openCount = (state?.todos ?? []).filter((t) => t.status === 'open').length
    const resolvedCount = (state?.todos ?? []).filter((t) => t.status === 'resolved').length
    const raw = formatStoryTimelineTodoLedgerForPrompt(state)
    if (!raw) return { injected: false, promptExcerpt: '', openCount, resolvedCount }
    const expanded = await personaDb.expandStoryTimelineTextForDisplay(cid, raw)
    return {
      injected: true,
      promptExcerpt: expand(expanded.trim() || raw),
      openCount,
      resolvedCount,
    }
  } catch {
    return { injected: false, promptExcerpt: '', openCount: 0, resolvedCount: 0 }
  }
}

/** 与 DatingStoryPage 一致：剔除漏出的 VN 语音 JSON 碎片行，避免进思维溯源 */
function isLikelyVnVoiceParamsArtifactLine(rawLine: string): boolean {
  const line = String(rawLine || '').trim()
  if (!line) return false
  if (/【\s*VN语音参数(?:结束)?\s*】/u.test(line)) return true
  if (/(?:^|[{"\s,])idx(?:\s*["'}\],]|:)|emotion\s*:|tone\s*:/i.test(line)) {
    const reduced = line.replace(/[\u4e00-\u9fa5]/g, '').trim()
    if (/^[\[\]\{\}",:a-z0-9_\-\s.]+$/i.test(reduced)) return true
  }
  return false
}

/** 思维溯源「本轮模型输出」：只保留对白/旁白/内心等剧情正文，去掉 VN 语音合成参数块 */
function stripDatingVnVoiceParamsForMemoryTrace(text: string): string {
  const source = String(text ?? '')
  const startMatch = /【\s*VN语音参数\s*】/u.exec(source)
  if (!startMatch || startMatch.index < 0) {
    return source
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter((x) => x && !isLikelyVnVoiceParamsArtifactLine(x))
      .join('\n')
      .trim()
  }
  const start = startMatch.index
  const endRegex = /【\s*VN语音参数结束\s*】/gu
  endRegex.lastIndex = start + startMatch[0].length
  const endMatch = endRegex.exec(source)
  const end = endMatch ? endMatch.index : -1
  const rawCut =
    end >= 0 && endMatch ? source.slice(0, start) + source.slice(end + endMatch[0].length) : source.slice(0, start)
  return rawCut
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x && !isLikelyVnVoiceParamsArtifactLine(x))
    .join('\n')
    .trim()
}

function pickTrimmedApiUrlKey(
  raw: { apiUrl?: string | null; apiKey?: string | null } | null | undefined,
): Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null {
  if (!raw) return null
  const apiUrl = String(raw.apiUrl ?? '').trim()
  const apiKey = String(raw.apiKey ?? '').trim()
  if (!apiUrl || !apiKey) return null
  return { apiUrl, apiKey }
}

/** 思维溯源不做客户端字数截断；人设世界书与模型注入同源，仅放宽 maxChars */
const TRACE_WORLD_BOOK_MAX_CHARS = Number.MAX_SAFE_INTEGER

/** 思维溯源「样本锚定」：展示本轮模型输出的最后一条可见气泡全文 */
function lastNonEmptyBubbleText(replyBubbles: string[]): string {
  const cleaned = replyBubbles.map((s) => String(s ?? '').trim()).filter(Boolean)
  return cleaned.length ? cleaned[cleaned.length - 1]! : ''
}

function personaTagsFromCharacter(ch: Character | null): string[] {
  if (!ch) return []
  const tags: string[] = []
  const push = (x: string | null | undefined) => {
    const v = String(x ?? '').trim()
    if (v && !tags.includes(v)) tags.push(v)
  }
  push(ch.name)
  push(ch.identity)
  push(ch.mbti)
  push(ch.zodiac)
  for (const x of ch.interests ?? []) push(x)
  for (const x of ch.painPoints ?? []) push(x)
  return tags.slice(0, 12)
}

/** 思维溯源「核心基底」：与人设卡编辑字段对齐的完整正文 */
function buildFullPersonaDetailForMemoryTrace(ch: Character | null): string {
  if (!ch) return ''
  const card = buildCharacterCard(ch)
  const parts: string[] = [`【档案摘要·与模型注入同源】\n${card}`]
  if (ch.wechatId?.trim()) parts.push(`【微信号（展示用）】${ch.wechatId.trim()}`)
  if (ch.openingLines?.trim()) parts.push(`【默认开场白（每行一条气泡）】\n${ch.openingLines.trim()}`)
  if (ch.remark?.trim()) parts.push(`【通讯录备注】${ch.remark.trim()}`)
  if (ch.schedule) {
    try {
      parts.push(`【日程表·完整数据】\n${JSON.stringify(ch.schedule)}`)
    } catch {
      parts.push('【日程表】（序列化失败，请人设页查看）')
    }
  }
  return parts.join('\n\n').trim()
}

function countTranscriptTurns(transcript: ChatTranscriptTurn[]): number {
  return transcript.filter((t) => String(t.text ?? '').trim().length > 0).length
}

function activeSessionMessageCount(transcript: ChatTranscriptTurn[]): number {
  return Math.min(countTranscriptTurns(transcript), WECHAT_HISTORY_MAX_MESSAGES)
}

/** 与 worldBookAfterPatch 中 newContent 上限对齐，避免溯源 JSON 过大 */
const MAX_TRACE_WB_PATCH_BODY_CHARS = 12000

function clipTracePatchBody(s: string, max = MAX_TRACE_WB_PATCH_BODY_CHARS): string {
  const t = String(s ?? '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}\n\n…【正文过长，思维溯源已截断】`
}

function findWorldBookItemMetaOnCharacter(
  character: Character | null | undefined,
  patch: Pick<WorldBookAfterPatch, 'worldBookId' | 'itemId'>,
): { bookName: string; itemName: string; previousContent: string } | null {
  if (!character?.worldBooks?.length) return null
  const wb = character.worldBooks.find((w) => w.id === patch.worldBookId)
  const it = wb?.items?.find((i) => i.id === patch.itemId)
  if (!wb || !it) return null
  return {
    bookName: String(wb.name ?? '').trim() || '世界书',
    itemName: String(it.name ?? '').trim() || '条目',
    previousContent: String(it.content ?? '').trim(),
  }
}

/** 私聊 / 约会：补丁均针对同一 `character` 快照（须为写库前内存对象） */
export function buildWorldBookAfterPatchRowsFromSingleCharacter(
  character: Character | null | undefined,
  patches: WorldBookAfterPatch[],
): MemoryTraceWorldBookAfterPatchRow[] {
  const out: MemoryTraceWorldBookAfterPatchRow[] = []
  for (const p of patches) {
    const meta = findWorldBookItemMetaOnCharacter(character, p)
    out.push({
      characterId: p.characterId?.trim() || undefined,
      worldBookId: p.worldBookId.trim(),
      itemId: p.itemId.trim(),
      bookName: meta?.bookName,
      itemName: meta?.itemName,
      previousContent: clipTracePatchBody(meta?.previousContent ?? ''),
      newContentFull: clipTracePatchBody(p.newContent),
    })
  }
  return out
}

/** 群聊：按每条补丁的 characterId 解析写库前人设（未带 id 时用主 NPC） */
export async function buildWorldBookAfterPatchRowsForGroupChat(
  patches: WorldBookAfterPatch[],
  primaryCharacter: Character | null,
): Promise<MemoryTraceWorldBookAfterPatchRow[]> {
  const cache = new Map<string, Character | null>()
  const load = async (cid: string) => {
    const k = cid.trim()
    if (!k) return null
    if (cache.has(k)) return cache.get(k) ?? null
    try {
      const row = await personaDb.getCharacter(k)
      cache.set(k, row)
      return row
    } catch {
      cache.set(k, null)
      return null
    }
  }
  const out: MemoryTraceWorldBookAfterPatchRow[] = []
  for (const p of patches) {
    const explicit = p.characterId?.trim()
    const ch = explicit ? await load(explicit) : primaryCharacter
    const meta = findWorldBookItemMetaOnCharacter(ch, p)
    out.push({
      characterId: explicit || undefined,
      worldBookId: p.worldBookId.trim(),
      itemId: p.itemId.trim(),
      bookName: meta?.bookName,
      itemName: meta?.itemName,
      previousContent: clipTracePatchBody(meta?.previousContent ?? ''),
      newContentFull: clipTracePatchBody(p.newContent),
    })
  }
  return out
}

export function buildWorldBookAfterChatTrace(params: {
  protocolInPrompt: boolean
  /** @deprecated 思维溯源 UI 不再展示；保留字段兼容旧存档 */
  injectedDynamicSection?: string
  injectedSnapshotEntries?: MemoryTraceWorldBookAfterInjectedEntry[]
  patchOutputRulesIncluded: boolean
  parsedPatches: MemoryTraceWorldBookAfterPatchRow[]
  appliedToDb: boolean
}): MemoryTraceWorldBookAfterChat {
  return {
    protocolInPrompt: params.protocolInPrompt,
    injectedDynamicSection: String(params.injectedDynamicSection ?? '').trim(),
    injectedSnapshotEntries: params.injectedSnapshotEntries?.length ? params.injectedSnapshotEntries : undefined,
    patchOutputRulesIncluded: params.patchOutputRulesIncluded,
    parsedPatches: params.parsedPatches,
    appliedToDb: params.appliedToDb,
    modelOmittedPatchBlock: params.patchOutputRulesIncluded && params.parsedPatches.length === 0,
  }
}

function patchRowDedupeKey(row: MemoryTraceWorldBookAfterPatchRow): string {
  return `${row.characterId ?? ''}|${row.worldBookId}|${row.itemId}`
}

/**
 * 自动总结 / 尾声专用接口写库后，回写本轮思维溯源（聊天回复发布溯源时自动总结尚未跑完）。
 */
export async function syncAutoSummaryEpilogueToLastMemoryTrace(params: {
  primaryCharacterId: string
  patchRows: MemoryTraceWorldBookAfterPatchRow[]
}): Promise<void> {
  const incoming = params.patchRows.filter(
    (r) => r.worldBookId.trim() && r.itemId.trim() && r.newContentFull.trim(),
  )
  if (!incoming.length) return

  const last = getLastMemoryTrace()
  if (!last) return

  const mergedMap = new Map<string, MemoryTraceWorldBookAfterPatchRow>()
  for (const r of last.worldBookAfterChat?.autoSummaryPatches ?? []) {
    mergedMap.set(patchRowDedupeKey(r), r)
  }
  for (const r of incoming) mergedMap.set(patchRowDedupeKey(r), r)
  const autoSummaryPatches = [...mergedMap.values()]

  let injectedSnapshotEntries = last.worldBookAfterChat?.injectedSnapshotEntries
    ? [...last.worldBookAfterChat.injectedSnapshotEntries]
    : undefined

  const primaryId = params.primaryCharacterId.trim()
  if (primaryId && injectedSnapshotEntries?.length) {
    try {
      const ch = await personaDb.getCharacter(primaryId)
      const expand = ch
        ? await expandTraceTextForCharacter(ch, await resolvePlayerDisplayFallbackForTrace())
        : (s: string) => s
      for (const patch of autoSummaryPatches) {
        const idx = injectedSnapshotEntries.findIndex(
          (e) =>
            e.bookName === patch.bookName &&
            e.itemName === patch.itemName &&
            (!patch.characterId || e.characterId === patch.characterId),
        )
        if (idx >= 0) {
          injectedSnapshotEntries[idx] = {
            ...injectedSnapshotEntries[idx]!,
            content: expand(patch.newContentFull),
          }
        }
      }
    } catch {
      /* 快照更新失败不阻断 */
    }
  }

  const prevWba = last.worldBookAfterChat
  const worldBookAfterChat: MemoryTraceWorldBookAfterChat = {
    protocolInPrompt: prevWba?.protocolInPrompt ?? false,
    injectedDynamicSection: prevWba?.injectedDynamicSection ?? '',
    injectedSnapshotEntries,
    patchOutputRulesIncluded: prevWba?.patchOutputRulesIncluded ?? false,
    parsedPatches: prevWba?.parsedPatches ?? [],
    appliedToDb: true,
    modelOmittedPatchBlock: prevWba?.modelOmittedPatchBlock ?? false,
    autoSummaryPatches,
  }

  setLastMemoryTrace({ ...last, worldBookAfterChat })
}

function buildAfterChatInjectedSnapshotEntries(
  members: Array<{ character: Character; characterName: string }>,
  expand: (s: string) => string,
): MemoryTraceWorldBookAfterInjectedEntry[] {
  const out: MemoryTraceWorldBookAfterInjectedEntry[] = []
  for (const { character, characterName } of members) {
    const cid = character.id?.trim()
    for (const row of listChatAfterWorldBookItems(character)) {
      out.push({
        characterId: cid || undefined,
        characterName: characterName.trim() || '角色',
        bookName: row.bookName,
        itemName: row.itemName,
        content: expand(row.content),
      })
    }
  }
  return out
}

async function buildAfterChatInjectedSnapshotEntriesForCharacterIds(
  characterIds: string[],
  nameById: Map<string, string>,
  playerDisplayFallback: string,
): Promise<MemoryTraceWorldBookAfterInjectedEntry[]> {
  const out: MemoryTraceWorldBookAfterInjectedEntry[] = []
  for (const rawId of characterIds) {
    const cid = rawId.trim()
    if (!cid) continue
    const ch = await personaDb.getCharacter(cid)
    if (!ch) continue
    const expand = await expandTraceTextForCharacter(ch, playerDisplayFallback)
    const cname = nameById.get(cid) || ch.name?.trim() || ch.wechatNickname?.trim() || '角色'
    out.push(...buildAfterChatInjectedSnapshotEntries([{ character: ch, characterName: cname }], expand))
  }
  return out
}

/** 当前全局玩家身份展示名：人设未绑定身份或绑定记录缺省时，与记忆注入一致用于 `{{user}}` */
async function resolvePlayerDisplayFallbackForTrace(): Promise<string> {
  try {
    const cur = await personaDb.getCurrentIdentity()
    if (!cur) return ''
    return (
      String(cur.wechatNickname ?? '').trim() ||
      String(cur.name ?? '').trim() ||
      String(cur.remark ?? '').trim() ||
      ''
    )
  } catch {
    return ''
  }
}

/** 思维溯源展示须与发给模型的占位符展开一致：按人设绑定的玩家身份解析 `{{user}}` */
async function expandTraceTextForCharacter(
  ch: Character | null,
  playerDisplayFallback: string,
): Promise<(s: string) => string> {
  if (!ch) {
    const fb = playerDisplayFallback.trim() || '用户'
    return (s: string) => expandCharUserPlaceholders(String(s ?? ''), { charName: '对方', userName: fb })
  }
  const binding = await resolveWorldBookUserBinding(ch)
  const names = resolveCharUserNamesForPrompt({
    character: ch,
    playerIdentity: binding?.row ?? null,
    playerDisplayName: playerDisplayFallback.trim(),
  })
  return (s: string) => expandCharUserPlaceholders(String(s ?? ''), names)
}

function buildRecentRoundRefsForTrace(params: {
  recentPrivate: string
  recentOffline: string
  recentMeet: string
  privateOmitted: boolean
  offlineOmitted: boolean
  meetOmitted: boolean
}): MemoryTraceRecentRoundRef[] {
  const out: MemoryTraceRecentRoundRef[] = []
  const push = (
    channel: MemoryTraceRecentRoundRef['channel'],
    label: string,
    snippet: string,
    omitted: boolean,
  ) => {
    if (omitted) return
    const t = snippet.trim()
    if (!t) return
    out.push({
      channel,
      label,
      injected: true,
      omittedBecauseUnsummarized: false,
      snippet: t,
    })
  }
  push('private', '私聊 · 最近 6 轮参考', params.recentPrivate, params.privateOmitted)
  push('offline', '线下 · 最近 6 轮参考', params.recentOffline, params.offlineOmitted)
  push('meet', '遇见 · 最近 6 轮参考', params.recentMeet, params.meetOmitted)
  return out
}

function buildInjectionSummary(params: {
  keywordHitCount: number
  longTermVectorCount: number
  storyTimelineInjected: boolean
  todoLedgerInjected: boolean
  unsummarizedPrivateInjected: boolean
  unsummarizedGroupInjected: boolean
  unsummarizedOfflineInjected: boolean
  embeddingProviderMode: MemoryTraceInjectionSummary['embeddingProviderMode']
  privateRecentRoundsOmitted: boolean
  offlineRecentRoundsOmitted: boolean
  meetRecentRoundsOmitted: boolean
}): MemoryTraceInjectionSummary {
  return {
    ...params,
    contextVectorRecallCount: 0,
    contextVectorRecallEnabled: false,
  }
}

export async function publishWeChatPrivatePersonaMemoryTrace(params: {
  character: Character | null
  charDisplayName: string
  transcript: ChatTranscriptTurn[]
  biasText: string
  worldBackgroundPrompt: string
  offlineDatingPlotsContext: string
  unsPrivateNotes: string
  /** 跨号未总结摘录（未包当前线标题，供溯源分块） */
  crossAccountPrivateRaw?: string
  /** 当前线未总结私聊原文（未包标题） */
  currentLinePrivateRaw?: string
  wechatAccountId?: string | null
  sessionPlayerIdentityId?: string | null
  unsGroupNotes: string
  recentGroupChatsReference: string
  chatMemberIds: string[]
  globalWechatPlate: GlobalWechatPlate
  apiConfig: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null
  replyBubbles: string[]
  /** 模型输出中解析的「尾声延展」补丁；私聊仅对当前人设 */
  worldBookPatches?: WorldBookAfterPatch[] | null
  /** 至少一条补丁已写入 IndexedDB 人设 */
  worldBookAfterApplied?: boolean
  /** 剧情时间轴注入块（与 prompt 同源） */
  storyTimelineNotes?: string
  /** 去重后的「最近 N 轮参考」 */
  recentPrivateAiRoundsNotes?: string
  recentOfflineAiRoundsNotes?: string
  recentMeetAiRoundsNotes?: string
  unsMeetNotes?: string
  /** 因未总结块已足够而省略最近 N 轮 */
  dedupePrivateRecentOmitted?: boolean
  dedupeOfflineRecentOmitted?: boolean
  dedupeMeetRecentOmitted?: boolean
  conversationKey?: string | null
}): Promise<void> {
  const cid = params.character?.id?.trim()
  if (!cid) return

  const hay = buildMemoryRelevanceHaystack([
    ...params.transcript.slice(-32).map((t) => t.text),
    params.biasText,
  ])
  const lineScope = normalizeMemoryPromptLineScope(
    params.wechatAccountId,
    params.sessionPlayerIdentityId,
  )
  const memSettings = await personaDb.getMemorySettings()
  const apiPick = pickTrimmedApiUrlKey(params.apiConfig)
  const recallOpts = {
    apiConfig: apiPick,
    lineScope: lineScope ?? undefined,
    conversationKey: params.conversationKey?.trim() || undefined,
  }
  const { getCharacterMemoryRelevanceTraceForPromptInjection } = await import(
    './memory/formatCharacterMemoriesForPromptInjection'
  )
  const deep = await getCharacterMemoryRelevanceTraceForPromptInjection(cid, hay, recallOpts)
  const embeddingMode =
    memSettings.memoryEmbeddingProviderMode === 'api' ||
    memSettings.memoryEmbeddingProviderMode === 'local' ||
    memSettings.memoryEmbeddingProviderMode === 'auto'
      ? memSettings.memoryEmbeddingProviderMode
      : 'auto'

  const personaDetail = buildFullPersonaDetailForMemoryTrace(params.character)
  const characterWorldBookRaw = (
    await buildWorldBookTextForPrompt(params.character, TRACE_WORLD_BOOK_MAX_CHARS)
  ).trim()
  const globalWorldbookRaw = buildWorldbookContext(
    params.chatMemberIds,
    getWorldbookLoreEntriesSnapshot(),
    params.globalWechatPlate,
    { skipLengthCap: true, plainUserEntriesOnly: true },
  ).trim()
  const playerFb = await resolvePlayerDisplayFallbackForTrace()
  const expand = await expandTraceTextForCharacter(params.character, playerFb)
  const characterWorldBook = expand(characterWorldBookRaw)
  const globalWorldbook = expand(globalWorldbookRaw)
  const personaDetailOut = expand(personaDetail)
  const worldBgOut = expand(params.worldBackgroundPrompt.trim())

  const offlinePlotRowsRaw = await listInjectedOfflinePlotTraceRowsForMemoryTrace(cid, params.charDisplayName)
  const offlinePlotRows = offlinePlotRowsRaw.length
    ? offlinePlotRowsRaw
    : buildOfflinePlotTraceRowsFromInjectedContext(params.offlineDatingPlotsContext)
  const offlineCtxBody = offlinePlotRows.map((r) => r.snippet.trim()).filter(Boolean).join('\n\n')

  const unsChats: MemoryTraceData['contextMatrix']['recentContext']['unsummarizedChats'] = []
  const unsPrivateInjected = params.unsPrivateNotes.trim()
  const privateTraceBlocks = unsPrivateInjected
    ? await buildPrivateUnsummarizedTraceBlocks({
        crossAccountMerged: params.crossAccountPrivateRaw,
        currentLineRaw: params.currentLinePrivateRaw,
        lineScope,
      })
    : []
  if (privateTraceBlocks.length) {
    for (const b of privateTraceBlocks) {
      unsChats.push({
        type: 'private',
        source: `${lineRelationUiLabel(b.lineRelation)} · ${b.sourceLineLabel}`,
        sourceLineLabel: b.sourceLineLabel,
        lineRelation: b.lineRelation,
        snippet: traceOnlineUnsummarizedSnippetForDisplay(b.snippet),
      })
    }
  } else if (unsPrivateInjected) {
    for (const b of parseLineScopedUnsummarizedTextForTrace(
      stripPromptPolicyBlocksForTraceDisplay(params.unsPrivateNotes),
    )) {
      unsChats.push({
        type: 'private',
        source: `${lineRelationUiLabel(b.lineRelation)} · ${b.sourceLineLabel}`,
        sourceLineLabel: b.sourceLineLabel,
        lineRelation: b.lineRelation,
        snippet: traceOnlineUnsummarizedSnippetForDisplay(b.snippet),
      })
    }
  }
  if (params.unsGroupNotes.trim()) {
    unsChats.push({
      type: 'group',
      source: '各群（游标后摘录）',
      snippet: traceOnlineUnsummarizedSnippetForDisplay(params.unsGroupNotes),
    })
  }
  if (params.recentGroupChatsReference.trim()) {
    unsChats.push({
      type: 'group',
      source: '群聊近期参考（本地摘录）',
      snippet: traceOnlineUnsummarizedSnippetForDisplay(params.recentGroupChatsReference),
    })
  }
  if (params.unsMeetNotes?.trim()) {
    unsChats.push({
      type: 'private',
      source: '尚未总结 · 遇见私聊',
      snippet: params.unsMeetNotes.trim(),
    })
  }

  const storyTimelineNotesExpanded = params.storyTimelineNotes?.trim()
    ? await personaDb.expandStoryTimelineTextForDisplay(cid, params.storyTimelineNotes)
    : ''
  const storyTimeline = buildStoryTimelineTraceBlock(storyTimelineNotesExpanded, expand)
  const todoLedger = await buildTodoLedgerTraceBlock(cid, expand)

  const recentRoundRefs = buildRecentRoundRefsForTrace({
    recentPrivate: params.recentPrivateAiRoundsNotes ?? '',
    recentOffline: params.recentOfflineAiRoundsNotes ?? '',
    recentMeet: params.recentMeetAiRoundsNotes ?? '',
    privateOmitted: params.dedupePrivateRecentOmitted === true,
    offlineOmitted: params.dedupeOfflineRecentOmitted === true,
    meetOmitted: params.dedupeMeetRecentOmitted === true,
  })

  const injectionSummary = buildInjectionSummary({
    keywordHitCount: deep.keywordHits.length,
    longTermVectorCount: deep.vectorRetrievals.length,
    storyTimelineInjected: storyTimeline.injected,
    todoLedgerInjected: todoLedger.injected,
    unsummarizedPrivateInjected: !!unsPrivateInjected,
    unsummarizedGroupInjected: !!params.unsGroupNotes.trim(),
    unsummarizedOfflineInjected: !!offlineCtxBody,
    embeddingProviderMode: embeddingMode,
    privateRecentRoundsOmitted: params.dedupePrivateRecentOmitted === true,
    offlineRecentRoundsOmitted: params.dedupeOfflineRecentOmitted === true,
    meetRecentRoundsOmitted: params.dedupeMeetRecentOmitted === true,
  })

  const lastReply = lastNonEmptyBubbleText(params.replyBubbles)

  const chatAfterProtocol = hasChatAfterWorldBookItems(params.character)
  const injectedSnapshotEntries =
    chatAfterProtocol && params.character
      ? buildAfterChatInjectedSnapshotEntries(
          [
            {
              character: params.character,
              characterName:
                params.charDisplayName.trim() || params.character.name?.trim() || '角色',
            },
          ],
          expand,
        )
      : []
  const patchRows = buildWorldBookAfterPatchRowsFromSingleCharacter(
    params.character,
    params.worldBookPatches ?? [],
  )
  const worldBookAfterChat = buildWorldBookAfterChatTrace({
    protocolInPrompt: chatAfterProtocol,
    injectedSnapshotEntries,
    patchOutputRulesIncluded: chatAfterProtocol,
    parsedPatches: patchRows,
    appliedToDb: params.worldBookAfterApplied === true,
  })

  const netTraceRaw = await buildPrivateChatNetworkRelationshipsTrace({
    character: params.character,
    sessionPlayerIdentityId: params.sessionPlayerIdentityId,
  })
  const networkRelationships = netTraceRaw
    ? {
        ...netTraceRaw,
        promptExcerpt: netTraceRaw.promptExcerpt.trim()
          ? expand(netTraceRaw.promptExcerpt)
          : '',
      }
    : null

  const data: MemoryTraceData = {
    lastReply: lastReply || '（本轮无可见文本气泡）',
    charName: params.charDisplayName.trim() || params.character?.name?.trim() || '角色',
    injectionSummary,
    worldBookAfterChat,
    networkRelationships,
    contextMatrix: {
      baseDirectives: {
        persona: personaTagsFromCharacter(params.character),
        personaDetail: personaDetailOut,
        worldBackground: worldBgOut,
        characterWorldBook: characterWorldBook || '（未绑定或未启用人设世界书条目）',
        globalWorldbook: globalWorldbook || '（当前场景无匹配的档案室全局条目）',
        worldbooks: [],
      },
      storyTimeline,
      todoLedger,
      recentContext: {
        activeSessionMessages: activeSessionMessageCount(params.transcript),
        unsummarizedOfflinePlots: offlinePlotRows,
        unsummarizedChats: unsChats,
        recentRoundRefs,
      },
      deepMemory: {
        keywordHits: deep.keywordHits,
        vectorRetrievals: deep.vectorRetrievals,
      },
    },
  }
  setLastMemoryTrace(data)
}

/** 群多角色：以首名 NPC 的长期记忆 trace 为主，并合并档案室与群级未总结摘录 */
export async function publishWeChatGroupMemoryTrace(params: {
  groupName: string
  transcript: ChatTranscriptTurn[]
  biasText: string
  primaryNpcCharacterId: string
  primaryNpcDisplayName: string
  worldBackgroundFirst?: string
  offlinePlotsCombined: string
  groupUnsummarizedNotes: string
  wbGroupCharIds: string[]
  apiConfig: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null
  replyBubbles: string[]
  /** 与群 system 追加的 `buildAggregateGroupChatAfterPatchItemsSection` 同源（未展开占位符） */
  groupChatAfterInjectedRaw?: string | null
  /** 已向模型追加 ---WB_AFTER_PATCH--- 说明 */
  patchRulesIncluded?: boolean
  worldBookPatches?: WorldBookAfterPatch[] | null
  worldBookAfterApplied?: boolean
}): Promise<void> {
  const cid = params.primaryNpcCharacterId.trim()
  if (!cid) return

  const hay = buildMemoryRelevanceHaystack([
    ...params.transcript.slice(-36).map((t) => `${t.speakerLabel ?? ''} ${t.text}`),
    params.biasText,
    params.offlinePlotsCombined,
  ])
  const deep = await getCharacterMemoryRelevanceTraceForPromptInjection(cid, hay, {
    apiConfig: pickTrimmedApiUrlKey(params.apiConfig),
  })

  const primaryChar = await personaDb.getCharacter(cid)
  const personaDetail = buildFullPersonaDetailForMemoryTrace(primaryChar)
  const characterWorldBookRaw = (
    await buildWorldBookTextForPrompt(primaryChar, TRACE_WORLD_BOOK_MAX_CHARS)
  ).trim()
  const globalWorldbookRaw = buildWorldbookContext(
    params.wbGroupCharIds,
    getWorldbookLoreEntriesSnapshot(),
    'group_chat',
    { skipLengthCap: true, plainUserEntriesOnly: true },
  ).trim()
  const playerFb = await resolvePlayerDisplayFallbackForTrace()
  const expand = await expandTraceTextForCharacter(primaryChar, playerFb)
  const characterWorldBook = expand(characterWorldBookRaw)
  const globalWorldbook = expand(globalWorldbookRaw)
  const personaDetailOut = expand(personaDetail)
  const worldBgOut = expand((params.worldBackgroundFirst ?? '').trim())

  const unsChats: MemoryTraceData['contextMatrix']['recentContext']['unsummarizedChats'] = []
  if (params.groupUnsummarizedNotes.trim()) {
    unsChats.push({
      type: 'group',
      source: `本群：${params.groupName}`,
      snippet: traceOnlineUnsummarizedSnippetForDisplay(params.groupUnsummarizedNotes),
    })
  }
  const offlineCombinedBody = stripOfflineDatingPlotsInjectHeaderForTraceDisplay(
    params.offlinePlotsCombined,
  )
  if (offlineCombinedBody) {
    unsChats.push({
      type: 'group',
      source: '线下剧情摘录（多成员合并）',
      snippet: offlineCombinedBody,
    })
  }

  const lastReply = lastNonEmptyBubbleText(params.replyBubbles)

  const patchRules = params.patchRulesIncluded === true
  const injRaw = String(params.groupChatAfterInjectedRaw ?? '').trim()
  const protocolGroup = patchRules || injRaw.length > 0
  const injectedSnapshotEntries =
    protocolGroup && params.wbGroupCharIds.length
      ? await buildAfterChatInjectedSnapshotEntriesForCharacterIds(
          params.wbGroupCharIds,
          new Map([[cid, params.primaryNpcDisplayName.trim() || '角色']]),
          playerFb,
        )
      : []
  const patchRows = await buildWorldBookAfterPatchRowsForGroupChat(params.worldBookPatches ?? [], primaryChar)
  const worldBookAfterChat = buildWorldBookAfterChatTrace({
    protocolInPrompt: protocolGroup,
    injectedSnapshotEntries,
    patchOutputRulesIncluded: patchRules,
    parsedPatches: patchRows,
    appliedToDb: params.worldBookAfterApplied === true,
  })

  const data: MemoryTraceData = {
    lastReply: lastReply || '（本轮无可见文本气泡）',
    charName: params.groupName.trim() || '群聊',
    worldBookAfterChat,
    contextMatrix: {
      baseDirectives: {
        persona: [`多角色会话`, `主参考记忆：${params.primaryNpcDisplayName}`],
        personaDetail:
          personaDetailOut.trim() ||
          `【群聊说明】本溯源以首位发言 NPC「${params.primaryNpcDisplayName}」的人设档案为主参考；多角色台词由群聊管线分别注入。`,
        worldBackground: worldBgOut,
        characterWorldBook: characterWorldBook || '（该 NPC 未绑定或未启用人设世界书）',
        globalWorldbook: globalWorldbook || '（当前群场景无匹配的档案室全局条目）',
        worldbooks: [],
      },
      recentContext: {
        activeSessionMessages: activeSessionMessageCount(params.transcript),
        unsummarizedOfflinePlots: [],
        unsummarizedChats: unsChats,
      },
      deepMemory: {
        keywordHits: deep.keywordHits,
        vectorRetrievals: deep.vectorRetrievals,
      },
    },
  }
  setLastMemoryTrace(data)
}

export async function publishDatingOfflineMemoryTrace(params: {
  characterId: string
  charName: string
  identityTags: string[]
  worldBackground: string
  datingArchiveBlock: string
  /** 与 `datingArchiveBlock` 同源筛选，仅条目标题+正文（思维溯源无注入前言时用） */
  datingArchiveBlockPlain?: string
  isVnMode: boolean
  historyPlotCount: number
  userText?: string
  unsPrivateBlock: string
  unsGroupBlock: string
  unsOfflineBlock: string
  recentPrivateAiRoundsNotes?: string
  recentOfflineAiRoundsNotes?: string
  storyTimelineNotes?: string
  dedupePrivateRecentOmitted?: boolean
  dedupeOfflineRecentOmitted?: boolean
  conversationKey?: string | null
  apiConfig: { apiUrl?: string; apiKey?: string; modelId?: string } | null
  rawAssistantOutput: string
  worldBookAfterChat?: MemoryTraceWorldBookAfterChat | null
}): Promise<void> {
  const cid = params.characterId.trim()
  if (!cid) return

  const hay = buildMemoryRelevanceHaystack([params.userText, params.unsPrivateBlock, params.unsGroupBlock])
  const memSettings = await personaDb.getMemorySettings()
  const apiPick = pickTrimmedApiUrlKey(params.apiConfig)
  const recallOpts = {
    apiConfig: apiPick,
    conversationKey: params.conversationKey?.trim() || undefined,
  }
  const deep = await getCharacterMemoryRelevanceTraceForPromptInjection(cid, hay, recallOpts)
  const embeddingMode =
    memSettings.memoryEmbeddingProviderMode === 'api' ||
    memSettings.memoryEmbeddingProviderMode === 'local' ||
    memSettings.memoryEmbeddingProviderMode === 'auto'
      ? memSettings.memoryEmbeddingProviderMode
      : 'auto'

  const plate = params.isVnMode ? ('vn' as const) : ('offline_plot' as const)
  const chRow = await personaDb.getCharacter(cid)
  const personaDetail = buildFullPersonaDetailForMemoryTrace(chRow)
  const characterWorldBookRaw = (
    await buildWorldBookTextForPrompt(chRow, TRACE_WORLD_BOOK_MAX_CHARS)
  ).trim()
  const globalWorldbookRaw = buildWorldbookContext([cid], getWorldbookLoreEntriesSnapshot(), plate, {
    skipLengthCap: true,
    plainUserEntriesOnly: true,
  }).trim()
  const playerFb = await resolvePlayerDisplayFallbackForTrace()
  const expand = await expandTraceTextForCharacter(chRow, playerFb)
  const characterWorldBook = expand(characterWorldBookRaw)
  const rawArchiveFallback = globalWorldbookRaw.trim() || (params.datingArchiveBlockPlain?.trim() ?? '')
  const globalWorldbook = expand(rawArchiveFallback) || '（当前板块无档案室条目）'
  const personaDetailOut = expand(personaDetail)
  const worldBgOut = expand(params.worldBackground.trim())
  const offlinePlotRowsRaw = await listInjectedOfflinePlotTraceRowsForMemoryTrace(cid, params.charName)
  const offlinePlotRows = offlinePlotRowsRaw.length
    ? offlinePlotRowsRaw
    : buildOfflinePlotTraceRowsFromInjectedContext(params.unsOfflineBlock)
  const offlineCtxBody = offlinePlotRows.map((r) => r.snippet.trim()).filter(Boolean).join('\n\n')

  const unsChats: MemoryTraceData['contextMatrix']['recentContext']['unsummarizedChats'] = []
  if (params.unsPrivateBlock.trim()) {
    unsChats.push({
      type: 'private',
      source: '尚未总结 · 私聊',
      snippet: traceOnlineUnsummarizedSnippetForDisplay(params.unsPrivateBlock),
    })
  }
  if (params.unsGroupBlock.trim()) {
    unsChats.push({
      type: 'group',
      source: '尚未总结 · 群聊',
      snippet: traceOnlineUnsummarizedSnippetForDisplay(params.unsGroupBlock),
    })
  }

  const { displayBody } = resolveDatingAssistantDisplayText(params.rawAssistantOutput)
  const lastReply = stripDatingVnVoiceParamsForMemoryTrace(displayBody).trim()

  const datingCid = params.characterId.trim()
  const storyTimelineNotesExpanded = params.storyTimelineNotes?.trim()
    ? await personaDb.expandStoryTimelineTextForDisplay(datingCid, params.storyTimelineNotes)
    : ''
  const storyTimeline = buildStoryTimelineTraceBlock(storyTimelineNotesExpanded, expand)
  const todoLedger = await buildTodoLedgerTraceBlock(datingCid, expand)

  const recentRoundRefs = buildRecentRoundRefsForTrace({
    recentPrivate: params.recentPrivateAiRoundsNotes ?? '',
    recentOffline: params.recentOfflineAiRoundsNotes ?? '',
    recentMeet: '',
    privateOmitted: params.dedupePrivateRecentOmitted === true,
    offlineOmitted: params.dedupeOfflineRecentOmitted === true,
    meetOmitted: false,
  })

  const injectionSummary = buildInjectionSummary({
    keywordHitCount: deep.keywordHits.length,
    longTermVectorCount: deep.vectorRetrievals.length,
    storyTimelineInjected: storyTimeline.injected,
    todoLedgerInjected: todoLedger.injected,
    unsummarizedPrivateInjected: !!params.unsPrivateBlock.trim(),
    unsummarizedGroupInjected: !!params.unsGroupBlock.trim(),
    unsummarizedOfflineInjected: !!offlineCtxBody,
    embeddingProviderMode: embeddingMode,
    privateRecentRoundsOmitted: params.dedupePrivateRecentOmitted === true,
    offlineRecentRoundsOmitted: params.dedupeOfflineRecentOmitted === true,
    meetRecentRoundsOmitted: false,
  })

  const data: MemoryTraceData = {
    lastReply: lastReply || '（本轮无正文）',
    charName: params.charName.trim() || '约会',
    injectionSummary,
    worldBookAfterChat: params.worldBookAfterChat ?? null,
    contextMatrix: {
      baseDirectives: {
        persona: [...params.identityTags].slice(0, 12),
        personaDetail: personaDetailOut.trim() || params.identityTags.join('、'),
        worldBackground: worldBgOut,
        characterWorldBook: characterWorldBook || '（未绑定或未启用人设世界书）',
        globalWorldbook: globalWorldbook,
        worldbooks: [],
      },
      storyTimeline,
      todoLedger,
      recentContext: {
        activeSessionMessages: Math.min(Math.max(0, params.historyPlotCount), 32),
        unsummarizedOfflinePlots: offlinePlotRows,
        unsummarizedChats: unsChats,
        recentRoundRefs,
      },
      deepMemory: {
        keywordHits: deep.keywordHits,
        vectorRetrievals: deep.vectorRetrievals,
      },
    },
  }
  setLastMemoryTrace(data)
}
