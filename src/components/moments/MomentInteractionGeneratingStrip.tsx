import { AlertTriangle, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

type MomentInteractionGeneratingStripProps = {
  className?: string
  mode?: 'generating' | 'fallback_only'
}

/** 用户动态 AI 互动：生成中 / 仅保底 提示 */
export function MomentInteractionGeneratingStrip({
  className = '',
  mode = 'generating',
}: MomentInteractionGeneratingStripProps) {
  if (mode === 'fallback_only') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 ${className}`}
        role="status"
        aria-live="polite"
      >
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" strokeWidth={2} />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-amber-900">AI 互动未生成，已改用保底点赞</p>
          <p className="mt-0.5 text-[11px] leading-snug text-amber-800/80">
            请检查 API 设置中的聊天模型是否可用；高互动预设仍会补模板短评。
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2.5 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-3.5 shrink-0 animate-spin text-[#6B7280]" strokeWidth={2} />
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[#374151]">角色互动正在生成中…</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[#9CA3AF]">
          正在调用聊天模型写点赞与评论，请稍候
        </p>
      </div>
    </motion.div>
  )
}
