import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

export type ActionPillProps = {
  icon: LucideIcon
  /** 省略则仅展示中文主标签（遇见会话工具栏默认纯中文） */
  enLabel?: string
  cnLabel: string
  isDisabled?: boolean
  onClick?: () => void
  /** 额外样式（如契约未解锁时的灰阶弱化） */
  className?: string
  /** 高亮引导定位 */
  coachTarget?: string
}

export function ActionPill({
  icon: Icon,
  enLabel,
  cnLabel,
  isDisabled,
  onClick,
  className,
  coachTarget,
}: ActionPillProps) {
  const showEn = Boolean(enLabel?.trim())
  return (
    <motion.button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      whileTap={isDisabled ? undefined : { scale: 0.96 }}
      className={`group flex shrink-0 items-center gap-2 rounded-[11px] border-[0.5px] border-gray-200 bg-white/80 px-3 py-2 backdrop-blur-md transition-colors disabled:cursor-not-allowed disabled:opacity-45 active:bg-gray-50 ${className ?? ''}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      {...(coachTarget ? { 'data-meet-coach': coachTarget } : {})}
    >
      <Icon
        className="size-[15px] shrink-0 text-[#6b6560] group-disabled:text-gray-300"
        strokeWidth={1.35}
        aria-hidden
      />
      <span className="flex min-w-0 flex-col items-start leading-none">
        {showEn ? (
          <span className="meet-caption-en text-[9px] font-medium uppercase tracking-[0.22em] text-[#3d3a34]">
            {enLabel}
          </span>
        ) : null}
        <span
          className={`${showEn ? 'mt-1' : ''} text-[12px] font-medium tracking-[0.12em] text-[#7a736b]`}
        >
          {cnLabel}
        </span>
      </span>
    </motion.button>
  )
}
