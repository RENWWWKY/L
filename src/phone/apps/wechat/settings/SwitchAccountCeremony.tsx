import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const EASE = [0.25, 0.1, 0.25, 1] as const

type Props = {
  open: boolean
  nickname: string
  onFinished: () => void
}

/** 身份切换仪式：黑幕 + 等宽提示 + 光点 */
export function SwitchAccountCeremony({ open, nickname, onFinished }: Props) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')

  useEffect(() => {
    if (!open) {
      setPhase('in')
      return
    }
    setPhase('in')
    const t1 = window.setTimeout(() => setPhase('hold'), 400)
    const t2 = window.setTimeout(() => setPhase('out'), 1500)
    const t3 = window.setTimeout(() => onFinished(), 2200)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [open, onFinished])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="switch-account-ceremony"
          className="absolute inset-0 z-[400] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'out' ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: phase === 'out' ? 0.7 : 0.45, ease: EASE }}
        >
          <motion.div
            className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, ease: EASE }}
          />
          <motion.div
            className="relative z-10 flex flex-col items-center px-8"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: phase === 'out' ? 0 : 1, y: phase === 'out' ? -16 : 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <p className="max-w-[min(90vw,22rem)] text-center font-mono text-[10px] uppercase tracking-[0.28em] text-white/90">
              Switching identity to {nickname}...
            </p>
            <motion.span
              className="mt-8 size-1.5 rounded-full bg-white"
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden
            />
          </motion.div>
          {phase === 'out' ? (
            <motion.div
              className="absolute inset-0 bg-white"
              initial={{ y: '100%' }}
              animate={{ y: '-100%' }}
              transition={{ duration: 0.75, ease: EASE }}
              aria-hidden
            />
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
