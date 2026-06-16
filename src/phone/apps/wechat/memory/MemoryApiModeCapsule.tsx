import { motion } from 'framer-motion'

export type MemoryApiMode = 'main' | 'dedicated'

const OPTIONS: ReadonlyArray<{ id: MemoryApiMode; label: string }> = [
  { id: 'main', label: '聊天主接口' },
  { id: 'dedicated', label: '专用副接口' },
]

export function MemoryApiModeCapsule({
  value,
  onChange,
  disabled,
  layoutId,
  'aria-label': ariaLabel = '接口来源',
}: {
  value: MemoryApiMode
  onChange: (mode: MemoryApiMode) => void
  disabled?: boolean
  /** 同一页多个胶囊时需不同 layoutId，避免滑动指示器串位 */
  layoutId: string
  'aria-label'?: string
}) {
  return (
    <nav
      className={`flex rounded-full bg-gray-100/80 p-1 ${disabled ? 'opacity-50' : ''}`}
      aria-label={ariaLabel}
      role="tablist"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={`relative min-w-0 flex-1 rounded-full px-3 py-2.5 text-center text-[12px] transition-colors ${
              active ? 'font-semibold text-gray-900' : 'font-normal text-gray-500'
            } ${disabled ? 'cursor-not-allowed' : ''}`}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative z-10 whitespace-nowrap">{opt.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
