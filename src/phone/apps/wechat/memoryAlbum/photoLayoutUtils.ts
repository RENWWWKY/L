import type { PhotoLayout } from './memoryAlbumTypes'

export const PHOTO_LAYOUT_SCALE_MIN = 0.45
export const PHOTO_LAYOUT_SCALE_MAX = 2.4

export function clampPhotoScale(scale: number): number {
  return Math.min(PHOTO_LAYOUT_SCALE_MAX, Math.max(PHOTO_LAYOUT_SCALE_MIN, scale))
}

export function clampPhotoRotate(rotate: number): number {
  if (!Number.isFinite(rotate)) return 0
  let next = rotate % 360
  if (next > 180) next -= 360
  if (next < -180) next += 360
  return next
}

export function clampPhotoPosition(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(92, x)),
    y: Math.max(0, Math.min(90, y)),
  }
}

export function normalizePhotoLayout(layout: PhotoLayout): PhotoLayout {
  return {
    ...layout,
    rotate: clampPhotoRotate(typeof layout.rotate === 'number' ? layout.rotate : 0),
    scale: clampPhotoScale(typeof layout.scale === 'number' ? layout.scale : 1),
  }
}

/** @deprecated 使用 normalizePhotoLayout */
export function withDefaultPhotoScale(layout: PhotoLayout): PhotoLayout {
  return normalizePhotoLayout(layout)
}

/** @deprecated 使用 normalizePhotoLayout */
export function flattenAlbumPhotoLayout(layout: PhotoLayout): PhotoLayout {
  return normalizePhotoLayout(layout)
}
