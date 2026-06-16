import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import type { FriendRequest } from './friendRequestTypes'
import { WeChatChatMixedText } from '../WeChatChatMixedText'
import { formatWeChatChatTimestamp, shouldRenderWeChatTimestamp } from '../time/wechatTimeUtils'

type CeremonyState = null | 'accepted' | 'declined'

function verificationBubbleStyle(fromCharacter: boolean): CSSProperties {
  return {
    backgroundColor: fromCharacter
      ? 'var(--wx-other-bubble-bg, #ffffff)'
      : 'var(--wx-self-bubble-bg, #d9f7d9)',
    color: fromCharacter ? 'var(--wx-other-bubble-text, #2f2f2f)' : 'var(--wx-self-bubble-text, #1a1a1a)',
    borderRadius: fromCharacter
      ? 'var(--wx-other-bubble-radius, 18px)'
      : 'var(--wx-self-bubble-radius, 18px)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  }
}

export function RequestDetail({
  request,
  onBack,
  onReply,
  onTriggerReply,
  isReplying = false,
  onAccept,
  onDecline,
  userInitiated = false,
  onRetryAdjudication,
}: {
  request: FriendRequest
  onBack: () => void
  onReply: (text: string) => void | Promise<void>
  onTriggerReply: () => void | Promise<void>
  isReplying?: boolean
  onAccept: () => void
  onDecline: () => void
  /** 用户主动添加：由对方（角色）裁决，不展示「同意/拒绝」按钮 */
  userInitiated?: boolean
  onRetryAdjudication?: () => void
}) {
  const [draft, setDraft] = useState('')
  const [ceremony, setCeremony] = useState<CeremonyState>(null)
  const [replySending, setReplySending] = useState(false)
  const [canTriggerReply, setCanTriggerReply] = useState(false)
  const [visibleCount, setVisibleCount] = useState(request.messages.length)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pending = request.status === 'pending'
  const userInitiatedWaiting = userInitiated && pending

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
  }, [request.id, request.messages.length])

  useEffect(() => {
    if (userInitiatedWaiting) {
      setVisibleCount(request.messages.length)
      return
    }
    if (visibleCount > request.messages.length) {
      setVisibleCount(request.messages.length)
      return
    }
    if (visibleCount >= request.messages.length) return
    const timer = window.setTimeout(() => {
      setVisibleCount((v) => Math.min(v + 1, request.messages.length))
    }, 160)
    return () => window.clearTimeout(timer)
  }, [request.messages.length, visibleCount, isReplying, userInitiatedWaiting, request.messages])

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
      <div className="border-b border-[#EBEBEB] bg-white px-4 pb-4 pt-6 text-center">
        <div className="mx-auto h-[78px] w-[78px] overflow-hidden rounded-full border border-[#E0E0E0] bg-[#F5F5F5]">
          {request.avatar?.trim() ? <img src={request.avatar} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <p className="mt-3 text-[17px] font-medium text-[#111111]">{request.nickname}</p>
        <p className="mt-1 text-[12px] text-[#8A8A8A]">{request.source}</p>
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
                      className="rounded-full bg-[#F0F0F0] px-3 py-1 text-[12px] text-[#8A8A8A]"
                      style={{ lineHeight: 1.1 }}
                    >
                      {left ? (
                        <>
                          <WeChatChatMixedText text={left} />
                          &nbsp;
                        </>
                      ) : null}
                      <WeChatChatMixedText text={time} />
                    </span>
                  </div>
                </div>
              )
            }
            const fromCharacter = item.sender === 'character'
            return (
              <div key={item.id} className="mt-3 space-y-2">
                <div className={fromCharacter ? 'mr-8' : 'ml-8 flex flex-col items-end'}>
                  <motion.div
                    className="inline-block max-w-full whitespace-pre-wrap break-words px-3.5 py-2.5 text-[14px] leading-[1.55]"
                    style={verificationBubbleStyle(fromCharacter)}
                  >
                    {item.content ? (
                      <WeChatChatMixedText text={item.content} />
                    ) : null}
                  </motion.div>
                </div>
              </div>
            )
          })}
          {isReplying && visibleMessages[visibleMessages.length - 1]?.sender === 'user' ? (
            <div className="mr-8">
              <motion.div
                className="inline-flex items-center gap-1 px-3.5 py-2.5"
                style={verificationBubbleStyle(true)}
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={`typing-dot-${i}`}
                    className="inline-block h-1.5 w-1.5 rounded-full bg-[#9da0a8] animate-[bounce_1s_infinite]"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </motion.div>
            </div>
          ) : null}
        </div>
      </div>

      {pending && !ceremony ? (
        <div className="absolute inset-x-0 bottom-0 z-[15] border-t border-[#EBEBEB] bg-white px-4 pb-[max(14px,env(safe-area-inset-bottom,0px))] pt-3">
          {userInitiatedWaiting ? (
            <div className="space-y-3">
              {request.adjudicationLastError?.trim() ? (
                <p className="text-center text-[12px] leading-relaxed text-[#c45c5c]">{request.adjudicationLastError}</p>
              ) : null}
              <p className="text-center text-[12px] leading-relaxed text-[#8A8A8A]">
                {isReplying
                  ? '对方正在处理你的申请…'
                  : '你已发送申请，请在本页等待对方回应；对方同意后将自动加入通讯录。等待期间无需操作，也不会改变对方的回复内容。'}
              </p>
              {request.adjudicationLastError?.trim() && onRetryAdjudication && !isReplying ? (
                <button
                  type="button"
                  className="mx-auto block rounded-[10px] border border-[#576b95] px-4 py-2 text-[13px] font-medium text-[#576b95] active:bg-[#f5f7fa]"
                  onClick={() => onRetryAdjudication()}
                >
                  重新请求对方处理
                </button>
              ) : null}
            </div>
          ) : (
            <>
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
                className="h-10 min-w-0 flex-1 rounded-[10px] border border-[#E0E0E0] bg-white px-3 text-[13px] text-[#111111] outline-none placeholder:text-[#B0B0B0] focus:border-[#111111]"
              />
              <button
                type="button"
                className="h-10 shrink-0 rounded-[10px] border border-[#111111] bg-[#111111] px-3 text-[12px] font-medium text-white disabled:border-[#E0E0E0] disabled:bg-[#F0F0F0] disabled:text-[#B0B0B0]"
                disabled={replySending || isReplying || (!draft.trim() && !(canTriggerReply || canTriggerByMessages))}
                onClick={runSendOrTrigger}
              >
                {replySending || isReplying ? '处理中…' : draft.trim() ? '发送' : '触发回复'}
              </button>
            </div>
            {isReplying ? (
              <p className="mt-2 text-[11px] text-[#8A8A8A]">对方正在输入...</p>
            ) : null}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="h-11 rounded-[10px] border border-[#E0E0E0] bg-white text-[14px] font-medium text-[#111111] active:bg-[#F5F5F5]"
                onClick={() => runDecision('declined')}
              >
                拒绝
              </button>
              <button
                type="button"
                className="h-11 rounded-[10px] bg-[#111111] text-[14px] font-medium text-white active:opacity-90"
                onClick={() => runDecision('accepted')}
              >
                同意
              </button>
            </div>
            </>
          )}
        </div>
      ) : null}

      {request.status === 'declined' && userInitiated ? (
        <div className="absolute inset-x-0 bottom-0 z-[15] border-t border-[#EBEBEB] bg-white px-4 py-4 pb-[max(14px,env(safe-area-inset-bottom,0px))]">
          <p className="text-center text-[12px] leading-relaxed text-[#8A8A8A]">对方未通过你的好友申请</p>
        </div>
      ) : null}

      <AnimatePresence>
        {ceremony ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-[30] flex items-center justify-center bg-white/75"
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="rounded-[14px] border border-[#111111] bg-white px-5 py-4 text-center shadow-[0_12px_40px_rgba(0,0,0,0.1)]"
            >
              <p className="text-[14px] font-medium text-[#111111]">
                {ceremony === 'accepted'
                  ? userInitiated
                    ? '对方已通过你的好友申请'
                    : '已添加至通讯录'
                  : userInitiated
                    ? '对方暂未通过你的申请'
                    : '已拒绝该申请'}
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
