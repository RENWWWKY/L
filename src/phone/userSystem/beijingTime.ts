/** 数据库存储的 datetime 为北京时间（UTC+8）无时区字符串 */

export function parseDbDateTime(s: string): Date | null {
  const t = s.trim()
  if (!t) return null
  if (/[Zz]$/.test(t) || /[+-]\d{2}:\d{2}$/.test(t)) {
    const d = new Date(t)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(t.replace(' ', 'T') + '+08:00')
  return Number.isNaN(d.getTime()) ? null : d
}

function formatWallClock(t: string, withSeconds = true): string | null {
  const m = t.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const sec = m[6] || '00'
  if (!withSeconds) return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}`
  return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}:${sec}`
}

/** 按库内北京时间墙钟展示，避免浏览器本地时区二次换算 */
export function formatBeijingDateTime(s: string): string {
  if (!s?.trim()) return '-'
  const wall = formatWallClock(s)
  if (wall) return wall
  const d = parseDbDateTime(s)
  if (!d) return s
  return d.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/** 当前北京时间墙钟（用于展示等） */
export function getBeijingClock(now = new Date()): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(
    fmt.formatToParts(now).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  ) as Record<string, string>
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}
