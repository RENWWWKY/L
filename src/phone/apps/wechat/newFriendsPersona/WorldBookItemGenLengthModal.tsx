import { useEffect, useId, useState } from 'react'

import {
  WB_ITEM_GEN_DEFAULT_CHARS,
  WB_ITEM_GEN_MAX_CHARS,
  WB_ITEM_GEN_MIN_CHARS,
  clampWbItemGenTargetChars,
} from './worldBookItemGenConstants'

type Props = {
  open: boolean
  onClose: () => void
  /** 目标字数（已 clamp） */
  onConfirm: (targetChineseChars: number) => void
}

export function WorldBookItemGenLengthModal({ open, onClose, onConfirm }: Props) {
  const titleId = useId()
  const [draft, setDraft] = useState(String(WB_ITEM_GEN_DEFAULT_CHARS))

  useEffect(() => {
    if (open) setDraft(String(WB_ITEM_GEN_DEFAULT_CHARS))
  }, [open])

  if (!open) return null

  const parsed = Number(draft.replace(/\s/g, ''))
  const fromInput = clampWbItemGenTargetChars(Number.isFinite(parsed) ? parsed : WB_ITEM_GEN_DEFAULT_CHARS)

  return (
    <div
      className="fixed inset-0 z-[1210] flex items-center justify-center bg-black/50 px-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[380px] rounded-[16px] border bg-white p-5 shadow-lg"
        style={{ borderColor: '#e5e5e5' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-center text-[16px] font-semibold text-[#111]">
          生成条目字数
        </h2>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-[#666]">
          填写希望生成的大致长度（汉字约数，含标点）。点「使用默认」则按 {WB_ITEM_GEN_DEFAULT_CHARS} 字生成。
        </p>

        <label className="mt-4 block">
          <span className="text-[12px] text-[#666]">目标字数</span>
          <input
            type="number"
            min={WB_ITEM_GEN_MIN_CHARS}
            max={WB_ITEM_GEN_MAX_CHARS}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="mt-1 w-full rounded-[12px] border border-[#e5e5e5] px-3 py-2.5 text-[15px] text-[#111] outline-none"
          />
          <span className="mt-1 block text-[11px] text-[#999]">
            允许范围 {WB_ITEM_GEN_MIN_CHARS}～{WB_ITEM_GEN_MAX_CHARS}，确认时会自动取整并限制在范围内。
          </span>
        </label>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="order-3 flex-1 rounded-[12px] border border-[#e5e5e5] bg-white px-4 py-2.5 text-[13px] text-[#333] transition-colors hover:bg-[#fafafa] sm:order-1"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(WB_ITEM_GEN_DEFAULT_CHARS)
            }}
            className="order-2 flex-1 rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] px-4 py-2.5 text-[13px] text-[#111] transition-colors hover:bg-[#f0f0f0]"
          >
            使用默认（{WB_ITEM_GEN_DEFAULT_CHARS} 字）
          </button>
          <button
            type="button"
            onClick={() => onConfirm(fromInput)}
            className="order-1 flex-1 rounded-[12px] bg-[#111] px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#000] sm:order-3"
          >
            按填写字数生成
          </button>
        </div>
      </div>
    </div>
  )
}
