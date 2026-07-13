import { X } from 'lucide-react'
import { motion } from 'framer-motion'

import { Pressable } from '../../../../components/Pressable'

/** 已选图片预览网格（仅展示，添加入口在工具栏图片按钮） */
export function PublishMediaMatrix({
  urls,
  adding,
  onRemove,
}: {
  urls: string[]
  adding: boolean
  onRemove: (index: number) => void
}) {
  if (!urls.length) return null

  return (
    <div className="px-6 pb-4">
      <div className="grid grid-cols-3 gap-2">
        {urls.map((url, index) => (
          <motion.div
            key={`${url.slice(0, 32)}-${index}`}
            layout
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative aspect-square overflow-hidden rounded-2xl bg-[#F5F5F4] shadow-sm"
          >
            <img src={url} alt="" className="size-full object-cover" draggable={false} />
            <Pressable
              type="button"
              onClick={() => onRemove(index)}
              className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
              aria-label="移除图片"
            >
              <X className="size-3" strokeWidth={2.5} />
            </Pressable>
          </motion.div>
        ))}
      </div>
      {adding ? (
        <p className="mt-2 text-center text-[11px] text-neutral-400">图片处理中…</p>
      ) : null}
    </div>
  )
}
