import { personaDb } from '../newFriendsPersona/idb'

export const WECHAT_ALBUM_IMAGE_KV_PREFIX = 'wechat-album-image-v1:'

/** phoneKv 单条上限；超过则**不写入**（截断 base64 会损坏图片） */
const MAX_KV_IMAGE_CHARS = 2_400_000

export class AlbumImageTooLargeForKvError extends Error {
  readonly length: number

  constructor(length: number) {
    super(`album_image_too_large_for_kv:${length}`)
    this.name = 'AlbumImageTooLargeForKvError'
    this.length = length
  }
}

export function isAlbumImageWithinKvLimit(dataUrl: string): boolean {
  return dataUrl.trim().length <= MAX_KV_IMAGE_CHARS
}

export async function persistAlbumImage(cacheKey: string, dataUrl: string): Promise<void> {
  const key = cacheKey.trim()
  const url = dataUrl.trim()
  if (!key || !url) return
  if (!isAlbumImageWithinKvLimit(url)) {
    throw new AlbumImageTooLargeForKvError(url.length)
  }
  await personaDb.setPhoneKv(`${WECHAT_ALBUM_IMAGE_KV_PREFIX}${key}`, url)
}

export async function loadAlbumImage(cacheKey: string): Promise<string | undefined> {
  const key = cacheKey.trim()
  if (!key) return undefined
  const raw = await personaDb.getPhoneKv(`${WECHAT_ALBUM_IMAGE_KV_PREFIX}${key}`)
  const url = typeof raw === 'string' ? raw.trim() : ''
  return url || undefined
}

export async function deleteAlbumImage(cacheKey: string): Promise<void> {
  const key = cacheKey.trim()
  if (!key) return
  await personaDb.deletePhoneKv(`${WECHAT_ALBUM_IMAGE_KV_PREFIX}${key}`)
}
