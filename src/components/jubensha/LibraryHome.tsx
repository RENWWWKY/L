import type { JubenshaScript, ShelfConfig } from './types'
import { ScriptBookCard } from './ScriptBookCard'

export const LIBRARY_SHELVES: ShelfConfig[] = [
  { id: 'tears', labelZh: '情感', labelEn: 'Tears', watermark: '泪' },
  { id: 'suspense', labelZh: '悬疑', labelEn: 'Suspense', watermark: '疑' },
  { id: 'casual', labelZh: '轻松', labelEn: 'Casual', watermark: '闲' },
  { id: 'horror', labelZh: '恐怖', labelEn: 'Horror', watermark: '惧' },
]

export type LibraryHomeProps = {
  scripts: JubenshaScript[]
  onSelectScript: (script: JubenshaScript) => void
}

export function LibraryHome({ scripts, onSelectScript }: LibraryHomeProps) {
  return (
    <div className="pb-10 pt-2">
      <p className="jbs-font-serif px-4 pb-6 text-center text-[11px] tracking-[0.35em] text-[#1a1a1a]/45">
        典藏书架 · The Collected Shelves
      </p>

      {LIBRARY_SHELVES.map((shelf) => {
        const books = scripts.filter((s) => s.shelfCategory === shelf.id)
        if (books.length === 0) return null

        return (
          <section key={shelf.id} className="relative mb-10">
            <div className="relative px-4 pb-3">
              <span
                className="jbs-shelf-watermark absolute -left-1 top-[-8px] text-[72px] leading-none"
                aria-hidden
              >
                {shelf.watermark}
              </span>
              <h2 className="jbs-font-handwriting relative text-[32px] leading-none text-[#1a1a1a]">
                {shelf.labelZh}
                <span className="jbs-font-serif ml-2 text-[14px] font-normal tracking-[0.2em] text-[#1a1a1a]/50">
                  / {shelf.labelEn}
                </span>
              </h2>
            </div>

            <div
              className="jbs-hide-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2"
              role="list"
            >
              {books.map((script) => (
                <ScriptBookCard key={script.id} script={script} onSelect={onSelectScript} />
              ))}
            </div>

            <div className="mx-4 mt-4 h-px bg-gradient-to-r from-transparent via-[#5c3d2e]/25 to-transparent" />
          </section>
        )
      })}
    </div>
  )
}
