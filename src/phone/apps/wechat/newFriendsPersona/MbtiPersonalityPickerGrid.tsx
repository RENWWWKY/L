import { Check } from 'lucide-react'
import { MBTI_LIST, type MbtiType } from '../mbtiPersonalityWorldBook'
import { getMbtiTagline4, isLargeMbtiAvatar, resolveMbtiImageUrl } from './mbtiProfileUi'

export function MbtiPersonalityPickerGrid({
  value,
  onSelect,
  className = '',
}: {
  value: string
  onSelect: (mbti: MbtiType) => void
  className?: string
}) {
  return (
    <div className={`grid grid-cols-2 gap-2.5 ${className}`.trim()}>
      {MBTI_LIST.map((m) => {
        const active = value === m
        const src = resolveMbtiImageUrl(m)
        const big = isLargeMbtiAvatar(m)
        const tagline = getMbtiTagline4(m)
        return (
          <button
            key={m}
            type="button"
            aria-pressed={active}
            className={`relative flex items-center gap-2.5 rounded-2xl border px-2.5 py-2.5 text-left transition-all duration-200 ease-out active:scale-[0.98] ${
              active
                ? 'border-[#1c1c1c] bg-[#f7f7f5] shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
                : 'border-[#ececec] bg-white hover:border-[#d8d8d8] hover:bg-[#fcfcfc]'
            }`}
            onClick={() => onSelect(m)}
          >
            {active ? (
              <span
                className="absolute right-2 top-2 flex size-[18px] items-center justify-center rounded-full bg-[#1c1c1c]"
                aria-hidden
              >
                <Check className="size-3 text-white" strokeWidth={2.5} />
              </span>
            ) : null}
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${
                active ? 'border-[#e0e0e0] bg-white' : 'border-[#efefef] bg-[#fafafa]'
              }`}
            >
              {src ? (
                <img
                  src={src}
                  alt=""
                  className={`object-contain ${big ? 'h-11 w-11' : 'h-10 w-10 scale-95'}`}
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <span className="font-mono text-[9px] text-neutral-400">{m}</span>
              )}
            </div>
            <div className="min-w-0 flex-1 pr-5">
              <p
                className={`font-mono text-[13px] font-semibold tracking-[0.08em] ${
                  active ? 'text-[#1c1c1c]' : 'text-[#2c2c2c]'
                }`}
              >
                {m}
              </p>
              {tagline ? (
                <p
                  className={`mt-0.5 text-[11px] leading-snug tracking-[0.12em] ${
                    active ? 'text-[#5c5c5c]' : 'text-[#a3a3a3]'
                  }`}
                >
                  {tagline}
                </p>
              ) : null}
            </div>
          </button>
        )
      })}
    </div>
  )
}
