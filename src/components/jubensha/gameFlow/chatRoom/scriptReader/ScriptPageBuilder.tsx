import { useEffect, useState } from 'react'

import type { JBSStep } from '../jbsFlowTypes'
import type { ScriptSection } from '../jbsFlowTypes'

import { buildScriptPages } from './buildScriptPages'
import {
  getPageBodyMetrics,
  isValidPageBodyMetrics,
  subscribePageBodyMetrics,
  type ScriptPageBodyMetrics,
} from './scriptPageMetrics'
import { ScriptPageCapacityProbe } from './ScriptPageCapacityProbe'
import { ScriptReaderPageChromeSpacer } from './ScriptReaderPageChrome'
import type { ScriptPage } from './scriptReaderTypes'

/**
 * 与 ThreeDPageFlipper 同列 flex 布局（含底部工具栏占位）后再分页。
 * 须在 metrics 变化时重新分页（不能只依赖 metricsReady 布尔值）。
 */
export function ScriptPageBuilder({
  sections,
  step,
  loopRound,
  onPagesBuilt,
}: {
  sections: readonly ScriptSection[]
  step: JBSStep
  loopRound: number
  onPagesBuilt: (pages: ScriptPage[]) => void
}) {
  const [bodyMetrics, setBodyMetrics] = useState<ScriptPageBodyMetrics | null>(() => {
    const m = getPageBodyMetrics()
    return isValidPageBodyMetrics(m) ? m : null
  })

  useEffect(() => {
    const sync = () => {
      const m = getPageBodyMetrics()
      setBodyMetrics(isValidPageBodyMetrics(m) ? m : null)
    }
    sync()
    return subscribePageBodyMetrics(sync)
  }, [])

  useEffect(() => {
    if (!bodyMetrics) return
    let cancelled = false
    const run = () => {
      if (cancelled) return
      onPagesBuilt(buildScriptPages(sections, step, loopRound))
    }
    if (document.fonts?.ready) {
      void document.fonts.ready.then(run)
    } else {
      run()
    }
    return () => {
      cancelled = true
    }
  }, [sections, step, loopRound, bodyMetrics, onPagesBuilt])

  return (
    <div
      className="pointer-events-none col-start-1 row-start-1 flex min-h-0 flex-1 flex-col opacity-0"
      aria-hidden
    >
      <div className="jbs-script-flip-scene relative mx-auto min-h-0 w-full max-w-[min(100%,340px)] flex-1">
        <ScriptPageCapacityProbe />
      </div>
      <ScriptReaderPageChromeSpacer />
    </div>
  )
}
