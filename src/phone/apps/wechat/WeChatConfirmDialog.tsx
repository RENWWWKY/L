import { useId } from 'react'

import { Pressable } from '../../components/Pressable'

export function WeChatConfirmDialog({
  open,
  title,
  description,
  cancelText = '取消',
  confirmText = '删除',
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  cancelText?: string
  confirmText?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const titleId = useId()
  const descId = useId()
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1210] flex items-center justify-center bg-black/50 px-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-[360px] overflow-hidden rounded-[16px] bg-white shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 pb-4 pt-5">
          <h2 id={titleId} className="text-center text-[16px] font-semibold text-[#111]">
            {title}
          </h2>
          <p id={descId} className="mt-2 text-center text-[13px] leading-relaxed text-[#666]">
            {description}
          </p>
        </div>
        <div className="grid grid-cols-2 border-t border-[#e5e5e5]">
          <Pressable
            type="button"
            className="h-[48px] text-[15px] text-[#111] active:bg-[#f5f5f5]"
            onClick={onCancel}
          >
            {cancelText}
          </Pressable>
          <Pressable
            type="button"
            className="h-[48px] border-l border-[#e5e5e5] text-[15px] text-[#111] active:bg-[#f5f5f5]"
            onClick={onConfirm}
          >
            {confirmText}
          </Pressable>
        </div>
      </div>
    </div>
  )
}

