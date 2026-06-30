import { useCallback, useEffect, useRef } from 'react'

import { MONO, type GameEventEmitter } from '../types'

type Pt = { x: number; y: number }

export function SerpentGame({ emitEvent }: { emitEvent: GameEventEmitter }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cols = 20
  const rows = 28
  const snakeRef = useRef<Pt[]>([{ x: 10, y: 14 }, { x: 9, y: 14 }, { x: 8, y: 14 }])
  const dirRef = useRef<Pt>({ x: 1, y: 0 })
  const nextDirRef = useRef<Pt>({ x: 1, y: 0 })
  const foodRef = useRef<Pt>({ x: 15, y: 10 })
  const scoreRef = useRef(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const overRef = useRef(false)
  const crisisRef = useRef(false)
  const comboRef = useRef(0)

  const spawnFood = useCallback(() => {
    const occupied = new Set(snakeRef.current.map((p) => `${p.x},${p.y}`))
    let tries = 0
    while (tries++ < 200) {
      const p = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) }
      if (!occupied.has(`${p.x},${p.y}`)) {
        foodRef.current = p
        return
      }
    }
  }, [])

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

    const cellW = w / cols
    const cellH = h / rows

    ctx.strokeStyle = MONO.gray200
    ctx.lineWidth = 0.5
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath()
      ctx.moveTo(x * cellW, 0)
      ctx.lineTo(x * cellW, h)
      ctx.stroke()
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * cellH)
      ctx.lineTo(w, y * cellH)
      ctx.stroke()
    }

    const food = foodRef.current
    ctx.fillStyle = MONO.platinum
    ctx.beginPath()
    ctx.arc(food.x * cellW + cellW / 2, food.y * cellH + cellH / 2, Math.min(cellW, cellH) * 0.35, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = MONO.gray400
    ctx.stroke()

    snakeRef.current.forEach((p, i) => {
      const t = i / Math.max(1, snakeRef.current.length - 1)
      const g = Math.round(30 + t * 40)
      ctx.fillStyle = i === 0 ? MONO.ink : `rgb(${g},${g},${g})`
      const pad = 2
      ctx.beginPath()
      ctx.roundRect(p.x * cellW + pad, p.y * cellH + pad, cellW - pad * 2, cellH - pad * 2, 3)
      ctx.fill()
    })

    ctx.fillStyle = MONO.inkSoft
    ctx.font = '600 12px system-ui'
    ctx.fillText(`SCORE ${scoreRef.current}`, 8, 16)
  }, [])

  const step = useCallback(() => {
    if (overRef.current) return
    const d = nextDirRef.current
    const cur = dirRef.current
    if (!(d.x === -cur.x && d.y === -cur.y)) dirRef.current = d

    const head = snakeRef.current[0]!
    const nh = { x: head.x + dirRef.current.x, y: head.y + dirRef.current.y }

    if (nh.x < 0 || nh.x >= cols || nh.y < 0 || nh.y >= rows) {
      overRef.current = true
      emitEvent({ type: 'gameOver', detail: '撞墙', score: scoreRef.current })
      emitEvent({ type: 'lose', score: scoreRef.current })
      return
    }
    if (snakeRef.current.some((p) => p.x === nh.x && p.y === nh.y)) {
      overRef.current = true
      emitEvent({ type: 'gameOver', detail: '咬到自己', score: scoreRef.current })
      emitEvent({ type: 'lose', score: scoreRef.current })
      return
    }

    const distWall = Math.min(nh.x, cols - 1 - nh.x, nh.y, rows - 1 - nh.y)
    if (!crisisRef.current && distWall <= 1) {
      crisisRef.current = true
      emitEvent({ type: 'crisis', detail: '濒临撞墙', score: scoreRef.current })
    }

    snakeRef.current.unshift(nh)
    const ate = nh.x === foodRef.current.x && nh.y === foodRef.current.y
    if (ate) {
      scoreRef.current += 10
      comboRef.current++
      if (comboRef.current >= 3) emitEvent({ type: 'combo', detail: `连续 ${comboRef.current} 粒`, score: scoreRef.current })
      if (scoreRef.current === 50) emitEvent({ type: 'milestone', detail: '长度突破', score: scoreRef.current })
      spawnFood()
    } else {
      comboRef.current = 0
      snakeRef.current.pop()
    }
    draw()
  }, [draw, emitEvent, spawnFood])

  useEffect(() => {
    draw()
    tickRef.current = setInterval(step, 140)
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Pt> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
      }
      const d = map[e.key]
      if (d) {
        e.preventDefault()
        nextDirRef.current = d
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      window.removeEventListener('keydown', onKey)
    }
  }, [draw, step])

  const touchStart = useRef<{ x: number; y: number } | null>(null)

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto aspect-[5/7] w-full max-w-[min(92vw,340px)] touch-none"
      onPointerDown={(e) => {
        touchStart.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={(e) => {
        const s = touchStart.current
        if (!s) return
        const dx = e.clientX - s.x
        const dy = e.clientY - s.y
        touchStart.current = null
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return
        if (Math.abs(dx) > Math.abs(dy)) nextDirRef.current = { x: dx > 0 ? 1 : -1, y: 0 }
        else nextDirRef.current = { x: 0, y: dy > 0 ? 1 : -1 }
      }}
    />
  )
}
