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
  src?: string
  /** 生图占位：正在生成 */
  generating?: boolean
  /** 已有描述、等待用户确认后再生成 */
  awaitingConfirm?: boolean
  /** 画面描述（确认前展示在占位中央） */
  description?: string
  /** 生图占位：生成失败 */
  genFailed?: boolean
  /** 生图失败时点击重试 / 确认生成 */
  onRetry?: () => void
  /** 用户确认开始生成 */
  onConfirmGenerate?: () => void
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
  src = '',
  generating = false,
  awaitingConfirm = false,
  description = '',
  genFailed = false,
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
  onRetry,
  onConfirmGenerate,
  multiSelectAvatar,
}: Props) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const avatarPx = 40
  const bubbleRadius = isSelf ? `${bubble.selfBubbleRadiusPx}px` : `${bubble.otherBubbleRadiusPx}px`
  const showAwaiting = awaitingConfirm && !generating && !genFailed
  const showGenerating = generating && !genFailed
  const showFailed = genFailed && !showGenerating && !showAwaiting
  const descText = description.trim()

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
    enabled: !!onLongPress && !showGenerating,
    ms: 500,
    moveThresholdPx: 10,
    onLongPress: () => handleLongPress(),
    onTap: () => {
      if (showGenerating) return
      if (showAwaiting) {
        onConfirmGenerate?.()
        return
      }
      if (showFailed) {
        onRetry?.()
        return
      }
      setLightboxOpen(true)
    },
  })

  const failedBind = useWeChatLongPress({
    enabled: showFailed && !!onRetry,
    ms: 500,
    moveThresholdPx: 10,
    onLongPress: () => handleLongPress(),
    onTap: () => onRetry?.(),
  }).bind

  const awaitingBind = useWeChatLongPress({
    enabled: showAwaiting && !!onConfirmGenerate,
    ms: 500,
    moveThresholdPx: 10,
    onLongPress: () => handleLongPress(),
    onTap: () => onConfirmGenerate?.(),
  }).bind

  const imageBlock = useMemo(() => {
    if (showAwaiting || showGenerating || showFailed) {
      return (
        <div
          ref={anchorRef}
          className="relative inline-flex select-none items-center justify-center"
          style={{
            width: isSticker ? 160 : 180,
            maxWidth: isSticker ? '46vw' : '56vw',
            minHeight: isSticker ? 120 : 160,
            borderRadius: bubbleRadius,
            border: showAwaiting ? '1px dashed rgba(0,0,0,0.18)' : border,
            background: '#f3f3f3',
            userSelect: 'none',
            WebkitUserSelect: 'none' as any,
            WebkitTouchCallout: 'none' as any,
          }}
          {...(showAwaiting && onConfirmGenerate
            ? awaitingBind
            : showFailed && onRetry
              ? failedBind
              : onLongPress
                ? bind
                : {})}
        >
          <div className="flex w-full flex-col items-center gap-2 px-3 py-5 text-center">
            {showGenerating ? (
              <>
                <span
                  className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-black/10 border-t-black/45"
                  aria-hidden
                />
                <span className="text-[12px] leading-snug text-black/55">正在生成中…</span>
              </>
            ) : showAwaiting ? (
              <>
                {descText ? (
                  <p className="max-h-[88px] overflow-y-auto px-1 text-left text-[11px] leading-relaxed text-black/55">
                    {descText}
                  </p>
                ) : (
                  <span className="text-[12px] leading-snug text-black/45">配图描述</span>
                )}
                <span className="text-[12px] font-medium leading-snug text-[#576B95]">点按生成</span>
              </>
            ) : (
              <>
                <span className="text-[12px] leading-snug text-black/45">图片生成失败</span>
                {onRetry ? (
                  <span className="text-[12px] font-medium leading-snug text-[#576B95]">点击重试</span>
                ) : null}
              </>
            )}
          </div>
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
    }
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
  }, [
    awaitingBind,
    bg,
    bind,
    border,
    bubbleRadius,
    descText,
    failedBind,
    isSelf,
    isSticker,
    onConfirmGenerate,
    onLongPress,
    onRetry,
    pressing,
    selected,
    showAwaiting,
    showFailed,
    showGenerating,
    src,
  ])

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
      {!showGenerating && !showFailed && !showAwaiting ? (
        <ChatImageLightbox open={lightboxOpen} src={src} onClose={() => setLightboxOpen(false)} />
      ) : null}
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
      {!showGenerating && !showFailed && !showAwaiting ? (
        <ChatImageLightbox open={lightboxOpen} src={src} onClose={() => setLightboxOpen(false)} />
      ) : null}
    </>
  )
}
