import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable } from '../../../components/Pressable'
import type { WeChatInAppCharacterMessageDetail } from './wechatGlobalMessageGuard'
import { weChatQuickReplyChatFromConversationKey } from './wechatGlobalMessageGuard'
import { POD_LAYOUT_ID } from './GlobalMessageToast'
import { quickReplyModalHeaderRowStyle, quickReplyModalTopStyle } from './globalMessageLayout'
import { QuickReplyMessageStream } from './QuickReplyMessageStream'
import { QuickReplyChatEngine, resolveQuickReplyPeerMeta, type QuickReplySendApi } from './QuickReplyChatEngine'
import { personaDb } from '../newFriendsPersona/idb'

const panelSpring = { type: 'spring' as const, stiffness: 380, damping: 36, mass: 0.95 }

type Props = {
  open: boolean
  detail: WeChatInAppCharacterMessageDetail | null
  playerIdentityId: string
  playerDisplayName: string
  playerAvatarUrl?: string
  personaContacts: { characterId?: string; id: string; remarkName: string; avatarUrl?: string }[]
  onClose: () => void
  onExpand: (conversationKey: string) => void
}

export function QuickReplyModal({
  open,
  detail,
  playerIdentityId,
  playerDisplayName,
  playerAvatarUrl,
  personaContacts,
  onClose,
  onExpand,
}: Props) {
  const [draft, setDraft] = useState('')
  const [typingVisible, setTypingVisible] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const sendApiRef = useRef<QuickReplySendApi | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const chat = detail ? weChatQuickReplyChatFromConversationKey(detail.conversationKey) : null
  const [groupMeta, setGroupMeta] = useState<{ name: string; avatar?: string } | null>(null)

  useEffect(() => {
    if (!open || !chat || chat.kind !== 'group') {
      setGroupMeta(null)
      return
    }
    let cancelled = false
    void personaDb.getGroupChat(chat.groupId).then((g) => {
      if (cancelled) return
      setGroupMeta({
        name: g?.remark?.trim() || g?.name?.trim() || '群聊',
        avatar: g?.avatar?.trim() || undefined,
      })
    })
    return () => {
      cancelled = true
    }
  }, [open, chat])

  const peerMeta = chat
    ? resolveQuickReplyPeerMeta(chat, personaContacts, groupMeta?.name, groupMeta?.avatar)
    : null

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onStorage = () => setRefreshToken((n) => n + 1)
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [open])

  useEffect(() => {
    if (!open) {
      setDraft('')
      setTypingVisible(false)
      sendApiRef.current = null
      return
    }
    const t = window.setTimeout(() => textareaRef.current?.focus(), 120)
    return () => window.clearTimeout(t)
  }, [open, detail?.conversationKey])

  const handleSendReady = useCallback((api: QuickReplySendApi) => {
    sendApiRef.current = api
  }, [])

  const handleSend = useCallback(() => {
    const text = draft.trim()
    if (!text || !sendApiRef.current) return
    sendApiRef.current.sendText(text)
    setDraft('')
    setRefreshToken((n) => n + 1)
  }, [draft])

  const handleBackdropClose = useCallback(() => {
    onClose()
  }, [onClose])

  if (!detail || !chat || !peerMeta) return null

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="quick-reply-backdrop"
          className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={handleBackdropClose}
          aria-hidden={false}
        >
          <motion.div
            layoutId={POD_LAYOUT_ID}
            transition={panelSpring}
            className="fixed left-1/2 z-[9999] flex max-h-[min(50vh,calc(100%-env(safe-area-inset-top,0px)-5.5rem))] w-[90%] max-w-[420px] -translate-x-1/2 flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            style={quickReplyModalTopStyle}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`与 ${detail.title} 快捷回复`}
          >
            <div
              className="flex shrink-0 items-end gap-3 border-b border-neutral-100 px-4 pb-2"
              style={quickReplyModalHeaderRowStyle}
            >
              {(detail.avatarUrl || peerMeta.avatarUrl) ? (
                <img
                  src={detail.avatarUrl || peerMeta.avatarUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                  width={36}
                  height={36}
                />
              ) : (
                <span className="h-9 w-9 shrink-0 rounded-full bg-neutral-200" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-neutral-950">
                {detail.title}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Pressable
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 active:bg-neutral-100"
                  aria-label="进入全屏聊天"
                  onClick={() => onExpand(detail.conversationKey)}
                >
                  <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                </Pressable>
                <Pressable
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 active:bg-neutral-100"
                  aria-label="关闭"
                  onClick={onClose}
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                </Pressable>
              </div>
            </div>

            <QuickReplyMessageStream
              conversationKey={detail.conversationKey}
              typingVisible={typingVisible}
              refreshToken={refreshToken}
            />

            <div className="shrink-0 border-t border-neutral-100 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  rows={1}
                  placeholder="Quick reply... (快捷回复)"
                  className="max-h-24 min-h-[40px] flex-1 resize-none border-0 border-b border-neutral-200 bg-transparent px-0 py-2 text-[14px] text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
                />
                <Pressable
                  type="button"
                  className="mb-1 shrink-0 rounded-full bg-neutral-950 px-4 py-2 text-[13px] font-medium text-white active:bg-neutral-800 disabled:opacity-40"
                  disabled={!draft.trim()}
                  onClick={handleSend}
                >
                  发送
                </Pressable>
              </div>
            </div>
          </motion.div>

          <QuickReplyChatEngine
            chat={chat}
            conversationKey={detail.conversationKey}
            playerIdentityId={playerIdentityId}
            playerDisplayName={playerDisplayName}
            playerAvatarUrl={playerAvatarUrl}
            peerAvatarUrl={detail.avatarUrl || peerMeta.avatarUrl}
            peerNotifyTitle={peerMeta.title}
            personaCharacterId={peerMeta.personaCharacterId}
            useLumiProjectAssistantPrompt={peerMeta.useLumiPrompt}
            onSendReady={handleSendReady}
            onOtherTypingChange={setTypingVisible}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
