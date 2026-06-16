import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'

import type { WeChatBubbleTheme } from '../../types'
import { WeChatChatMixedText } from './WeChatChatMixedText'
import {
  ChatGroupSenderNicknameWithRank,
  ChatGroupSpeakerRankOnAvatar,
} from './group/ChatGroupSpeakerAvatarWrap'
import { useWeChatLongPress } from './hooks/useWeChatLongPress'

/** 聊天气泡最大宽：100vw - 左右基准线 24px×2 - 头像列预留 80px（40 头像 + 12 间距 + 28 冗余） */
const CHAT_BUBBLE_MAX = 'max-w-[calc(100vw-24px-24px-80px)]'
/** 主题抽屉等窄容器内预览：不超过父宽，公式与聊天一致 */
const PREVIEW_BUBBLE_MAX = 'max-w-[min(100%,calc(100vw-24px-24px-80px))]'

/** 气泡内嵌引用预览（与微信一致：宽度随气泡，不超出） */
export type WeChatBubbleReplyPreview = {
  senderName: string
  content: string
  onClick?: () => void
}

function ChatBubbleReplyPreview({
  preview,
  isSelf,
  insetStyle,
}: {
  preview: WeChatBubbleReplyPreview
  isSelf: boolean
  insetStyle?: CSSProperties
}) {
  const muted = isSelf ? 'rgba(0,0,0,0.45)' : '#8e8e8e'
  const inner = (
    <span className="flex min-w-0 items-start gap-1.5">
      <span className="mt-[2px] h-[calc(100%-4px)] min-h-[1.25rem] w-px shrink-0 bg-[#d4d4d4]" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] leading-snug" style={{ color: muted }}>
          {preview.senderName}：
        </span>
        <span className="line-clamp-2 block text-[13px] leading-[1.35]" style={{ color: muted }}>
          <WeChatChatMixedText text={preview.content || '…'} />
        </span>
      </span>
    </span>
  )
  const shellCls =
    'mb-1.5 block w-full max-w-full rounded-[4px] px-2 py-1 text-left'
  const shellStyle: CSSProperties = insetStyle ?? {
    background: isSelf ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.06)',
  }
  if (preview.onClick) {
    return (
      <button type="button" onClick={preview.onClick} className={shellCls} style={shellStyle}>
        {inner}
      </button>
    )
  }
  return (
    <div className={shellCls} style={shellStyle}>
      {inner}
    </div>
  )
}

export type WeChatMessageBubbleRowProps = {
  messageText: string
  messagePrefixIcon?: ReactNode
  /** 气泡顶部引用条（宽度与气泡一致） */
  replyPreview?: WeChatBubbleReplyPreview
  /** 引用条内嵌区域样式（遇见浅金气泡等） */
  replyPreviewInsetStyle?: CSSProperties
  /** 群助手：黑底白字极简高冷 */
  luxuryDarkAdminBubble?: boolean
  isSelf: boolean
  bubble: WeChatBubbleTheme
  showAvatar: boolean
  showBubbleTail: boolean
  /** 聊天页用 CSS 变量上色；预览用实色 */
  variant: 'chat' | 'preview'
  /** 附加在根行上的 class（如聊天动效） */
  rowClassName?: string
  /** 气泡内容块附加 class */
  bubbleContentClassName?: string
  /** 合并进气泡内容块 style（如遇见水滴渐变/阴影；有 `background` 时不使用 theme 纯色底） */
  chatBubbleSurfaceStyle?: CSSProperties
  /** 聊天页头像点击缩放反馈 */
  avatarTapMotion?: boolean
  /**
   * 是否在本行绘制头像（与 `showAvatar` 同时为真才显示图）。
   * 双方连续合并时均仅**首条**为 true；后续行保留同宽占位，气泡与首条对齐。
   */
  showAvatarColumn?: boolean
  /** 聊天页己方行：气泡左侧附加控件（如发送失败重试），不改变基准线 */
  chatAccessory?: ReactNode
  /** 聊天页：叠在己方气泡右下角（如发送中呼吸点） */
  chatBubbleOverlay?: ReactNode
  /** 聊天页：主题驱动的细边框（如 IndexedDB chatTheme） */
  chatBubbleShowBorder?: boolean
  chatBubbleBorderColor?: string
  /**
   * 聊天页：若提供则气泡与三角尖角使用该实色（支持 rgba），避免仅依赖外层 `--wx-*` 被父级样式覆盖导致改色不生效。
   */
  chatSolidBubbleBg?: string
  /** 聊天页己方头像（与资料一致）；无则保留灰色占位 */
  chatSelfAvatarUrl?: string
  /** 聊天页对方头像（角色微信头像或 Lumi 助手图）；无则灰色占位，勿与己方混淆 */
  chatOtherAvatarUrl?: string
  /** 群聊等：头像右侧展示的发送者昵称 */
  chatOtherSenderNickname?: string
  /** 群聊：对方头像左上角头衔（群主/管理员） */
  chatOtherAvatarRankBadge?: 'owner' | 'admin' | null
  /** 群聊：己方头像左上角头衔 */
  chatSelfAvatarRankBadge?: 'owner' | 'admin' | null
  /** 群聊：头衔是否与昵称并排；关闭显示成员昵称时为 false，头衔叠头像角 */
  groupRankShowBesideNickname?: boolean
  /** 聊天页：点击对方头像 */
  onOtherAvatarClick?: () => void
  /** 长按气泡触发操作面板（微信一致） */
  onBubbleLongPress?: (anchorRect: DOMRect) => void
  /** 面板打开时，气泡显示选中态 */
  bubbleSelected?: boolean
}

function BubbleMessageTail({
  isSelf,
  show,
  color,
  tailMode,
  avatarMidlinePx,
}: {
  isSelf: boolean
  show: boolean
  color?: string
  tailMode: 'avatarMidline' | 'bubbleCenter'
  avatarMidlinePx: number
}) {
  if (!show) return null
  const fill = color ?? (isSelf ? 'var(--wx-self-bubble-bg)' : 'var(--wx-other-bubble-bg)')
  const positionStyle: CSSProperties =
    tailMode === 'bubbleCenter'
      ? { top: '50%', transform: 'translateY(-50%)' }
      : { top: avatarMidlinePx, transform: 'translateY(-50%)' }
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute z-0"
      style={{
        ...positionStyle,
        width: 0,
        height: 0,
        ...(isSelf
          ? {
              right: -5,
              borderTop: '6px solid transparent',
              borderBottom: '6px solid transparent',
              borderLeft: '8px solid',
              borderLeftColor: fill,
            }
          : {
              left: -5,
              borderTop: '6px solid transparent',
              borderBottom: '6px solid transparent',
              borderRight: '8px solid',
              borderRightColor: fill,
            }),
      }}
    />
  )
}

function measureBubbleSingleLine(el: HTMLElement): boolean {
  const cs = getComputedStyle(el)
  const pt = parseFloat(cs.paddingTop) || 0
  const pb = parseFloat(cs.paddingBottom) || 0
  let lh = parseFloat(cs.lineHeight)
  if (!Number.isFinite(lh) || lh <= 0) {
    const fs = parseFloat(cs.fontSize) || 15
    lh = fs * 1.5
  }
  const textBlockHeight = el.scrollHeight - pt - pb
  return textBlockHeight <= lh * 1.35 + 0.5
}

function useMessageBubbleSingleLine(contentRef: RefObject<HTMLDivElement | null>, text: string) {
  const [singleLine, setSingleLine] = useState(false)
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    let raf = 0
    const measureNow = () => {
      const node = contentRef.current
      if (!node) return
      const next = measureBubbleSingleLine(node)
      setSingleLine((prev) => (prev === next ? prev : next))
    }
    const scheduleMeasure = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        raf = 0
        measureNow()
      })
    }
    measureNow()
    const ro = new ResizeObserver(scheduleMeasure)
    ro.observe(el)
    return () => {
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [text])
  return singleLine
}

export function WeChatMessageBubbleRow({
  messageText,
  messagePrefixIcon,
  luxuryDarkAdminBubble = false,
  isSelf,
  bubble,
  showAvatar,
  showBubbleTail,
  variant,
  rowClassName = '',
  bubbleContentClassName = '',
  chatBubbleSurfaceStyle,
  avatarTapMotion = false,
  showAvatarColumn = true,
  chatAccessory,
  chatBubbleOverlay,
  chatBubbleShowBorder = false,
  chatBubbleBorderColor = '#e5e5e5',
  chatSolidBubbleBg,
  chatSelfAvatarUrl,
  chatOtherAvatarUrl,
  chatOtherSenderNickname,
  chatOtherAvatarRankBadge = null,
  chatSelfAvatarRankBadge = null,
  groupRankShowBesideNickname = true,
  onOtherAvatarClick,
  onBubbleLongPress,
  bubbleSelected = false,
  replyPreview,
  replyPreviewInsetStyle,
}: WeChatMessageBubbleRowProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const singleLine = useMessageBubbleSingleLine(contentRef, messageText)
  /** 聊天 40px；预览同尺寸以对齐规则一致 */
  const avatarPx = variant === 'chat' ? 40 : 40
  const showAvatarVisual = showAvatar && showAvatarColumn
  /** 合并组内无头像行仍占头像+间距宽，与首条气泡对齐 */
  const reserveAvatarGutter = showAvatar
  const alignWithAvatarMid = Boolean(singleLine && reserveAvatarGutter)
  const showTail = showBubbleTail && showAvatarVisual
  const tailMode: 'avatarMidline' | 'bubbleCenter' = alignWithAvatarMid ? 'bubbleCenter' : 'avatarMidline'

  const bubbleBgChat = isSelf ? 'var(--wx-self-bubble-bg)' : 'var(--wx-other-bubble-bg)'
  const bubbleTextChat = isSelf ? 'var(--wx-self-bubble-text)' : 'var(--wx-other-bubble-text)'
  const bubbleBgPreview = isSelf ? bubble.selfBubbleBg : bubble.otherBubbleBg
  const bubbleTextPreview = isSelf ? 'var(--wx-self-bubble-text)' : 'var(--wx-other-bubble-text)'
  const bubbleRadius = isSelf ? `${bubble.selfBubbleRadiusPx}px` : `${bubble.otherBubbleRadiusPx}px`
  const solidChatBg = variant === 'chat' ? chatSolidBubbleBg?.trim() : ''
  let bubbleBgChatResolved = solidChatBg ? solidChatBg : bubbleBgChat
  let bubbleTextResolved = variant === 'chat' ? bubbleTextChat : bubbleTextPreview
  const luxuryDark = variant === 'chat' && !isSelf && luxuryDarkAdminBubble
  if (luxuryDark) {
    bubbleBgChatResolved = '#0a0a0a'
    bubbleTextResolved = '#f5f5f5'
  }

  const textCls = variant === 'chat' ? 'text-[15px]' : 'text-[14px]'
  const messageBodyVisible = messageText.replace(/\u200b/g, '').trim().length > 0
  const messageBody = messageBodyVisible ? (
    <span className="whitespace-pre-wrap break-words">
      <WeChatChatMixedText text={messageText} />
    </span>
  ) : null

  const avatarMotionCls =
    avatarTapMotion && variant === 'chat'
      ? 'cursor-pointer transition-transform duration-150 ease-out active:scale-95'
      : ''

  const bubbleMax = variant === 'chat' ? CHAT_BUBBLE_MAX : PREVIEW_BUBBLE_MAX
  const rowAlign = alignWithAvatarMid ? 'items-center' : 'items-start'
  const selfChatAvatarSrc = variant === 'chat' && isSelf ? chatSelfAvatarUrl?.trim() : ''
  const otherChatAvatarSrc = variant === 'chat' && !isSelf ? chatOtherAvatarUrl?.trim() : ''
  const rankBeside = groupRankShowBesideNickname !== false

  const onLongPress = useCallback(
    () => {
      if (!onBubbleLongPress) return
      const el = contentRef.current
      if (!el) return
      onBubbleLongPress(el.getBoundingClientRect())
    },
    [onBubbleLongPress],
  )

  const { bind, pressing } = useWeChatLongPress({
    enabled: variant === 'chat' && !!onBubbleLongPress,
    ms: 500,
    moveThresholdPx: 10,
    onLongPress: () => onLongPress(),
  })

  const bubbleBlock = (
    <div className={`relative min-w-0 ${bubbleMax}`}>
      <BubbleMessageTail
        isSelf={isSelf}
        show={showTail}
        tailMode={tailMode}
        avatarMidlinePx={avatarPx / 2}
        color={variant === 'preview' ? bubbleBgPreview : solidChatBg ? solidChatBg : undefined}
      />
      <div
        ref={contentRef}
        className={`relative z-[1] inline-block max-w-full px-3 py-2 leading-[1.5] select-none transition-[transform,opacity,background-color] duration-150 ease-out ${textCls} ${bubbleContentClassName}`}
        style={{
          ...(chatBubbleSurfaceStyle?.background
            ? {}
            : {
                backgroundColor: variant === 'chat' ? bubbleBgChatResolved : bubbleBgPreview,
              }),
          color: variant === 'chat' ? bubbleTextResolved : bubbleTextPreview,
          borderRadius: bubbleRadius,
          userSelect: variant === 'chat' ? 'none' : undefined,
          WebkitUserSelect: variant === 'chat' ? ('none' as any) : undefined,
          WebkitTouchCallout: variant === 'chat' ? ('none' as any) : undefined,
          transform:
            variant === 'chat' && pressing && !bubbleSelected ? 'scale(0.98)' : variant === 'chat' ? 'scale(1)' : undefined,
          opacity: variant === 'chat' && pressing && !bubbleSelected ? 0.9 : 1,
          transformOrigin: variant === 'chat' ? (isSelf ? 'right bottom' : 'left bottom') : undefined,
          ...(variant === 'chat' && luxuryDark
            ? { border: '1px solid rgba(255,255,255,0.12)' }
            : variant === 'chat' && chatBubbleShowBorder && !chatBubbleSurfaceStyle
              ? { border: `1px solid ${chatBubbleBorderColor}` }
              : {}),
          ...chatBubbleSurfaceStyle,
        }}
        {...(variant === 'chat' ? bind : {})}
      >
        {replyPreview ? (
          <ChatBubbleReplyPreview
            preview={replyPreview}
            isSelf={isSelf}
            insetStyle={replyPreviewInsetStyle}
          />
        ) : null}
        {messageBodyVisible ? (
          messagePrefixIcon ? (
            <span className="inline-flex items-center gap-1.5 align-middle">
              <span className="inline-flex shrink-0">{messagePrefixIcon}</span>
              {messageBody}
            </span>
          ) : (
            messageBody
          )
        ) : null}
        {variant === 'chat' && bubbleSelected ? (
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
      {variant === 'chat' && isSelf ? chatBubbleOverlay : null}
    </div>
  )

  if (variant === 'chat') {
    if (!isSelf) {
      return (
        <div className={`w-full max-w-full shrink-0 overflow-x-visible ${rowClassName}`}>
          {!showAvatar ? (
            <div className="ml-[24px] mr-auto min-w-0">{bubbleBlock}</div>
          ) : showAvatarVisual ? (
            <div
              className={`ml-[24px] mr-auto flex max-w-full flex-row gap-[12px] ${
                chatOtherSenderNickname?.trim() || (rankBeside && chatOtherAvatarRankBadge) ? 'items-start' : rowAlign
              }`}
            >
              {rankBeside || !chatOtherAvatarRankBadge ? (
                otherChatAvatarSrc ? (
                  <img
                    src={otherChatAvatarSrc}
                    alt=""
                    width={avatarPx}
                    height={avatarPx}
                    className={`h-10 w-10 shrink-0 object-cover ${avatarMotionCls}`}
                    style={{
                      borderRadius: `${bubble.avatarRadiusPx}px`,
                      border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
                    }}
                    onClick={onOtherAvatarClick}
                    aria-hidden
                  />
                ) : (
                  <div
                    className={`h-10 w-10 shrink-0 ${avatarMotionCls}`}
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
                      className={`h-10 w-10 shrink-0 object-cover ${avatarMotionCls}`}
                      style={{
                        borderRadius: `${bubble.avatarRadiusPx}px`,
                        border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
                      }}
                      onClick={onOtherAvatarClick}
                      aria-hidden
                    />
                  ) : (
                    <div
                      className={`h-10 w-10 shrink-0 ${avatarMotionCls}`}
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
                {bubbleBlock}
              </div>
            </div>
          ) : reserveAvatarGutter ? (
            <div className={`ml-[24px] mr-auto flex max-w-full flex-row ${rowAlign} gap-[12px]`}>
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
                {bubbleBlock}
              </div>
            </div>
          ) : (
            <div className="ml-[24px] mr-auto min-w-0">{bubbleBlock}</div>
          )}
        </div>
      )
    }

    return (
      <div
        className={`flex w-full max-w-full shrink-0 items-end justify-end gap-[4px] overflow-x-visible ${rowClassName}`}
      >
        {chatAccessory}
        {!showAvatar ? (
          <div className="mr-[24px] ml-auto min-w-0">{bubbleBlock}</div>
        ) : showAvatarVisual ? (
          <div className={`mr-[24px] ml-auto flex max-w-full flex-row ${rowAlign} gap-[12px]`}>
            {bubbleBlock}
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
          <div className={`mr-[24px] ml-auto flex max-w-full flex-row ${rowAlign} gap-[12px]`}>
            {bubbleBlock}
            {rankBeside || !chatSelfAvatarRankBadge ? (
              <div className="h-10 w-10 shrink-0" aria-hidden />
            ) : (
              <ChatGroupSpeakerRankOnAvatar rankBadge={chatSelfAvatarRankBadge}>
                <div className="h-10 w-10 shrink-0" aria-hidden />
              </ChatGroupSpeakerRankOnAvatar>
            )}
          </div>
        ) : (
          <div className="mr-[24px] ml-auto min-w-0">{bubbleBlock}</div>
        )}
      </div>
    )
  }

  /* ---------- preview（主题面板）：与聊天相同像素规则，宽度随容器 ---------- */
  if (!isSelf) {
    return (
      <div className={`w-full max-w-full shrink-0 overflow-x-hidden ${rowClassName}`}>
        {!showAvatar ? (
          <div className="ml-[24px] mr-auto min-w-0">{bubbleBlock}</div>
        ) : showAvatarVisual ? (
          <div className={`ml-[24px] mr-auto flex max-w-full flex-row ${rowAlign} gap-[12px]`}>
            <div
              className="h-10 w-10 shrink-0"
              style={{
                borderRadius: `${bubble.avatarRadiusPx}px`,
                background: 'rgba(0,0,0,0.06)',
              }}
              aria-hidden
            />
            {bubbleBlock}
          </div>
        ) : reserveAvatarGutter ? (
          <div className={`ml-[24px] mr-auto flex max-w-full flex-row ${rowAlign} gap-[12px]`}>
            <div className="h-10 w-10 shrink-0" aria-hidden />
            {bubbleBlock}
          </div>
        ) : (
          <div className="ml-[24px] mr-auto min-w-0">{bubbleBlock}</div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex w-full max-w-full shrink-0 items-end justify-end overflow-x-hidden ${rowClassName}`}>
      {!showAvatar ? (
        <div className="mr-[24px] ml-auto min-w-0">{bubbleBlock}</div>
      ) : showAvatarVisual ? (
        <div className={`mr-[24px] ml-auto flex max-w-full flex-row ${rowAlign} gap-[12px]`}>
          {bubbleBlock}
          <div
            className="h-10 w-10 shrink-0"
            style={{
              borderRadius: `${bubble.avatarRadiusPx}px`,
              background: 'rgba(0,0,0,0.04)',
            }}
            aria-hidden
          />
        </div>
      ) : reserveAvatarGutter ? (
        <div className={`mr-[24px] ml-auto flex max-w-full flex-row ${rowAlign} gap-[12px]`}>
          {bubbleBlock}
          <div className="h-10 w-10 shrink-0" aria-hidden />
        </div>
      ) : (
        <div className="mr-[24px] ml-auto min-w-0">{bubbleBlock}</div>
      )}
    </div>
  )
}
