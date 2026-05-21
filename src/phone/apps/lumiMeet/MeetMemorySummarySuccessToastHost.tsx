import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MEET_MEMORY_SUMMARY_SUCCESS_EVENT,
  type MeetMemorySummarySuccessDetail,
} from './meetMemorySummarySuccessEvents'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'

const AUTO_DISMISS_MS = 3200

/** 监听 {@link MEET_MEMORY_SUMMARY_SUCCESS_EVENT}，居中展示临时成功提示 */
export function MeetMemorySummarySuccessToastHost() {
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const onSuccess = (e: Event) => {
      const ce = e as CustomEvent<MeetMemorySummarySuccessDetail>
      const name = ce.detail?.characterName?.trim() || '对方'
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      setMessage(`已与「${name}」的邂逅对话写入 [遇见] 长期记忆`)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        setMessage(null)
      }, AUTO_DISMISS_MS)
    }
    window.addEventListener(MEET_MEMORY_SUMMARY_SUCCESS_EVENT, onSuccess as EventListener)
    return () => {
      window.removeEventListener(MEET_MEMORY_SUMMARY_SUCCESS_EVENT, onSuccess as EventListener)
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const el = getLumiMeetPortalTarget()
  if (!el) return null

  return createPortal(
    <AnimatePresence>
      {message ? (
        <motion.div
          key="meet-memory-summary-success"
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-0 z-[380] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="max-w-[min(100vw-3rem,340px)] rounded-[14px] border border-[#D4AF37]/40 bg-white px-5 py-4 text-center shadow-[0_24px_80px_rgba(22,18,14,0.2)]"
          >
            <p className="meet-caption-en text-[9px] uppercase tracking-[0.32em] text-[#b8a994]">
              Memory · Saved
            </p>
            <p className="mt-2 font-elegant-serif text-[15px] font-medium tracking-[0.06em] text-[#2c2a26]">
              记忆总结成功
            </p>
            <p className="mt-2 text-[12px] font-light leading-relaxed text-[#6e6860]">{message}</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    el,
  )
}
