/** 头像 data URL 写入本地存储前的上限（与资料页一致） */
export const MAX_AVATAR_DATA_URL_LEN = 350_000

const AVATAR_MAX_SIDE = 1080

export async function compressAvatarDataUrl(src: string, maxLen: number): Promise<string> {
  if (!src || src.length <= maxLen) return src
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('头像图片读取失败'))
  })
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) return src

  const side = Math.max(w, h)
  const baseScale = side > AVATAR_MAX_SIDE ? AVATAR_MAX_SIDE / side : 1
  const scales = [baseScale, baseScale * 0.85, baseScale * 0.72, baseScale * 0.6]
  const qualities = [0.9, 0.82, 0.74, 0.66, 0.58]
  let best = src

  for (const scale of scales) {
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.drawImage(img, 0, 0, tw, th)

    for (const q of qualities) {
      const out = canvas.toDataURL('image/jpeg', q)
      if (out.length < best.length) best = out
      if (out.length <= maxLen) return out
    }
  }
  return best
}
