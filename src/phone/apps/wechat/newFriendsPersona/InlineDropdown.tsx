import { ChevronDown } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useMemo } from 'react'

/**
 * 全站统一的「拉取面板」：圆角描边按钮 + 下箭头 + 浮层列表（圆角、阴影、展开动画）。
 * 人设 MBTI、玩家身份 MBTI、弹幕配置选角色等场景均使用本组件，新增下拉请优先复用。
 */
export function InlineDropdown({
  label,
  valueText,
  open,
  onToggle,
  disabled = false,
  children,
}: {
  label: string
  valueText: string
  open: boolean
  onToggle: () => void
  /** 为 true 时不展开，样式与禁用一致（如无数据时） */
  disabled?: boolean
  children: ReactNode
}) {
  const modal = useMemo(() => {
    if (!open || disabled) return null
    if (typeof document === 'undefined') return null
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4"
        onMouseDown={() => {
          // 点击遮罩关闭（由父组件控制 open 状态）
          onToggle()
        }}
      >
        <div
          className="w-full max-w-[520px] overflow-hidden rounded-2xl border bg-white shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
          style={{ borderColor: '#e5e5e5' }}
          onMouseDown={(e) => {
            // 阻止冒泡，避免点选内容时触发关闭
            e.stopPropagation()
          }}
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: '#f0f0f0' }}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold" style={{ color: '#000000' }}>
                {label}
              </p>
              <p className="mt-0.5 truncate text-[12px]" style={{ color: '#666666' }}>
                {valueText}
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl px-3 py-1.5 text-[12px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
              style={{ color: '#666666' }}
              onClick={onToggle}
            >
              关闭
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {children}
          </div>
        </div>
      </div>,
      document.body,
    )
  }, [open, disabled, children, label, valueText, onToggle])

  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        disabled={disabled}
        className="relative flex w-full items-center justify-center gap-1 rounded-xl border bg-white px-3 py-3 text-[15px] outline-none transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60"
        style={{ borderColor: '#e5e5e5', color: '#000000' }}
        onClick={disabled ? undefined : onToggle}
        aria-label={label}
        aria-expanded={open}
      >
        <span className="pointer-events-none select-none text-center">{valueText}</span>
        <ChevronDown
          className={`pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 transition-transform duration-200 ${
            open && !disabled ? 'rotate-180' : 'rotate-0'
          }`}
          style={{ color: '#666666' }}
        />
      </button>
      {modal}
    </div>
  )
}
