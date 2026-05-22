import type { CSSProperties } from 'react'

/** 半透明毛玻璃气泡 · 叠在视频背景上 */
const GLASS_BASE: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.2)',
  border: '1px solid rgba(255, 255, 255, 0.34)',
  boxShadow:
    '0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 8px 28px rgba(0, 0, 0, 0.14)',
  backdropFilter: 'blur(16px) saturate(1.15)',
  WebkitBackdropFilter: 'blur(16px) saturate(1.15)',
}

const GLASS_SELF: CSSProperties = {
  ...GLASS_BASE,
  background: 'rgba(255, 248, 232, 0.22)',
  border: '1px solid rgba(255, 255, 255, 0.38)',
}

export function jbsPlayerBubbleSurfaceStyle(isSelf: boolean): CSSProperties {
  return isSelf ? GLASS_SELF : GLASS_BASE
}

export const jbsPlayerBubbleTextClass = 'text-[rgba(255,255,255,0.95)] [text-shadow:0_1px_10px_rgba(0,0,0,0.4)]'

export const jbsPlayerBubbleLabelClass =
  'text-[rgba(255,255,255,0.72)] [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]'
