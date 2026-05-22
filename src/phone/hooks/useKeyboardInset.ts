import { useEffect, useState } from 'react'

/**
 * 软键盘占用高度（VisualViewport / VirtualKeyboard），用于列表底部 padding 或输入栏上移。
 * 与 Meet/微信 ChatRoom 同源；阈值防抖，避免 iOS 键盘动画期间连续 setState 引发抖动。
 */
export function useKeyboardInset(): number {
  const [keyboardInsetPx, setKeyboardInsetPx] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const nav = navigator as Navigator & {
      virtualKeyboard?: {
        boundingRect?: { height?: number }
        addEventListener?: (type: 'geometrychange', listener: () => void) => void
        removeEventListener?: (type: 'geometrychange', listener: () => void) => void
      }
    }
    const virtualKeyboard = nav.virtualKeyboard
    const baselineRef = { current: 0 }

    const update = () => {
      const visible = vv.height + vv.offsetTop
      const cssVhRaw = window.getComputedStyle(document.documentElement).getPropertyValue('--app-vh')
      const cssVh = Number.parseFloat(cssVhRaw)
      const vkInset = Math.max(0, Math.round(virtualKeyboard?.boundingRect?.height ?? 0))
      const baselineCandidate = Math.max(
        visible,
        Math.round(window.innerHeight || 0),
        Number.isFinite(cssVh) ? Math.round(cssVh) : 0,
      )
      if (baselineCandidate > baselineRef.current) baselineRef.current = baselineCandidate
      let inset = Math.max(
        0,
        Math.round(baselineRef.current - visible),
        Math.round((window.innerHeight || 0) - visible),
        Number.isFinite(cssVh) ? Math.round(cssVh - visible) : 0,
        vkInset,
      )
      inset = Math.min(inset, Math.round((baselineRef.current * 0.6) || 0))

      setKeyboardInsetPx((prev) => (Math.abs(prev - inset) < 6 ? prev : inset))
    }

    update()
    vv.addEventListener('resize', update)
    virtualKeyboard?.addEventListener?.('geometrychange', update)
    window.addEventListener('orientationchange', update)
    return () => {
      vv.removeEventListener('resize', update)
      virtualKeyboard?.removeEventListener?.('geometrychange', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return keyboardInsetPx
}
