import { useLayoutEffect, useRef } from 'react'

import { setPageBodyMetrics } from './scriptPageMetrics'

/** 与 PageContent + 纸面内边距同构，量 body-box 可用区域 */
export function ScriptPageCapacityProbe() {
  const bodyBoxRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = bodyBoxRef.current
    if (!el) return

    let debounceId = 0
    let rafId = 0

    const report = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      setPageBodyMetrics(w, h)
    }

    const schedule = () => {
      window.clearTimeout(debounceId)
      debounceId = window.setTimeout(() => {
        cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(() => {
          requestAnimationFrame(report)
        })
      }, 80)
    }

    schedule()
    const ro = new ResizeObserver(() => schedule())
    ro.observe(el)
    window.addEventListener('resize', schedule)
    if (document.fonts?.ready) void document.fonts.ready.then(schedule)

    return () => {
      window.clearTimeout(debounceId)
      cancelAnimationFrame(rafId)
      ro.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return (
    <div className="jbs-script-page relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg">
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden px-5 pb-4 pt-3">
        <div className="jbs-script-page-content relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <span className="jbs-script-section-tag jbs-font-serif" aria-hidden>
            占位
          </span>
          <div
            ref={bodyBoxRef}
            className="jbs-script-page-body-box min-h-0 flex-1 overflow-hidden"
          >
            <p className="jbs-script-page-body jbs-font-kai whitespace-pre-wrap">&nbsp;</p>
          </div>
        </div>
      </div>
    </div>
  )
}
