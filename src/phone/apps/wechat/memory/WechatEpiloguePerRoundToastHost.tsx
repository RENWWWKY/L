import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  WORLD_BOOK_AFTER_PER_ROUND_SYNC_RESULT_EVENT,
  type WorldBookAfterPerRoundSyncResultDetail,
} from './worldBookAfterPerRoundResultEvents'

const AUTO_DISMISS_MS = 5200

/** 每轮尾声判断失败时提示：可到记忆档案馆 · 尾声延展 手动对齐 */
export function WechatEpiloguePerRoundToastHost() {
  const [detail, setDetail] = useState<WorldBookAfterPerRoundSyncResultDetail | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const onResult = (e: Event) => {
      const ce = e as CustomEvent<WorldBookAfterPerRoundSyncResultDetail>
      if (!ce.detail || ce.detail.ok) return
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      setDetail(ce.detail)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        setDetail(null)
      }, AUTO_DISMISS_MS)
    }
    window.addEventListener(WORLD_BOOK_AFTER_PER_ROUND_SYNC_RESULT_EVENT, onResult as EventListener)
    return () => {
      window.removeEventListener(WORLD_BOOK_AFTER_PER_ROUND_SYNC_RESULT_EVENT, onResult as EventListener)
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [])

  if (typeof document === 'undefined') return null

  const name = detail?.displayName?.trim() || '角色'

  return createPortal(
    <AnimatePresence>
      {detail ? (
        <motion.div
          key="epilogue-per-round-fail"
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-0 z-[10056] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="max-w-[min(100vw-3rem,380px)] rounded-[14px] bg-white px-5 py-4 text-center shadow-lg ring-1 ring-amber-200/90"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-600/90">
              尾声延展 · 本轮未对齐
            </p>
            <p className="mt-2 text-[14px] font-medium leading-relaxed text-gray-900">
              「{name}」的尾声条目未能自动判断更新
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-gray-500">
              {detail.failureReason?.trim() ||
                '模型未返回有效结果或接口未配置。请到记忆档案馆 · 尾声延展，粘贴本轮剧情后手动判断对齐。'}
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
