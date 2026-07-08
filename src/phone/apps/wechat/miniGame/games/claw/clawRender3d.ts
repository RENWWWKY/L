/** 3D 世界 → 屏幕投影与机台绘制（伪 3D，无 WebGL） */
import { MONO } from '../../types'
import { clawVisualPos } from './clawEngine'
import { getPlushImage } from './clawPlushAssets'
import { getPlushCatalogEntry } from './clawPlushCatalog'
import type { ClawAnimState, ClawGameState, PlushKind } from './clawTypes'
import {
  CLAW_ARENA_H,
  CLAW_ARENA_W,
  CLAW_DROP_X,
  CLAW_DROP_Z,
  CLAW_FLOOR_Y,
  CLAW_MAX_X,
  CLAW_MAX_Z,
  CLAW_MIN_X,
  CLAW_MIN_Z,
  CLAW_RAIL_Y,
} from './clawTypes'

export type Projected = { sx: number; sy: number; scale: number; depth: number }

const VIEW = {
  left: 10,
  right: 10,
  top: 22,
  bottom: 18,
}

/** 贴图底部透明留白补偿：略往下压，让视觉底部贴近地板阴影 */
const PLUSH_FOOT_SINK_RATIO = 0.12

export function project3D(x: number, y: number, z: number): Projected {
  const wx = (x - CLAW_MIN_X) / (CLAW_MAX_X - CLAW_MIN_X)
  const wz = (z - CLAW_MIN_Z) / (CLAW_MAX_Z - CLAW_MIN_Z)
  const wy = (y - CLAW_FLOOR_Y) / (CLAW_RAIL_Y + 24 - CLAW_FLOOR_Y)

  const usableW = CLAW_ARENA_W - VIEW.left - VIEW.right
  const usableH = CLAW_ARENA_H - VIEW.top - VIEW.bottom

  // 铺满画布：前宽后窄、前低后高的透视
  const sx = VIEW.left + wx * usableW * 0.64 + wz * usableW * 0.3
  const sy = VIEW.top + usableH * 0.84 - wy * usableH * 0.5 - wz * usableH * 0.34

  // backness 驱动缩放（越远越小）；depth 驱动绘制顺序（越小越先画 = 越远）
  const backness = wz * 0.62 + (1 - wx) * 0.08
  const scale = 0.88 + (1 - backness) * 0.42
  const depth = (1 - wz) * 0.62 + wx * 0.08 + wy * 0.06

  return { sx, sy, scale, depth }
}

function drawPlushie3D(
  ctx: CanvasRenderingContext2D,
  kind: PlushKind,
  x: number,
  y: number,
  z: number,
  radius: number,
  alpha = 1,
  opts?: { hangFromTop?: boolean },
) {
  const p = project3D(x, y, z)
  const r = radius * p.scale
  const meta = getPlushCatalogEntry(kind)
  const img = getPlushImage(kind)
  const hangFromTop = opts?.hangFromTop ?? false
  const floorP = project3D(x, CLAW_FLOOR_Y + 3, z)
  const footP = hangFromTop ? project3D(x, y, z) : floorP
  ctx.save()
  ctx.globalAlpha = alpha
  if (!hangFromTop) {
    const shadowR = r * 0.82
    ctx.fillStyle = 'rgba(0,0,0,0.14)'
    ctx.beginPath()
    ctx.ellipse(floorP.sx, floorP.sy + 1, shadowR, shadowR * 0.32, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  if (img) {
    const size = r * 2.35
    const footSink = hangFromTop ? 0 : size * PLUSH_FOOT_SINK_RATIO
    const drawX = p.sx - size / 2
    const drawY = hangFromTop ? p.sy : footP.sy - size + footSink
    ctx.drawImage(img, drawX, drawY, size, size)
  } else {
    const footSink = hangFromTop ? 0 : r * 0.28
    const grad = ctx.createRadialGradient(
      p.sx - r * 0.25,
      footP.sy - r * 1.15 + footSink,
      r * 0.1,
      p.sx,
      footP.sy - r * 0.65 + footSink,
      r,
    )
    grad.addColorStop(0, '#F3F4F6')
    grad.addColorStop(1, '#D1D5DB')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(p.sx, footP.sy - r * 0.65 + footSink, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#6B7280'
    ctx.font = `600 ${Math.max(9, Math.round(r * 0.65))}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(meta.label.slice(0, 1), p.sx, footP.sy - r * 0.65 + footSink + 1)
  }
  ctx.restore()
}

function drawGlassCabinet(ctx: CanvasRenderingContext2D) {
  const fl = project3D(CLAW_MIN_X, CLAW_FLOOR_Y, CLAW_MIN_Z)
  const fr = project3D(CLAW_MAX_X, CLAW_FLOOR_Y, CLAW_MIN_Z)
  const bl = project3D(CLAW_MIN_X, CLAW_FLOOR_Y, CLAW_MAX_Z)
  const br = project3D(CLAW_MAX_X, CLAW_FLOOR_Y, CLAW_MAX_Z)
  const tl = project3D(CLAW_MIN_X, CLAW_RAIL_Y + 20, CLAW_MIN_Z)
  const tr = project3D(CLAW_MAX_X, CLAW_RAIL_Y + 20, CLAW_MIN_Z)
  const tbl = project3D(CLAW_MIN_X, CLAW_RAIL_Y + 20, CLAW_MAX_Z)
  const tbr = project3D(CLAW_MAX_X, CLAW_RAIL_Y + 20, CLAW_MAX_Z)

  // 外框占满画布
  const outer = { x: 4, y: 4, w: CLAW_ARENA_W - 8, h: CLAW_ARENA_H - 8 }
  const bodyGrad = ctx.createLinearGradient(0, 0, 0, CLAW_ARENA_H)
  bodyGrad.addColorStop(0, '#FFEDD5')
  bodyGrad.addColorStop(1, '#FDBA74')
  ctx.fillStyle = bodyGrad
  ctx.fillRect(outer.x, outer.y, outer.w, outer.h)
  ctx.strokeStyle = '#EA580C'
  ctx.lineWidth = 3
  ctx.strokeRect(outer.x, outer.y, outer.w, outer.h)

  // 顶部装饰条
  ctx.fillStyle = '#FB923C'
  ctx.fillRect(outer.x, outer.y, outer.w, 14)

  ctx.fillStyle = '#FED7AA'
  ctx.beginPath()
  ctx.moveTo(bl.sx, bl.sy)
  ctx.lineTo(br.sx, br.sy)
  ctx.lineTo(tbr.sx, tbr.sy)
  ctx.lineTo(tbl.sx, tbl.sy)
  ctx.closePath()
  ctx.fill()

  const floorGrad = ctx.createLinearGradient(fl.sx, fl.sy, bl.sx, bl.sy)
  floorGrad.addColorStop(0, '#FDE68A')
  floorGrad.addColorStop(1, '#FCD34D')
  ctx.fillStyle = floorGrad
  ctx.beginPath()
  ctx.moveTo(fl.sx, fl.sy)
  ctx.lineTo(fr.sx, fr.sy)
  ctx.lineTo(br.sx, br.sy)
  ctx.lineTo(bl.sx, bl.sy)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(180,120,40,0.25)'
  ctx.lineWidth = 1
  for (let i = 1; i <= 3; i += 1) {
    const t = i / 4
    const a = project3D(CLAW_MIN_X + (CLAW_MAX_X - CLAW_MIN_X) * t, CLAW_FLOOR_Y, CLAW_MIN_Z)
    const b = project3D(CLAW_MIN_X + (CLAW_MAX_X - CLAW_MIN_X) * t, CLAW_FLOOR_Y, CLAW_MAX_Z)
    ctx.beginPath()
    ctx.moveTo(a.sx, a.sy)
    ctx.lineTo(b.sx, b.sy)
    ctx.stroke()
    const c = project3D(CLAW_MIN_X, CLAW_FLOOR_Y, CLAW_MIN_Z + (CLAW_MAX_Z - CLAW_MIN_Z) * t)
    const d = project3D(CLAW_MAX_X, CLAW_FLOOR_Y, CLAW_MIN_Z + (CLAW_MAX_Z - CLAW_MIN_Z) * t)
    ctx.beginPath()
    ctx.moveTo(c.sx, c.sy)
    ctx.lineTo(d.sx, d.sy)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(fl.sx, fl.sy)
  ctx.lineTo(bl.sx, bl.sy)
  ctx.lineTo(tbl.sx, tbl.sy)
  ctx.lineTo(tl.sx, tl.sy)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(fr.sx, fr.sy)
  ctx.lineTo(br.sx, br.sy)
  ctx.lineTo(tbr.sx, tbr.sy)
  ctx.lineTo(tr.sx, tr.sy)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath()
  ctx.moveTo(tl.sx, tl.sy)
  ctx.lineTo(tr.sx, tr.sy)
  ctx.lineTo(tbr.sx, tbr.sy)
  ctx.lineTo(tbl.sx, tbl.sy)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.strokeStyle = MONO.gray400
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(tl.sx, tl.sy)
  ctx.lineTo(tr.sx, tr.sy)
  ctx.stroke()

  const chute = project3D(CLAW_DROP_X, CLAW_FLOOR_Y, CLAW_DROP_Z)
  ctx.fillStyle = '#374151'
  ctx.fillRect(chute.sx - 18, chute.sy - 4, 36, 28)
  ctx.fillStyle = MONO.gray200
  ctx.fillRect(chute.sx - 14, chute.sy, 28, 20)
}

/** 爪子在箱底地板上的投影，随高度缩小变淡（与抓取判定共用 claw.x/z） */
function drawClawFloorShadow(ctx: CanvasRenderingContext2D, claw: ClawAnimState) {
  const heightT = Math.max(
    0,
    Math.min(1, (claw.y - CLAW_FLOOR_Y) / (CLAW_RAIL_Y - CLAW_FLOOR_Y)),
  )
  const p = project3D(claw.x, CLAW_FLOOR_Y + 3, claw.z)
  const spread = 0.42 + (1 - heightT) * 0.58
  const rx = (10 + p.scale * 6) * spread
  const ry = (3.5 + p.scale * 2) * spread
  const alpha = 0.07 + (1 - heightT) * 0.2

  ctx.save()
  ctx.fillStyle = `rgba(20,16,12,${alpha})`
  ctx.beginPath()
  ctx.ellipse(p.sx, p.sy + 1, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawClawRope3D(ctx: CanvasRenderingContext2D, claw: ClawAnimState) {
  const visual = clawVisualPos(claw)
  const rail = project3D(claw.x, CLAW_RAIL_Y + 24, claw.z)
  const tip = project3D(visual.x, visual.y, claw.z)
  const midX = (rail.sx + tip.sx) / 2 + (tip.sx - rail.sx) * 0.15
  const midY = (rail.sy + tip.sy) / 2 - 8

  ctx.strokeStyle = MONO.gray500
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(rail.sx, rail.sy)
  ctx.quadraticCurveTo(midX, midY, tip.sx, tip.sy - 10)
  ctx.stroke()
}

function drawClawHead3D(ctx: CanvasRenderingContext2D, claw: ClawAnimState) {
  const visual = clawVisualPos(claw)
  const tip = project3D(visual.x, visual.y, claw.z)
  const openGap = (8 + claw.open * 10) * tip.scale
  ctx.strokeStyle = MONO.ink
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(tip.sx, tip.sy - 10)
  ctx.lineTo(tip.sx, tip.sy + 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(tip.sx, tip.sy + 2)
  ctx.lineTo(tip.sx - openGap, tip.sy + 12)
  ctx.moveTo(tip.sx, tip.sy + 2)
  ctx.lineTo(tip.sx + openGap, tip.sy + 12)
  ctx.stroke()
}

export function drawMachine3D(ctx: CanvasRenderingContext2D, w: number, h: number, state: ClawGameState) {
  ctx.save()
  ctx.scale(w / CLAW_ARENA_W, h / CLAW_ARENA_H)

  drawGlassCabinet(ctx)
  drawClawFloorShadow(ctx, state.claw)

  const { claw } = state
  const sortables: Array<{ depth: number; draw: () => void }> = []

  for (const p of state.plushies) {
    if (p.grabbedBy != null) continue
    const pr = project3D(p.x, p.y, p.z)
    sortables.push({
      depth: pr.depth,
      draw: () => drawPlushie3D(ctx, p.kind, p.x, p.y, p.z, p.radius),
    })
  }

  if (state.falling) {
    const f = state.falling
    const pr = project3D(f.x, f.y, f.z)
    sortables.push({
      depth: pr.depth + 0.08,
      draw: () => drawPlushie3D(ctx, f.kind, f.x, f.y, f.z, f.radius, f.fade),
    })
  }

  sortables.sort((a, b) => a.depth - b.depth)
  for (const item of sortables) item.draw()

  drawClawRope3D(ctx, claw)
  if (claw.carrying) {
    const c = claw.carrying
    drawPlushie3D(ctx, c.kind, c.x, c.y, c.z, c.radius, 1, { hangFromTop: true })
  }
  drawClawHead3D(ctx, claw)

  const turnLabel = claw.activePlayer === 1 ? '你的回合' : '角色回合'
  ctx.fillStyle = MONO.inkSoft
  ctx.font = '600 11px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(turnLabel, CLAW_ARENA_W / 2, 12)

  ctx.restore()
}
