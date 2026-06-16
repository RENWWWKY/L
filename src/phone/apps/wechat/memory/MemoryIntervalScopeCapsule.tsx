import type { AutoSummaryIntervalScope } from './memoryAutoSummaryInterval'

const OPTIONS: ReadonlyArray<{ id: AutoSummaryIntervalScope; label: string }> = [
  { id: 'global', label: '全局统一' },
  { id: 'per_character', label: '按角色单独' },
]

export function MemoryIntervalScopeCapsule({
  value,
  onChange,
  disabled,
}: {
  value: AutoSummaryIntervalScope
  onChange: (scope: AutoSummaryIntervalScope) => void
  disabled?: boolean
}) {
  return (
    <nav
      className={`grid grid-cols-2 gap-1 rounded-full bg-gray-100/80 p-1 ${disabled ? 'opacity-50' : ''}`}
      aria-label="总结间隔配置范围"
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
            className={`relative rounded-full px-3 py-2 text-center text-[12px] transition-colors ${
              active ? 'font-semibold text-gray-900' : 'font-normal text-gray-500'
            } ${disabled ? 'cursor-not-allowed' : ''}`}
          >
            {active ? <span className="absolute inset-0 rounded-full bg-white shadow-sm" /> : null}
            <span className="relative z-10 whitespace-nowrap">{opt.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
