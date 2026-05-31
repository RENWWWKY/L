import { motion } from 'framer-motion'

export const PLAY_MODE_TOAST_MS = 2200

export function PlayModeSwitchToast({ label }: { label: string }) {
  return (
    <motion.div
      key={label}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="pointer-events-none absolute left-1/2 top-[42%] z-[10001] w-[min(88%,20rem)] -translate-x-1/2 -translate-y-1/2"
    >
      <div className="rounded-2xl bg-white/95 px-6 py-3 text-center text-sm font-medium tracking-wide text-stone-700 shadow-lg shadow-stone-200/60 ring-1 ring-stone-200/80 backdrop-blur-sm">
        已切换为{label}
      </div>
    </motion.div>
  )
}
