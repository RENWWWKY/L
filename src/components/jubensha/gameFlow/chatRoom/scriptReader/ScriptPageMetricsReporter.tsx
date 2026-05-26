import { useLayoutEffect, type RefObject } from 'react'

import { setPageBodyMetrics } from './scriptPageMetrics'

/** 翻页器挂载后，用真实纸面正文区尺寸触发重新分页 */
export function ScriptPageMetricsReporter({
  bodyRef,
  pageId,
}: {
  bodyRef: RefObject<HTMLParagraphElement | null>
  pageId: string
}) {
  useLayoutEffect(() => {
    const report = () => {
      const box = bodyRef.current?.closest('.jbs-script-page-body-box') as HTMLElement | null
      if (!box) return
      setPageBodyMetrics(box.clientWidth, box.clientHeight)
    }

    let rafId = 0
    const schedule = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        requestAnimationFrame(report)
      })
    }

    schedule()
    const box = bodyRef.current?.closest('.jbs-script-page-body-box')
    const ro = new ResizeObserver(() => schedule())
    if (box) ro.observe(box)
    window.addEventListener('resize', schedule)
    if (document.fonts?.ready) void document.fonts.ready.then(schedule)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [bodyRef, pageId])

  return null
}
