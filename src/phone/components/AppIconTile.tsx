import { AppLineIcon } from '../icons/AppLineIcons'
import type { AppSlot } from '../types'
import { useCustomization } from '../CustomizationContext'
import { useState } from 'react'

/** 默认纯白 1:1 底 */
export const DEFAULT_ICON_BG = '#ffffff'

/** 背景正方形（1:1） */
export const DEFAULT_BG_SIZE = 58
/** 线标（1:1） */
export const DEFAULT_GLYPH_SIZE = 38

type Props = {
  appId: AppSlot['id']
  bgSize?: number
  glyphSize?: number
  /** 若不传，则使用该 app 的自定义圆角 */
  radius?: number
  /** 主屏角标：未读数 > 0 时显示红底数字（>99 显示 99+） */
  badgeCount?: number
}

/**
 * 应用图标：纯白 1:1 圆角底 + 居中 1:1 线标。
 */
export function AppIconTile({
  appId,
  bgSize = DEFAULT_BG_SIZE,
  glyphSize = DEFAULT_GLYPH_SIZE,
  radius,
  badgeCount = 0,
}: Props) {
  const { state } = useCustomization()
  const app = state.apps.find((a) => a.id === appId)
  const resolvedRadius = typeof radius === 'number' ? radius : app?.iconRadius ?? 18
  const imageUrl = app?.iconImageUrl?.trim() ?? ''
  const [broken, setBroken] = useState(false)
  const canShowImage = !!imageUrl && !broken

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-visible"
      style={{
        width: bgSize,
        height: bgSize,
        minWidth: bgSize,
        minHeight: bgSize,
      }}
    >
      <span
        className="inline-flex shrink-0 items-center justify-center overflow-hidden"
        style={{
          width: bgSize,
          height: bgSize,
          minWidth: bgSize,
          minHeight: bgSize,
          borderRadius: resolvedRadius,
          background: canShowImage ? 'transparent' : DEFAULT_ICON_BG,
          border: canShowImage ? 'none' : '1px solid rgba(0, 0, 0, 0.06)',
          boxShadow: canShowImage ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.08)',
          position: 'relative',
        }}
      >
        {canShowImage ? (
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            onError={() => setBroken(true)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <AppLineIcon
            id={appId}
            width={glyphSize}
            height={glyphSize}
            className="shrink-0 opacity-90"
          />
        )}
      </span>
      {badgeCount > 0 ? (
        <span
          className="pointer-events-none absolute flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[10px] font-bold leading-none text-white"
          style={{ top: -6, right: -6, background: '#fa5151', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.95)' }}
          aria-label={`未读 ${badgeCount}`}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      ) : null}
    </span>
  )
}
