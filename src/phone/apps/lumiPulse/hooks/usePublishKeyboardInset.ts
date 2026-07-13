import { useEffect, useRef, useState } from 'react'

import { useKeyboardInset } from '../../../hooks/useKeyboardInset'
import { isIOSWebKit } from '../../../utils/platform'

/** 发布页：软键盘弹起时计算底部留白，供悬浮工具栏吸附键盘上方 */
export function usePublishKeyboardInset(active: boolean) {
  const [iosPadPx, setIosPadPx] = useState(0)
  const composerRef = useRef<HTMLDivElement>(null)
  const androidMetrics = useKeyboardInset(composerRef)

  useEffect(() => {
    if (!active || !isIOSWebKit()) {
      setIosPadPx(0)
      return
    }
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const focused = document.activeElement
      const inComposer =
        focused instanceof HTMLElement &&
        composerRef.current?.contains(focused) === true
      if (!inComposer) {
        setIosPadPx(0)
        return
      }
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setIosPadPx(Math.round(overlap))
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    document.addEventListener('focusin', update, true)
    document.addEventListener('focusout', update, true)

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      document.removeEventListener('focusin', update, true)
      document.removeEventListener('focusout', update, true)
    }
  }, [active])

  return {
    composerRef,
    keyboardPadPx: isIOSWebKit() ? iosPadPx : androidMetrics.padPx,
  }
}
