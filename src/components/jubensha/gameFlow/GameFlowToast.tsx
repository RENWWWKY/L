import { AnimatePresence, motion } from 'framer-motion'

export function GameFlowToast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          key={message}
          className="jbs-gf-toast pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[80] mx-auto max-w-[90%] px-4 py-3 text-center jbs-font-serif text-[12px] tracking-wider"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.28 }}
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
