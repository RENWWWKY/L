import type { JubenshaScript } from './types'

export type BookmarkSlipCardProps = {
  script: JubenshaScript
  onSelect: (script: JubenshaScript) => void
}

export function BookmarkSlipCard({ script, onSelect }: BookmarkSlipCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(script)}
      className="flex w-[200px] shrink-0 snap-start items-stretch overflow-hidden rounded-sm border border-[#5c3d2e]/20 bg-[#fffef9] text-left shadow-sm transition-shadow hover:shadow-md outline-none"
    >
      <div className="w-[52px] shrink-0 border-r border-[#5c3d2e]/15 bg-[#1a1a1a]">
        {script.coverImageUrl ? (
          <img src={script.coverImageUrl} alt="" className="h-full min-h-[64px] w-full object-cover" />
        ) : (
          <div
            className="min-h-[64px] w-full"
            style={{ background: 'linear-gradient(160deg, #3d2a22, #1a1a1a)' }}
            aria-hidden
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2.5">
        <p className="jbs-font-serif line-clamp-2 text-[13px] font-medium leading-snug text-[#1a1a1a]">
          {script.title}
        </p>
        {script.subtitle ? (
          <p className="mt-0.5 line-clamp-1 jbs-font-serif text-[10px] italic text-[#5c3d2e]/65">
            {script.subtitle}
          </p>
        ) : null}
      </div>
    </button>
  )
}
