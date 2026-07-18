/** 剧情时间轴：按角色 id 持久化（微信私聊对象 / 线下约会视角人设） */

import type { MemoryEmbeddingProviderKind } from './memoryEmbeddingProvider'

export type StoryTimelineEventScope = 'private' | 'offline' | 'meet' | 'group' | 'linked'

export type StoryTimelineCostumeEntry = {
  character: string
  outfit: string
}

export type StoryTimelineItemTier = 'normal' | 'important' | 'critical'

export type StoryTimelineItemEntry = {
  name: string
  note?: string
  tier?: StoryTimelineItemTier
}

export type StoryTimelineOpenAnchorEntry = {
  text: string
  status: 'open' | 'resolved'
}

/** 人物动机 / 关系悬念 / 未兑现伏笔（非具体待办） */
export type StoryTimelineForeshadowEntry = StoryTimelineOpenAnchorEntry

/** 待办收束结果：已做 / 逾期未做 / 取消 */
export type StoryTimelineTodoOutcome = 'done' | 'missed' | 'cancelled'

/** 具体可执行待办 / 承诺 / 日程（resolved 保留在「已完成事项」而非删除） */
export type StoryTimelineTodoEntry = {
  text: string
  status: 'open' | 'resolved'
  /** 首次记为 open 时的剧情公历日，用于「明天/次日」等相对期限 */
  openedStoryDay?: string
  outcome?: StoryTimelineTodoOutcome
  /** 结论文案，如「{{char}} 并没有在次日喝水」 */
  resolvedNote?: string
  resolvedAtStoryDay?: string
}

export type StoryTimelineEventEntry = {
  id: string
  storyDay?: string
  storyTime?: string
  relativeTime?: string
  location?: string
  charactersPresent?: string[]
  eventSummary: string
  sourceScope?: StoryTimelineEventScope
  recordedAt: number
}

/** IndexedDB `storyTimelineState` 行 */
export type StoryTimelineState = {
  characterId: string
  updatedAt: number
  currentStoryDay?: string
  currentStoryTime?: string
  currentLocation?: string
  charactersPresent?: string[]
  costumes: StoryTimelineCostumeEntry[]
  items: StoryTimelineItemEntry[]
  foreshadows: StoryTimelineForeshadowEntry[]
  todos: StoryTimelineTodoEntry[]
  recentEvents: StoryTimelineEventEntry[]
  /** 手动编辑的状态锚点全文；有值时覆盖结构化字段的 prompt / 展示格式化 */
  manualAnchorBlock?: string
}

/** IndexedDB `storyTimelineRows`：每轮 append 的剧情摘要行（Horae 式行表，带向量） */
export type StoryTimelinePlotRow = {
  id: string
  characterId: string
  recordedAt: number
  sourceScope: StoryTimelineEventScope
  /** 约会 AI plot id / 私聊轮次键（可选） */
  plotId?: string
  /** 短标题（约 10 字内），列表展示用；正文亦写入【摘要标题】行 */
  rowTitle?: string
  /** 摘要检索关键词（3～5 个，每条 ≤5 字）；向量索引与标题一并使用 */
  rowKeywords?: string[]
  /** 本轮可读摘要（与 UI timelineSnapshot 同源） */
  rowText: string
  textHash: string
  /** 向量索引用摘要标题（与 rowText 分离；embeddingHash 对应此文本） */
  embedding?: number[]
  embeddingProvider?: MemoryEmbeddingProviderKind
  embeddingModelId?: string
  embeddingHash?: string
  /** 侧幕视角：主角色（{{char}}）未在场；注入给主角色时须非全知 redact */
  sidePerspective?: boolean
  /** 本轮在场角色占位符快照（与 summary JSON characters_present 同源） */
  charactersPresent?: string[]
  /**
   * 用户在档案馆手动改过正文/标题。
   * 为 true 时，`rebuildStoryTimelineFromDatingPlots` 不得用 plot.timelineDelta 盖回旧摘要。
   */
  userEdited?: boolean
}

export type StoryTimelinePromptLoadOpts = {
  relevanceText?: string
  /** 向量 query 焦点（用户输入 + 近期剧情尾段）；避免被 hay 中段 bulk 挤掉当前聊题 */
  recallQueryFocus?: string
  /** 向量 query：仅用户当轮输入（独立切片，避免被 plotTail 稀释） */
  recallQueryUserText?: string
  apiConfig?: Pick<import('../../api/types').ApiConfig, 'apiUrl' | 'apiKey'> | null
  /** 私聊/群聊总结游标键；用于排除游标后行进入「已总结片段」向量召回 */
  conversationKey?: string | null
  /** 上一回合故事内公历锚点（约会 plot 末尾）；优先于 state.currentStoryDay 作「当前剧情日」 */
  storyCalendarAnchor?: string | null
}

/** 每角色持久化的行表上限 */
export const STORY_TIMELINE_ROWS_CAP = 240
/** 注入 prompt：近端固定带上最近 N 条摘要行（不含游标上下文原文窗内的最近几轮线下 AI） */
export const STORY_TIMELINE_INJECT_RECENT_ROWS = 5

function storyTimelineRowRecordedAtMs(row: StoryTimelinePlotRow): number {
  const ts = row.recordedAt
  return typeof ts === 'number' && Number.isFinite(ts) ? ts : 0
}

/**
 * 近端固定摘要行：与「尚未总结·线下剧情」游标上下文原文窗去重。
 * 最近若干轮未总结线下 AI 由游标块全文注入，此处从更早一轮起再取固定条数。
 */
export function selectStoryTimelineRecentInjectRows(
  allRows: StoryTimelinePlotRow[],
  params: {
    datingPlotCursor: number | null
    /** 与 MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS 对齐 */
    skipUnsummarizedOfflineAiRounds: number
    recentRowCount?: number
  },
): StoryTimelinePlotRow[] {
  if (!allRows.length) return []
  const recentCount = Math.max(
    0,
    Math.floor(params.recentRowCount ?? STORY_TIMELINE_INJECT_RECENT_ROWS),
  )
  if (recentCount === 0) return []

  const skipRounds = Math.max(0, Math.floor(params.skipUnsummarizedOfflineAiRounds))
  const cursor = params.datingPlotCursor
  let excludeIds: Set<string> | null = null

  if (skipRounds > 0 && cursor != null && Number.isFinite(cursor)) {
    excludeIds = new Set<string>()
    const unsummarizedOffline = allRows.filter((row) => {
      const scope = row.sourceScope ?? 'private'
      if (scope !== 'offline' && scope !== 'linked') return false
      const ts = storyTimelineRowRecordedAtMs(row)
      return ts > 0 && ts > cursor
    })
    for (const row of unsummarizedOffline.slice(-skipRounds)) {
      excludeIds.add(row.id)
    }
  }

  const eligible = excludeIds?.size
    ? allRows.filter((row) => !excludeIds!.has(row.id))
    : allRows
  return eligible.slice(-recentCount)
}
/** 向量召回：除近端外额外注入的历史行数 */
export const STORY_TIMELINE_VECTOR_RECALL_TOP_K = 3
/** 向量召回注入上限 */
export const STORY_TIMELINE_VECTOR_RECALL_MAX = 5
/** 焦点 query 切片保底名额 */
export const STORY_TIMELINE_FOCUS_RECALL_SLOTS = 2
/** 聊题命中摘要自带关键词/标题时的保底名额 */
export const STORY_TIMELINE_LEXICAL_RECALL_SLOTS = 2
/** 剧情行向量最低相似度（索引含标题+关键词+本轮事件，阈值略低于长期记忆） */
export const STORY_TIMELINE_ROW_VECTOR_MIN_SIM = 0.58
/** 向量召回兜底：主阈值未命中时仍可入选的最低向量分 */
export const STORY_TIMELINE_ROW_VECTOR_FALLBACK_MIN_SIM = 0.52

/** 从 haystack 抽取向量 query 文本（头部 + 尾部；hay 很长时作辅切片） */
export function buildStoryTimelineRecallQueryText(hay: string, maxChars = 1800): string {
  const h = String(hay ?? '').trim()
  if (!h) return ''
  if (h.length <= maxChars) return h

  const headBudget = Math.min(640, Math.floor(maxChars * 0.38))
  const tailBudget = maxChars - headBudget
  return `${h.slice(0, headBudget)}\n${h.slice(-tailBudget)}`.trim()
}

/**
 * 向量 query 切片：仅「用户当轮输入 + 当前剧情焦点」，不再混入全 hay 辅助切片（避免 idol 长线霸榜）。
 */
export function buildStoryTimelineRecallQuerySlices(
  hay: string,
  opts?: { focus?: string; userText?: string; maxChars?: number },
): string[] {
  const maxChars = Math.max(240, Math.floor(opts?.maxChars ?? 1800))
  const slices: string[] = []
  const user = String(opts?.userText ?? '').trim()
  if (user.length >= 4) {
    slices.push(user.length <= maxChars ? user : user.slice(-maxChars))
  }
  const focus = String(opts?.focus ?? '').trim()
  if (focus.length >= 10) {
    const f = focus.length <= maxChars ? focus : focus.slice(-maxChars)
    if (!slices.includes(f)) slices.push(f)
  }
  if (!slices.length) {
    const h = String(hay ?? '').trim()
    if (h.length >= 10) slices.push(h.length <= maxChars ? h : h.slice(-maxChars))
  }
  return slices
}

/**
 * 当前聊题与**该行摘要自带**标题/关键词的字面重合度（0～0.72）。
 * 不依赖项目硬编码词表；各行 row_keywords 由总结模型写入。
 */
export function scoreStoryTimelineRowQueryLexicalOverlap(
  row: StoryTimelinePlotRow,
  queryText: string,
): number {
  const q = String(queryText ?? '').trim().toLowerCase()
  if (q.length < 2) return 0

  let score = 0
  const title = resolveStoryTimelineRowTitle(row).trim().toLowerCase()
  if (title && title !== '（无标题）' && title.length >= 2 && q.includes(title)) {
    score += title.length >= 4 ? 0.36 : 0.26
  }

  let kwHits = 0
  for (const kw of resolveStoryTimelineRowKeywords(row)) {
    const k = kw.trim().toLowerCase()
    if (!k || k.length < 2) continue
    if (!q.includes(k)) continue
    kwHits++
    if (k.length >= 4) score += 0.22
    else if (k.length === 3) score += 0.18
    else score += 0.12
  }

  const event = resolveStoryTimelineRowEventSummary(row).toLowerCase()
  if (event.length >= 4) {
    for (const kw of resolveStoryTimelineRowKeywords(row)) {
      const k = kw.trim().toLowerCase()
      if (k.length >= 3 && event.includes(k) && q.includes(k)) score += 0.06
    }
  }

  if (kwHits === 0 && score < 0.2) return 0
  return Math.min(0.72, score)
}

export function resolveStoryTimelineRowRecallScore(params: {
  focusSim: number
  lexicalSim: number
}): { sim: number; vectorSim: number; focusSim: number; lexicalSim: number } {
  const rawFocus =
    Number.isFinite(params.focusSim) && params.focusSim >= 0 ? params.focusSim : -1
  const lexicalSim =
    Number.isFinite(params.lexicalSim) && params.lexicalSim > 0 ? params.lexicalSim : 0

  let effective = rawFocus
  if (lexicalSim >= 0.24) {
    effective =
      effective >= 0
        ? Math.min(0.95, effective + lexicalSim * 0.22)
        : Math.min(0.88, 0.48 + lexicalSim)
  } else if (effective < 0) {
    effective = -1
  }

  return { sim: effective, vectorSim: effective, focusSim: effective, lexicalSim }
}

export type StoryTimelineRowRecallScore = {
  row: StoryTimelinePlotRow
  sim: number
  vectorSim: number
  focusSim: number
  lexicalSim: number
}

/** 摘要自带关键词 + 焦点向量分合并（去重，上限 STORY_TIMELINE_VECTOR_RECALL_MAX） */
export function mergeStoryTimelineVectorRecallHits(
  scored: StoryTimelineRowRecallScore[],
): StoryTimelineVectorRecallHit[] {
  if (!scored.length) return []

  const minFocus = STORY_TIMELINE_ROW_VECTOR_FALLBACK_MIN_SIM
  const minLexical = 0.28

  const byLexical = [...scored]
    .filter((x) => x.lexicalSim >= minLexical)
    .sort((a, b) => b.lexicalSim - a.lexicalSim || b.focusSim - a.focusSim)
  const byFocus = [...scored]
    .filter((x) => x.focusSim >= minFocus)
    .sort((a, b) => b.focusSim - a.focusSim || b.lexicalSim - a.lexicalSim)

  if (!byLexical.length && !byFocus.length) {
    const fallback = [...scored]
      .filter((x) => x.focusSim >= 0)
      .sort((a, b) => b.focusSim - a.focusSim || b.lexicalSim - a.lexicalSim)
      .slice(0, STORY_TIMELINE_VECTOR_RECALL_TOP_K)
    return fallback.map((x) => ({ row: x.row, sim: x.focusSim }))
  }

  const out: StoryTimelineRowRecallScore[] = []
  const seen = new Set<string>()
  const push = (x: StoryTimelineRowRecallScore) => {
    if (seen.has(x.row.id)) return
    seen.add(x.row.id)
    out.push(x)
  }

  for (const x of byLexical.slice(0, STORY_TIMELINE_LEXICAL_RECALL_SLOTS)) push(x)
  for (const x of byFocus.slice(0, STORY_TIMELINE_FOCUS_RECALL_SLOTS)) push(x)
  for (const x of byFocus) push(x)
  for (const x of byLexical) push(x)

  return out.slice(0, STORY_TIMELINE_VECTOR_RECALL_MAX).map((x) => ({
    row: x.row,
    sim: x.focusSim >= 0 ? x.focusSim : x.lexicalSim,
  }))
}

/** 注入 prompt / 思维溯源：摘要行来源标签 */
export const STORY_TIMELINE_INJECT_LABEL_RECENT = '近端固定'
/** @deprecated 向量召回行头已改用摘要标题；保留兼容旧 trace 解析 */
export const STORY_TIMELINE_INJECT_LABEL_VECTOR = '向量命中'
export const STORY_TIMELINE_INJECT_LABEL_STATE = '合并快照'
export const STORY_TIMELINE_MAIN_CHAR_PLACEHOLDER = '{{char}}'
export const STORY_TIMELINE_SIDE_PERSPECTIVE_REDACT_TAG = '侧幕·{{char}}未在场'

export type StoryTimelineInjectKind = 'state' | 'recent' | 'vector'

export type StoryTimelineInjectTraceRow = {
  injectKind: StoryTimelineInjectKind
  label: string
  content: string
  relevanceScore?: number
  /** 注入正文含【时效·已发生】横幅：锚点公历日早于当前剧情日 */
  isHistorical?: boolean
}

export type StoryTimelineVectorRecallHit = {
  row: StoryTimelinePlotRow
  sim: number
}

/** 自动总结 JSON 内可选 `timeline` 增量 */
export type StoryTimelineSummaryDelta = {
  story_day?: string
  story_time?: string
  /** 本轮剧情跨越时间段时的结束公历日（须含年份；可与 story_day 不同日） */
  story_day_end?: string
  /** 本轮剧情结束钟点（24h HH:mm；同日跨度或跨日结束时刻） */
  story_time_end?: string
  relative_time?: string
  location?: string
  characters_present?: string[]
  costumes?: Record<string, string>
  items?: Array<{ name?: string; note?: string; tier?: string }>
  foreshadows?: Array<{ text?: string; status?: string }>
  todos?: Array<{ text?: string; status?: string }>
  /** 本轮摘要短标题（建议 4～10 字） */
  row_title?: string
  /** 摘要检索关键词（必填 3～5 个；每条 ≤5 个汉字，勿写整句） */
  row_keywords?: string[]
  event_summary?: string
  /** true：主角色（{{char}}）未在场之侧幕摘要；须写 characters_present 且不含 {{char}} */
  side_perspective?: boolean
}

export const STORY_TIMELINE_RECENT_EVENTS_CAP = 12
export const STORY_TIMELINE_OPEN_FORESHADOW_CAP = 16
export const STORY_TIMELINE_OPEN_TODO_CAP = 16
/** 已完成待办保留条数（供【已完成事项】展示；open 另计） */
export const STORY_TIMELINE_RESOLVED_TODO_CAP = 12
/** 注入提示词时最多展示的已完成条数 */
export const STORY_TIMELINE_RESOLVED_TODO_PROMPT_CAP = 6
export const STORY_TIMELINE_COSTUMES_CAP = 24
export const STORY_TIMELINE_ITEMS_CAP = 32
/** 单角色服装描述上限（字）；须容纳上装/下装/外套/鞋履与可见状态 */
export const STORY_TIMELINE_COSTUME_DESC_MAX = 280

/** 单条地点描述上限（字）；须容纳店名/楼层/区域等具体锚点 */
export const STORY_TIMELINE_LOCATION_MAX = 200
/**
 * event_summary 写作目标（软）：约 400～500 字，以保证完整可合理加长。
 * 入库仅设防跑飞硬顶，勿按软目标截断正文。
 */
export const STORY_TIMELINE_EVENT_SUMMARY_SOFT_CHARS = '约 400～500 字（为保证完整可合理加长，勿为凑字数注水）'
/** event_summary 入库硬顶（字）：防模型失控，正常完整叙述应远低于此 */
export const STORY_TIMELINE_EVENT_SUMMARY_MAX = 1200
/** 摘要短标题入库上限（字）；模型建议 4～10 字 */
export const STORY_TIMELINE_ROW_TITLE_MAX = 14
/** 单条摘要关键词字数上限 */
export const STORY_TIMELINE_ROW_KEYWORD_CHAR_MAX = 5
/** 每条摘要关键词数量范围 */
export const STORY_TIMELINE_ROW_KEYWORDS_MIN = 3
export const STORY_TIMELINE_ROW_KEYWORDS_MAX = 5

/**
 * 本轮事件写法：把服装/物品/人物动机等**融进叙事**，禁止再单列分区字段。
 * 待办仍由系统台账维护，摘要勿输出。
 */
export const STORY_TIMELINE_FORESHADOW_TODO_WRITING_RULES = `
【本轮事件·融合写法】
- 「事件」是唯一叙事槽：写清谁做了什么、结果/情绪转折；本轮用到的**道具/服装变化/人物动机与关系悬念**都写进这段话里（例：「{{char}} 用蓝色钥匙开了天台门，仍犹豫要不要把心事说出口」）。
- 篇幅：${STORY_TIMELINE_EVENT_SUMMARY_SOFT_CHARS}；**优先保证事实完整**，勿为卡在软目标字数而删关键经过。
- **禁止**再单列服装 / 物品 / 伏笔 / 待办字段或数组；勿输出空分区。
- **禁止**把事件写成待办清单（「须去做某事」）；具体未完事项由系统待办台账维护。
- 本轮无显著事件可省略「事件」；勿为凑字段编造。
`.trim()

/** 摘要 / 同轮：未收动机回收说明（融入事件叙述；待办不走摘要） */
export const STORY_TIMELINE_OPEN_ANCHORS_RECYCLE_RULES = `
- 若用户提供【系统已有·未收伏笔/动机】：对照**正文末尾**是否已收束；已完结者在「事件」里用回溯语气一笔带过即可，**勿**再输出「伏笔」分区或 foreshadows 数组。
- 仍悬而未决的动机：写进本轮「事件」叙事（人物在想什么/怕什么），勿单列字段。
- **勿输出 todos / 待办**：具体事项不由本摘要块维护。
`.trim()

/** @deprecated 请用 markup；保留字段说明供旧 JSON 兼容解析，新写作禁止 JSON */
export const STORY_TIMELINE_SUMMARY_JSON_FIELDS = `
- "timeline"（可选对象；**新写作请改用 [TIMELINE] markup，禁止 JSON**。若仍输出 JSON，仅允许下列精简字段）：
  - "row_title": string，本轮摘要短标题（建议 4～10 字）
  - "row_keywords": string[]，**必填 3～5 个**（每条 ≤5 字）
  - "story_day" / "story_time" / "story_day_end" / "story_time_end" / "relative_time" / "location" / "characters_present"
  - "event_summary": string，**融合叙事**（道具、服装变化、人物动机都写进这段；${STORY_TIMELINE_EVENT_SUMMARY_SOFT_CHARS}）
  - "side_perspective": boolean（侧幕时 true）
  - **禁止** "costumes" / "items" / "foreshadows" / "todos"

${STORY_TIMELINE_FORESHADOW_TODO_WRITING_RULES}

${STORY_TIMELINE_OPEN_ANCHORS_RECYCLE_RULES}`.trim()

function trimCell(raw: unknown, max = 120): string | undefined {
  const t = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
  return t || undefined
}

/** 事件正文：保留换行；仅触碰硬顶时尽量在句末截断，避免为凑软目标砍半句 */
function trimEventSummary(raw: unknown, max = STORY_TIMELINE_EVENT_SUMMARY_MAX): string | undefined {
  const t = String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!t) return undefined
  if (t.length <= max) return t
  const slice = t.slice(0, max)
  const breakAt = Math.max(
    slice.lastIndexOf('。'),
    slice.lastIndexOf('！'),
    slice.lastIndexOf('？'),
    slice.lastIndexOf('\n'),
  )
  if (breakAt >= Math.floor(max * 0.65)) return slice.slice(0, breakAt + 1).trim()
  return slice.trim()
}

/** 摘要短标题：去空白并截断 */
export function normalizeStoryTimelineRowTitle(raw: unknown): string | undefined {
  const t = String(raw ?? '')
    .replace(/\s+/g, '')
    .trim()
    .slice(0, STORY_TIMELINE_ROW_TITLE_MAX)
  return t || undefined
}

/** 单条摘要关键词：去空白并截断至 5 字 */
export function normalizeStoryTimelineRowKeyword(raw: unknown): string | undefined {
  const t = String(raw ?? '')
    .replace(/\s+/g, '')
    .trim()
    .slice(0, STORY_TIMELINE_ROW_KEYWORD_CHAR_MAX)
  return t || undefined
}

/** 摘要关键词列表：去重、3～5 条、每条 ≤5 字 */
export function normalizeStoryTimelineRowKeywords(raw: unknown): string[] {
  const source = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[、,，/\s]+/)
      : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of source) {
    const kw = normalizeStoryTimelineRowKeyword(item)
    if (!kw) continue
    const key = kw.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(kw)
    if (out.length >= STORY_TIMELINE_ROW_KEYWORDS_MAX) break
  }
  return out
}

const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'] as const

/** 公历：年月日 + 星期（可选时刻），供时间轴 / 思维溯源展示。 */
export function formatZhDateWithWeekday(
  ts: number | Date,
  opts?: { includeTime?: boolean },
): string {
  const d = ts instanceof Date ? ts : new Date(Number.isFinite(ts) ? ts : Date.now())
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const wd = WEEKDAY_ZH[d.getDay()] ?? '日'
  let out = `${y}年${m}月${day}日 星期${wd}`
  if (opts?.includeTime) {
    out += ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return out
}

/** @deprecated 剧情锚点仅来自 story_day/story_time，不再用落库时刻补全 */
export function enrichStoryTimelineTextWithRecordedTime(text: string, _recordedAtMs?: number | null): string {
  return String(text ?? '').trim()
}

const GREGORIAN_ANCHOR_PART_RE = /^\d{4}年\d{1,2}月\d{1,2}日/
/** 剧情公历锚点（单点或「开始 - 结束」区间） */
export const STORY_TIMELINE_GREGORIAN_ANCHOR_RE =
  /\d{4}年\d{1,2}月\d{1,2}日(?:\s+星期[日一二三四五六])?(?:\s+\d{1,2}:\d{2})?(?:\s*-\s*\d{4}年\d{1,2}月\d{1,2}日(?:\s+星期[日一二三四五六])?(?:\s+\d{1,2}:\d{2})?)?/
const GREGORIAN_CALENDAR_LABEL_RE = new RegExp(`(${STORY_TIMELINE_GREGORIAN_ANCHOR_RE.source})`)

function hasGregorianYearInStoryDay(storyDay?: string): boolean {
  return GREGORIAN_ANCHOR_PART_RE.test(String(storyDay ?? '').trim())
}

function extractClockTimeFromStoryTime(storyTime?: string): string | undefined {
  const raw = String(storyTime ?? '').trim()
  if (!raw) return undefined
  const m = raw.match(/(\d{1,2}):(\d{2})/)
  if (!m) return undefined
  return `${String(m[1]).padStart(2, '0')}:${m[2]}`
}

function parseGregorianStoryDayDate(storyDay: string): Date | null {
  const m = storyDay.trim().match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

function storyCalendarDayStartMs(storyDay: string): number | null {
  const d = parseGregorianStoryDayDate(storyDay)
  if (!d) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** 公历 story_day → 当日 0 点毫秒（供日历锚点校验复用） */
export function parseStoryCalendarDayStartMs(storyDay: string): number | null {
  return storyCalendarDayStartMs(storyDay)
}

export function formatGregorianStoryDayFromMs(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/** 取 delta 中代表「本回合故事末尾」的公历日（优先 story_day_end） */
export function resolveStoryTimelineDeltaAnchorEndMs(
  delta: Pick<StoryTimelineSummaryDelta, 'story_day' | 'story_day_end'>,
): number | null {
  const endDay = delta.story_day_end?.trim() || delta.story_day?.trim()
  if (!endDay) return null
  return storyCalendarDayStartMs(endDay)
}

const STORY_TIMELINE_FLASHBACK_HINT_RE =
  /回忆|闪回|插叙|回溯|当年|那时|过去|多年前|几年前|幼时|童年|中学|大学|两年前|三年前|四年前|五年前|十年前/

/** 摘要增量是否明示为回忆/闪回（允许 story_day 早于接续锚点） */
export function isStoryTimelineFlashbackDelta(delta: StoryTimelineSummaryDelta): boolean {
  const rel = String(delta.relative_time ?? '').trim()
  if (rel && STORY_TIMELINE_FLASHBACK_HINT_RE.test(rel)) return true
  const title = String(delta.row_title ?? '').trim()
  if (/回忆|闪回|插叙|回溯/.test(title)) return true
  const event = String(delta.event_summary ?? '').trim()
  if (/^(?:他|她|我)?(?:忽然)?(?:想起|回忆起|闪回|回想)|【闪回】|（回忆）/.test(event)) return true
  return false
}

/**
 * 禁止无闪回语义的公历倒流：将 story_day 钳制到 floorMs 当日及之后。
 * floorMs 通常为上一回合故事内末尾锚点。
 */
export function enforceStoryTimelineDeltaChronology(
  delta: StoryTimelineSummaryDelta,
  floorMs: number | null | undefined,
): StoryTimelineSummaryDelta {
  if (floorMs == null || !Number.isFinite(floorMs)) return delta
  if (isStoryTimelineFlashbackDelta(delta)) return delta

  const startMs = delta.story_day?.trim() ? storyCalendarDayStartMs(delta.story_day) : null
  const endMs = delta.story_day_end?.trim() ? storyCalendarDayStartMs(delta.story_day_end) : null
  const anchorMs = endMs ?? startMs
  if (anchorMs == null || anchorMs >= floorMs) return delta

  const floorDay = formatGregorianStoryDayFromMs(floorMs)
  const patch: StoryTimelineSummaryDelta = { ...delta }
  if (startMs != null && startMs < floorMs) {
    patch.story_day = floorDay
  }
  if (endMs != null && endMs < floorMs) {
    patch.story_day_end = undefined
    if (!patch.story_day?.trim()) patch.story_day = floorDay
  }
  return patch
}

/** 从摘要行【本轮锚点】解析故事内公历起点（毫秒，当日 0 点） */
export function extractStoryTimelineRowAnchorStartMs(rowText: string): number | null {
  const anchorMatch = String(rowText ?? '').match(/【本轮锚点】([^\n]+)/)
  if (!anchorMatch?.[1]) return null
  const anchorText = anchorMatch[1].trim()
  const rangeMatch = anchorText.match(STORY_TIMELINE_GREGORIAN_ANCHOR_RE)
  const head = rangeMatch?.[0]?.split(/\s*-\s*/)[0]?.trim() ?? anchorText
  const dayPart = head.match(/^(\d{4}年\d{1,2}月\d{1,2}日)/)?.[1]
  if (!dayPart) return null
  return storyCalendarDayStartMs(dayPart)
}

/** 解析「当前剧情日」：优先约会末尾锚点，其次 state，再回退最近摘要行 */
export function resolveStoryTimelineCurrentCalendarMs(params: {
  state?: StoryTimelineState | null
  rows?: StoryTimelinePlotRow[]
  storyCalendarAnchor?: string | null
}): number | null {
  const anchorRaw = String(params.storyCalendarAnchor ?? '').trim()
  if (anchorRaw) {
    const dayPart = anchorRaw.match(/^(\d{4}年\d{1,2}月\d{1,2}日)/)?.[1]
    if (dayPart) {
      const ms = storyCalendarDayStartMs(dayPart)
      if (ms != null) return ms
    }
  }
  const stateDay = params.state?.currentStoryDay?.trim()
  if (stateDay) {
    const ms = storyCalendarDayStartMs(stateDay)
    if (ms != null) return ms
  }
  const rows = params.rows ?? []
  for (let i = rows.length - 1; i >= 0; i--) {
    const ms = extractStoryTimelineRowAnchorStartMs(rows[i]!.rowText)
    if (ms != null) return ms
  }
  return null
}

/** 摘要/event 是否像「当时对未来的提醒/考核/赴约」（非已发生事实） */
const STORY_TIMELINE_FORWARD_SCHEDULE_HINT_RE =
  /(?:下(?:周|个)?[一二三四五六日天])|明[天日]|后[天日]|(?:即将|快要).{0,8}(?:考核|比赛|演出|见面|赴约|截止)|提醒.{0,12}(?:用户|对方|{{user}}|玩家)|(?:歌曲|声乐|舞台)?考核/

export function storyTimelineTextLooksLikeForwardScheduleSnapshot(text: string): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  return STORY_TIMELINE_FORWARD_SCHEDULE_HINT_RE.test(t)
}

/** 两锚点是否同一故事内公历日（0 点对齐） */
export function isSameStoryCalendarDayMs(aMs: number, bMs: number): boolean {
  return formatGregorianStoryDayFromMs(aMs) === formatGregorianStoryDayFromMs(bMs)
}

/** 摘要行锚点是否早于当前剧情日且非同一公历日（用于「历史」时效横幅） */
export function isStoryTimelineRowHistoricalRelativeToCurrent(
  rowMs: number,
  currentStoryMs: number,
): boolean {
  if (!Number.isFinite(rowMs) || !Number.isFinite(currentStoryMs)) return false
  if (isSameStoryCalendarDayMs(rowMs, currentStoryMs)) return false
  return rowMs < currentStoryMs
}

/** 摘要行锚点是否明显早于当前剧情日（用于注入时效标注，非排除召回） */
export function isStoryTimelineRowPastRelativeToCurrent(
  row: StoryTimelinePlotRow,
  currentStoryMs: number | null,
  minGapDays = 1,
): boolean {
  if (currentStoryMs == null) return false
  const rowMs = extractStoryTimelineRowAnchorStartMs(row.rowText)
  if (rowMs == null) return false
  if (isStoryTimelineRowHistoricalRelativeToCurrent(rowMs, currentStoryMs)) return true
  return (currentStoryMs - rowMs) / 86_400_000 >= minGapDays
}

/** @deprecated 仅用于内部；不再用于剔除向量召回 */
export function isStoryTimelineRowExpiredScheduleSnapshot(
  row: StoryTimelinePlotRow,
  currentStoryMs: number | null,
  minGapDays = 7,
): boolean {
  if (!isStoryTimelineRowPastRelativeToCurrent(row, currentStoryMs, minGapDays)) return false
  const event = resolveStoryTimelineRowEventSummary(row)
  const title = resolveStoryTimelineRowTitle(row)
  return (
    storyTimelineTextLooksLikeForwardScheduleSnapshot(event) ||
    storyTimelineTextLooksLikeForwardScheduleSnapshot(title)
  )
}

function formatStoryCalendarDayLabelFromMs(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function formatStoryTimelineGapLabelZh(gapDays: number): string {
  if (gapDays < 1.5) return '昨日'
  if (gapDays < 7) return `约${Math.max(1, Math.round(gapDays))}天前`
  if (gapDays < 45) return `约${Math.max(1, Math.round(gapDays / 7))}周前`
  if (gapDays < 365) return `约${Math.max(1, Math.round(gapDays / 30))}个月前`
  return `约${Math.max(1, Math.round(gapDays / 365))}年前`
}

/**
 * 历史摘要注入：保留全文，按当前剧情日标注「已发生 / 约 N 个月前」，
 * 避免模型把旧摘要里的「下周五考核」当作尚未到来的提醒。
 */
export function formatStoryTimelineHistoricalRowTemporalBanner(
  rowText: string,
  currentStoryMs: number | null,
): string {
  if (currentStoryMs == null) return ''
  const rowMs = extractStoryTimelineRowAnchorStartMs(rowText)
  if (rowMs == null) return ''
  if (!isStoryTimelineRowHistoricalRelativeToCurrent(rowMs, currentStoryMs)) return ''

  const gapDays = (currentStoryMs - rowMs) / 86_400_000
  const currentAnchor = formatStoryCalendarDayLabelFromMs(currentStoryMs)
  const rowAnchor = formatStoryCalendarDayLabelFromMs(rowMs)
  const gapLabel = formatStoryTimelineGapLabelZh(gapDays)
  const event = String(rowText ?? '').match(/【本轮事件】([^\n]+)/)?.[1]?.trim() ?? ''
  const title = extractStoryTimelineRowTitleFromRowText(rowText)
  const scheduleLike =
    storyTimelineTextLooksLikeForwardScheduleSnapshot(event) ||
    storyTimelineTextLooksLikeForwardScheduleSnapshot(title)

  const anchorPart = rowAnchor
    ? `本行故事内锚点：${rowAnchor}；相对当前剧情日 ${currentAnchor} 为**${gapLabel}**`
    : `相对当前剧情日 ${currentAnchor} 为**${gapLabel}**`

  if (scheduleLike) {
    return (
      `【时效·已发生】${anchorPart}。行内「下周五 / 即将 / 提醒…」等为**该锚点当时的计划或预告**，到当前剧情日默认**已属往事**（除非近端摘要或最近剧情明确尚未发生）。` +
      `正文若提起须用回溯语气（如「${gapLabel}…」「那时说好的考核…」），**禁止**当作尚未到来的日程或当场提醒用户。`
    )
  }
  return (
    `【时效·已发生】${anchorPart}。本摘要为**过去已发生**的事实背景；正文若提起须用过去时或回溯语气（如「${gapLabel}…」），**禁止**写成正在发生或即将发生。`
  )
}

/** 注入用正文：剥离当轮待办/伏笔 + 必要时加时效横幅（不删【本轮事件】） */
export function formatStoryTimelineRowBodyForTemporalInject(
  rowText: string,
  currentStoryMs: number | null,
): string {
  const body = stripStoryTimelineRowObligationSections(String(rowText ?? ''))
  const banner = formatStoryTimelineHistoricalRowTemporalBanner(body, currentStoryMs)
  if (!banner.trim()) return body
  return `${banner}\n\n${body}`.trim()
}

function isStaleOpenTodoRelativeSchedule(text: string, currentStoryMs: number | null): boolean {
  if (currentStoryMs == null) return false
  const t = String(text ?? '').trim()
  if (!t) return false
  if (!storyTimelineTextLooksLikeForwardScheduleSnapshot(t)) return false
  return /提醒|通知|考核|赴约|截止|提交|比赛|演出/.test(t)
}

/** 锚点行内去掉公历日历段，保留剧情相对日/时段/相对/地点等（兼容旧数据迁移） */
export function stripSystemTimeFromStoryTimelineAnchorLabel(label: string): string {
  const parts = String(label ?? '')
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean)
  const kept = parts.filter((p) => !GREGORIAN_ANCHOR_PART_RE.test(p))
  return kept.join(' · ')
}

function formatGregorianStoryEndpointLabel(storyDay?: string, storyTime?: string): string {
  const dayRaw = String(storyDay ?? '').trim()
  if (!dayRaw) return ''
  const clock = extractClockTimeFromStoryTime(storyTime)
  if (hasGregorianYearInStoryDay(dayRaw)) {
    let label = dayRaw
    if (!label.includes('星期')) {
      const parsed = parseGregorianStoryDayDate(dayRaw)
      if (parsed) {
        const wd = WEEKDAY_ZH[parsed.getDay()] ?? '日'
        label = `${label} 星期${wd}`
      }
    }
    if (clock && !label.includes(clock)) label = `${label} ${clock}`
    return label.trim()
  }
  const parts: string[] = [dayRaw]
  if (storyTime?.trim()) {
    if (clock && !dayRaw.includes(clock)) parts.push(clock)
    else if (!clock) parts.push(storyTime.trim())
  }
  return parts.join(' ').trim()
}

/** 由 timeline 增量拼**剧情内**公历锚点（禁止落库/生成时刻） */
export function composeStoryTimelineCalendarAnchorLabel(
  delta: Pick<
    StoryTimelineSummaryDelta,
    'story_day' | 'story_time' | 'story_day_end' | 'story_time_end'
  >,
): string {
  const start = formatGregorianStoryEndpointLabel(delta.story_day, delta.story_time)
  const hasEnd = Boolean(delta.story_day_end?.trim() || delta.story_time_end?.trim())
  const endDay = delta.story_day_end?.trim() || delta.story_day?.trim()
  const end = hasEnd ? formatGregorianStoryEndpointLabel(endDay, delta.story_time_end) : ''
  if (start && end) return `${start} - ${end}`
  if (start) return start
  if (end) return end
  return ''
}

/** 列表卡片副标题：剧情内公历锚点（单点或区间）；无锚点则空，不用落库时刻 */
export function formatStoryTimelineListTimeLabel(
  text: string,
  _recordedAtMs?: number | null,
): string {
  const raw = String(text ?? '').trim()
  const anchorMatch = raw.match(/【本轮锚点】([^\n]+)/)
  const anchorText = anchorMatch?.[1]?.trim() ?? ''
  const calMatch = anchorText.match(GREGORIAN_CALENDAR_LABEL_RE)
  if (calMatch?.[1]) return calMatch[1].trim()
  const rangeMatch = anchorText.match(STORY_TIMELINE_GREGORIAN_ANCHOR_RE)
  if (rangeMatch?.[0]) return rangeMatch[0].trim()
  return anchorText.split(' · ')[0]?.trim() ?? ''
}

/** @deprecated 请用 formatStoryTimelineListTimeLabel */
export function extractStoryTimelineAnchorLabelFromRowText(
  text: string,
  recordedAtMs?: number | null,
): string {
  return formatStoryTimelineListTimeLabel(text, recordedAtMs)
}

/** 档案馆展示：不再注入落库时刻；仅展示已入库的剧情锚点正文 */
export function prepareStoryTimelineArchiveDisplayText(
  text: string,
  _recordedAtMs?: number | null,
): string {
  return String(text ?? '').trim()
}

/** @deprecated 请用 prepareStoryTimelineArchiveDisplayText */
export function sanitizeStoryTimelineArchiveDisplayText(
  text: string,
  recordedAtMs?: number | null,
): string {
  return prepareStoryTimelineArchiveDisplayText(text, recordedAtMs)
}

function normalizeItemTier(raw: unknown): StoryTimelineItemTier | undefined {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (t === 'important' || t === 'critical' || t === 'normal') return t
  if (t.includes('关键') || t.includes('critical')) return 'critical'
  if (t.includes('重要') || t.includes('important')) return 'important'
  return undefined
}

function normalizeForeshadowStatus(raw: unknown): 'open' | 'resolved' {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (t === 'resolved' || t.includes('完成') || t.includes('已') || t.includes('兑现')) return 'resolved'
  return 'open'
}

/** 从总结 JSON 解析 timeline 对象 */
export function parseStoryTimelineSummaryDelta(raw: unknown): StoryTimelineSummaryDelta | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const delta: StoryTimelineSummaryDelta = {}

  const storyDay = trimCell(o.story_day ?? o.storyDay, 48)
  const storyTime = trimCell(o.story_time ?? o.storyTime, 48)
  const storyDayEnd = trimCell(o.story_day_end ?? o.storyDayEnd, 48)
  const storyTimeEnd = trimCell(o.story_time_end ?? o.storyTimeEnd, 48)
  const relativeTime = trimCell(o.relative_time ?? o.relativeTime, 48)
  const location = trimCell(o.location, STORY_TIMELINE_LOCATION_MAX)
  if (storyDay) delta.story_day = storyDay
  if (storyTime) delta.story_time = storyTime
  if (storyDayEnd) delta.story_day_end = storyDayEnd
  if (storyTimeEnd) delta.story_time_end = storyTimeEnd
  if (relativeTime) delta.relative_time = relativeTime
  if (location) delta.location = location

  const charsRaw = o.characters_present ?? o.charactersPresent
  if (Array.isArray(charsRaw)) {
    const chars = charsRaw
      .map((x) => trimCell(x, 64))
      .filter((x): x is string => !!x)
      .slice(0, 12)
    if (chars.length) delta.characters_present = chars
  }

  const costumesRaw = o.costumes
  if (costumesRaw && typeof costumesRaw === 'object' && !Array.isArray(costumesRaw)) {
    const costumes: Record<string, string> = {}
    for (const [k, v] of Object.entries(costumesRaw as Record<string, unknown>)) {
      const key = trimCell(k, 64)
      const val = trimCell(v, STORY_TIMELINE_COSTUME_DESC_MAX)
      if (key && val) costumes[key] = val
    }
    if (Object.keys(costumes).length) delta.costumes = costumes
  }

  const itemsRaw = o.items
  if (Array.isArray(itemsRaw)) {
    const items: NonNullable<StoryTimelineSummaryDelta['items']> = []
    for (const row of itemsRaw) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const name = trimCell(r.name, 80)
      if (!name) continue
      items.push({
        name,
        ...(trimCell(r.note, 120) ? { note: trimCell(r.note, 120) } : {}),
        ...(normalizeItemTier(r.tier) ? { tier: normalizeItemTier(r.tier) } : {}),
      })
    }
    if (items.length) delta.items = items.slice(0, 12)
  }

  const foreRaw = o.foreshadows
  if (Array.isArray(foreRaw)) {
    const foreshadows: NonNullable<StoryTimelineSummaryDelta['foreshadows']> = []
    for (const row of foreRaw) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const text = trimCell(r.text, 160)
      if (!text) continue
      foreshadows.push({ text, status: normalizeForeshadowStatus(r.status) })
    }
    if (foreshadows.length) delta.foreshadows = foreshadows.slice(0, 8)
  }

  const todosRaw = o.todos
  if (Array.isArray(todosRaw)) {
    const todos: NonNullable<StoryTimelineSummaryDelta['todos']> = []
    for (const row of todosRaw) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const text = trimCell(r.text, 160)
      if (!text) continue
      todos.push({ text, status: normalizeForeshadowStatus(r.status) })
    }
    if (todos.length) delta.todos = todos.slice(0, 8)
  }

  const eventSummary = trimEventSummary(o.event_summary ?? o.eventSummary)
  if (eventSummary) delta.event_summary = eventSummary

  const rowTitle = normalizeStoryTimelineRowTitle(o.row_title ?? o.rowTitle)
  if (rowTitle) delta.row_title = rowTitle

  const rowKeywords = normalizeStoryTimelineRowKeywords(
    o.row_keywords ?? o.rowKeywords ?? o.keywords,
  )
  if (rowKeywords.length) delta.row_keywords = rowKeywords

  if (o.side_perspective === true || o.sidePerspective === true) {
    delta.side_perspective = true
  }

  return Object.keys(delta).length ? delta : undefined
}

export function createEmptyStoryTimelineState(characterId: string): StoryTimelineState {
  return {
    characterId: characterId.trim(),
    updatedAt: Date.now(),
    costumes: [],
    items: [],
    foreshadows: [],
    todos: [],
    recentEvents: [],
  }
}

function openAnchorKey(text: string): string {
  return text.trim().toLowerCase()
}

/** 锚点同义匹配：去空白/常见标点后的紧凑串 */
function normalizeOpenAnchorMatchText(text: string): string {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[，。！？、；：""''（）()【】\[\]《》<>…·\-—_~`'".,!?;:/\\]/g, '')
}

function openAnchorBigrams(compact: string): Set<string> {
  const out = new Set<string>()
  if (compact.length < 2) {
    if (compact) out.add(compact)
    return out
  }
  for (let i = 0; i < compact.length - 1; i++) {
    out.add(compact.slice(i, i + 2))
  }
  return out
}

function openAnchorJaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) {
    if (b.has(x)) inter++
  }
  const union = a.size + b.size - inter
  return union > 0 ? inter / union : 0
}

/** resolved 同义命中：包含关系、共享≥4 字核心子串，或 bigram Jaccard≥0.55 */
function openAnchorsAreSynonymous(a: string, b: string): boolean {
  const ca = normalizeOpenAnchorMatchText(a)
  const cb = normalizeOpenAnchorMatchText(b)
  if (!ca || !cb) return false
  if (ca === cb) return true
  const shorter = ca.length <= cb.length ? ca : cb
  const longer = ca.length <= cb.length ? cb : ca
  // 过短文案不做同义删除，降低误杀
  if (shorter.length < 6) return false
  if (longer.includes(shorter)) return true
  if (openAnchorJaccard(openAnchorBigrams(ca), openAnchorBigrams(cb)) >= 0.55) return true
  // 「数学作业尚未动笔」↔「数学作业已写完」：共享实质子串
  for (let len = Math.min(6, shorter.length); len >= 4; len--) {
    for (let i = 0; i <= shorter.length - len; i++) {
      if (longer.includes(shorter.slice(i, i + len))) return true
    }
  }
  return false
}

/** 在 open map 中删除与 resolvedText 精确或同义的一条（取最佳 Jaccard） */
function deleteOpenAnchorByExactOrSynonym<T extends StoryTimelineOpenAnchorEntry>(
  map: Map<string, T>,
  resolvedText: string,
): boolean {
  const exactKey = openAnchorKey(resolvedText)
  if (map.delete(exactKey)) return true

  let bestKey: string | null = null
  let bestScore = -1
  const resolvedCompact = normalizeOpenAnchorMatchText(resolvedText)
  const resolvedGrams = openAnchorBigrams(resolvedCompact)
  for (const [key, entry] of map) {
    if (!openAnchorsAreSynonymous(resolvedText, entry.text)) continue
    const score = openAnchorJaccard(resolvedGrams, openAnchorBigrams(normalizeOpenAnchorMatchText(entry.text)))
    if (score > bestScore) {
      bestScore = score
      bestKey = key
    }
  }
  if (bestKey != null) {
    map.delete(bestKey)
    return true
  }
  return false
}

function mergeOpenResolvedAnchorEntries<T extends StoryTimelineOpenAnchorEntry>(
  prevOpen: T[],
  deltaEntries: Array<{ text?: string; status?: string }> | undefined,
  cap: number,
): T[] {
  if (!deltaEntries?.length) return prevOpen
  const map = new Map(
    prevOpen.filter((f) => f.status === 'open').map((f) => [openAnchorKey(f.text), f]),
  )
  for (const f of deltaEntries) {
    const text = trimCell(f.text, 160)
    if (!text) continue
    const status = normalizeForeshadowStatus(f.status)
    const key = openAnchorKey(text)
    if (status === 'resolved') {
      deleteOpenAnchorByExactOrSynonym(map, text)
      continue
    }
    map.set(key, { text, status: 'open' } as T)
  }
  return [...map.values()].slice(-cap)
}

/** 本轮摘要是否像「事项已完成」 */
const STORY_TIMELINE_TODO_DONE_SIGNAL_RE =
  /写完|做完|交了|交完|已完成|完成了|搞定|办完|已赴约|赴约了|到场|解决了|已解决|兑现了|已兑现|谈妥|说开了|讲开了|结束了|收工|交差|交掉|交上|写好了|办妥|喝了|喝过/

/** 本轮摘要是否像「取消 / 明确没做」 */
const STORY_TIMELINE_TODO_CANCEL_SIGNAL_RE =
  /取消|不去了|已取消|改期取消|错过了|作废|并没有|并未|没有去|没去|忘了|未完成/

/** 从待办文案抽检索词（≥2 字片段 + bigram） */
function extractTodoMatchTokens(text: string): Set<string> {
  const compact = normalizeOpenAnchorMatchText(text)
  const tokens = new Set<string>()
  for (const m of compact.match(/[\u4e00-\u9fff]{2,6}/g) ?? []) {
    tokens.add(m)
  }
  for (const g of openAnchorBigrams(compact)) {
    if (g.length >= 2) tokens.add(g)
  }
  for (const noise of ['尚未', '还未', '仍须', '需要', '计划', '今晚', '今天', '明天', '准备', '次日']) {
    tokens.delete(noise)
  }
  return tokens
}

function todoTokenOverlapStrong(todoText: string, haystack: string): boolean {
  const compact = normalizeOpenAnchorMatchText(haystack)
  if (compact.length < 4) return false
  const hayTokens = extractTodoMatchTokens(haystack)
  const todoTokens = extractTodoMatchTokens(todoText)
  if (!todoTokens.size) return false
  let hit = 0
  for (const tok of todoTokens) {
    if (tok.length < 2) continue
    if (compact.includes(tok) || hayTokens.has(tok)) hit++
  }
  const strong = [...todoTokens].some(
    (tok) => tok.length >= 4 && (compact.includes(tok) || hayTokens.has(tok)),
  )
  if (hit >= 2 || strong) return true
  const todoCompact = normalizeOpenAnchorMatchText(todoText)
  return todoCompact.length >= 6 && compact.includes(todoCompact)
}

function inferTodoSubject(openText: string): string {
  if (openText.includes('{{char}}')) return '{{char}}'
  if (openText.includes('{{user}}')) return '{{user}}'
  return '角色'
}

/** 相对期限用语 → 展示用时间短语 */
function inferTodoTimePhrase(openText: string): string {
  const t = openText
  if (/明天|明日|次日|翌日/.test(t)) return '次日'
  if (/今晚|当天|今日|今天|当晚/.test(t)) return '当日'
  if (/后天/.test(t)) return '后天'
  if (/下周/.test(t)) return '下周内'
  if (/下下周/.test(t)) return '两周内'
  return '约定时间内'
}

/** 从待办抽出可接在「并没有在次日…」后的动作核 */
function extractTodoActionCore(openText: string): string {
  return openText
    .replace(/\{\{char\}\}/g, '')
    .replace(/\{\{user\}\}/g, '')
    .replace(/要在|计划在|打算在|须在|需要在|准备在/g, '')
    .replace(/明天|明日|次日|翌日|今晚|今天|今日|当天|当晚|后天|下周|下下周/g, '')
    .replace(/要|计划|打算|尚未|还未|仍须|准备|将要|须|去/g, '')
    .replace(/[，。！？、；：\s\u3000]+/g, '')
    .trim()
    .slice(0, 40)
}

function buildMissedTodoResolvedNote(openText: string): string {
  const subject = inferTodoSubject(openText)
  const timePhrase = inferTodoTimePhrase(openText)
  const action = extractTodoActionCore(openText)
  if (action.length >= 2) return `${subject} 并没有在${timePhrase}${action}`
  return `${subject} 并未在${timePhrase}完成原定事项`
}

function buildDoneTodoResolvedNote(openText: string, hint?: string): string {
  const subject = inferTodoSubject(openText)
  const action = extractTodoActionCore(openText)
  const hintTrim = String(hint ?? '').trim()
  if (hintTrim && hintTrim !== openText.trim()) {
    const h = hintTrim.slice(0, 80)
    if (/并没有|并未|没有/.test(h)) return h
    if (
      (h.includes(subject) || h.includes('{{char}}') || h.includes('{{user}}')) &&
      /已|完成|写完|做完|兑现/.test(h)
    ) {
      return h
    }
  }
  if (action.length >= 2) return `${subject} 已完成${action}`
  return `${subject} 已完成原定事项`
}

function buildCancelledTodoResolvedNote(openText: string): string {
  const subject = inferTodoSubject(openText)
  const action = extractTodoActionCore(openText)
  if (action.length >= 2) return `${subject} 取消了「${action}」`
  return `${subject} 取消了原定事项`
}

function markTodoResolved(
  todo: StoryTimelineTodoEntry,
  outcome: StoryTimelineTodoOutcome,
  resolvedNote: string,
  resolvedAtStoryDay: string | undefined,
): StoryTimelineTodoEntry {
  return {
    text: todo.text,
    status: 'resolved',
    ...(todo.openedStoryDay ? { openedStoryDay: todo.openedStoryDay } : {}),
    outcome,
    resolvedNote: resolvedNote.slice(0, 160),
    ...(resolvedAtStoryDay?.trim()
      ? { resolvedAtStoryDay: resolvedAtStoryDay.trim().slice(0, 48) }
      : {}),
  }
}

function capStoryTimelineTodos(todos: StoryTimelineTodoEntry[]): StoryTimelineTodoEntry[] {
  const open = todos.filter((t) => t.status === 'open').slice(-STORY_TIMELINE_OPEN_TODO_CAP)
  const resolved = todos
    .filter((t) => t.status === 'resolved')
    .slice(-STORY_TIMELINE_RESOLVED_TODO_CAP)
  return [...open, ...resolved]
}

function summaryImpliesTodoDone(todoText: string, summary: string): boolean {
  if (!todoTokenOverlapStrong(todoText, summary)) return false
  if (STORY_TIMELINE_TODO_CANCEL_SIGNAL_RE.test(summary) && /并没有|并未|没有|忘了|没去/.test(summary)) {
    return false
  }
  if (STORY_TIMELINE_TODO_DONE_SIGNAL_RE.test(summary)) return true
  // 摘要直接出现动作且无否定（如「喝了口水」）
  const action = extractTodoActionCore(todoText)
  if (action.length >= 2 && normalizeOpenAnchorMatchText(summary).includes(normalizeOpenAnchorMatchText(action))) {
    return !/并没有|并未|没有|忘了|没去|未/.test(summary)
  }
  return false
}

/**
 * 用本轮 event_summary 把已兑现的 open 待办转入已完成（不对伏笔做推断）。
 */
function autoResolveOpenTodosFromEventSummary(
  todos: StoryTimelineTodoEntry[],
  eventSummary: string,
  resolvedAtStoryDay: string | undefined,
): StoryTimelineTodoEntry[] {
  const summary = String(eventSummary ?? '').trim()
  if (!summary || !todos.length) return todos
  const day = resolvedAtStoryDay?.trim() || undefined
  return todos.map((t) => {
    if (t.status !== 'open') return t
    if (!summaryImpliesTodoDone(t.text, summary)) return t
    const cancel = STORY_TIMELINE_TODO_CANCEL_SIGNAL_RE.test(summary)
    if (cancel && todoTokenOverlapStrong(t.text, summary)) {
      return markTodoResolved(t, 'cancelled', buildCancelledTodoResolvedNote(t.text), day)
    }
    return markTodoResolved(t, 'done', buildDoneTodoResolvedNote(t.text, summary), day)
  })
}

/** 相对期限：距 openedStoryDay 的天数；无法识别则 null */
function inferTodoRelativeDeadlineOffsetDays(text: string): number | null {
  const t = String(text ?? '')
  if (/今晚|今天|今日|当天|当晚/.test(t)) return 0
  if (/明天|明日|次日|翌日/.test(t)) return 1
  if (/后天/.test(t)) return 2
  if (/大后天/.test(t)) return 3
  if (/下下周/.test(t)) return 14
  if (/下周/.test(t)) return 7
  if (
    storyTimelineTextLooksLikeForwardScheduleSnapshot(t) &&
    /提醒|通知|考核|赴约|截止|提交|比赛|演出/.test(t)
  ) {
    return 1
  }
  return null
}

/** 无明确相对期限时，剧情日跨越此天数也视为节点已过 */
const STORY_TIMELINE_TODO_LARGE_GAP_DAYS = 30

/**
 * 剧情日跨过待办相对期限（或大跨度）后：转入已完成。
 * 摘要能证明已做 → done；否则 missed（如「并没有在次日喝水」）。
 */
function closeTodosPastDeadlineByTimeSkip(
  todos: StoryTimelineTodoEntry[],
  nextStoryDay: string | undefined,
  eventSummary: string,
): StoryTimelineTodoEntry[] {
  const nextMs = nextStoryDay?.trim() ? storyCalendarDayStartMs(nextStoryDay.trim()) : null
  if (nextMs == null) return todos
  const summary = String(eventSummary ?? '').trim()
  const day = nextStoryDay?.trim()

  return todos.map((t) => {
    if (t.status !== 'open') return t
    const opened = t.openedStoryDay?.trim()
    const openedMs = opened ? storyCalendarDayStartMs(opened) : null
    if (openedMs == null) return t
    const offset = inferTodoRelativeDeadlineOffsetDays(t.text)
    const gapDays = (nextMs - openedMs) / 86_400_000
    let pastDeadline = false
    if (offset != null) {
      const deadlineMs = openedMs + offset * 86_400_000
      pastDeadline = nextMs > deadlineMs
    } else if (gapDays >= STORY_TIMELINE_TODO_LARGE_GAP_DAYS) {
      pastDeadline = true
    }
    if (!pastDeadline) return t
    if (summaryImpliesTodoDone(t.text, summary)) {
      return markTodoResolved(t, 'done', buildDoneTodoResolvedNote(t.text, summary), day)
    }
    return markTodoResolved(t, 'missed', buildMissedTodoResolvedNote(t.text), day)
  })
}

export function cloneStoryTimelineTodos(
  todos: StoryTimelineTodoEntry[] | null | undefined,
): StoryTimelineTodoEntry[] {
  return (todos ?? []).map((t) => ({ ...t }))
}

/**
 * 按单轮 event_summary 更新待办台账（勾销 / 新提出 / 跨日收束）。
 * 供线下「只吃本轮摘要」与删除/重生后的后续段重放使用。
 */
export function applyStoryTimelineTodoLedgerFromRoundSummary(
  todos: StoryTimelineTodoEntry[],
  eventSummary: string,
  currentStoryDay?: string,
): StoryTimelineTodoEntry[] {
  const summary = String(eventSummary ?? '').trim()
  const day = currentStoryDay?.trim() || undefined
  let next = cloneStoryTimelineTodos(todos)
  if (summary) {
    next = autoResolveOpenTodosFromEventSummary(next, summary, day)
    next = proposeNewOpenTodosFromEventSummary(next, summary, day)
  }
  return capStoryTimelineTodos(closeTodosPastDeadlineByTimeSkip(next, day, summary))
}

function proposeNewOpenTodosFromEventSummary(
  todos: StoryTimelineTodoEntry[],
  eventSummary: string,
  openedStoryDay: string | undefined,
): StoryTimelineTodoEntry[] {
  const summary = String(eventSummary ?? '').trim()
  if (summary.length < 10) return todos
  // 已完成信号强时不再从摘要新开待办
  if (STORY_TIMELINE_TODO_DONE_SIGNAL_RE.test(summary) && !/(?:须|需要|记得|约定|计划|尚未)/.test(summary)) {
    return todos
  }
  const re =
    /(?:\{\{char\}\}|\{\{user\}\})?[^。！？\n]{0,6}(?:须|需要|记得|约定|计划|准备|尚未|还未)(?:在)?(?:明天|次日|今晚|今天|今日|后天|下周)?[^。！？\n]{2,40}/g
  const found: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(summary)) != null) {
    const raw = m[0].replace(/^[，、；\s]+|[，、；\s]+$/g, '').trim()
    if (raw.length < 6 || raw.length > 80) continue
    if (!/(?:须|需要|记得|约定|计划|准备|尚未|还未)/.test(raw)) continue
    found.push(raw)
  }
  if (!found.length) return todos
  let next = [...todos]
  const day = openedStoryDay?.trim()
  for (const text of found.slice(0, 3)) {
    const dup = next.some(
      (t) =>
        t.status === 'open' &&
        (openAnchorKey(t.text) === openAnchorKey(text) || openAnchorsAreSynonymous(t.text, text)),
    )
    if (dup) continue
    next.push({
      text: text.slice(0, 160),
      status: 'open',
      ...(day ? { openedStoryDay: day } : {}),
    })
  }
  return capStoryTimelineTodos(next)
}

function backfillTodoOpenedStoryDay(
  todos: StoryTimelineTodoEntry[],
  fallbackDay: string | undefined,
): StoryTimelineTodoEntry[] {
  const day = fallbackDay?.trim()
  if (!day) return todos
  return todos.map((t) =>
    t.status === 'open' && !t.openedStoryDay?.trim() ? { ...t, openedStoryDay: day } : t,
  )
}

/** 记忆页：将某条 open 待办标为已完成 / 逾期未做 */
export function resolveStoryTimelineOpenTodoInState(
  state: StoryTimelineState,
  todoText: string,
  outcome: StoryTimelineTodoOutcome = 'done',
): StoryTimelineState {
  const key = openAnchorKey(todoText)
  const day = state.currentStoryDay?.trim()
  const todos = (state.todos ?? []).map((t) => {
    if (t.status !== 'open') return t
    if (openAnchorKey(t.text) !== key && !openAnchorsAreSynonymous(t.text, todoText)) return t
    const note =
      outcome === 'missed'
        ? buildMissedTodoResolvedNote(t.text)
        : outcome === 'cancelled'
          ? buildCancelledTodoResolvedNote(t.text)
          : buildDoneTodoResolvedNote(t.text)
    return markTodoResolved(t, outcome, note, day)
  })
  return {
    ...state,
    todos: capStoryTimelineTodos(todos),
    updatedAt: Date.now(),
  }
}

/** 记忆页：从台账移除某条（open 或 resolved） */
export function removeStoryTimelineTodoFromState(
  state: StoryTimelineState,
  todoText: string,
): StoryTimelineState {
  const key = openAnchorKey(todoText)
  return {
    ...state,
    todos: (state.todos ?? []).filter(
      (t) => openAnchorKey(t.text) !== key && !openAnchorsAreSynonymous(t.text, todoText),
    ),
    updatedAt: Date.now(),
  }
}

/** 记忆页：追加一条 open 待办 */
export function appendStoryTimelineOpenTodoToState(
  state: StoryTimelineState,
  todoText: string,
): StoryTimelineState | null {
  const text = String(todoText ?? '').trim().slice(0, 160)
  if (!text) return null
  const day = state.currentStoryDay?.trim()
  if (
    (state.todos ?? []).some(
      (t) =>
        t.status === 'open' &&
        (openAnchorKey(t.text) === openAnchorKey(text) || openAnchorsAreSynonymous(t.text, text)),
    )
  ) {
    return null
  }
  return {
    ...state,
    todos: capStoryTimelineTodos([
      ...(state.todos ?? []),
      { text, status: 'open', ...(day ? { openedStoryDay: day } : {}) },
    ]),
    updatedAt: Date.now(),
  }
}

function costumeKey(c: StoryTimelineCostumeEntry): string {
  return c.character.trim().toLowerCase()
}

function itemKey(name: string): string {
  return name.trim().toLowerCase()
}

export function hasTimelineDeltaContent(delta: StoryTimelineSummaryDelta): boolean {
  return !!(
    delta.row_title ||
    delta.story_day ||
    delta.story_time ||
    delta.story_day_end ||
    delta.story_time_end ||
    delta.relative_time ||
    delta.location ||
    (delta.characters_present?.length ?? 0) ||
    (delta.costumes && Object.keys(delta.costumes).length) ||
    (delta.items?.length ?? 0) ||
    (delta.foreshadows?.length ?? 0) ||
    (delta.todos?.length ?? 0) ||
    delta.event_summary
  )
}

export type MergeStoryTimelineStateOpts = {
  /**
   * 为 true 时不改动待办台账（约会重建用：待办与摘要解耦，禁止从历史 event_summary 复活）。
   * 默认 false：本轮摘要仍可按正文自动勾销/提出待办。
   */
  skipTodoLedgerMutation?: boolean
}

/** 将总结增量合并进角色剧情时间轴状态 */
export function mergeStoryTimelineState(
  prev: StoryTimelineState | null | undefined,
  characterId: string,
  delta: StoryTimelineSummaryDelta,
  scope: StoryTimelineEventScope,
  opts?: MergeStoryTimelineStateOpts,
): StoryTimelineState | null {
  if (!hasTimelineDeltaContent(delta)) return prev ?? null
  const cid = characterId.trim()
  if (!cid) return prev ?? null

  const base = prev?.characterId === cid ? prev : createEmptyStoryTimelineState(cid)
  const floorMs = base.currentStoryDay?.trim()
    ? storyCalendarDayStartMs(base.currentStoryDay.trim())
    : null
  const deltaApplied = enforceStoryTimelineDeltaChronology(delta, floorMs)
  const now = Date.now()
  const prevStoryDay = base.currentStoryDay?.trim() || undefined
  const skipTodos = opts?.skipTodoLedgerMutation === true
  const next: StoryTimelineState = {
    ...base,
    updatedAt: now,
    costumes: [...base.costumes],
    items: [...base.items],
    foreshadows: [...base.foreshadows],
    todos: backfillTodoOpenedStoryDay([...(base.todos ?? [])], prevStoryDay),
    recentEvents: [...base.recentEvents],
  }

  if (deltaApplied.story_day_end) next.currentStoryDay = deltaApplied.story_day_end
  else if (deltaApplied.story_day) next.currentStoryDay = deltaApplied.story_day
  if (deltaApplied.story_time_end) next.currentStoryTime = deltaApplied.story_time_end
  else if (deltaApplied.story_time) next.currentStoryTime = deltaApplied.story_time
  if (deltaApplied.location) next.currentLocation = deltaApplied.location
  if (deltaApplied.characters_present?.length) {
    next.charactersPresent = [...deltaApplied.characters_present]
  }

  if (deltaApplied.costumes) {
    const map = new Map(next.costumes.map((c) => [costumeKey(c), c]))
    for (const [character, outfit] of Object.entries(deltaApplied.costumes)) {
      const ch = trimCell(character, 64)
      const out = trimCell(outfit, STORY_TIMELINE_COSTUME_DESC_MAX)
      if (!ch || !out) continue
      map.set(costumeKey({ character: ch, outfit: out }), { character: ch, outfit: out })
    }
    next.costumes = [...map.values()].slice(-STORY_TIMELINE_COSTUMES_CAP)
  }

  if (deltaApplied.items?.length) {
    const map = new Map(next.items.map((it) => [itemKey(it.name), it]))
    for (const it of deltaApplied.items) {
      const name = trimCell(it.name, 80)
      if (!name) continue
      const note = trimCell(it.note, 120)
      const tier = normalizeItemTier(it.tier)
      if (note?.startsWith('0') || note?.includes('已消耗') || note?.includes('用完')) {
        map.delete(itemKey(name))
        continue
      }
      map.set(itemKey(name), {
        name,
        ...(note ? { note } : {}),
        ...(tier ? { tier } : {}),
      })
    }
    next.items = [...map.values()].slice(-STORY_TIMELINE_ITEMS_CAP)
  }

  if (deltaApplied.foreshadows?.length) {
    next.foreshadows = mergeOpenResolvedAnchorEntries(
      next.foreshadows,
      deltaApplied.foreshadows,
      STORY_TIMELINE_OPEN_FORESHADOW_CAP,
    )
  }

  // 待办只走台账（手动/线上同步/按近况重建）；摘要 delta.todos 一律忽略，避免旧档复活
  const eventSummary = deltaApplied.event_summary?.trim() || ''
  if (eventSummary) {
    const evt: StoryTimelineEventEntry = {
      id: `evt-${now}-${Math.random().toString(36).slice(2, 7)}`,
      storyDay: deltaApplied.story_day ?? next.currentStoryDay,
      storyTime: deltaApplied.story_time ?? next.currentStoryTime,
      relativeTime: deltaApplied.relative_time,
      location: deltaApplied.location ?? next.currentLocation,
      charactersPresent: deltaApplied.characters_present ?? next.charactersPresent,
      eventSummary: deltaApplied.event_summary!,
      sourceScope: scope,
      recordedAt: now,
    }
    next.recentEvents = [...next.recentEvents, evt].slice(-STORY_TIMELINE_RECENT_EVENTS_CAP)
    if (!skipTodos) {
      next.todos = autoResolveOpenTodosFromEventSummary(
        next.todos ?? [],
        eventSummary,
        next.currentStoryDay,
      )
      next.todos = proposeNewOpenTodosFromEventSummary(
        next.todos ?? [],
        eventSummary,
        next.currentStoryDay ?? prevStoryDay,
      )
    }
  }

  if (!skipTodos) {
    // 剧情日跨过「明天/次日」等期限 → 转入已完成（未兑现则写「并没有在…」）
    next.todos = capStoryTimelineTodos(
      closeTodosPastDeadlineByTimeSkip(next.todos ?? [], next.currentStoryDay, eventSummary),
    )
  }

  return next
}

function formatCostumeLine(c: StoryTimelineCostumeEntry): string {
  return `- ${c.character}：${c.outfit}`
}

export function extractStoryTimelineRowTitleFromRowText(text: string): string {
  const m = String(text ?? '').match(/【摘要标题】([^\n]+)/)
  return normalizeStoryTimelineRowTitle(m?.[1]) ?? ''
}

export function extractStoryTimelineRowKeywordsFromRowText(text: string): string[] {
  const m = String(text ?? '').match(/【摘要关键词】([^\n]+)/)
  if (!m?.[1]) return []
  return normalizeStoryTimelineRowKeywords(m[1].split(/[、,，/\s]+/))
}

export function stripStoryTimelineTitleLine(rowText: string): string {
  return String(rowText ?? '')
    .replace(/^【摘要标题】[^\n]*\n?/, '')
    .replace(/^【摘要关键词】[^\n]*\n?/, '')
    .replace(/^\n+/, '')
    .trim()
}

export function upsertStoryTimelineTitleInRowText(rowText: string, title?: string): string {
  const body = stripStoryTimelineTitleLine(rowText)
  const normalized = normalizeStoryTimelineRowTitle(title)
  if (!normalized) return body
  return body ? `【摘要标题】${normalized}\n\n${body}` : `【摘要标题】${normalized}`
}

export function resolveStoryTimelineRowTitle(
  row: StoryTimelinePlotRow,
  displayText?: string,
): string {
  const fromField = normalizeStoryTimelineRowTitle(row.rowTitle)
  if (fromField) return fromField
  const fromText = extractStoryTimelineRowTitleFromRowText(displayText ?? row.rowText)
  return fromText || '（无标题）'
}

export function resolveStoryTimelineRowKeywords(
  row: StoryTimelinePlotRow,
  displayText?: string,
): string[] {
  const fromField = normalizeStoryTimelineRowKeywords(row.rowKeywords)
  if (fromField.length) return fromField
  return extractStoryTimelineRowKeywordsFromRowText(displayText ?? row.rowText)
}

/** 列表折叠预览：跳过标题与锚点行 */
export function storyTimelineRowPreviewLine(displayText: string): string {
  const lines = String(displayText ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  for (const line of lines) {
    if (line.startsWith('【摘要标题】') || line.startsWith('【摘要关键词】') || line.startsWith('【本轮锚点】')) continue
    if (line.startsWith('【本轮事件】')) return line.replace(/^【本轮事件】/, '').trim().slice(0, 80) || '（本轮事件）'
    return line.slice(0, 80)
  }
  return String(displayText ?? '').slice(0, 80)
}

/** 单轮 JSON timeline 增量 → 可读表格文本（plot 折叠面板用） */
export function formatStoryTimelineDeltaForDisplay(
  delta: StoryTimelineSummaryDelta,
  _opts?: { recordedAtMs?: number | null },
): string {
  if (!hasTimelineDeltaContent(delta)) return ''
  const lines: string[] = []
  const rowTitle = normalizeStoryTimelineRowTitle(delta.row_title)
  if (rowTitle) lines.push(`【摘要标题】${rowTitle}`)
  const rowKeywords = normalizeStoryTimelineRowKeywords(delta.row_keywords)
  if (rowKeywords.length) lines.push(`【摘要关键词】${rowKeywords.join('、')}`)
  const anchor: string[] = []
  const calendarLabel = composeStoryTimelineCalendarAnchorLabel(delta)
  if (calendarLabel) anchor.push(calendarLabel)
  else if (delta.story_day && !hasGregorianYearInStoryDay(delta.story_day)) {
    anchor.push(`剧情日 ${delta.story_day}`)
    const clock = extractClockTimeFromStoryTime(delta.story_time)
    if (delta.story_time && !clock) anchor.push(`时段 ${delta.story_time}`)
    else if (clock) anchor.push(clock)
  }
  if (delta.relative_time) anchor.push(`相对 ${delta.relative_time}`)
  if (delta.location) anchor.push(`地点 ${delta.location}`)
  if (delta.characters_present?.length) anchor.push(`在场 ${delta.characters_present.join('、')}`)
  if (anchor.length) lines.push(`【本轮锚点】${anchor.join(' · ')}`)

  // 服装/物品/伏笔不再写入按轮摘要行；只保留锚点 + 本轮事件

  const eventBody = delta.event_summary?.trim()
  if (eventBody) {
    lines.push(eventBody.includes('\n') ? `【本轮事件】\n${eventBody}` : `【本轮事件】${eventBody}`)
  }

  return lines.join('\n\n').trim()
}

function formatItemLine(it: StoryTimelineItemEntry): string {
  const tier =
    it.tier === 'critical' ? '〔关键〕' : it.tier === 'important' ? '〔重要〕' : ''
  const note = it.note?.trim() ? `（${it.note}）` : ''
  return `- ${tier}${it.name}${note}`
}

export function computeStoryTimelineRowTextHash(text: string): string {
  const s = String(text ?? '').trim()
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(33, h) ^ s.charCodeAt(i)
  }
  return (h >>> 0).toString(16)
}

/** 从单轮 timeline 增量构建 append-only 行（入库 + 向量索引） */
export function buildStoryTimelinePlotRowFromDelta(
  characterId: string,
  delta: StoryTimelineSummaryDelta,
  scope: StoryTimelineEventScope,
  opts?: {
    plotId?: string | null
    recordedAtMs?: number
    mainCharPresence?: StoryTimelineMainCharPresenceOpts
  },
): StoryTimelinePlotRow | null {
  if (!hasTimelineDeltaContent(delta)) return null
  const cid = characterId.trim()
  if (!cid) return null
  const recordedAt =
    typeof opts?.recordedAtMs === 'number' && Number.isFinite(opts.recordedAtMs)
      ? opts.recordedAtMs
      : Date.now()
  const rowText = formatStoryTimelineDeltaForDisplay(delta)
  if (!rowText.trim()) return null
  const textHash = computeStoryTimelineRowTextHash(rowText)
  const rowTitle = normalizeStoryTimelineRowTitle(delta.row_title)
  const rowKeywords = normalizeStoryTimelineRowKeywords(delta.row_keywords)
  const plotId = opts?.plotId?.trim()
  const mainCharPresence: StoryTimelineMainCharPresenceOpts = {
    mainCharacterId: opts?.mainCharPresence?.mainCharacterId ?? cid,
    mainCharAliases: opts?.mainCharPresence?.mainCharAliases,
  }
  const sidePerspective = inferStoryTimelineSidePerspective(delta, mainCharPresence)
  const charactersPresent = delta.characters_present?.length ? [...delta.characters_present] : undefined
  const safePlotKey = plotId
    ? plotId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)
    : ''
  const id = safePlotKey
    ? `tlrow-${cid}-${safePlotKey}`
    : `tlrow-${cid}-${recordedAt}-${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    characterId: cid,
    recordedAt,
    sourceScope: scope,
    ...(plotId ? { plotId } : {}),
    ...(rowTitle ? { rowTitle } : {}),
    ...(rowKeywords.length ? { rowKeywords } : {}),
    rowText,
    textHash,
    ...(sidePerspective ? { sidePerspective: true } : {}),
    ...(charactersPresent?.length ? { charactersPresent } : {}),
  }
}

/** 手动新增或编辑摘要行（占位符原文入库） */
export function buildManualStoryTimelinePlotRow(params: {
  characterId: string
  rowText: string
  sourceScope: StoryTimelineEventScope
  rowTitle?: string
  recordedAtMs?: number
  existingId?: string
  plotId?: string
}): StoryTimelinePlotRow | null {
  const cid = params.characterId.trim()
  const normalizedTitle = normalizeStoryTimelineRowTitle(params.rowTitle)
  const rowText = upsertStoryTimelineTitleInRowText(params.rowText, normalizedTitle)
    .trim()
    .slice(0, 4000)
  if (!cid || !rowText) return null
  const recordedAt =
    typeof params.recordedAtMs === 'number' && Number.isFinite(params.recordedAtMs)
      ? Math.floor(params.recordedAtMs)
      : Date.now()
  const id =
    params.existingId?.trim() ||
    `tlrow-manual-${cid}-${recordedAt}-${Math.random().toString(36).slice(2, 8)}`
  const plotId = params.plotId?.trim()
  const titleFromText = extractStoryTimelineRowTitleFromRowText(rowText)
  const rowTitle = normalizedTitle ?? titleFromText
  return {
    id,
    characterId: cid,
    recordedAt,
    sourceScope: params.sourceScope,
    ...(plotId ? { plotId: plotId.slice(0, 64) } : {}),
    ...(rowTitle ? { rowTitle } : {}),
    rowText,
    textHash: computeStoryTimelineRowTextHash(rowText),
  }
}

/** 编辑状态锚点时打开的初始正文（优先手动块，否则结构化格式化） */
export function resolveStoryTimelineStateBlockForEdit(
  state: StoryTimelineState | null | undefined,
): string {
  if (!state) return ''
  const manual = state.manualAnchorBlock?.trim()
  if (manual) return manual
  return formatStoryTimelineCurrentStateForPrompt(state)
}

export function hasStructuredStoryTimelineState(state: StoryTimelineState | null | undefined): boolean {
  if (!state) return false
  return !!(
    state.currentLocation?.trim() ||
    state.currentStoryDay?.trim() ||
    state.currentStoryTime?.trim() ||
    state.charactersPresent?.length ||
    state.costumes.length ||
    state.items.length ||
    state.foreshadows.length ||
    (state.todos?.length ?? 0) ||
    state.recentEvents.length
  )
}

/** 供摘要 API 注入：仍 open 的旧动机（融入本轮「事件」叙述；勿再输出伏笔分区） */
export function formatStoryTimelineOpenAnchorsForSummaryPrompt(
  state: StoryTimelineState | null | undefined,
): string {
  if (!state || state.manualAnchorBlock?.trim()) return ''
  const openFore = state.foreshadows.filter((f) => f.status === 'open')
  if (!openFore.length) return ''

  const parts: string[] = [
    '【系统已有·未收动机（对照正文末尾；已收束者写入「事件」回溯带过，勿再输出伏笔分区）】',
    '未收动机（人物内心 / 悬念；非具体待办）：\n' +
      openFore.map((f) => `- ${f.text}`).join('\n'),
    STORY_TIMELINE_OPEN_ANCHORS_RECYCLE_RULES,
  ]
  return parts.join('\n\n').trim()
}

export function isMainCharTimelinePlaceholder(token: string): boolean {
  const t = String(token ?? '').trim()
  return t === STORY_TIMELINE_MAIN_CHAR_PLACEHOLDER || t === '{{archive_char}}'
}

/** 主角色在场判定：占位符 + 绑定真名/昵称/备注 + {{id:主角色}} */
export type StoryTimelineMainCharPresenceOpts = {
  mainCharacterId?: string
  mainCharAliases?: readonly string[]
}

function storyTimelinePresenceTokenKey(token: string): string {
  return String(token ?? '').trim().toLowerCase()
}

/** 从人设卡字段收集可匹配的显示名（去重） */
export function buildStoryTimelineMainCharAliasList(names: {
  name?: string | null
  wechatNickname?: string | null
  remark?: string | null
}): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of [names.name, names.wechatNickname, names.remark]) {
    const t = String(raw ?? '').trim()
    if (!t) continue
    const key = storyTimelinePresenceTokenKey(t)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

export function buildStoryTimelineMainCharPresenceOpts(
  characterId: string,
  character:
    | {
        name?: string | null
        wechatNickname?: string | null
        remark?: string | null
      }
    | null
    | undefined,
): StoryTimelineMainCharPresenceOpts {
  const cid = characterId.trim()
  const aliases = buildStoryTimelineMainCharAliasList(character ?? {})
  return {
    ...(cid ? { mainCharacterId: cid } : {}),
    ...(aliases.length ? { mainCharAliases: aliases } : {}),
  }
}

/** 在场 token 是否指约会主角色：{{char}} / {{archive_char}} / {{id:主角色}} / 绑定真名 */
export function isMainCharTimelineToken(
  token: string,
  opts?: StoryTimelineMainCharPresenceOpts,
): boolean {
  const t = String(token ?? '').trim()
  if (!t) return false
  if (isMainCharTimelinePlaceholder(t)) return true
  const cid = opts?.mainCharacterId?.trim()
  if (cid) {
    const idMatch = t.match(/^\{\{id:([^}]+)\}\}$/)
    if (idMatch?.[1]?.trim() === cid) return true
  }
  const tokKey = storyTimelinePresenceTokenKey(t)
  for (const alias of opts?.mainCharAliases ?? []) {
    if (storyTimelinePresenceTokenKey(alias) === tokKey) return true
  }
  return false
}

export function isMainCharPresentInTimelineTokens(
  tokens: readonly string[],
  opts?: StoryTimelineMainCharPresenceOpts,
): boolean {
  return tokens.some((token) => isMainCharTimelineToken(token, opts))
}

export function extractCostumeCharacterKeysFromRowText(rowText: string): string[] {
  const block = String(rowText ?? '').match(/【服装变更】\s*\n([\s\S]*?)(?=\n\n【|$)/)?.[1] ?? ''
  const keys: string[] = []
  for (const line of block.split('\n')) {
    const m = line.match(/^-\s*([^：:]+)[：:]/)
    const key = m?.[1]?.trim()
    if (key) keys.push(key)
  }
  return keys
}

export function extractMainCharPresenceTokensFromTimelineDelta(
  delta: StoryTimelineSummaryDelta,
): string[] {
  const tokens = [...(delta.characters_present ?? [])]
  if (delta.costumes && typeof delta.costumes === 'object') {
    tokens.push(...Object.keys(delta.costumes))
  }
  return tokens
}

export function isMainCharPresentInTimelineDelta(
  delta: StoryTimelineSummaryDelta,
  opts?: StoryTimelineMainCharPresenceOpts,
): boolean {
  return isMainCharPresentInTimelineTokens(extractMainCharPresenceTokensFromTimelineDelta(delta), opts)
}

/** 从摘要正文【本轮锚点】行解析在场列表（兼容旧行无 charactersPresent 字段） */
export function parseCharactersPresentFromRowText(rowText: string): string[] {
  const anchorLine = String(rowText ?? '').match(/【本轮锚点】[^\n]*/)?.[0] ?? ''
  const presentMatch = anchorLine.match(/在场\s+(.+)$/)
  if (!presentMatch?.[1]) return []
  return presentMatch[1]
    .split(/[、,，]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

export function inferStoryTimelineSidePerspective(
  delta: StoryTimelineSummaryDelta,
  opts?: StoryTimelineMainCharPresenceOpts,
): boolean {
  if (isMainCharPresentInTimelineDelta(delta, opts)) return false
  if (delta.side_perspective === true) return true
  const present = delta.characters_present ?? []
  if (!present.length) return false
  return true
}

/** 从摘要行提取【本轮事件】全文（供向量索引；兼容同行/多行） */
export function resolveStoryTimelineRowEventSummary(row: StoryTimelinePlotRow): string {
  const text = String(row.rowText ?? '')
  const m = text.match(/【本轮事件】\s*\n?([\s\S]*?)(?=\n【[^】]+】|$)/)
  return trimEventSummary(m?.[1] ?? '') ?? ''
}

/** 向量语义召回索引文本：标题 + 关键词 + 本轮事件（非全文 rowText） */
export function resolveStoryTimelineRowVectorEmbedText(row: StoryTimelinePlotRow): string {
  const title = resolveStoryTimelineRowTitle(row)
  const keywords = resolveStoryTimelineRowKeywords(row)
  const eventSummary = resolveStoryTimelineRowEventSummary(row)
  const parts: string[] = [title]
  if (keywords.length) parts.push(`关键词：${keywords.join('、')}`)
  if (eventSummary) parts.push(`【本轮事件】${eventSummary}`)
  return parts.join('\n')
}

export function resolveStoryTimelineRowCharactersPresent(row: StoryTimelinePlotRow): string[] {
  if (row.charactersPresent?.length) return [...row.charactersPresent]
  return parseCharactersPresentFromRowText(row.rowText)
}

export function isMainCharPresentInStoryTimelineRow(
  row: StoryTimelinePlotRow,
  opts?: StoryTimelineMainCharPresenceOpts,
): boolean {
  const present = resolveStoryTimelineRowCharactersPresent(row)
  const tokens = [...present, ...extractCostumeCharacterKeysFromRowText(row.rowText)]
  if (!tokens.length) return row.sidePerspective !== true
  return isMainCharPresentInTimelineTokens(tokens, {
    mainCharacterId: opts?.mainCharacterId ?? row.characterId,
    mainCharAliases: opts?.mainCharAliases,
  })
}

function extractPublicAnchorHintFromRowText(rowText: string): string {
  const anchorBody = String(rowText ?? '').match(/【本轮锚点】([^\n]+)/)?.[1]?.trim() ?? ''
  if (!anchorBody) return ''
  return anchorBody
    .replace(/在场\s+[^·]+(?=·|$)/, '')
    .replace(/^·+|·+$/g, '')
    .trim()
}

/** 主角色未在场时：注入 redact 版，避免全知复述侧幕细节 */
export function formatStoryTimelineSidePerspectiveRedactedRow(row: StoryTimelinePlotRow): string {
  const title = resolveStoryTimelineRowTitle(row)
  const anchorHint = extractPublicAnchorHintFromRowText(row.rowText)
  const anchorPart = anchorHint ? ` · ${anchorHint}` : ''
  return (
    `【${STORY_TIMELINE_SIDE_PERSPECTIVE_REDACT_TAG}】${title}${anchorPart}\n` +
    `（用户曾与在场角色发生线下互动；**具体对白、协议与细节 {{char}} 不知**；后续若由 {{char}} 提起，只能写寻踪/疑惑类非全知台词，如「你前面去哪了？找半天找不到你」，**禁止**复述侧幕内具体谈话内容。）`
  )
}

export type StoryTimelineRowPromptInjectOpts = {
  /** 对侧幕且 {{char}} 未在场的行 redact（默认 true） */
  redactSidePerspectiveForMainChar?: boolean
  mainCharPresence?: StoryTimelineMainCharPresenceOpts
  /** 当前剧情日（毫秒）；用于剔除过期日程类【本轮事件】与 stale 待办 */
  currentStoryCalendarMs?: number | null
}

export function formatStoryTimelineRowForPromptInject(
  row: StoryTimelinePlotRow,
  opts?: StoryTimelineRowPromptInjectOpts,
): string {
  const redact = opts?.redactSidePerspectiveForMainChar !== false
  const presence = {
    mainCharacterId: opts?.mainCharPresence?.mainCharacterId ?? row.characterId,
    mainCharAliases: opts?.mainCharPresence?.mainCharAliases,
  }
  if (redact && row.sidePerspective === true && !isMainCharPresentInStoryTimelineRow(row, presence)) {
    return formatStoryTimelineRowBodyForTemporalInject(
      formatStoryTimelineSidePerspectiveRedactedRow(row),
      opts?.currentStoryCalendarMs ?? null,
    )
  }
  return formatStoryTimelineRowBodyForTemporalInject(row.rowText, opts?.currentStoryCalendarMs ?? null)
}

export const STORY_TIMELINE_SIDE_PERSPECTIVE_KNOWLEDGE_RULES =
  `【侧幕摘要·信息边界】标有「${STORY_TIMELINE_SIDE_PERSPECTIVE_REDACT_TAG}」的条目：{{char}} **未亲历**该段；不得写成全知旁观或复述用户与他人私下的具体对白/协议；仅可写寻踪、时段错位感或「你去哪了」类合理追问。`.trim()

const STORY_TIMELINE_ROW_OBLIGATION_SECTION_HEADERS = new Set([
  '【服装变更】',
  '【物品变更】',
  '【伏笔·人物动机】',
  '【待办】',
  '【已完成事项】',
])

const STORY_TIMELINE_TODO_SECTION_HEADERS = new Set(['【待办】', '【已完成事项】'])

function isStoryTimelineTodoSectionHeader(header: string): boolean {
  return header.startsWith('【待办') || header.startsWith('【已完成')
}

function stripStoryTimelineSectionsByHeaders(
  rowText: string,
  headers: ReadonlySet<string>,
  opts?: { matchTodoHeaderPrefix?: boolean },
): string {
  const lines = String(rowText ?? '').split('\n')
  const out: string[] = []
  let skipSection = false
  for (const line of lines) {
    const t = line.trim()
    // 兼容「【本轮事件】正文同在一行」：只认标题段，勿要求整行以】结尾
    const header = t.match(/^【[^】]+】/)?.[0]
    if (header) {
      const hit =
        headers.has(header) ||
        (opts?.matchTodoHeaderPrefix === true && isStoryTimelineTodoSectionHeader(header))
      if (hit) {
        skipSection = true
        continue
      }
      skipSection = false
    }
    if (!skipSection) out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** 历史摘要行：剥离服装/物品/伏笔/待办分区，只留锚点与事件等 */
export function stripStoryTimelineRowObligationSections(rowText: string): string {
  return stripStoryTimelineSectionsByHeaders(rowText, STORY_TIMELINE_ROW_OBLIGATION_SECTION_HEADERS, {
    matchTodoHeaderPrefix: true,
  })
}

/** 旧分区摘要正文（含服装/物品/伏笔/待办段） */
export function storyTimelineRowTextLooksLegacyPartitioned(rowText: string): boolean {
  return /【服装变更】|【物品变更】|【伏笔·人物动机】|【待办】|【已完成事项】/.test(
    String(rowText ?? ''),
  )
}

/**
 * 将库内旧分区摘要行本地瘦身：去掉服装/物品/伏笔/待办，只留标题/关键词/锚点/事件。
 * @returns 写回条数
 */
export async function slimStoredStoryTimelineLegacyPartitionsForCharacter(
  characterId: string,
): Promise<number> {
  const cid = characterId.trim()
  if (!cid) return 0
  const { personaDb } = await import('../newFriendsPersona/idb')
  const rows = await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)
  let written = 0
  for (const row of rows) {
    if (!storyTimelineRowTextLooksLegacyPartitioned(row.rowText)) continue
    const next = stripStoryTimelineRowObligationSections(row.rowText)
    if (!next || next === String(row.rowText ?? '').trim()) continue
    await personaDb.upsertStoryTimelinePlotRow({
      ...row,
      rowText: next,
      textHash: computeStoryTimelineRowTextHash(next),
      embedding: undefined,
      embeddingHash: undefined,
      embeddingProvider: undefined,
      embeddingModelId: undefined,
    })
    written += 1
  }
  return written
}

/** 从手动锚点等正文中剔除待办段（清空台账 / 注入时以 state.todos 为准） */
export function stripStoryTimelineTodoSectionsFromText(rowText: string): string {
  return stripStoryTimelineSectionsByHeaders(rowText, STORY_TIMELINE_TODO_SECTION_HEADERS, {
    matchTodoHeaderPrefix: true,
  })
}

function formatTodoLedgerSectionsFromState(
  state: StoryTimelineState,
  opts?: { currentStoryCalendarMs?: number | null },
): string {
  const lines: string[] = []
  const openTodos = (state.todos ?? []).filter((t) => t.status === 'open')
  const currentStoryMs =
    opts?.currentStoryCalendarMs ??
    (state.currentStoryDay?.trim() ? storyCalendarDayStartMs(state.currentStoryDay.trim()) : null)
  const openTodosFiltered = openTodos.filter(
    (t) => !isStaleOpenTodoRelativeSchedule(t.text, currentStoryMs),
  )
  if (openTodosFiltered.length) {
    lines.push('【待办】\n' + openTodosFiltered.map((t) => `- ${t.text}`).join('\n'))
  }

  const resolvedTodos = (state.todos ?? [])
    .filter((t) => t.status === 'resolved')
    .slice(-STORY_TIMELINE_RESOLVED_TODO_PROMPT_CAP)
  if (resolvedTodos.length) {
    lines.push(
      '【已完成事项】（已收束，勿再当作未完待办；含逾期未做的结论）\n' +
        resolvedTodos
          .map((t) => `- ${String(t.resolvedNote ?? t.text).trim() || t.text}`)
          .join('\n'),
    )
  }
  return lines.join('\n\n').trim()
}

/** 当前世界状态快照（地点/服装/物品/动机伏笔/待办；不含历史事件列表） */
export function formatStoryTimelineCurrentStateForPrompt(
  state: StoryTimelineState | null | undefined,
  opts?: { currentStoryCalendarMs?: number | null },
): string {
  if (!state) return ''
  const todoLedger = formatTodoLedgerSectionsFromState(state, opts)
  const manual = state.manualAnchorBlock?.trim()
  if (manual) {
    // 手动锚点可保留地点/服装等，但待办必须以台账为准（避免清空后仍注入旧【待办】）
    const cleaned = stripStoryTimelineTodoSectionsFromText(manual)
    return [cleaned, todoLedger].filter(Boolean).join('\n\n').trim()
  }
  const lines: string[] = []

  const anchor: string[] = []
  const storyCal = composeStoryTimelineCalendarAnchorLabel({
    story_day: state.currentStoryDay,
    story_time: state.currentStoryTime,
  })
  if (storyCal) {
    anchor.push(storyCal)
  } else if (state.currentStoryDay?.trim()) {
    anchor.push(`剧情日 ${state.currentStoryDay.trim()}`)
    if (state.currentStoryTime?.trim()) anchor.push(`时段 ${state.currentStoryTime.trim()}`)
  } else if (state.currentStoryTime?.trim()) {
    anchor.push(`时段 ${state.currentStoryTime.trim()}`)
  }
  if (state.currentLocation) anchor.push(`地点 ${state.currentLocation}`)
  if (state.charactersPresent?.length) {
    anchor.push(`在场 ${state.charactersPresent.join('、')}`)
  }
  if (anchor.length) lines.push(`【当前锚点】${anchor.join(' · ')}`)

  if (state.costumes.length) {
    lines.push('【服装锁定】\n' + state.costumes.map(formatCostumeLine).join('\n'))
  }

  if (state.items.length) {
    lines.push('【物品追踪】\n' + state.items.map(formatItemLine).join('\n'))
  }

  const openFore = state.foreshadows.filter((f) => f.status !== 'resolved')
  if (openFore.length) {
    lines.push(
      '【伏笔·人物动机】\n' +
        openFore.map((f) => `- ${f.text}`).join('\n'),
    )
  }

  if (todoLedger) lines.push(todoLedger)

  return lines.join('\n\n').trim()
}

/** 仅待办台账（未完 + 最近已完成），供线上同步 / 思维溯源「待办事项」板块 */
export function formatStoryTimelineTodoLedgerForPrompt(
  state: StoryTimelineState | null | undefined,
  opts?: { currentStoryCalendarMs?: number | null },
): string {
  if (!state) return ''
  return formatTodoLedgerSectionsFromState(state, opts)
}

/**
 * 向量/语义召回通用硬规则（时间轴行表 + 长期记忆共用措辞）。
 * 贴在召回块最前：已发生 ≠ 可续写场面。
 */
export const VECTOR_RECALL_PAST_EVENT_HARD_RULE =
  `【向量召回·已发生硬规则】下列由向量/语义召回注入的内容**全部是已发生的历史事件**，**不是**本轮正在发生的场面，也**不是**可接着演的剧本。` +
  `**禁止**复述、重演、展开记忆里的事情经过、对白或场景描写；` +
  `**仅可**在相关时用回溯语气当作历史事件一笔带过（如「想起上次…」「那天之后…」），且不得覆盖【当前状态】/尚未总结末尾最新事实。`.trim()

/** 供 prompt 注入：当前快照 + 近端摘要行 + 向量召回行 */
export const STORY_TIMELINE_VECTOR_RECALL_CANON_RULES =
  `${VECTOR_RECALL_PAST_EVENT_HARD_RULE}\n` +
  `【历史回忆·事实铁律】下列「语义召回」条目为**摘要表已记载事实**（高于写作灵感与自行发挥）。` +
  `玩家提起相关往事时：**仅可**引用各行【摘要标题】【摘要关键词】【本轮事件】等摘要字段中**已写明**的内容；` +
  `**禁止**编造摘要未出现的对白、物品、交易或情节；**禁止**把摘要当作灵感扩写成未记载细节。`

export const STORY_TIMELINE_HISTORICAL_ROW_TEMPORAL_RULES =
  `【历史摘要·时效铁律】「语义召回」「近端摘要」各行均保留注入；须对照各行【时效·已发生】横幅与【本轮锚点】理解：**当前剧情「现在」以【当前状态】锚点为准**。若某行【本轮锚点】公历日**早于**当前剧情日（非同一日），该行内容为**已发生往事**——提及须用过去时/回溯语气（如「昨日…」「五个月前…」），**禁止**把其中的「下周五 / 即将 / 提醒考核」等**当时面向未来的措辞**当作本轮尚未到来的安排。**未完结待办与动机伏笔仅以【当前状态】为准**（各行【待办】【伏笔】已剥离）。`.trim()

/** 约会 prompt 裁剪：保留语义召回段，避免 head 截断丢掉向量命中 */
export function clipStoryTimelinePromptBlock(raw: string, cap: number): string {
  const t = String(raw ?? '').trim()
  if (!t || t.length <= cap) return t

  const marker = '【语义召回·历史剧情摘要'
  const vectorIdx = t.indexOf(marker)
  if (vectorIdx < 0) {
    return `${t.slice(0, cap)}\n…【剧情时间轴：过长已截断】`
  }

  const vectorPart = t.slice(vectorIdx)
  const headPart = t.slice(0, vectorIdx).trimEnd()
  const joiner = '\n…【剧情时间轴：中段已压缩】\n'

  if (vectorPart.length + joiner.length >= cap) {
    const headBudget = Math.max(0, Math.min(headPart.length, Math.floor(cap * 0.12)))
    const vecBudget = Math.max(0, cap - headBudget - joiner.length)
    const head = headBudget > 0 ? `${headPart.slice(0, headBudget)}${joiner}` : ''
    return `${head}${vectorPart.slice(0, vecBudget)}\n…【剧情时间轴：过长已截断】`
  }

  const headBudget = Math.max(0, cap - vectorPart.length - joiner.length)
  return `${headPart.slice(0, headBudget)}${joiner}${vectorPart}`
}

export function hasStoryTimelineVectorRecallInBlock(block: string): boolean {
  return String(block ?? '').includes('【语义召回·历史剧情摘要')
}

/**
 * 将已格式化的剧情时间轴注入块拆成「当前状态」与「语义召回/近端摘要」，
 * 便于 prompt 按优先级分两段注入（当前态靠前，召回垫后）。
 */
export function splitStoryTimelineInjectBody(block: string): {
  currentState: string
  recallAndNear: string
} {
  const t = String(block ?? '').trim()
  if (!t) return { currentState: '', recallAndNear: '' }

  const recallMarkers = ['【语义召回·历史剧情摘要', '【近端剧情摘要'] as const
  let splitAt = -1
  for (const m of recallMarkers) {
    const i = t.indexOf(m)
    if (i >= 0 && (splitAt < 0 || i < splitAt)) splitAt = i
  }

  if (splitAt < 0) {
    // 仅有当前状态（或旧格式整块）：整块视为当前态
    return { currentState: t, recallAndNear: '' }
  }

  const currentState = t.slice(0, splitAt).trim()
  const recallAndNear = t.slice(splitAt).trim()
  return { currentState, recallAndNear }
}

export function formatStoryTimelineInjectBody(params: {
  state: StoryTimelineState | null | undefined
  recentRows: StoryTimelinePlotRow[]
  vectorRows?: StoryTimelineVectorRecallHit[]
  rowInjectOpts?: StoryTimelineRowPromptInjectOpts
  currentStoryCalendarMs?: number | null
}): string {
  const rowOpts: StoryTimelineRowPromptInjectOpts = {
    ...params.rowInjectOpts,
    currentStoryCalendarMs:
      params.currentStoryCalendarMs ?? params.rowInjectOpts?.currentStoryCalendarMs ?? null,
  }
  const currentStoryMs = rowOpts.currentStoryCalendarMs ?? null
  const parts: string[] = []
  const stateBlock = formatStoryTimelineCurrentStateForPrompt(params.state, {
    currentStoryCalendarMs: currentStoryMs,
  })
  if (stateBlock) {
    parts.push(`【当前状态·${STORY_TIMELINE_INJECT_LABEL_STATE}】\n${stateBlock}`)
  }

  let hasSidePerspectiveRedact = false
  const recent = params.recentRows
  const recentIds = new Set(recent.map((r) => r.id))
  const vector = (params.vectorRows ?? []).filter((hit) => !recentIds.has(hit.row.id))

  const formatInjectRow = (row: StoryTimelinePlotRow) => {
    const body = formatStoryTimelineRowForPromptInject(row, rowOpts)
    return body.trim() ? body : null
  }

  if (vector.length) {
    const vectorBlocks = vector
      .map((hit, i) => {
        const body = formatInjectRow(hit.row)
        if (!body) return null
        const simPct = Math.round(hit.sim * 1000) / 10
        const title = resolveStoryTimelineRowTitle(hit.row)
        if (body.includes(STORY_TIMELINE_SIDE_PERSPECTIVE_REDACT_TAG)) hasSidePerspectiveRedact = true
        return `--- 召回 ${i + 1} · ${title} · 相似 ${simPct}% ---\n${body}`
      })
      .filter(Boolean)
    if (vectorBlocks.length) {
      parts.push(
        `${STORY_TIMELINE_VECTOR_RECALL_CANON_RULES}\n` +
          `【语义召回·历史剧情摘要（按向量语义匹配）】\n` +
          vectorBlocks.join('\n\n'),
      )
    }
  }

  if (recent.length) {
    const recentBlocks = recent
      .map((r, i) => {
        const title = resolveStoryTimelineRowTitle(r)
        const body = formatInjectRow(r)
        if (!body) return null
        if (body.includes(STORY_TIMELINE_SIDE_PERSPECTIVE_REDACT_TAG)) hasSidePerspectiveRedact = true
        return `--- 摘要 ${i + 1} · ${title} · ${STORY_TIMELINE_INJECT_LABEL_RECENT} ---\n${body}`
      })
      .filter(Boolean)
      .join('\n\n')
    if (recentBlocks) {
      parts.push(
        `【近端剧情摘要（最近 ${recent.length} 轮，由旧到新；须与末尾情绪方向一致）】\n` +
          recentBlocks,
      )
    }
  }

  if (!parts.length) return ''
  const footer =
    `（剧情时间轴：当前状态 + 语义召回历史摘要 + 近端摘要；回复须与锚点、服装、物品一致；**语义召回须服从【向量召回·已发生硬规则】与【历史回忆·事实铁律】**（禁止复述经过，仅可历史提起）；**未收动机伏笔与未完结待办**才须承接，已完结者勿再引用；历史摘要仅补事实勿翻转情绪主客体；**描述故事内时空，与每条前缀「系统落库时刻」及【当前时间】独立，勿混用**。` +
    ` ${STORY_TIMELINE_HISTORICAL_ROW_TEMPORAL_RULES}` +
    (hasSidePerspectiveRedact ? ` ${STORY_TIMELINE_SIDE_PERSPECTIVE_KNOWLEDGE_RULES}` : '') +
    `）`
  return `${parts.join('\n\n')}\n\n${footer}`
}

const STORY_TIMELINE_INJECT_ROW_HEADER_RE =
  /---\s*(?:摘要|召回)\s*(\d+)\s*·\s*(.+?)\s*·\s*(?:相似\s*([\d.]+)%|(近端固定|向量命中))\s*---\s*\n([\s\S]*?)(?=\n\n---\s*(?:摘要|召回)|\n\n（剧情时间轴|$|\n\n【)/g

/** 从已格式化的剧情时间轴注入块解析各行（思维溯源 UI） */
export function parseStoryTimelineInjectBodyForTrace(text: string): StoryTimelineInjectTraceRow[] {
  const raw = String(text ?? '').trim()
  if (!raw) return []
  const out: StoryTimelineInjectTraceRow[] = []

  const stateMatch = raw.match(/【当前状态·合并快照】\s*\n([\s\S]*?)(?=\n\n【|$)/)
  if (stateMatch?.[1]?.trim()) {
    out.push({
      injectKind: 'state',
      label: STORY_TIMELINE_INJECT_LABEL_STATE,
      content: stateMatch[1].trim(),
    })
  }

  const rowRe = new RegExp(STORY_TIMELINE_INJECT_ROW_HEADER_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = rowRe.exec(raw)) !== null) {
    const titleLabel = m[2]?.trim()
    const simRaw = m[3]?.trim()
    const kindLabel = m[4]?.trim()
    const body = m[5]?.trim()
    if (!body) continue
    const injectKind: StoryTimelineInjectKind =
      simRaw || kindLabel === STORY_TIMELINE_INJECT_LABEL_VECTOR ? 'vector' : 'recent'
    const sim = simRaw ? Number(simRaw) / 100 : undefined
    const isHistorical = body.includes('【时效·已发生】')
    out.push({
      injectKind,
      label: titleLabel || kindLabel || (injectKind === 'vector' ? STORY_TIMELINE_INJECT_LABEL_VECTOR : STORY_TIMELINE_INJECT_LABEL_RECENT),
      content: body,
      ...(isHistorical ? { isHistorical: true } : {}),
      ...(typeof sim === 'number' && Number.isFinite(sim) ? { relevanceScore: sim } : {}),
    })
  }

  if (out.length) return out

  // 兼容旧格式（无逐行标签）
  const legacyRecent = raw.match(/【近端剧情摘要[^\n]*】\s*\n([\s\S]*?)(?=\n\n【语义召回|$)/)
  if (legacyRecent?.[1]?.trim()) {
    const blocks = legacyRecent[1].split(/^---\s*(?:摘要|召回)\s*\d+\s*---\s*$/m).filter(Boolean)
    blocks.forEach((block) => {
      const content = block.trim()
      if (!content) return
      out.push({ injectKind: 'recent', label: STORY_TIMELINE_INJECT_LABEL_RECENT, content })
    })
  }
  const legacyVector = raw.match(/【语义召回·历史剧情摘要】\s*\n([\s\S]*?)(?=\n\n（剧情时间轴|$)/)
  if (legacyVector?.[1]?.trim()) {
    const blocks = legacyVector[1].split(/^---\s*(?:摘要|召回)\s*\d+\s*---\s*$/m).filter(Boolean)
    blocks.forEach((block) => {
      const content = block.trim()
      if (!content) return
      out.push({ injectKind: 'vector', label: STORY_TIMELINE_INJECT_LABEL_VECTOR, content })
    })
  }
  if (!out.length && !stateMatch && raw) {
    out.push({ injectKind: 'state', label: STORY_TIMELINE_INJECT_LABEL_STATE, content: raw })
  }
  return out
}

/** @deprecated 请用 formatStoryTimelineInjectBody；保留兼容旧调用 */
export function formatStoryTimelineForPrompt(state: StoryTimelineState | null | undefined): string {
  return formatStoryTimelineInjectBody({ state, recentRows: [] })
}
