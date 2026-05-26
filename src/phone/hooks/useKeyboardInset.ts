import { useEffect, useRef, useState, type RefObject } from 'react'

import {
  computeWeChatStyleKeyboardInset,
  measureComposerOverlapPx,
} from './keyboardInset'

/**
 * 软键盘占用高度：微信 ChatRoom 同源 baseline + 可选输入栏重叠补偿。
 */
export function useKeyboardInset(
  composerRef?: RefObject<HTMLElement | null>,
): number {
  const [keyboardInsetPx, setKeyboardInsetPx] = useState(0)
  const baselineRef = useRef(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const nav = navigator as Navigator & {
      virtualKeyboard?: {
        addEventListener?: (type: 'geometrychange', listener: () => void) => void
        removeEventListener?: (type: 'geometrychange', listener: () => void) => void
      }
    }
    const virtualKeyboard = nav.virtualKeyboard

    const update = () => {
      let inset = computeWeChatStyleKeyboardInset(baselineRef)

      const overlap = measureComposerOverlapPx(composerRef?.current ?? null)
      if (overlap > inset) inset = overlap

      const cap = Math.round(
        Math.max(window.innerHeight || 0, baselineRef.current) * 0.6,
      )
      inset = Math.min(inset, cap)

      setKeyboardInsetPx((prev) => (Math.abs(prev - inset) < 4 ? prev : inset))
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
  }, [composerRef])

  return keyboardInsetPx
}
