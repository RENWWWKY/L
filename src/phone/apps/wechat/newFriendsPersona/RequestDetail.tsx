import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { FriendRequest } from './NewFriendsList'
import { formatWeChatChatTimestamp, shouldRenderWeChatTimestamp } from '../time/wechatTimeUtils'

type CeremonyState = null | 'accepted' | 'declined'

export function RequestDetail({
  request,
  onBack,
  onReply,
  onTriggerReply,
  isReplying = false,
  onAccept,
  onDecline,
}: {
  request: FriendRequest
  onBack: () => void
  onReply: (text: string) => void | Promise<void>
  onTriggerReply: () => void | Promise<void>
  isReplying?: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  const [draft, setDraft] = useState('')
  const [ceremony, setCeremony] = useState<CeremonyState>(null)
  const [replySending, setReplySending] = useState(false)
  const [canTriggerReply, setCanTriggerReply] = useState(false)
  const [visibleCount, setVisibleCount] = useState(request.messages.length)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pending = request.status === 'pending'

  const lastMsg = request.messages[request.messages.length - 1]
  const canTriggerByMessages = !!lastMsg && lastMsg.sender === 'user'

  useEffect(() => {
    if (canTriggerByMessages) return
    setCanTriggerReply(false)
  }, [canTriggerByMessages])

  const runSendOrTrigger = () => {
    const val = draft.trim()
    if (val) {
      void (async () => {
        setReplySending(true)
        try {
          await onReply(val)
          setDraft('')
          setCanTriggerReply(true)
        } finally {
          setReplySending(false)
        }
      })()
      return
    }
    if (!(canTriggerReply || canTriggerByMessages)) return
    void (async () => {
      setReplySending(true)
      try {
        await onTriggerReply()
        setCanTriggerReply(false)
      } finally {
        setReplySending(false)
      }
    })()
  }

  const runDecision = (type: Exclude<CeremonyState, null>) => {
    if (!pending) return
    if (type === 'accepted') onAccept()
    else onDecline()
    setCeremony(type)
    window.setTimeout(() => onBack(), 1000)
  }

  useEffect(() => {
    setVisibleCount(request.messages.length)
    queueMicrotask(() => {
      const el = scrollRef.current
      if (!el) return
      el.scrollTop = el.scrollHeight
    })
  }, [request.id])

  useEffect(() => {
    if (visibleCount > request.messages.length) {
      setVisibleCount(request.messages.length)
      return
    }
    if (visibleCount >= request.messages.length) return
    const timer = window.setTimeout(() => {
      setVisibleCount((v) => Math.min(v + 1, request.messages.length))
    }, 160)
    return () => window.clearTimeout(timer)
  }, [request.messages.length, visibleCount])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [visibleCount, isReplying])

  const visibleMessages = useMemo(() => request.messages.slice(0, Math.max(0, visibleCount)), [request.messages, visibleCount])

  const renderItems = useMemo(() => {
    const out: Array<
      | { kind: 'time'; id: string; text: string }
      | { kind: 'msg'; id: string; sender: 'character' | 'user'; content: string }
    > = []
    let lastShownTime: number | null = null
    const now = Date.now()
    for (const msg of visibleMessages) {
      const ts = typeof msg.timestampMs === 'number' && Number.isFinite(msg.timestampMs) ? msg.timestampMs : now
      if (shouldRenderWeChatTimestamp(lastShownTime, ts)) {
        out.push({ kind: 'time', id: `t-${msg.id}-${ts}`, text: formatWeChatChatTimestamp(ts, now) })
        lastShownTime = ts
      }
      out.push({ kind: 'msg', id: msg.id, sender: msg.sender, content: msg.content })
    }
    return out
  }, [visibleMessages])

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0.98 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-full min-h-0 flex-col overflow-x-hidden touch-pan-y overscroll-x-none bg-transparent"
    >
      <div className="border-b border-[#ececee]/90 bg-white/78 px-4 pb-4 pt-6 text-center backdrop-blur-sm">
        <div
          className="mx-auto h-[78px] w-[78px] overflow-hidden rounded-full border bg-white shadow-[0_6px_26px_rgba(0,0,0,0.08)]"
          style={{ borderColor: '#e6e6e8' }}
        >
          {request.avatar?.trim() ? <img src={request.avatar} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <p className="mt-3 text-[17px] font-semibold text-[#17181b]">{request.nickname}</p>
        <p className="mt-1 text-[12px] text-[#8e9097]">{request.source}</p>
      </div>

      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-[180px] touch-pan-y overscroll-x-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="relative space-y-3">
          {renderItems.map((item) => {
            if (item.kind === 'time') {
              const parts = item.text.split(' ')
              const left = parts.slice(0, -1).join(' ')
              const time = parts.at(-1) ?? ''
              return (
                <div key={item.id} className="mt-4">
                  <div className="flex justify-center">
                    <span
                      className="rounded-full bg-[#f2f2f2] px-3 py-1 text-[12px]"
                      style={{ color: '#999999', lineHeight: 1.1 }}
                    >
                      {left ? <span style={{ fontFamily: 'var(--wx-font)' }}>{left}&nbsp;</span> : null}
                      <span
                        style={{
                          fontFamily: 'var(--wx-num-font)',
                          fontVariantNumeric: 'tabular-nums lining-nums',
                          fontFeatureSettings: '"tnum" 1, "lnum" 1',
                          display: 'inline-block',
                        }}
                      >
                        {time}
                      </span>
                    </span>
                  </div>
                </div>
              )
            }
            const fromCharacter = item.sender === 'character'
            return (
              <div key={item.id} className="mt-3 space-y-2">
                <div className={fromCharacter ? 'mr-8' : 'ml-8 flex flex-col items-end'}>
                  <div
                    className={`inline-block max-w-full whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-[13px] leading-6 ${
                      fromCharacter
                        ? 'bg-gray-50 text-[#34363d] italic'
                        : 'border border-[#D4AF37]/30 bg-white text-[#1f2127]'
                    }`}
                  >
                    {item.content}
                  </div>
                </div>
              </div>
            )
          })}
          {isReplying && visibleMessages[visibleMessages.length - 1]?.sender === 'user' ? (
            <div className="mr-8">
              <div className="inline-flex items-center gap-1 rounded-xl bg-gray-50 px-3 py-2 text-[#8a8d95]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={`typing-dot-${i}`}
                    className="inline-block h-1.5 w-1.5 rounded-full bg-[#9da0a8] animate-[bounce_1s_infinite]"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {pending && !ceremony ? (
        <div className="absolute inset-x-0 bottom-0 z-[15] border-t border-[#ececee]/90 bg-white/72 px-4 pb-[max(14px,env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 200))}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  if (replySending || isReplying) return
                  runSendOrTrigger()
                }}
                placeholder="输入验证回复..."
                className="h-10 min-w-0 flex-1 rounded-xl border border-[#e6e6ea] bg-[#fcfcfd] px-3 text-[13px] text-[#1f2127] outline-none placeholder:text-[#a5a7ad]"
              />
              <button
                type="button"
                className="h-10 rounded-xl border border-[#dedee2] bg-white px-3 text-[12px] text-[#23252a] disabled:opacity-50"
                disabled={replySending || isReplying || (!draft.trim() && !(canTriggerReply || canTriggerByMessages))}
                onClick={runSendOrTrigger}
              >
                {replySending || isReplying ? '处理中…' : draft.trim() ? '发送' : '触发回复'}
              </button>
            </div>
            {isReplying ? (
              <p className="mt-2 text-[11px] text-[#9ea1a8]">对方正在输入...</p>
            ) : null}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="h-11 rounded-xl bg-[#f2f2f4] text-[14px] font-medium text-[#3b3d44] transition-colors duration-200 hover:text-[#7a3131]"
                onClick={() => runDecision('declined')}
              >
                拒绝
              </button>
              <button
                type="button"
                className="h-11 rounded-xl bg-black text-[14px] font-semibold text-[#f2e4b5] transition-colors duration-200 hover:bg-[#111]"
                onClick={() => runDecision('accepted')}
              >
                同意
              </button>
            </div>
          </div>
        ) : null}

      <AnimatePresence>
        {ceremony ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-[30] flex items-center justify-center bg-white/60"
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="rounded-2xl border bg-white px-5 py-4 text-center shadow-[0_14px_42px_rgba(0,0,0,0.15)]"
              style={{ borderColor: '#e3e3e6' }}
            >
              <p className="text-[14px] font-semibold text-[#1d1f23]">
                {ceremony === 'accepted' ? '已添加至通讯录' : '已拒绝该申请'}
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
