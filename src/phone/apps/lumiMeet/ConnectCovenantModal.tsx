import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'

export type ConnectCovenantModalProps = {
  open: boolean
  onClose: () => void
  onConfirmSend: () => void
}

export function ConnectCovenantModalPortal({ open, onClose, onConfirmSend }: ConnectCovenantModalProps) {
  const el = getLumiMeetPortalTarget()
  if (!el) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="connect-covenant"
          role="dialog"
          aria-modal="true"
          aria-labelledby="covenant-modal-title"
          className="fixed inset-0 z-[360] flex items-center justify-center bg-black/25 px-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="w-full max-w-[min(340px,92vw)] overflow-hidden rounded-[18px] border-[0.5px] border-[#e8e4dc] bg-white/80 p-6 shadow-[0_28px_90px_rgba(22,18,14,0.14)] backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="covenant-modal-title" className="text-center text-[13px] font-medium tracking-[0.12em] text-[#b8973a]">
              缔结专属契约
            </p>
            <p className="mt-5 text-center font-dossier-serif text-[13px] leading-relaxed tracking-[0.06em] text-[#6e6860]">
              是否向对方发送交换联络方式的请求？对方会结合好感与人设决定是否应允；你亦可回应对方主动发来的邀约。
            </p>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border-[0.5px] border-[#e0dcd4] bg-[#f4f2ee] py-3 text-[13px] tracking-[0.06em] text-[#6b6459] transition-colors hover:bg-[#ebe8e2]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={onConfirmSend}
                className="flex-1 rounded-full border-[0.5px] border-[#1a1918] bg-[#141312] py-3 text-[13px] tracking-[0.08em] text-[#f7f4ef] transition-opacity hover:opacity-95"
              >
                确认发送
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    el,
  )
}
