import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

import type { WeChatBubbleTheme } from '../../types'
import {
  ChatGroupSenderNicknameWithRank,
  ChatGroupSpeakerRankOnAvatar,
} from './group/ChatGroupSpeakerAvatarWrap'
import { useWeChatLongPress } from './hooks/useWeChatLongPress'
import { composeMultiSelectLeading } from './chatHistory/MultiSelectAvatarSlot'
import { ChatImageLightbox } from './ChatImageLightbox'

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
  multiSelectAvatar?: ReactNode
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
  multiSelectAvatar,
}: Props) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const avatarPx = 40
  const bubbleRadius = isSelf ? `${bubble.selfBubbleRadiusPx}px` : `${bubble.otherBubbleRadiusPx}px`

  const bg = isSticker ? 'transparent' : '#ffffff'
  const border = isSticker
    ? 'none'
    : isSelf
      ? '1px solid #000000'
      : '1px solid rgba(0,0,0,0.08)'

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
    onTap: () => setLightboxOpen(true),
  })

  const imageBlock = useMemo(() => {
    return (
      <div
        ref={anchorRef}
        className="relative inline-block cursor-zoom-in select-none transition-[transform,opacity] duration-150 ease-out"
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
          className={
            isSticker
              ? 'block h-auto max-h-[min(200px,36vh)] w-[160px] max-w-[46vw] select-none object-contain'
              : 'block h-auto max-h-[min(360px,50vh)] w-[180px] max-w-[56vw] select-none object-contain'
          }
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
      <>
        <div className="w-full max-w-full shrink-0 overflow-x-visible" data-wx-msg-id={_id}>
        {!showAvatar && !multiSelectAvatar ? (
          <div className="ml-[24px] mr-auto min-w-0">{imageBlock}</div>
        ) : showAvatarVisual || multiSelectAvatar ? (
          <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
            {composeMultiSelectLeading(
              multiSelectAvatar,
              rankBeside || !chatOtherAvatarRankBadge ? (
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
              ),
              showAvatarColumn,
            )}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
              {!multiSelectAvatar && rankBeside ? (
                <ChatGroupSenderNicknameWithRank nickname={chatOtherSenderNickname} rankBadge={chatOtherAvatarRankBadge ?? null} />
              ) : !multiSelectAvatar && chatOtherSenderNickname?.trim() ? (
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
            {composeMultiSelectLeading(
              multiSelectAvatar,
              rankBeside || !chatOtherAvatarRankBadge ? (
                <div className="h-10 w-10 shrink-0" aria-hidden />
              ) : (
                <ChatGroupSpeakerRankOnAvatar rankBadge={chatOtherAvatarRankBadge}>
                  <div className="h-10 w-10 shrink-0" aria-hidden />
                </ChatGroupSpeakerRankOnAvatar>
              ),
              showAvatarColumn,
            )}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
              {!multiSelectAvatar && rankBeside ? (
                <ChatGroupSenderNicknameWithRank nickname={chatOtherSenderNickname} rankBadge={chatOtherAvatarRankBadge ?? null} />
              ) : null}
              {imageBlock}
            </div>
          </div>
        ) : (
          <div className="ml-[24px] mr-auto min-w-0">{imageBlock}</div>
        )}
      </div>
        <ChatImageLightbox open={lightboxOpen} src={src} onClose={() => setLightboxOpen(false)} />
      </>
    )
  }

  return (
    <>
      <div className="flex w-full max-w-full shrink-0 items-end justify-end gap-[4px] overflow-x-visible" data-wx-msg-id={_id}>
      {!showAvatar && !multiSelectAvatar ? (
        <div className="mr-[24px] ml-auto min-w-0">{imageBlock}</div>
      ) : showAvatarVisual || multiSelectAvatar ? (
        <div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-[12px]">
          {imageBlock}
          {composeMultiSelectLeading(
            multiSelectAvatar,
            rankBeside || !chatSelfAvatarRankBadge ? (
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
          ),
          showAvatarColumn,
          )}
        </div>
      ) : reserveAvatarGutter ? (
        <div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-[12px]">
          {imageBlock}
          {composeMultiSelectLeading(
            multiSelectAvatar,
            rankBeside || !chatSelfAvatarRankBadge ? (
              <div className="h-10 w-10 shrink-0" aria-hidden />
            ) : (
              <ChatGroupSpeakerRankOnAvatar rankBadge={chatSelfAvatarRankBadge}>
                <div className="h-10 w-10 shrink-0" aria-hidden />
              </ChatGroupSpeakerRankOnAvatar>
            ),
            showAvatarColumn,
          )}
        </div>
      ) : (
        <div className="mr-[24px] ml-auto min-w-0">{imageBlock}</div>
      )}
      </div>
      <ChatImageLightbox open={lightboxOpen} src={src} onClose={() => setLightboxOpen(false)} />
    </>
  )
}

