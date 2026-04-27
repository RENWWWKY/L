import { AnimatePresence, motion } from 'framer-motion'

export function BottomSheet({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1300] bg-black/25"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ y: 28, opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 18, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[520px] rounded-t-[22px] border border-black/10 bg-white/85 backdrop-blur"
            style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom, 0px))' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-3">
              <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-black/10" aria-hidden />
              <div className="flex items-center justify-between">
                <div className="text-[14px] font-semibold text-[#1c1c1e]">{title}</div>
                <button
                  type="button"
                  className="rounded-full px-2 py-1 text-[12px] text-[#6b7280] active:bg-black/5"
                  onClick={onClose}
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="max-h-[66vh] overflow-y-auto px-4 pb-2 pt-3">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

