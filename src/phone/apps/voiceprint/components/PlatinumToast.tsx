import { AnimatePresence, motion } from 'framer-motion'

export function PlatinumToast({
  open,
  message,
  tone = 'error',
  onClose,
}: {
  open: boolean
  message: string
  tone?: 'error' | 'info'
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.99 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="fixed inset-x-0 bottom-[86px] z-[1400] flex justify-center px-4"
          onClick={onClose}
        >
          <div
            className="max-w-[420px] rounded-[14px] border bg-white/90 px-4 py-3 text-[13px] leading-relaxed shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur"
            style={{
              borderColor: tone === 'error' ? 'rgba(180,35,24,0.35)' : 'rgba(0,0,0,0.08)',
              color: '#2b2b2b',
            }}
            role="status"
          >
            {message}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

