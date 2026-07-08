import type { WeChatChatMessage } from '../newFriendsPersona/types'
import { personaDb } from '../newFriendsPersona/idb'
import { buildUserImageDataUrl } from '../wechatCharacterProfileImageApply'

export type AddWeChatMessageToAlbumResult = 'saved' | 'duplicate' | 'failed'

/** 将聊天图片消息保存到微信内置相册（同一条消息仅保存一次）。 */
export async function addWeChatMessageToAlbum(msg: WeChatChatMessage): Promise<AddWeChatMessageToAlbumResult> {
  const mid = msg.id?.trim()
  if (!mid || !msg.images?.length) return 'failed'

  const existing = await personaDb.findWeChatAlbumItemByMessageId(mid)
  if (existing) return 'duplicate'

  const img = msg.images[0]
  const dataUrl = buildUserImageDataUrl(img.base64, img.type)
  if (!dataUrl) return 'failed'

  const saved = await personaDb.addWeChatAlbumItemFromMessage(msg, dataUrl)
  return saved ? 'saved' : 'failed'
}
