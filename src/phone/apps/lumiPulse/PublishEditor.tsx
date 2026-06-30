import { motion } from 'framer-motion'
import { useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { PULSE_COLORS, PULSE_MODAL_SPRING } from './constants'
import { usePulseStore } from './usePulseStore'

export function PublishEditor({
  authorPovId,
  authorName,
  authorAvatarUrl,
  onClose,
  onPublished,
}: {
  authorPovId: string
  authorName: string
  authorAvatarUrl?: string
  onClose: () => void
  onPublished: () => void
}) {
  const [text, setText] = useState('')
  const publishPost = usePulseStore((s) => s.publishPost)

  const submit = () => {
    const content = text.trim()
    if (!content) return
    publishPost({ authorPovId, authorName, authorAvatarUrl, content })
    onPublished()
  }

  return (
    <motion.div
      className="fixed inset-0 z-[1250] flex flex-col bg-[#FCFCFC]"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={PULSE_MODAL_SPRING}
    >
      <header
        className="flex items-center justify-between bg-white/90 px-4 py-3 backdrop-blur-xl"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable type="button" onClick={onClose} className="text-[13px] text-neutral-500">
          取消
        </Pressable>
        <span className="text-[11px] uppercase tracking-[0.24em] text-neutral-400">Publish</span>
        <Pressable
          type="button"
          disabled={!text.trim()}
          onClick={submit}
          className="text-[13px] font-medium text-[#1C1C1E] disabled:opacity-30"
        >
          发布
        </Pressable>
      </header>
      <div className="flex flex-1 flex-col px-4 pt-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="此刻想说…"
          className="min-h-[40vh] w-full flex-1 resize-none bg-transparent font-serif text-[17px] leading-relaxed text-[#1C1C1E] outline-none placeholder:text-neutral-300"
          autoFocus
        />
        <p className="pb-4 text-[11px] text-neutral-400" style={{ color: PULSE_COLORS.muted }}>
          脉冲 · 以衬线体记录每一次呼吸
        </p>
      </div>
    </motion.div>
  )
}
