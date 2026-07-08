import type { PhotoItem } from './memoryAlbumTypes'

/** 按角色加载相册照片，同一预览会话内复用缓存，避免重复 IO / 重绘 */
const albumPhotosSessionCache = new Map<string, PhotoItem[]>()

export function peekCachedAlbumPhotos(characterId: string): PhotoItem[] | null {
  const cid = characterId.trim()
  if (!cid) return null
  return albumPhotosSessionCache.get(cid) ?? null
}

export function setCachedAlbumPhotos(characterId: string, photos: PhotoItem[]) {
  const cid = characterId.trim()
  if (!cid) return
  albumPhotosSessionCache.set(cid, photos)
}

export function clearCachedAlbumPhotos(characterId: string) {
  const cid = characterId.trim()
  if (!cid) return
  albumPhotosSessionCache.delete(cid)
}
