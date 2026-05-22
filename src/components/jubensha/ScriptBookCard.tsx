import { motion } from 'framer-motion'

import { bookCoverLayoutId } from './bookCoverLayout'
import { StarRating } from './StarRating'
import type { JubenshaScript } from './types'

function PlayersIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="16" cy="9" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M4 18c0-2.5 2.2-4 5-4s5 1.5 5 4M13 18c0-1.8 1.6-3 3.5-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export type ScriptBookCardProps = {
  script: JubenshaScript
  onSelect: (script: JubenshaScript) => void
}

export function ScriptBookCard({ script, onSelect }: ScriptBookCardProps) {
  return (
    <article className="w-[120px] shrink-0 snap-start">
      <button
        type="button"
        onClick={() => onSelect(script)}
        className="group w-full text-left outline-none"
      >
        <div className="flex flex-col items-center">
          <div className="jbs-book-perspective flex justify-center">
            <div className="jbs-physical-book">
              <div className="jbs-physical-book-face jbs-physical-book-cover">
                <motion.div
                  layoutId={bookCoverLayoutId(script.id)}
                  className="absolute inset-0"
                  transition={{ type: 'spring', stiffness: 280, damping: 32 }}
                >
                  {script.coverImageUrl ? (
                    <img
                      src={script.coverImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{ background: 'linear-gradient(160deg, #3d2a22 0%, #1a1a1a 100%)' }}
                      aria-hidden
                    />
                  )}
                </motion.div>
              </div>
            </div>
          </div>
          <h3 className="jbs-font-serif mt-2 max-w-[112px] text-center text-[13px] font-medium leading-snug tracking-wide text-[#1a1a1a]">
            {script.title}
          </h3>
        </div>

        <div className="mt-1.5 space-y-1 px-0.5 font-serif text-[10px] leading-relaxed text-[#1a1a1a]/80">
          <p className="flex items-center gap-1">
            <PlayersIcon className="text-[#5c3d2e]" />
            <span>[ {script.maleCount}男{script.femaleCount}女 ]</span>
          </p>
          <p>
            <StarRating label="推理" value={script.logicDifficulty} />
          </p>
          <p>
            <StarRating label="情感" value={script.tearsDepth} />
          </p>
        </div>
      </button>
    </article>
  )
}
