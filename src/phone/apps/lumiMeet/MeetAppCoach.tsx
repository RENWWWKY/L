import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pressable } from '../../components/Pressable'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import type { MeetTab } from './meetAppTabs'
import {
  MEET_APP_COACH_STEPS,
  meetAppCoachScopedTargetSelector,
  type MeetAppCoachStep,
  type MeetAppCoachTargetId,
} from './meetAppCoachSteps'
import { MeetTutorialHighlightText } from './meetTutorialHighlight'

const SCOPE_ROOT = 'meet-app'
const PAD = 10
const RADIUS = 14
const CARD_MAX_W = 340
const CARD_EST_H = 260

type HoleRect = { top: number; left: number; width: number; height: number }

function findCoachTargetNode(target: MeetAppCoachTargetId): Element | null {
  return document.querySelector(meetAppCoachScopedTargetSelector(SCOPE_ROOT, target))
}

function measureTargetInOverlay(target: MeetAppCoachTargetId, overlayEl: HTMLElement): HoleRect | null {
  const node = findCoachTargetNode(target)
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

function scheduleCoachRemeasure(run: () => void, extraDelaysMs: number[] = []) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      run()
      window.setTimeout(run, 120)
      window.setTimeout(run, 280)
      for (const ms of extraDelaysMs) window.setTimeout(run, ms)
    })
  })
}

function coachScrollBlock(target: MeetAppCoachStep['target']): ScrollLogicalPosition {
  if (target === 'profile-contact-bindings' || target === 'archive-summary-progress') return 'center'
  return 'nearest'
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
  step: MeetAppCoachStep
  isFirst: boolean
  isLast: boolean
  onSkip: () => void
  onStepChange: (index: number) => void
  onComplete: (opts?: { openTutorial?: boolean }) => void
}) {
  return (
    <>
      <p className="meet-caption-en text-[10px] uppercase tracking-[0.22em] text-[#b8b5ad]">
        引导 {stepIndex + 1} / {total}
      </p>
      <p id="meet-app-coach-step-title" className="mt-2 font-elegant-serif text-[16px] tracking-[0.04em] text-[#2c2a26]">
        {step.title}
      </p>
      <p className="mt-2 font-dossier-serif text-[13px] leading-[1.75] tracking-[0.03em] text-[#5b574f]">
        <MeetTutorialHighlightText text={step.body} />
      </p>
      <div className="mt-5 flex flex-col gap-2">
        {step.isOutro ? (
          <>
            <Pressable
              type="button"
              onClick={() => onComplete({ openTutorial: true })}
              className="meet-btn-primary w-full py-3 text-[13px]"
            >
              打开文字说明
            </Pressable>
            <Pressable
              type="button"
              onClick={() => onComplete()}
              className="meet-btn-secondary w-full py-3 text-[13px]"
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
                className="meet-btn-secondary flex-1 py-3 text-[13px]"
              >
                跳过
              </Pressable>
              <Pressable
                type="button"
                onClick={() => {
                  if (isLast) onComplete()
                  else onStepChange(stepIndex + 1)
                }}
                className="meet-btn-primary min-w-0 flex-[1.4] py-3 text-[13px]"
              >
                {isLast ? '完成' : '下一步'}
              </Pressable>
            </div>
            {!isFirst ? (
              <Pressable
                type="button"
                onClick={() => onStepChange(stepIndex - 1)}
                className="w-full py-1 text-center text-[12px] text-[#9a9590]"
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

export type MeetAppCoachPortalProps = {
  open: boolean
  stepIndex: number
  onStepChange: (index: number) => void
  onSkip: () => void
  onComplete: (opts?: { openTutorial?: boolean }) => void
  onBeforeStep?: (step: MeetAppCoachStep, index: number) => void
  layoutEpoch?: string | number
}

export function MeetAppCoachPortal({
  open,
  stepIndex,
  onStepChange,
  onSkip,
  onComplete,
  onBeforeStep,
  layoutEpoch,
}: MeetAppCoachPortalProps) {
  const portalEl = getLumiMeetPortalTarget()
  const overlayRef = useRef<HTMLDivElement>(null)
  const step = MEET_APP_COACH_STEPS[stepIndex]
  const total = MEET_APP_COACH_STEPS.length
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
      findCoachTargetNode(step.target)?.scrollIntoView({
        block: coachScrollBlock(step.target),
        inline: 'nearest',
        behavior: 'instant',
      })
    }
    const extraDelays = step.profileTab || step.archiveTab ? [420, 560, 760] : []
    const measure = () => {
      const o = overlayRef.current
      if (!o || !step.target) {
        setHole(null)
        setTooltipPos(null)
        return
      }
      const nextHole = measureTargetInOverlay(step.target, o)
      const or = o.getBoundingClientRect()
      setHole(nextHole)
      setTooltipPos(nextHole ? layoutTooltipCard(nextHole, or.width, or.height) : null)
    }
    scheduleCoachRemeasure(measure, extraDelays)
  }, [open, step])

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

  if (!portalEl || !step) return null

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
          key="meet-app-coach"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meet-app-coach-step-title"
          className="fixed inset-0 z-[390] overflow-hidden"
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
              className="pointer-events-none absolute border-2 border-[#D4AF37]"
              style={{
                top: hole.top,
                left: hole.left,
                width: hole.width,
                height: hole.height,
                borderRadius: RADIUS,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.56), 0 0 28px rgba(212,175,55,0.35)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.22 }}
              aria-hidden
            />
          ) : (
            <motion.div className="pointer-events-none absolute inset-0 bg-black/56" aria-hidden />
          )}

          {step.centered ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-5">
              <motion.div
                className="pointer-events-auto w-full max-w-[min(340px,calc(100%-24px))]"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="rounded-[16px] border-[0.5px] border-[#e8e4dc] bg-[#fdfcfa] p-5 shadow-[0_20px_60px_rgba(22,18,14,0.2)]">
                  <CoachCardBody {...cardProps} />
                </div>
              </motion.div>
            </div>
          ) : tooltipPos ? (
            <motion.div
              className="pointer-events-auto absolute z-10 rounded-[16px] border-[0.5px] border-[#e8e4dc] bg-[#fdfcfa] p-5 shadow-[0_20px_60px_rgba(22,18,14,0.2)]"
              style={{
                top: tooltipPos.top,
                left: tooltipPos.left,
                width: tooltipPos.width,
                maxWidth: 'calc(100% - 28px)',
              }}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
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
                <div className="rounded-[16px] border-[0.5px] border-[#e8e4dc] bg-[#fdfcfa] p-5 shadow-[0_20px_60px_rgba(22,18,14,0.2)]">
                  <CoachCardBody {...cardProps} />
                </div>
              </motion.div>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalEl,
  )
}
