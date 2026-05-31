import type { MusicTrack } from '../../../../stores/useMusicStore'
import { emitWeChatStorageChanged, personaDb } from '../newFriendsPersona/idb'
import { resolveAccountScopedPrivateConversationKey } from '../wechatAccountPrivateChatStorage'
import { findAccountById, loadAccountsBundle, resolveAccountSessionIdentityId } from '../wechatAccountPersistence'
import { requestOpenWeChatPersonaChat } from '../wechatFocusChatNavigation'

export type SendMusicSyncInviteParams = {
  characterId: string
  contactName: string
  contactAvatar?: string
  track: MusicTrack
}

export type SendMusicSyncInviteResult = {
  inviteId: string
  messageId: string
}

/** 向微信私聊写入音乐共听邀约卡，并跳转至对应会话 */
export async function sendMusicSyncInvite(
  params: SendMusicSyncInviteParams,
): Promise<SendMusicSyncInviteResult> {
  const characterId = params.characterId.trim()
  if (!characterId) throw new Error('invalid character')

  const bundle = await loadAccountsBundle()
  if (!bundle) throw new Error('no active wechat account')
  const account = findAccountById(bundle, bundle.currentAccountId)
  if (!account) throw new Error('no active wechat account')

  const playerIdentityId = resolveAccountSessionIdentityId(account).trim()
  if (!playerIdentityId || playerIdentityId === '__none__') {
    throw new Error('no player identity')
  }

  const conversationKey = await resolveAccountScopedPrivateConversationKey({
    wechatAccountId: account.accountId,
    characterId,
    appSessionPlayerIdentityId: playerIdentityId,
  })

  const nowMs = Date.now()
  const inviteId = `msi-${nowMs}-${Math.random().toString(36).slice(2, 8)}`
  const messageId = `wxm-${nowMs}-msi-${Math.random().toString(36).slice(2, 8)}`

  await personaDb.appendWeChatChatMessage({
    id: messageId,
    characterId,
    playerIdentityId,
    type: 'player',
    content: '[音乐共听邀约]',
    musicSync: {
      kind: 'music_invite',
      inviteId,
      trackId: params.track.id,
      trackTitle: params.track.title,
      trackArtist: params.track.artist,
      coverUrl: params.track.cover,
    },
    timestamp: nowMs,
    isRead: true,
    conversationKey,
  })

  await personaDb.markWeChatConversationReadToLatest(conversationKey)
  emitWeChatStorageChanged()
  requestOpenWeChatPersonaChat(characterId)

  return { inviteId, messageId }
}

/** 预留：角色同意共听时写入回应卡（供后续 AI 管线调用） */
export async function appendMusicSyncAcceptReply(params: {
  characterId: string
  playerIdentityId: string
  conversationKey: string
  inviteId: string
  replyText: string
}): Promise<string> {
  const nowMs = Date.now()
  const messageId = `wxm-${nowMs}-msa-${Math.random().toString(36).slice(2, 8)}`
  await personaDb.appendWeChatChatMessage({
    id: messageId,
    characterId: params.characterId,
    playerIdentityId: params.playerIdentityId,
    type: 'character',
    content: params.replyText.trim() || '频率已接轨。',
    musicSync: {
      kind: 'music_accept',
      inviteId: params.inviteId,
      replyText: params.replyText.trim() || '频率已接轨。',
    },
    timestamp: nowMs,
    isRead: false,
    conversationKey: params.conversationKey,
  })
  emitWeChatStorageChanged()
  return messageId
}

/** 预留：角色拒绝共听时写入回应卡（供后续 AI 管线调用） */
export async function appendMusicSyncDeclineReply(params: {
  characterId: string
  playerIdentityId: string
  conversationKey: string
  inviteId: string
  replyText: string
}): Promise<string> {
  const nowMs = Date.now()
  const messageId = `wxm-${nowMs}-msd-${Math.random().toString(36).slice(2, 8)}`
  await personaDb.appendWeChatChatMessage({
    id: messageId,
    characterId: params.characterId,
    playerIdentityId: params.playerIdentityId,
    type: 'character',
    content: params.replyText.trim() || '现在没空，自己听吧。',
    musicSync: {
      kind: 'music_decline',
      inviteId: params.inviteId,
      replyText: params.replyText.trim() || '现在没空，自己听吧。',
    },
    timestamp: nowMs,
    isRead: false,
    conversationKey: params.conversationKey,
  })
  emitWeChatStorageChanged()
  return messageId
}
