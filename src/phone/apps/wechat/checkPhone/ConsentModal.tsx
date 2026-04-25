import { AnimatePresence, motion } from 'framer-motion'
import { Pressable } from '../../../components/Pressable'

export function ConsentModal({
  open,
  onAsk,
  onSpy,
  onClose,
}: {
  open: boolean
  onAsk: () => void
  onSpy: () => void
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[1400] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <motion.div
            className="relative w-full max-w-[360px] rounded-[18px] border border-white/10 bg-white/[0.06] p-5 text-white shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-md"
            initial={{ y: 10, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 6, scale: 0.99, opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-center text-[14px] leading-relaxed text-white/90">
              是否征求对方同意？
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Pressable
                type="button"
                className="h-[44px] rounded-[14px] border border-white/12 bg-white/[0.06] text-[14px] text-white/90 active:bg-white/[0.1]"
                onClick={onAsk}
              >
                温柔询问
              </Pressable>
              <Pressable
                type="button"
                className="h-[44px] rounded-[14px] bg-white text-[14px] text-black shadow-[0_10px_30px_rgba(255,255,255,0.12)] active:bg-white/90"
                onClick={onSpy}
              >
                偷偷潜入
              </Pressable>
            </div>
            <Pressable
              type="button"
              className="mt-3 w-full text-center text-[12px] text-white/50 underline-offset-4 hover:underline active:text-white/60"
              onClick={onClose}
            >
              取消
            </Pressable>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

