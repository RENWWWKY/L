import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import { Pressable } from '../../../components/Pressable'
import { getGameLabel } from './gameCatalog'
import type { GomokuSessionSetup } from './gomokuReactionBank'
import { ClawCompanionBar } from './ClawCompanionBar'
import { CompanionPod } from './CompanionPod'
import { GameResultOverlay } from './GameResultOverlay'
import { GomokuCompanionBar } from './GomokuCompanionBar'
import { GomokuFirstMoveDraw } from './GomokuFirstMoveDraw'
import { useGameReactionEngine } from './useGameReactionEngine'
import type { WeChatMiniGameMatchResult } from '../newFriendsPersona/types'
import type { GameEvent, MiniGameType } from './types'
import { BubbleShooterGame } from './games/BubbleShooterGame'
import { ClawMachineGame } from './games/ClawMachineGame'
import { GomokuGame } from './games/GomokuGame'
import { GravityMergeGame } from './games/GravityMergeGame'
import { SerpentGame } from './games/SerpentGame'
import { StarMatchGame } from './games/StarMatchGame'
import { TetrominoGame } from './games/TetrominoGame'

const TURN_BASED_GAMES = new Set<MiniGameType>(['gomoku', 'claw'])

function resolveMatchResult(event: GameEvent): WeChatMiniGameMatchResult | null {
  if (event.type !== 'gameOver') return null
  if (event.detail?.includes('平')) return 'draw'
  if (event.won === true) return 'player_win'
  if (event.won === false) return 'char_win'
  return null
}

function GameView({
  gameType,
  emitEvent,
  turnBasedProps,
}: {
  gameType: MiniGameType
  emitEvent: ReturnType<typeof useGameReactionEngine>['emitEvent']
  turnBasedProps?: {
    difficulty: number
    pickThinkDelayMs: ReturnType<typeof useGameReactionEngine>['pickThinkDelayMs']
    setAiThinking: ReturnType<typeof useGameReactionEngine>['setAiThinking']
    getGomokuDifficulty?: ReturnType<typeof useGameReactionEngine>['getGomokuDifficulty']
    getClawDifficulty?: ReturnType<typeof useGameReactionEngine>['getClawDifficulty']
    setupReady: boolean
    playerGoesFirst: boolean
    onGomokuStoneCountsChange?: (counts: { player: number; ai: number }) => void
    onClawScoreChange?: (scores: {
      player: number
      char: number
      turnIndex: number
      activePlayer: 1 | 2
    }) => void
  }
}) {
  switch (gameType) {
    case 'gravity':
      return <GravityMergeGame emitEvent={emitEvent} />
    case 'gomoku':
      return turnBasedProps ? (
        <GomokuGame
          emitEvent={emitEvent}
          difficulty={turnBasedProps.difficulty as 1 | 2 | 3 | 4 | 5}
          pickThinkDelayMs={turnBasedProps.pickThinkDelayMs}
          getDifficulty={turnBasedProps.getGomokuDifficulty}
          onAiThinkingChange={turnBasedProps.setAiThinking}
          disabled={!turnBasedProps.setupReady}
          playerGoesFirst={turnBasedProps.playerGoesFirst}
          onStoneCountsChange={turnBasedProps.onGomokuStoneCountsChange}
        />
      ) : null
    case 'claw':
      return turnBasedProps ? (
        <ClawMachineGame
          emitEvent={emitEvent}
          difficulty={turnBasedProps.difficulty as 1 | 2 | 3 | 4 | 5}
          pickThinkDelayMs={turnBasedProps.pickThinkDelayMs}
          getDifficulty={turnBasedProps.getClawDifficulty}
          onAiThinkingChange={turnBasedProps.setAiThinking}
          disabled={!turnBasedProps.setupReady}
          playerGoesFirst={turnBasedProps.playerGoesFirst}
          onScoreChange={turnBasedProps.onClawScoreChange}
        />
      ) : null
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
  charName,
  avatarUrl,
  playerAvatarUrl,
  conversationKey,
  inviteId,
  preloadedGomokuSetup,
  onClose,
  onGameFinished,
}: {
  open: boolean
  gameType: MiniGameType
  charId: string
  charName?: string
  avatarUrl?: string
  playerAvatarUrl?: string
  conversationKey?: string
  inviteId?: string
  preloadedGomokuSetup?: GomokuSessionSetup
  onClose: () => void
  onGameFinished?: (params: { inviteId: string; matchResult: WeChatMiniGameMatchResult }) => void
}) {
  const {
    reactionText,
    reactionVisible,
    settlementReactionText,
    emitEvent,
    setAiThinking,
    syncGomokuContext,
    triggerGomokuGameStartReaction,
    triggerGomokuDrawResultReaction,
    triggerClawGameStartReaction,
    triggerClawDrawResultReaction,
    aiThinking,
    pickThinkDelayMs,
    gomokuDifficulty,
    clawDifficulty,
    getGomokuDifficulty,
    getClawDifficulty,
    gomokuSetupReady,
  } = useGameReactionEngine(charId, gameType, true, {
    conversationKey,
    peerDisplayName: charName,
    preloadedGomokuSetup,
  })

  const isTurnBased = TURN_BASED_GAMES.has(gameType)
  const isGomoku = gameType === 'gomoku'
  const isClaw = gameType === 'claw'
  const [gomokuStoneCounts, setGomokuStoneCounts] = useState({ player: 0, ai: 0 })
  const [clawScores, setClawScores] = useState({
    player: 0,
    char: 0,
    turnIndex: 0,
    activePlayer: 1 as 1 | 2,
  })
  const [firstMoveDrawDone, setFirstMoveDrawDone] = useState(false)
  const [playerGoesFirst, setPlayerGoesFirst] = useState(true)
  const [settlementResult, setSettlementResult] = useState<WeChatMiniGameMatchResult | null>(null)
  const finishedReportedRef = useRef(false)
  const stoneCountRef = useRef(0)

  const handleFirstMoveDrawComplete = useCallback(
    (goesFirst: boolean) => {
      setPlayerGoesFirst(goesFirst)
      setFirstMoveDrawDone(true)
      if (isGomoku) {
        syncGomokuContext({
          stoneCount: 0,
          playerGoesFirst: goesFirst,
          gameEnded: false,
        })
        triggerGomokuDrawResultReaction(goesFirst)
      } else if (isClaw) {
        triggerClawDrawResultReaction(goesFirst)
      }
    },
    [isClaw, isGomoku, syncGomokuContext, triggerClawDrawResultReaction, triggerGomokuDrawResultReaction],
  )

  const handleGomokuStoneCountsChange = useCallback(
    (counts: { player: number; ai: number }) => {
      const total = counts.player + counts.ai
      stoneCountRef.current = total
      syncGomokuContext({
        stoneCount: total,
        playerGoesFirst,
        gameEnded: settlementResult != null,
      })
      setGomokuStoneCounts((prev) =>
        prev.player === counts.player && prev.ai === counts.ai ? prev : counts,
      )
    },
    [playerGoesFirst, settlementResult, syncGomokuContext],
  )

  const handleClawScoreChange = useCallback(
    (scores: { player: number; char: number; turnIndex: number; activePlayer: 1 | 2 }) => {
      setClawScores((prev) =>
        prev.player === scores.player &&
        prev.char === scores.char &&
        prev.turnIndex === scores.turnIndex &&
        prev.activePlayer === scores.activePlayer
          ? prev
          : scores,
      )
    },
    [],
  )

  useEffect(() => {
    if (open) {
      setSettlementResult(null)
      setFirstMoveDrawDone(false)
      setPlayerGoesFirst(true)
      setGomokuStoneCounts({ player: 0, ai: 0 })
      setClawScores({ player: 0, char: 0, turnIndex: 0, activePlayer: 1 })
      finishedReportedRef.current = false
      stoneCountRef.current = 0
      setAiThinking(false)
      if (isGomoku) {
        syncGomokuContext({ stoneCount: 0, playerGoesFirst: true, gameEnded: false })
      }
    }
  }, [open, inviteId, isGomoku, setAiThinking, syncGomokuContext])

  const totalStoneCount = gomokuStoneCounts.player + gomokuStoneCounts.ai

  const reportGameFinished = useCallback(() => {
    const id = inviteId?.trim()
    if (!id || !settlementResult || finishedReportedRef.current) return
    finishedReportedRef.current = true
    onGameFinished?.({ inviteId: id, matchResult: settlementResult })
  }, [inviteId, onGameFinished, settlementResult])

  useEffect(() => {
    reportGameFinished()
  }, [reportGameFinished])

  const wrappedEmitEvent = useCallback(
    (event: GameEvent) => {
      if (isGomoku) {
        const pendingResult = resolveMatchResult(event)
        syncGomokuContext({
          stoneCount: stoneCountRef.current,
          playerGoesFirst,
          gameEnded: settlementResult != null || pendingResult != null,
        })
      }
      emitEvent(event)
      if (isTurnBased && !settlementResult) {
        const result = resolveMatchResult(event)
        if (result) setSettlementResult(result)
      }
    },
    [emitEvent, isGomoku, isTurnBased, playerGoesFirst, settlementResult, syncGomokuContext],
  )

  const handleSettlementReturn = useCallback(() => {
    reportGameFinished()
    onClose()
  }, [onClose, reportGameFinished])

  const showSettlement = settlementResult != null
  const showFirstMoveDraw = isTurnBased && !firstMoveDrawDone && !showSettlement
  const boardReady = isClaw ? firstMoveDrawDone : gomokuSetupReady && firstMoveDrawDone

  useEffect(() => {
    if (!isGomoku) return
    syncGomokuContext({
      stoneCount: totalStoneCount,
      playerGoesFirst,
      gameEnded: showSettlement,
    })
  }, [isGomoku, playerGoesFirst, showSettlement, syncGomokuContext, totalStoneCount])

  useEffect(() => {
    if (!boardReady || showSettlement) return
    if (isGomoku) triggerGomokuGameStartReaction()
    if (isClaw) triggerClawGameStartReaction()
  }, [boardReady, isClaw, isGomoku, showSettlement, triggerClawGameStartReaction, triggerGomokuGameStartReaction])

  const turnBasedProps = {
    difficulty: isClaw ? clawDifficulty : gomokuDifficulty,
    pickThinkDelayMs,
    setAiThinking,
    getGomokuDifficulty,
    getClawDifficulty,
    setupReady: boardReady,
    playerGoesFirst,
    onGomokuStoneCountsChange: handleGomokuStoneCountsChange,
    onClawScoreChange: handleClawScoreChange,
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1400] overflow-hidden bg-black"
        >
          <div className="flex h-full flex-col bg-[#F9FAFB]">
            {!isTurnBased ? (
              <CompanionPod avatarUrl={avatarUrl} reactionText={reactionText} visible={reactionVisible} />
            ) : null}

            <div
              className="flex shrink-0 items-center justify-between px-3 pb-2"
              style={{
                paddingTop: 'max(52px, calc(env(safe-area-inset-top, 0px) + 44px))',
              }}
            >
              <Pressable
                className="flex items-center gap-1 rounded-full px-2 py-1.5 text-[#374151] active:bg-black/5"
                onClick={showSettlement ? handleSettlementReturn : onClose}
              >
                <ChevronLeft size={18} strokeWidth={1.5} />
                <span className="text-[13px]">返回</span>
              </Pressable>
              <div
                className="text-[12px] tracking-[0.14em] text-[#6B7280]"
                style={{ fontFamily: 'var(--phone-font, "Noto Serif SC", serif)' }}
              >
                {showSettlement ? `${getGameLabel(gameType)} · 结算` : getGameLabel(gameType)}
              </div>
              <div className="w-[52px]" />
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-3 pb-[max(16px,env(safe-area-inset-bottom))]">
              {isGomoku ? (
                <GomokuCompanionBar
                  playerAvatarUrl={playerAvatarUrl}
                  charAvatarUrl={avatarUrl}
                  charName={charName}
                  reactionText={reactionText}
                  reactionVisible={reactionVisible}
                  playerStoneCount={gomokuStoneCounts.player}
                  charStoneCount={gomokuStoneCounts.ai}
                  playerGoesFirst={playerGoesFirst}
                  aiThinking={aiThinking}
                  gameOver={showSettlement}
                />
              ) : null}
              {isClaw ? (
                <ClawCompanionBar
                  playerAvatarUrl={playerAvatarUrl}
                  charAvatarUrl={avatarUrl}
                  charName={charName}
                  reactionText={reactionText}
                  reactionVisible={reactionVisible}
                  playerScore={clawScores.player}
                  charScore={clawScores.char}
                  activePlayer={clawScores.activePlayer}
                  aiThinking={aiThinking}
                  gameOver={showSettlement}
                />
              ) : null}
              <div className="relative flex w-full max-w-[min(88vw,400px)] items-center justify-center">
                {isTurnBased && firstMoveDrawDone ? (
                  <GameView
                    key={`${inviteId ?? gameType}-${playerGoesFirst ? 'player' : 'char'}`}
                    gameType={gameType}
                    emitEvent={wrappedEmitEvent}
                    turnBasedProps={turnBasedProps}
                  />
                ) : !isTurnBased ? (
                  <div className="w-full">
                    <GameView gameType={gameType} emitEvent={wrappedEmitEvent} />
                  </div>
                ) : (
                  <div
                    className={`w-full rounded-2xl bg-[#E8DCC8]/40 ${
                      isClaw ? 'aspect-[4/5] max-w-[min(88vw,400px)]' : 'aspect-square max-w-[min(88vw,400px)]'
                    }`}
                  />
                )}
                <GomokuFirstMoveDraw
                  open={showFirstMoveDraw}
                  playerAvatarUrl={playerAvatarUrl}
                  charAvatarUrl={avatarUrl}
                  charName={charName}
                  variant={isClaw ? 'claw' : 'gomoku'}
                  onComplete={handleFirstMoveDrawComplete}
                />
              </div>
              <GameResultOverlay
                open={showSettlement}
                gameType={gameType}
                charName={charName}
                charAvatarUrl={avatarUrl}
                result={settlementResult}
                reactionText={settlementReactionText ?? reactionText}
                onReturn={handleSettlementReturn}
              />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
