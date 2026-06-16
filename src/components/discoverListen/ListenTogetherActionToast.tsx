import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'

export const LISTEN_TOGETHER_TOAST_MS = 2200
/** @deprecated 使用 LISTEN_TOGETHER_TOAST_MS */
export const PLAY_MODE_TOAST_MS = LISTEN_TOGETHER_TOAST_MS

type Props = {
  message: string | null
  onClear: () => void
}

/** 听一听通用临时提示：屏幕居中，约 2.2s 后自动消失 */
export function ListenTogetherActionToast({ message, onClear }: Props) {
  const onClearRef = useRef(onClear)
  onClearRef.current = onClear

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => onClearRef.current(), LISTEN_TOGETHER_TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [message])

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          key={message}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, scale: 0.92, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -6 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="pointer-events-none fixed inset-0 z-[10035] flex items-center justify-center px-6"
        >
          <div className="max-w-[min(88vw,20rem)] rounded-2xl bg-[#2D2422]/92 px-5 py-2.5 text-center text-[13px] font-medium tracking-wide text-white shadow-lg backdrop-blur-sm">
            {message}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
