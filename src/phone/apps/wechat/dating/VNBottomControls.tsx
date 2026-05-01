import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, FastForward, Heart, List, Pause, Play } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  isAutoPlay: boolean
  playSpeed: 1 | 1.5 | 2
  onExit: () => void
  onLog: () => void
  onHeartWhisper: () => void
  onToggleAuto: () => void
  onCycleSpeed: () => void
}

function CtrlBtn({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 text-[10px] transition-all duration-200"
      style={{
        opacity: active ? 0.95 : 0.55,
        color: '#FFFFFF',
        textShadow: '0 1px 10px rgba(0,0,0,0.55)',
      }}
    >
      {children}
      <span>{label}</span>
    </button>
  )
}

export function VNBottomControls({
  isAutoPlay,
  playSpeed,
  onExit,
  onLog,
  onHeartWhisper,
  onToggleAuto,
  onCycleSpeed,
}: Props) {
  return (
    <div
      className="z-20 grid w-full grid-cols-5 items-end gap-2 pb-[max(10px,env(safe-area-inset-bottom,0px))] pt-2"
    >
      <CtrlBtn label="返回" onClick={onExit}>
        <ArrowLeft className="size-4" strokeWidth={1.5} />
      </CtrlBtn>
      <CtrlBtn label="历史" onClick={onLog}>
        <List className="size-4" strokeWidth={1.5} />
      </CtrlBtn>
      <CtrlBtn label="心语" onClick={onHeartWhisper}>
        <Heart className="size-4" strokeWidth={1.5} />
      </CtrlBtn>
      <CtrlBtn label={isAutoPlay ? '暂停' : '自动'} active={isAutoPlay} onClick={onToggleAuto}>
        <AnimatePresence mode="wait" initial={false}>
          {isAutoPlay ? (
            <motion.span
              key="pause"
              initial={{ opacity: 0, scale: 0.8, y: 2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -2 }}
            >
              <Pause className="size-4" strokeWidth={1.5} />
            </motion.span>
          ) : (
            <motion.span
              key="play"
              initial={{ opacity: 0, scale: 0.8, y: 2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -2 }}
            >
              <Play className="size-4" strokeWidth={1.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </CtrlBtn>
      <CtrlBtn label="倍速" onClick={onCycleSpeed}>
        <div className="flex items-center gap-0.5">
          <FastForward className="size-4" strokeWidth={1.5} />
          <span className="inline-flex h-4 overflow-hidden tabular-nums">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={playSpeed}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {playSpeed.toFixed(1)}x
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
      </CtrlBtn>
    </div>
  )
}

