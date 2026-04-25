import { useEffect, useMemo, useRef } from 'react'

import type { VoiceLogMessage } from './types'
import { MessageUnit } from './MessageUnit'

/**
 * 通话对话日志区（终端输出）。
 * - 线性向下排列，支持平滑滚动。
 * - 新消息开始“打印”时自动滚到底（确保最新内容可见）。
 */
export function ConversationLog({
  messages,
  typingMessageId,
  peerAvatarUrl,
  onTypingComplete,
}: {
  messages: VoiceLogMessage[]
  typingMessageId: string | null
  peerAvatarUrl?: string
  onTypingComplete: (id: string) => void
}) {
  const endRef = useRef<HTMLDivElement>(null)

  const lastId = useMemo(() => (messages.length ? messages[messages.length - 1]!.id : null), [messages])

  useEffect(() => {
    // 新消息入场或开始打字时，平滑滚到底部
    if (!endRef.current) return
    endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [lastId, typingMessageId])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4">
      {messages.map((m) => (
        <MessageUnit
          key={m.id}
          msg={m}
          activeTyping={typingMessageId === m.id && m.role === 'character'}
          peerAvatarUrl={peerAvatarUrl}
          speedMs={48}
          onTypedComplete={() => onTypingComplete(m.id)}
        />
      ))}
      <div ref={endRef} />
    </div>
  )
}

