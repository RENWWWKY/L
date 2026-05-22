import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DATING_PLOT_GENERATION_COMPLETE_EVENT,
  DATING_PLOT_GENERATION_ERROR_EVENT,
  type DatingPlotGenerationCompleteDetail,
  type DatingPlotGenerationErrorDetail,
} from './datingPlotGenerationEvents'

const AUTO_DISMISS_MS = 3800

function formatNpcList(names: string[]): string {
  if (names.length <= 2) return names.map((n) => `「${n}」`).join('、')
  return `「${names[0]}」等 ${names.length} 位关联角色`
}

type ToastPayload = {
  kind: 'success' | 'error'
  title: string
  body: string
}

/** 约会剧情后台生成完成 / 失败：全局居中弹窗（可切页，不挡操作） */
export function DatingPlotCompletionToastHost() {
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const dismissLater = () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        setToast(null)
      }, AUTO_DISMISS_MS)
    }

    const onComplete = (e: Event) => {
      const ce = e as CustomEvent<DatingPlotGenerationCompleteDetail>
      const hero = ce.detail?.characterName?.trim()
      if (!hero) return
      const linked = (ce.detail?.linkedNpcNames ?? []).map((n) => String(n).trim()).filter(Boolean)
      const body =
        linked.length > 0
          ? `「${hero}」的剧情已写入。已为 ${formatNpcList(linked)} 写入关联记忆。`
          : `「${hero}」的剧情已生成并写入。`
      setToast({ kind: 'success', title: '线下剧情 · 已完成', body })
      dismissLater()
    }

    const onError = (e: Event) => {
      const ce = e as CustomEvent<DatingPlotGenerationErrorDetail>
      const hero = ce.detail?.characterName?.trim() || '约会角色'
      const msg = ce.detail?.message?.trim() || '剧情生成失败'
      setToast({ kind: 'error', title: `「${hero}」剧情生成失败`, body: msg })
      dismissLater()
    }

    window.addEventListener(DATING_PLOT_GENERATION_COMPLETE_EVENT, onComplete as EventListener)
    window.addEventListener(DATING_PLOT_GENERATION_ERROR_EVENT, onError as EventListener)
    return () => {
      window.removeEventListener(DATING_PLOT_GENERATION_COMPLETE_EVENT, onComplete as EventListener)
      window.removeEventListener(DATING_PLOT_GENERATION_ERROR_EVENT, onError as EventListener)
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={`${toast.kind}-${toast.title}`}
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-0 z-[10050] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className={`max-w-[min(100vw-3rem,380px)] rounded-[14px] px-5 py-4 text-center text-white shadow-lg ${
              toast.kind === 'error' ? 'bg-red-950/92' : 'bg-black/90'
            }`}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/55">
              {toast.title}
            </p>
            <p className="mt-2 text-[14px] font-medium leading-relaxed">{toast.body}</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
