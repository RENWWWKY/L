import {
  isWechatGroupConversationKey,
  parseGroupIdFromConversationKey,
  parsePrivateWeChatConversationCharacterAndSession,
  parseWechatAccountGroupConversationKey,
  parseWechatAccountPrivateConversationKey,
  parseGroupIdFromGroupPeerCharacterId,
  wechatGroupPeerCharacterId,
  WECHAT_LUMI_PEER_CHARACTER_ID,
  WECHAT_SELF_PEER_CHARACTER_ID,
} from '../wechatConversationKey'

export type WeChatQuickReplyChat =
  | { kind: 'lumi' }
  | { kind: 'self' }
  | { kind: 'persona'; characterId: string }
  | { kind: 'group'; groupId: string }

export type WeChatInAppCharacterMessageDetail = {
  conversationKey: string
  title: string
  preview: string
  avatarUrl?: string
  messageId: string
}

export const WECHAT_IN_APP_CHARACTER_MESSAGE_EVENT = 'wechat:in-app-character-message'

type WeChatGlobalMessageGuardState = {
  isMessagesTab: boolean
  activeConversationKey: string | null
}

let guardState: WeChatGlobalMessageGuardState = {
  isMessagesTab: true,
  activeConversationKey: null,
}

export function setWeChatGlobalMessageGuardState(patch: Partial<WeChatGlobalMessageGuardState>): void {
  guardState = { ...guardState, ...patch }
}

export function shouldShowWeChatGlobalMessageToast(conversationKey: string): boolean {
  const k = conversationKey.trim()
  if (!k) return false
  if (guardState.isMessagesTab) return false
  if (guardState.activeConversationKey?.trim() === k) return false
  return true
}

export function weChatQuickReplyChatFromConversationKey(conversationKey: string): WeChatQuickReplyChat | null {
  const k = conversationKey.trim()
  if (!k) return null

  const scopedGroup = parseWechatAccountGroupConversationKey(k)
  if (scopedGroup?.groupId) return { kind: 'group', groupId: scopedGroup.groupId }

  if (isWechatGroupConversationKey(k)) {
    const gid = parseGroupIdFromConversationKey(k)
    if (gid) return { kind: 'group', groupId: gid }
  }

  const scopedPriv = parseWechatAccountPrivateConversationKey(k)
  if (scopedPriv?.characterId) {
    const cid = scopedPriv.characterId
    if (cid === WECHAT_LUMI_PEER_CHARACTER_ID) return { kind: 'lumi' }
    if (cid === WECHAT_SELF_PEER_CHARACTER_ID) return { kind: 'self' }
    const gid = parseGroupIdFromGroupPeerCharacterId(cid)
    if (gid) return { kind: 'group', groupId: gid }
    return { kind: 'persona', characterId: cid }
  }

  const legacy = parsePrivateWeChatConversationCharacterAndSession(k)
  if (!legacy?.characterId) return null
  const cid = legacy.characterId
  if (cid === WECHAT_LUMI_PEER_CHARACTER_ID) return { kind: 'lumi' }
  if (cid === WECHAT_SELF_PEER_CHARACTER_ID) return { kind: 'self' }
  const gid = parseGroupIdFromGroupPeerCharacterId(cid)
  if (gid) return { kind: 'group', groupId: gid }
  return { kind: 'persona', characterId: cid }
}

export function conversationCharacterIdForQuickReplyChat(chat: WeChatQuickReplyChat): string {
  if (chat.kind === 'lumi') return WECHAT_LUMI_PEER_CHARACTER_ID
  if (chat.kind === 'self') return WECHAT_SELF_PEER_CHARACTER_ID
  if (chat.kind === 'group') return wechatGroupPeerCharacterId(chat.groupId)
  return chat.characterId
}

export function maybeEmitWeChatInAppCharacterMessage(
  detail: WeChatInAppCharacterMessageDetail & { isMuted?: boolean },
): void {
  if (typeof window === 'undefined') return
  if (detail.isMuted) return
  if (!shouldShowWeChatGlobalMessageToast(detail.conversationKey)) return
  window.dispatchEvent(
    new CustomEvent<WeChatInAppCharacterMessageDetail>(WECHAT_IN_APP_CHARACTER_MESSAGE_EVENT, {
      detail: {
        conversationKey: detail.conversationKey.trim(),
        title: detail.title.trim() || '微信',
        preview: detail.preview.trim() || '新消息',
        avatarUrl: detail.avatarUrl?.trim() || undefined,
        messageId: detail.messageId.trim(),
      },
    }),
  )
}
