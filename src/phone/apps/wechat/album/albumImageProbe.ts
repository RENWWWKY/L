const MAX_KV_IMAGE_CHARS = 2_400_000

export function isLikelyTruncatedAlbumKvPayload(dataUrl: string): boolean {
  return dataUrl.trim().length >= MAX_KV_IMAGE_CHARS - 128
}

/** 探测 data URL 能否被浏览器完整解码 */
export function probeAlbumImageDataUrl(dataUrl: string, timeoutMs = 10_000): Promise<boolean> {
  const src = dataUrl.trim()
  if (!src.startsWith('data:image/')) return Promise.resolve(false)

  return new Promise((resolve) => {
    const img = new Image()
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      img.onload = null
      img.onerror = null
      resolve(ok)
    }
    const timer = window.setTimeout(() => finish(false), timeoutMs)
    img.onload = () => finish(img.naturalWidth > 0 && img.naturalHeight > 0)
    img.onerror = () => finish(false)
    img.src = src
  })
}

export async function pickBestAlbumImageUrl(
  kvUrl: string | undefined,
  chatUrl: string | undefined,
): Promise<string | undefined> {
  const kv = kvUrl?.trim() || ''
  const chat = chatUrl?.trim() || ''

  if (kv && chat) {
    if (isLikelyTruncatedAlbumKvPayload(kv)) return chat
    if (kv.length + 512 < chat.length) return chat
    const kvOk = await probeAlbumImageDataUrl(kv)
    if (!kvOk) return chat
    if (chat.length > kv.length) {
      const chatOk = await probeAlbumImageDataUrl(chat)
      if (chatOk) return chat
    }
    return kv
  }

  if (kv) {
    if (isLikelyTruncatedAlbumKvPayload(kv)) return chat || undefined
    const kvOk = await probeAlbumImageDataUrl(kv)
    return kvOk ? kv : chat || undefined
  }

  return chat || undefined
}
