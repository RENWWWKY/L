import type { AppSlot } from '../types'
import { AppIconTile } from './AppIconTile'
import { Pressable } from './Pressable'
import { useCustomization } from '../CustomizationContext'

type Props = {
  app: AppSlot
  onOpen: (id: AppSlot['id']) => void
  className?: string
  compact?: boolean
  /** 主屏 / Dock 角标（如微信未读） */
  badgeCount?: number
}

export function DesktopAppTile({ app, onOpen, className, compact = false, badgeCount = 0 }: Props) {
  const { state } = useCustomization()
  const { theme } = state
  const iconBg = compact ? 54 : 64
  const iconGlyph = compact ? 36 : 42
  const labelSize = compact ? 'clamp(8px, 1.15vh, 9px)' : 'clamp(9px, 1.35vh, 10px)'

  return (
    <Pressable
      onClick={() => onOpen(app.id)}
      className={`flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-[var(--phone-radius-md)] bg-transparent px-1 py-0.5 ${className ?? ''}`}
      style={{
        background: 'transparent',
        color: theme.text,
        border: 'none',
        boxShadow: 'none',
      }}
    >
      <AppIconTile
        appId={app.id}
        bgSize={iconBg}
        glyphSize={iconGlyph}
        badgeCount={app.id === 'wechat' ? badgeCount : 0}
      />
      <span
        className="w-full max-w-full truncate px-1 text-center font-medium tracking-tight"
        style={{
          fontSize: labelSize,
          lineHeight: 1.25,
          color: theme.appLabelColor,
        }}
      >
        {app.label}
      </span>
    </Pressable>
  )
}
