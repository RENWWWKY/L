import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useCallback, useEffect, useRef } from 'react'

import { isClueCollectedInDrawer } from './jbsFlowTypes'
import { useJBSFlow } from './JBSFlowEngine'
import { CLUE_FLIP_PERSPECTIVE, CLUE_OPEN_SPRING } from './clueCardMotion'

function ClueCard({
  title,
  imageUrl,
  unlocked,
  onInspect,
}: {
  title: string
  imageUrl: string
  unlocked: boolean
  onInspect: () => void
}) {
  if (!unlocked) {
    return (
      <div className="jbs-gf-chat-clue-card-locked flex aspect-[3/4] w-[calc(50%-6px)] shrink-0 flex-col items-center justify-center rounded-lg">
        <span className="jbs-font-serif text-[10px] tracking-[0.2em]">
          待解锁
        </span>
      </div>
    )
  }

  return (
    <motion.button
      type="button"
      onClick={onInspect}
      className="jbs-gf-chat-clue-card aspect-[3/4] w-[calc(50%-6px)] shrink-0 overflow-hidden rounded-lg focus:outline-none"
      initial={{ rotateY: 92, opacity: 0.35, scale: 0.92 }}
      animate={{ rotateY: 0, opacity: 1, scale: 1 }}
      transition={CLUE_OPEN_SPRING}
      style={{ transformStyle: 'preserve-3d', perspective: CLUE_FLIP_PERSPECTIVE }}
      whileTap={{ scale: 0.97 }}
    >
      <img src={imageUrl} alt="" className="h-[72%] w-full object-cover" />
      <div className="jbs-gf-chat-clue-card-caption flex flex-1 flex-col justify-center">
        <p className="jbs-font-serif px-2 py-2 text-center text-[11px] tracking-wide text-[#3d2e24]/88">
          {title}
        </p>
      </div>
    </motion.button>
  )
}

function ClueInspector() {
  const { clues, inspectingClueId, setInspectingClueId, currentStep, loopRound, collectedClueIds } =
    useJBSFlow()
  const clue = clues.find((c) => c.id === inspectingClueId)
  const dragRef = useRef<HTMLDivElement>(null)
  const entryDoneRef = useRef(false)

  const tiltX = useMotionValue(0)
  const tiltY = useMotionValue(0)
  const springTiltX = useSpring(tiltX, { stiffness: 180, damping: 22 })
  const springTiltY = useSpring(tiltY, { stiffness: 180, damping: 22 })
  const shadow = useTransform(
    springTiltY,
    [-12, 12],
    ['0 28px 48px rgba(92, 61, 46, 0.22)', '0 8px 24px rgba(92, 61, 46, 0.14)'],
  )

  useEffect(() => {
    entryDoneRef.current = false
    const t = window.setTimeout(() => {
      entryDoneRef.current = true
    }, 520)
    return () => window.clearTimeout(t)
  }, [inspectingClueId])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!entryDoneRef.current) return
      const el = dragRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width - 0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5
      tiltY.set(px * 14)
      tiltX.set(-py * 10)
    },
    [tiltX, tiltY],
  )

  const onPointerLeave = useCallback(() => {
    tiltX.set(0)
    tiltY.set(0)
  }, [tiltX, tiltY])

  if (!clue || !isClueCollectedInDrawer(clue, currentStep, loopRound, collectedClueIds)) return null

  return (
    <motion.div
      className="jbs-gf-chat-clue-inspector-scrim fixed inset-0 z-[90] flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
      onClick={() => setInspectingClueId(null)}
    >
      <motion.div
        className="w-full max-w-[240px]"
        style={{ perspective: CLUE_FLIP_PERSPECTIVE }}
        initial={{ rotateY: -94, opacity: 0, scale: 0.86 }}
        animate={{ rotateY: 0, opacity: 1, scale: 1 }}
        exit={{ rotateY: 78, opacity: 0, scale: 0.9 }}
        transition={CLUE_OPEN_SPRING}
      >
        <motion.div
          ref={dragRef}
          className="jbs-clue-flip-inner"
          style={{
            rotateX: springTiltX,
            rotateY: springTiltY,
            transformStyle: 'preserve-3d',
            boxShadow: shadow,
          }}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="jbs-gf-chat-clue-inspector-card overflow-hidden rounded-xl">
            <img src={clue.imageUrl} alt="" className="aspect-[3/4] w-full object-cover" />
            <div className="jbs-gf-chat-clue-inspector-body">
              <p className="jbs-font-serif text-center text-[14px] font-semibold leading-relaxed text-[#1a1a1a]/92">
                {clue.title}
              </p>
              <p className="jbs-font-serif mt-2 text-center text-[12px] leading-loose text-[#5c3d2e]/82">
                {clue.description}
              </p>
            </div>
          </div>
        </motion.div>
        <motion.p
          className="jbs-gf-chat-step-pill mt-4 text-center text-[9px]"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.35 }}
        >
          拖动以检视 · 点击空白关闭
        </motion.p>
      </motion.div>
    </motion.div>
  )
}

export function PublicCluesTab() {
  const { clues, currentStep, loopRound, inspectingClueId, setInspectingClueId, collectedClueIds } =
    useJBSFlow()

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto jbs-hide-scrollbar px-4 pb-8 pt-2">
        <p className="jbs-font-serif jbs-gf-text-muted text-center text-[10px] tracking-[0.24em]">
          公共线索区 · 证据链
        </p>
        {clues.some((c) => c.category === 'premise') ? (
          <p className="jbs-font-serif jbs-gf-text-muted mt-2 text-center text-[9px] tracking-[0.2em]">
            公共前提 · 入局须知
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          {clues.map((clue) => (
            <ClueCard
              key={clue.id}
              title={clue.title}
              imageUrl={clue.imageUrl}
              unlocked={isClueCollectedInDrawer(clue, currentStep, loopRound, collectedClueIds)}
              onInspect={() => setInspectingClueId(clue.id)}
            />
          ))}
        </div>
      </div>
      <AnimatePresence>
        {inspectingClueId ? <ClueInspector key="inspector" /> : null}
      </AnimatePresence>
    </>
  )
}
