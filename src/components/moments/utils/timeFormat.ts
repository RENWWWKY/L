export function formatMomentTime(timestamp: number, nowMs = Date.now()): string {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || ts <= 0) return ''
  const diffMs = Math.max(0, nowMs - ts)
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  if (diffMs < minuteMs) return '刚刚'
  if (diffMs < hourMs) return `${Math.max(1, Math.floor(diffMs / minuteMs))}分钟前`
  if (diffMs < dayMs) return `${Math.max(1, Math.floor(diffMs / hourMs))}小时前`
  if (diffMs < 7 * dayMs) return `${Math.max(1, Math.floor(diffMs / dayMs))}天前`

  const now = new Date(nowMs)
  const date = new Date(ts)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  if (year === now.getFullYear()) return `${month}月${day}日`
  return `${year}年${month}月${day}日`
}
