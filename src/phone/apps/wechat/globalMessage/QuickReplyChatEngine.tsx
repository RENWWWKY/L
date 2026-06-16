import { useCallback, useMemo, useRef } from 'react'
import { ChatRoom } from '../ChatRoom'
import type { WeChatQuickReplyChat } from './wechatGlobalMessageGuard'
import { conversationCharacterIdForQuickReplyChat } from './wechatGlobalMessageGuard'

export type QuickReplySendApi = {
  sendText: (text: string) => void
}

type Props = {
  chat: WeChatQuickReplyChat
  conversationKey: string
  playerIdentityId: string
  playerDisplayName: string
  playerAvatarUrl?: string
  peerAvatarUrl?: string
  peerNotifyTitle: string
  personaCharacterId?: string | null
  useLumiProjectAssistantPrompt?: boolean
  onSendReady: (api: QuickReplySendApi) => void
  onOtherTypingChange?: (visible: boolean) => void
}

export function QuickReplyChatEngine({
  chat,
  conversationKey,
  playerIdentityId,
  playerDisplayName,
  playerAvatarUrl,
  peerAvatarUrl,
  peerNotifyTitle,
  personaCharacterId = null,
  useLumiProjectAssistantPrompt = false,
  onSendReady,
  onOtherTypingChange,
}: Props) {
  const readyRef = useRef(false)
  const conversationCharacterId = useMemo(() => conversationCharacterIdForQuickReplyChat(chat), [chat])

  const handleEmbedSendReady = useCallback(
    (api: QuickReplySendApi) => {
      if (readyRef.current) return
      readyRef.current = true
      onSendReady(api)
    },
    [onSendReady],
  )

  return (
    <div className="pointer-events-none fixed h-0 w-0 overflow-hidden opacity-0" aria-hidden>
      <ChatRoom
        embedMode="quick-reply"
        onEmbedSendReady={handleEmbedSendReady}
        onOtherTypingChange={onOtherTypingChange}
        onBack={() => {}}
        personaCharacterId={personaCharacterId ?? undefined}
        playerDisplayName={playerDisplayName}
        playerAvatarUrl={playerAvatarUrl}
        peerAvatarUrl={peerAvatarUrl}
        peerNotifyTitle={peerNotifyTitle}
        useLumiProjectAssistantPrompt={useLumiProjectAssistantPrompt}
        conversationCharacterId={conversationCharacterId}
        playerIdentityId={playerIdentityId}
        promptPlayerIdentityId={playerIdentityId}
        roomType={chat.kind === 'group' ? 'group' : 'private'}
        groupId={chat.kind === 'group' ? chat.groupId : null}
        key={`${conversationKey}::${playerIdentityId}`}
      />
    </div>
  )
}

export function resolveQuickReplyPeerMeta(
  chat: WeChatQuickReplyChat,
  contacts: { characterId?: string; id: string; remarkName: string; avatarUrl?: string }[],
  groupName?: string,
  groupAvatar?: string,
): { title: string; avatarUrl?: string; personaCharacterId: string | null; useLumiPrompt: boolean } {
  if (chat.kind === 'lumi') {
    const row = contacts.find((c) => c.id === 'wechat-lumi-assistant')
    return {
      title: row?.remarkName?.trim() || 'Lumi',
      avatarUrl: row?.avatarUrl,
      personaCharacterId: contacts.length === 1 ? contacts[0]?.characterId ?? null : contacts.find((c) => c.remarkName.trim() === 'Lumi')?.characterId ?? null,
      useLumiPrompt: true,
    }
  }
  if (chat.kind === 'self') {
    return { title: '文件传输助手', avatarUrl: undefined, personaCharacterId: null, useLumiPrompt: false }
  }
  if (chat.kind === 'group') {
    return {
      title: groupName?.trim() || '群聊',
      avatarUrl: groupAvatar,
      personaCharacterId: null,
      useLumiPrompt: false,
    }
  }
  const row = contacts.find((c) => c.characterId === chat.characterId)
  return {
    title: row?.remarkName?.trim() || '聊天',
    avatarUrl: row?.avatarUrl,
    personaCharacterId: chat.characterId,
    useLumiPrompt: false,
  }
}
