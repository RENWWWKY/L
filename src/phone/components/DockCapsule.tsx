import type { CSSProperties, ReactNode } from 'react'
import type { DockStyle, PhoneTheme } from '../types'

function dockGradientBackgroundImage(dock: DockStyle): string {
  const a = dock.gradientFromStop
  const b = dock.gradientToStop
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const span = hi - lo
  if (span < 1) {
    return `linear-gradient(${dock.gradientAngle}deg, ${dock.gradientFrom} ${a}%, ${dock.gradientTo} ${b}%)`
  }
  const mid = lo + span / 2
  const t = (dock.gradientNaturalness - 50) / 50
  const maxOffset = span / 2 - 0.5
  const hint = mid + t * maxOffset
  const hintClamped = Math.min(Math.max(hint, lo + 0.5), hi - 0.5)
  return `linear-gradient(${dock.gradientAngle}deg, ${dock.gradientFrom} ${a}%, ${hintClamped}%, ${dock.gradientTo} ${b}%)`
}

/** Dock 底层背景（不含毛玻璃层） */
export function dockBaseLayerStyle(theme: PhoneTheme, dock: DockStyle): CSSProperties {
  switch (dock.fillMode) {
    case 'solid':
      return { backgroundColor: dock.dockSolidColor }
    case 'gradient':
      return {
        backgroundImage: dockGradientBackgroundImage(dock),
      }
    case 'image':
      if (dock.bgImageUrl.trim())
        return {
          backgroundImage: `url(${dock.bgImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }
      return { backgroundColor: theme.surface }
    default:
      return { backgroundColor: theme.surface }
  }
}

type CapsuleProps = {
  theme: PhoneTheme
  dockStyle: DockStyle
  children: ReactNode
  className?: string
  /** 预览条可缩小比例 */
  scale?: number
}

/**
 * 胶囊结构与毛玻璃：背景与 `backdrop-filter` 必须分层，否则毛玻璃对「下层壁纸」不可见。
 */
export function DockCapsule({ theme, dockStyle, children, className, scale }: CapsuleProps) {
  const base = dockBaseLayerStyle(theme, dockStyle)
  const wrapperStyle: CSSProperties | undefined =
    scale !== undefined && scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: 'center top' } : undefined

  return (
    <div className={className} style={wrapperStyle}>
      <div
        className="relative w-full max-w-[360px] overflow-hidden rounded-full border px-2.5 py-2.5"
        style={{
          borderColor: theme.border,
          boxShadow: 'var(--phone-shadow)',
        }}
      >
        <div className="absolute inset-0 rounded-[inherit]" style={base} aria-hidden />
        {dockStyle.glass ? (
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{
              background: 'rgba(255, 255, 255, 0.28)',
              backdropFilter: `saturate(1.15) blur(${dockStyle.blur}px)`,
              WebkitBackdropFilter: `saturate(1.15) blur(${dockStyle.blur}px)`,
            }}
            aria-hidden
          />
        ) : null}
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  )
}
