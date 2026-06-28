/** iMessage / Telegram 特殊消息气泡（转账、语音、引用、位置等） */

import type { ReactNode } from 'react'

import type { WeChatBubbleTheme } from '../../types'
import { WECHAT_CHAT_BUBBLE_MAX_CLASS } from './wechatBubbleWechatUi'
import { PhoneMixedLatinNumText } from '../../phoneMixedLatinNumText'
import { ImessageBubbleTail, imessageBubbleCornerRadius } from './wechatBubbleImessageUi'
import { TelegramBubbleTail, telegramBubbleCornerRadius } from './wechatBubbleTelegramUi'
import type { WeChatLocationPayload } from './newFriendsPersona/types'
import { resolveLocationMapSrc } from './location/resolveLocationMapSrc'
import { formatLocationDistanceSubtitle, formatLocationDistanceTalkmaker } from './location/wechatLocationUtils'
import {
  TALKMAKER_OTHER_BUBBLE,
  TALKMAKER_SELF_BUBBLE,
} from './wechatBubbleTalkmakerUi'

export type MessengerBubbleStyle = 'lumi' | 'wechat' | 'imessage' | 'telegram' | 'talkmaker'

export function isAltMessengerBubbleStyle(
  style: MessengerBubbleStyle,
): style is 'imessage' | 'telegram' | 'talkmaker' {
  return style === 'imessage' || style === 'telegram' || style === 'talkmaker'
}

/** 未套用 Messenger 预设时为 `lumi`（Lumi 默认特殊消息 + 全局字体） */
export function resolveMessengerBubbleStyle(bubble: WeChatBubbleTheme): MessengerBubbleStyle {
  const tail = bubble.bubbleTailStyle
  if (tail === 'imessage') return 'imessage'
  if (tail === 'telegram') return 'telegram'
  if (tail === 'talkmaker') return 'talkmaker'
  if (tail === 'wechat') return 'wechat'
  return 'lumi'
}

export function formatMessengerMoney(amountYuan: number | null | undefined): string {
  if (amountYuan == null || !Number.isFinite(amountYuan)) return '¥ —'
  return `¥${amountYuan.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatVoiceDurationLabel(sec: number): string {
  const total = Math.max(0, Math.round(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function buildStaticWaveHeights(seed: number, count = 18): number[] {
  return Array.from({ length: count }, (_, i) => {
    const n = Math.sin((i + 1) * 0.93 + seed * 0.37) * 0.5 + 0.5
    return 8 + Math.round(n * 14)
  })
}

function TelegramDoubleCheckMini() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M11.5 3.5L6.5 9L4 6.5L3 7.5L6.5 11L12.5 4.5L11.5 3.5Z" />
      <path d="M15.5 3.5L10.5 9L9.75 8.25L8.75 9.25L10.5 11L16.5 4.5L15.5 3.5Z" />
    </svg>
  )
}

export function TelegramImageMetaPill({
  timeLabel,
  showReadChecks = false,
}: {
  timeLabel: string
  showReadChecks?: boolean
}) {
  return (
    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm">
      <PhoneMixedLatinNumText text={timeLabel} />
      {showReadChecks ? <TelegramDoubleCheckMini /> : null}
    </div>
  )
}

/** iMessage · Apple Pay Cash 转账卡片（无尾巴） */
export function ImessageApplePayCashCard({
  amountYuan,
  remark,
}: {
  amountYuan: number | null | undefined
  remark?: string
}) {
  return (
    <div className="w-64 max-w-full select-none overflow-hidden rounded-[20px] border border-gray-800 bg-gradient-to-br from-[#1a1a1a] to-[#2c2c2c] p-4 text-white shadow-sm">
      <div className="text-[13px] font-semibold text-gray-300"> Pay</div>
      <div className="mb-2 mt-4 flex justify-center">
        <span className="text-4xl font-normal tabular-nums">{formatMessengerMoney(amountYuan)}</span>
      </div>
      {remark?.trim() ? (
        <p className="truncate text-center text-[12px] text-gray-400">{remark.trim()}</p>
      ) : (
        <div className="h-3 bg-gradient-to-r from-transparent via-white/5 to-transparent" aria-hidden />
      )}
    </div>
  )
}

/** Telegram · Invoice / 付款单卡片 */
export function TelegramInvoiceCard({
  title,
  description,
  amountYuan,
  buttonLabel,
  emoji = '🧾',
  onAction,
  replyPreview,
  replyIsSelf = false,
}: {
  title: string
  description?: string
  amountYuan?: number | null
  buttonLabel: string
  emoji?: string
  onAction?: () => void
  replyPreview?: { senderName: string; content: string; onClick?: () => void }
  replyIsSelf?: boolean
}) {
  return (
    <div className="flex w-64 max-w-full flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
      {replyPreview ? (
        <div className="px-3 pt-3">
          <TelegramInlineReplyBlock
            senderName={replyPreview.senderName}
            content={replyPreview.content}
            isSelf={replyIsSelf}
            onClick={replyPreview.onClick}
          />
        </div>
      ) : null}
      <div className="flex h-32 items-center justify-center bg-blue-50">
        <span className="text-5xl" aria-hidden>
          {emoji}
        </span>
      </div>
      <div className="flex flex-col p-3">
        <span className="text-[16px] font-bold text-black">{title}</span>
        {description?.trim() ? (
          <span className="mt-1 text-sm text-gray-500">{description.trim()}</span>
        ) : amountYuan != null ? (
          <span className="mt-1 text-sm text-gray-500">{formatMessengerMoney(amountYuan)}</span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onAction?.()
        }}
        className="w-full border-t border-gray-200 bg-gray-50/50 py-3 text-[15px] font-medium text-[#3390EC] transition-colors hover:bg-gray-100"
      >
        {buttonLabel}
      </button>
    </div>
  )
}

export function TelegramInlineReplyBlock({
  senderName,
  content,
  isSelf,
  onClick,
}: {
  senderName: string
  content: string
  isSelf: boolean
  onClick?: () => void
}) {
  const accent = isSelf ? '#4CA861' : '#3390EC'
  const inner = (
    <div
      className="mb-2 flex cursor-pointer flex-col rounded-r-md bg-black/5 py-1 pl-2"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <span className="truncate text-[13px] font-medium" style={{ color: accent }}>
        {senderName}
      </span>
      <span className="max-w-[200px] truncate text-[13px] text-gray-500">{content || '…'}</span>
    </div>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full max-w-full text-left">
        {inner}
      </button>
    )
  }
  return inner
}

export function ImessageDetachedReplyBubble({
  senderName,
  content,
  isSelf,
  showAvatarGutter = false,
  onClick,
  deleted,
}: {
  senderName: string
  content: string
  isSelf: boolean
  /** 与消息行一致：预留头像列（40px + 12px 间距） */
  showAvatarGutter?: boolean
  onClick?: () => void
  deleted?: boolean
}) {
  const shell = (
    <div
      className={`min-w-0 ${WECHAT_CHAT_BUBBLE_MAX_CLASS} ${
        isSelf ? 'mr-3' : 'ml-3'
      } rounded-[18px] bg-[#E5E5EA] px-3 py-2 text-left shadow-sm`}
    >
      <p className="truncate text-[12px] font-medium text-[#6b7280]">{senderName}</p>
      <p
        className="line-clamp-2 break-words text-[14px] leading-snug text-[#374151] [overflow-wrap:anywhere]"
        style={{ opacity: deleted ? 0.65 : 1 }}
      >
        {content}
      </p>
    </div>
  )
  const shellNode = onClick ? (
    <button type="button" onClick={onClick} className="block min-w-0 max-w-full text-left">
      {shell}
    </button>
  ) : (
    shell
  )

  if (isSelf) {
    return (
      <div className="mb-1 w-full max-w-full">
        <div className="mr-[24px] ml-auto flex max-w-full flex-row justify-end gap-[12px]">
          <div className="flex min-w-0 flex-col items-end">{shellNode}</div>
          {showAvatarGutter ? <div className="h-10 w-10 shrink-0" aria-hidden /> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-1 w-full max-w-full">
      <div className={`ml-[24px] mr-auto flex max-w-full flex-row gap-[12px]`}>
        {showAvatarGutter ? <div className="h-10 w-10 shrink-0" aria-hidden /> : null}
        <div className="flex min-w-0 flex-1 flex-col items-start">{shellNode}</div>
      </div>
    </div>
  )
}

export function MessengerVoiceWaveform({
  heights,
  progress,
  isPlaying: _isPlaying,
  barClassName,
  activeClassName,
}: {
  heights: number[]
  progress: number
  isPlaying: boolean
  barClassName: string
  activeClassName?: string
}) {
  return (
    <div className="flex h-6 flex-1 items-center gap-[2px]">
      {heights.map((h, idx) => {
        const passed = idx / heights.length <= progress
        return (
          <span
            key={idx}
            className={`w-1 rounded-full ${passed ? activeClassName ?? barClassName : barClassName}`}
            style={{ height: h, opacity: passed ? 1 : 0.55 }}
          />
        )
      })}
    </div>
  )
}

export function TalkmakerInlineReplyBlock({
  senderName,
  content,
  onClick,
}: {
  senderName: string
  content: string
  onClick?: () => void
}) {
  const inner = (
    <div className="mb-1.5 rounded-lg border-l-2 border-gray-400 bg-gray-100 p-2 text-xs text-gray-500">
      <div className="truncate font-bold text-gray-700">{senderName}</div>
      <div className="truncate">{content || '…'}</div>
    </div>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full max-w-full text-left">
        {inner}
      </button>
    )
  }
  return inner
}

export function TalkmakerVoiceBubbleFace({
  duration,
  isPlaying,
}: {
  duration: number
  isPlaying: boolean
}) {
  const bars = buildStaticWaveHeights(duration || 1, 4)
  return (
    <div className="flex min-w-[140px] items-center gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-600" aria-hidden>
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          {isPlaying ? (
            <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
          ) : (
            <path d="M8 5v14l11-7z" />
          )}
        </svg>
      </span>
      <div className="flex items-center gap-[2px]">
        {bars.map((h, idx) => (
          <span
            key={idx}
            className={`w-[3px] rounded-full ${idx % 2 === 0 ? 'bg-gray-500' : 'bg-gray-800'}`}
            style={{ height: h }}
          />
        ))}
      </div>
      <span className="shrink-0 text-xs text-gray-500">
        <PhoneMixedLatinNumText text={`${Math.max(1, Math.round(duration))}"`} />
      </span>
    </div>
  )
}

/** Talkmaker · Talk Pay 转账卡片 */
export function TalkmakerPayCard({
  amountYuan,
  remark,
  status,
  onAction,
}: {
  amountYuan: number | null | undefined
  remark?: string
  status: 'pending' | 'accepted' | 'returned'
  onAction?: () => void
}) {
  const btnLabel =
    status === 'pending' ? '确认收钱' : status === 'accepted' ? '已收款' : '已退还'
  return (
    <div className="flex w-64 max-w-full flex-col overflow-hidden border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col bg-[#FEE500] p-4">
        <span className="text-[12px] font-semibold text-yellow-900">Talk Pay</span>
        <span className="mt-2 text-[20px] font-bold text-black tabular-nums">
          {formatMessengerMoney(amountYuan)}
        </span>
        {remark?.trim() ? (
          <span className="mt-1 text-[12px] text-yellow-800">{remark.trim()}</span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onAction?.()
        }}
        className="bg-white p-3 text-center text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        {btnLabel}
      </button>
    </div>
  )
}

export function MessengerVoiceBubbleShell({
  isSelf,
  messengerStyle,
  bubble,
  showTail,
  bubbleTailMaskColor: _bubbleTailMaskColor,
  children,
  className = '',
  replyPreview,
  transcriptExpanded = false,
  embedded = false,
}: {
  isSelf: boolean
  messengerStyle: 'imessage' | 'telegram' | 'talkmaker'
  bubble: WeChatBubbleTheme
  showTail: boolean
  bubbleTailMaskColor: string
  children: ReactNode
  className?: string
  replyPreview?: { senderName: string; content: string; onClick?: () => void }
  transcriptExpanded?: boolean
  /** Parent already applies max-width / side margin (e.g. voice transcript stack). */
  embedded?: boolean
}) {
  const radiusPx = isSelf ? bubble.selfBubbleRadiusPx : bubble.otherBubbleRadiusPx
  const imessageBg = isSelf ? '#0B93F6' : '#E5E5EA'
  const imessageText = isSelf ? '#ffffff' : '#111827'
  const telegramBg = isSelf ? bubble.selfBubbleBg : bubble.otherBubbleBg
  const talkmakerBg = isSelf ? TALKMAKER_SELF_BUBBLE : TALKMAKER_OTHER_BUBBLE
  const bg =
    messengerStyle === 'imessage' ? imessageBg : messengerStyle === 'talkmaker' ? talkmakerBg : telegramBg
  const tailCorner = `${Math.min(radiusPx, 5)}px`
  const r = `${radiusPx}px`
  let radius =
    messengerStyle === 'imessage'
      ? imessageBubbleCornerRadius(isSelf, radiusPx, showTail)
      : messengerStyle === 'telegram' || messengerStyle === 'talkmaker'
        ? telegramBubbleCornerRadius(isSelf, radiusPx, showTail)
        : `${radiusPx}px`
  if (transcriptExpanded) {
    if (messengerStyle === 'imessage') {
      radius = `${r} ${r} 0 0`
    } else if (isSelf) {
      radius = showTail ? `${r} ${r} ${tailCorner} 0` : `${r} ${r} 0 0`
    } else {
      radius = showTail ? `${r} ${r} 0 ${tailCorner}` : `${r} ${r} 0 0`
    }
  }

  return (
    <div
      className={`relative min-w-0 overflow-visible ${
        embedded ? 'w-full' : `max-w-[min(280px,calc(100vw-120px))] ${isSelf ? 'mr-3' : 'ml-3'}`
      }`}
    >
      {(messengerStyle === 'telegram' || messengerStyle === 'talkmaker') && showTail ? (
        <TelegramBubbleTail isSelf={isSelf} bubbleColor={bg} />
      ) : null}
      <div
        className={`relative z-[2] overflow-visible px-3 py-2 ${className}`}
        style={{
          backgroundColor: bg,
          color: messengerStyle === 'imessage' ? imessageText : '#000000',
          borderRadius: radius,
          boxShadow: messengerStyle === 'telegram' ? '0 1px 2px rgba(0, 0, 0, 0.15)' : undefined,
        }}
      >
        {messengerStyle === 'imessage' && showTail ? (
          <ImessageBubbleTail isSelf={isSelf} bubbleColor={bg} />
        ) : null}
        {replyPreview && messengerStyle === 'telegram' ? (
          <TelegramInlineReplyBlock
            senderName={replyPreview.senderName}
            content={replyPreview.content}
            isSelf={isSelf}
            onClick={replyPreview.onClick}
          />
        ) : null}
        {replyPreview && messengerStyle === 'talkmaker' ? (
          <TalkmakerInlineReplyBlock
            senderName={replyPreview.senderName}
            content={replyPreview.content}
            onClick={replyPreview.onClick}
          />
        ) : null}
        {children}
      </div>
    </div>
  )
}

export function ImessageVoiceBubbleFace({
  isSelf,
  duration,
  isPlaying,
  progress,
  waveSeed,
}: {
  isSelf: boolean
  duration: number
  isPlaying: boolean
  progress: number
  waveSeed: number
}) {
  const heights = buildStaticWaveHeights(waveSeed)
  const playBg = isSelf ? '#ffffff' : '#ffffff'
  const playIcon = isSelf ? '#0B93F6' : '#0B93F6'
  const barCls = isSelf ? 'bg-white/60' : 'bg-gray-400/70'
  const activeCls = isSelf ? 'bg-white' : 'bg-gray-600'

  return (
    <div className="flex min-w-[200px] items-center gap-3">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: playBg }}
        aria-hidden
      >
        <svg className="ml-0.5 h-4 w-4" fill={playIcon} viewBox="0 0 24 24">
          {isPlaying ? (
            <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
          ) : (
            <path d="M8 5v14l11-7z" />
          )}
        </svg>
      </span>
      <MessengerVoiceWaveform
        heights={heights}
        progress={progress}
        isPlaying={isPlaying}
        barClassName={barCls}
        activeClassName={activeCls}
      />
      <span className={`shrink-0 text-xs font-medium ${isSelf ? 'text-white/90' : 'text-gray-600'}`}>
        <PhoneMixedLatinNumText text={formatVoiceDurationLabel(duration)} />
      </span>
    </div>
  )
}

export function TelegramVoiceBubbleFace({
  isSelf,
  duration,
  isPlaying,
  progress,
  waveSeed,
  timeLabel,
  showReadChecks,
}: {
  isSelf: boolean
  duration: number
  isPlaying: boolean
  progress: number
  waveSeed: number
  timeLabel?: string
  showReadChecks?: boolean
}) {
  const heights = buildStaticWaveHeights(waveSeed, 16)
  const accent = isSelf ? '#4CA861' : '#3390EC'

  return (
    <div className="flex min-w-[210px] flex-col gap-1">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: accent }}
          aria-hidden
        >
          <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            {isPlaying ? (
              <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
            ) : (
              <path d="M8 5v14l11-7z" />
            )}
          </svg>
        </span>
        <MessengerVoiceWaveform
          heights={heights}
          progress={progress}
          isPlaying={isPlaying}
          barClassName={isSelf ? 'bg-[#4CA861]/45' : 'bg-[#3390EC]/45'}
          activeClassName={isSelf ? 'bg-[#4CA861]' : 'bg-[#3390EC]'}
        />
      </div>
      <div className={`flex items-center justify-end gap-1 text-[11px] ${isSelf ? 'text-[#4CA861]' : 'text-[#A1AAB3]'}`}>
        <PhoneMixedLatinNumText text={timeLabel ?? formatVoiceDurationLabel(duration)} />
        {isSelf && showReadChecks ? <TelegramDoubleCheckMini /> : null}
      </div>
    </div>
  )
}

function LocationPinMiniIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ImessageMapPinIcon() {
  return (
    <svg className="h-8 w-8 text-red-500 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  )
}

function messengerCardShellRadius(isSelf: boolean, radiusPx: number, showTail: boolean): string {
  if (!showTail) return `${radiusPx}px`
  if (isSelf) return `${radiusPx}px ${radiusPx}px 0 ${radiusPx}px`
  return `${radiusPx}px ${radiusPx}px ${radiusPx}px 0`
}

function messengerCardFooterRadius(isSelf: boolean, innerRadius: number, showTail: boolean): string {
  if (!showTail) return `0 0 ${innerRadius}px ${innerRadius}px`
  if (isSelf) return `0 0 0 ${innerRadius}px`
  return `0 0 ${innerRadius}px 0`
}

/** iMessage · 位置卡片（地图 + 白色底栏 · 距离副标题 · 白尾巴） */
export function ImessageLocationCard({
  data,
  isSelf,
  showTail = false,
  bubbleTailMaskColor: _bubbleTailMaskColor = 'var(--wx-chat-room-bg, #EDEDED)',
  bubble,
}: {
  data: WeChatLocationPayload
  isSelf: boolean
  showTail?: boolean
  bubbleTailMaskColor?: string
  bubble?: WeChatBubbleTheme
}) {
  const name = data.name.trim() || '位置'
  const distanceSubtitle = formatLocationDistanceSubtitle(data, 'imessage')
  const mapSrc = resolveLocationMapSrc(data)
  const radiusPx = bubble ? (isSelf ? bubble.selfBubbleRadiusPx : bubble.otherBubbleRadiusPx) : 20
  const innerRadius = Math.max(11, radiusPx - 1)
  const tailColor = '#FFFFFF'

  return (
    <div className={`relative w-64 max-w-[min(260px,calc(100vw-120px))] overflow-visible ${isSelf ? 'mr-3' : 'ml-3'}`}>
      <div
        className="relative z-[2] flex w-full flex-col overflow-visible border border-gray-200 bg-white shadow-sm"
        style={{ borderRadius: messengerCardShellRadius(isSelf, radiusPx, showTail) }}
      >
        {showTail ? (
          <ImessageBubbleTail isSelf={isSelf} bubbleColor={tailColor} />
        ) : null}
        <div
          className="relative h-36 w-full overflow-hidden bg-[#e5e5ea]"
          style={{ borderTopLeftRadius: innerRadius, borderTopRightRadius: innerRadius }}
        >
          <img src={mapSrc} alt="" className="size-full object-cover" draggable={false} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {isSelf ? (
              <span
                className="block size-3 rounded-full bg-[#0B93F6] ring-4 ring-[#0B93F6]/25"
                aria-hidden
              />
            ) : (
              <ImessageMapPinIcon />
            )}
          </div>
        </div>
        <div
          className="relative z-10 flex flex-col bg-white px-3 py-2.5"
          style={{ borderRadius: messengerCardFooterRadius(isSelf, innerRadius, showTail) }}
        >
          <span className="truncate text-[15px] font-semibold leading-tight text-black">{name}</span>
          <span className="mt-[2px] text-[12px] text-gray-500">
            <PhoneMixedLatinNumText text={distanceSubtitle} />
          </span>
        </div>
      </div>
    </div>
  )
}

/** Telegram · Venue 地点卡片（地图 + 同色底栏 · 距离 + 时间双勾） */
export function TelegramLocationBubble({
  data,
  isSelf,
  bubble,
  showTail,
  timeLabel,
  showReadChecks,
}: {
  data: WeChatLocationPayload
  isSelf: boolean
  bubble: WeChatBubbleTheme
  showTail: boolean
  timeLabel?: string
  showReadChecks?: boolean
}) {
  const name = data.name.trim() || '位置'
  const distanceLabel = formatLocationDistanceSubtitle(data, 'telegram')
  const mapSrc = resolveLocationMapSrc(data)
  const bg = isSelf ? bubble.selfBubbleBg : bubble.otherBubbleBg
  const radiusPx = isSelf ? bubble.selfBubbleRadiusPx : bubble.otherBubbleRadiusPx
  const innerRadius = Math.max(11, radiusPx - 1)
  const shellRadius = telegramBubbleCornerRadius(isSelf, radiusPx, showTail)

  return (
    <div className={`relative w-64 max-w-full ${isSelf ? 'mr-3' : 'ml-3'}`}>
      {showTail ? <TelegramBubbleTail isSelf={isSelf} bubbleColor={bg} /> : null}
      <div
        className="relative z-[2] flex w-full flex-col shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
        style={{
          borderRadius: shellRadius,
          border: isSelf ? '1px solid #c5e6a1' : undefined,
        }}
      >
        <div
          className="relative h-32 w-full overflow-hidden bg-[#e0e0e0]"
          style={{ borderTopLeftRadius: innerRadius, borderTopRightRadius: innerRadius }}
        >
          <img src={mapSrc} alt="" className="size-full object-cover" draggable={false} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative flex size-10 items-center justify-center">
              <div className="absolute size-10 animate-ping rounded-full bg-[#3390EC]/30" aria-hidden />
              <div className="relative size-4 rounded-full border-2 border-white bg-[#3390EC] shadow-md" aria-hidden />
            </div>
          </div>
        </div>
        <div
          className="relative z-10 flex flex-col p-2 pb-1.5"
          style={{
            backgroundColor: bg,
            borderRadius: messengerCardFooterRadius(isSelf, innerRadius, showTail),
          }}
        >
          <span className="truncate text-[15px] font-medium leading-tight text-black">{name}</span>
          <div className="mt-1 flex items-end justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1 text-[13px] text-gray-500">
              <LocationPinMiniIcon />
              <span className="truncate">
                <PhoneMixedLatinNumText text={distanceLabel} />
              </span>
            </span>
            {timeLabel ? (
              <span
                className={`flex shrink-0 items-center gap-1 text-[11px] ${isSelf ? 'text-[#4CA861]' : 'text-[#A1AAB3]'}`}
              >
                <PhoneMixedLatinNumText text={timeLabel} />
                {isSelf && showReadChecks ? <TelegramDoubleCheckMini /> : null}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Talkmaker · 位置卡片（地图 + 距离底栏 · Telegram 底角尾巴） */
export function TalkmakerLocationCard({
  data,
  isSelf,
  showTail = false,
}: {
  data: WeChatLocationPayload
  isSelf: boolean
  showTail?: boolean
}) {
  const name = data.name.trim() || '位置'
  const { showNearBadge, label: distanceLabel } = formatLocationDistanceTalkmaker(data)
  const mapSrc = resolveLocationMapSrc(data)
  const bg = TALKMAKER_OTHER_BUBBLE
  const radiusPx = 12
  const shellRadius = telegramBubbleCornerRadius(isSelf, radiusPx, showTail)

  return (
    <div className={`relative w-64 max-w-full overflow-visible ${isSelf ? 'mr-3' : 'ml-3'}`}>
      {showTail ? <TelegramBubbleTail isSelf={isSelf} bubbleColor={bg} /> : null}
      <div
        className="relative z-[2] flex w-full flex-col overflow-visible border border-gray-100 bg-white shadow-sm"
        style={{ borderRadius: shellRadius }}
      >
        <div className="relative h-32 w-full overflow-hidden bg-gray-200">
          <img src={mapSrc} alt="" className="size-full object-cover" draggable={false} />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl" aria-hidden>
            📍
          </span>
        </div>
        <div className="relative z-10 flex flex-col bg-white p-3">
          <span className="truncate text-[14px] font-semibold text-black">{name}</span>
          <span className="mt-1 flex items-center gap-1 text-[12px] font-medium text-[#3390EC]">
            {showNearBadge ? (
              <span className="rounded bg-blue-50 px-1 text-[10px]">NEAR</span>
            ) : null}
            <PhoneMixedLatinNumText text={distanceLabel} />
          </span>
        </div>
      </div>
    </div>
  )
}
