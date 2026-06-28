/** Telegram 气泡内嵌时间与双勾 UI */

import { PhoneMixedLatinNumText } from '../../phoneMixedLatinNumText'

export function formatTelegramBubbleTime(tsMs: number): string {
  const d = new Date(tsMs)
  if (!Number.isFinite(d.getTime())) return '00:00'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function TelegramBubbleTail({ isSelf, bubbleColor }: { isSelf: boolean; bubbleColor: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-0 z-0"
      style={{
        ...(isSelf ? { right: -8 } : { left: -8 }),
        width: 0,
        height: 0,
        borderTop: '12px solid transparent',
        borderBottom: '0 solid transparent',
        ...(isSelf ? { borderLeft: `10px solid ${bubbleColor}` } : { borderRight: `10px solid ${bubbleColor}` }),
      }}
    />
  )
}

function TelegramDoubleCheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M11.5 3.5L6.5 9L4 6.5L3 7.5L6.5 11L12.5 4.5L11.5 3.5Z" />
      <path d="M15.5 3.5L10.5 9L9.75 8.25L8.75 9.25L10.5 11L16.5 4.5L15.5 3.5Z" />
    </svg>
  )
}

export function TelegramBubbleMeta({
  isSelf,
  timeLabel,
  showReadChecks = false,
}: {
  isSelf: boolean
  timeLabel: string
  showReadChecks?: boolean
}) {
  return (
    <span
      className="float-right ml-3 mt-1.5 inline-flex items-center gap-0.5 text-[11px] leading-none select-none"
      style={{ color: isSelf ? '#4CA861' : '#A1AAB3' }}
      aria-hidden
    >
      <PhoneMixedLatinNumText text={timeLabel} />
      {isSelf && showReadChecks ? <TelegramDoubleCheckIcon /> : null}
    </span>
  )
}

export function telegramBubbleCornerRadius(isSelf: boolean, radiusPx: number, showTail: boolean): string {
  if (!showTail) return `${radiusPx}px`
  if (isSelf) return `${radiusPx}px ${radiusPx}px 0 ${radiusPx}px`
  return `${radiusPx}px ${radiusPx}px ${radiusPx}px 0`
}
