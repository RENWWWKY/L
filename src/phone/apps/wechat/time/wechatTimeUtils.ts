import type { WeChatTimeConfig } from '../newFriendsPersona/types'

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
