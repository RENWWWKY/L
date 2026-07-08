import type { PhotoItem } from './memoryAlbumTypes'

/** 仅比较照片身份，忽略 imageUrl 字符串变化（避免重复 setState 导致整页重挂载） */
export function photoListsEqualById(a: readonly PhotoItem[], b: readonly PhotoItem[]): boolean {
  if (a.length !== b.length) return false
  return a.every((photo, index) => {
    const other = b[index]
    if (!other) return false
    return photo.messageId === other.messageId && photo.timestamp === other.timestamp
  })
}

/** @deprecated 使用 photoListsEqualById */
export function photoListsEqual(a: readonly PhotoItem[], b: readonly PhotoItem[]): boolean {
  return photoListsEqualById(a, b)
}
