import { emitWeChatStorageChanged, personaDb } from '../wechat/newFriendsPersona/idb'
import type { WeChatPulseSharePayload } from '../wechat/newFriendsPersona/types'
import { resolveAccountScopedPrivateConversationKey } from '../wechat/wechatAccountPrivateChatStorage'
import { findAccountById, loadAccountsBundle, resolveAccountSessionIdentityId } from '../wechat/wechatAccountPersistence'
import { pulseShareContentFallback } from '../wechat/pulse/pulseShareAiDirective'

export type SendPulseShareInput = {
  postId: string
  authorName: string
  content: string
  excerpt?: string
  trendingTitle?: string
}

async function sendOnePulseShare(characterId: string, input: SendPulseShareInput): Promise<string> {
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
  const shareId = `pls-${nowMs}-${Math.random().toString(36).slice(2, 8)}`
  const messageId = `wxm-${nowMs}-pls-${Math.random().toString(36).slice(2, 8)}`

  const pulseShare: WeChatPulseSharePayload = {
    kind: 'pulse_share',
    shareId,
    postId: input.postId,
    authorName: input.authorName.trim().slice(0, 64),
    content: input.content.trim().slice(0, 2000),
    excerpt: input.excerpt?.trim().slice(0, 280),
    trendingTitle: input.trendingTitle?.trim().slice(0, 120),
  }

  await personaDb.appendWeChatChatMessage({
    id: messageId,
    characterId,
    playerIdentityId,
    type: 'player',
    content: pulseShareContentFallback(pulseShare),
    pulseShare,
    timestamp: nowMs,
    isRead: true,
    conversationKey,
  })

  await personaDb.markWeChatConversationReadToLatest(conversationKey)
  return messageId
}

export async function sendPulseShareToWeChatContacts(
  characterIds: string[],
  input: SendPulseShareInput,
): Promise<{ sent: number; messageIds: string[] }> {
  const ids = [...new Set(characterIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) throw new Error('请选择至少一位好友')
  if (!input.content.trim()) throw new Error('缺少微博内容')

  const messageIds: string[] = []
  for (const characterId of ids) {
    const messageId = await sendOnePulseShare(characterId, input)
    messageIds.push(messageId)
  }

  emitWeChatStorageChanged()
  return { sent: messageIds.length, messageIds }
}
