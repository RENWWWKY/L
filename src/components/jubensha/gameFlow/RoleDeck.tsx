import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { DeckRoleCard } from './gameFlowTypes'
import { roleDeckCardLayoutId } from './roleDeckLayout'
import { RoleScriptBook } from './RoleScriptBook'

export type RoleDeckProps = {
  scriptId: string
  cards: DeckRoleCard[]
  onOpenCard: (card: DeckRoleCard) => void
}

const SLIDE_WIDTH = 136
const SLIDE_GAP = 32

function slideStride(): number {
  return SLIDE_WIDTH + SLIDE_GAP
}

export function RoleDeck({ scriptId, cards, onOpenCard }: RoleDeckProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRaf = useRef<number | null>(null)

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const track = trackRef.current
    if (!track) return
    const clamped = Math.max(0, Math.min(index, cards.length - 1))
    const left = clamped * slideStride()
    track.scrollTo({ left, behavior })
    setActiveIndex(clamped)
  }, [cards.length])

  const syncIndexFromScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const idx = Math.round(track.scrollLeft / slideStride())
    const clamped = Math.max(0, Math.min(idx, cards.length - 1))
    setActiveIndex((prev) => (prev === clamped ? prev : clamped))
  }, [cards.length])

  const handleScroll = useCallback(() => {
    if (scrollRaf.current !== null) cancelAnimationFrame(scrollRaf.current)
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = null
      syncIndexFromScroll()
    })
  }, [syncIndexFromScroll])

  useEffect(() => {
    setActiveIndex(0)
    const t = window.setTimeout(() => scrollToIndex(0, 'auto'), 50)
    return () => window.clearTimeout(t)
  }, [scriptId, scrollToIndex])

  useEffect(() => {
    return () => {
      if (scrollRaf.current !== null) cancelAnimationFrame(scrollRaf.current)
    }
  }, [])

  const activeCard = cards[activeIndex]

  const handleConfirm = useCallback(() => {
    if (activeCard) onOpenCard(activeCard)
  }, [activeCard, onOpenCard])

  return (
    <motion.div
      className="flex h-full min-h-0 flex-1 flex-col px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.p
        className="jbs-font-serif jbs-gf-text-muted shrink-0 pt-1 text-center text-[11px] tracking-[0.28em]"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        左右滑动 · 择一卷宗
      </motion.p>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="jbs-gf-carousel-viewport w-full max-w-[100vw]">
          <div
            ref={trackRef}
            className="jbs-gf-carousel-track jbs-hide-scrollbar"
            onScroll={handleScroll}
            role="listbox"
            aria-label="角色剧本卷宗"
          >
            {cards.map((card, index) => {
              const isActive = index === activeIndex
              return (
                <div
                  key={card.id}
                  className="jbs-gf-carousel-slide"
                  role="option"
                  aria-selected={isActive}
                >
                  <motion.button
                    type="button"
                    className="jbs-gf-carousel-slide-btn outline-none"
                    onClick={() => scrollToIndex(index)}
                    animate={{
                      scale: isActive ? 1.06 : 0.9,
                      opacity: isActive ? 1 : 0.45,
                    }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    whileTap={{ scale: isActive ? 1.04 : 0.88 }}
                  >
                    <RoleScriptBook
                      coverImageUrl={card.coverImageUrl}
                      layoutId={
                        isActive ? roleDeckCardLayoutId(scriptId, card.id) : undefined
                      }
                      size="compact"
                      flat
                      alt=""
                    />
                  </motion.button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="shrink-0 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="jbs-gf-carousel-dots flex justify-center gap-2">
          {cards.map((card, index) => (
            <button
              key={card.id}
              type="button"
              onClick={() => scrollToIndex(index)}
              className={`h-1 rounded-full transition-all duration-300 ${
                index === activeIndex ? 'jbs-gf-carousel-dot-active' : 'jbs-gf-carousel-dot'
              }`}
              aria-label={`第 ${index + 1} 卷`}
            />
          ))}
        </div>

        <motion.button
          type="button"
          onClick={handleConfirm}
          disabled={!activeCard}
          className="jbs-gf-carousel-confirm jbs-font-serif mx-auto mt-6 block min-w-[200px] rounded-md px-8 py-3.5 text-[13px] tracking-[0.2em] disabled:opacity-40"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          确认抽选
        </motion.button>

        <p className="jbs-font-serif jbs-gf-text-subtle mt-3 text-center text-[10px] tracking-[0.18em]">
          {activeCard ? `当前：第 ${activeIndex + 1} / ${cards.length} 卷` : null}
        </p>
      </div>
    </motion.div>
  )
}
