import type { ApiConfig } from '../../api/types'
import { openAiCompatibleChat } from './ai'
import { personaDb } from './idb'
import type { Character } from './types'
import {
  applyWorldBookAfterPatchesToCharacter,
  hasChatAfterWorldBookItems,
  listChatAfterWorldBookItems,
  parseWorldBookAfterPatchJson,
  WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT,
  type WorldBookAfterPatch,
} from './worldBookAfterPatch'
import { resolveAutoSummaryApiConfigFromSettings } from '../memory/memorySummaryApi'
import { isWorldBookAfterPerRoundSyncEnabled } from '../memory/worldBookAfterPerRoundSync'
import { dispatchWorldBookAfterPerRoundSyncResult } from '../memory/worldBookAfterPerRoundResultEvents'
import { gatherLatestRoundBodyForEpilogue } from '../memory/memoryEpilogueArchive'
import {
  buildDatingEpiloguePerRoundSyncExtraRules,
  filterDatingWorldBookAfterPatches,
} from '../dating/datingEpilogueRelationshipRules'
import {
  buildWorldBookAfterPatchRowsFromSingleCharacter,
  syncAutoSummaryEpilogueToLastMemoryTrace,
} from '../memoryTracePublisher'

export type WorldBookAfterSyncSource = 'auto_summary' | 'per_round'

const RECENT_TRANSCRIPT_MAX_CHARS = 6000
const LATEST_REPLY_MAX_CHARS = 2500
const SUMMARY_CONTEXT_MAX_CHARS = 10000
const PER_ROUND_BODY_MAX_CHARS = 4500

function stripJsonFence(raw: string): string {
  const t = raw.trim()
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return m ? m[1].trim() : t
}

function formatEpilogueRowsForPrompt(characters: Character[]): string {
  const blocks: string[] = []
  for (const ch of characters) {
    const rows = listChatAfterWorldBookItems(ch)
    if (!rows.length) continue
    const cid = String(ch.id ?? '').trim()
    const name = String(ch.name ?? ch.wechatNickname ?? '').trim() || '角色'
    const inner = rows
      .map(
        (r) =>
          `  - 「${r.bookName}」·「${r.itemName}」·worldBookId=\`${r.worldBookId}\` · itemId=\`${r.itemId}\`\n    当前：${r.content}`,
      )
      .join('\n')
    blocks.push(`【${name} · characterId=\`${cid}\`】\n${inner}`)
  }
  return blocks.join('\n\n')
}

function buildWorldBookAfterSyncSystemPrompt(): string {
  return `
你是「尾声延展」世界书编辑助手。用户会提供角色的 priority=after（尾声延展）条目快照，以及近期对话/剧情材料。
你的任务：判断材料中是否出现与某条「尾声延展」正文**不一致、且可持续**的关系态/态度变化；若有，输出替换后的条目全文。

【更新原则】
- **应更新**：条目仍写「冷漠/疏离」但近几轮已明显缓和；称呼、边界、内心分量出现**可核对**的渐变或跃迁；关系阶段（同事→暧昧等）有实质推进。
- **勿更新**：单轮嘴硬/玩笑/情绪波动，尚不足以改写长期快照；与当前条目仍兼容的细微语气变化。
- **勿凑数**：无实质变化则 patches 为 []。
- 优先更新「对 {{user}} 的当前态度」；其它条目仅在材料中有明确对应事实时更新。
- newContent 须仍为第三人称档案体「尾声延展」语义；指角色本人用 {{char}}，指玩家用 {{user}}；禁止第一人称台词。
- 仅可修改上文已列出的 worldBookId/itemId；禁止编造 id。

【输出】只输出一个 JSON 对象，禁止 markdown 围栏与解释：
{
  "patches": [
    {
      "characterId": "人设UUID（多角色时必填；单角色可省略）",
      "worldBookId": "世界书 id",
      "itemId": "条目 id",
      "newContent": "替换后的条目正文全文"
    }
  ]
}
`.trim()
}

function buildWorldBookAfterPerRoundSystemPrompt(): string {
  return `
你是「尾声延展」世界书编辑助手。用户会提供角色的 priority=after（尾声延展）条目快照，以及**仅本轮**最新剧情/回复正文。
你的任务：只根据本轮正文，判断是否与某条「尾声延展」正文出现**不一致、且可持续**的关系态/态度变化；若有，输出替换后的条目全文。

【更新原则】
- **应更新**：条目仍写「冷漠/疏离」但本轮已明显缓和；称呼、边界、内心分量出现**可核对**的渐变或跃迁；关系阶段有实质推进。
- **勿更新**：单轮嘴硬/玩笑/情绪波动，尚不足以改写长期快照；与当前条目仍兼容的细微语气变化。
- **勿凑数**：无实质变化则 patches 为 []。
- 勿根据「以往可能发生过」臆造；仅依据用户给出的本轮正文。
- newContent 须仍为第三人称档案体「尾声延展」语义；指角色本人用 {{char}}，指玩家用 {{user}}；禁止第一人称台词。
- 仅可修改上文已列出的 worldBookId/itemId；禁止编造 id。

【输出】只输出一个 JSON 对象，禁止 markdown 围栏与解释：
{
  "patches": [
    {
      "characterId": "人设UUID（可省略）",
      "worldBookId": "世界书 id",
      "itemId": "条目 id",
      "newContent": "替换后的条目正文全文"
    }
  ]
}
`.trim()
}

/** 每轮专用：仅尾声快照 + 本轮剧情正文（无历史摘录、无总结材料块）。 */
export async function requestWorldBookAfterPerRoundPatches(params: {
  apiConfig: ApiConfig | null
  character: Character
  latestRoundBody: string
  /** 线下剧情落库后的尾声判断：启用更严的关系基准规则 */
  datingContext?: {
    isEarlyRound?: boolean
    hasOnlineWechatFacts?: boolean
    historyPlotCount?: number
    userText?: string
  }
}): Promise<WorldBookAfterPatch[]> {
  const ch = params.character
  if (!ch?.id?.trim() || !hasChatAfterWorldBookItems(ch)) return []

  const settings = await personaDb.getMemorySettings()
  const cfg = resolveAutoSummaryApiConfigFromSettings(settings, params.apiConfig)
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    throw new Error('未配置自动总结 / 尾声判断 API（记忆配置页）')
  }

  let latest = String(params.latestRoundBody ?? '').trim()
  if (!latest || latest.length < 8) return []
  if (latest.length > PER_ROUND_BODY_MAX_CHARS) {
    latest = `${latest.slice(0, PER_ROUND_BODY_MAX_CHARS)}\n\n（以下因长度已截断）`
  }

  const epilogueBlock = formatEpilogueRowsForPrompt([ch])
  if (!epilogueBlock.trim()) return []

  const userContent = [
    '【当前尾声延展条目快照】',
    epilogueBlock,
    '',
    '【本轮最新剧情 / 回复正文（仅此一轮，勿臆造未出现事实）】',
    latest,
    '',
    params.datingContext
      ? buildDatingEpiloguePerRoundSyncExtraRules({
          isEarlyRound: params.datingContext.isEarlyRound,
          hasOnlineWechatFacts: params.datingContext.hasOnlineWechatFacts,
        })
      : '',
    '',
    '请仅根据本轮正文判断尾声延展是否需要更新；无变化则 patches=[]。',
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await openAiCompatibleChat(cfg, [
    { role: 'system', content: buildWorldBookAfterPerRoundSystemPrompt() },
    { role: 'user', content: userContent },
  ])
  if (!raw.trim()) {
    throw new Error('尾声判断模型返回为空')
  }

  let jsonBody = stripJsonFence(raw)
  const start = jsonBody.indexOf('{')
  const end = jsonBody.lastIndexOf('}')
  if (start >= 0 && end > start) jsonBody = jsonBody.slice(start, end + 1)

  let patches = parseWorldBookAfterPatchJson(jsonBody)
  if (params.datingContext && patches.length) {
    patches = filterDatingWorldBookAfterPatches(patches, ch, {
      historyPlotCount: params.datingContext.historyPlotCount ?? 0,
      plotBody: latest,
      userText: params.datingContext.userText,
    })
  }
  return patches
}

export type WorldBookAfterPerRoundSyncOutcome =
  | { status: 'skipped'; reason: string }
  | { status: 'no_change' }
  | { status: 'applied'; count: number }
  | { status: 'failed'; reason: string }

function notifyPerRoundEpilogueFailure(displayName: string, reason: string) {
  dispatchWorldBookAfterPerRoundSyncResult({
    ok: false,
    displayName,
    failureReason: reason,
  })
}

/**
 * 每轮 AI 落库后：若主回复未 inline 补丁、尾段 JSON 未带 epilogue_patches，则额外请求一次尾声判断。
 * 模型返回 patches=[] 时为 no_change（正常，不 toast）。
 */
export async function finalizeWorldBookAfterPerAiRound(params: {
  apiConfig: ApiConfig | null
  character: Character | null
  latestRoundBody: string
  displayName?: string
  /** 主聊天回复内联 worldBookPatches 已成功写库 */
  inlinePatchApplied?: boolean
  /** 尾段 memory JSON 内 epilogue_patches 已应用条数 */
  epiloguePatchesApplied?: number
  /** 手动触发时不检查每轮开关 */
  force?: boolean
  /** 失败时是否派发全局 toast */
  notifyOnFailure?: boolean
  /** 线下剧情：更严的关系基准与补丁过滤 */
  datingContext?: {
    isEarlyRound?: boolean
    hasOnlineWechatFacts?: boolean
    historyPlotCount?: number
    userText?: string
  }
}): Promise<WorldBookAfterPerRoundSyncOutcome> {
  const ch = params.character
  const label =
    params.displayName?.trim() ||
    String(ch?.name ?? ch?.wechatNickname ?? '').trim() ||
    '角色'
  if (!ch?.id?.trim() || !hasChatAfterWorldBookItems(ch)) {
    return { status: 'skipped', reason: '无尾声延展条目' }
  }
  if (params.inlinePatchApplied) {
    return { status: 'skipped', reason: '本轮已 inline 写库' }
  }
  if ((params.epiloguePatchesApplied ?? 0) > 0) {
    return { status: 'skipped', reason: '尾段 JSON 已写库' }
  }

  const settings = await personaDb.getMemorySettings()
  if (!params.force && !isWorldBookAfterPerRoundSyncEnabled(settings)) {
    return { status: 'skipped', reason: '自动总结已关闭' }
  }

  const body = String(params.latestRoundBody ?? '').trim()
  if (body.length < 8) {
    return { status: 'skipped', reason: '本轮正文过短' }
  }

  try {
    const patches = await requestWorldBookAfterPerRoundPatches({
      apiConfig: params.apiConfig,
      character: ch,
      latestRoundBody: body,
      datingContext: params.datingContext,
    })
    if (!patches.length) return { status: 'no_change' }
    const count = await persistWorldBookAfterSyncPatches(
      patches.map((p) => ({ ...p, characterId: p.characterId?.trim() || ch.id })),
      { source: 'per_round' },
    )
    if (count > 0) return { status: 'applied', count }
    return { status: 'no_change' }
  } catch (e) {
    const reason = e instanceof Error && e.message.trim() ? e.message.trim() : '尾声判断请求失败'
    if (params.notifyOnFailure !== false) {
      notifyPerRoundEpilogueFailure(label, reason)
    }
    return { status: 'failed', reason }
  }
}

/** 档案馆手动对齐：粘贴或自动采集本轮正文后请求尾声判断 */
export async function runManualEpilogueAlignment(params: {
  apiConfig: ApiConfig | null
  characterId: string
  latestRoundBody?: string
  displayName?: string
}): Promise<WorldBookAfterPerRoundSyncOutcome> {
  const cid = params.characterId.trim()
  if (!cid) return { status: 'failed', reason: '无效角色' }
  const ch = await personaDb.getCharacter(cid)
  if (!ch) return { status: 'failed', reason: '角色不存在' }
  let body = String(params.latestRoundBody ?? '').trim()
  if (body.length < 8) {
    body = await gatherLatestRoundBodyForEpilogue(cid)
  }
  if (body.length < 8) {
    return { status: 'failed', reason: '请粘贴至少一轮剧情 / 回复正文（8 字以上）' }
  }
  return finalizeWorldBookAfterPerAiRound({
    apiConfig: params.apiConfig,
    character: ch,
    latestRoundBody: body,
    displayName: params.displayName,
    force: true,
    notifyOnFailure: false,
  })
}

export async function requestWorldBookAfterSyncPatches(params: {
  apiConfig: ApiConfig | null
  characters: Character[]
  /** 近期对话摘录（已格式化） */
  recentTranscript: string
  /** 本轮 AI 回复正文 */
  latestReply: string
  /** 自动总结路径：额外材料块（线上/线下/人脉摘录） */
  summaryMaterialsBlock?: string
}): Promise<WorldBookAfterPatch[]> {
  const chars = params.characters.filter((c) => hasChatAfterWorldBookItems(c))
  if (!chars.length) return []

  const settings = await personaDb.getMemorySettings()
  const cfg = resolveAutoSummaryApiConfigFromSettings(settings, params.apiConfig)
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) return []

  let recent = String(params.recentTranscript ?? '').trim()
  if (recent.length > RECENT_TRANSCRIPT_MAX_CHARS) {
    recent = `…${recent.slice(-RECENT_TRANSCRIPT_MAX_CHARS)}`
  }
  let latest = String(params.latestReply ?? '').trim()
  if (latest.length > LATEST_REPLY_MAX_CHARS) {
    latest = `${latest.slice(0, LATEST_REPLY_MAX_CHARS)}\n\n（以下因长度已截断）`
  }
  let summaryBlock = String(params.summaryMaterialsBlock ?? '').trim()
  if (summaryBlock.length > SUMMARY_CONTEXT_MAX_CHARS) {
    summaryBlock = `${summaryBlock.slice(0, SUMMARY_CONTEXT_MAX_CHARS)}\n\n（以下因长度已截断）`
  }

  const epilogueBlock = formatEpilogueRowsForPrompt(chars)
  if (!epilogueBlock.trim()) return []

  const userParts = [
    '【当前尾声延展条目快照】',
    epilogueBlock,
    '',
    '【近期对话 / 剧情摘录】',
    recent || '（无）',
    '',
    '【本轮 AI 最新回复】',
    latest || '（无）',
  ]
  if (summaryBlock) {
    userParts.push('', '【自动总结材料（线上/线下/人脉）】', summaryBlock)
  }
  userParts.push('', '请输出 JSON（无变化则 patches=[]）。')

  const raw = await openAiCompatibleChat(cfg, [
    { role: 'system', content: buildWorldBookAfterSyncSystemPrompt() },
    { role: 'user', content: userParts.join('\n') },
  ])
  if (!raw.trim()) return []

  let jsonBody = stripJsonFence(raw)
  const start = jsonBody.indexOf('{')
  const end = jsonBody.lastIndexOf('}')
  if (start >= 0 && end > start) jsonBody = jsonBody.slice(start, end + 1)

  return parseWorldBookAfterPatchJson(jsonBody)
}

/** 将补丁写入人设库；返回成功条数 */
export async function persistWorldBookAfterSyncPatches(
  patches: WorldBookAfterPatch[],
  opts?: { source?: WorldBookAfterSyncSource },
): Promise<number> {
  if (!patches.length) return 0
  const byChar = new Map<string, WorldBookAfterPatch[]>()
  for (const p of patches) {
    const cid = p.characterId?.trim()
    if (!cid) continue
    const arr = byChar.get(cid) ?? []
    arr.push(p)
    byChar.set(cid, arr)
  }
  let applied = 0
  const traceRows: import('../memoryTraceTypes').MemoryTraceWorldBookAfterPatchRow[] = []
  let primaryCharacterId = ''
  for (const [cid, plist] of byChar) {
    const row = await personaDb.getCharacter(cid)
    if (!row) continue
    if (!primaryCharacterId) primaryCharacterId = cid
    traceRows.push(...buildWorldBookAfterPatchRowsFromSingleCharacter(row, plist))
    const next = applyWorldBookAfterPatchesToCharacter(row, plist)
    if (next) {
      await personaDb.upsertCharacter(next)
      applied += plist.length
    }
  }
  if (applied > 0) {
    window.dispatchEvent(
      new CustomEvent(WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT, {
        detail: { appliedPatchCount: applied, source: opts?.source ?? 'auto_summary' },
      }),
    )
    if (
      (opts?.source === 'auto_summary' || opts?.source === 'per_round') &&
      traceRows.length
    ) {
      void syncAutoSummaryEpilogueToLastMemoryTrace({
        primaryCharacterId: primaryCharacterId || traceRows[0]?.characterId || '',
        patchRows: traceRows,
      }).catch(() => {})
    }
  }
  return applied
}

/** 自动总结 JSON 中的 epiloguePatches 落库（primary + 可关联 NPC） */
export async function applyEpiloguePatchesFromAutoSummary(
  patches: WorldBookAfterPatch[] | null | undefined,
  primaryCharacterId: string,
  allowedNpcIds?: Set<string>,
): Promise<number> {
  const list = patches ?? []
  if (!list.length) return 0

  const primaryId = primaryCharacterId.trim()
  const byChar = new Map<string, WorldBookAfterPatch[]>()

  for (const p of list) {
    const cid = (p.characterId?.trim() || primaryId).trim()
    if (!cid) continue
    if (cid !== primaryId && allowedNpcIds && !allowedNpcIds.has(cid)) continue
    const arr = byChar.get(cid) ?? []
    arr.push({ ...p, characterId: cid })
    byChar.set(cid, arr)
  }

  let applied = 0
  const traceRows: import('../memoryTraceTypes').MemoryTraceWorldBookAfterPatchRow[] = []
  for (const [cid, plist] of byChar) {
    const row = await personaDb.getCharacter(cid)
    if (!row) continue
    traceRows.push(...buildWorldBookAfterPatchRowsFromSingleCharacter(row, plist))
    const next = applyWorldBookAfterPatchesToCharacter(row, plist)
    if (next) {
      await personaDb.upsertCharacter(next)
      applied += plist.length
    }
  }
  if (applied > 0) {
    window.dispatchEvent(
      new CustomEvent(WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT, {
        detail: { appliedPatchCount: applied, source: 'auto_summary' },
      }),
    )
    void syncAutoSummaryEpilogueToLastMemoryTrace({
      primaryCharacterId: primaryId,
      patchRows: traceRows,
    }).catch(() => {})
  }
  return applied
}

function normalizePatchFromSummaryJson(raw: unknown): WorldBookAfterPatch | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const worldBookId = String(o.worldBookId ?? o.world_book_id ?? '').trim()
  const itemId = String(o.itemId ?? o.item_id ?? '').trim()
  const newContent = String(o.newContent ?? o.new_content ?? '').trim()
  const characterId = String(o.characterId ?? o.character_id ?? '').trim() || undefined
  if (!worldBookId || !itemId || !newContent) return null
  return { characterId, worldBookId, itemId, newContent }
}

/** 从合并自动总结 JSON 根对象解析 epilogue_patches */
export function parseEpiloguePatchesFromSummaryJsonRoot(j: Record<string, unknown>): WorldBookAfterPatch[] {
  const raw = j.epilogue_patches ?? j.epiloguePatches
  if (!Array.isArray(raw)) return []
  const out: WorldBookAfterPatch[] = []
  for (const item of raw) {
    const p = normalizePatchFromSummaryJson(item)
    if (p) out.push(p)
  }
  return out
}

export function buildEpiloguePatchesSummaryJsonRule(): string {
  return `
- epilogue_patches（可选数组）：根据上述材料，若某角色「尾声延展」条目与剧情/对话已出现**可持续**的关系态变化，输出替换条目；无变化则 [] 或省略。每项：
  { "character_id": string（除当前私聊对象外必填；当前对象可省略）, "world_book_id": string, "item_id": string, "new_content": string }
  world_book_id/item_id **只能**来自用户消息「尾声延展条目快照」；new_content 须 {{char}}/{{user}} 占位符，第三人称档案体；优先更新「对 {{user}} 的当前态度」。`.trim()
}

export function buildEpilogueSnapshotBlockForSummary(characters: Character[]): string {
  const body = formatEpilogueRowsForPrompt(characters)
  if (!body.trim()) return ''
  return `【尾声延展条目快照（epilogue_patches 仅可更新下列 id）】\n${body}`
}

/** 自动总结收尾：若 JSON 未带出 epilogue_patches 则跑专用编辑助手补救 */
export async function finalizeWorldBookAfterAutoSummaryPhase(params: {
  apiConfig: ApiConfig | null
  conversationKey: string
  character: Character | null
  epiloguePatchesApplied: number
  /** 用于补救请求的近期对话摘录 */
  recentTranscript: string
  /** 本轮总结 primary 或最新 AI 正文，供补救对照 */
  latestReplyHint: string
  /** 自动总结材料块（线上/线下/人脉） */
  summaryMaterialsBlock?: string
}): Promise<number> {
  const ch = params.character
  if (!ch?.id?.trim() || !hasChatAfterWorldBookItems(ch)) return 0

  if (params.epiloguePatchesApplied > 0) return params.epiloguePatchesApplied

  try {
    const patches = await requestWorldBookAfterSyncPatches({
      apiConfig: params.apiConfig,
      characters: [ch],
      recentTranscript: params.recentTranscript,
      latestReply: params.latestReplyHint,
      summaryMaterialsBlock: params.summaryMaterialsBlock,
    })
    if (!patches.length) return 0
    return await persistWorldBookAfterSyncPatches(
      patches.map((p) => ({ ...p, characterId: p.characterId?.trim() || ch.id })),
      { source: 'auto_summary' },
    )
  } catch {
    return 0
  }
}
