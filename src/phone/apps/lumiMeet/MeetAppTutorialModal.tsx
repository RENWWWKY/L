import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Pressable } from '../../components/Pressable'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import { MEET_APP_TUTORIAL_SECTIONS } from './meetAppTutorialCopy'
import { MeetTutorialHighlightText } from './meetTutorialHighlight'

export type MeetAppTutorialModalProps = {
  open: boolean
  onClose: () => void
  onStartLiveCoach?: () => void
}

export function MeetAppTutorialModalPortal({ open, onClose, onStartLiveCoach }: MeetAppTutorialModalProps) {
  const el = getLumiMeetPortalTarget()
  if (!el) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="meet-app-tutorial"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meet-app-tutorial-title"
          className="fixed inset-0 z-[395] flex items-end justify-center bg-black/30 px-0 sm:items-center sm:px-5"
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
            className="flex max-h-[min(88dvh,680px)] w-full max-w-[min(400px,100vw)] flex-col overflow-hidden rounded-t-[20px] border-[0.5px] border-[#e8e4dc] bg-[#fdfcfa] shadow-[0_-12px_48px_rgba(22,18,14,0.12)] sm:rounded-[18px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#ebe7e0] px-5 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <BookOpen className="size-4 shrink-0 text-[#b8973a]" strokeWidth={1.5} aria-hidden />
                <div className="min-w-0">
                  <p id="meet-app-tutorial-title" className="text-[13px] font-medium tracking-[0.12em] text-[#b8973a]">
                    遇见 · 新手说明
                  </p>
                  <p className="mt-0.5 text-[11px] tracking-[0.04em] text-[#9a9590]">匹配、聊天、资料与加微信</p>
                </div>
              </div>
              <Pressable
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ebe7e0] bg-white text-[#6e6860] active:bg-[#f4f2ee]"
                aria-label="关闭"
              >
                <X className="size-[18px]" strokeWidth={1.5} aria-hidden />
              </Pressable>
            </div>

            <div className="meet-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4 [-webkit-overflow-scrolling:touch]">
              <p className="font-dossier-serif text-[14px] leading-relaxed tracking-[0.04em] text-[#4a463f]">
                按下面顺序看一遍，就能玩转遇见：从匹配、自定义筛选，到临时聊天、编辑假面，再到和微信衔接。
              </p>
              <ol className="mt-5 space-y-5">
                {MEET_APP_TUTORIAL_SECTIONS.map((sec, i) => (
                  <li key={sec.title} className="list-none">
                    <p className="text-[10px] font-medium tracking-[0.16em] text-[#b8973a]">
                      {String(i + 1).padStart(2, '0')} · {sec.title}
                    </p>
                    <p className="mt-2 font-dossier-serif text-[13px] leading-[1.75] tracking-[0.03em] text-[#5b574f]">
                      <MeetTutorialHighlightText text={sec.body} />
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="shrink-0 space-y-2 border-t border-[#ebe7e0] px-5 py-4">
              {onStartLiveCoach ? (
                <Pressable
                  type="button"
                  onClick={() => {
                    onClose()
                    onStartLiveCoach()
                  }}
                  className="w-full rounded-full border border-[#D4AF37]/50 bg-[#faf6ee] py-3 text-[13px] tracking-[0.06em] text-[#8a7340] active:bg-[#f3ebe0]"
                >
                  再走一遍界面引导
                </Pressable>
              ) : null}
              <Pressable
                type="button"
                onClick={onClose}
                className="w-full rounded-full border-[0.5px] border-[#1a1918] bg-[#141312] py-3 text-[13px] tracking-[0.08em] text-[#f7f4ef] active:opacity-90"
              >
                知道了
              </Pressable>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    el,
  )
}
