import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { JubenshaScript } from '../types'

import type { DeckRoleCard } from './gameFlowTypes'
import { RoleFlipBook } from './RoleFlipBook'

export type RoleScriptDetailProps = {
  script: JubenshaScript
  card: DeckRoleCard
  onReturn: () => void
  onLockIn: () => void
}

type FlipPhase = 'fly' | 'flip' | 'open'

export function RoleScriptDetail({ script, card, onReturn, onLockIn }: RoleScriptDetailProps) {
  const [flipPhase, setFlipPhase] = useState<FlipPhase>('fly')
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    setFlipPhase('fly')
    setClosing(false)
    const t1 = window.setTimeout(() => setFlipPhase('flip'), 480)
    const t2 = window.setTimeout(() => setFlipPhase('open'), 1280)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [card.id])

  const handleReturn = useCallback(() => {
    setClosing(true)
    setFlipPhase('fly')
    window.setTimeout(onReturn, 480)
  }, [onReturn])

  const showFlip = flipPhase !== 'open' || closing
  const showPanel = flipPhase === 'open' && !closing

  return (
    <motion.div
      className="absolute inset-0 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <AnimatePresence>
        {showFlip ? (
          <motion.div
            key="flip-stage"
            className="jbs-gf-flip-stage absolute inset-0 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <button
              type="button"
              onClick={handleReturn}
              className="jbs-gf-flip-back-btn jbs-safe-top absolute left-4 z-20 flex size-10 items-center justify-center rounded-full"
              aria-label="返回牌阵"
            >
              <ChevronLeft className="size-5" strokeWidth={1.5} />
            </button>
            <RoleFlipBook
              scriptId={script.id}
              card={card}
              coverOpen={flipPhase === 'flip'}
              sharedLayout={!closing}
              scale={flipPhase === 'fly' ? 1.08 : 1.12}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showPanel ? (
          <>
            <motion.button
              type="button"
              key="dossier-scrim"
              className="jbs-gf-scrim absolute inset-0 z-20"
              aria-label="关闭档案"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={handleReturn}
            />

            <motion.div
              key="dossier-panel-wrap"
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                role="dialog"
                aria-labelledby="role-dossier-title"
                className="jbs-gf-dossier-panel pointer-events-auto relative w-full max-w-[360px]"
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center border-b border-[#5c3d2e]/12 pb-3">
                  <button
                    type="button"
                    onClick={handleReturn}
                    className="flex items-center gap-1 rounded-md border border-[#5c3d2e]/18 px-2.5 py-1.5 text-[#5c3d2e]/75 transition-colors hover:bg-[#5c3d2e]/6"
                    aria-label="返回牌阵"
                  >
                    <ChevronLeft className="size-4 shrink-0" strokeWidth={1.75} />
                    <span className="jbs-font-serif text-[12px] tracking-[0.14em]">返回</span>
                  </button>
                </div>

                <p className="jbs-font-serif text-center text-[9px] tracking-[0.32em] text-[#5c3d2e]/55">
                  CLASSIFIED · 绝密档案
                </p>
                <p className="jbs-font-serif mt-1 text-center text-[10px] text-[#1a1a1a]/40">
                  {script.title}
                </p>

                <h2
                  id="role-dossier-title"
                  className="jbs-font-handwriting mt-4 text-center text-[28px] leading-none text-[#1a1a1a]"
                >
                  {card.role.name}
                </h2>
                <p className="jbs-font-serif mt-2 text-center text-[12px] font-medium tracking-wider text-[#5c3d2e]">
                  {card.role.gender}
                  <span className="mx-2 font-normal text-[#5c3d2e]/25">|</span>
                  {card.publicIdentity}
                </p>

                <div className="jbs-gf-dossier-panel-rule my-5" aria-hidden />

                <p className="jbs-font-serif text-justify text-[14px] leading-[1.92] text-[#1a1a1a]/88">
                  {card.role.blurb}
                </p>

                <p className="jbs-font-serif mt-5 text-center text-[10px] italic tracking-wide text-[#722f37]/45">
                  入局后请勿向同谋出示此页
                </p>
              </motion.div>
            </motion.div>

            <motion.div
              key="lock-bar"
              className="jbs-gf-lock-bar pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-6 pb-[max(18px,env(safe-area-inset-bottom,0px))] pt-10"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ delay: 0.08, duration: 0.35 }}
            >
              <button
                type="button"
                onClick={onLockIn}
                className="jbs-gf-btn-lock jbs-gf-btn-lock--center jbs-font-serif pointer-events-auto rounded-md px-12 py-3.5 text-[13px] tracking-[0.22em]"
              >
                锁定命运
              </button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
