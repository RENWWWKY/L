/** 帖子/评论统一时间标签（相对 + 短绝对） */
export function formatQnaTimeLabel(ts: number, nowMs = Date.now()): string {
  const diff = Math.max(0, nowMs - ts)
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)} 小时前`
  const d = new Date(ts)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const abs = `${y}-${mo}-${da} ${h}:${mi}`
  if (diff < 86_400_000 * 7) return `${d.getMonth() + 1}-${da} ${h}:${mi}`
  return abs
}

export function formatQnaTimeTitle(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${da} ${h}:${mi}`
}
