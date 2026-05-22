import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const TYPE_LINES = [
  'Aligning timelines...',
  '正在同步其他入局者的世界线...',
]

export type SearchingOverlayProps = {
  onComplete: () => void
  durationMs?: number
}

export function SearchingOverlay({ onComplete, durationMs = 3000 }: SearchingOverlayProps) {
  const [lineIndex, setLineIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)

  useEffect(() => {
    const done = window.setTimeout(onComplete, durationMs)
    return () => window.clearTimeout(done)
  }, [durationMs, onComplete])

  useEffect(() => {
    const line = TYPE_LINES[lineIndex]
    if (charIndex >= line.length) {
      if (lineIndex < TYPE_LINES.length - 1) {
        const pause = window.setTimeout(() => {
          setLineIndex((i) => i + 1)
          setCharIndex(0)
        }, 400)
        return () => window.clearTimeout(pause)
      }
      return
    }
    const t = window.setTimeout(() => setCharIndex((c) => c + 1), 42)
    return () => window.clearTimeout(t)
  }, [lineIndex, charIndex])

  const displayed = TYPE_LINES.map((line, i) => {
    if (i < lineIndex) return line
    if (i === lineIndex) return line.slice(0, charIndex)
    return ''
  }).filter((_, i) => i <= lineIndex)

  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col items-center justify-center px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div
        className="relative size-44"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.2, filter: 'blur(8px)' }}
        transition={{ duration: 0.45 }}
      >
        <motion.svg
          viewBox="0 0 200 200"
          className="absolute inset-0 size-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
          aria-hidden
        >
          <circle cx="100" cy="100" r="78" className="jbs-gf-astrolabe-ring" />
          <circle cx="100" cy="100" r="58" className="jbs-gf-astrolabe-ring" opacity="0.6" />
          <circle cx="100" cy="100" r="38" className="jbs-gf-astrolabe-ring" opacity="0.35" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * Math.PI) / 6
            const x1 = 100 + Math.cos(a) * 38
            const y1 = 100 + Math.sin(a) * 38
            const x2 = 100 + Math.cos(a) * 78
            const y2 = 100 + Math.sin(a) * 78
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className="jbs-gf-astrolabe-tick"
              />
            )
          })}
        </motion.svg>

        <motion.svg
          viewBox="0 0 200 200"
          className="absolute inset-0 size-full"
          animate={{ rotate: -360 }}
          transition={{ duration: 72, repeat: Infinity, ease: 'linear' }}
          aria-hidden
        >
          <polygon
            points="100,28 172,152 28,152"
            fill="none"
            stroke="rgba(212, 175, 55, 0.2)"
            strokeWidth="0.6"
          />
          <line x1="100" y1="52" x2="100" y2="148" className="jbs-gf-astrolabe-tick" opacity="0.5" />
        </motion.svg>

        <motion.div
          className="jbs-gf-astrolabe-core absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        />
      </motion.div>

      <div className="jbs-gf-typewriter jbs-font-serif mt-12 min-h-[3.5em] w-full max-w-[300px] text-center">
        {displayed.map((text, i) => (
          <p key={i} className={i > 0 ? 'jbs-gf-typewriter-dim mt-2' : ''}>
            {text}
            {i === lineIndex && charIndex < TYPE_LINES[lineIndex].length ? (
              <span
                className="jbs-gf-typewriter-cursor ml-0.5 inline-block w-[6px] animate-pulse"
                aria-hidden
              >
                |
              </span>
            ) : null}
          </p>
        ))}
      </div>
    </motion.div>
  )
}
