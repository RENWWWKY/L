import {
  motion,
  useAnimationControls,
  type AnimationDefinition,
  type Transition,
} from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { JBSClue } from './jbsFlowTypes'
import { useJBSFlow } from './JBSFlowEngine'
import { CLUE_FLIP_PERSPECTIVE, CLUE_FLIP_SPRING } from './clueCardMotion'
import { playJbsClueCardFlipSfx } from '../jbsClueCardSfx'

export type ClueCollectorProps = {
  clue: JBSClue
  collectTargetRef: React.RefObject<HTMLElement | null>
  onCollectComplete: (clueId: string) => void
}

type CardPhase = 'dealing' | 'back' | 'flipping' | 'front' | 'collecting' | 'done'

const DEAL_SPRING = { type: 'spring' as const, stiffness: 120, damping: 14 }
const COLLECT_TRANSITION: Transition = { duration: 0.6, ease: [0.25, 1, 0.5, 1] }

function CompassBadge() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="jbs-clue-collector-compass h-14 w-14"
      aria-hidden
    >
      <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="0.5" />
      <circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" strokeWidth="0.35" opacity="0.7" />
      <path
        d="M32 10 L36 32 L32 54 L28 32 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.6"
      />
      <path
        d="M10 32 L32 28 L54 32 L32 36 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.85"
      />
      <circle cx="32" cy="32" r="2.5" fill="currentColor" opacity="0.9" />
    </svg>
  )
}

export function ClueCollector({ clue, collectTargetRef, onCollectComplete }: ClueCollectorProps) {
  const { locked } = useJBSFlow()
  const scriptId = locked.script.id
  const [phase, setPhase] = useState<CardPhase>('dealing')
  const cardRef = useRef<HTMLButtonElement>(null)
  const controls = useAnimationControls()
  const completedRef = useRef(false)
  const flippingRef = useRef(false)

  const isFlipped = phase === 'flipping' || phase === 'front' || phase === 'collecting'

  const finishCollect = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    setPhase('done')
    onCollectComplete(clue.id)
  }, [clue.id, onCollectComplete])

  const resolveFlyOffset = useCallback(() => {
    const btn = collectTargetRef.current
    const card = cardRef.current
    if (!btn || !card) {
      return { x: window.innerWidth * 0.32, y: window.innerHeight * 0.38 }
    }
    const br = btn.getBoundingClientRect()
    const cr = card.getBoundingClientRect()
    return {
      x: br.left + br.width / 2 - (cr.left + cr.width / 2),
      y: br.top + br.height / 2 - (cr.top + cr.height / 2),
    }
  }, [collectTargetRef])

  const runCollectFlight = useCallback(async () => {
    const offset = resolveFlyOffset()
    setPhase('collecting')
    await controls.start({
      x: offset.x,
      y: offset.y,
      scale: 0.05,
      rotateZ: 180,
      opacity: 0,
      transition: COLLECT_TRANSITION,
    } satisfies AnimationDefinition)
    finishCollect()
  }, [controls, finishCollect, resolveFlyOffset])

  const startFlip = useCallback(async () => {
    flippingRef.current = true
    setPhase('flipping')
    await controls.start({
      scale: 0.94,
      transition: { duration: 0.1, ease: [0.4, 0, 0.2, 1] },
    })
  }, [controls])

  const handleFlipComplete = useCallback(() => {
    if (!flippingRef.current || phase !== 'flipping') return
    flippingRef.current = false
    setPhase('front')
    void controls.start({
      scale: 1,
      transition: CLUE_FLIP_SPRING,
    })
  }, [controls, phase])

  const handleCardClick = useCallback(() => {
    if (phase === 'dealing' || phase === 'flipping' || phase === 'collecting' || phase === 'done') {
      return
    }

    if (phase === 'back') {
      playJbsClueCardFlipSfx(scriptId)
      void startFlip()
      return
    }

    if (phase === 'front') {
      void runCollectFlight()
    }
  }, [phase, runCollectFlight, scriptId, startFlip])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      controls.set({
        y: -400,
        x: -100,
        rotateY: 0,
        rotateZ: -45,
        scale: 0.4,
        opacity: 0,
      })
      await controls.start({
        y: 0,
        x: 0,
        rotateY: 0,
        rotateZ: 0,
        scale: 1,
        opacity: 1,
        transition: DEAL_SPRING,
      })
      if (!cancelled) setPhase('back')
    })()
    return () => {
      cancelled = true
    }
  }, [controls])

  const showHint = phase === 'back'

  if (phase === 'done') return null

  return (
    <div
      className="jbs-clue-collector-scrim fixed inset-0 z-[72] flex items-center justify-center"
      style={{ perspective: CLUE_FLIP_PERSPECTIVE }}
      aria-live="polite"
      aria-label={`线索卡牌：${clue.title}`}
    >
      <motion.p
        className="jbs-clue-collector-hint jbs-font-serif pointer-events-none absolute top-[max(18%,120px)] text-center text-[9px] tracking-[0.22em]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: showHint ? 1 : 0, y: showHint ? 0 : 8 }}
        transition={{ duration: 0.35 }}
      >
        TAP TO UNVEIL | 点击收集线索
      </motion.p>

      <motion.button
        ref={cardRef}
        type="button"
        className="jbs-clue-collector-card relative aspect-[3/4] w-36 cursor-pointer border-0 bg-transparent p-0 focus:outline-none"
        style={{ transformStyle: 'preserve-3d' }}
        animate={controls}
        onClick={handleCardClick}
        aria-label={phase === 'front' ? `收纳线索：${clue.title}` : `揭开线索：${clue.title}`}
      >
        <motion.div
          className="jbs-clue-flip-inner relative h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
          initial={false}
          animate={{
            rotateY: isFlipped ? 180 : 0,
            rotateX: phase === 'flipping' ? [0, -6, 0] : 0,
          }}
          transition={
            phase === 'flipping'
              ? {
                  rotateY: CLUE_FLIP_SPRING,
                  rotateX: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                }
              : phase === 'front' || phase === 'collecting'
                ? { rotateY: CLUE_FLIP_SPRING, rotateX: { duration: 0.2 } }
                : { duration: 0 }
          }
          onAnimationComplete={() => {
            if (phase === 'flipping') handleFlipComplete()
          }}
        >
          <div
            className="jbs-clue-collector-face jbs-clue-collector-face--back absolute inset-0 flex flex-col items-center justify-center rounded-xl"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            <div className="jbs-clue-collector-glow" aria-hidden />
            <CompassBadge />
            <span className="jbs-font-serif mt-4 text-[8px] tracking-[0.28em] text-white/35">
              EVIDENCE
            </span>
          </div>

          <div
            className="jbs-clue-collector-face jbs-clue-collector-face--front absolute inset-0 flex flex-col overflow-hidden rounded-xl"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <motion.img
              src={clue.imageUrl}
              alt=""
              className="h-[68%] w-full object-cover"
              initial={false}
              animate={{ opacity: isFlipped ? 1 : 0 }}
              transition={{ delay: isFlipped ? 0.22 : 0, duration: 0.35 }}
            />
            <motion.div
              className="jbs-clue-collector-front-caption flex min-h-[32%] flex-1 flex-col justify-center px-3 py-2"
              initial={false}
              animate={{ opacity: isFlipped ? 1 : 0, y: isFlipped ? 0 : 6 }}
              transition={{ delay: isFlipped ? 0.28 : 0, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="jbs-font-serif text-center text-[12px] leading-snug tracking-wide text-[#3d2e24]/90">
                {clue.title}
              </p>
              <p className="jbs-font-serif mt-1 text-center text-[9px] tracking-[0.18em] text-[#5c3d2e]/55">
                TAP TO ARCHIVE | 再次点击收纳
              </p>
            </motion.div>
          </div>
        </motion.div>
      </motion.button>
    </div>
  )
}
