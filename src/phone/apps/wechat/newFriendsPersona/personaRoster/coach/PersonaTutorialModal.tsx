import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Pressable } from '../../../../../components/Pressable'
import { PERSONA_SERIF } from '../personaRosterDisplay'

export function PersonaTutorialModal({
  open,
  onClose,
  title,
  subtitle,
  sections,
  onStartLiveCoach,
  zIndex = 61500,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle: string
  sections: { title: string; body: string }[]
  onStartLiveCoach?: () => void
  zIndex?: number
}) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="persona-tutorial"
          role="dialog"
          aria-modal="true"
          aria-labelledby="persona-tutorial-title"
          className="fixed inset-0 flex items-end justify-center px-0 sm:items-center sm:px-5"
          style={{ zIndex, background: 'rgba(17,24,39,0.32)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="flex max-h-[min(88dvh,640px)] w-full max-w-[min(400px,100vw)] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-12px_48px_rgba(0,0,0,0.12)] sm:rounded-[24px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-4">
              <div>
                <p id="persona-tutorial-title" className="text-[13px] font-medium tracking-[0.12em] text-[#6B7280]">
                  {title}
                </p>
                <p className="mt-0.5 text-[11px] text-[#9CA3AF]">{subtitle}</p>
              </div>
              <Pressable
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F7F7F9] text-[#111827] active:bg-[#EFEFEF]"
                aria-label="关闭"
              >
                <X className="size-[18px]" strokeWidth={1.5} aria-hidden />
              </Pressable>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#F7F7F9] px-5 py-4">
              <ol className="space-y-5">
                {sections.map((sec, i) => (
                  <li key={sec.title} className="list-none">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                      {String(i + 1).padStart(2, '0')} · {sec.title}
                    </p>
                    <p
                      className="mt-2 text-[13px] leading-[1.75] text-[#4B5563]"
                      style={{ fontFamily: PERSONA_SERIF }}
                    >
                      {sec.body}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="shrink-0 space-y-2 bg-white px-5 py-4">
              {onStartLiveCoach ? (
                <Pressable
                  type="button"
                  onClick={() => {
                    onClose()
                    onStartLiveCoach()
                  }}
                  className="w-full rounded-full bg-[#F7F7F9] py-3 text-[13px] font-medium text-[#111827] active:bg-[#EFEFEF]"
                >
                  再走一遍界面引导
                </Pressable>
              ) : null}
              <Pressable
                type="button"
                onClick={onClose}
                className="w-full rounded-full bg-[#111827] py-3 text-[13px] font-semibold tracking-wide text-white active:opacity-90"
              >
                知道了
              </Pressable>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
