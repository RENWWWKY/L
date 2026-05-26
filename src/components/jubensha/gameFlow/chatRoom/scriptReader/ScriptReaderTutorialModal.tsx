import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

export function ScriptReaderTutorialModal({
  open,
  onClose,
  sections,
  onStartLiveCoach,
  zIndex = 85500,
}: {
  open: boolean
  onClose: () => void
  sections: { title: string; body: string }[]
  onStartLiveCoach?: () => void
  zIndex?: number
}) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="script-tutorial"
          role="dialog"
          aria-modal="true"
          aria-labelledby="script-tutorial-title"
          className="fixed inset-0 flex items-end justify-center px-0 sm:items-center sm:px-5"
          style={{ zIndex, background: 'rgba(8,6,4,0.55)' }}
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
            className="jbs-script-tutorial-sheet flex max-h-[min(88dvh,620px)] w-full max-w-[min(400px,100vw)] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#c4a876]/15 px-5 py-4">
              <div>
                <p id="script-tutorial-title" className="jbs-script-book-tag !animate-none">
                  SCRIPT ANNOTATION
                </p>
                <p className="jbs-font-serif mt-1 text-[15px] tracking-[0.06em] text-[#f0e8d8]/92">
                  正文高亮与标注
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="jbs-script-tutorial-secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                aria-label="关闭"
              >
                <X className="size-[18px]" strokeWidth={1.5} aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [-webkit-overflow-scrolling:touch]">
              <ol className="space-y-5">
                {sections.map((sec, i) => (
                  <li key={sec.title} className="list-none">
                    <p className="jbs-font-serif text-[9px] tracking-[0.2em] text-[#c4a876]/50">
                      {String(i + 1).padStart(2, '0')} · {sec.title}
                    </p>
                    <p className="jbs-font-serif mt-2 text-[12px] leading-[1.75] text-[#d8ccb8]/88">
                      {sec.body}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="shrink-0 space-y-2 border-t border-[#c4a876]/12 px-5 py-4">
              {onStartLiveCoach ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onStartLiveCoach()
                  }}
                  className="jbs-script-tutorial-secondary w-full rounded-full py-2.5 text-[12px] tracking-[0.08em]"
                >
                  再走一遍界面引导
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="jbs-script-tutorial-primary w-full rounded-full py-2.5 text-[12px] tracking-[0.1em]"
              >
                知道了
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
