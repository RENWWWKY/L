import { LOCAL_EMBEDDING_MODEL_OPTIONS, normalizeLocalEmbeddingModelId } from './memoryEmbeddingConstants'

export function MemoryLocalEmbeddingModelPicker({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled?: boolean
  onChange: (modelId: string) => void
}) {
  const selected = normalizeLocalEmbeddingModelId(value)

  return (
    <div className="space-y-2" role="radiogroup" aria-label="本地向量模型">
      {LOCAL_EMBEDDING_MODEL_OPTIONS.map((opt) => {
        const active = opt.id === selected
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={`w-full rounded-xl border bg-white px-3.5 py-3 text-left transition-colors ${
              active
                ? 'border-gray-900 ring-1 ring-gray-900/10'
                : 'border-gray-200 hover:border-gray-400'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  active ? 'border-gray-900' : 'border-gray-300'
                }`}
                aria-hidden
              >
                {active ? <span className="h-2 w-2 rounded-full bg-gray-900" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-gray-900">{opt.title}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-500">{opt.subtitle}</span>
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
