import type { ApiConfig } from '../../api/types'
import { resolvePlotStoryCalendarLabel } from '../dating/plotStoryTimeLabel'
import { openAiCompatibleChat } from '../newFriendsPersona/ai'
import { personaDb } from '../newFriendsPersona/idb'
import { loadDatingPlotsFromKv } from '../unifiedMemoryAutoSummary'
import { resolveMessageSystemRecordedAtMs, resolvePlotSystemRecordedAtMs } from '../wechatCrossChannelTimeline'
import { splitDatingAiResponseAndUnifiedMemoryJson } from '../wechatChatAi'
import { resolveTimelineSummaryApiConfig } from './memoryTimelineSummaryApi'
import {
  createEmptyStoryTimelineState,
  parseStoryCalendarDayStartMs,
  stripStoryTimelineTodoSectionsFromText,
  type StoryTimelineState,
  type StoryTimelineTodoEntry,
} from './storyTimelineTypes'

const MODEL_REPLY_CAP = 2
const REPLY_BODY_CHAR_CAP = 2200
const CANDIDATE_SCAN_CAP = 48

type RecentModelReply = {
  channel: 'offline' | 'online'
  storyLabel: string
  storySortMs: number
  recordedAtMs: number
  body: string
  eventSummary?: string
}

function clipBlock(raw: string, cap: number): string {
  const t = String(raw ?? '').trim()
  if (t.length <= cap) return t
  return `…${t.slice(-(cap - 1))}`
}

function clockMinutesFromText(raw: string | undefined): number {
  const m = String(raw ?? '').match(/(\d{1,2}):(\d{2})/)
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2])
}

/** 剧情时间点排序键；无剧情锚点时回退系统落库时刻 */
function storyPointSortMs(params: {
  storyDay?: string | null
  storyTime?: string | null
  storyTimeLabel?: string | null
  fallbackMs: number
}): { sortMs: number; storyLabel: string; hasStoryAnchor: boolean } {
  const label = String(params.storyTimeLabel ?? '').trim()
  const dayFromLabel = label.match(/(\d{4}年\d{1,2}月\d{1,2}日)/)?.[1] ?? ''
  const day = String(params.storyDay ?? '').trim() || dayFromLabel
  const dayMs = day ? parseStoryCalendarDayStartMs(day) : null
  if (dayMs == null) {
    return {
      sortMs: params.fallbackMs,
      storyLabel: label || '（无剧情锚点·按落库）',
      hasStoryAnchor: false,
    }
  }
  const mins = clockMinutesFromText(params.storyTime || label)
  const sortMs = dayMs + mins * 60_000
  const clock = mins
    ? `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
    : ''
  const storyLabel = label || (clock ? `${day} ${clock}` : day)
  return { sortMs, storyLabel, hasStoryAnchor: true }
}

function stripAiPlotBody(raw: string): string {
  const { plotRaw } = splitDatingAiResponseAndUnifiedMemoryJson(String(raw ?? ''))
  return String(plotRaw ?? raw ?? '').trim()
}

/** 采集剧情时间点最近的 2 轮模型回复（线下 AI 剧情 ∪ 线上角色回复） */
export async function gatherMaterialsForTodoLedgerRebuild(characterId: string): Promise<{
  recentBlock: string
  materialChars: number
  replyCount: number
}> {
  const cid = characterId.trim()
  const candidates: RecentModelReply[] = []

  try {
    const plots = await loadDatingPlotsFromKv(cid)
    const aiPlots = plots.filter((p) => p.type === 'ai')
    const slice = aiPlots.slice(-CANDIDATE_SCAN_CAP)
    for (const p of slice) {
      const body = clipBlock(stripAiPlotBody(String(p.content ?? '')), REPLY_BODY_CHAR_CAP)
      if (!body) continue
      const recordedAtMs = resolvePlotSystemRecordedAtMs(p)
      const cal = resolvePlotStoryCalendarLabel(p)
      const delta = p.timelineDelta
      const point = storyPointSortMs({
        storyDay: delta?.story_day_end || delta?.story_day || null,
        storyTime: delta?.story_time_end || delta?.story_time || null,
        storyTimeLabel: cal,
        fallbackMs: recordedAtMs,
      })
      const eventSummary = String(delta?.event_summary ?? '').trim() || undefined
      candidates.push({
        channel: 'offline',
        storyLabel: point.storyLabel,
        storySortMs: point.sortMs,
        recordedAtMs,
        body,
        ...(eventSummary ? { eventSummary } : {}),
      })
    }
  } catch {
    /* ignore */
  }

  try {
    const chatRows = await personaDb.listWeChatChatMessagesRecentByCharacter({
      characterId: cid,
      limit: CANDIDATE_SCAN_CAP,
    })
    for (const m of chatRows) {
      if (m.type !== 'character') continue
      const body = clipBlock(String(m.content ?? ''), REPLY_BODY_CHAR_CAP)
      if (!body) continue
      const recordedAtMs = resolveMessageSystemRecordedAtMs(m)
      const point = storyPointSortMs({
        storyDay: m.storyDay,
        storyTime: m.storyTime,
        storyTimeLabel: m.storyTimeLabel,
        fallbackMs: recordedAtMs,
      })
      candidates.push({
        channel: 'online',
        storyLabel: point.storyLabel,
        storySortMs: point.sortMs,
        recordedAtMs,
        body,
      })
    }
  } catch {
    /* ignore */
  }

  candidates.sort((a, b) => {
    if (b.storySortMs !== a.storySortMs) return b.storySortMs - a.storySortMs
    return b.recordedAtMs - a.recordedAtMs
  })

  const picked = candidates.slice(0, MODEL_REPLY_CAP)
  const parts = picked.map((row, i) => {
    const ch = row.channel === 'offline' ? '线下' : '线上'
    const lines = [
      `${i + 1}. [${ch}·剧情时间 ${row.storyLabel}]`,
      row.eventSummary ? `本轮事件：${row.eventSummary}` : '',
      '模型回复：',
      row.body,
    ].filter(Boolean)
    return lines.join('\n')
  })

  const recentBlock = parts.join('\n\n')
  return {
    recentBlock,
    materialChars: recentBlock.length,
    replyCount: picked.length,
  }
}

function stripJsonFence(raw: string): string {
  const t = raw.trim()
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return m ? m[1].trim() : t
}

function parseTodoLedgerModelOutput(raw: string): StoryTimelineTodoEntry[] {
  let jsonBody = stripJsonFence(raw)
  const start = jsonBody.indexOf('{')
  const end = jsonBody.lastIndexOf('}')
  if (start >= 0 && end > start) jsonBody = jsonBody.slice(start, end + 1)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonBody)
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== 'object') return []
  const todosRaw = (parsed as { todos?: unknown }).todos
  if (!Array.isArray(todosRaw)) return []
  const out: StoryTimelineTodoEntry[] = []
  const seen = new Set<string>()
  for (const row of todosRaw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const text = String(o.text ?? o.content ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160)
    if (!text || text.length < 4) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ text, status: 'open' })
    if (out.length >= 16) break
  }
  return out
}

/** 仅清空待办台账（含已完成），不改摘要行；并剔除手动锚点里残留的【待办】段 */
export async function clearStoryTimelineTodoLedger(characterId: string): Promise<number> {
  const cid = characterId.trim()
  if (!cid) return 0
  const prev = (await personaDb.getStoryTimelineState(cid)) ?? createEmptyStoryTimelineState(cid)
  const n = prev.todos?.length ?? 0
  const manual = prev.manualAnchorBlock?.trim() || ''
  const cleanedManual = manual ? stripStoryTimelineTodoSectionsFromText(manual) : ''
  const manualChanged = cleanedManual !== manual
  if (n === 0 && !manualChanged) return 0
  await personaDb.putStoryTimelineState({
    ...prev,
    characterId: cid,
    todos: [],
    ...(manual
      ? cleanedManual
        ? { manualAnchorBlock: cleanedManual.slice(0, 8000) }
        : { manualAnchorBlock: undefined }
      : {}),
    updatedAt: Date.now(),
  })
  return Math.max(n, manualChanged ? 1 : 0)
}

/**
 * 清空当前待办台账，按剧情时间最近 2 轮模型回复（线上或线下）重新生成未完待办。
 */
export async function rebuildStoryTimelineTodoLedgerFromRecentContext(params: {
  apiConfig: ApiConfig | null
  characterId: string
  displayName?: string
}): Promise<
  | { status: 'applied'; openCount: number; replyCount: number }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }
> {
  const cid = params.characterId.trim()
  if (!cid) return { status: 'failed', reason: '无效角色' }

  const cfg = await resolveTimelineSummaryApiConfig(params.apiConfig)
  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim() || !cfg?.modelId?.trim()) {
    return { status: 'failed', reason: '未配置剧情摘要 / 聊天 API（记忆设置）' }
  }

  const { recentBlock, materialChars, replyCount } = await gatherMaterialsForTodoLedgerRebuild(cid)
  if (materialChars < 12 || replyCount < 1) {
    return { status: 'skipped', reason: '暂无足够的模型回复可参考（需有剧情时间可排的线上/线下回复）' }
  }

  const prev = (await personaDb.getStoryTimelineState(cid)) ?? createEmptyStoryTimelineState(cid)
  const storyDay = prev.currentStoryDay?.trim() || ''

  const system = `
你是「待办台账」整理助手。根据用户提供的、按剧情时间最近的模型回复，整理**此刻仍未完成、且仍须处理**的具体事项。
规则：
- 材料已按剧情时间从近到远排列；以最近一轮为准，已做完、已取消、已过期无后续的不要写入。
- 只写可核对的具体事项（作业、赴约、回复、提交、提醒等），不要写动机/心情伏笔。
- 若有「本轮事件」字段，须优先对照；材料不足则 todos 为 []。
- 指角色用 {{char}}，指玩家用 {{user}}；第三人称短句。
- 只输出 JSON，禁止 markdown 围栏与解释：
{"todos":[{"text":"……"}]}
`.trim()

  const userContent = [
    storyDay ? `【当前剧情日】${storyDay}` : '',
    `【近况材料·剧情时间最近 ${replyCount} 轮模型回复（线上或线下）】`,
    recentBlock,
    '',
    '请输出当前仍有效的未完待办 JSON。',
  ]
    .filter(Boolean)
    .join('\n')

  let raw: string
  try {
    raw = await openAiCompatibleChat(cfg, [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ])
  } catch (e) {
    const msg = e instanceof Error && e.message.trim() ? e.message.trim() : '请求失败'
    return { status: 'failed', reason: msg }
  }

  const openTodos = parseTodoLedgerModelOutput(raw).map((t) => ({
    ...t,
    ...(storyDay ? { openedStoryDay: storyDay } : {}),
  }))

  const next: StoryTimelineState = {
    ...prev,
    characterId: cid,
    todos: openTodos,
    updatedAt: Date.now(),
  }
  await personaDb.putStoryTimelineState(next)
  return { status: 'applied', openCount: openTodos.length, replyCount }
}
