export function maskRealName(name: string): string {
  const clean = (name || '').trim()
  if (!clean) return '*'
  if (clean.length <= 1) return '*'
  if (clean.length === 2) return `*${clean.slice(-1)}`
  return `**${clean.slice(-1)}`
}

export function toMoneyText(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0.00'
  return (Math.round(amount * 100) / 100).toFixed(2)
}
