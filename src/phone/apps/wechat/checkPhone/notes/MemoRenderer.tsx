import { motion } from 'framer-motion'

import type { MemoTextModifier, PrivateMemo } from './memoTypes'
import { FileBlock } from './NoteBlocks/FileBlock'
import { VoiceBlock } from './NoteBlocks/VoiceBlock'

function normalizeTextColor(color?: string): string | undefined {
  if (!color) return undefined
  const v = color.trim()
  if (!v) return undefined
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v)) return v
  if (/^rgb(a)?\(\s*[\d.\s,%]+\)$/.test(v)) return v
  if (/^[a-zA-Z]+$/.test(v)) return v
  return undefined
}

function textModifierClass(modifiers: MemoTextModifier[] = []) {
  return modifiers
    .map((m) => {
      switch (m) {
        case 'bold':
          return 'font-semibold'
        case 'italic':
          return 'italic'
        case 'underline':
          return 'underline underline-offset-2'
        case 'strikethrough':
          return 'line-through text-gray-400'
        case 'highlight-yellow':
          return 'rounded-sm bg-yellow-100 px-1'
        case 'highlight-blue':
          return 'rounded-sm bg-sky-100 px-1'
        case 'highlight-pink':
          return 'rounded-sm bg-pink-100 px-1'
        default:
          return ''
      }
    })
    .join(' ')
}

export function MemoRenderer({ memo }: { memo: PrivateMemo }) {
  const container = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.04,
      },
    },
  } as const

  const item = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 25,
        mass: 0.5,
      },
    },
  } as const

  return (
    <motion.div className="space-y-1" variants={container} initial="hidden" animate="show">
      {memo.blocks.map((block, index) => {
        const key = `${memo.id}-${index}`
        switch (block.type) {
          case 'h1':
            return (
              <motion.h1
                key={key}
                variants={item}
                className="mb-3 mt-1 text-[32px] leading-[1.2] tracking-[0.01em] text-[#141414]"
              >
                {block.content}
              </motion.h1>
            )
          case 'h2':
            return (
              <motion.h2
                key={key}
                variants={item}
                className="mb-2 mt-6 text-[22px] leading-[1.3] text-[#212121]"
              >
                {block.content}
              </motion.h2>
            )
          case 'text':
            return (
              <motion.p
                key={key}
                variants={item}
                className={`my-2 text-[16px] leading-8 text-[#313131] ${textModifierClass(block.modifiers)}`}
                style={normalizeTextColor(block.color) ? { color: normalizeTextColor(block.color) } : undefined}
              >
                {block.content}
              </motion.p>
            )
          case 'image':
            return (
              <motion.button
                key={key}
                type="button"
                variants={item}
                whileTap={{ scale: 0.985 }}
                className="my-4 block w-full overflow-hidden rounded-2xl border border-black/10 bg-black/5 text-left shadow-[0_12px_26px_rgba(0,0,0,0.12)]"
              >
                <img src={block.url} alt={block.caption || '备忘录图片'} className="h-auto w-full object-cover" />
                {block.caption ? <div className="px-3 py-2 text-[12px] text-[#666]">{block.caption}</div> : null}
              </motion.button>
            )
          case 'voice':
            return (
              <motion.div key={key} variants={item}>
                <VoiceBlock duration={block.duration} transcript={block.transcript} />
              </motion.div>
            )
          case 'file':
            return (
              <motion.div key={key} variants={item}>
                <FileBlock fileType={block.fileType} fileName={block.fileName} size={block.size} />
              </motion.div>
            )
          default:
            return null
        }
      })}
    </motion.div>
  )
}

