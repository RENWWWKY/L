import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useCallback, useRef } from 'react'

import { isClueUnlocked } from './jbsFlowTypes'
import { useJBSFlow } from './JBSFlowEngine'

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
      initial={{ rotateY: 88, opacity: 0.4 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformStyle: 'preserve-3d' }}
      whileTap={{ scale: 0.97 }}
    >
      <img src={imageUrl} alt="" className="h-[72%] w-full object-cover" />
      <p className="jbs-font-serif px-2 py-2 text-center text-[11px] tracking-wide text-[#3d2e24]/88">
        {title}
      </p>
    </motion.button>
  )
}

function ClueInspector() {
  const { clues, inspectingClueId, setInspectingClueId, currentStep, loopRound } = useJBSFlow()
  const clue = clues.find((c) => c.id === inspectingClueId)
  const dragRef = useRef<HTMLDivElement>(null)

  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const springX = useSpring(rotateX, { stiffness: 180, damping: 22 })
  const springY = useSpring(rotateY, { stiffness: 180, damping: 22 })
  const shadow = useTransform(
    springY,
    [-12, 12],
    ['0 28px 48px rgba(92, 61, 46, 0.22)', '0 8px 24px rgba(92, 61, 46, 0.14)'],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = dragRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width - 0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5
      rotateY.set(px * 18)
      rotateX.set(-py * 14)
    },
    [rotateX, rotateY],
  )

  const onPointerLeave = useCallback(() => {
    rotateX.set(0)
    rotateY.set(0)
  }, [rotateX, rotateY])

  if (!clue || !isClueUnlocked(clue, currentStep, loopRound)) return null

  return (
    <motion.div
      className="jbs-gf-chat-clue-inspector-scrim fixed inset-0 z-[90] flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setInspectingClueId(null)}
    >
      <motion.div
        ref={dragRef}
        className="w-full max-w-[240px]"
        style={{
          rotateX: springX,
          rotateY: springY,
          transformPerspective: 900,
          boxShadow: shadow,
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jbs-gf-chat-glass-panel overflow-hidden rounded-xl">
          <img src={clue.imageUrl} alt="" className="aspect-[3/4] w-full object-cover" />
        </div>
        <p className="jbs-font-serif mt-4 text-center text-[14px] font-semibold leading-relaxed text-[#1a1a1a]/92">
          {clue.title}
        </p>
        <p className="jbs-font-serif mt-2 text-center text-[12px] leading-loose text-[#5c3d2e]/72">
          {clue.description}
        </p>
        <p className="jbs-gf-chat-step-pill mt-4 text-center text-[9px]">
          拖动以检视 · 点击空白关闭
        </p>
      </motion.div>
    </motion.div>
  )
}

export function PublicCluesTab() {
  const { clues, currentStep, loopRound, inspectingClueId, setInspectingClueId } = useJBSFlow()

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto jbs-hide-scrollbar px-4 pb-8 pt-2">
        <p className="jbs-font-serif jbs-gf-text-muted text-center text-[10px] tracking-[0.24em]">
          公共线索区 · 证据链
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {clues.map((clue) => (
            <ClueCard
              key={clue.id}
              title={clue.title}
              imageUrl={clue.imageUrl}
              unlocked={isClueUnlocked(clue, currentStep, loopRound)}
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
