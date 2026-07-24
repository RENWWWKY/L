import { useEffect, useRef } from 'react'

import { LIVE_CHAT_MAX, LIVE_PLATINUM, LIVE_Z } from './constants'
import type { LiveChatLine } from './types'

function nickColor(kind: LiveChatLine['kind']): string {
  if (kind === 'host') return LIVE_PLATINUM
  if (kind === 'user') return LIVE_PLATINUM
  if (kind === 'system') return '#c8c8c8'
  return '#d4d4d4'
}

/**
 * 左下角无气泡评论流（最初样式）：纯文字 + 描边阴影，无入场位移动画，避免抖。
 */
export function LiveChatStream({
  lines,
  bottomOffsetPx = 0,
}: {
  lines: LiveChatLine[]
  /** 软键盘 +（可选）画面进度条预留高度 */
  bottomOffsetPx?: number
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const visible = lines.slice(-LIVE_CHAT_MAX)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [visible.length, visible[visible.length - 1]?.id])

  return (
    <div
      ref={scrollerRef}
      className="pointer-events-none absolute left-3 max-h-[32%] w-[72%] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      style={{
        zIndex: LIVE_Z.chat,
        bottom: `calc(6.25rem + ${Math.max(0, bottomOffsetPx)}px)`,
      }}
      aria-live="polite"
    >
      <div className="flex min-h-full flex-col justify-end gap-1 pr-2">
        {visible.map((line) => (
          <p
            key={line.id}
            className="text-[13px] font-medium leading-[1.45]"
            style={{
              textShadow: '0 1px 2px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.75)',
            }}
          >
            <span style={{ color: nickColor(line.kind) }}>{line.nick}</span>
            {line.kind === 'host' ? (
              <span
                className="ml-1.5 inline-flex translate-y-[-0.5px] items-center rounded-full px-1.5 py-[1px] align-middle text-[9px] font-medium leading-none tracking-[0.08em]"
                style={{
                  color: '#1a1610',
                  background: 'linear-gradient(135deg, #E8D5A3 0%, #D4AF37 52%, #B8962E 100%)',
                  boxShadow: '0 0 0 1px rgba(212,175,55,0.35)',
                  textShadow: 'none',
                }}
              >
                主播
              </span>
            ) : null}
            <span className="text-white">
              {line.kind === 'system' ? ` ${line.text}` : `：${line.text}`}
            </span>
          </p>
        ))}
      </div>
    </div>
  )
}
