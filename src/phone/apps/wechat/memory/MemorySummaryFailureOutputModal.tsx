import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

export type MemorySummaryFailureOutputModalProps = {
  open: boolean
  onClose: () => void
  displayName: string
  kindLabel: string
  failureReason?: string
  modelOutput?: string
  parsedPreview?: string
  zIndex?: number
}

type DebugTab = 'raw' | 'parsed'

export function MemorySummaryFailureOutputModal({
  open,
  onClose,
  displayName,
  kindLabel,
  failureReason,
  modelOutput,
  parsedPreview,
  zIndex = 10060,
}: MemorySummaryFailureOutputModalProps) {
  const hasRaw = !!modelOutput?.trim()
  const hasParsed = !!parsedPreview?.trim()
  const [tab, setTab] = useState<DebugTab>(hasRaw ? 'raw' : 'parsed')

  useEffect(() => {
    if (!open) return
    setTab(hasRaw ? 'raw' : 'parsed')
  }, [open, hasRaw, hasParsed])

  const activeText = useMemo(() => {
    if (tab === 'raw' && hasRaw) return modelOutput!.trim()
    if (hasParsed) return parsedPreview!.trim()
    if (hasRaw) return modelOutput!.trim()
    return '（无保存的模型输出；可能是配置错误或未发起总结请求）'
  }, [tab, hasRaw, hasParsed, modelOutput, parsedPreview])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="memory-summary-failure-modal"
          className="fixed inset-0 flex items-end justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:items-center sm:px-6"
          style={{ zIndex }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="关闭"
            className="absolute inset-0 bg-black/45"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-summary-failure-title"
            className="relative flex max-h-[min(88vh,720px)] w-full max-w-[min(100vw-1.5rem,480px)] flex-col overflow-hidden rounded-[20px] bg-white shadow-xl ring-1 ring-rose-100/90"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3.5">
              <div className="min-w-0">
                <p id="memory-summary-failure-title" className="text-[11px] font-medium uppercase tracking-[0.18em] text-rose-500/90">
                  记忆总结 · 未完成
                </p>
                <p className="mt-1 text-[15px] font-semibold leading-snug text-gray-900">
                  「{displayName}」的{kindLabel}总结失败
                </p>
                {failureReason?.trim() ? (
                  <p className="mt-1 text-[12px] leading-relaxed text-gray-500">{failureReason.trim()}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600"
                aria-label="关闭弹窗"
              >
                <X className="size-4" />
              </button>
            </div>

            {hasRaw && hasParsed ? (
              <div className="flex gap-2 border-b border-gray-100 px-4 py-2">
                <button
                  type="button"
                  onClick={() => setTab('raw')}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                    tab === 'raw' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  模型原文
                </button>
                <button
                  type="button"
                  onClick={() => setTab('parsed')}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                    tab === 'parsed' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  解析结果
                </button>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-800">
                {activeText}
              </pre>
            </div>

            <div className="border-t border-gray-100 px-4 py-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl bg-gray-900 py-3 text-[13px] font-semibold text-white"
              >
                知道了
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
