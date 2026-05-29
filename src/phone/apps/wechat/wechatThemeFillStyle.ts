import type { CSSProperties } from 'react'
import type { WeChatTabId, WeChatTheme, WxFillStyle } from '../../types'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/** 与 WeChatApp 内 fillToStyle 一致：将主题填充转为 CSS 背景 */
export function wxFillToStyle(fill: WxFillStyle): CSSProperties {
  if (fill.mode === 'solid') {
    return {
      backgroundImage: 'none',
      backgroundColor: fill.solidColor,
    }
  }
  if (fill.mode === 'gradient') {
    const hint = clamp(typeof fill.gradientNaturalness === 'number' ? fill.gradientNaturalness : 50, 0, 100)
    const hintPct = clamp(5 + (hint / 100) * 90, 5, 95)
    return {
      backgroundColor: 'transparent',
      backgroundImage: `linear-gradient(${fill.gradientAngle}deg, ${fill.gradientFrom} 0%, ${hintPct}%, ${fill.gradientTo} 100%)`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    }
  }
  const url = fill.imageUrl?.trim()
  return url
    ? {
        backgroundColor: 'transparent',
        backgroundImage: `url(${url})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }
    : { backgroundColor: 'transparent', backgroundImage: 'none' }
}

export function resolveWeChatPageBgFill(theme: WeChatTheme, tab?: WeChatTabId): WxFillStyle {
  if (tab) return theme.pageBgByTab?.[tab] ?? theme.pageBgGlobal
  return theme.pageBgGlobal
}
