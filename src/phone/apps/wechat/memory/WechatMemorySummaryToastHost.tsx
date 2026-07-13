import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MemorySummaryFailureOutputModal } from './MemorySummaryFailureOutputModal'
import {
  WECHAT_MEMORY_SUMMARY_RESULT_EVENT,
  memorySummaryRetryKindLabel,
  type WechatMemorySummaryResultDetail,
} from './wechatMemorySummaryResultEvents'

const AUTO_DISMISS_MS = 3800

/** 监听合并自动总结成功/失败：成功居中 toast，失败弹窗展示模型输出 */
export function WechatMemorySummaryToastHost() {
  const [successDetail, setSuccessDetail] = useState<WechatMemorySummaryResultDetail | null>(null)
  const [failureDetail, setFailureDetail] = useState<WechatMemorySummaryResultDetail | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const onResult = (e: Event) => {
      const ce = e as CustomEvent<WechatMemorySummaryResultDetail>
      if (!ce.detail) return
      if (timerRef.current != null) window.clearTimeout(timerRef.current)

      if (ce.detail.ok) {
        setFailureDetail(null)
        setSuccessDetail(ce.detail)
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null
          setSuccessDetail(null)
        }, AUTO_DISMISS_MS)
        return
      }

      setSuccessDetail(null)
      setFailureDetail(ce.detail)
    }
    window.addEventListener(WECHAT_MEMORY_SUMMARY_RESULT_EVENT, onResult as EventListener)
    return () => {
      window.removeEventListener(WECHAT_MEMORY_SUMMARY_RESULT_EVENT, onResult as EventListener)
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [])

  if (typeof document === 'undefined') return null

  const successName = successDetail?.displayName?.trim() || '对方'
  const successKindLabel = successDetail ? memorySummaryRetryKindLabel(successDetail.kind) : ''

  const failureName = failureDetail?.displayName?.trim() || '对方'
  const failureKindLabel = failureDetail ? memorySummaryRetryKindLabel(failureDetail.kind) : ''

  return createPortal(
    <>
      <AnimatePresence>
        {successDetail ? (
          <motion.div
            key="wechat-memory-summary-success"
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-0 z-[10055] flex items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="max-w-[min(100vw-3rem,360px)] rounded-[14px] bg-black/90 px-5 py-4 text-center text-white shadow-lg"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/55">
                记忆总结 · 已写入
              </p>
              <p className="mt-2 text-[14px] font-medium leading-relaxed">
                已为「{successName}」写入{successKindLabel}长期记忆
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <MemorySummaryFailureOutputModal
        open={!!failureDetail}
        onClose={() => setFailureDetail(null)}
        displayName={failureName}
        kindLabel={failureKindLabel}
        failureReason={failureDetail?.failureReason}
        modelOutput={failureDetail?.modelOutput}
        parsedPreview={failureDetail?.parsedPreview}
      />
    </>,
    document.body,
  )
}
