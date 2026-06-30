import { useCallback, useEffect, useRef } from 'react'

import { MONO, type GameEventEmitter } from '../types'

const SIZE = 8

function makeBoard() {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => (Math.random() < 0.85 ? Math.floor(Math.random() * 3) + 1 : 0)),
  )
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, filled: boolean) {
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = (i * 4 * Math.PI) / 5 - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.45
    const px = x + Math.cos(a) * rad
    const py = y + Math.sin(a) * rad
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  if (filled) {
    ctx.fillStyle = MONO.ink
    ctx.fill()
  }
  ctx.strokeStyle = MONO.gray400
  ctx.lineWidth = 1
  ctx.stroke()
}

export function StarMatchGame({ emitEvent }: { emitEvent: GameEventEmitter }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boardRef = useRef(makeBoard())
  const selectedRef = useRef<[number, number] | null>(null)
  const scoreRef = useRef(0)
  const comboRef = useRef(0)
  const movesRef = useRef(25)
  const overRef = useRef(false)

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

    const cell = Math.min(w, h) / SIZE
    const ox = (w - cell * SIZE) / 2
    const oy = (h - cell * SIZE) / 2 + 10
    const board = boardRef.current
    const sel = selectedRef.current

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = board[r]![c]!
        const cx = ox + c * cell + cell / 2
        const cy = oy + r * cell + cell / 2
        if (sel && sel[0] === r && sel[1] === c) {
          ctx.strokeStyle = MONO.platinum
          ctx.lineWidth = 2
          ctx.strokeRect(ox + c * cell + 2, oy + r * cell + 2, cell - 4, cell - 4)
        }
        if (v === 0) continue
        const gray = v === 1 ? MONO.gray500 : v === 2 ? MONO.inkSoft : MONO.gray400
        ctx.fillStyle = String(gray)
        drawStar(ctx, cx, cy, cell * 0.28, true)
      }
    }

    ctx.fillStyle = MONO.inkSoft
    ctx.font = '600 11px system-ui'
    ctx.fillText(`SCORE ${scoreRef.current}  MOVES ${movesRef.current}`, 8, 16)
  }, [])

  const swap = (a: [number, number], b: [number, number]) => {
    const board = boardRef.current
    const t = board[a[0]]![a[1]]!
    board[a[0]]![a[1]] = board[b[0]]![b[1]]!
    board[b[0]]![b[1]] = t
  }

  const findMatches = () => {
    const board = boardRef.current
    const mark = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false))
    // horizontal
    for (let r = 0; r < SIZE; r++) {
      let run = 1
      for (let c = 1; c <= SIZE; c++) {
        const cur = c < SIZE ? board[r]![c] : -1
        const prev = board[r]![c - 1]!
        if (c < SIZE && cur === prev && cur !== 0) run++
        else {
          if (run >= 3 && prev !== 0) {
            for (let k = c - run; k < c; k++) mark[r]![k] = true
          }
          run = 1
        }
      }
    }
    // vertical
    for (let c = 0; c < SIZE; c++) {
      let run = 1
      for (let r = 1; r <= SIZE; r++) {
        const cur = r < SIZE ? board[r]![c] : -1
        const prev = board[r - 1]![c]!
        if (r < SIZE && cur === prev && cur !== 0) run++
        else {
          if (run >= 3 && prev !== 0) {
            for (let k = r - run; k < r; k++) mark[k]![c] = true
          }
          run = 1
        }
      }
    }
    return mark
  }

  const resolve = useCallback(() => {
    let mark = findMatches()
    let total = 0
    while (mark.some((row) => row.some(Boolean))) {
      let cleared = 0
      const board = boardRef.current
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (mark[r]![c]) {
            board[r]![c] = 0
            cleared++
          }
        }
      }
      total += cleared
      comboRef.current++
      // gravity
      for (let c = 0; c < SIZE; c++) {
        const col: number[] = []
        for (let r = SIZE - 1; r >= 0; r--) if (board[r]![c]) col.push(board[r]![c]!)
        for (let r = SIZE - 1; r >= 0; r--) {
          board[r]![c] = col[SIZE - 1 - r] ?? 0
        }
      }
      // refill
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (board[r]![c] === 0) board[r]![c] = Math.floor(Math.random() * 3) + 1
        }
      }
      mark = findMatches()
    }
    if (total > 0) {
      scoreRef.current += total * 15
      emitEvent({ type: 'combo', detail: `消除 ${total} 颗`, score: scoreRef.current })
      if (comboRef.current >= 2) emitEvent({ type: 'combo', detail: '连锁反应', score: scoreRef.current })
    } else {
      comboRef.current = 0
    }
    if (scoreRef.current >= 300) emitEvent({ type: 'milestone', detail: '300 分', score: scoreRef.current })
    if (movesRef.current <= 5) emitEvent({ type: 'crisis', detail: '步数告急', score: scoreRef.current })
    if (movesRef.current <= 0) {
      overRef.current = true
      const won = scoreRef.current >= 200
      emitEvent({ type: 'gameOver', detail: won ? '达标' : '步数耗尽', score: scoreRef.current, won })
      emitEvent({ type: won ? 'win' : 'lose', score: scoreRef.current })
    }
    draw()
  }, [draw, emitEvent])

  const trySwap = useCallback(
    (a: [number, number], b: [number, number]) => {
      if (overRef.current) return
      swap(a, b)
      const mark = findMatches()
      if (!mark.some((row) => row.some(Boolean))) {
        swap(a, b)
        return
      }
      movesRef.current--
      resolve()
    },
    [resolve],
  )

  useEffect(() => {
    draw()
  }, [draw])

  const handleTap = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas || overRef.current) return
    const rect = canvas.getBoundingClientRect()
    const cell = Math.min(rect.width, rect.height) / SIZE
    const ox = (rect.width - cell * SIZE) / 2
    const oy = (rect.height - cell * SIZE) / 2 + 10
    const c = Math.floor((clientX - rect.left - ox) / cell)
    const r = Math.floor((clientY - rect.top - oy) / cell)
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return
    const sel = selectedRef.current
    if (!sel) {
      selectedRef.current = [r, c]
    } else {
      const [sr, sc] = sel
      if (Math.abs(sr - r) + Math.abs(sc - c) === 1) {
        trySwap([sr, sc], [r, c])
      }
      selectedRef.current = null
    }
    draw()
  }

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto aspect-square w-full max-w-[min(92vw,360px)] touch-none"
      onPointerDown={(e) => {
        e.preventDefault()
        handleTap(e.clientX, e.clientY)
      }}
    />
  )
}
