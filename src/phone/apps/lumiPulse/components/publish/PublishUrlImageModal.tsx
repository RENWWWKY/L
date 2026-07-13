import { motion } from 'framer-motion'
import { Link2, X } from 'lucide-react'
import { useState } from 'react'

import { Pressable } from '../../../../components/Pressable'

function isValidImageUrl(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  if (t.startsWith('data:image/')) return true
  try {
    const u = new URL(t)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function PublishUrlImageModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (url: string) => void
}) {
  const [url, setUrl] = useState('')
  const valid = isValidImageUrl(url)

  return (
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[1290] bg-black/25 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-label="关闭"
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-x-4 top-[22%] z-[1300] mx-auto max-w-md rounded-[24px] bg-white/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-neutral-400" strokeWidth={1.5} />
            <p className="text-[14px] font-medium text-[#1C1C1E]">图片链接</p>
          </div>
          <Pressable type="button" onClick={onClose} className="text-neutral-400" aria-label="关闭">
            <X className="size-5" strokeWidth={1.5} />
          </Pressable>
        </div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… 或 data:image/…"
          className="w-full rounded-2xl bg-[#F8F8F7] px-4 py-3 text-[14px] text-[#1C1C1E] outline-none placeholder:text-neutral-300"
          autoFocus
        />
        <Pressable
          type="button"
          disabled={!valid}
          onClick={() => onSubmit(url.trim())}
          className="mt-4 w-full rounded-full bg-[#1C1C1E] py-3 text-[13px] font-medium text-white disabled:opacity-35"
        >
          添加图片
        </Pressable>
      </motion.div>
    </>
  )
}
