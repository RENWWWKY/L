import { emitWeChatStorageChanged, personaDb } from '../newFriendsPersona/idb'
import type { WeChatChatHistoryPayload, WeChatChatMessage } from '../newFriendsPersona/types'
import { resolveAccountScopedPrivateConversationKey } from '../wechatAccountPrivateChatStorage'
import { findAccountById, loadAccountsBundle, resolveAccountSessionIdentityId } from '../wechatAccountPersistence'
import { buildChatHistoryPayloadFromMessages } from './buildChatHistoryPayload'

export type ForwardToContactResult = {
  characterId: string
  conversationKey: string
  messageIds: string[]
}

async function resolveForwardTarget(characterId: string) {
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

  return { characterId: id, playerIdentityId, conversationKey }
}

function cloneMessageForForward(m: WeChatChatMessage, peerId: string, playerIdentityId: string, conversationKey: string, timestamp: number): WeChatChatMessage {
  return {
    id: `wxm-${timestamp}-fwd-${Math.random().toString(36).slice(2, 8)}`,
    characterId: peerId,
    playerIdentityId,
    type: 'player',
    content: m.content ?? '',
    images: m.images,
    voice: m.voice,
    redPacket: m.redPacket,
    transfer: m.transfer,
    callStatus: m.callStatus,
    musicSync: m.musicSync,
    listenCommentShare: m.listenCommentShare,
    listenProfileShare: m.listenProfileShare,
    listenTrackShare: m.listenTrackShare,
    pulseShare: m.pulseShare,
    sharedRecord: m.sharedRecord,
    chatHistory: m.chatHistory,
    timestamp,
    isRead: true,
    conversationKey,
  }
}

/** 逐条转发：按原顺序以普通消息投递 */
export async function forwardMessagesItemByItemToContact(
  characterId: string,
  messages: WeChatChatMessage[],
): Promise<ForwardToContactResult> {
  const { characterId: peerId, playerIdentityId, conversationKey } = await resolveForwardTarget(characterId)
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp)
  const messageIds: string[] = []
  let now = Date.now()
  for (const m of sorted) {
    const row = cloneMessageForForward(m, peerId, playerIdentityId, conversationKey, now)
    now += 1
    await personaDb.appendWeChatChatMessage(row)
    messageIds.push(row.id)
  }
  await personaDb.markWeChatConversationReadToLatest(conversationKey)
  emitWeChatStorageChanged()
  return { characterId: peerId, conversationKey, messageIds }
}

/** 合并转发：投递聊天记录卡片 */
export async function forwardMessagesMergedToContact(
  characterId: string,
  messages: WeChatChatMessage[],
  mergeTitle: { userName: string; peerName: string; peerCharacterId?: string },
): Promise<ForwardToContactResult> {
  const { characterId: peerId, playerIdentityId, conversationKey } = await resolveForwardTarget(characterId)
  const chatHistory: WeChatChatHistoryPayload = buildChatHistoryPayloadFromMessages({
    messages,
    userName: mergeTitle.userName,
    peerName: mergeTitle.peerName,
    peerCharacterId: mergeTitle.peerCharacterId,
  })
  const nowMs = Date.now()
  const messageId = `wxm-${nowMs}-ch-${Math.random().toString(36).slice(2, 8)}`
  await personaDb.appendWeChatChatMessage({
    id: messageId,
    characterId: peerId,
    playerIdentityId,
    type: 'player',
    content: '[聊天记录]',
    chatHistory,
    timestamp: nowMs,
    isRead: true,
    conversationKey,
  })
  await personaDb.markWeChatConversationReadToLatest(conversationKey)
  emitWeChatStorageChanged()
  return { characterId: peerId, conversationKey, messageIds: [messageId] }
}
