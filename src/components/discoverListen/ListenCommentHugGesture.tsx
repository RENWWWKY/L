import { Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

/** 抱一抱按钮图标：双臂环抱，与点赞心形区分 */
function ListenHugIcon({
  className = '',
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <circle
        cx="12"
        cy="7.2"
        r="2.1"
        stroke="currentColor"
        strokeWidth="1.5"
        fill={filled ? 'currentColor' : 'none'}
      />
      <path
        d="M6.8 10.2C5.2 12.2 5.4 15.8 8.2 17.6C9.6 18.5 11.2 19 12 19s2.4-.5 3.8-1.4c2.8-1.8 3-5.4 1.4-7.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
        fillOpacity={filled ? 0.2 : 0}
      />
      <path
        d="M8.6 17.2c1 1 2.2 1.5 3.4 1.5s2.4-.5 3.4-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export type ListenCommentHugAnimationProps = {
  active: boolean
  children: ReactNode
}

/** 抱一抱点击后在评论正文上播放的短暂动画（柔和粉色） */
export function ListenCommentHugAnimation({ active, children }: ListenCommentHugAnimationProps) {
  return (
    <div className="relative">
      <AnimatePresence>
        {active ? (
          <motion.div
            key="hug-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl"
            aria-hidden
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.5, 0.22] }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="absolute inset-0 bg-gradient-to-b from-rose-100/55 via-rose-50/35 to-transparent"
            />

            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.35, opacity: 0 }}
                animate={{ scale: [0.35, 1.35 + i * 0.12], opacity: [0, 0.32 - i * 0.08, 0] }}
                transition={{
                  duration: 0.62,
                  ease: 'easeOut',
                  delay: 0.04 + i * 0.07,
                }}
                className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-rose-200/55"
              />
            ))}

            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 6 }}
              animate={{ scale: [0.5, 1.12, 1], opacity: [0, 1, 0.92], y: [6, 0, 0] }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.02 }}
              className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-rose-400 shadow-[0_6px_20px_rgba(251,113,133,0.18)] ring-1 ring-rose-100/90 backdrop-blur-sm"
            >
              <ListenHugIcon className="size-5" filled />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 8 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.88, 1, 1, 0.96], y: [8, 0, 0, -3] }}
              transition={{ duration: 0.55, times: [0, 0.18, 0.7, 1], ease: 'easeOut' }}
              className="absolute inset-x-0 top-[58%] flex justify-center"
            >
              <span className="rounded-full bg-rose-400/92 px-3 py-1 text-[11px] font-medium tracking-wide text-white shadow-[0_4px_14px_rgba(251,113,133,0.28)]">
                抱一抱
              </span>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        animate={{ scale: active ? 0.988 : 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      >
        {children}
      </motion.div>
    </div>
  )
}

export type ListenCommentHugButtonProps = {
  hugged?: boolean
  hugging?: boolean
  onClick: () => void
}

export function ListenCommentHugButton({
  hugged = false,
  hugging = false,
  onClick,
}: ListenCommentHugButtonProps) {
  return (
    <button
      type="button"
      disabled={hugging || hugged}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors active:scale-[0.97] disabled:opacity-70 ${
        hugged
          ? 'bg-rose-50 text-rose-500'
          : 'text-stone-500 hover:bg-rose-50/80 hover:text-rose-400'
      }`}
      aria-label={hugged ? '已抱一抱' : '抱一抱这条评论'}
      aria-pressed={hugged}
    >
      {hugging ? (
        <Loader2 className="size-3.5 animate-spin text-rose-400" strokeWidth={1.75} aria-hidden />
      ) : (
        <ListenHugIcon className="size-3.5" filled={hugged} />
      )}
      <span className="text-[11px]">{hugged ? '已抱' : '抱一抱'}</span>
    </button>
  )
}
