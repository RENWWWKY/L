import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  STORY_TIMELINE_PER_ROUND_SYNC_RESULT_EVENT,
  type StoryTimelinePerRoundSyncResultDetail,
} from './storyTimelinePerRoundResultEvents'

const AUTO_DISMISS_MS = 5200

/** 每轮线下摘要补救失败时提示：可到记忆档案馆 · 角色总结 手动生成 */
export function WechatStoryTimelinePerRoundToastHost() {
  const [detail, setDetail] = useState<StoryTimelinePerRoundSyncResultDetail | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const onResult = (e: Event) => {
      const ce = e as CustomEvent<StoryTimelinePerRoundSyncResultDetail>
      if (!ce.detail || ce.detail.ok) return
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      setDetail(ce.detail)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        setDetail(null)
      }, AUTO_DISMISS_MS)
    }
    window.addEventListener(
      STORY_TIMELINE_PER_ROUND_SYNC_RESULT_EVENT,
      onResult as EventListener,
    )
    return () => {
      window.removeEventListener(
        STORY_TIMELINE_PER_ROUND_SYNC_RESULT_EVENT,
        onResult as EventListener,
      )
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [])

  if (typeof document === 'undefined') return null

  const name = detail?.displayName?.trim() || '角色'

  return createPortal(
    <AnimatePresence>
      {detail ? (
        <motion.div
          key="story-timeline-per-round-fail"
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
            className="max-w-[min(100vw-3rem,380px)] rounded-[14px] bg-white px-5 py-4 text-center shadow-lg ring-1 ring-emerald-200/90"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-600/90">
              线下摘要 · 本轮未生成
            </p>
            <p className="mt-2 text-[14px] font-medium leading-relaxed text-gray-900">
              「{name}」的按轮线下摘要未能自动写入
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-gray-500">
              {detail.failureReason?.trim() ||
                '同轮未返回有效摘要且单独补救也失败。请到记忆档案馆 · 角色总结，进入该角色后在「线下摘要」区粘贴本轮剧情后手动生成。'}
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
