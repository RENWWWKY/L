import { emitWeChatStorageChanged, personaDb } from '../newFriendsPersona/idb'
import type { WeChatListenCommentSharePayload } from '../newFriendsPersona/types'
import { resolveAccountScopedPrivateConversationKey } from '../wechatAccountPrivateChatStorage'
import { findAccountById, loadAccountsBundle, resolveAccountSessionIdentityId } from '../wechatAccountPersistence'

export type SendListenCommentShareInput = {
  commentId: number
  commentText: string
  commentAuthor: string
  commentAuthorAvatar?: string
  targetType: 'song' | 'playlist'
  targetId: number
  targetTitle: string
  targetArtist?: string
  targetCover?: string
}

export type SendListenCommentShareResult = {
  sent: number
  messageIds: string[]
}

async function sendOneListenCommentShare(
  characterId: string,
  input: SendListenCommentShareInput,
): Promise<string> {
  const bundle = await loadAccountsBundle()
  if (!bundle) throw new Error('请先登录微信账号')
  const account = findAccountById(bundle, bundle.currentAccountId)
  if (!account) throw new Error('请先登录微信账号')

  const playerIdentityId = resolveAccountSessionIdentityId(account).trim()
  if (!playerIdentityId || playerIdentityId === '__none__') {
    throw new Error('请先设置玩家身份')
  }

  const conversationKey = await resolveAccountScopedPrivateConversationKey({
    wechatAccountId: account.accountId,
    characterId,
    appSessionPlayerIdentityId: playerIdentityId,
  })

  const nowMs = Date.now()
  const shareId = `lcs-${nowMs}-${Math.random().toString(36).slice(2, 8)}`
  const messageId = `wxm-${nowMs}-lcs-${Math.random().toString(36).slice(2, 8)}`

  const listenCommentShare: WeChatListenCommentSharePayload = {
    kind: 'listen_comment_share',
    shareId,
    commentId: input.commentId,
    commentText: input.commentText.trim(),
    commentAuthor: input.commentAuthor.trim() || '匿名用户',
    targetType: input.targetType,
    targetId: input.targetId,
    targetTitle: input.targetTitle.trim(),
    ...(input.commentAuthorAvatar?.trim()
      ? { commentAuthorAvatar: input.commentAuthorAvatar.trim() }
      : {}),
    ...(input.targetArtist?.trim() ? { targetArtist: input.targetArtist.trim() } : {}),
    ...(input.targetCover?.trim() ? { targetCover: input.targetCover.trim() } : {}),
  }

  await personaDb.appendWeChatChatMessage({
    id: messageId,
    characterId,
    playerIdentityId,
    type: 'player',
    content: '[分享评论]',
    listenCommentShare,
    timestamp: nowMs,
    isRead: true,
    conversationKey,
  })

  await personaDb.markWeChatConversationReadToLatest(conversationKey)
  return messageId
}

/** 向多名微信私聊联系人发送听一听评论分享卡 */
export async function sendListenCommentShareToContacts(
  characterIds: string[],
  input: SendListenCommentShareInput,
): Promise<SendListenCommentShareResult> {
  const ids = [...new Set(characterIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) throw new Error('请选择至少一位好友')
  if (!input.commentText.trim()) throw new Error('评论内容为空')
  if (!input.targetId || !input.targetTitle.trim()) throw new Error('缺少歌曲或歌单信息')

  const messageIds: string[] = []
  for (const characterId of ids) {
    const messageId = await sendOneListenCommentShare(characterId, input)
    messageIds.push(messageId)
  }

  emitWeChatStorageChanged()
  return { sent: messageIds.length, messageIds }
}
