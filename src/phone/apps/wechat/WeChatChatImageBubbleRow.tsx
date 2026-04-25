import { useCallback, useMemo, useRef } from 'react'

import type { WeChatBubbleTheme } from '../../types'
import { useWeChatLongPress } from './hooks/useWeChatLongPress'

type Props = {
  id: string
  isSelf: boolean
  src: string
  isSticker?: boolean
  bubble: WeChatBubbleTheme
  showAvatar: boolean
  showAvatarColumn: boolean
  chatSelfAvatarUrl?: string
  chatOtherAvatarUrl?: string
  selected?: boolean
  onLongPress?: (anchorRect: DOMRect) => void
}

export function WeChatChatImageBubbleRow({
  id: _id,
  isSelf,
  src,
  isSticker = false,
  bubble,
  showAvatar,
  showAvatarColumn,
  chatSelfAvatarUrl,
  chatOtherAvatarUrl,
  selected = false,
  onLongPress,
}: Props) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const avatarPx = 40
  const bubbleRadius = isSelf ? `${bubble.selfBubbleRadiusPx}px` : `${bubble.otherBubbleRadiusPx}px`

  const bg = '#ffffff'
  const border = isSelf ? '1px solid #000000' : '1px solid rgba(0,0,0,0.08)'

  const handleLongPress = useCallback(() => {
    if (!onLongPress) return
    const el = anchorRef.current
    if (!el) return
    onLongPress(el.getBoundingClientRect())
  }, [onLongPress])

  const { bind, pressing } = useWeChatLongPress({
    enabled: !!onLongPress,
    ms: 500,
    moveThresholdPx: 10,
    onLongPress: () => handleLongPress(),
  })

  const imageBlock = useMemo(() => {
    return (
      <div
        ref={anchorRef}
        className="inline-block overflow-hidden select-none transition-[transform,opacity] duration-150 ease-out"
        style={{
          borderRadius: bubbleRadius,
          border,
          background: bg,
          userSelect: 'none',
          WebkitUserSelect: 'none' as any,
          WebkitTouchCallout: 'none' as any,
          transform: pressing && !selected ? 'scale(0.98)' : 'scale(1)',
          opacity: pressing && !selected ? 0.9 : 1,
          transformOrigin: isSelf ? 'right bottom' : 'left bottom',
        }}
        {...bind}
      >
        <img
          src={src}
          alt=""
          className={isSticker ? 'block h-auto w-[160px] max-w-[46vw] select-none object-cover' : 'block h-auto w-[180px] max-w-[56vw] select-none object-cover'}
          style={{ borderRadius: bubbleRadius }}
          draggable={false}
        />
        {selected ? (
          <span
            className="pointer-events-none absolute inset-0"
            style={{
              borderRadius: bubbleRadius,
              background: 'rgba(0,0,0,0.08)',
            }}
            aria-hidden
          />
        ) : null}
      </div>
    )
  }, [bg, bind, border, bubbleRadius, isSticker, pressing, selected, src])

  const showAvatarVisual = showAvatar && showAvatarColumn
  const reserveAvatarGutter = showAvatar
  const selfChatAvatarSrc = isSelf ? (chatSelfAvatarUrl?.trim() ?? '') : ''
  const otherChatAvatarSrc = !isSelf ? (chatOtherAvatarUrl?.trim() ?? '') : ''

  if (!isSelf) {
    return (
      <div className="w-[100vw] max-w-[100vw] shrink-0 overflow-x-hidden" data-wx-msg-id={_id}>
        {!showAvatar ? (
          <div className="ml-[24px] mr-auto min-w-0">{imageBlock}</div>
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
            {imageBlock}
          </div>
        ) : reserveAvatarGutter ? (
          <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
            <div className="h-10 w-10 shrink-0" aria-hidden />
            {imageBlock}
          </div>
        ) : (
          <div className="ml-[24px] mr-auto min-w-0">{imageBlock}</div>
        )}
      </div>
    )
  }

  return (
    <div className="flex w-[100vw] max-w-[100vw] shrink-0 items-end justify-end gap-[4px] overflow-x-hidden" data-wx-msg-id={_id}>
      {!showAvatar ? (
        <div className="mr-[24px] ml-auto min-w-0">{imageBlock}</div>
      ) : showAvatarVisual ? (
        <div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-[12px]">
          {imageBlock}
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
          {imageBlock}
          <div className="h-10 w-10 shrink-0" aria-hidden />
        </div>
      ) : (
        <div className="mr-[24px] ml-auto min-w-0">{imageBlock}</div>
      )}
    </div>
  )
}

