import { useMemo } from 'react'
import type { CSSProperties } from 'react'

import { WeChatChatMixedText } from './WeChatChatMixedText'

export type DanmakuOverlayBullet = {
  id: string
  text: string
  track: number
  durationSec: number
  startDelaySec?: number
  fontPx: number
  colorRgba: string
  style: 'none' | 'gray' | 'white'
  topPct?: number
}

function laneStyleFor(mode: DanmakuOverlayBullet['style']): CSSProperties {
  if (mode === 'gray') {
    return {
      background: 'rgba(255,255,255,0.38)',
      border: '1px solid rgba(255,255,255,0.6)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      borderRadius: 999,
      padding: '2px 10px',
    }
  }
  if (mode === 'white') {
    return {
      background: 'rgba(255,255,255,0.72)',
      border: '1px solid rgba(255,255,255,0.88)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: 999,
      padding: '2px 10px',
    }
  }
  return {}
}

export function DanmakuOverlay({
  bullets,
  zoneStyle,
}: {
  bullets: DanmakuOverlayBullet[]
  zoneStyle: CSSProperties
}) {
  const prepared = useMemo(
    () =>
      bullets
        .map((b) => ({ ...b, text: String(b.text ?? '').trim() }))
        .filter((b) => b.text.length > 0),
    [bullets],
  )

  if (!prepared.length) return null

  return (
    <>
      <style>{`
        @keyframes wxDmFlyRightToLeft {
          from { transform: translate3d(110vw, 0, 0); }
          to { transform: translate3d(-120%, 0, 0); }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 z-[50] overflow-hidden" aria-hidden>
        <div className="pointer-events-none absolute inset-x-0 overflow-hidden" style={zoneStyle}>
          {prepared.map((it) => {
            const lineHeight = it.fontPx + 8
            const laneGapPx = 6
            const tokenStyle = laneStyleFor(it.style)
            const top =
              typeof it.topPct === 'number'
                ? `${it.topPct}%`
                : it.track * (lineHeight + laneGapPx)
            const dur = Math.max(3, it.durationSec)
            const delay = Math.max(0, it.startDelaySec ?? 0)
            return (
              <span
                key={it.id}
                className="absolute left-0 inline-block max-w-[92vw] truncate whitespace-nowrap font-medium"
                style={{
                  top,
                  fontSize: it.fontPx,
                  color: it.colorRgba,
                  lineHeight: `${lineHeight}px`,
                  textShadow: it.style === 'none' ? '0 1px 2px rgba(0,0,0,0.18)' : undefined,
                  /* backwards：delay 期间停留在 keyframes 的 from（右侧屏外），避免出现左侧「贴一页 PPT」再飞走的闪屏 */
                  animation: `wxDmFlyRightToLeft ${dur}s linear ${delay}s infinite backwards`,
                  willChange: 'transform',
                  ...tokenStyle,
                }}
              >
                {it.text ? <WeChatChatMixedText text={it.text} /> : null}
              </span>
            )
          })}
        </div>
      </div>
    </>
  )
}

