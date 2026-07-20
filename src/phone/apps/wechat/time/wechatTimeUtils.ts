import type { CharacterTimeSettingsRow, WeChatTimeConfig } from '../newFriendsPersona/types'

/** 角色是否启用系统时间感知（缺省 true）。 */
export function isCharacterTimePerceptionEnabled(
  row: CharacterTimeSettingsRow | null | undefined,
): boolean {
  return row?.timePerceptionEnabled !== false
}

/** 关闭时间感知时注入模型：仅依据聊天内容推断时段。 */
export function formatChatInferredTimePerceptionBlock(): string {
  return [
    '\n\n---',
    '【当前时间】',
    '本角色未启用系统时间感知。请勿使用系统注入的「当前时间点」或自定义时间流速。',
    '请仅根据聊天记录中的消息先后顺序、时间戳间隔、用户措辞（如「昨晚」「刚才」「明天见」）与对话语境，自行推断现在大概是什么时段，并自然体现在回复里。',
    '若上下文无法判断，表述保持模糊即可，勿凭空编造具体钟点。',
  ].join('\n')
}

export function resolveTimePromptSection(params: {
  timePerceptionEnabled?: boolean
  currentTimeMs?: number
  forLumiAssistant?: boolean
}): string {
  if (params.timePerceptionEnabled === false) {
    return formatChatInferredTimePerceptionBlock()
  }
  return formatCurrentTimeBlock(params.currentTimeMs, { forLumiAssistant: params.forLumiAssistant })
}

export function formatCurrentTimeBlock(currentTimeMs?: number, opts?: { forLumiAssistant?: boolean }): string {
  const ts = Number(currentTimeMs)
  const safeTs = Number.isFinite(ts) && ts > 0 ? ts : Date.now()
  const d = new Date(safeTs)
  const week = WEEKDAY_LABELS[d.getDay()] ?? ''
  const stamp = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${week} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(
    d.getSeconds(),
  )}`
  if (opts?.forLumiAssistant) {
    return `\n\n---\n【当前时间】\n当前时间点：${stamp}\n可将时段体现在问候或语气里（如早晚安），但不要编造与用户私密剧情。\n`
  }
  // 角色扮演：墙钟供早午晚语气；故事「现在」以剧情时间轴为准（可与线上时间设置同步推进）
  return [
    '',
    '---',
    '【当前时间】',
    `当前时间点：${stamp}`,
    '上列为微信应用内墙钟（可自定义流速），供感知早/午/晚、深夜与回复节奏。',
    '故事「现在」以【剧情时间轴】的【当前锚点】为准；若用户已在线上时间设置中推进锚点，则墙钟与剧情「现在」应对齐到推进后的日/时段。',
    '**禁止**因「最近线下剧情」末条仍是更早一夜，就把线上对话拉回该末夜；线下末条只说明当时空间/在场，故事时钟以剧情轴当前锚点为准。',
    '请将时段感自然体现在回复里；涉及「哪一天、过了多久」时服从剧情轴当前锚点与跨通道落库先后说明。',
    '',
  ].join('\n')
}

export const WECHAT_TIMESTAMP_GAP_MS = 5 * 60 * 1000

const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'] as const

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function startOfDay(ts: number) {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function normalizeWeChatTimeConfig(input?: Partial<WeChatTimeConfig> | null): WeChatTimeConfig {
  const now = Date.now()
  const mode = input?.mode === 'custom' ? 'custom' : 'system'
  const customBaseTime =
    typeof input?.customBaseTime === 'number' && Number.isFinite(input.customBaseTime) ? input.customBaseTime : now
  const customAnchorRealTime =
    typeof input?.customAnchorRealTime === 'number' && Number.isFinite(input.customAnchorRealTime)
      ? input.customAnchorRealTime
      : now
  const rawMultiplier =
    typeof input?.timeMultiplier === 'number' && Number.isFinite(input.timeMultiplier) ? input.timeMultiplier : 1
  const timeMultiplier = Math.min(86400, Math.max(0.01, rawMultiplier))
  return {
    mode,
    customBaseTime,
    customAnchorRealTime,
    timeMultiplier,
  }
}

/**
 * 计算微信应用内的“当前时间”。
 * 自定义模式下不依赖定时器累加，而是始终根据真实时间差反推，
 * 避免页面切后台、刷新或倍率极高时产生累计误差。
 */
export function resolveWeChatCurrentTimeMs(config: WeChatTimeConfig, realNow = Date.now()): number {
  const safe = normalizeWeChatTimeConfig(config)
  if (safe.mode === 'system') return realNow
  const elapsedRealMs = Math.max(0, realNow - safe.customAnchorRealTime)
  return Math.round(safe.customBaseTime + elapsedRealMs * safe.timeMultiplier)
}

/**
 * 聊天流时间戳格式化规则：
 * - 今天：`14:20`
 * - 昨天：`昨天 09:15`
 * - 7 天内：`星期三 18:30`
 * - 同年更早：`8月15日 10:00`
 * - 跨年：`2023年12月1日 22:30`
 */
export function formatWeChatChatTimestamp(messageTimeMs: number, currentTimeMs: number): string {
  const target = new Date(messageTimeMs)
  const now = new Date(currentTimeMs)
  const hhmm = `${pad2(target.getHours())}:${pad2(target.getMinutes())}`
  const dayDiff = Math.round((startOfDay(currentTimeMs) - startOfDay(messageTimeMs)) / 86400000)

  if (dayDiff <= 0) return hhmm
  if (dayDiff === 1) return `昨天 ${hhmm}`
  if (dayDiff <= 6) return `${WEEKDAY_LABELS[target.getDay()]} ${hhmm}`
  if (target.getFullYear() === now.getFullYear()) return `${target.getMonth() + 1}月${target.getDate()}日 ${hhmm}`
  return `${target.getFullYear()}年${target.getMonth() + 1}月${target.getDate()}日 ${hhmm}`
}

/**
 * 是否需要在当前消息上方插入时间戳。
 * 只和“上一次已经展示过时间戳的消息时间”比较，
 * 这样即使消息很多，也能保证每超过 5 分钟重新出现一次时间提示。
 */
export function shouldRenderWeChatTimestamp(previousShownTimeMs: number | null, currentMessageTimeMs: number): boolean {
  if (previousShownTimeMs == null) return true
  return currentMessageTimeMs - previousShownTimeMs >= WECHAT_TIMESTAMP_GAP_MS
}

export function toDateTimeLocalValue(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function parseDateTimeLocalValue(value: string): number {
  const ts = new Date(value).getTime()
  return Number.isFinite(ts) ? ts : Date.now()
}
