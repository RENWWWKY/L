import { ChevronLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import { Pressable } from '../../../components/Pressable'
import { getGameLabel } from './gameCatalog'
import { CompanionPod } from './CompanionPod'
import { useGameReactionEngine } from './useGameReactionEngine'
import type { MiniGameType } from './types'
import { BubbleShooterGame } from './games/BubbleShooterGame'
import { GomokuGame } from './games/GomokuGame'
import { GravityMergeGame } from './games/GravityMergeGame'
import { SerpentGame } from './games/SerpentGame'
import { StarMatchGame } from './games/StarMatchGame'
import { TetrominoGame } from './games/TetrominoGame'

function GameView({
  gameType,
  emitEvent,
}: {
  gameType: MiniGameType
  emitEvent: ReturnType<typeof useGameReactionEngine>['emitEvent']
}) {
  switch (gameType) {
    case 'gravity':
      return <GravityMergeGame emitEvent={emitEvent} />
    case 'gomoku':
      return <GomokuGame emitEvent={emitEvent} />
    case 'serpent':
      return <SerpentGame emitEvent={emitEvent} />
    case 'tetromino':
      return <TetrominoGame emitEvent={emitEvent} />
    case 'bubble':
      return <BubbleShooterGame emitEvent={emitEvent} />
    case 'stars':
      return <StarMatchGame emitEvent={emitEvent} />
    default:
      return null
  }
}

export function GameCanvas({
  open,
  gameType,
  charId,
  avatarUrl,
  reactionEnabled,
  onClose,
}: {
  open: boolean
  gameType: MiniGameType
  charId: string
  avatarUrl?: string
  reactionEnabled: boolean
  onClose: () => void
}) {
  const { reactionText, reactionVisible, emitEvent } = useGameReactionEngine(
    charId,
    gameType,
    reactionEnabled,
  )

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1400] bg-[#F9FAFB]"
        >
          <CompanionPod avatarUrl={avatarUrl} reactionText={reactionText} visible={reactionVisible} />

          <div
            className="flex items-center justify-between px-3 pb-2"
            style={{ paddingTop: 'max(52px, calc(env(safe-area-inset-top, 0px) + 44px))' }}
          >
            <Pressable
              className="flex items-center gap-1 rounded-full px-2 py-1.5 text-[#374151] active:bg-black/5"
              onClick={onClose}
            >
              <ChevronLeft size={18} strokeWidth={1.5} />
              <span className="text-[13px]">返回</span>
            </Pressable>
            <div
              className="text-[12px] tracking-[0.14em] text-[#6B7280]"
              style={{ fontFamily: 'var(--phone-font, "Noto Serif SC", serif)' }}
            >
              {getGameLabel(gameType)}
            </div>
            <div className="w-[52px]" />
          </div>

          <div className="flex flex-1 items-center justify-center px-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            <GameView gameType={gameType} emitEvent={emitEvent} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
