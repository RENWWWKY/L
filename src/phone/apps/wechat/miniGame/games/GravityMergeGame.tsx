import { useCallback, useEffect, useRef } from 'react'

import { MONO, type GameEventEmitter } from '../types'

/** 合成等级：半径与灰度递增 */
const TIERS = [
  { r: 14, gray: 220 },
  { r: 18, gray: 190 },
  { r: 22, gray: 160 },
  { r: 28, gray: 130 },
  { r: 34, gray: 100 },
  { r: 42, gray: 70 },
  { r: 52, gray: 40 },
  { r: 64, gray: 15 },
]

type Ball = { x: number; y: number; tier: number; vx: number; vy: number; id: number }

export function GravityMergeGame({ emitEvent }: { emitEvent: GameEventEmitter }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ballsRef = useRef<Ball[]>([])
  const nextIdRef = useRef(1)
  const scoreRef = useRef(0)
  const overRef = useRef(false)
  const rafRef = useRef<number>(0)
  const widthRef = useRef(360)
  const heightRef = useRef(520)
  const dropTierRef = useRef(0)
  const comboRef = useRef(0)

  const drawBall = useCallback((ctx: CanvasRenderingContext2D, b: Ball) => {
    const tier = TIERS[b.tier] ?? TIERS[0]!
    const g = tier.gray
    const grad = ctx.createRadialGradient(b.x - tier.r * 0.25, b.y - tier.r * 0.25, tier.r * 0.1, b.x, b.y, tier.r)
    grad.addColorStop(0, `rgb(${Math.min(255, g + 30)},${Math.min(255, g + 30)},${Math.min(255, g + 28)})`)
    grad.addColorStop(1, `rgb(${g},${g},${g})`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(b.x, b.y, tier.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = MONO.platinum
    ctx.lineWidth = 1.2
    ctx.stroke()
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = widthRef.current
    const h = heightRef.current
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = MONO.bg
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = MONO.gray300
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(20, h - 20)
    ctx.lineTo(w - 20, h - 20)
    ctx.stroke()

    const dangerY = 80
    ctx.strokeStyle = MONO.gray200
    ctx.setLineDash([4, 6])
    ctx.beginPath()
    ctx.moveTo(20, dangerY)
    ctx.lineTo(w - 20, dangerY)
    ctx.stroke()
    ctx.setLineDash([])

    for (const b of ballsRef.current) drawBall(ctx, b)

    ctx.fillStyle = MONO.inkSoft
    ctx.font = '600 12px system-ui'
    ctx.fillText(`MERGE ${scoreRef.current}`, 14, 22)
  }, [drawBall])

  const mergePair = useCallback(
    (a: Ball, b: Ball) => {
      const nextTier = a.tier + 1
      scoreRef.current += (nextTier + 1) * 10
      comboRef.current++
      if (comboRef.current >= 2) {
        emitEvent({ type: 'combo', detail: `连续合成 x${comboRef.current}`, score: scoreRef.current })
      }
      if (nextTier >= 5) {
        emitEvent({ type: 'milestone', detail: `合成至 Tier ${nextTier}`, score: scoreRef.current })
      }
      const nx = (a.x + b.x) / 2
      const ny = (a.y + b.y) / 2
      ballsRef.current = ballsRef.current.filter((x) => x.id !== a.id && x.id !== b.id)
      if (nextTier < TIERS.length) {
        ballsRef.current.push({ x: nx, y: ny, tier: nextTier, vx: 0, vy: 0, id: nextIdRef.current++ })
      }
    },
    [emitEvent],
  )

  const physics = useCallback(() => {
    if (overRef.current) return
    const w = widthRef.current
    const h = heightRef.current
    const floor = h - 20
    const gravity = 0.35

    for (const b of ballsRef.current) {
      b.vy += gravity
      b.x += b.vx
      b.y += b.vy
      const r = (TIERS[b.tier] ?? TIERS[0]!).r
      if (b.x - r < 20) {
        b.x = 20 + r
        b.vx *= -0.3
      }
      if (b.x + r > w - 20) {
        b.x = w - 20 - r
        b.vx *= -0.3
      }
      if (b.y + r > floor) {
        b.y = floor - r
        b.vy *= -0.15
        b.vx *= 0.92
        if (Math.abs(b.vy) < 0.5) b.vy = 0
      }
    }

    // ball-ball collision + merge
    const balls = ballsRef.current
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i]!
        const b = balls[j]!
        const ra = (TIERS[a.tier] ?? TIERS[0]!).r
        const rb = (TIERS[b.tier] ?? TIERS[0]!).r
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy)
        const minD = ra + rb
        if (dist < minD && dist > 0) {
          if (a.tier === b.tier && a.tier < TIERS.length - 1 && Math.abs(a.vy) + Math.abs(b.vy) < 2) {
            mergePair(a, b)
            comboRef.current = 0
            return
          }
          const overlap = minD - dist
          const nx = dx / dist
          const ny = dy / dist
          a.x -= nx * overlap * 0.5
          a.y -= ny * overlap * 0.5
          b.x += nx * overlap * 0.5
          b.y += ny * overlap * 0.5
        }
      }
    }

    const danger = balls.some((b) => b.y - (TIERS[b.tier] ?? TIERS[0]!).r < 80)
    if (danger) emitEvent({ type: 'crisis', detail: '堆叠过高', score: scoreRef.current })

    if (balls.some((b) => b.y - (TIERS[b.tier] ?? TIERS[0]!).r < 40)) {
      overRef.current = true
      emitEvent({ type: 'gameOver', detail: '溢出边界', score: scoreRef.current })
      emitEvent({ type: 'lose', score: scoreRef.current })
    }
  }, [emitEvent, mergePair])

  useEffect(() => {
    const loop = () => {
      physics()
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [draw, physics])

  const drop = useCallback(
    (x: number) => {
      if (overRef.current) return
      const w = widthRef.current
      const tier = dropTierRef.current
      dropTierRef.current = (dropTierRef.current + 1) % 4
      const r = (TIERS[tier] ?? TIERS[0]!).r
      const clamped = Math.max(20 + r, Math.min(w - 20 - r, x))
      ballsRef.current.push({ x: clamped, y: 50, tier, vx: 0, vy: 0, id: nextIdRef.current++ })
    },
    [],
  )

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto aspect-[9/13] w-full max-w-[min(92vw,360px)] touch-none"
      onPointerDown={(e) => {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        widthRef.current = rect.width
        heightRef.current = rect.height
        drop(e.clientX - rect.left)
      }}
    />
  )
}
