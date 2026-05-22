import { motion } from 'framer-motion'
import { useMemo } from 'react'

import { bookCoverLayoutId } from './bookCoverLayout'
import type { JubenshaScript } from './types'

function lorePreviewLines(lore: string, maxChars = 118): string[] {
  const flat = lore.replace(/\s+/g, ' ').trim()
  if (!flat) return []
  const clipped = flat.length > maxChars ? `${flat.slice(0, maxChars)}…` : flat
  const chunk = 38
  const lines: string[] = []
  for (let i = 0; i < clipped.length && lines.length < 4; i += chunk) {
    lines.push(clipped.slice(i, i + chunk))
  }
  return lines
}

function FlipBookInnerGhost({
  script,
  coverOpen,
}: {
  script: JubenshaScript
  coverOpen: boolean
}) {
  const loreLines = useMemo(() => lorePreviewLines(script.loreIntro), [script.loreIntro])
  const roleHints = useMemo(() => script.roles.slice(0, 4).map((r) => `${r.name} · ${r.gender}`), [script.roles])

  return (
    <div
      className={`jbs-flip-inner-ghost ${coverOpen ? 'jbs-flip-inner-ghost--open' : ''}`}
      aria-hidden
    >
      <p className="jbs-flip-inner-ghost-kicker jbs-font-serif">卷首</p>
      <h2 className="jbs-flip-inner-ghost-title jbs-font-handwriting">{script.title}</h2>
      {script.subtitle ? (
        <p className="jbs-flip-inner-ghost-sub jbs-font-serif">{script.subtitle}</p>
      ) : null}

      <div className="jbs-flip-inner-ghost-body">
        {loreLines.map((line, i) => (
          <p key={`lore-${i}`} className="jbs-flip-inner-ghost-line jbs-font-serif">
            {line}
          </p>
        ))}
      </div>

      <p className="jbs-flip-inner-ghost-kicker jbs-font-serif mt-auto">人物</p>
      <ul className="jbs-flip-inner-ghost-roles">
        {roleHints.map((hint) => (
          <li key={hint} className="jbs-flip-inner-ghost-line jbs-font-serif">
            {hint}
          </li>
        ))}
      </ul>

      <p className="jbs-flip-inner-ghost-fade jbs-font-serif">……墨迹未干，待展卷细读……</p>
    </div>
  )
}

export type FlipBookOpenProps = {
  script: JubenshaScript
  /** 封面是否向左翻开 */
  coverOpen: boolean
  /** 是否使用 layoutId（从书架飞入时 true） */
  sharedLayout?: boolean
  scale?: number
}

function CoverImage({ script }: { script: JubenshaScript }) {
  if (script.coverImageUrl) {
    return <img src={script.coverImageUrl} alt="" className="h-full w-full object-cover" />
  }
  return (
    <div
      className="h-full w-full"
      style={{ background: 'linear-gradient(160deg, #3d2a22 0%, #1a1a1a 100%)' }}
      aria-hidden
    />
  )
}

export function FlipBookOpen({
  script,
  coverOpen,
  sharedLayout = true,
  scale = 1,
}: FlipBookOpenProps) {
  const coverInner = sharedLayout ? (
    <motion.div
      layoutId={bookCoverLayoutId(script.id)}
      className="absolute inset-0"
      transition={{ type: 'spring', stiffness: 280, damping: 32 }}
    >
      <CoverImage script={script} />
    </motion.div>
  ) : (
    <div className="absolute inset-0">
      <CoverImage script={script} />
    </div>
  )

  return (
    <div className="jbs-flip-scene">
      <motion.div
        className="jbs-flip-book"
        initial={{ scale: 0.88 }}
        animate={{ scale }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        <div className="jbs-flip-inner-page" aria-hidden={!coverOpen}>
          <FlipBookInnerGhost script={script} coverOpen={coverOpen} />
        </div>

        <motion.div
          className="jbs-flip-cover-wrap"
          style={{ transformStyle: 'preserve-3d' }}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: coverOpen ? -100 : 0 }}
          transition={{ duration: 0.9, ease: [0.33, 1, 0.68, 1] }}
        >
          <div className="jbs-flip-cover-face jbs-flip-cover-photo overflow-hidden">
            {coverInner}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"
              aria-hidden
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
