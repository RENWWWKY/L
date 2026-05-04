import { useCallback, useMemo, useRef } from 'react'

import type { WeChatBubbleTheme } from '../../types'
import {
  ChatGroupSenderNicknameWithRank,
  ChatGroupSpeakerRankOnAvatar,
} from './group/ChatGroupSpeakerAvatarWrap'
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
  chatOtherSenderNickname?: string
  chatOtherAvatarRankBadge?: 'owner' | 'admin' | null
  chatSelfAvatarRankBadge?: 'owner' | 'admin' | null
  /** 头像旁头衔是否与昵称并排；关昵称显示时为 false，头衔叠头像 */
  groupRankShowBesideNickname?: boolean
  onOtherAvatarClick?: () => void
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
  chatOtherSenderNickname,
  chatOtherAvatarRankBadge = null,
  chatSelfAvatarRankBadge = null,
  groupRankShowBesideNickname = true,
  onOtherAvatarClick,
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
  const rankBeside = groupRankShowBesideNickname !== false

  if (!isSelf) {
    return (
      <div className="w-full max-w-full shrink-0 overflow-x-visible" data-wx-msg-id={_id}>
        {!showAvatar ? (
          <div className="ml-[24px] mr-auto min-w-0">{imageBlock}</div>
        ) : showAvatarVisual ? (
          <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
            {rankBeside || !chatOtherAvatarRankBadge ? (
              otherChatAvatarSrc ? (
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
                  onClick={onOtherAvatarClick}
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
                  onClick={onOtherAvatarClick}
                  aria-hidden
                />
              )
            ) : (
              <ChatGroupSpeakerRankOnAvatar rankBadge={chatOtherAvatarRankBadge}>
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
                    onClick={onOtherAvatarClick}
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
                    onClick={onOtherAvatarClick}
                    aria-hidden
                  />
                )}
              </ChatGroupSpeakerRankOnAvatar>
            )}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
              {rankBeside ? (
                <ChatGroupSenderNicknameWithRank nickname={chatOtherSenderNickname} rankBadge={chatOtherAvatarRankBadge ?? null} />
              ) : chatOtherSenderNickname?.trim() ? (
                <span
                  className="max-w-[min(200px,calc(100vw-24px-24px-40px-12px))] truncate text-[11px] leading-snug"
                  style={{ color: 'var(--wx-text-muted, #888)' }}
                >
                  {chatOtherSenderNickname.trim()}
                </span>
              ) : null}
              {imageBlock}
            </div>
          </div>
        ) : reserveAvatarGutter ? (
          <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
            {rankBeside || !chatOtherAvatarRankBadge ? (
              <div className="h-10 w-10 shrink-0" aria-hidden />
            ) : (
              <ChatGroupSpeakerRankOnAvatar rankBadge={chatOtherAvatarRankBadge}>
                <div className="h-10 w-10 shrink-0" aria-hidden />
              </ChatGroupSpeakerRankOnAvatar>
            )}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
              {rankBeside ? (
                <ChatGroupSenderNicknameWithRank nickname={chatOtherSenderNickname} rankBadge={chatOtherAvatarRankBadge ?? null} />
              ) : null}
              {imageBlock}
            </div>
          </div>
        ) : (
          <div className="ml-[24px] mr-auto min-w-0">{imageBlock}</div>
        )}
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-full shrink-0 items-end justify-end gap-[4px] overflow-x-visible" data-wx-msg-id={_id}>
      {!showAvatar ? (
        <div className="mr-[24px] ml-auto min-w-0">{imageBlock}</div>
      ) : showAvatarVisual ? (
        <div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-[12px]">
          {imageBlock}
          {rankBeside || !chatSelfAvatarRankBadge ? (
            selfChatAvatarSrc ? (
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
            )
          ) : (
            <ChatGroupSpeakerRankOnAvatar rankBadge={chatSelfAvatarRankBadge}>
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
            </ChatGroupSpeakerRankOnAvatar>
          )}
        </div>
      ) : reserveAvatarGutter ? (
        <div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-[12px]">
          {imageBlock}
          {rankBeside || !chatSelfAvatarRankBadge ? (
            <div className="h-10 w-10 shrink-0" aria-hidden />
          ) : (
            <ChatGroupSpeakerRankOnAvatar rankBadge={chatSelfAvatarRankBadge}>
              <div className="h-10 w-10 shrink-0" aria-hidden />
            </ChatGroupSpeakerRankOnAvatar>
          )}
        </div>
      ) : (
        <div className="mr-[24px] ml-auto min-w-0">{imageBlock}</div>
      )}
    </div>
  )
}

