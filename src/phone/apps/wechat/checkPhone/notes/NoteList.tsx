import { motion } from 'framer-motion'

import type { PrivateMemo } from './memoTypes'

function getMemoPreview(memo: PrivateMemo): string {
  const firstText = memo.blocks.find((b) => b.type === 'text')?.content?.trim()
  if (firstText) return firstText
  const firstHeading = memo.blocks.find((b) => b.type === 'h1' || b.type === 'h2')
  if (firstHeading && 'content' in firstHeading) return firstHeading.content
  const firstVoice = memo.blocks.find((b) => b.type === 'voice')
  if (firstVoice && 'transcript' in firstVoice) return firstVoice.transcript
  return '这条备忘录里藏着一些不想被看见的内容。'
}

export function NoteList({
  notes,
  onOpen,
  emptyHint,
  muted = false,
}: {
  notes: PrivateMemo[]
  onOpen: (memo: PrivateMemo) => void
  emptyHint?: string
  muted?: boolean
}) {
  if (!notes.length) {
    return (
      <div className="px-4 pb-6 pt-8">
        <div className="rounded-2xl border border-black/10 bg-white px-4 py-6 text-center text-[13px] leading-6 whitespace-pre-line text-[#666]">
          {emptyHint || '暂无备忘录'}
        </div>
      </div>
    )
  }
  return (
    <div className="px-4 pb-6 pt-4">
      <div className="space-y-3.5">
        {notes.map((memo) => (
          <motion.button
            key={memo.id}
            type="button"
            layoutId={`memo-card-${memo.id}`}
            whileTap={{ scale: 0.985 }}
            onClick={() => onOpen(memo)}
            className={`relative w-full overflow-hidden rounded-[22px] border px-4 py-4 text-left shadow-[0_4px_20px_rgba(0,0,0,0.03)] ${
              muted ? 'border-gray-200 bg-gray-50/90 saturate-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(252,252,252,0.98)_100%)]" />
            <div className="relative">
              <motion.div
                layoutId={`memo-title-${memo.id}`}
                className={`line-clamp-1 text-[18px] font-medium tracking-[0.01em] ${muted ? 'text-gray-500' : 'text-gray-800'}`}
              >
                {memo.title}
              </motion.div>
              <motion.div
                layoutId={`memo-date-${memo.id}`}
                className={`mt-1 text-[12px] tracking-[0.08em] ${muted ? 'text-gray-400' : 'text-gray-400'}`}
              >
                {memo.date}
              </motion.div>
              <div className={`mt-2.5 line-clamp-2 text-[13px] leading-6 ${muted ? 'text-gray-400' : 'text-gray-600'}`}>
                {getMemoPreview(memo).slice(0, 92)}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

