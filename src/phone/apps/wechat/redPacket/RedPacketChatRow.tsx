import { useCallback, useMemo, useRef } from 'react'

import type { WeChatBubbleTheme } from '../../../types'
import {
  ChatGroupSenderNicknameWithRank,
  ChatGroupSpeakerRankOnAvatar,
} from '../group/ChatGroupSpeakerAvatarWrap'
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
  chatOtherSenderNickname?: string
  chatOtherAvatarRankBadge?: 'owner' | 'admin' | null
  chatSelfAvatarRankBadge?: 'owner' | 'admin' | null
  groupRankShowBesideNickname?: boolean
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
  chatOtherSenderNickname,
  chatOtherAvatarRankBadge = null,
  chatSelfAvatarRankBadge = null,
  groupRankShowBesideNickname = true,
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
  const rankBeside = groupRankShowBesideNickname !== false

  if (!isSelf) {
    return (
      <div className="w-[100vw] max-w-[100vw] shrink-0 overflow-x-visible" data-wx-msg-id={_id}>
        {!showAvatar ? (
          <div className="ml-[24px] mr-auto min-w-0">{packetBlock}</div>
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
              {packetBlock}
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
              {packetBlock}
            </div>
          </div>
        ) : (
          <div className="ml-[24px] mr-auto min-w-0">{packetBlock}</div>
        )}
      </div>
    )
  }

  return (
    <div className="flex w-[100vw] max-w-[100vw] shrink-0 items-end justify-end gap-[4px] overflow-x-visible" data-wx-msg-id={_id}>
      {!showAvatar ? (
        <div className="mr-[24px] ml-auto min-w-0">{packetBlock}</div>
      ) : showAvatarVisual ? (
        <div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-[12px]">
          {packetBlock}
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
          {packetBlock}
          {rankBeside || !chatSelfAvatarRankBadge ? (
            <div className="h-10 w-10 shrink-0" aria-hidden />
          ) : (
            <ChatGroupSpeakerRankOnAvatar rankBadge={chatSelfAvatarRankBadge}>
              <div className="h-10 w-10 shrink-0" aria-hidden />
            </ChatGroupSpeakerRankOnAvatar>
          )}
        </div>
      ) : (
        <div className="mr-[24px] ml-auto min-w-0">{packetBlock}</div>
      )}
    </div>
  )
}
