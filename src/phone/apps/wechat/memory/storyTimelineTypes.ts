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

/** 具体可执行待办 / 承诺 / 日程 */
export type StoryTimelineTodoEntry = StoryTimelineOpenAnchorEntry

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
export const STORY_TIMELINE_COSTUMES_CAP = 24
export const STORY_TIMELINE_ITEMS_CAP = 32
/** 单角色服装描述上限（字）；须容纳上装/下装/外套/鞋履与可见状态 */
export const STORY_TIMELINE_COSTUME_DESC_MAX = 280

/** 单条地点描述上限（字）；须容纳店名/楼层/区域等具体锚点 */
export const STORY_TIMELINE_LOCATION_MAX = 200
/** event_summary 入库上限（字）；模型建议写 80～100 字 */
export const STORY_TIMELINE_EVENT_SUMMARY_MAX = 120
/** 摘要短标题入库上限（字）；模型建议 4～10 字 */
export const STORY_TIMELINE_ROW_TITLE_MAX = 14
/** 单条摘要关键词字数上限 */
export const STORY_TIMELINE_ROW_KEYWORD_CHAR_MAX = 5
/** 每条摘要关键词数量范围 */
export const STORY_TIMELINE_ROW_KEYWORDS_MIN = 3
export const STORY_TIMELINE_ROW_KEYWORDS_MAX = 5

/** 伏笔 / 待办：写法与结尾快照（摘要 JSON 与回收规则共用） */
export const STORY_TIMELINE_FORESHADOW_TODO_WRITING_RULES = `
【伏笔 / 待办·写法铁律】
- 二者均是**本轮剧情全文读毕后的结尾快照**：只记录正文（或材料）**读至末尾时**仍悬而未决的内容；不是段落中途的临时念头，**禁止**与结尾已交代的事实相矛盾。
- **与结尾对齐（最高优先级）**：以正文**最后一段 / 最后几屏**为准。若结尾已写明作业写完、约定已兑现、人物已动身或问题已解决，则**禁止**再写 open 的「未完成作业」「尚未赴约」等；应**省略** todos，或对【系统已有·未收锚点】中对应项输出 status:"resolved"。
- **foreshadows（人物动机 / 内心拉扯 / 关系悬念）**：写「为何犹豫、想要什么又怕失去什么、对谁隐瞒什么、关系里还有什么没说破」；**禁止**写成待办清单或「须做某事」句式。
  - 合格示例：「{{char}} 想今晚把作业写完，但怕拖太晚挤占自己的休息时间，仍在纠结要不要现在开始」
  - 不合格：「{{char}} 要写作业」（这是待办，不是动机）
- **todos（结尾仍有效的具体事项）**：仅当**结尾事实**仍为「尚未完成且仍须处理」的可核对事项时，才写 open。
  - 合格示例（结尾仍未开始）：「{{char}} 数学作业尚未动笔，且仍计划今晚完成」
  - 不合格：正文末尾已写完作业，却写「{{char}} 未完成作业」
- 本轮结尾无新动机 / 内心线则**省略** foreshadows；无未完结具体事项则**省略** todos；勿输出空数组。`.trim()

/** 摘要 / 同轮 JSON：未收锚点回收说明（注入「系统已有未收清单」时复用） */
export const STORY_TIMELINE_OPEN_ANCHORS_RECYCLE_RULES = `
- **伏笔 foreshadows** 与 **待办 todos** 是两类字段，不可混写；须先遵守上方【伏笔 / 待办·写法铁律】中的**结尾快照**与**与结尾对齐**要求。
- 用户若提供【系统已有·未收锚点】：对照**正文末尾**是否已兑现；已完结 / 已取消 / 已无后续者，**必须**在对应数组输出 {"text":"与已有条目一致或高度同义","status":"resolved"}，以便系统停止将其作为写作指导；仍悬而未决且无新变化时可不重复输出 open。
- 仅当**结尾快照**下出现**新的**动机拉扯或未完结具体事项时，才追加 {"text":"…","status":"open"}。`.trim()

export const STORY_TIMELINE_SUMMARY_JSON_FIELDS = `
- "timeline"（可选对象；材料中有可核对的时空、服装、物品、动机伏笔、待办或本轮关键事件时**应尽量填写**）：
  - "row_title": string，本轮摘要短标题（建议 4～10 字，可含问号/顿号；如「温柔瞬间」「化解冲突」「没听见？是没看见」；须概括本轮情绪或转折，勿写「第 N 轮」等序号）
  - "row_keywords": string[]，**必填 3～5 个**摘要检索词（每条 **≤5 个汉字**；写场景/人物/情绪/物品/关系等**可检索名词或短语**，如「晚自习」「误会」「牵手」「道歉」；禁止整句、禁止标点堆叠、禁止与 row_title 完全重复）
  - "story_day": string，**含年份的公历剧情日**（本轮开始或单点时刻之日），如 "2025年10月1日"；相对进度写 relative_time，勿用「第3天」代替公历；**禁止**写生成当日/落库时刻
  - "story_time": string，**24 小时制钟点**（本轮开始或单点时刻），如 "19:30"；材料仅有「傍晚/深夜」时须推断合理 HH:mm
  - "story_day_end": string（可选），本轮正文**结束**时的公历日（须含年份）；仅当剧情明确跨越时段时填写
  - "story_time_end": string（可选），本轮正文**结束**钟点（HH:mm）；与 story_day_end 或 story_day 组成时间段；单点时刻可省略 end 字段
  - "relative_time": string，相对时间，如 "昨天"、"三天前"、"约会第 3 天"
  - "location": string，**须写可区分的具体地点**（建议 12～80 字）：含店名/路名/楼层或区域/包厢号等可核对锚点；**禁止**仅写「饭馆、餐厅、酒店、咖啡厅、学校、公司、家里」等空泛类名；可写「城东·云隐居日式料理·二楼靠窗席」「蓝海酒店 1208 套房客厅」
  - "characters_present": string[]，在场角色（用 {{user}} / {{char}} / {{id:UUID}}，勿写真名）
  - "costumes": object，**仅写本轮明确变化或正文首次可核对出场**的角色服装；键为角色占位、值为**具体穿着**（建议 40～120 字，须写清可视觉核对细节，勿只写「便装/休闲装」等空泛词）：
    - 建议结构：上装 + 下装 + 外套/叠穿（若有）+ 鞋履或赤足/拖鞋；可含 1～2 件贴身配饰（腕表、项链等）
    - 须含：主色、材质或版型（如棉质、针织、直筒、修身）、可见状态（敞开/挽袖/沾污/湿发未擦等）
    - 示例：{"{{char}}":"米白棉质圆领T（袖口挽至小臂）+ 深灰针织开衫未扣齐 + 黑色直筒休闲长裤；深棕皮质腕表；室内拖鞋"}
  - "items": array，物品变更 [{ "name": string, "note"?: string, "tier"?: "normal"|"important"|"critical" }]
  - "foreshadows": array（**可选**；仅**结尾快照**下动机/悬念有变化时填写）[{ "text": string, "status": "open"|"resolved" }]
  - "todos": array（**可选**；仅**结尾快照**下仍有未完结具体事项时填写）[{ "text": string, "status": "open"|"resolved" }]
  - "event_summary": string，本轮关键事件摘要（建议 80～100 字：写清谁做了什么、情绪转折或结果；无显著事件可省略）
  - "side_perspective": boolean（可选；**侧幕叙写**轮必填 true：表示约会主角色 {{char}} **未在场**；characters_present **不得**含 {{char}}；仅记录用户与在场 NPC 的时空与事实）

${STORY_TIMELINE_FORESHADOW_TODO_WRITING_RULES}

${STORY_TIMELINE_OPEN_ANCHORS_RECYCLE_RULES}`.trim()

function trimCell(raw: unknown, max = 120): string | undefined {
  const t = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
  return t || undefined
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

  const eventSummary = trimCell(o.event_summary ?? o.eventSummary, STORY_TIMELINE_EVENT_SUMMARY_MAX)
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
      map.delete(key)
      continue
    }
    map.set(key, { text, status: 'open' } as T)
  }
  return [...map.values()].slice(-cap)
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

/** 将总结增量合并进角色剧情时间轴状态 */
export function mergeStoryTimelineState(
  prev: StoryTimelineState | null | undefined,
  characterId: string,
  delta: StoryTimelineSummaryDelta,
  scope: StoryTimelineEventScope,
): StoryTimelineState | null {
  if (!hasTimelineDeltaContent(delta)) return prev ?? null
  const cid = characterId.trim()
  if (!cid) return prev ?? null

  const base = prev?.characterId === cid ? prev : createEmptyStoryTimelineState(cid)
  const now = Date.now()
  const next: StoryTimelineState = {
    ...base,
    updatedAt: now,
    costumes: [...base.costumes],
    items: [...base.items],
    foreshadows: [...base.foreshadows],
    todos: [...(base.todos ?? [])],
    recentEvents: [...base.recentEvents],
  }

  if (delta.story_day_end) next.currentStoryDay = delta.story_day_end
  else if (delta.story_day) next.currentStoryDay = delta.story_day
  if (delta.story_time_end) next.currentStoryTime = delta.story_time_end
  else if (delta.story_time) next.currentStoryTime = delta.story_time
  if (delta.location) next.currentLocation = delta.location
  if (delta.characters_present?.length) next.charactersPresent = [...delta.characters_present]

  if (delta.costumes) {
    const map = new Map(next.costumes.map((c) => [costumeKey(c), c]))
    for (const [character, outfit] of Object.entries(delta.costumes)) {
      const ch = trimCell(character, 64)
      const out = trimCell(outfit, STORY_TIMELINE_COSTUME_DESC_MAX)
      if (!ch || !out) continue
      map.set(costumeKey({ character: ch, outfit: out }), { character: ch, outfit: out })
    }
    next.costumes = [...map.values()].slice(-STORY_TIMELINE_COSTUMES_CAP)
  }

  if (delta.items?.length) {
    const map = new Map(next.items.map((it) => [itemKey(it.name), it]))
    for (const it of delta.items) {
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

  if (delta.foreshadows?.length) {
    next.foreshadows = mergeOpenResolvedAnchorEntries(
      next.foreshadows,
      delta.foreshadows,
      STORY_TIMELINE_OPEN_FORESHADOW_CAP,
    )
  }

  if (delta.todos?.length) {
    next.todos = mergeOpenResolvedAnchorEntries(
      next.todos ?? [],
      delta.todos,
      STORY_TIMELINE_OPEN_TODO_CAP,
    )
  }

  if (delta.event_summary) {
    const evt: StoryTimelineEventEntry = {
      id: `evt-${now}-${Math.random().toString(36).slice(2, 7)}`,
      storyDay: delta.story_day ?? next.currentStoryDay,
      storyTime: delta.story_time ?? next.currentStoryTime,
      relativeTime: delta.relative_time,
      location: delta.location ?? next.currentLocation,
      charactersPresent: delta.characters_present ?? next.charactersPresent,
      eventSummary: delta.event_summary,
      sourceScope: scope,
      recordedAt: now,
    }
    next.recentEvents = [...next.recentEvents, evt].slice(-STORY_TIMELINE_RECENT_EVENTS_CAP)
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
    if (line.startsWith('【本轮事件】')) return line.replace(/^【本轮事件】/, '').trim().slice(0, 80)
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

  if (delta.costumes && Object.keys(delta.costumes).length) {
    lines.push(
      '【服装变更】\n' +
        Object.entries(delta.costumes)
          .map(([ch, out]) => `- ${ch}：${out}`)
          .join('\n'),
    )
  }

  if (delta.items?.length) {
    lines.push(
      '【物品变更】\n' +
        delta.items
          .map((it) => {
            const name = String(it.name ?? '').trim()
            if (!name) return ''
            const note = String(it.note ?? '').trim()
            const tier = String(it.tier ?? '').trim()
            const tierTag =
              tier === 'critical' ? '〔关键〕' : tier === 'important' ? '〔重要〕' : ''
            return `- ${tierTag}${name}${note ? `（${note}）` : ''}`
          })
          .filter(Boolean)
          .join('\n'),
    )
  }

  if (delta.foreshadows?.length) {
    lines.push(
      '【伏笔·人物动机】\n' +
        delta.foreshadows
          .map((f) => {
            const text = String(f.text ?? '').trim()
            if (!text) return ''
            const st = String(f.status ?? 'open').trim().toLowerCase()
            return `- ${text}${st === 'resolved' ? '（已收）' : ''}`
          })
          .filter(Boolean)
          .join('\n'),
    )
  }

  if (delta.todos?.length) {
    lines.push(
      '【待办】\n' +
        delta.todos
          .map((f) => {
            const text = String(f.text ?? '').trim()
            if (!text) return ''
            const st = String(f.status ?? 'open').trim().toLowerCase()
            return `- ${text}${st === 'resolved' ? '（已完成）' : ''}`
          })
          .filter(Boolean)
          .join('\n'),
    )
  }

  if (delta.event_summary?.trim()) {
    lines.push(`【本轮事件】${delta.event_summary.trim()}`)
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

/** 供摘要 API 注入：列出系统内仍 open 的动机伏笔与待办，并要求模型输出 resolved 回收 */
export function formatStoryTimelineOpenAnchorsForSummaryPrompt(
  state: StoryTimelineState | null | undefined,
): string {
  if (!state || state.manualAnchorBlock?.trim()) return ''
  const openFore = state.foreshadows.filter((f) => f.status === 'open')
  const openTodos = (state.todos ?? []).filter((t) => t.status === 'open')
  if (!openFore.length && !openTodos.length) return ''

  const parts: string[] = [
    '【系统已有·未收锚点（须对照正文**末尾**回收；已完结者勿再当作写作指导）】',
  ]
  if (openFore.length) {
    parts.push(
      '未收伏笔（人物动机 / 悬念；非具体待办）：\n' +
        openFore.map((f) => `- ${f.text}`).join('\n'),
    )
  }
  if (openTodos.length) {
    parts.push(
      '未完结待办（具体可执行事项）：\n' +
        openTodos.map((t) => `- ${t.text}`).join('\n'),
    )
  }
  parts.push(STORY_TIMELINE_OPEN_ANCHORS_RECYCLE_RULES)
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

/** 从摘要行提取【本轮事件】全文（供向量索引） */
export function resolveStoryTimelineRowEventSummary(row: StoryTimelinePlotRow): string {
  return (
    String(row.rowText ?? '')
      .match(/【本轮事件】([^\n]+)/)?.[1]
      ?.trim()
      .slice(0, STORY_TIMELINE_EVENT_SUMMARY_MAX) ?? ''
  )
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
    return formatStoryTimelineSidePerspectiveRedactedRow(row)
  }
  return row.rowText
}

export const STORY_TIMELINE_SIDE_PERSPECTIVE_KNOWLEDGE_RULES =
  `【侧幕摘要·信息边界】标有「${STORY_TIMELINE_SIDE_PERSPECTIVE_REDACT_TAG}」的条目：{{char}} **未亲历**该段；不得写成全知旁观或复述用户与他人私下的具体对白/协议；仅可写寻踪、时段错位感或「你去哪了」类合理追问。`.trim()

/** 当前世界状态快照（地点/服装/物品/动机伏笔/待办；不含历史事件列表） */
export function formatStoryTimelineCurrentStateForPrompt(
  state: StoryTimelineState | null | undefined,
): string {
  if (!state) return ''
  const manual = state.manualAnchorBlock?.trim()
  if (manual) return manual
  const lines: string[] = []

  const anchor: string[] = []
  if (typeof state.updatedAt === 'number' && Number.isFinite(state.updatedAt)) {
    anchor.push(formatZhDateWithWeekday(state.updatedAt, { includeTime: true }))
  } else if (state.currentStoryDay) {
    anchor.push(`剧情日 ${state.currentStoryDay}`)
  }
  if (state.currentStoryTime) anchor.push(`时段 ${state.currentStoryTime}`)
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

  if (state.foreshadows.length) {
    lines.push(
      '【伏笔·人物动机】\n' +
        state.foreshadows.map((f) => `- ${f.text}`).join('\n'),
    )
  }

  if (state.todos?.length) {
    lines.push(
      '【待办】\n' +
        state.todos.map((t) => `- ${t.text}`).join('\n'),
    )
  }

  return lines.join('\n\n').trim()
}

/** 供 prompt 注入：当前快照 + 近端摘要行 + 向量召回行 */
export const STORY_TIMELINE_VECTOR_RECALL_CANON_RULES =
  `【历史回忆·事实铁律】下列「语义召回」条目为**摘要表已记载事实**（高于写作灵感与自行发挥）。` +
  `玩家提起相关往事时：**仅可**引用各行【摘要标题】【摘要关键词】【本轮事件】等摘要字段中**已写明**的内容；` +
  `**禁止**编造摘要未出现的对白、物品、交易或情节；**禁止**把摘要当作灵感扩写成未记载细节。`

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

export function formatStoryTimelineInjectBody(params: {
  state: StoryTimelineState | null | undefined
  recentRows: StoryTimelinePlotRow[]
  vectorRows?: StoryTimelineVectorRecallHit[]
  rowInjectOpts?: StoryTimelineRowPromptInjectOpts
}): string {
  const rowOpts = params.rowInjectOpts
  const parts: string[] = []
  const stateBlock = formatStoryTimelineCurrentStateForPrompt(params.state)
  if (stateBlock) {
    parts.push(`【当前状态·${STORY_TIMELINE_INJECT_LABEL_STATE}】\n${stateBlock}`)
  }

  let hasSidePerspectiveRedact = false
  const recent = params.recentRows
  const recentIds = new Set(recent.map((r) => r.id))
  const vector = (params.vectorRows ?? []).filter((hit) => !recentIds.has(hit.row.id))

  if (vector.length) {
    parts.push(
      `${STORY_TIMELINE_VECTOR_RECALL_CANON_RULES}\n` +
        `【语义召回·历史剧情摘要（按向量语义匹配）】\n` +
        vector
          .map((hit, i) => {
            const simPct = Math.round(hit.sim * 1000) / 10
            const title = resolveStoryTimelineRowTitle(hit.row)
            const body = formatStoryTimelineRowForPromptInject(hit.row, rowOpts)
            if (body.includes(STORY_TIMELINE_SIDE_PERSPECTIVE_REDACT_TAG)) hasSidePerspectiveRedact = true
            return `--- 召回 ${i + 1} · ${title} · 相似 ${simPct}% ---\n${body}`
          })
          .join('\n\n'),
    )
  }

  if (recent.length) {
    parts.push(
      `【近端剧情摘要（最近 ${recent.length} 轮，由旧到新；须与末尾情绪方向一致）】\n` +
        recent
          .map((r, i) => {
            const title = resolveStoryTimelineRowTitle(r)
            const body = formatStoryTimelineRowForPromptInject(r, rowOpts)
            if (body.includes(STORY_TIMELINE_SIDE_PERSPECTIVE_REDACT_TAG)) hasSidePerspectiveRedact = true
            return `--- 摘要 ${i + 1} · ${title} · ${STORY_TIMELINE_INJECT_LABEL_RECENT} ---\n${body}`
          })
          .join('\n\n'),
    )
  }

  if (!parts.length) return ''
  const footer =
    `（剧情时间轴：当前状态 + 语义召回历史摘要 + 近端摘要；回复须与锚点、服装、物品一致；**语义召回条目须服从【历史回忆·事实铁律】**；**未收动机伏笔与未完结待办**才须承接，已完结者勿再引用；历史摘要仅补事实勿翻转情绪主客体；**描述故事内时空，与每条前缀「系统落库时刻」及【当前时间】独立，勿混用**。` +
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
    out.push({
      injectKind,
      label: titleLabel || kindLabel || (injectKind === 'vector' ? STORY_TIMELINE_INJECT_LABEL_VECTOR : STORY_TIMELINE_INJECT_LABEL_RECENT),
      content: body,
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
