import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

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
      <div
        className={`absolute inset-x-0 top-full z-20 mt-1 origin-top rounded-2xl border bg-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-[opacity,transform,max-height] duration-200 ease-out ${
          open && !disabled ? 'opacity-100 translate-y-0 max-h-72' : 'pointer-events-none opacity-0 -translate-y-1 max-h-0'
        }`}
        style={{ borderColor: '#e5e5e5', overflow: 'hidden' }}
      >
        <div className="max-h-72 overflow-y-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">{children}</div>
      </div>
    </div>
  )
}
