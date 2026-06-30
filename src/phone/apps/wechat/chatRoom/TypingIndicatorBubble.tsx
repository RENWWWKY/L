import { memo } from 'react'

import '../chatRoomMotion.css'

export type TypingIndicatorBubbleProps = {
  /** 对方头像 URL；空则灰色占位 */
  avatarUrl?: string
  /** 是否显示头像列 */
  showAvatar?: boolean
  avatarRadiusPx?: number
}

/**
 * 底部「对方正在输入」气泡：三个点纯 CSS 动画，零 JS 帧循环。
 */
function TypingIndicatorBubbleInner({
  avatarUrl,
  showAvatar = true,
  avatarRadiusPx = 6,
}: TypingIndicatorBubbleProps) {
  const src = avatarUrl?.trim()
  const avatarStyle = {
    borderRadius: `${avatarRadiusPx}px`,
    border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
  } as const

  return (
    <div
      className="mt-4 flex w-full max-w-full shrink-0 justify-start overflow-x-hidden pl-[24px] pr-[24px]"
      aria-live="polite"
      aria-label="对方正在输入"
    >
      <div className="flex max-w-full flex-row items-end gap-3">
        {showAvatar ? (
          src ? (
            <img
              src={src}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-cover"
              style={avatarStyle}
              aria-hidden
            />
          ) : (
            <div
              className="h-10 w-10 shrink-0"
              style={{
                ...avatarStyle,
                background: 'rgba(0,0,0,0.06)',
              }}
              aria-hidden
            />
          )
        ) : null}
        <div
          className="wx-chat-typing-bubble inline-flex items-center gap-[3px] rounded-lg bg-[#ededed] px-3 py-2"
          style={{ minHeight: 40 }}
          aria-hidden
        >
          <span className="wx-chat-typing-dot" />
          <span className="wx-chat-typing-dot" />
          <span className="wx-chat-typing-dot" />
        </div>
      </div>
    </div>
  )
}

export const TypingIndicatorBubble = memo(TypingIndicatorBubbleInner)
