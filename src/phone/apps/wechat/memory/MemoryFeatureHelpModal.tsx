import { AnimatePresence, motion } from 'framer-motion'
import { Lightbulb, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Pressable } from '../../../components/Pressable'
import { ARCHIVE_BG } from './memoryArchiveTheme'
import type { MemoryFeatureHelpBlock } from './memoryFeatureHelpTypes'

function HelpBullets({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[20px] bg-white px-4 py-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-gray-100/90">
      <p className="text-[12px] font-semibold tracking-wide text-gray-900">{title}</p>
      <ul className="mt-2.5 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[13px] leading-[1.65] text-gray-600">
            <span
              className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300"
              aria-hidden
            />
            <span className="min-w-0 flex-1">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function HelpTip({ title, text }: { title?: string; text: string }) {
  return (
    <section className="rounded-[20px] bg-amber-50/70 px-4 py-3.5 ring-1 ring-amber-100/90">
      <div className="flex items-start gap-2.5">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600/90" strokeWidth={1.75} aria-hidden />
        <div className="min-w-0 flex-1">
          {title ? <p className="text-[12px] font-semibold text-amber-950/90">{title}</p> : null}
          <p
            className={`text-[13px] leading-[1.65] text-amber-950/75 ${title ? 'mt-1' : ''}`}
          >
            {text}
          </p>
        </div>
      </div>
    </section>
  )
}

export function MemoryFeatureHelpModal({
  open,
  onClose,
  title,
  blocks,
  zIndex = 56000,
}: {
  open: boolean
  onClose: () => void
  title: string
  blocks: MemoryFeatureHelpBlock[]
  zIndex?: number
}) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="memory-feature-help"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-feature-help-title"
          className="fixed inset-0 flex items-end justify-center px-0 sm:items-center sm:px-5"
          style={{ zIndex, background: 'rgba(17,24,39,0.28)' }}
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
            className="flex max-h-[min(88dvh,640px)] w-full max-w-[min(400px,100vw)] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-12px_48px_rgba(0,0,0,0.1)] sm:rounded-[24px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <p
                  id="memory-feature-help-title"
                  className="text-[17px] font-semibold tracking-tight text-gray-900"
                >
                  {title}
                </p>
                <p className="mt-1 text-[12px] text-gray-400">功能说明</p>
              </div>
              <Pressable
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 active:bg-gray-200/80"
                aria-label="关闭"
              >
                <X className="size-[18px]" strokeWidth={1.5} aria-hidden />
              </Pressable>
            </div>

            <div
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 [-webkit-overflow-scrolling:touch]"
              style={{ background: ARCHIVE_BG }}
            >
              {blocks.map((block, i) => {
                if (block.kind === 'text') {
                  return (
                    <p
                      key={`text-${i}`}
                      className="px-0.5 text-[13px] leading-[1.7] text-gray-600"
                    >
                      {block.text}
                    </p>
                  )
                }
                if (block.kind === 'bullets') {
                  return <HelpBullets key={`bullets-${block.title}`} title={block.title} items={block.items} />
                }
                return (
                  <HelpTip
                    key={`tip-${block.title ?? i}`}
                    title={block.title}
                    text={block.text}
                  />
                )
              })}
            </div>

            <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-4">
              <Pressable
                type="button"
                onClick={onClose}
                className="w-full rounded-full bg-gray-900 py-3 text-[13px] font-semibold tracking-wide text-white active:opacity-90"
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
