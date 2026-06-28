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
import { splitDatingAssistantOutput } from './plotCoT'
import { extractVnVoiceParamsBlock } from './vnVoiceParamsStrip'
import { formatSystemRecordTime, resolvePlotSystemRecordedAtMs } from '../wechatCrossChannelTimeline'

function plotBodyForPrompt(p: DatingPlotSnapshotItem): string {
  const raw = String(p.content || '').trim()
  if (!raw) return ''
  if (p.type === 'player') return raw
  const prose = splitDatingAssistantOutput(raw).content.trim()
  return extractVnVoiceParamsBlock(prose).cleanedText.trim()
}

function formatPlotTraceDate(ts: number): string {
  return formatSystemRecordTime(ts)
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
  for (const p of tail) {
    const t = plotBodyForPrompt(p)
    if (!t) continue
    const ts = resolvePlotSystemRecordedAtMs(p)
    const timePrefix = formatPlotTraceDate(ts)
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
  return clipReferenceTail(lines.join('\n'), opts.maxChars, '尚未总结·线下剧情')
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
    const plotCursor = await personaDb.getDatingPlotSummaryCursor(ctx.archiveCharacterId)
    const dMin = plotCursor ?? 0
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
    for (const p of tail) {
      const body = plotBodyForPrompt(p)
      if (!body) continue
      const ts = resolvePlotSystemRecordedAtMs(p)
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
        date: formatPlotTraceDate(ts),
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

/** 微信与其它线上 completion：注入游标后线下剧情正文。 */
export async function loadOfflineDatingPlotsPromptBlock(
  characterId: string | null | undefined,
  characterDisplayName?: string | null,
): Promise<string> {
  const cid = characterId?.trim()
  const body = await buildUnsummarizedOfflineDatingText(cid, characterDisplayName)
  if (!body.trim()) return ''

  const ctx = cid ? await resolveOfflineDatingArchiveContext(cid) : null
  const borrowed = !!(ctx && ctx.perspectiveCharacterId !== ctx.archiveCharacterId)

  const rounds = MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS
  const header = borrowed
    ? `【尚未总结·关联主角线下剧情（节选）】` +
      `你与「${(ctx?.archiveOwner?.name ?? '').trim() || '主角'}」同属一条时间线；下列为游标后**最近 ${rounds} 轮 AI 剧情**及其间玩家输入；**每条前缀 \`[YYYY年M月D日 星期X HH:mm]\` 为系统落库时刻**（真实生成钟点，**不是**故事内剧情时间；更早段由【剧情时间轴】/长期记忆/语义召回承接）。`
    : `【尚未总结·线下剧情（约会页 plot 总结游标之后）】` +
      `与当前会话为**同一角色、同一时间线**；下列为游标后**最近 ${rounds} 轮 AI 剧情**及其间玩家输入；**每条前缀 \`[YYYY年M月D日 星期X HH:mm]\` 为系统落库时刻**（真实生成钟点，**不是**故事内剧情时间；更早段由【剧情时间轴】/长期记忆/语义召回承接），须自然衔接、**禁止**明显矛盾。`

  return `${header}\n\n${body}`
}

/** 模型注入块里的「尚未总结·线下剧情」说明段（单行，后接空行再是正文）。 */
const OFFLINE_PLOT_INJECT_HEADER_RE =
  /【尚未总结·(?:关联主角线下剧情（节选）|线下剧情（约会页 plot 总结游标之后）)】[^\n]*\n\n/g

/** 思维溯源 ACTIVE CONTEXT：与 prompt 注入同源，最近 N 轮 AI 线下剧情（仅 AI 条）。 */
export async function listInjectedOfflinePlotTraceRowsForMemoryTrace(
  characterId: string | null | undefined,
  peerDisplayName?: string | null,
): Promise<Array<{ date: string; snippet: string }>> {
  return listUnsummarizedOfflinePlotTraceItems(characterId, peerDisplayName, {
    retainAiRounds: MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS,
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
  s = s.replace(/…【尚未总结·线下剧情[^】]*】\n?/g, '').trim()
  s = s
    .replace(/（近期「[^」]+」的线下剧情中，未找到[^\n]+）\n?/g, '')
    .replace(/（当前人设缺少可用于检索[^\n]+）\n?/g, '')
    .trim()

  return s
}
