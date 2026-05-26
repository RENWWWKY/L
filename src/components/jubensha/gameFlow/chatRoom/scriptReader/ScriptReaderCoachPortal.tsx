import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useId, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import type { ScriptReaderCoachStep } from './scriptReaderCoachTypes'
import { scriptCoachScopedTargetSelector, scriptCoachTargetSelector } from './scriptReaderCoachTypes'

const PAD = 10
const RADIUS = 14
const CARD_MAX_W = 320
const CARD_EST_H = 260

type HoleRect = { top: number; left: number; width: number; height: number }
type SafeInsets = { top: number; right: number; bottom: number; left: number }

function readSafeAreaInsets(): SafeInsets {
  if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 }
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);'
  document.body.appendChild(probe)
  const s = getComputedStyle(probe)
  const n = (v: string) => Number.parseFloat(v) || 0
  const insets = {
    top: n(s.paddingTop),
    right: n(s.paddingRight),
    bottom: n(s.paddingBottom),
    left: n(s.paddingLeft),
  }
  document.body.removeChild(probe)
  return insets
}

function findCoachTargetNode(scopeRoot: string | undefined, target: string): Element | null {
  if (scopeRoot?.trim()) {
    return document.querySelector(scriptCoachScopedTargetSelector(scopeRoot.trim(), target))
  }
  return document.querySelector(scriptCoachTargetSelector(target))
}

/** 视口坐标，供 fixed 定位与 SVG 遮罩使用 */
function measureTargetViewport(scopeRoot: string | undefined, target: string): HoleRect | null {
  const node = findCoachTargetNode(scopeRoot, target)
  if (!node) return null
  const er = node.getBoundingClientRect()
  if (er.width < 4 || er.height < 4) return null
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = Math.max(8, er.left - PAD)
  const top = Math.max(8, er.top - PAD)
  const right = Math.min(vw - 8, er.right + PAD)
  const bottom = Math.min(vh - 8, er.bottom + PAD)
  return {
    left,
    top,
    width: Math.max(28, right - left),
    height: Math.max(28, bottom - top),
  }
}

function scheduleCoachRemeasure(run: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      run()
      window.setTimeout(run, 80)
      window.setTimeout(run, 220)
      window.setTimeout(run, 480)
      window.setTimeout(run, 900)
    })
  })
}

function layoutTooltipCard(
  hole: HoleRect,
  viewportW: number,
  viewportH: number,
  safe: SafeInsets,
): { top: number; left: number; width: number } {
  const margin = 14
  const minTop = safe.top + margin
  const maxBottom = viewportH - safe.bottom - margin
  const width = Math.min(CARD_MAX_W, viewportW - safe.left - safe.right - margin * 2)
  let left = hole.left + hole.width / 2 - width / 2
  left = Math.max(safe.left + margin, Math.min(left, viewportW - safe.right - width - margin))

  /** 大面积高亮（如整页阅读区）时，说明卡固定落在底部安全区，避免顶到刘海/状态栏 */
  if (hole.height > viewportH * 0.4) {
    const top = Math.max(minTop, maxBottom - CARD_EST_H)
    return { top, left, width }
  }

  let top = hole.top + hole.height + 12
  if (top + CARD_EST_H > maxBottom) {
    top = hole.top - 12 - CARD_EST_H
  }
  top = Math.max(minTop, Math.min(top, maxBottom - CARD_EST_H))
  return { top, left, width }
}

function CoachCardBody({
  stepIndex,
  total,
  step,
  isFirst,
  isLast,
  onSkip,
  onStepChange,
  onComplete,
}: {
  stepIndex: number
  total: number
  step: ScriptReaderCoachStep
  isFirst: boolean
  isLast: boolean
  onSkip: () => void
  onStepChange: (index: number) => void
  onComplete: (opts?: { openTutorial?: boolean }) => void
}) {
  return (
    <>
      <p className="jbs-script-book-tag !animate-none opacity-80">ANNOTATION GUIDE</p>
      <p className="jbs-font-serif mt-2 text-[10px] tracking-[0.16em] text-[#c4a876]/55">
        引导 {stepIndex + 1} / {total}
      </p>
      <p id="script-coach-step-title" className="jbs-font-serif mt-1.5 text-[16px] tracking-[0.04em] text-[#f0e8d8]">
        {step.title}
      </p>
      <p className="jbs-font-serif mt-2 text-[12px] leading-[1.75] text-[#d8ccb8]/88">{step.body}</p>
      <div className="mt-5 flex flex-col gap-2">
        {step.isOutro ? (
          <>
            <button
              type="button"
              onClick={() => onComplete({ openTutorial: true })}
              className="jbs-script-tutorial-primary w-full rounded-full py-2.5 text-[12px] tracking-[0.1em]"
            >
              打开文字说明
            </button>
            <button
              type="button"
              onClick={() => onComplete()}
              className="jbs-script-tutorial-secondary w-full rounded-full py-2.5 text-[12px] tracking-[0.1em]"
            >
              开始阅读
            </button>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSkip}
                className="jbs-script-tutorial-secondary flex-1 rounded-full py-2.5 text-[12px] tracking-[0.08em]"
              >
                跳过
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isLast) onComplete()
                  else onStepChange(stepIndex + 1)
                }}
                className="jbs-script-tutorial-primary min-w-0 flex-[1.4] rounded-full py-2.5 text-[12px] tracking-[0.1em]"
              >
                {isLast ? '完成' : '下一步'}
              </button>
            </div>
            {!isFirst ? (
              <button
                type="button"
                onClick={() => onStepChange(stepIndex - 1)}
                className="w-full py-1 text-center text-[11px] text-[#c4a876]/45"
              >
                上一步
              </button>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}

export function ScriptReaderCoachPortal({
  open,
  steps,
  stepIndex,
  onStepChange,
  onSkip,
  onComplete,
  scopeRoot,
  layoutEpoch,
  zIndex = 86000,
}: {
  open: boolean
  steps: ScriptReaderCoachStep[]
  stepIndex: number
  onStepChange: (index: number) => void
  onSkip: () => void
  onComplete: (opts?: { openTutorial?: boolean }) => void
  scopeRoot?: string
  layoutEpoch?: string | number
  zIndex?: number
}) {
  const maskId = useId().replace(/:/g, '')
  const step = steps[stepIndex]
  const total = steps.length
  const [hole, setHole] = useState<HoleRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 390,
    h: typeof window !== 'undefined' ? window.innerHeight : 844,
  }))
  const [safe, setSafe] = useState<SafeInsets>({ top: 0, right: 0, bottom: 0, left: 0 })

  const remeasure = useCallback(() => {
    if (!open || !step) {
      setHole(null)
      setTooltipPos(null)
      return
    }
    setViewport({ w: window.innerWidth, h: window.innerHeight })
    setSafe(readSafeAreaInsets())
    if (step.centered) {
      setHole(null)
      setTooltipPos(null)
      return
    }
    if (step.target) {
      findCoachTargetNode(scopeRoot, step.target)?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth',
      })
    }
    const measure = () => {
      if (!step.target) {
        setHole(null)
        setTooltipPos(null)
        return
      }
      const vw = window.innerWidth
      const vh = window.innerHeight
      const nextHole = measureTargetViewport(scopeRoot, step.target)
      setHole(nextHole)
      const insets = readSafeAreaInsets()
      setSafe(insets)
      setTooltipPos(nextHole ? layoutTooltipCard(nextHole, vw, vh, insets) : null)
    }
    scheduleCoachRemeasure(measure)
  }, [open, step, scopeRoot])

  useLayoutEffect(() => {
    remeasure()
  }, [open, step, stepIndex, layoutEpoch, remeasure])

  useEffect(() => {
    if (!open) return
    const onResize = () => remeasure()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open, remeasure])

  if (typeof document === 'undefined' || !step) return null

  const isFirst = stepIndex === 0
  const isLast = stepIndex >= total - 1
  const showHole = open && !!hole && !step.centered

  const cardProps = {
    stepIndex,
    total,
    step,
    isFirst,
    isLast,
    onSkip,
    onStepChange,
    onComplete,
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="script-coach"
          role="dialog"
          aria-modal="true"
          aria-labelledby="script-coach-step-title"
          className="fixed inset-0"
          style={{ zIndex }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 z-0 h-full w-full cursor-default border-0 bg-transparent p-0"
            aria-label="跳过引导"
            onClick={onSkip}
          >
            <span className="sr-only">跳过引导</span>
          </button>

          {showHole && hole ? (
            <>
              <svg
                className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
                viewBox={`0 0 ${viewport.w} ${viewport.h}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                <defs>
                  <mask id={`script-coach-hole-${maskId}`}>
                    <rect x="0" y="0" width={viewport.w} height={viewport.h} fill="white" />
                    <rect
                      x={hole.left}
                      y={hole.top}
                      width={hole.width}
                      height={hole.height}
                      rx={RADIUS}
                      ry={RADIUS}
                      fill="black"
                    />
                  </mask>
                </defs>
                <rect
                  x="0"
                  y="0"
                  width={viewport.w}
                  height={viewport.h}
                  fill="rgba(8,6,4,0.62)"
                  mask={`url(#script-coach-hole-${maskId})`}
                />
              </svg>
              <motion.div
                className="pointer-events-none fixed z-[2] rounded-[14px] border-2 border-[#c4a876]/90"
                style={{
                  top: hole.top,
                  left: hole.left,
                  width: hole.width,
                  height: hole.height,
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.2), 0 8px 28px rgba(196,168,118,0.2)',
                }}
                initial={{ opacity: 0.5, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.22 }}
                aria-hidden
              />
            </>
          ) : (
            <motion.div
              className="pointer-events-none absolute inset-0 z-[1] bg-[rgba(8,6,4,0.58)]"
              aria-hidden
            />
          )}

          {step.centered ? (
            <div className="jbs-script-coach-centered pointer-events-none absolute inset-0 z-[3] flex items-center justify-center">
              <motion.div
                className="pointer-events-auto w-full max-w-[min(320px,calc(100%-24px))]"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="jbs-script-coach-card rounded-2xl p-5">
                  <CoachCardBody {...cardProps} />
                </div>
              </motion.div>
            </div>
          ) : tooltipPos ? (
            <motion.div
              className="jbs-script-coach-card jbs-script-coach-card--anchored pointer-events-auto fixed z-[3] max-h-[min(46dvh,320px)] overflow-y-auto rounded-2xl p-5 [-webkit-overflow-scrolling:touch]"
              style={{
                top: tooltipPos.top,
                left: tooltipPos.left,
                width: tooltipPos.width,
                maxWidth: `calc(100% - ${safe.left + safe.right + 28}px)`,
              }}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <CoachCardBody {...cardProps} />
            </motion.div>
          ) : !step.centered && step.target ? (
            <div className="jbs-script-coach-centered pointer-events-none absolute inset-0 z-[3] flex items-center justify-center">
              <motion.div
                className="pointer-events-auto w-full max-w-[min(320px,calc(100%-24px))]"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="jbs-script-coach-card rounded-2xl p-5">
                  <CoachCardBody {...cardProps} />
                </div>
              </motion.div>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
