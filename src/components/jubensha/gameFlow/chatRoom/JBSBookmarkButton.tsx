import { motion } from 'framer-motion'
import { Bookmark } from 'lucide-react'
import { forwardRef } from 'react'

export type JBSBookmarkButtonProps = {
  absorbPulseKey: number
  badgeCount: number
  onClick: () => void
}

export const JBSBookmarkButton = forwardRef<HTMLButtonElement, JBSBookmarkButtonProps>(
  function JBSBookmarkButton({ absorbPulseKey, badgeCount, onClick }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className="jbs-gf-chat-bookmark-btn relative flex size-9 shrink-0 items-center justify-center rounded-full border-0 p-0"
        aria-label={badgeCount > 0 ? `打开手札，${badgeCount} 条新线索` : '打开手札'}
      >
        <motion.span
          key={absorbPulseKey}
          className="flex size-full items-center justify-center rounded-full"
          initial={{ scale: 1 }}
          animate={
            absorbPulseKey > 0
              ? {
                  scale: [1, 1.15, 1],
                  boxShadow: [
                    '0 2px 10px rgba(92, 61, 46, 0.1)',
                    '0 0 22px rgba(255, 255, 255, 0.55), 0 2px 14px rgba(92, 61, 46, 0.18)',
                    '0 2px 10px rgba(92, 61, 46, 0.1)',
                  ],
                }
              : { scale: 1 }
          }
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Bookmark className="relative z-[1] size-4" strokeWidth={1.25} />
        </motion.span>
        {absorbPulseKey > 0 ? (
          <motion.span
            key={`flash-${absorbPulseKey}`}
            className="jbs-clue-collector-absorb-flash pointer-events-none absolute inset-0 rounded-full"
            initial={{ opacity: 0.85, scale: 0.85 }}
            animate={{ opacity: 0, scale: 1.35 }}
            transition={{ duration: 0.5 }}
            aria-hidden
          />
        ) : null}
        {badgeCount > 0 ? (
          <span className="jbs-clue-collector-badge jbs-font-serif absolute -right-0.5 -top-0.5 z-[2] flex min-w-[14px] items-center justify-center rounded-full px-1 text-[8px] leading-[14px]">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        ) : null}
      </button>
    )
  },
)
