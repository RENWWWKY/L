/**
 * 实名制脱敏展示：两字为 *末字，三字及以上为 **末字。
 * 用于发红包页「备注名（*馨）」等展示。
 */
export function maskRealName(name: string): string {
  const s = String(name ?? '').trim()
  if (!s) return '—'
  if (s.length === 1) return `*${s}`
  if (s.length === 2) return `*${s.slice(-1)}`
  return `**${s.slice(-1)}`
}
