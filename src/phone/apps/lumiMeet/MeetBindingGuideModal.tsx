import { AnimatePresence, motion } from 'framer-motion'
import { Link2, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Pressable } from '../../components/Pressable'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import {
  dispatchGoMeetProfileContact,
  meetBindingGapCopy,
  type MeetBindingGap,
} from './meetBindingReadiness'

export function MeetBindingGuideModal({
  open,
  gap,
  onClose,
}: {
  open: boolean
  gap: MeetBindingGap
  onClose: () => void
}) {
  const el = getLumiMeetPortalTarget()
  if (!el || !gap) return null

  const copy = meetBindingGapCopy(gap)

  const onPrimary = () => {
    onClose()
    if (gap === 'wechat_register') {
      dispatchGoMeetProfileContact({ openWeChatRegistration: true })
    } else {
      dispatchGoMeetProfileContact()
    }
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="meet-binding-guide"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meet-binding-guide-title"
          className="fixed inset-0 z-[340] flex items-end justify-center bg-black/35 px-0 sm:items-center sm:px-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="w-full max-w-[min(360px,100vw)] rounded-t-[20px] border-[0.5px] border-[#e8e4dc] bg-[#fdfcfa] px-5 py-5 shadow-[0_-12px_40px_rgba(22,18,14,0.14)] sm:rounded-[18px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#faf6ee] text-[#b8973a]">
                <Link2 className="size-5" strokeWidth={1.5} aria-hidden />
              </span>
              <Pressable
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ebe7e0] bg-white text-[#6e6860]"
                aria-label="关闭"
              >
                <X className="size-[18px]" strokeWidth={1.5} aria-hidden />
              </Pressable>
            </div>
            <h2 id="meet-binding-guide-title" className="mt-4 font-elegant-serif text-[18px] tracking-[0.04em] text-[#2c2a26]">
              {copy.title}
            </h2>
            <p className="mt-3 font-dossier-serif text-[13px] leading-[1.75] text-[#5b574f]">{copy.body}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Pressable type="button" onClick={onPrimary} className="meet-btn-primary w-full py-3 text-[13px]">
                {copy.cta}
              </Pressable>
              <Pressable type="button" onClick={onClose} className="meet-btn-secondary w-full py-3 text-[13px]">
                稍后再说
              </Pressable>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    el,
  )
}
