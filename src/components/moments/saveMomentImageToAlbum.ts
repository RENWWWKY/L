import { downloadBlob } from '../../phone/apps/dataArchive/exportImport'

function extensionForMime(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'jpg'
}

async function fetchImageBlob(imageUrl: string): Promise<Blob> {
  const trimmed = imageUrl.trim()
  if (!trimmed) throw new Error('图片地址无效')
  const res = await fetch(trimmed)
  if (!res.ok) throw new Error('图片加载失败')
  return await res.blob()
}

/** 保存朋友圈图片：移动端优先系统分享（可存入相册），否则触发下载 */
export async function saveMomentImageToAlbum(
  imageUrl: string,
  filenameBase = 'moment',
): Promise<{ ok: boolean; message?: string }> {
  try {
    const blob = await fetchImageBlob(imageUrl)
    const ext = extensionForMime(blob.type || 'image/jpeg')
    const filename = `${filenameBase.replace(/[^\w\u4e00-\u9fff-]+/g, '_')}-${Date.now()}.${ext}`
    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })

    if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
      try {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] })
          return { ok: true, message: '已通过系统菜单保存' }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return { ok: false, message: '已取消保存' }
        }
      }
    }

    downloadBlob(blob, filename)
    return { ok: true, message: '图片已下载' }
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存失败'
    return { ok: false, message }
  }
}
