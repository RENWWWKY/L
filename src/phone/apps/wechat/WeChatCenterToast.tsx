import { AnimatePresence, motion } from 'framer-motion'

export function WeChatCenterToast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          className="fixed inset-0 z-[1200] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          aria-live="polite"
          aria-atomic="true"
        >
          <motion.div
            className="rounded-[12px] bg-black/90 px-4 py-3 text-center text-[13px] leading-snug text-white shadow-lg"
            initial={{ scale: 0.96, y: 4, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.98, y: 2, opacity: 0 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            {message}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

