import { resolveAlbumItemImageUrl } from '../album/resolveAlbumItemImageUrl'
import { personaDb } from '../newFriendsPersona/idb'
import type { PhotoItem } from './memoryAlbumTypes'

/** 从微信内置相册（手动「存相册」）拉取某角色的已保存图片，按消息时间正序 */
export async function loadCharacterSavedAlbumPhotos(characterId: string): Promise<PhotoItem[]> {
  const cid = characterId.trim()
  if (!cid) return []

  const rows = await personaDb
    .listWeChatAlbumItems()
    .then((items) =>
      items.filter((row) => row.characterId.trim() === cid).sort((a, b) => a.timestamp - b.timestamp),
    )

  const photos: PhotoItem[] = []
  for (const row of rows) {
    const imageUrl = (await resolveAlbumItemImageUrl(row))?.trim()
    if (!imageUrl) continue
    photos.push({
      messageId: row.messageId,
      imageUrl,
      timestamp: row.timestamp,
    })
  }
  return photos
}

/** 批量统计各角色已手动保存的相册图片数量 */
export async function countSavedAlbumPhotosByCharacter(
  characterIds: readonly string[],
): Promise<Record<string, number>> {
  const idSet = new Set(characterIds.map((id) => id.trim()).filter(Boolean))
  if (!idSet.size) return {}

  const rows = await personaDb.listWeChatAlbumItems()
  const counts: Record<string, number> = {}
  for (const id of idSet) counts[id] = 0

  for (const row of rows) {
    const cid = row.characterId.trim()
    if (idSet.has(cid)) counts[cid] = (counts[cid] ?? 0) + 1
  }
  return counts
}

/** 将照片列表分割为每页 4 张的二维数组 */
export function chunkPhotosIntoPages(photos: PhotoItem[], perPage = 4): PhotoItem[][] {
  if (photos.length === 0) return [[]]
  const pages: PhotoItem[][] = []
  for (let i = 0; i < photos.length; i += perPage) {
    pages.push(photos.slice(i, i + perPage))
  }
  return pages
}

/** 从微信内置相册删除已保存图片（按消息 id） */
export async function deleteSavedAlbumPhoto(messageId: string): Promise<boolean> {
  const mid = messageId.trim()
  if (!mid) return false
  const item = await personaDb.findWeChatAlbumItemByMessageId(mid)
  if (!item) return false
  await personaDb.deleteWeChatAlbumItem(item.id)
  return true
}
