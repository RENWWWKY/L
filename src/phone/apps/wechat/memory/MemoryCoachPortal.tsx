import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pressable } from '../../../components/Pressable'
import { ARCHIVE_SERIF } from './memoryArchiveTheme'
import type { MemoryCoachStep } from './memoryCoachTypes'
import { memoryCoachScopedTargetSelector, memoryCoachTargetSelector } from './memoryCoachTypes'

const PAD = 10
const RADIUS = 16
const CARD_MAX_W = 340
const CARD_EST_H = 240

type HoleRect = { top: number; left: number; width: number; height: number }

function findCoachTargetNode(scopeRoot: string | undefined, target: string): Element | null {
  if (scopeRoot?.trim()) {
    return document.querySelector(memoryCoachScopedTargetSelector(scopeRoot.trim(), target))
  }
  return document.querySelector(memoryCoachTargetSelector(target))
}

function measureTargetInOverlay(
  target: string,
  overlayEl: HTMLElement,
  scopeRoot?: string,
): HoleRect | null {
  const node = findCoachTargetNode(scopeRoot, target)
  if (!node) return null
  const er = node.getBoundingClientRect()
  const or = overlayEl.getBoundingClientRect()
  if (er.width < 2 || er.height < 2) return null
  const maxW = or.width - 16
  return {
    top: Math.max(8, er.top - or.top - PAD),
    left: Math.max(8, er.left - or.left - PAD),
    width: Math.min(maxW, er.width + PAD * 2),
    height: er.height + PAD * 2,
  }
}

function scheduleCoachRemeasure(run: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      run()
      window.setTimeout(run, 120)
      window.setTimeout(run, 260)
    })
  })
}

function layoutTooltipCard(hole: HoleRect, overlayW: number, overlayH: number): { top: number; left: number; width: number } {
  const margin = 14
  const width = Math.min(CARD_MAX_W, overlayW - margin * 2)
  let left = hole.left + hole.width / 2 - width / 2
  left = Math.max(margin, Math.min(left, overlayW - width - margin))
  let top = hole.top + hole.height + 12
  if (top + CARD_EST_H > overlayH - margin) {
    top = Math.max(margin, hole.top - 12 - CARD_EST_H)
  }
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
  step: MemoryCoachStep
  isFirst: boolean
  isLast: boolean
  onSkip: () => void
  onStepChange: (index: number) => void
  onComplete: (opts?: { openTutorial?: boolean }) => void
}) {
  return (
    <>
      <p className="text-[10px] font-medium tracking-[0.22em] uppercase text-gray-400">
        引导 {stepIndex + 1} / {total}
      </p>
      <p id="memory-coach-step-title" className="mt-2 text-[15px] font-semibold tracking-tight text-gray-900">
        {step.title}
      </p>
      <p className="mt-2 text-[13px] leading-[1.75] text-gray-600" style={{ fontFamily: ARCHIVE_SERIF }}>
        {step.body}
      </p>
      <div className="mt-5 flex flex-col gap-2">
        {step.isOutro ? (
          <>
            <Pressable
              type="button"
              onClick={() => onComplete({ openTutorial: true })}
              className="w-full rounded-full bg-gray-900 py-3 text-[13px] font-semibold tracking-wide text-white active:opacity-90"
            >
              打开文字说明
            </Pressable>
            <Pressable
              type="button"
              onClick={() => onComplete()}
              className="w-full rounded-full bg-gray-100 py-3 text-[13px] font-medium text-gray-700 active:bg-gray-200/80"
            >
              开始使用
            </Pressable>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <Pressable
                type="button"
                onClick={onSkip}
                className="flex-1 rounded-full bg-gray-100 py-3 text-[13px] font-medium text-gray-500 active:bg-gray-200/80"
              >
                跳过
              </Pressable>
              <Pressable
                type="button"
                onClick={() => {
                  if (isLast) onComplete()
                  else onStepChange(stepIndex + 1)
                }}
                className="min-w-0 flex-[1.4] rounded-full bg-gray-900 py-3 text-[13px] font-semibold tracking-wide text-white active:opacity-90"
              >
                {isLast ? '完成' : '下一步'}
              </Pressable>
            </div>
            {!isFirst ? (
              <Pressable
                type="button"
                onClick={() => onStepChange(stepIndex - 1)}
                className="w-full py-1 text-center text-[12px] text-gray-400"
              >
                上一步
              </Pressable>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}

export function MemoryCoachPortal({
  open,
  steps,
  stepIndex,
  onStepChange,
  onSkip,
  onComplete,
  onBeforeStep,
  scopeRoot,
  layoutEpoch,
  zIndex = 61000,
}: {
  open: boolean
  steps: MemoryCoachStep[]
  stepIndex: number
  onStepChange: (index: number) => void
  onSkip: () => void
  onComplete: (opts?: { openTutorial?: boolean }) => void
  /** 切换步骤前（例如编辑面板切 Tab） */
  onBeforeStep?: (step: MemoryCoachStep, index: number) => void
  /** 限定查找范围，如 memory-editor / memory-archive */
  scopeRoot?: string
  /** Tab 切换等触发布局后再测量 */
  layoutEpoch?: string | number
  zIndex?: number
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const step = steps[stepIndex]
  const total = steps.length
  const [hole, setHole] = useState<HoleRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const remeasure = useCallback(() => {
    const overlay = overlayRef.current
    if (!open || !step || !overlay) {
      setHole(null)
      setTooltipPos(null)
      return
    }
    if (step.centered) {
      setHole(null)
      setTooltipPos(null)
      return
    }
    if (step.target) {
      findCoachTargetNode(scopeRoot, step.target)?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'instant',
      })
    }
    const measure = () => {
      const o = overlayRef.current
      if (!o || !step.target) {
        setHole(null)
        setTooltipPos(null)
        return
      }
      const nextHole = measureTargetInOverlay(step.target, o, scopeRoot)
      const or = o.getBoundingClientRect()
      setHole(nextHole)
      setTooltipPos(nextHole ? layoutTooltipCard(nextHole, or.width, or.height) : null)
    }
    scheduleCoachRemeasure(measure)
  }, [open, step, scopeRoot])

  useLayoutEffect(() => {
    if (open && step) onBeforeStep?.(step, stepIndex)
  }, [open, step, stepIndex, onBeforeStep])

  useEffect(() => {
    if (!open || !step) return
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
          ref={overlayRef}
          key="memory-coach"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-coach-step-title"
          className="fixed inset-0 overflow-hidden"
          style={{ zIndex }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Pressable
            type="button"
            className="absolute inset-0 h-full w-full cursor-default border-0 bg-transparent p-0"
            aria-label="跳过引导"
            onClick={onSkip}
          />

          {showHole && hole ? (
            <motion.div
              className="pointer-events-none absolute z-[1] ring-2 ring-gray-900/90"
              style={{
                top: hole.top,
                left: hole.left,
                width: hole.width,
                height: hole.height,
                borderRadius: RADIUS,
                boxShadow: '0 0 0 9999px rgba(17,24,39,0.52), 0 0 24px rgba(17,24,39,0.12)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.22 }}
              aria-hidden
            />
          ) : (
            <motion.div className="pointer-events-none absolute inset-0 bg-gray-900/52" aria-hidden />
          )}

          {step.centered ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-5">
              <motion.div
                className="pointer-events-auto w-full max-w-[min(340px,calc(100%-24px))]"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="rounded-[24px] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
                  <CoachCardBody {...cardProps} />
                </div>
              </motion.div>
            </div>
          ) : tooltipPos ? (
            <motion.div
              className="pointer-events-auto absolute z-10 rounded-[24px] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
              style={{
                top: tooltipPos.top,
                left: tooltipPos.left,
                width: tooltipPos.width,
                maxWidth: 'calc(100% - 28px)',
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
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-5">
              <motion.div
                className="pointer-events-auto w-full max-w-[min(340px,calc(100%-24px))]"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="rounded-[24px] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
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
