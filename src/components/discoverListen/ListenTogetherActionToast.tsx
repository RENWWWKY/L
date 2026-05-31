import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'

const TOAST_MS = 2200

type Props = {
  message: string | null
  onClear: () => void
}

export function ListenTogetherActionToast({ message, onClear }: Props) {
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(onClear, TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [message, onClear])

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          key={message}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="pointer-events-none fixed inset-x-0 top-[max(4.5rem,env(safe-area-inset-top))] z-[10030] flex justify-center px-6"
        >
          <div className="max-w-[20rem] rounded-2xl bg-[#2D2422]/92 px-5 py-2.5 text-center text-[13px] font-medium tracking-wide text-white shadow-lg backdrop-blur-sm">
            {message}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
