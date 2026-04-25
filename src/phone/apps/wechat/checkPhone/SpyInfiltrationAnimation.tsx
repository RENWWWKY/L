import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'

export function SpyInfiltrationAnimation({
  onDone,
  label = 'Accessing...',
  durationMs = 1450,
}: {
  onDone: () => void
  label?: string
  durationMs?: number
}) {
  const progressDuration = useMemo(() => Math.max(700, durationMs - 260), [durationMs])

  useEffect(() => {
    const t = window.setTimeout(() => onDone(), durationMs)
    return () => window.clearTimeout(t)
  }, [durationMs, onDone])

  return (
    <motion.div
      className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/90"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
    >
      <motion.div
        className="flex w-full max-w-[420px] flex-col items-center justify-center px-8"
        animate={{ scale: [1, 0.98, 1, 0.98, 1] }}
        transition={{
          duration: 0.62,
          times: [0, 0.18, 0.38, 0.62, 1],
          ease: 'easeInOut',
        }}
      >
        <div className="text-[12px] tracking-[0.28em] text-white/70">{label}</div>

        <div className="mt-5 h-[2px] w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full w-full origin-left bg-gradient-to-r from-white/40 via-[#e8d9b6] to-white/40"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: progressDuration / 1000, ease: [0.2, 0, 0, 1] }}
          />
        </div>

        <div className="mt-3 text-[11px] tracking-[0.22em] text-white/30">DECRYPTION</div>
      </motion.div>
    </motion.div>
  )
}

