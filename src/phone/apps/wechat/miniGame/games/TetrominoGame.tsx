import { useCallback, useEffect, useRef } from 'react'

import { MONO, type GameEventEmitter } from '../types'

const SHAPES = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 1, 0], [0, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
] as const

const COLS = 10
const ROWS = 20

type Piece = { shape: number[][]; x: number; y: number; rot: number }

function rotate(shape: number[][]) {
  const rows = shape.length
  const cols = shape[0]!.length
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (_, r) => shape[rows - 1 - r]![c]!),
  )
}

function collide(board: number[][], piece: Piece) {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r]!.length; c++) {
      if (!piece.shape[r]![c]) continue
      const br = piece.y + r
      const bc = piece.x + c
      if (bc < 0 || bc >= COLS || br >= ROWS) return true
      if (br >= 0 && board[br]![bc]) return true
    }
  }
  return false
}

function merge(board: number[][], piece: Piece) {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r]!.length; c++) {
      if (!piece.shape[r]![c]) continue
      const br = piece.y + r
      const bc = piece.x + c
      if (br >= 0 && br < ROWS && bc >= 0 && bc < COLS) board[br]![bc] = 1
    }
  }
}

function clearLines(board: number[][]) {
  let cleared = 0
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r]!.every((v) => v)) {
      board.splice(r, 1)
      board.unshift(Array<number>(COLS).fill(0))
      cleared++
      r++
    }
  }
  return cleared
}

function newPiece(): Piece {
  const base = SHAPES[Math.floor(Math.random() * SHAPES.length)]!.map((r) => [...r])
  return { shape: base, x: 3, y: 0, rot: 0 }
}

export function TetrominoGame({ emitEvent }: { emitEvent: GameEventEmitter }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boardRef = useRef(Array.from({ length: ROWS }, () => Array<number>(COLS).fill(0)))
  const pieceRef = useRef<Piece>(newPiece())
  const scoreRef = useRef(0)
  const linesRef = useRef(0)
  const comboRef = useRef(0)
  const overRef = useRef(false)
  const dropRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    ctx.fillStyle = MONO.bg
    ctx.fillRect(0, 0, w, h)

    const cell = Math.min(w / COLS, h / ROWS)
    const ox = (w - cell * COLS) / 2
    const oy = (h - cell * ROWS) / 2
    const board = boardRef.current
    const piece = pieceRef.current

    ctx.strokeStyle = MONO.gray200
    ctx.lineWidth = 0.5
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath()
      ctx.moveTo(ox, oy + r * cell)
      ctx.lineTo(ox + COLS * cell, oy + r * cell)
      ctx.stroke()
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath()
      ctx.moveTo(ox + c * cell, oy)
      ctx.lineTo(ox + c * cell, oy + ROWS * cell)
      ctx.stroke()
    }

    const drawCell = (r: number, c: number, active: boolean) => {
      if (r < 0) return
      const x = ox + c * cell
      const y = oy + r * cell
      const pad = 1.5
      const grad = ctx.createLinearGradient(x, y, x + cell, y + cell)
      grad.addColorStop(0, active ? MONO.platinumBright : MONO.gray300)
      grad.addColorStop(1, active ? MONO.gray400 : MONO.gray500)
      ctx.fillStyle = grad
      ctx.fillRect(x + pad, y + pad, cell - pad * 2, cell - pad * 2)
      ctx.strokeStyle = MONO.ink
      ctx.lineWidth = 0.6
      ctx.strokeRect(x + pad, y + pad, cell - pad * 2, cell - pad * 2)
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r]![c]) drawCell(r, c, false)
      }
    }
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r]!.length; c++) {
        if (piece.shape[r]![c]) drawCell(piece.y + r, piece.x + c, true)
      }
    }

    ctx.fillStyle = MONO.inkSoft
    ctx.font = '600 11px system-ui'
    ctx.fillText(`LINES ${linesRef.current}`, 6, 14)
  }, [])

  const lockAndSpawn = useCallback(() => {
    merge(boardRef.current, pieceRef.current)
    const cleared = clearLines(boardRef.current)
    if (cleared) {
      linesRef.current += cleared
      scoreRef.current += cleared * 100 * (cleared > 1 ? cleared : 1)
      comboRef.current++
      emitEvent({ type: 'combo', detail: `${cleared} 行连消`, score: scoreRef.current })
      if (linesRef.current >= 10) emitEvent({ type: 'milestone', detail: '十行突破', score: scoreRef.current })
    } else {
      comboRef.current = 0
    }
    pieceRef.current = newPiece()
    if (collide(boardRef.current, pieceRef.current)) {
      overRef.current = true
      emitEvent({ type: 'gameOver', detail: '堆叠触顶', score: scoreRef.current })
      emitEvent({ type: 'lose', score: scoreRef.current })
    }
    const highest = boardRef.current.findIndex((row) => row.some((v) => v))
    if (highest >= 0 && highest < 4) {
      emitEvent({ type: 'crisis', detail: '方块逼近顶线', score: scoreRef.current })
    }
    draw()
  }, [draw, emitEvent])

  const tryMove = useCallback(
    (dx: number, dy: number, rot = false) => {
      if (overRef.current) return
      const p = pieceRef.current
      const next: Piece = {
        ...p,
        x: p.x + dx,
        y: p.y + dy,
        shape: rot ? rotate(p.shape) : p.shape,
        rot: rot ? p.rot + 1 : p.rot,
      }
      if (!collide(boardRef.current, next)) {
        pieceRef.current = next
        draw()
        return true
      }
      if (dy > 0) lockAndSpawn()
      return false
    },
    [draw, lockAndSpawn],
  )

  useEffect(() => {
    draw()
    dropRef.current = setInterval(() => tryMove(0, 1), 520)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        tryMove(-1, 0)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        tryMove(1, 0)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        tryMove(0, 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        tryMove(0, 0, true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      if (dropRef.current) clearInterval(dropRef.current)
      window.removeEventListener('keydown', onKey)
    }
  }, [draw, tryMove])

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto aspect-[1/2] w-full max-w-[min(92vw,280px)] touch-none"
      onPointerDown={(e) => {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        const x = e.clientX - rect.left
        if (x < rect.width / 3) tryMove(-1, 0)
        else if (x > (rect.width * 2) / 3) tryMove(1, 0)
        else tryMove(0, 0, true)
      }}
    />
  )
}
