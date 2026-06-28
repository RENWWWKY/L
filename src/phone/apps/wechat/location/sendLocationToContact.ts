import { emitWeChatStorageChanged, personaDb } from '../newFriendsPersona/idb'
import type { WeChatLocationPayload } from '../newFriendsPersona/types'
import { resolveAccountScopedPrivateConversationKey } from '../wechatAccountPrivateChatStorage'
import { findAccountById, loadAccountsBundle, resolveAccountSessionIdentityId } from '../wechatAccountPersistence'
import { locationShareContentFallback } from './wechatLocationUtils'

export type SendLocationResult = {
  characterId: string
  conversationKey: string
  messageId: string
}

/** 向一名微信私聊联系人发送位置卡片 */
export async function sendLocationToContact(
  characterId: string,
  payload: WeChatLocationPayload,
): Promise<SendLocationResult> {
  const id = characterId.trim()
  if (!id) throw new Error('请选择好友')

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
    characterId: id,
    appSessionPlayerIdentityId: playerIdentityId,
  })

  const nowMs = Date.now()
  const messageId = `wxm-${nowMs}-loc-${Math.random().toString(36).slice(2, 8)}`
  const content = locationShareContentFallback(payload)

  await personaDb.appendWeChatChatMessage({
    id: messageId,
    characterId: id,
    playerIdentityId,
    type: 'player',
    content,
    locationShare: payload,
    timestamp: nowMs,
    isRead: true,
    conversationKey,
  })

  await personaDb.markWeChatConversationReadToLatest(conversationKey)
  emitWeChatStorageChanged()
  return { characterId: id, conversationKey, messageId }
}
