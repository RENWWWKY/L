import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'

import { Pressable } from '../../../../components/Pressable'
import { MemoRenderer } from './MemoRenderer'
import type { PrivateMemo } from './memoTypes'

function paperStyleFor(memo: PrivateMemo): CSSProperties {
  if (memo.paperStyle === 'lined') {
    return {
      backgroundColor: memo.paperColor,
      backgroundImage: 'linear-gradient(transparent 95%, rgba(156,163,175,0.18) 100%)',
      backgroundSize: '100% 2rem',
    }
  }
  if (memo.paperStyle === 'grid') {
    return {
      backgroundColor: memo.paperColor,
      backgroundImage:
        'linear-gradient(rgba(156,163,175,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(156,163,175,0.12) 1px, transparent 1px)',
      backgroundSize: '22px 22px',
    }
  }
  return { backgroundColor: memo.paperColor }
}

export function NoteDetail({ memo, onBack }: { memo: PrivateMemo; onBack: () => void }) {
  const spring = { type: 'spring', stiffness: 200, damping: 25, mass: 0.5 } as const

  return (
    <motion.div
      layoutId={`memo-card-${memo.id}`}
      className="mx-4 mb-5 mt-3 overflow-hidden rounded-[24px] border border-gray-200"
      style={paperStyleFor(memo)}
      initial={{ opacity: 0, scale: 0.98, boxShadow: '0 0 0px rgba(0,0,0,0)' }}
      animate={{ opacity: 1, scale: 1, boxShadow: '0 10px 40px rgba(0,0,0,0.05)' }}
      exit={{ opacity: 0, scale: 0.985, boxShadow: '0 0 0px rgba(0,0,0,0)' }}
      transition={spring}
    >
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
        <Pressable type="button" onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[#2c2c2c] active:scale-[0.98]">
          <ChevronLeft size={18} />
        </Pressable>
        <div className="text-[11px] tracking-[0.12em] text-[#5c5c5c]">PRIVATE MEMO</div>
        <div className="w-8" />
      </div>

      <div className="px-5 pb-8 pt-4">
        <motion.h1 layoutId={`memo-title-${memo.id}`} className="text-[28px] leading-[1.2] text-[#141414]">
          {memo.title}
        </motion.h1>
        <motion.div layoutId={`memo-date-${memo.id}`} className="mt-2 text-[12px] tracking-[0.08em] text-[#666]">
          {memo.date}
        </motion.div>
        <div className="mt-5">
          <MemoRenderer memo={memo} />
        </div>
      </div>
    </motion.div>
  )
}

