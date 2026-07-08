import { useCallback, useEffect, useRef, useState } from 'react'

import { Pressable } from '../../../../components/Pressable'
import type { ClawDifficultyLevel } from './claw/clawDifficulty'
import { clawAiDecide } from './claw/clawAi'
import {
  applyJoystickInput,
  beginAiGrabAt,
  beginGrab,
  canPlayerControl,
  createClawGameState,
  resolveClawWinner,
  tickClawAnim,
} from './claw/clawEngine'
import { ClawJoystick } from './claw/ClawJoystick'
import { drawMachine3D } from './claw/clawRender3d'
import { preloadPlushKinds } from './claw/clawPlushAssets'
import type { ClawReactionKey, GameEventEmitter } from '../types'

const RARE_VALUE = 3

export function ClawMachineGame({
  emitEvent,
  difficulty,
  pickThinkDelayMs,
  onAiThinkingChange,
  getDifficulty,
  disabled = false,
  playerGoesFirst = true,
  onScoreChange,
}: {
  emitEvent: GameEventEmitter
  difficulty: ClawDifficultyLevel
  pickThinkDelayMs: () => number
  onAiThinkingChange?: (thinking: boolean) => void
  getDifficulty?: () => ClawDifficultyLevel
  disabled?: boolean
  playerGoesFirst?: boolean
  onScoreChange?: (scores: {
    player: number
    char: number
    turnIndex: number
    activePlayer: 1 | 2
  }) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(createClawGameState(playerGoesFirst))
  const difficultyRef = useRef(difficulty)
  const aiTimerRef = useRef<number | null>(null)
  const aiThinkingRef = useRef(false)
  const gameOverRef = useRef(false)
  const lastFrameRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const joystickRef = useRef({ x: 0, y: 0 })
  const [controlsEnabled, setControlsEnabled] = useState(false)
  difficultyRef.current = getDifficulty?.() ?? difficulty

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawMachine3D(ctx, w, h, stateRef.current)
  }, [])

  const notifyScores = useCallback(() => {
    const s = stateRef.current
    onScoreChange?.({
      player: s.playerScore,
      char: s.charScore,
      turnIndex: s.claw.turnIndex,
      activePlayer: s.claw.activePlayer,
    })
  }, [onScoreChange])

  const finishGame = useCallback(() => {
    if (gameOverRef.current) return
    gameOverRef.current = true
    const winner = resolveClawWinner(stateRef.current)
    const won = winner === 'player'
    const key: ClawReactionKey = winner === 'draw' ? 'draw' : won ? 'lose' : 'win'
    emitEvent({
      type: 'gameOver',
      detail: winner === 'draw' ? '平局' : won ? '你赢了' : '角色赢了',
      won: winner === 'draw' ? undefined : won,
      clawKey: key,
      score: stateRef.current.playerScore,
    })
  }, [emitEvent])

  const handleTurnCompleted = useCallback(
    (params: { player: 1 | 2; success: boolean; value: number }) => {
      notifyScores()
      const isChar = params.player === 2
      let clawKey: ClawReactionKey
      if (params.success && params.value >= RARE_VALUE) {
        clawKey = isChar ? 'charRare' : 'playerRare'
      } else if (params.success) {
        clawKey = isChar ? 'charGrab' : 'playerGrab'
      } else {
        clawKey = isChar ? 'charMiss' : 'playerMiss'
      }
      emitEvent({
        type: isChar ? 'opponentMove' : 'milestone',
        detail: params.success ? `抓到 ${params.value} 分` : '空抓',
        clawKey,
        score: stateRef.current.playerScore,
      })
    },
    [emitEvent, notifyScores],
  )

  const runAiTurn = useCallback(() => {
    const state = stateRef.current
    if (gameOverRef.current || state.claw.activePlayer !== 2) return
    aiThinkingRef.current = false
    onAiThinkingChange?.(false)
    const decision = clawAiDecide(state, difficultyRef.current)
    beginAiGrabAt(state, decision.targetX, decision.targetZ)
  }, [onAiThinkingChange])

  const scheduleAiTurn = useCallback(
    (delayMs?: number, opts?: { opening?: boolean }) => {
      const state = stateRef.current
      if (gameOverRef.current || state.claw.activePlayer !== 2 || state.claw.phase !== 'idle') return false
      if (aiThinkingRef.current && !opts?.opening) return false
      if (aiTimerRef.current != null) return false
      aiThinkingRef.current = true
      onAiThinkingChange?.(true)
      const rawDelay = delayMs ?? pickThinkDelayMs()
      const delay = opts?.opening
        ? Math.max(350, Math.min(1400, rawDelay))
        : Math.max(600, Math.min(8000, rawDelay))
      aiTimerRef.current = window.setTimeout(() => {
        aiTimerRef.current = null
        runAiTurn()
      }, delay)
      return true
    },
    [onAiThinkingChange, pickThinkDelayMs, runAiTurn],
  )

  const tryScheduleAiOpening = useCallback(() => {
    if (playerGoesFirst || disabled || gameOverRef.current) return false
    const state = stateRef.current
    if (state.claw.turnIndex > 0 || state.claw.phase !== 'idle') return false
    if (state.playerScore > 0 || state.charScore > 0) return false
    return scheduleAiTurn(Math.max(400, pickThinkDelayMs() * 0.45), { opening: true })
  }, [disabled, pickThinkDelayMs, playerGoesFirst, scheduleAiTurn])

  const tick = useCallback(
    (now: number) => {
      const prev = lastFrameRef.current || now
      const dt = Math.min(0.05, (now - prev) / 1000)
      lastFrameRef.current = now

      const state = stateRef.current
      if (!disabled && !gameOverRef.current) {
        const js = joystickRef.current
        if (js.x !== 0 || js.y !== 0) {
          applyJoystickInput(state, js.x, js.y, dt)
        }

        const result = tickClawAnim(state, dt, difficultyRef.current)
        if (result.turnCompleted) {
          handleTurnCompleted({
            player: result.turnCompleted.player,
            success: result.turnCompleted.success,
            value: result.turnCompleted.value,
          })
        }
        if (result.gameOver) {
          finishGame()
        } else if (!disabled && state.claw.phase === 'idle' && state.claw.activePlayer === 2) {
          scheduleAiTurn()
        }
        const canControl = canPlayerControl(state)
        setControlsEnabled((p) => (p === canControl ? p : canControl))
        notifyScores()
      }
      draw()
      rafRef.current = window.requestAnimationFrame(tick)
    },
    [disabled, draw, finishGame, handleTurnCompleted, notifyScores, scheduleAiTurn],
  )

  const handleDrop = useCallback(() => {
    if (disabled || gameOverRef.current || !canPlayerControl(stateRef.current)) return
    beginGrab(stateRef.current)
  }, [disabled])

  const handleJoystickChange = useCallback((vec: { x: number; y: number }) => {
    joystickRef.current = vec
  }, [])

  useEffect(() => {
    if (aiTimerRef.current != null) {
      window.clearTimeout(aiTimerRef.current)
      aiTimerRef.current = null
    }
    aiThinkingRef.current = false
    onAiThinkingChange?.(false)
    stateRef.current = createClawGameState(playerGoesFirst)
    gameOverRef.current = false
    lastFrameRef.current = 0
    joystickRef.current = { x: 0, y: 0 }
    notifyScores()
    void preloadPlushKinds(stateRef.current.sessionKinds)
  }, [notifyScores, onAiThinkingChange, playerGoesFirst])

  useEffect(() => {
    tryScheduleAiOpening()
  }, [tryScheduleAiOpening])

  useEffect(() => {
    rafRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current)
      if (aiTimerRef.current != null) window.clearTimeout(aiTimerRef.current)
      aiThinkingRef.current = false
      onAiThinkingChange?.(false)
    }
  }, [onAiThinkingChange, tick])

  useEffect(() => {
    const onResize = () => draw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [draw])

  const playerTurn = controlsEnabled && !disabled

  return (
    <div className="flex w-full max-w-[min(88vw,400px)] flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        className={`aspect-[4/5] w-full touch-none rounded-2xl border border-[#E5E7EB] shadow-sm ${disabled ? 'opacity-60' : ''}`}
      />
      <div className="flex w-full items-center justify-between gap-4 px-1">
        <ClawJoystick disabled={!playerTurn} onChange={handleJoystickChange} />
        <div className="flex flex-col items-center gap-2">
          <Pressable
            className={`flex h-[72px] w-[72px] items-center justify-center rounded-full text-[14px] font-bold active:opacity-90 disabled:opacity-40 ${
              playerTurn ? 'bg-[#FF5159] text-white shadow-md' : 'bg-[#E5E7EB] text-[#9CA3AF]'
            }`}
            disabled={!playerTurn}
            onClick={handleDrop}
          >
            下爪
          </Pressable>
          <span className="text-[10px] text-[#9CA3AF]">各 3 次 · 比总分</span>
        </div>
      </div>
      <p className="text-center text-[11px] text-[#9CA3AF]">摇杆左右前后移动 · 对准后按下爪</p>
    </div>
  )
}
