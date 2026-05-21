import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import type { EncounterNPC } from './meetTypes'

export function MeetRewindMissedConfirmModal({
  npc,
  charges,
  onClose,
  onConfirm,
}: {
  npc: EncounterNPC | null
  charges: number
  onClose: () => void
  onConfirm: () => void
}) {
  const portalEl = getLumiMeetPortalTarget()
  if (!portalEl) return null

  return createPortal(
    <AnimatePresence>
      {npc ? (
        <motion.div
          key="meet-rewind-confirm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[345] flex items-center justify-center bg-black/28 p-6 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meet-rewind-confirm-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="w-full max-w-[300px] rounded-[22px] border border-white/75 bg-white/88 p-6 shadow-[0_28px_90px_rgba(28,24,18,0.2)] backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="meet-rewind-confirm-title" className="font-elegant-serif text-center text-[15px] leading-relaxed text-[#4a4540]">
              要消耗一次回溯机会，向 <span className="text-[#2c2a26]">{npc.nickname}</span> 重新发送心动信号吗？
            </p>
            <p className="meet-caption-en mt-3 text-center text-[10px] tracking-[0.22em] text-[#b0aaa4]">
              Initiate a rewind signal?
            </p>
            <p className="meet-caption-en mt-4 text-center text-[9px] tracking-[0.2em] text-[#c9c4bc]">
              Rewinds remaining · {charges}
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" className="meet-btn-secondary flex-1 py-3 text-[12px]" onClick={onClose}>
                取消
              </button>
              <button
                type="button"
                disabled={charges <= 0}
                className="meet-btn-primary flex-1 py-3 text-[12px] disabled:opacity-40"
                onClick={onConfirm}
              >
                确认
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalEl,
  )
}
