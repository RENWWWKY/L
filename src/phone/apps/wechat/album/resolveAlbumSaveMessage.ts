import type { WeChatChatMessage, WeChatImageMime } from '../newFriendsPersona/types'
import { personaDb } from '../newFriendsPersona/idb'

export type AlbumSaveLocalMessage = {
  id: string
  from: 'self' | 'other'
  text?: string
  timestamp?: number
  images?: { base64: string; type: WeChatImageMime }[]
}

/** 合并 IndexedDB 与聊天列表内存态，避免图片尚未落库时存相册失败。 */
export async function resolveAlbumSaveMessage(
  messageId: string,
  local: AlbumSaveLocalMessage | null | undefined,
  fallback: {
    conversationCharacterId: string
    playerIdentityId: string
    conversationKey: string
  },
): Promise<WeChatChatMessage | null> {
  const mid = messageId.trim()
  if (!mid) return null

  const row = await personaDb.getWeChatChatMessageById(mid)
  const images = row?.images?.length ? row.images : local?.images
  if (!images?.length || !images[0]?.base64?.trim()) return null

  const fromSelf = row?.type === 'player' || local?.from === 'self'
  return {
    id: mid,
    characterId: row?.characterId?.trim() || fallback.conversationCharacterId,
    playerIdentityId: row?.playerIdentityId?.trim() || fallback.playerIdentityId,
    type: row?.type ?? (fromSelf ? 'player' : 'character'),
    content: row?.content ?? local?.text ?? '',
    timestamp: row?.timestamp ?? local?.timestamp ?? Date.now(),
    conversationKey: row?.conversationKey?.trim() || fallback.conversationKey,
    isRead: row?.isRead ?? true,
    images,
  }
}
