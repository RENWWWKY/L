import { useEffect, useRef } from 'react'

import type { VoiceLogMessage } from './types'
import { Typewriter } from './Typewriter'

/**
 * 单条“终端日志”消息。
 * - activeTyping=true 时使用打字机逐字输出，并在末尾显示块状光标。
 * - 打字结束后通过 onTypedComplete 通知上层推进状态。
 */
export function MessageUnit({
  msg,
  activeTyping,
  speedMs = 52,
  peerAvatarUrl,
  onTypedComplete,
}: {
  msg: VoiceLogMessage
  activeTyping: boolean
  speedMs?: number
  peerAvatarUrl?: string
  onTypedComplete?: () => void
}) {
  const full = msg.text
  const reportedRef = useRef(false)

  useEffect(() => {
    if (!activeTyping) {
      reportedRef.current = false
      return
    }
  }, [activeTyping])

  const prefixTone =
    msg.role === 'user'
      ? { color: 'rgba(28,28,30,0.66)' }
      : { color: '#000' }
  const textTone =
    msg.role === 'user'
      ? { color: 'rgba(28,28,30,0.62)' }
      : { color: '#000' }

  return (
    <div className="py-2">
      <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`flex max-w-[86%] items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
          {msg.role === 'character' ? (
            peerAvatarUrl?.trim() ? (
              <img src={peerAvatarUrl.trim()} alt="" className="mt-0.5 h-5 w-5 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="mt-0.5 inline-block h-5 w-5 shrink-0 rounded-full bg-black/8" />
            )
          ) : null}
          <div className="min-w-0 whitespace-pre-wrap break-words text-[14px] leading-[1.75]" style={textTone}>
            <span className="mr-1 text-[12px] leading-[1.7]" style={prefixTone}>
              [{msg.prefix}] {'>'}
            </span>
            {msg.role === 'user' && msg.audioUrl ? (
              <span className="inline-flex items-center">
                <audio controls preload="metadata" src={msg.audioUrl} className="h-8 max-w-[220px] align-middle" />
              </span>
            ) : msg.role === 'character' && activeTyping ? (
              <Typewriter
                text={full}
                speedMs={speedMs}
                onDone={() => {
                  if (reportedRef.current) return
                  reportedRef.current = true
                  onTypedComplete?.()
                }}
              />
            ) : (
              full
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

