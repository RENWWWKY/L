export interface PhotoItem {
  messageId: string
  imageUrl: string
  timestamp: number
}

/** 拍立得在页面上的位置（百分比坐标） */
export type PhotoLayout = {
  x: number
  y: number
  rotate: number
  scale: number
  z: number
}

export interface PolaroidDetail {
  photoId: string
  customTitle?: string
  essay?: string
  layout?: PhotoLayout
}

export type MemoryAlbumAccountData = {
  polaroidsByCharacter: Record<string, Record<string, PolaroidDetail>>
}

export type MemoryAlbumPersistedRoot = {
  byAccount: Record<string, MemoryAlbumAccountData>
}

export const MEMORY_ALBUM_KV_KEY = 'wechat-memory-album-v2'

export const MEMORY_ALBUM_PAGE_SIZE = 4

export type MemoryAlbumContact = {
  id: string
  remarkName: string
  avatarUrl?: string
}

export function formatDefaultPolaroidTitle(timestamp: number, characterName: string): string {
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}.${d.getDate()} · ${characterName}`
}
