import { isUserInitiatedFriendRequestSource } from '../addFriend/submitUserOutgoingFriendRequest'
import { tempChatThreadFromRow } from '../addFriend/friendRequestTempChat'
import { sanitizeFriendRequestPlainText } from '../addFriend/friendRequestPlainText'
import type { FriendRequestRow } from './idb'
import type { FriendRequest } from './friendRequestTypes'
import { WECHAT_LUMI_PEER_CHARACTER_ID } from '../wechatConversationKey'

export function formatFriendRequestTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export async function mapFriendRequestRowToUi(params: {
  row: FriendRequestRow
  nickname: string
  avatar: string
  messages: FriendRequest['messages']
  unread: boolean
}): Promise<FriendRequest> {
  const { row, nickname, avatar, messages, unread } = params
  const outbound = isUserInitiatedFriendRequestSource(row.source)
  const direction = outbound ? 'outbound' : 'inbound'
  const firstUser = messages.find((m) => m.sender === 'user')
  const verificationMsg =
    sanitizeFriendRequestPlainText(firstUser?.content ?? '') ||
    sanitizeFriendRequestPlainText(messages[0]?.content ?? '') ||
    ''

  return {
    id: row.id,
    targetCharId: row.characterId,
    characterId: row.characterId,
    direction,
    verificationMsg,
    avatar,
    nickname,
    source: row.source,
    status: row.status,
    messages,
    tempChatThread: tempChatThreadFromRow(row),
    unread,
    userInitiated: outbound,
    outcomeUnread: row.outcomeUnread === true,
    adjudicationLastError: row.adjudicationLastError?.trim() || undefined,
    requestTimeMs: row.createdAt,
  }
}

export function lumiFallbackNickname(characterId: string): string {
  return characterId === WECHAT_LUMI_PEER_CHARACTER_ID ? 'Lumi' : '对方'
}
