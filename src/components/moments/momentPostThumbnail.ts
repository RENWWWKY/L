import type { MomentItemModel } from './mockMoments'
import { isMomentUserImageRef } from './momentUserImageStorage'

const TEXT_SNIPPET_MAX = 48

export function buildMomentPostThumbnail(moment: MomentItemModel): string {
  const firstImage = moment.images?.find((url) => url.trim())
  if (firstImage) return firstImage.trim()
  const text = moment.content.trim().replace(/\s+/g, ' ')
  if (!text) return '…'
  return text.length > TEXT_SNIPPET_MAX ? `${text.slice(0, TEXT_SNIPPET_MAX)}…` : text
}

export function isMomentThumbnailImage(thumbnail: string): boolean {
  const t = thumbnail.trim()
  if (!t || t === '…') return false
  return (
    t.startsWith('http://') ||
    t.startsWith('https://') ||
    t.startsWith('data:') ||
    t.startsWith('/') ||
    t.startsWith('blob:') ||
    isMomentUserImageRef(t)
  )
}
