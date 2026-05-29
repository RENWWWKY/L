/** 解析网易云 weapi 返回体（兼容 data 嵌套与扁平字段） */
export function pickPayload(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {}
  const b = body as Record<string, unknown>
  if (b.data && typeof b.data === 'object' && !Array.isArray(b.data)) {
    return b.data as Record<string, unknown>
  }
  return b
}

export function pickUnikey(body: unknown): string | undefined {
  const p = pickPayload(body)
  const key = p.unikey
  return typeof key === 'string' && key.length > 0 ? key : undefined
}

export function pickQrCreate(body: unknown): { qrimg?: string; qrurl?: string } {
  const p = pickPayload(body)
  return {
    qrimg: typeof p.qrimg === 'string' ? p.qrimg : undefined,
    qrurl: typeof p.qrurl === 'string' ? p.qrurl : undefined,
  }
}
