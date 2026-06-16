import { useCallback, useEffect, useRef, useState } from 'react'
import type { WeChatChatMessage } from '../newFriendsPersona/types'
import { personaDb } from '../newFriendsPersona/idb'
import { isQuickReplyDisplayableMessage, QuickReplyMessageBubble } from './QuickReplyMessageBubble'

type StreamItem = {
  id: string
  from: 'self' | 'other'
  message: WeChatChatMessage
}

function mapRows(rows: WeChatChatMessage[]): StreamItem[] {
  return rows
    .filter(isQuickReplyDisplayableMessage)
    .map((m) => ({
      id: m.id,
      from: m.type === 'player' ? 'self' : 'other',
      message: m,
    }))
}

function takeLastFive(items: StreamItem[]): StreamItem[] {
  return items.slice(-5)
}

type Props = {
  conversationKey: string
  typingVisible: boolean
  refreshToken: number
}

export function QuickReplyMessageStream({ conversationKey, typingVisible, refreshToken }: Props) {
  const [items, setItems] = useState<StreamItem[]>([])
  const conversationKeyRef = useRef(conversationKey)

  const reloadRecent = useCallback(async (key: string) => {
    const rows = await personaDb.listWeChatChatMessagesRecent({ conversationKey: key, limit: 16 })
    if (conversationKeyRef.current !== key) return
    setItems(takeLastFive(mapRows(rows)))
  }, [])

  useEffect(() => {
    conversationKeyRef.current = conversationKey
    let cancelled = false
    void (async () => {
      const rows = await personaDb.listWeChatChatMessagesRecent({ conversationKey, limit: 16 })
      if (cancelled || conversationKeyRef.current !== conversationKey) return
      setItems(takeLastFive(mapRows(rows)))
    })()
    return () => {
      cancelled = true
    }
  }, [conversationKey, refreshToken, reloadRecent])

  useEffect(() => {
    const onStorage = () => {
      void reloadRecent(conversationKeyRef.current)
    }
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [reloadRecent])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
      {items.map((m) => (
        <div
          key={m.id}
          className={`flex ${m.from === 'self' ? 'justify-end' : 'justify-start'}`}
        >
          <QuickReplyMessageBubble message={m.message} isSelf={m.from === 'self'} />
        </div>
      ))}
      {typingVisible ? (
        <div className="flex justify-start" aria-live="polite" aria-label="对方正在输入">
          <div className="inline-flex items-center gap-1 rounded-2xl bg-neutral-100 px-3 py-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400"
                style={{
                  animation: 'wxQuickReplyTypingDot 1.05s ease-in-out infinite',
                  animationDelay: `${i * 0.18}s`,
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
      <style>{`@keyframes wxQuickReplyTypingDot { 0%, 80%, 100% { transform: translateY(0); opacity: 0.35; } 40% { transform: translateY(-3px); opacity: 1; } }`}</style>
    </div>
  )
}
