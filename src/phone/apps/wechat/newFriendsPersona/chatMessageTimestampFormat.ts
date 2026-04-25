function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * 微信风格：搜索结果 / 列表时间
 * - 今天：今天 HH:MM
 * - 昨天：昨天 HH:MM
 * - 更早：YYYY-MM-DD HH:MM
 */
export function formatWeChatMessageListTimestamp(ts: number, nowMs = Date.now()): string {
  const d = new Date(ts)
  const now = new Date(nowMs)
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.round((startToday - startTarget) / 86400000)
  const hh = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  if (dayDiff === 0) return `今天 ${hh}:${mm}`
  if (dayDiff === 1) return `昨天 ${hh}:${mm}`
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${hh}:${mm}`
}
