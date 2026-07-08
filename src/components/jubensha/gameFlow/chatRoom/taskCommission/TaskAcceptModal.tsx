import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'

import {
  TASK_COMMISSION_LAYOUT_ID,
  type ActiveCommission,
} from './taskCommissionTypes'
import { useTaskStore } from './useTaskStore'

import './jbs-task-commission.css'

type RitualPhase = 'landing' | 'seal-break' | 'unfold' | 'typing' | 'ready' | 'departing'

const ENVELOPE_CLOSED_HEIGHT = 248
const UNFOLD_HEIGHT = 420

function padTaskIndex(n: number): string {
  return String(n + 1).padStart(2, '0')
}

function TypewriterGlyph({ char, index }: { char: string; index: number }) {
  return (
    <motion.span
      className="jbs-task-type-glyph"
      initial={{ opacity: 0, filter: 'blur(6px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.12, delay: index * 0.012, ease: [0.22, 1, 0.36, 1] }}
    >
      {char}
    </motion.span>
  )
}

function TypewriterBlock({
  text,
  visibleChars,
  className,
}: {
  text: string
  visibleChars: number
  className?: string
}) {
  const slice = text.slice(0, visibleChars)
  return (
    <p className={className}>
      {slice.split('').map((ch, i) => (
        <TypewriterGlyph key={`${i}-${ch}`} char={ch} index={i} />
      ))}
      {visibleChars < text.length ? (
        <motion.span
          className="jbs-task-type-caret"
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 0.85, repeat: Infinity }}
          aria-hidden
        >
          |
        </motion.span>
      ) : null}
    </p>
  )
}

function WaxSeal({ onBreak, breaking }: { onBreak: () => void; breaking: boolean }) {
  return (
    <div className="jbs-task-wax-seal-wrap" aria-hidden={breaking}>
      <AnimatePresence>
        {!breaking ? (
          <motion.button
            type="button"
            key="seal-intact"
            className="jbs-task-wax-seal"
            onClick={onBreak}
            initial={{ scale: 0.88, opacity: 0, y: -8 }}
            animate={{
              scale: 1,
              opacity: 1,
              y: [0, -3, 0],
            }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{
              scale: { type: 'spring', stiffness: 260, damping: 18 },
              y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
            }}
            aria-label="拆开火漆封印"
          >
            <span className="jbs-task-wax-seal-ring" />
            <svg className="jbs-task-wax-seal-emblem" viewBox="0 0 40 40" fill="none">
              <polygon
                points="20,6 32,14 32,26 20,34 8,26 8,14"
                stroke="rgba(255,240,230,0.55)"
                strokeWidth="1.2"
              />
              <circle cx="20" cy="20" r="4" stroke="rgba(255,240,230,0.45)" strokeWidth="1" />
            </svg>
          </motion.button>
        ) : (
          <>
            <motion.span
              key="seal-left"
              className="jbs-task-wax-fragment jbs-task-wax-fragment--left"
              initial={{ x: 0, rotate: 0, opacity: 1 }}
              animate={{ x: -28, rotate: -22, opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.32, 0, 0.67, 0] }}
            />
            <motion.span
              key="seal-right"
              className="jbs-task-wax-fragment jbs-task-wax-fragment--right"
              initial={{ x: 0, rotate: 0, opacity: 1 }}
              animate={{ x: 28, rotate: 22, opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.32, 0, 0.67, 0] }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function useRitualTypewriter(
  commission: ActiveCommission | null,
  phase: RitualPhase,
) {
  const lines = useMemo(() => {
    if (!commission) return []
    const taskLines = commission.tasks.map(
      (t, i) => `${padTaskIndex(i)}. ${t.text}`,
    )
    return [commission.title, ...taskLines]
  }, [commission])

  const [lineIndex, setLineIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [typingDone, setTypingDone] = useState(false)

  useEffect(() => {
    if (phase !== 'typing') return
    if (lineIndex >= lines.length) {
      setTypingDone(true)
      return
    }
    const line = lines[lineIndex] ?? ''
    if (charIndex >= line.length) {
      const pause = window.setTimeout(() => {
        setLineIndex((i) => i + 1)
        setCharIndex(0)
      }, lineIndex === 0 ? 420 : 320)
      return () => window.clearTimeout(pause)
    }
    const tick = window.setTimeout(() => setCharIndex((c) => c + 1), 28)
    return () => window.clearTimeout(tick)
  }, [phase, lineIndex, charIndex, lines])

  useEffect(() => {
    if (phase === 'typing') {
      setLineIndex(0)
      setCharIndex(0)
      setTypingDone(false)
    }
  }, [phase])

  useEffect(() => {
    if (typingDone && phase === 'typing') {
      const t = window.setTimeout(() => {
        /* parent listens via typingDone */
      }, 0)
      return () => window.clearTimeout(t)
    }
  }, [typingDone, phase])

  return { lines, lineIndex, charIndex, typingDone }
}

export function TaskAcceptModal() {
  const { commission, modalOpen, sealAndProceed } = useTaskStore()
  const reduceMotion = useReducedMotion()
  const [phase, setPhase] = useState<RitualPhase>('landing')

  const { lines, lineIndex, charIndex, typingDone } = useRitualTypewriter(
    commission,
    phase,
  )

  useEffect(() => {
    if (!modalOpen) {
      setPhase('landing')
    }
  }, [modalOpen])

  useEffect(() => {
    if (phase === 'typing' && typingDone) {
      const t = window.setTimeout(() => setPhase('ready'), 480)
      return () => window.clearTimeout(t)
    }
  }, [phase, typingDone])

  const handleSealBreak = useCallback(() => {
    setPhase('seal-break')
    window.setTimeout(() => setPhase('unfold'), reduceMotion ? 80 : 620)
    window.setTimeout(() => setPhase('typing'), reduceMotion ? 160 : 1180)
  }, [reduceMotion])

  const handleDepart = useCallback(() => {
    setPhase('departing')
    window.setTimeout(() => sealAndProceed(), reduceMotion ? 120 : 920)
  }, [reduceMotion, sealAndProceed])

  if (!commission) return null

  const unfolded = phase === 'unfold' || phase === 'typing' || phase === 'ready' || phase === 'departing'
  const showContent = phase === 'typing' || phase === 'ready' || phase === 'departing'

  const departStyle: CSSProperties | undefined =
    phase === 'departing'
      ? {
          position: 'fixed',
          right: 'max(16px, env(safe-area-inset-right))',
          top: '33%',
          transform: 'translateY(-50%)',
        }
      : undefined

  return (
    <AnimatePresence>
      {modalOpen ? (
        <motion.div
          key="task-accept-overlay"
          className="jbs-task-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
        >
          <motion.div
            className="jbs-task-modal-backdrop"
            initial={{ backdropFilter: 'blur(0px)' }}
            animate={{ backdropFilter: 'blur(24px)' }}
          />

          <motion.div
            className="jbs-task-modal-stage"
            initial={{ opacity: 0, y: 24 }}
            animate={{
              opacity: phase === 'departing' ? 0 : 1,
              y: phase === 'departing' ? 120 : 0,
              scale: phase === 'departing' ? 0.08 : 1,
            }}
            transition={{
              duration: phase === 'departing' ? 0.88 : 0.65,
              ease: phase === 'departing' ? [0.55, 0, 0.85, 0.36] : [0.22, 1, 0.36, 1],
            }}
            style={departStyle}
          >
            <motion.div
              layoutId={TASK_COMMISSION_LAYOUT_ID}
              className={`jbs-task-envelope${unfolded ? ' jbs-task-envelope--open' : ''}`}
              animate={{
                height: unfolded ? UNFOLD_HEIGHT : ENVELOPE_CLOSED_HEIGHT,
              }}
              transition={{ type: 'spring', stiffness: 180, damping: 26 }}
            >
              <div className="jbs-task-envelope-fold" aria-hidden />
              {!unfolded ? (
                <div className="jbs-task-envelope-closed-mark jbs-font-serif" aria-hidden>
                  <span className="jbs-task-envelope-closed-kicker">CLASSIFIED</span>
                  <span className="jbs-task-envelope-closed-title">本幕密函</span>
                  <span className="jbs-task-envelope-closed-hint">点击火漆拆封</span>
                </div>
              ) : null}
              {(phase === 'landing' || phase === 'seal-break') ? (
                <WaxSeal onBreak={handleSealBreak} breaking={phase === 'seal-break'} />
              ) : null}

              <AnimatePresence>
                {showContent ? (
                  <motion.div
                    key="letter-body"
                    className="jbs-task-letter-body"
                    initial={{ opacity: 0, scaleY: 0.92 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="jbs-task-letter-scroll">
                      {lines.map((line, i) => {
                        if (i > lineIndex) return null
                        const isTitle = i === 0
                        const visible =
                          i < lineIndex ? line.length : i === lineIndex ? charIndex : 0
                        if (visible <= 0 && i > 0) return null
                        return (
                          <TypewriterBlock
                            key={line}
                            text={line}
                            visibleChars={visible}
                            className={
                              isTitle
                                ? 'jbs-task-letter-title jbs-font-serif'
                                : 'jbs-task-letter-task jbs-font-serif'
                            }
                          />
                        )
                      })}
                    </div>

                    <AnimatePresence>
                      {phase === 'ready' ? (
                        <motion.button
                          type="button"
                          key="seal-proceed"
                          className="jbs-task-seal-proceed-btn jbs-font-serif"
                          onClick={handleDepart}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: 0.12, duration: 0.45 }}
                        >
                          <span className="jbs-task-seal-proceed-label">确认并出发</span>
                          <span className="jbs-task-seal-proceed-sub">Seal &amp; Proceed</span>
                        </motion.button>
                      ) : null}
                    </AnimatePresence>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
