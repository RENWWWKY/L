import { motion } from 'framer-motion'
import { ImagePlus, Link2, Sparkles, X } from 'lucide-react'

import { Pressable } from '../../../../components/Pressable'
import { PULSE_COLORS, PULSE_SHEET_SPRING } from '../../constants'

export function PublishImagePickerSheet({
  onPickLocal,
  onPickUrl,
  onPickAi,
  onClose,
}: {
  onPickLocal: () => void
  onPickUrl: () => void
  onPickAi: () => void
  onClose: () => void
}) {
  return (
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[1270] bg-black/20 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-label="关闭"
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-[1280] overflow-hidden rounded-t-[28px] bg-white/95 shadow-[0_-12px_48px_rgba(0,0,0,0.08)] backdrop-blur-xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={PULSE_SHEET_SPRING}
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <p className="text-[13px] font-medium text-[#1C1C1E]">添加图片</p>
          <Pressable type="button" onClick={onClose} className="text-neutral-400" aria-label="关闭">
            <X className="size-5" strokeWidth={1.5} />
          </Pressable>
        </div>
        <div className="grid gap-2 px-4 pb-2">
          <Pressable
            type="button"
            onClick={onPickLocal}
            className="flex items-center gap-3 rounded-2xl bg-[#FAFAFA] px-4 py-3.5 text-left active:bg-[#F0F0EF]"
          >
            <ImagePlus className="size-5 text-neutral-400" strokeWidth={1.25} />
            <div>
              <p className="text-[14px] text-[#1C1C1E]">本地相册</p>
              <p className="text-[11px] text-neutral-400">从设备选择照片</p>
            </div>
          </Pressable>
          <Pressable
            type="button"
            onClick={onPickUrl}
            className="flex items-center gap-3 rounded-2xl bg-[#FAFAFA] px-4 py-3.5 text-left active:bg-[#F0F0EF]"
          >
            <Link2 className="size-5 text-neutral-400" strokeWidth={1.25} />
            <div>
              <p className="text-[14px] text-[#1C1C1E]">图片链接</p>
              <p className="text-[11px] text-neutral-400">粘贴 URL 或 data 地址</p>
            </div>
          </Pressable>
          <Pressable
            type="button"
            onClick={onPickAi}
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#FAFAF9] to-[#F5F3EF] px-4 py-3.5 text-left active:opacity-90"
          >
            <Sparkles className="size-5" style={{ color: PULSE_COLORS.lightGold }} strokeWidth={1.5} />
            <div>
              <p className="text-[14px] text-[#1C1C1E]">AI 纪实生图</p>
              <p className="text-[11px] text-neutral-400">英文 Prompt 生成配图</p>
            </div>
          </Pressable>
        </div>
      </motion.div>
    </>
  )
}
