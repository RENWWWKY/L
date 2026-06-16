import { AnimatePresence, LayoutGroup } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GlobalMessageToast } from './GlobalMessageToast'
import { QuickReplyModal } from './QuickReplyModal'
import {
  WECHAT_IN_APP_CHARACTER_MESSAGE_EVENT,
  weChatQuickReplyChatFromConversationKey,
  type WeChatInAppCharacterMessageDetail,
  type WeChatQuickReplyChat,
} from './wechatGlobalMessageGuard'

const AUTO_HIDE_MS = 4000
/** 同会话连发消息时合并刷新，避免通知条在多条预览间闪跳 */
const TOAST_PREVIEW_COALESCE_MS = 120

type Props = {
  playerIdentityId: string | null
  playerDisplayName: string
  playerAvatarUrl?: string
  personaContacts: { characterId?: string; id: string; remarkName: string; avatarUrl?: string }[]
  onOpenChat: (chat: WeChatQuickReplyChat) => void
}

export function GlobalMessageListener({
  playerIdentityId,
  playerDisplayName,
  playerAvatarUrl,
  personaContacts,
  onOpenChat,
}: Props) {
  const [toast, setToast] = useState<WeChatInAppCharacterMessageDetail | null>(null)
  const [quickReplyOpen, setQuickReplyOpen] = useState(false)
  const hideTimerRef = useRef<number | null>(null)
  const coalesceTimerRef = useRef<number | null>(null)
  const pendingToastRef = useRef<WeChatInAppCharacterMessageDetail | null>(null)
  const quickReplyOpenRef = useRef(quickReplyOpen)
  const toastRef = useRef<WeChatInAppCharacterMessageDetail | null>(null)

  useEffect(() => {
    quickReplyOpenRef.current = quickReplyOpen
  }, [quickReplyOpen])

  useEffect(() => {
    toastRef.current = toast
  }, [toast])

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const clearCoalesceTimer = useCallback(() => {
    if (coalesceTimerRef.current != null) {
      window.clearTimeout(coalesceTimerRef.current)
      coalesceTimerRef.current = null
    }
  }, [])

  const scheduleAutoHide = useCallback(() => {
    clearHideTimer()
    hideTimerRef.current = window.setTimeout(() => {
      setToast(null)
      hideTimerRef.current = null
    }, AUTO_HIDE_MS)
  }, [clearHideTimer])

  const applyToastDetail = useCallback(
    (detail: WeChatInAppCharacterMessageDetail, opts?: { resetHideTimer?: boolean }) => {
      setToast((prev) => {
        if (prev?.conversationKey === detail.conversationKey && prev.messageId === detail.messageId) {
          return prev
        }
        if (prev?.conversationKey === detail.conversationKey) {
          return { ...prev, ...detail }
        }
        return detail
      })
      if (!quickReplyOpenRef.current && opts?.resetHideTimer !== false) scheduleAutoHide()
    },
    [scheduleAutoHide],
  )

  const flushPendingToast = useCallback(() => {
    const pending = pendingToastRef.current
    pendingToastRef.current = null
    coalesceTimerRef.current = null
    if (!pending) return
    applyToastDetail(pending)
  }, [applyToastDetail])

  useEffect(() => {
    const onIncoming = (e: Event) => {
      if (playerIdentityId === null) return
      const detail = (e as CustomEvent<WeChatInAppCharacterMessageDetail>).detail
      if (!detail?.conversationKey?.trim()) return

      const prev = toastRef.current
      if (!prev || prev.conversationKey !== detail.conversationKey) {
        pendingToastRef.current = null
        clearCoalesceTimer()
        applyToastDetail(detail)
        return
      }

      pendingToastRef.current = detail
      clearCoalesceTimer()
      coalesceTimerRef.current = window.setTimeout(flushPendingToast, TOAST_PREVIEW_COALESCE_MS)
    }
    window.addEventListener(WECHAT_IN_APP_CHARACTER_MESSAGE_EVENT, onIncoming as EventListener)
    return () => {
      window.removeEventListener(WECHAT_IN_APP_CHARACTER_MESSAGE_EVENT, onIncoming as EventListener)
      clearCoalesceTimer()
    }
  }, [playerIdentityId, clearCoalesceTimer, flushPendingToast])

  const openQuickReply = useCallback(() => {
    clearHideTimer()
    clearCoalesceTimer()
    if (pendingToastRef.current) {
      applyToastDetail(pendingToastRef.current)
      pendingToastRef.current = null
    }
    setQuickReplyOpen(true)
  }, [clearHideTimer, clearCoalesceTimer, applyToastDetail])

  const closeQuickReply = useCallback(() => {
    setQuickReplyOpen(false)
    setToast(null)
  }, [])

  const expandToFullChat = useCallback(
    (conversationKey: string) => {
      const chat = weChatQuickReplyChatFromConversationKey(conversationKey)
      if (!chat) return
      setQuickReplyOpen(false)
      setToast(null)
      onOpenChat(chat)
    },
    [onOpenChat],
  )

  if (playerIdentityId === null) return null

  return (
    <LayoutGroup>
      <AnimatePresence mode="wait">
        {toast && !quickReplyOpen ? (
          <GlobalMessageToast key={toast.messageId} detail={toast} onPress={openQuickReply} />
        ) : null}
      </AnimatePresence>
      <QuickReplyModal
        open={quickReplyOpen && !!toast}
        detail={toast}
        playerIdentityId={playerIdentityId}
        playerDisplayName={playerDisplayName}
        playerAvatarUrl={playerAvatarUrl}
        personaContacts={personaContacts}
        onClose={closeQuickReply}
        onExpand={expandToFullChat}
      />
    </LayoutGroup>
  )
}
