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

export type StoryTimelineForeshadowEntry = {
  text: string
  status: 'open' | 'resolved'
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
  /** 本轮可读摘要（与 UI timelineSnapshot 同源） */
  rowText: string
  textHash: string
  embedding?: number[]
  embeddingProvider?: MemoryEmbeddingProviderKind
  embeddingModelId?: string
  embeddingHash?: string
}

export type StoryTimelinePromptLoadOpts = {
  relevanceText?: string
  apiConfig?: Pick<import('../../api/types').ApiConfig, 'apiUrl' | 'apiKey'> | null
  /** 私聊/群聊总结游标键；用于排除游标后行进入「已总结片段」向量召回 */
  conversationKey?: string | null
}

/** 每角色持久化的行表上限 */
export const STORY_TIMELINE_ROWS_CAP = 240
/** 注入 prompt：始终带上最近 N 轮摘要行 */
export const STORY_TIMELINE_INJECT_RECENT_ROWS = 5
/** 向量召回：除近端外额外注入的历史行数 */
export const STORY_TIMELINE_VECTOR_RECALL_TOP_K = 3
/** 剧情行向量最低相似度 */
export const STORY_TIMELINE_ROW_VECTOR_MIN_SIM = 0.70

/** 注入 prompt / 思维溯源：摘要行来源标签 */
export const STORY_TIMELINE_INJECT_LABEL_RECENT = '近端固定'
export const STORY_TIMELINE_INJECT_LABEL_VECTOR = '向量命中'
export const STORY_TIMELINE_INJECT_LABEL_STATE = '合并快照'

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
  relative_time?: string
  location?: string
  characters_present?: string[]
  costumes?: Record<string, string>
  items?: Array<{ name?: string; note?: string; tier?: string }>
  foreshadows?: Array<{ text?: string; status?: string }>
  /** 本轮摘要短标题（建议 4～10 字） */
  row_title?: string
  event_summary?: string
}

export const STORY_TIMELINE_RECENT_EVENTS_CAP = 12
export const STORY_TIMELINE_OPEN_FORESHADOW_CAP = 16
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

export const STORY_TIMELINE_SUMMARY_JSON_FIELDS = `
- "timeline"（可选对象；材料中有可核对的时空、服装、物品、伏笔/待办时**应尽量填写**）：
  - "row_title": string，本轮摘要短标题（建议 4～10 字，可含问号/顿号；如「温柔瞬间」「化解冲突」「没听见？是没看见」；须概括本轮情绪或转折，勿写「第 N 轮」等序号）
  - "story_day": string，**含年份的公历剧情日**，如 "2025年10月1日"、"2025年2月14日（情人节）"；相对进度写 relative_time，勿用「第3天」代替公历
  - "story_time": string，**24 小时制钟点**，如 "19:30"、"08:15"；材料仅有「傍晚/深夜」时须推断合理 HH:mm
  - "relative_time": string，相对时间，如 "昨天"、"三天前"、"约会第 3 天"
  - "location": string，**须写可区分的具体地点**（建议 12～80 字）：含店名/路名/楼层或区域/包厢号等可核对锚点；**禁止**仅写「饭馆、餐厅、酒店、咖啡厅、学校、公司、家里」等空泛类名；可写「城东·云隐居日式料理·二楼靠窗席」「蓝海酒店 1208 套房客厅」
  - "characters_present": string[]，在场角色（用 {{user}} / {{char}} / {{id:UUID}}，勿写真名）
  - "costumes": object，**仅写本轮明确变化或正文首次可核对出场**的角色服装；键为角色占位、值为**具体穿着**（建议 40～120 字，须写清可视觉核对细节，勿只写「便装/休闲装」等空泛词）：
    - 建议结构：上装 + 下装 + 外套/叠穿（若有）+ 鞋履或赤足/拖鞋；可含 1～2 件贴身配饰（腕表、项链等）
    - 须含：主色、材质或版型（如棉质、针织、直筒、修身）、可见状态（敞开/挽袖/沾污/湿发未擦等）
    - 示例：{"{{char}}":"米白棉质圆领T（袖口挽至小臂）+ 深灰针织开衫未扣齐 + 黑色直筒休闲长裤；深棕皮质腕表；室内拖鞋"}
  - "items": array，物品变更 [{ "name": string, "note"?: string, "tier"?: "normal"|"important"|"critical" }]
  - "foreshadows": array，伏笔或未完结待办 [{ "text": string, "status": "open"|"resolved" }]
  - "event_summary": string，本轮关键事件摘要（建议 80～100 字：写清谁做了什么、情绪转折或结果；无显著事件可省略）`.trim()

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

/** 展示层：把正文里旧的「仅日期」锚点升级为含时分（兼容已入库 rowText） */
export function enrichStoryTimelineTextWithRecordedTime(
  text: string,
  recordedAtMs?: number | null,
): string {
  const raw = String(text ?? '').trim()
  if (!raw) return raw
  if (typeof recordedAtMs !== 'number' || !Number.isFinite(recordedAtMs)) return raw
  const dateOnly = formatZhDateWithWeekday(recordedAtMs, { includeTime: false })
  const withTime = formatZhDateWithWeekday(recordedAtMs, { includeTime: true })
  if (dateOnly === withTime || raw.includes(withTime) || !raw.includes(dateOnly)) return raw
  return raw.split(dateOnly).join(withTime)
}

const GREGORIAN_ANCHOR_PART_RE = /^\d{4}年\d{1,2}月\d{1,2}日/
const GREGORIAN_CALENDAR_LABEL_RE =
  /(\d{4}年\d{1,2}月\d{1,2}日(?:\s+星期[日一二三四五六])?(?:\s+\d{1,2}:\d{2})?)/

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

/** 由 timeline 增量 + 落库时刻拼公历锚点（与线下剧情 trace 同风格） */
export function composeStoryTimelineCalendarAnchorLabel(
  delta: Pick<StoryTimelineSummaryDelta, 'story_day' | 'story_time'>,
  recordedAtMs?: number | null,
): string {
  const storyDay = delta.story_day?.trim()
  const storyTime = delta.story_time?.trim()
  const clock = extractClockTimeFromStoryTime(storyTime)

  if (storyDay && hasGregorianYearInStoryDay(storyDay)) {
    let label = storyDay.trim()
    if (!label.includes('星期')) {
      const parsed = parseGregorianStoryDayDate(storyDay)
      if (parsed) {
        const wd = WEEKDAY_ZH[parsed.getDay()] ?? '日'
        label = `${label} 星期${wd}`
      } else if (typeof recordedAtMs === 'number' && Number.isFinite(recordedAtMs)) {
        label = formatZhDateWithWeekday(recordedAtMs, { includeTime: false })
      }
    }
    if (clock && !label.includes(clock)) label = `${label} ${clock}`
    return label.trim()
  }

  if (typeof recordedAtMs === 'number' && Number.isFinite(recordedAtMs)) {
    return formatZhDateWithWeekday(recordedAtMs, { includeTime: true })
  }

  const parts: string[] = []
  if (storyDay) parts.push(storyDay)
  if (storyTime) parts.push(storyTime)
  return parts.join(' ').trim()
}

/** 列表卡片副标题：年月日 + 时分（优先锚点公历，否则 recordedAt） */
export function formatStoryTimelineListTimeLabel(
  text: string,
  recordedAtMs?: number | null,
): string {
  const raw = String(text ?? '').trim()
  const anchorMatch = raw.match(/【本轮锚点】([^\n]+)/)
  const anchorText = anchorMatch?.[1]?.trim() ?? ''
  const calMatch = anchorText.match(GREGORIAN_CALENDAR_LABEL_RE)
  if (calMatch?.[1]) return calMatch[1].trim()
  if (typeof recordedAtMs === 'number' && Number.isFinite(recordedAtMs)) {
    return formatZhDateWithWeekday(recordedAtMs, { includeTime: true })
  }
  return anchorText.split(' · ')[0]?.trim() ?? ''
}

/** @deprecated 请用 formatStoryTimelineListTimeLabel */
export function extractStoryTimelineAnchorLabelFromRowText(
  text: string,
  recordedAtMs?: number | null,
): string {
  return formatStoryTimelineListTimeLabel(text, recordedAtMs)
}

/** 档案馆展示：补全锚点公历时分（兼容旧行仅「剧情日/时段」格式） */
export function prepareStoryTimelineArchiveDisplayText(
  text: string,
  recordedAtMs?: number | null,
): string {
  const raw = String(text ?? '').trim()
  if (!raw) return raw
  const enriched = enrichStoryTimelineTextWithRecordedTime(raw, recordedAtMs)
  const anchorRe = /【本轮锚点】([^\n]+)/
  const m = enriched.match(anchorRe)
  if (!m) return enriched
  const anchorBody = m[1] ?? ''
  if (GREGORIAN_ANCHOR_PART_RE.test(anchorBody.split(' · ')[0]?.trim() ?? '')) {
    return enriched
  }
  if (typeof recordedAtMs !== 'number' || !Number.isFinite(recordedAtMs)) return enriched
  const calendar = formatZhDateWithWeekday(recordedAtMs, { includeTime: true })
  const plotParts = stripSystemTimeFromStoryTimelineAnchorLabel(anchorBody)
  const newAnchor = plotParts ? `${calendar} · ${plotParts}` : calendar
  return enriched.replace(anchorRe, `【本轮锚点】${newAnchor}`)
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
  const relativeTime = trimCell(o.relative_time ?? o.relativeTime, 48)
  const location = trimCell(o.location, STORY_TIMELINE_LOCATION_MAX)
  if (storyDay) delta.story_day = storyDay
  if (storyTime) delta.story_time = storyTime
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

  const eventSummary = trimCell(o.event_summary ?? o.eventSummary, STORY_TIMELINE_EVENT_SUMMARY_MAX)
  if (eventSummary) delta.event_summary = eventSummary

  const rowTitle = normalizeStoryTimelineRowTitle(o.row_title ?? o.rowTitle)
  if (rowTitle) delta.row_title = rowTitle

  return Object.keys(delta).length ? delta : undefined
}

export function createEmptyStoryTimelineState(characterId: string): StoryTimelineState {
  return {
    characterId: characterId.trim(),
    updatedAt: Date.now(),
    costumes: [],
    items: [],
    foreshadows: [],
    recentEvents: [],
  }
}

function costumeKey(c: StoryTimelineCostumeEntry): string {
  return c.character.trim().toLowerCase()
}

function itemKey(name: string): string {
  return name.trim().toLowerCase()
}

function foreshadowKey(text: string): string {
  return text.trim().toLowerCase()
}

export function hasTimelineDeltaContent(delta: StoryTimelineSummaryDelta): boolean {
  return !!(
    delta.row_title ||
    delta.story_day ||
    delta.story_time ||
    delta.relative_time ||
    delta.location ||
    (delta.characters_present?.length ?? 0) ||
    (delta.costumes && Object.keys(delta.costumes).length) ||
    (delta.items?.length ?? 0) ||
    (delta.foreshadows?.length ?? 0) ||
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
    recentEvents: [...base.recentEvents],
  }

  if (delta.story_day) next.currentStoryDay = delta.story_day
  if (delta.story_time) next.currentStoryTime = delta.story_time
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
    const map = new Map(
      next.foreshadows.filter((f) => f.status === 'open').map((f) => [foreshadowKey(f.text), f]),
    )
    for (const f of delta.foreshadows) {
      const text = trimCell(f.text, 160)
      if (!text) continue
      const status = normalizeForeshadowStatus(f.status)
      const key = foreshadowKey(text)
      if (status === 'resolved') {
        map.delete(key)
        continue
      }
      map.set(key, { text, status: 'open' })
    }
    next.foreshadows = [...map.values()].slice(-STORY_TIMELINE_OPEN_FORESHADOW_CAP)
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

export function stripStoryTimelineTitleLine(rowText: string): string {
  return String(rowText ?? '')
    .replace(/^【摘要标题】[^\n]*\n?/, '')
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
  return extractStoryTimelineRowTitleFromRowText(displayText ?? row.rowText)
}

/** 列表折叠预览：跳过标题与锚点行 */
export function storyTimelineRowPreviewLine(displayText: string): string {
  const lines = String(displayText ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  for (const line of lines) {
    if (line.startsWith('【摘要标题】') || line.startsWith('【本轮锚点】')) continue
    if (line.startsWith('【本轮事件】')) return line.replace(/^【本轮事件】/, '').trim().slice(0, 80)
    return line.slice(0, 80)
  }
  return String(displayText ?? '').slice(0, 80)
}

/** 单轮 JSON timeline 增量 → 可读表格文本（plot 折叠面板用） */
export function formatStoryTimelineDeltaForDisplay(
  delta: StoryTimelineSummaryDelta,
  opts?: { recordedAtMs?: number | null },
): string {
  if (!hasTimelineDeltaContent(delta)) return ''
  const lines: string[] = []
  const rowTitle = normalizeStoryTimelineRowTitle(delta.row_title)
  if (rowTitle) lines.push(`【摘要标题】${rowTitle}`)
  const anchor: string[] = []
  const calendarLabel = composeStoryTimelineCalendarAnchorLabel(delta, opts?.recordedAtMs)
  if (calendarLabel) anchor.push(calendarLabel)
  if (delta.story_day && !hasGregorianYearInStoryDay(delta.story_day)) {
    anchor.push(`剧情日 ${delta.story_day}`)
  }
  const clock = extractClockTimeFromStoryTime(delta.story_time)
  if (delta.story_time && !clock) anchor.push(`时段 ${delta.story_time}`)
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
      '【伏笔 / 待办】\n' +
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
  opts?: { plotId?: string | null; recordedAtMs?: number },
): StoryTimelinePlotRow | null {
  if (!hasTimelineDeltaContent(delta)) return null
  const cid = characterId.trim()
  if (!cid) return null
  const recordedAt =
    typeof opts?.recordedAtMs === 'number' && Number.isFinite(opts.recordedAtMs)
      ? opts.recordedAtMs
      : Date.now()
  const rowText = formatStoryTimelineDeltaForDisplay(delta, { recordedAtMs: recordedAt })
  if (!rowText.trim()) return null
  const textHash = computeStoryTimelineRowTextHash(rowText)
  const rowTitle = normalizeStoryTimelineRowTitle(delta.row_title)
  const plotId = opts?.plotId?.trim()
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
    rowText,
    textHash,
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
    state.recentEvents.length
  )
}

/** 当前世界状态快照（地点/服装/物品/伏笔；不含历史事件列表） */
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
      '【伏笔 / 待办】\n' +
        state.foreshadows.map((f) => `- ${f.text}`).join('\n'),
    )
  }

  return lines.join('\n\n').trim()
}

/** 供 prompt 注入：当前快照 + 近端摘要行 + 向量召回行 */
export function formatStoryTimelineInjectBody(params: {
  state: StoryTimelineState | null | undefined
  recentRows: StoryTimelinePlotRow[]
  vectorRows?: StoryTimelineVectorRecallHit[]
}): string {
  const parts: string[] = []
  const stateBlock = formatStoryTimelineCurrentStateForPrompt(params.state)
  if (stateBlock) {
    parts.push(`【当前状态·${STORY_TIMELINE_INJECT_LABEL_STATE}】\n${stateBlock}`)
  }

  const recent = params.recentRows
  if (recent.length) {
    parts.push(
      `【近端剧情摘要（最近 ${recent.length} 轮，由旧到新；须与末尾情绪方向一致）】\n` +
        recent
          .map(
            (r, i) =>
              `--- 摘要 ${i + 1} · ${STORY_TIMELINE_INJECT_LABEL_RECENT} ---\n${r.rowText}`,
          )
          .join('\n\n'),
    )
  }

  const recentIds = new Set(recent.map((r) => r.id))
  const vector = (params.vectorRows ?? []).filter((hit) => !recentIds.has(hit.row.id))
  if (vector.length) {
    parts.push(
      `【语义召回·历史剧情摘要】\n` +
        vector
          .map((hit, i) => {
            const simPct = Math.round(hit.sim * 1000) / 10
            return `--- 召回 ${i + 1} · ${STORY_TIMELINE_INJECT_LABEL_VECTOR} · 相似 ${simPct}% ---\n${hit.row.rowText}`
          })
          .join('\n\n'),
    )
  }

  if (!parts.length) return ''
  return (
    `${parts.join('\n\n')}\n\n` +
    `（剧情时间轴：当前状态 + 按轮追加摘要；回复须与锚点、服装、物品、伏笔一致；历史摘要仅补事实勿翻转情绪主客体；**描述故事内时空，与每条前缀「系统落库时刻」及【当前时间】独立，勿混用**。标签「${STORY_TIMELINE_INJECT_LABEL_RECENT}」「${STORY_TIMELINE_INJECT_LABEL_VECTOR}」仅供核对注入来源，勿写入剧情正文。）`
  )
}

const STORY_TIMELINE_INJECT_ROW_HEADER_RE =
  /---\s*(?:摘要|召回)\s*(\d+)\s*·\s*(近端固定|向量命中)(?:\s*·\s*相似\s*([\d.]+)%)?\s*---\s*\n([\s\S]*?)(?=\n\n---\s*(?:摘要|召回)|\n\n（剧情时间轴|$|\n\n【)/g

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
    const kindLabel = m[2]?.trim()
    const simRaw = m[3]?.trim()
    const body = m[4]?.trim()
    if (!body) continue
    const injectKind: StoryTimelineInjectKind =
      kindLabel === STORY_TIMELINE_INJECT_LABEL_VECTOR ? 'vector' : 'recent'
    const sim = simRaw ? Number(simRaw) / 100 : undefined
    out.push({
      injectKind,
      label:
        kindLabel ||
        (injectKind === 'vector' ? STORY_TIMELINE_INJECT_LABEL_VECTOR : STORY_TIMELINE_INJECT_LABEL_RECENT),
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
