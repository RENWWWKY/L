import { useCallback, useEffect, useRef } from 'react'

import { MONO, type GameEventEmitter } from '../types'

const COLS = 8
const ROWS = 12
const COLORS = [MONO.gray400, MONO.gray500, MONO.inkSoft, MONO.platinum, MONO.gray300]

type Cell = { color: number; alive: boolean }

function makeGrid(): Cell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ color: Math.floor(Math.random() * COLORS.length), alive: true })),
  )
}

function findCluster(grid: Cell[][], r: number, c: number, visited: boolean[][]) {
  const color = grid[r]![c]!.color
  const stack: [number, number][] = [[r, c]]
  const cluster: [number, number][] = []
  visited[r]![c] = true
  while (stack.length) {
    const [cr, cc] = stack.pop()!
    cluster.push([cr, cc])
    for (const [dr, dc] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const nr = cr + dr
      const nc = cc + dc
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue
      if (visited[nr]![nc]) continue
      if (!grid[nr]![nc]!.alive || grid[nr]![nc]!.color !== color) continue
      visited[nr]![nc] = true
      stack.push([nr, nc])
    }
  }
  return cluster
}

export function BubbleShooterGame({ emitEvent }: { emitEvent: GameEventEmitter }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gridRef = useRef(makeGrid())
  const aimAngleRef = useRef(-Math.PI / 2)
  const shooterXRef = useRef(0)
  const scoreRef = useRef(0)
  const shotsRef = useRef(0)
  const comboRef = useRef(0)
  const overRef = useRef(false)
  const nextColorRef = useRef(0)
  const flyingRef = useRef<{ x: number; y: number; vx: number; vy: number; color: number } | null>(null)

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

    const cell = Math.min(w / COLS, (h * 0.72) / ROWS)
    const ox = (w - cell * COLS) / 2
    const oy = 24
    shooterXRef.current = w / 2

    const grid = gridRef.current
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cellData = grid[r]![c]!
        if (!cellData.alive) continue
        const cx = ox + c * cell + cell / 2 + (r % 2 ? cell / 2 : 0)
        const cy = oy + r * cell * 0.86 + cell / 2
        ctx.fillStyle = COLORS[cellData.color] ?? MONO.gray400
        ctx.beginPath()
        ctx.arc(cx, cy, cell * 0.38, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = MONO.surface
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    const sx = shooterXRef.current
    const sy = h - 36
    ctx.strokeStyle = MONO.gray300
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx + Math.cos(aimAngleRef.current) * 60, sy + Math.sin(aimAngleRef.current) * 60)
    ctx.stroke()

    const drawBubble = (x: number, y: number, color: number) => {
      ctx.fillStyle = COLORS[color] ?? MONO.gray400
      ctx.beginPath()
      ctx.arc(x, y, cell * 0.38, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = MONO.ink
      ctx.lineWidth = 0.8
      ctx.stroke()
    }
    drawBubble(sx, sy, nextColorRef.current)

    const fly = flyingRef.current
    if (fly) drawBubble(fly.x, fly.y, fly.color)

    ctx.fillStyle = MONO.inkSoft
    ctx.font = '600 11px system-ui'
    ctx.fillText(`SCORE ${scoreRef.current}`, 8, 16)
  }, [])

  const popCluster = useCallback(
    (cluster: [number, number][]) => {
      if (cluster.length < 3) return 0
      const grid = gridRef.current
      for (const [r, c] of cluster) grid[r]![c]!.alive = false
      scoreRef.current += cluster.length * 10
      comboRef.current++
      emitEvent({ type: 'combo', detail: `${cluster.length} 连消`, score: scoreRef.current })
      return cluster.length
    },
    [emitEvent],
  )

  const checkFloating = useCallback(() => {
    const grid = gridRef.current
    const connected = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false))
    for (let c = 0; c < COLS; c++) {
      if (grid[0]![c]!.alive) {
        const cluster = findCluster(grid, 0, c, connected)
        for (const [r, cc] of cluster) connected[r]![cc] = true
      }
    }
    let dropped = 0
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r]![c]!.alive && !connected[r]![c]) {
          grid[r]![c]!.alive = false
          dropped++
        }
      }
    }
    if (dropped > 0) {
      scoreRef.current += dropped * 5
      emitEvent({ type: 'combo', detail: `坠落 ${dropped}`, score: scoreRef.current })
    }
  }, [emitEvent])

  const snapFlying = useCallback(() => {
    const fly = flyingRef.current
    const canvas = canvasRef.current
    if (!fly || !canvas) return
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    const cell = Math.min(w / COLS, (h * 0.72) / ROWS)
    const ox = (w - cell * COLS) / 2
    const oy = 24
    const grid = gridRef.current

    let bestR = 0
    let bestC = 0
    let bestD = Infinity
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!grid[r]![c]!.alive) continue
        const cx = ox + c * cell + cell / 2 + (r % 2 ? cell / 2 : 0)
        const cy = oy + r * cell * 0.86 + cell / 2
        const d = Math.hypot(fly.x - cx, fly.y - cy)
        if (d < bestD) {
          bestD = d
          bestR = r
          bestC = c
        }
      }
    }
    // attach to nearest empty neighbor row
    let tr = Math.min(ROWS - 1, bestR + 1)
    let tc = bestC
    if (grid[tr]![tc]!.alive) {
      tr = bestR
      tc = Math.min(COLS - 1, bestC + (fly.x > ox + bestC * cell ? 1 : -1))
    }
    if (tr >= 0 && tc >= 0 && tc < COLS && !grid[tr]![tc]!.alive) {
      grid[tr]![tc] = { color: fly.color, alive: true }
      const visited = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false))
      const cluster = findCluster(grid, tr, tc, visited)
      popCluster(cluster)
      checkFloating()
    }
    flyingRef.current = null
    shotsRef.current++
    if (shotsRef.current >= 20 && scoreRef.current < 80) {
      emitEvent({ type: 'crisis', detail: '得分偏低', score: scoreRef.current })
    }
    const aliveCount = grid.flat().filter((x) => x.alive).length
    if (aliveCount === 0) {
      overRef.current = true
      emitEvent({ type: 'win', score: scoreRef.current })
      emitEvent({ type: 'gameOver', detail: '清盘', score: scoreRef.current, won: true })
    }
    nextColorRef.current = Math.floor(Math.random() * COLORS.length)
  }, [checkFloating, emitEvent, popCluster])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const fly = flyingRef.current
      if (fly) {
        fly.x += fly.vx
        fly.y += fly.vy
        const canvas = canvasRef.current
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          if (fly.y < 20 || fly.x < 10 || fly.x > rect.width - 10) {
            snapFlying()
          }
        }
      }
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [draw, snapFlying])

  const shoot = useCallback(() => {
    if (overRef.current || flyingRef.current) return
    const speed = 9
    flyingRef.current = {
      x: shooterXRef.current,
      y: canvasRef.current ? canvasRef.current.getBoundingClientRect().height - 36 : 400,
      vx: Math.cos(aimAngleRef.current) * speed,
      vy: Math.sin(aimAngleRef.current) * speed,
      color: nextColorRef.current,
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto aspect-[2/3] w-full max-w-[min(92vw,320px)] touch-none"
      onPointerMove={(e) => {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        const sx = rect.width / 2
        const sy = rect.height - 36
        aimAngleRef.current = Math.atan2(e.clientY - rect.top - sy, e.clientX - rect.left - sx)
        aimAngleRef.current = Math.max(-Math.PI + 0.2, Math.min(-0.2, aimAngleRef.current))
      }}
      onPointerUp={() => shoot()}
    />
  )
}
