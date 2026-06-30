import { memo, type ReactNode } from 'react'

import { probeChatRender } from './chatRenderProbe'

/** 消息行 memo 比较：仅 id / status 及行级 UI 态变化时重绘 */
export type MessageItemShellProps = {
  messageId: string
  status?: string
  gap: string
  isHighlighted: boolean
  isRecallAnimating: boolean
  isSelected: boolean
  showAvatarColumnSelf: boolean
  showAvatarColumnOther: boolean
  otherAnimated?: boolean
  selfAnimated?: boolean
  isRecalled?: boolean
  textFingerprint?: string
  children: ReactNode
  onToggleSelect?: () => void
  isMultiSelectMode?: boolean
}

function MessageItemShellInner({
  messageId,
  gap,
  isHighlighted,
  isRecallAnimating,
  isSelected,
  children,
  onToggleSelect,
  isMultiSelectMode = false,
}: MessageItemShellProps) {
  probeChatRender(`MessageItem:${messageId}`)

  const hiCls = isHighlighted ? 'rounded-[8px] bg-black/5 transition-colors duration-300' : ''
  const recallAnimCls = isRecallAnimating ? 'animate-[wxRecallShake_420ms_ease-in-out]' : ''

  if (!isMultiSelectMode) {
    return (
      <div
        className={`wx-chat-msg-row ${gap} ${hiCls} ${recallAnimCls}`}
        data-wx-msg-id={messageId}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      className={`wx-chat-msg-row ${gap} ${hiCls} ${recallAnimCls}`}
      data-wx-msg-id={messageId}
      data-wx-selected={isSelected ? 'true' : undefined}
      onClickCapture={(e) => {
        e.stopPropagation()
        onToggleSelect?.()
      }}
    >
      {children}
    </div>
  )
}

function messageItemShellEqual(a: MessageItemShellProps, b: MessageItemShellProps): boolean {
  return (
    a.messageId === b.messageId &&
    a.status === b.status &&
    a.gap === b.gap &&
    a.isHighlighted === b.isHighlighted &&
    a.isRecallAnimating === b.isRecallAnimating &&
    a.isSelected === b.isSelected &&
    a.showAvatarColumnSelf === b.showAvatarColumnSelf &&
    a.showAvatarColumnOther === b.showAvatarColumnOther &&
    a.otherAnimated === b.otherAnimated &&
    a.selfAnimated === b.selfAnimated &&
    a.isRecalled === b.isRecalled &&
    a.textFingerprint === b.textFingerprint &&
    a.isMultiSelectMode === b.isMultiSelectMode
  )
}

export const MemoizedMessageItem = memo(MessageItemShellInner, messageItemShellEqual)

/** 非 memo 消息行的 props 指纹，供父级决定是否跳过重建 children */
export function chatMsgRenderFingerprint(m: {
  id: string
  status?: string
  text?: string
  isRecalled?: boolean
  otherAnimated?: boolean
  selfAnimated?: boolean
}): string {
  return `${m.id}|${m.status ?? ''}|${m.isRecalled ? 1 : 0}|${m.otherAnimated ? 1 : 0}|${m.selfAnimated ? 1 : 0}|${(m.text ?? '').length}`
}
