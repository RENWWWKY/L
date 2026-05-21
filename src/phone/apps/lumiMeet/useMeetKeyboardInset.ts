import { useEffect, useState } from 'react'

/**
 * 移动端软键盘遮挡：用 VisualViewport（及可选 VirtualKeyboard）估算键盘上沿占用高度，
 * 供输入栏 `translateY` 与消息列表 `paddingBottom` 同步补偿（与微信 ChatRoom 同源思路）。
 */
export function useMeetKeyboardInset(): number {
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

      setKeyboardInsetPx((prev) => {
        if (Math.abs(prev - inset) < 4) return prev
        return inset
      })
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    virtualKeyboard?.addEventListener?.('geometrychange', update)
    window.addEventListener('orientationchange', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      virtualKeyboard?.removeEventListener?.('geometrychange', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return keyboardInsetPx
}
