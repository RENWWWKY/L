import { useCallback, useEffect, useRef } from 'react'

import { MONO, type GameEventEmitter } from '../types'
import {
  createEmptyBoard,
  gomokuAiMove,
  gomokuCheckWin,
  gomokuIsFull,
  GOMOKU_SIZE,
  type GomokuCell,
} from './gomokuAi'

export function GomokuGame({ emitEvent }: { emitEvent: GameEventEmitter }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boardRef = useRef<GomokuCell[][]>(createEmptyBoard())
  const gameOverRef = useRef(false)
  const aiThinkingRef = useRef(false)
  const milestoneRef = useRef(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const size = Math.min(rect.width, rect.height)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const pad = size * 0.06
    const grid = (size - pad * 2) / (GOMOKU_SIZE - 1)
    const board = boardRef.current

    ctx.fillStyle = MONO.bg
    ctx.fillRect(0, 0, size, size)

    ctx.strokeStyle = MONO.gray300
    ctx.lineWidth = 1
    for (let i = 0; i < GOMOKU_SIZE; i++) {
      const p = pad + i * grid
      ctx.beginPath()
      ctx.moveTo(pad, p)
      ctx.lineTo(size - pad, p)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(p, pad)
      ctx.lineTo(p, size - pad)
      ctx.stroke()
    }

    const starPts = [3, 7, 11]
    ctx.fillStyle = MONO.gray400
    for (const r of starPts) {
      for (const c of starPts) {
        ctx.beginPath()
        ctx.arc(pad + c * grid, pad + r * grid, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    for (let r = 0; r < GOMOKU_SIZE; r++) {
      for (let c = 0; c < GOMOKU_SIZE; c++) {
        const v = board[r]![c]
        if (!v) continue
        const x = pad + c * grid
        const y = pad + r * grid
        const rad = grid * 0.38
        const grad = ctx.createRadialGradient(x - rad * 0.2, y - rad * 0.2, rad * 0.1, x, y, rad)
        if (v === 1) {
          grad.addColorStop(0, MONO.inkSoft)
          grad.addColorStop(1, MONO.ink)
        } else {
          grad.addColorStop(0, MONO.platinumBright)
          grad.addColorStop(1, MONO.gray300)
        }
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(x, y, rad, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = v === 1 ? MONO.ink : MONO.gray400
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
    }
  }, [])

  const handleTap = useCallback(
    (clientX: number, clientY: number) => {
      if (gameOverRef.current || aiThinkingRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const size = Math.min(rect.width, rect.height)
      const pad = size * 0.06
      const grid = (size - pad * 2) / (GOMOKU_SIZE - 1)
      const lx = clientX - rect.left
      const ly = clientY - rect.top
      const c = Math.round((lx - pad) / grid)
      const r = Math.round((ly - pad) / grid)
      if (r < 0 || r >= GOMOKU_SIZE || c < 0 || c >= GOMOKU_SIZE) return
      const board = boardRef.current
      if (board[r]![c] !== 0) return

      board[r]![c] = 1
      draw()

      if (gomokuCheckWin(board, r, c, 1)) {
        gameOverRef.current = true
        emitEvent({ type: 'win', detail: '玩家五连', won: true })
        emitEvent({ type: 'gameOver', detail: '玩家获胜', won: true })
        return
      }
      if (gomokuIsFull(board)) {
        gameOverRef.current = true
        emitEvent({ type: 'gameOver', detail: '和棋' })
        return
      }

      if (!milestoneRef.current) {
        milestoneRef.current = true
        emitEvent({ type: 'milestone', detail: '首子落定' })
      }

      aiThinkingRef.current = true
      window.setTimeout(() => {
        const move = gomokuAiMove(board)
        aiThinkingRef.current = false
        if (!move || gameOverRef.current) return
        board[move.r]![move.c] = 2
        draw()
        if (gomokuCheckWin(board, move.r, move.c, 2)) {
          gameOverRef.current = true
          emitEvent({ type: 'lose', detail: 'AI 五连', won: false })
          emitEvent({ type: 'gameOver', detail: 'AI 获胜', won: false })
          if (move.brilliant) emitEvent({ type: 'opponentMove', detail: '绝杀一步' })
        } else if (move.brilliant) {
          emitEvent({ type: 'opponentMove', detail: '妙手封锁' })
        } else if (gomokuIsFull(board)) {
          gameOverRef.current = true
          emitEvent({ type: 'gameOver', detail: '和棋' })
        }
      }, 120)
    },
    [draw, emitEvent],
  )

  useEffect(() => {
    draw()
    const onResize = () => draw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto aspect-square w-full max-w-[min(92vw,420px)] touch-none"
      onPointerDown={(e) => {
        e.preventDefault()
        handleTap(e.clientX, e.clientY)
      }}
    />
  )
}
