import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'

type Props = {
  message: string | null
  onDismiss?: () => void
}

export function WeChatSecurityToast({ message, onDismiss }: Props) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {message ? (
        <motion.div
          key={message}
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-[max(5.5rem,env(safe-area-inset-bottom))] z-[400] flex justify-center px-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => {
            if (onDismiss) window.setTimeout(onDismiss, 2200)
          }}
        >
          <p className="max-w-[min(340px,92vw)] rounded-full border border-[#E5E7EB] bg-white/95 px-5 py-2.5 text-center text-[12px] font-light tracking-[0.04em] text-[#111827] shadow-[0_12px_40px_rgba(0,0,0,0.08)] backdrop-blur-md">
            {message}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
