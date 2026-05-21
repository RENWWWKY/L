import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

import type { TempChatMessage } from './friendRequestTypes'

export function RejectionTempChatPanel({
  thread,
  onSend,
  isReplying,
}: {
  thread: TempChatMessage[]
  onSend: (text: string) => void | Promise<void>
  isReplying?: boolean
}) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [thread.length, isReplying])

  const runSend = () => {
    const val = draft.trim()
    if (!val || sending || isReplying) return
    void (async () => {
      setSending(true)
      try {
        await onSend(val)
        setDraft('')
      } finally {
        setSending(false)
      }
    })()
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <motion.div
        layout
        className="relative mt-3 border-t border-[#E5E7EB] bg-[#F9FAFB] pl-4 pr-3 pt-3 pb-3"
        style={{ borderTopWidth: '0.5px' }}
      >
        <span
          className="pointer-events-none absolute bottom-3 left-2 top-3 w-px bg-[#E5E7EB]"
          aria-hidden
        />
        <motion.div
          ref={scrollRef}
          layout
          className="max-h-[200px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {thread.length === 0 ? (
            <p className="text-[11px] leading-relaxed text-[#9CA3AF]">尚未开始临时会话</p>
          ) : (
            thread.map((msg, i) => {
              const fromUser = msg.sender === 'user'
              return (
                <div
                  key={`${msg.time}-${i}`}
                  className={`flex ${fromUser ? 'justify-end' : 'justify-start'}`}
                >
                  <p
                    className={`max-w-[88%] whitespace-pre-wrap break-words text-[12px] leading-[1.5] ${
                      fromUser ? 'text-right text-[#1C1C1E]' : 'text-left text-[#6B7280]'
                    }`}
                  >
                    {msg.text}
                  </p>
                </div>
              )
            })
          )}
          <AnimatePresence>
            {isReplying ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-start"
              >
                <p className="text-[11px] text-[#9CA3AF]">对方正在输入</p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 200))}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              runSend()
            }}
            placeholder="说点什么…"
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#000000] outline-none placeholder:text-[#9CA3AF]"
          />
          <button
            type="button"
            disabled={!draft.trim() || sending || isReplying}
            onClick={runSend}
            className="shrink-0 rounded-md bg-[#000000] px-3 py-1.5 text-[12px] font-medium text-white disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
          >
            发送
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
