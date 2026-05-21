import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pressable } from '../../components/Pressable'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import {
  MEET_ENCOUNTER_COACH_STEPS,
  meetCoachTargetSelector,
  type MeetCoachStep,
  type MeetCoachTargetId,
} from './meetEncounterCoachSteps'
import { MeetTutorialHighlightText } from './meetTutorialHighlight'

const PAD = 10
const RADIUS = 14
const CARD_MAX_W = 340
const CARD_EST_H = 240

type HoleRect = { top: number; left: number; width: number; height: number }

function measureTargetInOverlay(target: MeetCoachTargetId, overlayEl: HTMLElement): HoleRect | null {
  const node = document.querySelector(meetCoachTargetSelector(target))
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

export type MeetEncounterChatCoachProps = {
  open: boolean
  stepIndex: number
  onStepChange: (index: number) => void
  onSkip: () => void
  onComplete: (opts?: { openTutorial?: boolean }) => void
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
  step: MeetCoachStep
  isFirst: boolean
  isLast: boolean
  onSkip: () => void
  onStepChange: (index: number) => void
  onComplete: (opts?: { openTutorial?: boolean }) => void
}) {
  return (
    <>
      <p className="text-[10px] tracking-[0.14em] text-[#b8973a]">
        引导 {stepIndex + 1} / {total}
      </p>
      <p id="meet-coach-step-title" className="mt-2 text-[15px] font-medium tracking-[0.06em] text-[#2c2a26]">
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
              className="w-full rounded-full border-[0.5px] border-[#1a1918] bg-[#141312] py-3 text-[13px] tracking-[0.08em] text-[#f7f4ef] active:opacity-90"
            >
              打开聊天说明
            </Pressable>
            <Pressable
              type="button"
              onClick={() => onComplete()}
              className="w-full rounded-full border border-[#e8e4dc] bg-[#f7f5f2] py-3 text-[13px] tracking-[0.06em] text-[#6e6860] active:bg-[#f0ebe3]"
            >
              开始聊天
            </Pressable>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <Pressable
                type="button"
                onClick={onSkip}
                className="flex-1 rounded-full border border-[#e8e4dc] bg-white py-3 text-[13px] tracking-[0.06em] text-[#9a9590] active:bg-[#f7f5f2]"
              >
                跳过
              </Pressable>
              <Pressable
                type="button"
                onClick={() => {
                  if (isLast) onComplete()
                  else onStepChange(stepIndex + 1)
                }}
                className="min-w-0 flex-[1.4] rounded-full border-[0.5px] border-[#1a1918] bg-[#141312] py-3 text-[13px] tracking-[0.08em] text-[#f7f4ef] active:opacity-90"
              >
                {isLast ? '完成' : '下一步'}
              </Pressable>
            </div>
            {!isFirst ? (
              <Pressable
                type="button"
                onClick={() => onStepChange(stepIndex - 1)}
                className="w-full py-1 text-center text-[12px] tracking-[0.04em] text-[#9a9590]"
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

export function MeetEncounterChatCoachPortal({
  open,
  stepIndex,
  onStepChange,
  onSkip,
  onComplete,
}: MeetEncounterChatCoachProps) {
  const portalEl = getLumiMeetPortalTarget()
  const overlayRef = useRef<HTMLDivElement>(null)
  const step: MeetCoachStep | undefined = MEET_ENCOUNTER_COACH_STEPS[stepIndex]
  const total = MEET_ENCOUNTER_COACH_STEPS.length
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
      document.querySelector(meetCoachTargetSelector(step.target))?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'instant',
      })
    }
    requestAnimationFrame(() => {
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
    })
  }, [open, step])

  useLayoutEffect(() => {
    remeasure()
  }, [remeasure, stepIndex])

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
          key="meet-encounter-coach"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meet-coach-step-title"
          className="fixed inset-0 z-[380] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Pressable
            type="button"
            className="absolute inset-0 h-full w-full cursor-default border-0 bg-transparent p-0"
            aria-label="跳过引导"
            onClick={onSkip}
          >
            <span className="sr-only">跳过引导</span>
          </Pressable>

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
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
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
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <CoachCardBody {...cardProps} />
            </motion.div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalEl,
  )
}
