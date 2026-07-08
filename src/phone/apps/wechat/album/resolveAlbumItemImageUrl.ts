import type { WeChatAlbumItem } from '../newFriendsPersona/types'
import { personaDb } from '../newFriendsPersona/idb'
import { buildUserImageDataUrl } from '../wechatCharacterProfileImageApply'
import { pickBestAlbumImageUrl } from './albumImageProbe'
import { loadAlbumImage } from './wechatAlbumImageCache'

/** 优先读相册 KV 副本；损坏/截断时回退到原聊天消息里的完整图片。 */
export async function resolveAlbumItemImageUrl(item: WeChatAlbumItem): Promise<string | undefined> {
  const mid = item.messageId?.trim()
  let chatUrl: string | undefined
  if (mid) {
    const msg = await personaDb.getWeChatChatMessageById(mid)
    const img = msg?.images?.[0]
    if (img?.base64?.trim()) {
      chatUrl = buildUserImageDataUrl(img.base64, img.type ?? item.mimeType)
    }
  }

  const kvKey = item.imageKvKey?.trim()
  let kvUrl: string | undefined
  if (kvKey) {
    kvUrl = (await loadAlbumImage(kvKey))?.trim() || undefined
  }

  const best = await pickBestAlbumImageUrl(kvUrl, chatUrl)
  return best?.trim() || undefined
}
