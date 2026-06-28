import type { MemoryEmbeddingProviderMode } from './memoryEmbeddingProvider'

const OPTIONS: ReadonlyArray<{ id: MemoryEmbeddingProviderMode; label: string; hint?: string }> = [
  { id: 'auto', label: '自动', hint: '本地优先' },
  { id: 'local', label: '仅本地' },
  { id: 'api', label: '仅 API' },
]

export function MemoryEmbeddingProviderCapsule({
  value,
  onChange,
  disabled,
}: {
  value: MemoryEmbeddingProviderMode
  onChange: (mode: MemoryEmbeddingProviderMode) => void
  disabled?: boolean
}) {
  return (
    <nav
      className={`grid grid-cols-3 gap-1 rounded-2xl bg-gray-100/80 p-1 ${disabled ? 'opacity-50' : ''}`}
      aria-label="向量计算方式"
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
            className={`relative rounded-xl px-2 py-2.5 text-center transition-colors ${
              active ? 'font-semibold text-gray-900' : 'font-normal text-gray-500'
            } ${disabled ? 'cursor-not-allowed' : ''}`}
          >
            {active ? <span className="absolute inset-0 rounded-xl bg-white shadow-sm" aria-hidden /> : null}
            <span className="relative z-10 block text-[12px] leading-tight">{opt.label}</span>
            {opt.hint ? (
              <span className="relative z-10 mt-0.5 block text-[10px] font-normal text-gray-400">{opt.hint}</span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
