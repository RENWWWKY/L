import type { Character } from '../newFriendsPersona/types'
import { personaDb } from '../newFriendsPersona/idb'
import { loadDatingPlotsFromKv, type DatingPlotSnapshotItem } from '../unifiedMemoryAutoSummary'
import { DATING_AI_OFFLINE_UNSUMMARIZED_CHAR_CAP } from './types'
import {
  MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS,
  selectRecentDatingPlotsAiRoundWindow,
} from '../memory/memorySummaryRetention'
import {
  collectCharacterMentionSearchTokens,
  resolveOfflineDatingArchiveContext,
} from './offlineDatingArchiveResolve'
import { offlinePlotBodyRelevantToNpcForLinkedExcerpt } from './offlineDatingNpcSpeakerDetect'
import { datingPlotBodyForPromptInjection } from './plotCoT'
import { formatPlotPromptTimeBracket } from './plotStoryTimeLabel'
import { resolvePlotSystemRecordedAtMs } from '../wechatCrossChannelTimeline'
import { extractStoryCalendarFromPromptBracket } from './datingOnlineInjectScope'

function plotBodyForPrompt(p: DatingPlotSnapshotItem): string {
  return datingPlotBodyForPromptInjection(String(p.content || ''), p.type)
}

function formatPlotTraceDate(
  plot: DatingPlotSnapshotItem,
  storyCalendarFallback?: string | null,
): string {
  return formatPlotPromptTimeBracket(plot, { storyCalendarFallback, markSystemFallback: true })
    .replace(/^\[|\]$/g, '')
}

function clipSnippet(s: string, max: number) {
  const t = String(s || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}（…）`
}

function clipReferenceTail(raw: string, cap: number, label: string): string {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  if (t.length <= cap) return t
  const marker = `…【${label}：过长已保留末尾最近内容】\n`
  const budget = Math.max(0, cap - marker.length)
  return marker + t.slice(-budget)
}

export type OfflinePlotBuildOpts = {
  plots: DatingPlotSnapshotItem[]
  plotCursorMin: number
  borrowed?: boolean
  rootName?: string
  peerLabel?: string
  filterNpc?: (plot: DatingPlotSnapshotItem, body: string) => boolean
  maxChars: number
  /** 游标后 tail 再收窄为最近 N 轮 AI 剧情（含其间玩家输入） */
  retainAiRounds?: number
}

function filterPlotTail(opts: OfflinePlotBuildOpts): DatingPlotSnapshotItem[] {
  let tail = opts.plots
    .filter((p) => {
      const ts = typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : 1
      return ts > opts.plotCursorMin
    })
    .sort((a, b) => (a.timestamp ?? 1) - (b.timestamp ?? 1))

  if (opts.filterNpc) {
    const kept = new Set<number>()
    tail.forEach((p, i) => {
      const body = plotBodyForPrompt(p)
      if (body && opts.filterNpc!(p, body)) kept.add(i)
    })
    for (const i of [...kept]) {
      if (tail[i]?.type !== 'player') continue
      const next = i + 1
      if (tail[next]?.type === 'ai' && plotBodyForPrompt(tail[next]!)) kept.add(next)
    }
    tail = tail.filter((_, i) => kept.has(i))
  }
  const rounds = opts.retainAiRounds
  if (typeof rounds === 'number' && rounds > 0 && tail.length) {
    tail = selectRecentDatingPlotsAiRoundWindow(tail, rounds)
  }
  return tail
}

/** 游标后线下剧情：正文全文（去思维链）。 */
export function buildOfflinePlotsFullText(opts: OfflinePlotBuildOpts): string {
  const peerLabel = opts.peerLabel?.trim() || '对方'
  const rootName = opts.rootName?.trim() || '主角'
  const borrowed = opts.borrowed === true
  const tail = filterPlotTail(opts)
  const lines: string[] = []
  let lastStoryCalendar: string | null = null
  for (const p of tail) {
    const t = plotBodyForPrompt(p)
    if (!t) continue
    if (p.type === 'ai') {
      const story = formatPlotPromptTimeBracket(p, { markSystemFallback: false })
      lastStoryCalendar = story.replace(/^\[|\]$/g, '') || null
    }
    const timePrefix = formatPlotTraceDate(p, lastStoryCalendar)
    if (p.type === 'player') lines.push(`- [${timePrefix}] [线下・我] ${t}`)
    else if (borrowed) lines.push(`- [${timePrefix}] [线下・「${rootName}」] ${t}`)
    else lines.push(`- [${timePrefix}] [线下・${peerLabel}] ${t}`)
  }
  if (borrowed && !lines.length) {
    const hint =
      opts.filterNpc
        ? `（近期「${rootName}」的线下剧情中，未找到与你相关的节选；勿编造你亲口说过的细节。）`
        : `（当前人设缺少可用于检索的名字/昵称，未对「${rootName}」线下剧情做片段过滤。）`
    lines.push(hint)
  }
  return clipReferenceTail(lines.join('\n'), opts.maxChars, '最近线下剧情')
}

/** 游标已覆盖的线下剧情正文（供语义召回索引；非线下摘要表 rowText） */
export async function listSummarizedOfflinePlotContextLines(
  characterId: string | null | undefined,
  opts?: { peerDisplayName?: string | null; maxPlots?: number },
): Promise<Array<{ line: string; timestamp: number; plotId: string }>> {
  const cid = characterId?.trim()
  if (!cid) return []
  try {
    const ctx = await resolveOfflineDatingArchiveContext(cid)
    if (!ctx) return []
    const plotCursor = await personaDb.getDatingPlotSummaryCursor(ctx.archiveCharacterId)
    if (plotCursor == null || !Number.isFinite(plotCursor)) return []
    const plots = await loadDatingPlotsFromKv(ctx.archiveCharacterId)
    const maxPlots = Math.max(1, Math.min(80, Math.floor(opts?.maxPlots ?? 48)))
    const borrowed = ctx.perspectiveCharacterId !== ctx.archiveCharacterId
    const peerLabel = opts?.peerDisplayName?.trim() || (ctx.perspective?.name ?? '').trim() || '对方'
    const rootName = (ctx.archiveOwner?.name ?? '').trim() || '主角'
    const summarized = plots
      .filter((p) => {
        const ts = typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : 0
        return ts > 0 && ts <= plotCursor
      })
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      .slice(-maxPlots)

    const out: Array<{ line: string; timestamp: number; plotId: string }> = []
    for (const p of summarized) {
      if (p.type === 'player') continue
      const body = plotBodyForPrompt(p)
      if (!body || body.length < 16) continue
      const ts = resolvePlotSystemRecordedAtMs(p)
      const timePrefix = formatPlotPromptTimeBracket(p, { markSystemFallback: true }).replace(/^\[|\]$/g, '')
      const line = borrowed
        ? `- [${timePrefix}] [线下·原文·「${rootName}」] ${body}`
        : `- [${timePrefix}] [线下·原文·${peerLabel}] ${body}`
      const plotId = p.id?.trim() || `plot-${ts}`
      out.push({ line, timestamp: ts, plotId })
    }
    return out
  } catch {
    return []
  }
}

function filterPlotsForNpcBorrowedArchive(
  tail: DatingPlotSnapshotItem[],
  perspective: Character | null,
): DatingPlotSnapshotItem[] {
  const tokens = collectCharacterMentionSearchTokens(perspective)
  if (!tokens.length) return tail
  const keptIdx = new Set<number>()
  tail.forEach((p, i) => {
    const body = plotBodyForPrompt(p)
    if (!body) return
    if (offlinePlotBodyRelevantToNpcForLinkedExcerpt(body, perspective, tokens)) keptIdx.add(i)
  })
  for (const i of [...keptIdx]) {
    if (tail[i]?.type !== 'player') continue
    const next = i + 1
    const ai = tail[next]
    if (ai?.type === 'ai' && plotBodyForPrompt(ai)) keptIdx.add(next)
  }
  return tail.filter((_, i) => keptIdx.has(i))
}

/** 游标后线下剧情：带时间戳的正文摘录（供思维溯源） */
export async function listUnsummarizedOfflinePlotTraceItems(
  characterId: string | null | undefined,
  peerDisplayName?: string | null,
  opts?: {
    maxItems?: number
    snippetChars?: number
    /** 不作条内字数截断（思维溯源完整展示） */
    fullSnippet?: boolean
    /** 与 prompt 注入一致：最近 N 轮 AI 剧情窗口 */
    retainAiRounds?: number
    /** 思维溯源：仅展示 AI 剧情条，不含玩家输入 */
    aiOnly?: boolean
    /** 为 true 时忽略 plot 总结游标，取全档最近 N 轮（线上固定注入） */
    ignorePlotSummaryCursor?: boolean
  },
): Promise<Array<{ date: string; snippet: string }>> {
  const cid = characterId?.trim()
  if (!cid) return []
  const maxItems = Math.max(1, Math.min(2000, opts?.maxItems ?? 16))
  const snippetChars = Math.max(80, Math.min(2000, opts?.snippetChars ?? 420))
  const retainAiRounds = opts?.retainAiRounds ?? MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS
  const aiOnly = opts?.aiOnly === true
  try {
    const ctx = await resolveOfflineDatingArchiveContext(cid)
    if (!ctx) return []
    const plotCursor = opts?.ignorePlotSummaryCursor
      ? -1
      : ((await personaDb.getDatingPlotSummaryCursor(ctx.archiveCharacterId)) ?? 0)
    const dMin = plotCursor
    const plots = await loadDatingPlotsFromKv(ctx.archiveCharacterId)
    let tail = plots
      .filter((p) => {
        const ts = typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : 1
        return ts > dMin
      })
      .sort((a, b) => (a.timestamp ?? 1) - (b.timestamp ?? 1))

    const borrowed = ctx.perspectiveCharacterId !== ctx.archiveCharacterId
    if (borrowed) {
      tail = filterPlotsForNpcBorrowedArchive(tail, ctx.perspective)
    }
    if (tail.length && retainAiRounds > 0) {
      tail = selectRecentDatingPlotsAiRoundWindow(tail, retainAiRounds)
    }
    if (aiOnly) {
      tail = tail.filter((p) => p.type === 'ai')
    }
    tail = tail.slice(-maxItems)

    const rootName = (ctx.archiveOwner?.name ?? '').trim() || '主角'
    const peerLabel = peerDisplayName?.trim() || (ctx.perspective?.name ?? '').trim() || '对方'
    const out: Array<{ date: string; snippet: string }> = []
    let lastStoryCalendar: string | null = null
    for (const p of tail) {
      const body = plotBodyForPrompt(p)
      if (!body) continue
      if (p.type === 'ai') {
        const story = formatPlotPromptTimeBracket(p, { markSystemFallback: false })
        lastStoryCalendar = story.replace(/^\[|\]$/g, '') || null
      }
      let role: string
      if (p.type === 'player') {
        role = '我'
      } else if (borrowed) {
        role = `「${rootName}」（线下剧情）`
      } else {
        role = peerLabel
      }
      const line = `${role}：${body}`
      out.push({
        date: formatPlotTraceDate(p, lastStoryCalendar),
        snippet: opts?.fullSnippet ? line : clipSnippet(line, snippetChars),
      })
    }
    return out
  } catch {
    return []
  }
}

/**
 * plot 游标之后、尚未写入长期记忆的材料；
 * 默认仅保留最近 {@link MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS} 轮 AI 剧情（含其间玩家输入）。
 */
export async function buildUnsummarizedOfflineDatingText(
  characterId: string | null | undefined,
  peerDisplayName?: string | null,
): Promise<string> {
  const cid = characterId?.trim()
  if (!cid) return ''
  try {
    const ctx = await resolveOfflineDatingArchiveContext(cid)
    if (!ctx) return ''
    const plotCursor = await personaDb.getDatingPlotSummaryCursor(ctx.archiveCharacterId)
    const dMin = plotCursor ?? 0
    const plots = await loadDatingPlotsFromKv(ctx.archiveCharacterId)
    const borrowed = ctx.perspectiveCharacterId !== ctx.archiveCharacterId
    const tokens = borrowed ? collectCharacterMentionSearchTokens(ctx.perspective) : []
    const peerLabel = peerDisplayName?.trim() || (ctx.perspective?.name ?? '').trim() || '对方'
    return buildOfflinePlotsFullText({
      plots,
      plotCursorMin: dMin,
      borrowed,
      rootName: (ctx.archiveOwner?.name ?? '').trim() || '主角',
      peerLabel,
      filterNpc:
        borrowed && tokens.length
          ? (_plot, body) =>
              offlinePlotBodyRelevantToNpcForLinkedExcerpt(body, ctx.perspective, tokens)
          : undefined,
      maxChars: DATING_AI_OFFLINE_UNSUMMARIZED_CHAR_CAP,
      retainAiRounds: MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS,
    })
  } catch {
    return ''
  }
}

/**
 * 线上私聊固定注入：最近 N 轮线下 AI 剧情正文（含其间玩家输入）。
 * 不依赖 plot 总结游标——线下每轮已自动写摘要，游标后常为空；仍须全文承接近端线下事实。
 */
export async function buildRecentOfflinePlotInjectBody(
  characterId: string | null | undefined,
  peerDisplayName?: string | null,
  retainAiRounds: number = MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS,
): Promise<string> {
  const cid = characterId?.trim()
  if (!cid) return ''
  const rounds = Math.max(1, Math.min(8, Math.floor(retainAiRounds)))
  try {
    const ctx = await resolveOfflineDatingArchiveContext(cid)
    if (!ctx) return ''
    const plots = await loadDatingPlotsFromKv(ctx.archiveCharacterId)
    if (!plots.length) return ''
    const borrowed = ctx.perspectiveCharacterId !== ctx.archiveCharacterId
    const tokens = borrowed ? collectCharacterMentionSearchTokens(ctx.perspective) : []
    const peerLabel = peerDisplayName?.trim() || (ctx.perspective?.name ?? '').trim() || '对方'
    return buildOfflinePlotsFullText({
      plots,
      plotCursorMin: -1,
      borrowed,
      rootName: (ctx.archiveOwner?.name ?? '').trim() || '主角',
      peerLabel,
      filterNpc:
        borrowed && tokens.length
          ? (_plot, body) =>
              offlinePlotBodyRelevantToNpcForLinkedExcerpt(body, ctx.perspective, tokens)
          : undefined,
      maxChars: DATING_AI_OFFLINE_UNSUMMARIZED_CHAR_CAP,
      retainAiRounds: rounds,
    })
  } catch {
    return ''
  }
}

/**
 * @deprecated 请用 {@link buildRecentOfflinePlotInjectBody}；保留给约会页「游标后」材料拼装。
 */
export async function buildLatestOfflinePlotContinuityBody(
  characterId: string | null | undefined,
  peerDisplayName?: string | null,
): Promise<string> {
  return buildRecentOfflinePlotInjectBody(characterId, peerDisplayName, 1)
}

/** 仅从给定快照拼接游标后线下剧情正文（不从 KV 再读全档）。 */
export async function formatOfflineUnsummarizedBlockFromPlotSnapshots(
  plots: DatingPlotSnapshotItem[],
  peerDisplayName: string | null | undefined,
  maxChars?: number,
): Promise<string> {
  const cap = maxChars ?? DATING_AI_OFFLINE_UNSUMMARIZED_CHAR_CAP
  const peerLabel = peerDisplayName?.trim() || '对方'
  return buildOfflinePlotsFullText({
    plots,
    plotCursorMin: -1,
    peerLabel,
    maxChars: cap,
    retainAiRounds: MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS,
  })
}

/** 取线下摘录正文里最新一条 AI 剧情行，供线上承接空间/在场锚点。 */
export function extractLatestOfflinePlotSpatialAnchor(body: string): string {
  const lines = String(body ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- ['))
  if (!lines.length) return ''
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    if (line.includes('[线下・我]')) continue
    return line.length > 520 ? `…${line.slice(-520)}` : line
  }
  const last = lines[lines.length - 1]!
  return last.length > 520 ? `…${last.slice(-520)}` : last
}

/** 微信私聊：线下末尾空间事实优先于尾声/旧记忆，防「门外守着」却写「怀里」。 */
export function buildOnlineOfflineSpatialContinuityAppendix(
  body: string,
  characterDisplayName?: string | null,
): string {
  const trimmed = String(body ?? '').trim()
  if (!trimmed) return ''
  const peer = characterDisplayName?.trim() || '对方'
  const tail = extractLatestOfflinePlotSpatialAnchor(trimmed)
  const storyFromTail = tail ? extractStoryCalendarFromPromptBracket(tail) : null
  const lines = [
    `【线下→线上·空间状态铁律（最高优先级）】`,
    ...(storyFromTail
      ? [
          `- **故事内时刻（线下末条）**：摘录末条故事时间为 **${storyFromTail}**（空间/在场以该条为准）。`,
          `- **若【剧情时间轴·当前状态】锚点已晚于该末条**（用户在线上时间设置中往后推过）：线上「现在」以剧情轴当前锚点为准，**禁止**强行拉回末条那一夜；空间仍承接末条分离/同场事实，时段按推进后的锚点理解。`,
          `- **若剧情轴当前锚点未推进、仍与末条同时段**：线上按 **${storyFromTail}** 同一夜/同一时段理解；**禁止**用设备落库钟点（如上午 10:20）误判为剧情清晨或另一天。`,
        ]
      : []),
    `- 微信线上 = **远程用手机发消息**；须承接上方「最近线下剧情」**最后一条 AI 剧情**所写的**当场空间事实**：谁在场、是否同室、门内外、睡/醒、有无肢体接触。`,
    `- **禁止**用更早条目、【尾声延展】或长期记忆里旧的「同场/怀里/同床」描写，覆盖末尾已写明的**分离状态**（例如末尾已写 ${peer} 出门/在门外守/离开房间/各自在不同空间，则禁止气泡写「你缩在我怀里」「抱着你」「同床」「面对面」等同场肢体接触）。`,
    `- 【尾声延展】条目约束**态度、称呼、好感档位**，**不约束**物理空间；二者冲突时以**线下末尾最新 AI 条**的空间事实为准。`,
    `- 若【剧情时间轴·当前状态】锚点**晚于**线下末条（如末条 08:00 已分别、轴指 10:00）：须按**已推进后的时段**理解（对方已起床/在路上/到机场等），**禁止**仍按分手前作息反问「起这么早 / 不是睡到中午吗 / 昨晚拍戏」；语义召回/长期记忆里**早于末条**的作息或事件不得覆盖末条事实。`,
    `- 用户当轮发来微信，默认表示 ${peer} **不在同一物理接触距离内**打字；可写符合分离事实的反应，勿写成贴身耳语体。`,
  ]
  if (tail) {
    lines.push('', `【最新线下末尾锚点（空间/在场以本条为准）】`, tail)
  }
  return lines.join('\n')
}

/** 微信与其它线上 completion：固定注入最近 N 轮线下剧情正文（与线下每轮摘要并存，不依赖游标空窗）。 */
export async function loadOfflineDatingPlotsPromptBlock(
  characterId: string | null | undefined,
  characterDisplayName?: string | null,
): Promise<string> {
  const cid = characterId?.trim()
  const rounds = MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS
  const body = await buildRecentOfflinePlotInjectBody(cid, characterDisplayName, rounds)
  if (!body.trim()) return ''

  const ctx = cid ? await resolveOfflineDatingArchiveContext(cid) : null
  const borrowed = !!(ctx && ctx.perspectiveCharacterId !== ctx.archiveCharacterId)

  const timeHint =
    '每条前缀优先为**故事内公历时刻**（来自该条 timeline 锚点）；无锚点时方显示 `[…·落库]` 系统落库时刻（真实生成钟点，**不是**故事内时间）'
  const header = borrowed
    ? `【最近线下剧情（关联主角·固定最近 ${rounds} 轮 AI）】` +
      `你与「${(ctx?.archiveOwner?.name ?? '').trim() || '主角'}」同属一条时间线；下列为约会页**时间/落库最新**的 ${rounds} 轮 AI 剧情及其间玩家输入（${timeHint}）。线下每轮通常已写入摘要，本块仍须全文承接；更早段由【剧情时间轴】/长期记忆/语义召回补全。`
    : `【最近线下剧情（固定最近 ${rounds} 轮 AI）】` +
      `与当前会话为**同一角色、同一时间线**；下列为约会页**时间/落库最新**的 ${rounds} 轮 AI 剧情及其间玩家输入（${timeHint}）。线下每轮通常已写入摘要，本块仍须全文承接近端事实；更早段由【剧情时间轴】/长期记忆/语义召回补全；**禁止**明显矛盾或假装未发生末条事件。`

  const spatialRule = buildOnlineOfflineSpatialContinuityAppendix(body, characterDisplayName)
  return `${header}\n\n${body}\n\n---\n${spatialRule}`
}

/** 模型注入块里的「最近线下剧情 / 尚未总结·线下」说明段（单行，后接空行再是正文）。 */
const OFFLINE_PLOT_INJECT_HEADER_RE =
  /【(?:最近线下剧情[^】]*|最新线下剧情·承接锚点[^】]*|尚未总结·(?:关联主角线下剧情（节选）|线下剧情（约会页 plot 总结游标之后）))】[^\n]*\n\n/g

/** 思维溯源 ACTIVE CONTEXT：与 prompt 注入同源，最近 N 轮 AI 线下剧情（仅 AI 条）。 */
export async function listInjectedOfflinePlotTraceRowsForMemoryTrace(
  characterId: string | null | undefined,
  peerDisplayName?: string | null,
): Promise<Array<{ date: string; snippet: string }>> {
  return listUnsummarizedOfflinePlotTraceItems(characterId, peerDisplayName, {
    retainAiRounds: MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS,
    /** 与线上固定注入一致：忽略总结游标，取全档最近 N 轮 */
    ignorePlotSummaryCursor: true,
    aiOnly: true,
    maxItems: MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS,
    fullSnippet: true,
  })
}

/** 思维溯源：展示已注入 prompt 的线下剧情正文（fallback：整段注入块）。 */
export function buildOfflinePlotTraceRowsFromInjectedContext(
  injectedContext: string | undefined | null,
): Array<{ date: string; snippet: string }> {
  const plain = stripOfflineDatingPlotsInjectHeaderForTraceDisplay(String(injectedContext ?? ''))
  if (!plain) return []
  return [{ date: '—', snippet: plain }]
}

/** 思维溯源 / UI：去掉仅注入模型用的前言，只保留正文摘录。 */
export function stripOfflineDatingPlotsInjectHeaderForTraceDisplay(text: string): string {
  let s = String(text ?? '').trim()
  if (!s) return ''

  s = s.replace(OFFLINE_PLOT_INJECT_HEADER_RE, '').trim()
  s = s.replace(/…【(?:最近线下剧情|尚未总结·线下剧情)[^】]*】\n?/g, '').trim()
  s = s
    .replace(/（近期「[^」]+」的线下剧情中，未找到[^\n]+）\n?/g, '')
    .replace(/（当前人设缺少可用于检索[^\n]+）\n?/g, '')
    .trim()

  return s
}
