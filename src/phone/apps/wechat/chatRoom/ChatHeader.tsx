import { memo, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export type ChatHeaderTypingProps = {
  /** 联系人主标题（备注/昵称） */
  contactName: string
  /** 第二行副标题（如 tag），可选 */
  contactSub?: string
  /** 等待队列长度；> 0 时在标题与「正在输入」间切换 */
  pendingCount: number
  /** 为 true 时固定显示「正在输入」（等 API 阶段） */
  forceTyping?: boolean
  /** 正在输入文案 */
  typingText?: string
  /** 标题右侧装饰（静音图标等） */
  titleTrailing?: ReactNode
  titleTrailingInteractive?: boolean
  /** 未读数角标（仅在显示主标题时） */
  titleUnreadCount?: number
  /** 自定义未读数展示组件 */
  renderUnread?: (count: number) => ReactNode
}

/**
 * 聊天顶栏标题区：打字态动画完全内聚，父组件只传 pendingCount / forceTyping，
 * 内部 setInterval / setTimeout 切换不会触发 MessageList 重绘。
 */
function ChatHeaderTypingCenter({
  contactName,
  contactSub,
  pendingCount,
  forceTyping = false,
  typingText = '对方正在输入…',
  titleTrailing,
  titleTrailingInteractive = false,
  titleUnreadCount,
  renderUnread,
}: ChatHeaderTypingProps) {
  const [altPhase, setAltPhase] = useState<'title' | 'typing'>('title')
  const typingAlt = pendingCount > 0 && !forceTyping && !!typingText.trim()
  const showTyping = forceTyping && !!typingText.trim()

  useEffect(() => {
    if (!typingAlt) {
      setAltPhase('title')
      return
    }
    let cancelled = false
    let step = 0
    const delays = [1800, 2200, 1600, 2400]
    let tid: number | null = null
    const schedule = () => {
      if (cancelled) return
      setAltPhase(step % 2 === 0 ? 'typing' : 'title')
      const ms = delays[step % delays.length] ?? 2000
      step += 1
      tid = window.setTimeout(schedule, ms)
    }
    schedule()
    return () => {
      cancelled = true
      if (tid != null) window.clearTimeout(tid)
    }
  }, [typingAlt, typingText, contactName, contactSub])

  const showTitleUnread =
    typeof titleUnreadCount === 'number' &&
    titleUnreadCount > 0 &&
    !showTyping &&
    !(typingAlt && altPhase === 'typing')

  const trailing =
    showTyping ? undefined : typingAlt && altPhase === 'typing' ? undefined : titleTrailing

  if (showTyping) {
    return (
      <div className="relative flex min-h-[36px] min-w-0 flex-1 flex-col items-center justify-center px-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key="wx-typing-line"
            className="flex min-h-[36px] min-w-0 flex-1 flex-col items-center justify-center px-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <p
              className="truncate text-center text-[15px] font-normal leading-snug"
              style={{ color: 'var(--wx-text-muted)' }}
            >
              {typingText}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  if (typingAlt) {
    return (
      <div className="relative flex min-h-[36px] min-w-0 flex-1 flex-col items-center justify-center px-1">
        <AnimatePresence mode="wait" initial={false}>
          {altPhase === 'title' ? (
            <motion.div
              key="wx-alt-title"
              className="flex min-h-[36px] min-w-0 flex-1 flex-col items-center justify-center px-1"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
            >
              {contactSub ? (
                <div className="relative inline-flex max-w-full min-w-0 items-center">
                  <div className="flex min-h-[36px] flex-col items-center justify-center gap-0 leading-tight">
                    <h1
                      className="max-w-full truncate text-center text-[17px] font-semibold tracking-[0.2px]"
                      style={{ color: 'var(--wx-text)' }}
                    >
                      {contactName}
                    </h1>
                    <p
                      className="max-w-full truncate text-center text-[11px] font-normal"
                      style={{ color: 'var(--wx-text-muted)' }}
                    >
                      {contactSub}
                    </p>
                  </div>
                  {trailing ? (
                    <span
                      className={`${titleTrailingInteractive ? '' : 'pointer-events-none'} absolute left-full top-1/2 ml-2 flex shrink-0 -translate-y-1/2 items-center transition-opacity duration-200`}
                      aria-hidden={titleTrailingInteractive ? undefined : true}
                    >
                      {trailing}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="relative inline-flex max-w-full min-w-0 items-center">
                  <h1
                    className="flex min-h-[36px] items-center justify-center gap-0.5 truncate text-center text-[17px] font-semibold leading-[36px] tracking-[0.2px]"
                    style={{ color: 'var(--wx-text)' }}
                  >
                    <span className="truncate">{contactName}</span>
                    {showTitleUnread && renderUnread ? renderUnread(titleUnreadCount) : null}
                  </h1>
                  {trailing ? (
                    <span
                      className={`${titleTrailingInteractive ? '' : 'pointer-events-none'} absolute left-full top-1/2 ml-2 flex shrink-0 -translate-y-1/2 items-center transition-opacity duration-200`}
                      aria-hidden={titleTrailingInteractive ? undefined : true}
                    >
                      {trailing}
                    </span>
                  ) : null}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="wx-alt-typing"
              className="flex min-h-[36px] min-w-0 flex-1 flex-col items-center justify-center px-1"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
            >
              <p
                className="truncate text-center text-[15px] font-normal leading-snug"
                style={{ color: 'var(--wx-text-muted)' }}
              >
                {typingText}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (contactSub) {
    return (
      <div className="relative inline-flex max-w-full min-w-0 items-center">
        <div className="flex min-h-[36px] flex-col items-center justify-center gap-0 leading-tight">
          <h1
            className="max-w-full truncate text-center text-[17px] font-semibold tracking-[0.2px]"
            style={{ color: 'var(--wx-text)' }}
          >
            {contactName}
          </h1>
          <p
            className="max-w-full truncate text-center text-[11px] font-normal"
            style={{ color: 'var(--wx-text-muted)' }}
          >
            {contactSub}
          </p>
        </div>
        {trailing ? (
          <span
            className={`${titleTrailingInteractive ? '' : 'pointer-events-none'} absolute left-full top-1/2 ml-2 flex shrink-0 -translate-y-1/2 items-center`}
            aria-hidden={titleTrailingInteractive ? undefined : true}
          >
            {trailing}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="relative inline-flex max-w-full min-w-0 items-center">
      <h1
        className="flex min-h-[36px] items-center justify-center gap-0.5 truncate text-center text-[17px] font-semibold leading-[36px] tracking-[0.2px]"
        style={{ color: 'var(--wx-text)' }}
      >
        <span className="truncate">{contactName}</span>
        {showTitleUnread && renderUnread ? renderUnread(titleUnreadCount) : null}
      </h1>
      {trailing ? (
        <span
          className={`${titleTrailingInteractive ? '' : 'pointer-events-none'} absolute left-full top-1/2 ml-2 flex shrink-0 -translate-y-1/2 items-center`}
          aria-hidden={titleTrailingInteractive ? undefined : true}
        >
          {trailing}
        </span>
      ) : null}
    </div>
  )
}

export const ChatHeader = memo(ChatHeaderTypingCenter)

/** Messenger 模版顶栏：副标题/状态行内聚打字切换 */
export type ChatHeaderStatusLineProps = {
  contactName: string
  pendingCount: number
  forceTyping?: boolean
  typingText?: string
  idleText?: string
  className?: string
  typingClassName?: string
}

function ChatHeaderStatusLineInner({
  contactName,
  pendingCount,
  forceTyping = false,
  typingText = '对方正在输入…',
  idleText = '在线',
  className = '',
  typingClassName = '',
}: ChatHeaderStatusLineProps) {
  const [showTypingLine, setShowTypingLine] = useState(false)
  const active = forceTyping || pendingCount > 0

  useEffect(() => {
    if (forceTyping) {
      setShowTypingLine(true)
      return
    }
    if (pendingCount <= 0) {
      setShowTypingLine(false)
      return
    }
    let cancelled = false
    let on = true
    let tid: number | null = null
    const tick = () => {
      if (cancelled) return
      on = !on
      setShowTypingLine(on)
      const ms = on ? 1600 + Math.random() * 800 : 2000 + Math.random() * 600
      tid = window.setTimeout(tick, ms)
    }
    tick()
    return () => {
      cancelled = true
      if (tid != null) window.clearTimeout(tid)
    }
  }, [forceTyping, pendingCount, typingText])

  const label = active && showTypingLine ? typingText : idleText

  return (
    <>
      <span className="block w-full truncate text-[16px] font-bold leading-tight text-black">{contactName}</span>
      <span
        className={`mt-[2px] block w-full truncate text-[12px] leading-tight ${active && showTypingLine ? typingClassName : className}`}
      >
        {label}
      </span>
    </>
  )
}

export const ChatHeaderStatusLine = memo(ChatHeaderStatusLineInner)

/** 仅状态行（Telegram 等：标题与状态分行布局） */
export type ChatHeaderStatusOnlyProps = {
  pendingCount: number
  forceTyping?: boolean
  typingText?: string
  idleText?: string
  className?: string
  typingClassName?: string
}

function ChatHeaderStatusOnlyInner({
  pendingCount,
  forceTyping = false,
  typingText = '对方正在输入…',
  idleText = 'online',
  className = '',
  typingClassName = '',
}: ChatHeaderStatusOnlyProps) {
  const [showTypingLine, setShowTypingLine] = useState(false)
  const active = forceTyping || pendingCount > 0

  useEffect(() => {
    if (forceTyping) {
      setShowTypingLine(true)
      return
    }
    if (pendingCount <= 0) {
      setShowTypingLine(false)
      return
    }
    let cancelled = false
    let on = true
    let tid: number | null = null
    const tick = () => {
      if (cancelled) return
      on = !on
      setShowTypingLine(on)
      const ms = on ? 1600 + Math.random() * 800 : 2000 + Math.random() * 600
      tid = window.setTimeout(tick, ms)
    }
    tick()
    return () => {
      cancelled = true
      if (tid != null) window.clearTimeout(tid)
    }
  }, [forceTyping, pendingCount, typingText])

  const label = forceTyping ? typingText : active && showTypingLine ? typingText : idleText

  return (
    <span
      className={`mt-[1px] block truncate text-[13px] leading-tight ${forceTyping || (active && showTypingLine) ? typingClassName : className}`}
    >
      {label}
    </span>
  )
}

export const ChatHeaderStatusOnly = memo(ChatHeaderStatusOnlyInner)
