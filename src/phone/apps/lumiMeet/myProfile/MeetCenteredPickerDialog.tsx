import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getLumiMeetPortalTarget } from '../lumiMeetPortal'

type Props = {
  open: boolean
  title: string
  caption?: string
  onClose: () => void
  children: ReactNode
  /** 内容区最大高度，默认 70vh */
  maxBodyHeight?: string
}

export function MeetCenteredPickerDialog({
  open,
  title,
  caption,
  onClose,
  children,
  maxBodyHeight = 'min(70vh,520px)',
}: Props) {
  const el = getLumiMeetPortalTarget()
  if (!el) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="meet-centered-picker"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meet-centered-picker-title"
          className="fixed inset-0 z-[360] flex items-center justify-center bg-black/35 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="flex w-full max-w-[min(100vw-3rem,360px)] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_24px_80px_rgba(22,18,14,0.22)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#f3f0ea] px-5 py-4">
              <div className="min-w-0">
                {caption ? (
                  <p className="meet-caption-en text-[9px] uppercase tracking-[0.32em] text-[#b8b5ad]">
                    {caption}
                  </p>
                ) : null}
                <p
                  id="meet-centered-picker-title"
                  className={`font-elegant-serif text-[16px] font-medium text-[#2c2a26] ${caption ? 'mt-1' : ''}`}
                >
                  {title}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full p-2 text-[#9a9590] transition-colors hover:bg-[#f5f3ef] hover:text-[#1a1918]"
                aria-label="关闭"
              >
                <X className="size-5" strokeWidth={1.5} />
              </button>
            </div>
            <div
              className="meet-scrollbar min-h-0 overflow-y-auto px-4 py-4"
              style={{ maxHeight: maxBodyHeight }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    el,
  )
}
