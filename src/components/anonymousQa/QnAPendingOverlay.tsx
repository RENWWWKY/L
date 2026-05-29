import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

type QnAPendingOverlayProps = {
  open: boolean
  characterName: string
  statusLine?: string
}

export function QnAPendingOverlay({ open, characterName, statusLine }: QnAPendingOverlayProps) {
  const [typed, setTyped] = useState('')

  const fullLine =
    statusLine?.trim() ||
    `正在与 ${characterName.trim() || '对方'} 建立思绪连结…`

  useEffect(() => {
    if (!open) {
      setTyped('')
      return
    }
    let i = 0
    setTyped('')
    const timer = window.setInterval(() => {
      i += 1
      setTyped(fullLine.slice(0, i))
      if (i >= fullLine.length) window.clearInterval(timer)
    }, 36)
    return () => window.clearInterval(timer)
  }, [open, fullLine])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-white/70 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } }}
        >
          <motion.div
            className="flex flex-col items-center px-8"
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(6px)' }}
            transition={{ duration: 0.5 }}
          >
            <svg
              width="220"
              height="48"
              viewBox="0 0 220 48"
              className="text-[#111827]"
              aria-hidden
            >
              <motion.path
                d="M 4 24 Q 55 8, 110 24 T 216 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.75"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0.35 }}
                animate={{
                  pathLength: [0.2, 1, 0.85, 1],
                  opacity: [0.35, 0.9, 0.55, 0.9],
                }}
                transition={{
                  duration: 3.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <motion.path
                d="M 4 26 Q 55 38, 110 26 T 216 26"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                strokeLinecap="round"
                opacity={0.35}
                animate={{
                  pathLength: [0.3, 0.95, 0.4],
                  y: [0, -1.5, 0, 1.5, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </svg>

            <p className="mt-10 min-h-[1.5em] max-w-[280px] text-center font-mono text-[11px] leading-relaxed tracking-[0.12em] text-[#6B7280]">
              {typed}
              <motion.span
                className="inline-block w-[1px] translate-y-[1px] bg-[#111827]/60"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
              >
                |
              </motion.span>
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
