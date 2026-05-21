import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

type TrailPhase = 'idle' | 'drawing' | 'wandering' | 'reveal' | 'ripple'

type Props = {
  scanning: boolean
  /** 匹配结果已就绪、档案揭幕前：播放交汇与光晕 */
  revealBurst: boolean
  /** 视口内画布边长 px */
  size?: number
}

/** 档案卡与涟漪对齐的揭幕延迟（秒），供外层 `motion` 同步 */
export const MEET_THREADS_CARD_EMERGE_DELAY_S = 0.38

const VIEW = 200
const CX = 100
const CY = 108

const PATH_GRAY_WANDER_A = `M 10 158 C 44 22, 78 182, 188 78`
const PATH_GRAY_WANDER_B = `M 22 142 C 56 88, 118 162, 176 92`
const PATH_GOLD_WANDER_A = `M 190 48 C 156 168, 68 48, 14 152`
const PATH_GOLD_WANDER_B = `M 178 62 C 124 150, 52 72, 26 138`

const PATH_GRAY_MEET = `M 14 168 C 54 128, 82 112, ${CX} ${CY}`
const PATH_GOLD_MEET = `M 186 52 C 146 90, 118 104, ${CX} ${CY}`

const DOT_GRAY_A = { cx: 188, cy: 78 }
const DOT_GRAY_B = { cx: 176, cy: 92 }
const DOT_GOLD_A = { cx: 14, cy: 152 }
const DOT_GOLD_B = { cx: 26, cy: 138 }

const WANDER_MIRROR = { duration: 4, repeat: Number.POSITIVE_INFINITY, repeatType: 'mirror' as const, ease: 'easeInOut' }

export function ThreadsOfDestiny({ scanning, revealBurst, size = 248 }: Props) {
  const [phase, setPhase] = useState<TrailPhase>('idle')
  const [showRipple, setShowRipple] = useState(false)
  const [lineVanish, setLineVanish] = useState(false)
  const [pathEpoch, setPathEpoch] = useState(0)
  const drawTimerRef = useRef<number | null>(null)
  const revealTimersRef = useRef<number[]>([])
  const rippleClearRef = useRef<number | null>(null)
  const prevScanningRef = useRef(false)

  const clearDrawTimer = () => {
    if (drawTimerRef.current != null) {
      window.clearTimeout(drawTimerRef.current)
      drawTimerRef.current = null
    }
  }

  const clearRevealTimers = () => {
    for (const t of revealTimersRef.current) window.clearTimeout(t)
    revealTimersRef.current = []
  }

  const clearRippleTimer = () => {
    if (rippleClearRef.current != null) {
      window.clearTimeout(rippleClearRef.current)
      rippleClearRef.current = null
    }
  }

  useEffect(() => {
    if (revealBurst) {
      clearDrawTimer()
      clearRevealTimers()
      setLineVanish(false)
      setShowRipple(false)
      setPhase('reveal')
      const tVanish = window.setTimeout(() => setLineVanish(true), 440)
      const tRipple = window.setTimeout(() => {
        setShowRipple(true)
        setPhase('ripple')
      }, 520)
      revealTimersRef.current = [tVanish, tRipple]
      return () => clearRevealTimers()
    }

    if (scanning) {
      if (!prevScanningRef.current) {
        setPathEpoch((e) => e + 1)
      }
      setPhase('drawing')
      setLineVanish(false)
      clearDrawTimer()
      drawTimerRef.current = window.setTimeout(() => {
        setPhase((p) => (p === 'reveal' || p === 'ripple' ? p : 'wandering'))
      }, 2400)
      prevScanningRef.current = true
      return () => clearDrawTimer()
    }

    prevScanningRef.current = false
    clearDrawTimer()
    clearRevealTimers()
    setLineVanish(false)
    setShowRipple(false)
    setPhase('idle')
    return undefined
  }, [scanning, revealBurst])

  useEffect(() => {
    if (!showRipple) return
    clearRippleTimer()
    rippleClearRef.current = window.setTimeout(() => {
      setShowRipple(false)
    }, 1200)
    return () => clearRippleTimer()
  }, [showRipple])

  const visible = scanning || revealBurst || phase === 'ripple'
  const wandering = phase === 'wandering'
  const drawing = phase === 'drawing'
  const inReveal = phase === 'reveal' || phase === 'ripple'
  const linesLit = inReveal ? !lineVanish : scanning || false

  const pathCommon = {
    strokeLinecap: 'round' as const,
    fill: 'none' as const,
  }

  return (
    <>
      <div
        className="relative flex flex-col items-center justify-center"
        style={{ width: size, height: size }}
        aria-hidden={visible ? undefined : true}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          fill="none"
          className={visible ? 'opacity-100' : 'opacity-0'}
          style={{ transition: 'opacity 0.45s ease' }}
        >
          <defs>
            <filter id="meet-thread-gold-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <motion.path
            key={`g-${pathEpoch}`}
            {...pathCommon}
            stroke="#e7e5e2"
            strokeWidth={0.55}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={
              inReveal
                ? {
                    d: PATH_GRAY_MEET,
                    pathLength: 1,
                    opacity: linesLit ? 1 : 0,
                  }
                : wandering
                  ? { d: [PATH_GRAY_WANDER_A, PATH_GRAY_WANDER_B], pathLength: 1, opacity: 1 }
                  : drawing
                    ? { d: PATH_GRAY_WANDER_A, pathLength: 1, opacity: 1 }
                    : { d: PATH_GRAY_WANDER_A, pathLength: 0, opacity: 0 }
            }
            transition={
              inReveal
                ? {
                    d: { duration: 0.52, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.16, ease: 'easeOut' },
                  }
                : wandering
                  ? { d: WANDER_MIRROR, pathLength: { duration: 0.01 }, opacity: { duration: 0.35 } }
                  : drawing
                    ? { pathLength: { duration: 2.35, ease: [0.22, 1, 0.36, 1] }, d: { duration: 0.01 }, opacity: { duration: 0.35 } }
                    : { duration: 0.4 }
            }
          />

          <motion.path
            key={`u-${pathEpoch}`}
            {...pathCommon}
            stroke="#D4AF37"
            strokeWidth={0.72}
            filter="url(#meet-thread-gold-glow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={
              inReveal
                ? {
                    d: PATH_GOLD_MEET,
                    pathLength: 1,
                    opacity: linesLit ? 1 : 0,
                  }
                : wandering
                  ? { d: [PATH_GOLD_WANDER_A, PATH_GOLD_WANDER_B], pathLength: 1, opacity: 1 }
                  : drawing
                    ? { d: PATH_GOLD_WANDER_A, pathLength: 1, opacity: 1 }
                    : { d: PATH_GOLD_WANDER_A, pathLength: 0, opacity: 0 }
            }
            transition={
              inReveal
                ? {
                    d: { duration: 0.52, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.16, ease: 'easeOut' },
                  }
                : wandering
                  ? { d: WANDER_MIRROR, pathLength: { duration: 0.01 }, opacity: { duration: 0.35 } }
                  : drawing
                    ? { pathLength: { duration: 2.35, ease: [0.22, 1, 0.36, 1] }, d: { duration: 0.01 }, opacity: { duration: 0.35 } }
                    : { duration: 0.4 }
            }
          />

          {wandering ? (
            <>
              <motion.circle
                r={3.2}
                fill="rgba(231,229,226,0.95)"
                style={{ filter: 'blur(4px)' }}
                initial={false}
                animate={{ cx: [DOT_GRAY_A.cx, DOT_GRAY_B.cx], cy: [DOT_GRAY_A.cy, DOT_GRAY_B.cy] }}
                transition={{ cx: WANDER_MIRROR, cy: WANDER_MIRROR }}
              />
              <motion.circle
                r={3.5}
                fill="rgba(212,175,55,0.92)"
                style={{ filter: 'blur(4px)' }}
                initial={false}
                animate={{ cx: [DOT_GOLD_A.cx, DOT_GOLD_B.cx], cy: [DOT_GOLD_A.cy, DOT_GOLD_B.cy] }}
                transition={{ cx: WANDER_MIRROR, cy: WANDER_MIRROR }}
              />
            </>
          ) : null}

          {phase === 'reveal' && !lineVanish ? (
            <>
              <motion.circle
                r={3}
                fill="rgba(212,175,55,0.85)"
                cx={CX}
                cy={CY}
                style={{ filter: 'blur(4px)' }}
                initial={{ opacity: 0.35, scale: 0.65 }}
                animate={{ opacity: 1, scale: 1.12 }}
                transition={{ duration: 0.38, ease: 'easeOut' }}
              />
              <motion.circle
                r={2.6}
                fill="rgba(255,255,255,0.88)"
                cx={CX}
                cy={CY}
                style={{ filter: 'blur(3px)' }}
                initial={{ opacity: 0.15 }}
                animate={{ opacity: 0.72 }}
                transition={{ duration: 0.42, ease: 'easeOut' }}
              />
            </>
          ) : null}
        </svg>

        <motion.p
          className="pointer-events-none absolute bottom-1 left-1/2 w-[min(280px,92vw)] -translate-x-1/2 text-center font-serif text-[10px] font-light italic leading-snug text-[#a8a29e]"
          style={{ fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif" }}
          animate={
            scanning && !revealBurst
              ? { opacity: [0.28, 0.88, 0.28] }
              : { opacity: revealBurst ? 0 : 0.32 }
          }
          transition={
            scanning && !revealBurst
              ? { duration: 5.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }
              : { duration: 0.45 }
          }
        >
          Seeking resonance across timelines...
        </motion.p>
      </div>

      <AnimatePresence>
        {showRipple ? (
          <motion.div
            key="meet-threads-ripple"
            className="pointer-events-none fixed inset-0 z-[281] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="size-[72px] rounded-full bg-white/45 shadow-[0_0_60px_rgba(255,252,248,0.85)] backdrop-blur-md"
              style={{
                boxShadow:
                  '0 0 80px rgba(255,255,255,0.75), 0 0 120px rgba(212,175,55,0.18), inset 0 0 24px rgba(255,255,255,0.5)',
              }}
              initial={{ scale: 0, opacity: 0.65 }}
              animate={{ scale: 5, opacity: 0 }}
              transition={{ duration: 1.05, ease: [0.22, 1, 0.28, 1] }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
