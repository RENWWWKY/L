import { useCallback, useMemo, useRef } from 'react'

import type { WeChatBubbleTheme } from '../../../types'
import { useLongPress } from '../hooks/useWeChatLongPress'
import { RedPacketBubble, type RedPacketBubbleData } from './RedPacketBubble'

type Props = {
  id: string
  isSelf: boolean
  data: RedPacketBubbleData
  bubble: WeChatBubbleTheme
  showAvatar: boolean
  showAvatarColumn: boolean
  chatSelfAvatarUrl?: string
  chatOtherAvatarUrl?: string
  selected?: boolean
  onOpen: () => void
  onLongPress?: (anchorRect: DOMRect) => void
}

/**
 * 与图片气泡行一致：头像列 + 红包卡片；短按打开拆红包，长按出操作面板。
 */
export function RedPacketChatRow({
  id: _id,
  isSelf,
  data,
  bubble,
  showAvatar,
  showAvatarColumn,
  chatSelfAvatarUrl,
  chatOtherAvatarUrl,
  selected = false,
  onOpen,
  onLongPress,
}: Props) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const bubbleRadius = isSelf ? `${bubble.selfBubbleRadiusPx}px` : `${bubble.otherBubbleRadiusPx}px`
  const avatarPx = 40

  const handleLongPress = useCallback(() => {
    if (!onLongPress) return
    const el = anchorRef.current
    if (!el) return
    onLongPress(el.getBoundingClientRect())
  }, [onLongPress])

  const { bind, pressing } = useLongPress({
    enabled: !!onLongPress,
    ms: 500,
    moveThresholdPx: 10,
    onLongPress: () => handleLongPress(),
  })

  const packetBlock = useMemo(
    () => (
      <div
        ref={anchorRef}
        className="relative inline-block select-none transition-[transform,opacity] duration-150 ease-out"
        style={{
          borderRadius: bubbleRadius,
          transform: pressing && !selected ? 'scale(0.98)' : 'scale(1)',
          opacity: pressing && !selected ? 0.92 : 1,
          transformOrigin: isSelf ? 'right bottom' : 'left bottom',
          userSelect: 'none',
          WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'],
          WebkitTouchCallout: 'none' as React.CSSProperties['WebkitTouchCallout'],
        }}
        {...bind}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen()
          }
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (!selected) onOpen()
        }}
      >
        <RedPacketBubble data={data} isSelf={isSelf} />
        {selected ? (
          <span
            className="pointer-events-none absolute inset-0 rounded-[14px]"
            style={{ background: 'rgba(0,0,0,0.08)' }}
            aria-hidden
          />
        ) : null}
      </div>
    ),
    [bind, bubbleRadius, data, isSelf, onOpen, pressing, selected],
  )

  const showAvatarVisual = showAvatar && showAvatarColumn
  const reserveAvatarGutter = showAvatar
  const selfChatAvatarSrc = isSelf ? (chatSelfAvatarUrl?.trim() ?? '') : ''
  const otherChatAvatarSrc = !isSelf ? (chatOtherAvatarUrl?.trim() ?? '') : ''

  if (!isSelf) {
    return (
      <div className="w-[100vw] max-w-[100vw] shrink-0 overflow-x-hidden" data-wx-msg-id={_id}>
        {!showAvatar ? (
          <div className="ml-[24px] mr-auto min-w-0">{packetBlock}</div>
        ) : showAvatarVisual ? (
          <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
            {otherChatAvatarSrc ? (
              <img
                src={otherChatAvatarSrc}
                alt=""
                width={avatarPx}
                height={avatarPx}
                className="h-10 w-10 shrink-0 object-cover"
                style={{
                  borderRadius: `${bubble.avatarRadiusPx}px`,
                  border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
                }}
                aria-hidden
              />
            ) : (
              <div
                className="h-10 w-10 shrink-0"
                style={{
                  borderRadius: `${bubble.avatarRadiusPx}px`,
                  background: 'rgba(0,0,0,0.06)',
                  border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
                }}
                aria-hidden
              />
            )}
            {packetBlock}
          </div>
        ) : reserveAvatarGutter ? (
          <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
            <div className="h-10 w-10 shrink-0" aria-hidden />
            {packetBlock}
          </div>
        ) : (
          <div className="ml-[24px] mr-auto min-w-0">{packetBlock}</div>
        )}
      </div>
    )
  }

  return (
    <div className="flex w-[100vw] max-w-[100vw] shrink-0 items-end justify-end gap-[4px] overflow-x-hidden" data-wx-msg-id={_id}>
      {!showAvatar ? (
        <div className="mr-[24px] ml-auto min-w-0">{packetBlock}</div>
      ) : showAvatarVisual ? (
        <div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-[12px]">
          {packetBlock}
          {selfChatAvatarSrc ? (
            <img
              src={selfChatAvatarSrc}
              alt=""
              width={avatarPx}
              height={avatarPx}
              className="h-10 w-10 shrink-0 object-cover"
              style={{
                borderRadius: `${bubble.avatarRadiusPx}px`,
                border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
              }}
              aria-hidden
            />
          ) : (
            <div
              className="h-10 w-10 shrink-0"
              style={{
                borderRadius: `${bubble.avatarRadiusPx}px`,
                background: 'rgba(0,0,0,0.04)',
              }}
              aria-hidden
            />
          )}
        </div>
      ) : reserveAvatarGutter ? (
        <div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-[12px]">
          {packetBlock}
          <div className="h-10 w-10 shrink-0" aria-hidden />
        </div>
      ) : (
        <div className="mr-[24px] ml-auto min-w-0">{packetBlock}</div>
      )}
    </div>
  )
}
