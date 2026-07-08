/**
 * 抓娃娃机 · 3D 平面移动 + 脚本下潜 + 轻量物理
 */
import type { ClawDifficultyLevel } from './clawDifficulty'
import { clawGrabSuccessMultiplier } from './clawDifficulty'
import {
  integrateSpring1D,
  pendulumOffset,
  smoothMove1D,
  tickGravityBody3,
  tickPendulum,
  tickPlushPile3D,
} from './clawPhysics'
import { remainingPlushies, spawnPlushPile, pickSessionPlushKinds } from './clawPlushies'
import type { ClawAnimState, ClawGameState, ClawPlayer, Plushie } from './clawTypes'
import {
  CLAW_DESCEND_Y,
  CLAW_DROP_X,
  CLAW_DROP_Z,
  CLAW_MAX_X,
  CLAW_MAX_Z,
  CLAW_MIN_X,
  CLAW_MIN_Z,
  CLAW_RAIL_Y,
  CLAW_TURNS_PER_PLAYER,
  clampClawX,
  clampClawZ,
} from './clawTypes'

const CENTER_X = (CLAW_MIN_X + CLAW_MAX_X) / 2
const CENTER_Z = (CLAW_MIN_Z + CLAW_MAX_Z) / 2

/** 下潜 / 合爪 / 上升 的插值速率（越小越慢） */
const CLAW_DESCEND_RATE = 1.85
const CLAW_CLOSE_RATE = 4.2
const CLAW_ASCEND_RATE = 1.65

/** 导轨平移：弹簧阻尼 + 限速，落口/复位更慢更顺 */
const CLAW_DELIVER_RAIL = { stiffness: 11, damping: 9.5, maxSpeed: 34 }
const CLAW_RESET_RAIL = { stiffness: 13, damping: 9.5, maxSpeed: 40 }
const CLAW_OPEN_AT_DROP_RATE = 2.6

/** 抓取判定：与地板投影对齐，reach 为半径倍数 */
const GRAB_REACH_MULT = 1.72
/** 玩家对准度超过此值则必中（不再随机空抓） */
const GRAB_PLAYER_AUTO_ALIGN = 0.58

export function createClawGameState(playerGoesFirst: boolean): ClawGameState {
  const first: ClawPlayer = playerGoesFirst ? 1 : 2
  const sessionKinds = pickSessionPlushKinds(4)
  return {
    plushies: spawnPlushPile(sessionKinds),
    sessionKinds,
    claw: {
      x: CENTER_X,
      y: CLAW_RAIL_Y,
      z: CENTER_Z,
      targetX: CENTER_X,
      targetZ: CENTER_Z,
      phase: 'idle',
      open: 1,
      carrying: null,
      carryFromX: 0,
      carryFromY: 0,
      carryFromZ: 0,
      carryAttach: 0,
      swingAngle: 0,
      swingVel: 0,
      prevX: CENTER_X,
      prevZ: CENTER_Z,
      railVelX: 0,
      railVelZ: 0,
      carryLagX: 0,
      carryLagY: 0,
      carryLagZ: 0,
      carryLagVx: 0,
      carryLagVy: 0,
      carryLagVz: 0,
      activePlayer: first,
      turnIndex: 0,
    },
    falling: null,
    pendingTurnComplete: null,
    playerScore: 0,
    charScore: 0,
    playerTurnsLeft: CLAW_TURNS_PER_PLAYER,
    charTurnsLeft: CLAW_TURNS_PER_PLAYER,
    gameOver: false,
  }
}

export function isPlayerTurn(state: ClawGameState): boolean {
  return state.claw.activePlayer === 1 && !state.gameOver
}

export function canPlayerControl(state: ClawGameState): boolean {
  return isPlayerTurn(state) && state.claw.phase === 'idle'
}

export function applyJoystickInput(state: ClawGameState, nx: number, nz: number, dt: number): void {
  if (!canPlayerControl(state)) return
  const speed = 165
  const claw = state.claw
  claw.x = clampClawX(claw.x + nx * speed * dt)
  claw.z = clampClawZ(claw.z + nz * speed * dt)
  claw.targetX = claw.x
  claw.targetZ = claw.z
}

export function clawVisualPos(claw: ClawAnimState): { x: number; y: number; z: number } {
  const ropeLen = Math.max(24, claw.y - CLAW_RAIL_Y + 20)
  const { ox, oy } = pendulumOffset(claw.swingAngle, ropeLen)
  return { x: claw.x + ox, y: claw.y + oy, z: claw.z }
}

export function clawCarryAnchorY(clawY: number): number {
  return clawY - 14
}

function findGrabTarget(state: ClawGameState, clawX: number, clawZ: number): Plushie | null {
  const available = remainingPlushies(state.plushies)
  if (available.length === 0) return null
  let best: Plushie | null = null
  let bestDist = Infinity
  for (const p of available) {
    const dist = Math.hypot(clawX - p.x, clawZ - p.z)
    const reach = p.radius * GRAB_REACH_MULT
    if (dist > reach) continue
    if (dist < bestDist) {
      bestDist = dist
      best = p
    }
  }
  return best
}

function resolveGrab(
  state: ClawGameState,
  clawX: number,
  clawZ: number,
  player: ClawPlayer,
  difficulty: ClawDifficultyLevel,
): Plushie | null {
  const target = findGrabTarget(state, clawX, clawZ)
  if (!target) return null
  const dist = Math.hypot(clawX - target.x, clawZ - target.z)
  const reach = target.radius * GRAB_REACH_MULT
  const align = 1 - dist / reach

  if (player === 1) {
    if (align >= GRAB_PLAYER_AUTO_ALIGN) {
      target.grabbedBy = player
      return target
    }
    const prob = align * target.grabFactor * 0.92
    if (Math.random() > prob) return null
    target.grabbedBy = player
    return target
  }

  const prob =
    align *
    target.grabFactor *
    clawGrabSuccessMultiplier(difficulty, player) *
    (0.62 + align * 0.38)
  if (Math.random() > prob) return null
  target.grabbedBy = player
  return target
}

function addScore(state: ClawGameState, player: ClawPlayer, value: number): void {
  if (player === 1) state.playerScore += value
  else state.charScore += value
}

function consumeTurn(state: ClawGameState): void {
  if (state.claw.activePlayer === 1) state.playerTurnsLeft -= 1
  else state.charTurnsLeft -= 1
}

function switchTurn(state: ClawGameState): void {
  state.claw.turnIndex += 1
  if (state.playerTurnsLeft <= 0 && state.charTurnsLeft <= 0) {
    state.gameOver = true
    state.claw.phase = 'idle'
    return
  }
  if (state.claw.activePlayer === 1) {
    if (state.charTurnsLeft > 0) state.claw.activePlayer = 2
    else state.claw.activePlayer = 1
  } else if (state.playerTurnsLeft > 0) {
    state.claw.activePlayer = 1
  } else {
    state.claw.activePlayer = 2
  }
  state.claw.phase = 'idle'
  state.claw.open = 1
  clearCarry(state.claw)
}

function clearCarry(claw: ClawAnimState): void {
  claw.carrying = null
  claw.carryAttach = 0
  claw.carryLagX = 0
  claw.carryLagY = 0
  claw.carryLagZ = 0
  claw.carryLagVx = 0
  claw.carryLagVy = 0
  claw.carryLagVz = 0
}

function beginCarry(claw: ClawAnimState, plush: Plushie): void {
  claw.carrying = plush
  claw.carryFromX = plush.x
  claw.carryFromY = plush.y
  claw.carryFromZ = plush.z
  claw.carryAttach = 0
  claw.carryLagX = plush.x
  claw.carryLagY = plush.y
  claw.carryLagZ = plush.z
  claw.carryLagVx = plush.vx
  claw.carryLagVy = plush.vy
  claw.carryLagVz = plush.vz
}

const LERP = (a: number, b: number, t: number) => a + (b - a) * t

function resetRailVel(claw: ClawAnimState): void {
  claw.railVelX = 0
  claw.railVelZ = 0
}

function tickRailMove2D(
  claw: ClawAnimState,
  targetX: number,
  targetZ: number,
  dt: number,
  opts: { stiffness: number; damping: number; maxSpeed: number },
): { dist: number; speed: number } {
  const sx = smoothMove1D(claw.x, claw.railVelX, targetX, dt, opts)
  const sz = smoothMove1D(claw.z, claw.railVelZ, targetZ, dt, opts)
  claw.x = sx.pos
  claw.railVelX = sx.vel
  claw.z = sz.pos
  claw.railVelZ = sz.vel
  return {
    dist: Math.hypot(claw.x - targetX, claw.z - targetZ),
    speed: Math.hypot(claw.railVelX, claw.railVelZ),
  }
}

function tickCarryAttach(claw: ClawAnimState, visual: { x: number; y: number; z: number }, dt: number): void {
  if (!claw.carrying) return
  claw.carryAttach = Math.min(1, claw.carryAttach + dt * 9)
  const t = claw.carryAttach
  const targetX = LERP(claw.carryFromX, visual.x, t)
  const targetY = LERP(claw.carryFromY, clawCarryAnchorY(visual.y), t)
  const targetZ = LERP(claw.carryFromZ, visual.z, t)

  const sx = integrateSpring1D(claw.carryLagX, claw.carryLagVx, targetX, 52, 11, dt)
  const sy = integrateSpring1D(claw.carryLagY, claw.carryLagVy, targetY, 48, 10, dt)
  const sz = integrateSpring1D(claw.carryLagZ, claw.carryLagVz, targetZ, 48, 10, dt)
  claw.carryLagX = sx.pos
  claw.carryLagVx = sx.vel
  claw.carryLagY = sy.pos
  claw.carryLagVy = sy.vel
  claw.carryLagZ = sz.pos
  claw.carryLagVz = sz.vel

  claw.carrying.x = claw.carryLagX
  claw.carrying.y = claw.carryLagY
  claw.carrying.z = claw.carryLagZ
}

function tickClawPhysics(state: ClawGameState, dt: number): void {
  const claw = state.claw
  const clawVelX = (claw.x - claw.prevX) / Math.max(dt, 0.001)
  const clawVelZ = (claw.z - claw.prevZ) / Math.max(dt, 0.001)
  claw.prevX = claw.x
  claw.prevZ = claw.z

  const pend = tickPendulum(claw.swingAngle, claw.swingVel, dt, (clawVelX + clawVelZ * 0.3) * 0.016)
  claw.swingAngle = pend.angle
  claw.swingVel = pend.vel

  const pileBodies = state.plushies
    .filter((p) => p.grabbedBy == null)
    .map((p) => ({
      body: {
        x: p.x,
        y: p.y,
        z: p.z,
        vx: p.vx,
        vy: p.vy,
        vz: p.vz,
        restX: p.restX,
        restY: p.restY,
        restZ: p.restZ,
        radius: p.radius,
      },
      plush: p,
    }))

  const visual = clawVisualPos(claw)
  const clawPush =
    claw.phase === 'descending' || claw.phase === 'grabbing' || claw.phase === 'ascending'

  tickPlushPile3D(
    pileBodies.map((e) => e.body),
    dt,
    {
      minX: CLAW_MIN_X,
      maxX: CLAW_MAX_X,
      minZ: CLAW_MIN_Z,
      maxZ: CLAW_MAX_Z,
      clawX: visual.x,
      clawY: visual.y,
      clawZ: visual.z,
      clawPush,
    },
  )

  for (const entry of pileBodies) {
    entry.plush.x = entry.body.x
    entry.plush.y = entry.body.y
    entry.plush.z = entry.body.z
    entry.plush.vx = entry.body.vx
    entry.plush.vy = entry.body.vy
    entry.plush.vz = entry.body.vz
  }
}

function releaseToFalling(state: ClawGameState, plush: Plushie): void {
  const visual = clawVisualPos(state.claw)
  state.falling = {
    kind: plush.kind,
    x: plush.x,
    y: plush.y,
    z: plush.z,
    vx: (Math.random() - 0.5) * 30 + state.claw.swingVel * 12,
    vy: -16,
    vz: (Math.random() - 0.5) * 24,
    radius: plush.radius,
    fade: 1,
  }
  if (Math.hypot(plush.x - visual.x, plush.z - visual.z) > plush.radius * 1.8) {
    state.falling.x = visual.x
    state.falling.y = clawCarryAnchorY(visual.y)
    state.falling.z = visual.z
  }
  clearCarry(state.claw)
}

function tickFalling(state: ClawGameState, dt: number): boolean {
  const f = state.falling
  if (!f) return true
  const settled = tickGravityBody3(f, dt, {
    floorY: CLAW_DESCEND_Y - 8,
    minX: CLAW_DROP_X - 14,
    maxX: CLAW_DROP_X + 14,
    minZ: CLAW_DROP_Z - 10,
    maxZ: CLAW_DROP_Z + 10,
    gravity: 620,
    bounce: 0.28,
  })
  if (settled) {
    f.fade = Math.max(0, f.fade - dt * 2.8)
    if (f.fade <= 0) {
      state.falling = null
      return true
    }
    return false
  }
  return false
}

export function beginGrab(state: ClawGameState): boolean {
  if (state.gameOver || state.claw.phase !== 'idle') return false
  state.claw.swingAngle = 0
  state.claw.swingVel = 0
  state.claw.phase = 'descending'
  state.claw.open = 1
  return true
}

export function beginAiGrabAt(state: ClawGameState, targetX: number, targetZ: number): boolean {
  if (state.gameOver || state.claw.phase !== 'idle') return false
  state.claw.targetX = clampClawX(targetX)
  state.claw.targetZ = clampClawZ(targetZ)
  state.claw.phase = 'moving'
  return true
}

export type ClawTickResult = {
  turnCompleted?: {
    player: ClawPlayer
    success: boolean
    plushie: Plushie | null
    value: number
  }
  gameOver?: boolean
}

export function tickClawAnim(
  state: ClawGameState,
  dt: number,
  difficulty: ClawDifficultyLevel,
): ClawTickResult {
  const claw = state.claw
  let result: ClawTickResult = {}
  if (state.gameOver) return result

  tickClawPhysics(state, dt)

  switch (claw.phase) {
    case 'idle':
      break
    case 'moving': {
      claw.x = LERP(claw.x, claw.targetX, Math.min(1, dt * 5.5))
      claw.z = LERP(claw.z, claw.targetZ, Math.min(1, dt * 5.5))
      if (Math.hypot(claw.x - claw.targetX, claw.z - claw.targetZ) < 1.2) {
        claw.x = claw.targetX
        claw.z = claw.targetZ
        claw.swingAngle = 0
        claw.swingVel = 0
        claw.phase = 'descending'
        claw.open = 1
      }
      break
    }
    case 'descending': {
      claw.y = LERP(claw.y, CLAW_DESCEND_Y, Math.min(1, dt * CLAW_DESCEND_RATE))
      claw.open = LERP(claw.open, 0.15, Math.min(1, dt * CLAW_CLOSE_RATE * 0.55))
      if (claw.y >= CLAW_DESCEND_Y - 2) {
        claw.y = CLAW_DESCEND_Y
        claw.phase = 'grabbing'
      }
      break
    }
    case 'grabbing': {
      claw.open = LERP(claw.open, 0, Math.min(1, dt * CLAW_CLOSE_RATE))
      if (claw.open < 0.05) {
        const grabbed = resolveGrab(state, claw.x, claw.z, claw.activePlayer, difficulty)
        if (grabbed) {
          beginCarry(claw, grabbed)
          claw.swingVel += (Math.random() - 0.5) * 0.6
        } else {
          claw.carrying = null
        }
        claw.open = grabbed ? 0 : 0.3
        claw.phase = 'ascending'
      }
      break
    }
    case 'ascending': {
      tickCarryAttach(claw, clawVisualPos(claw), dt)
      claw.y = LERP(claw.y, CLAW_RAIL_Y, Math.min(1, dt * CLAW_ASCEND_RATE))
      if (claw.y <= CLAW_RAIL_Y + 1) {
        claw.y = CLAW_RAIL_Y
        if (claw.carrying) {
          resetRailVel(claw)
          claw.phase = 'delivering'
        } else {
          consumeTurn(state)
          claw.phase = 'resetting'
          result.turnCompleted = { player: claw.activePlayer, success: false, plushie: null, value: 0 }
        }
      }
      break
    }
    case 'delivering': {
      tickCarryAttach(claw, clawVisualPos(claw), dt)
      const rail = tickRailMove2D(claw, CLAW_DROP_X, CLAW_DROP_Z, dt, CLAW_DELIVER_RAIL)
      const atDrop = rail.dist < 3 && rail.speed < 10
      if (atDrop) {
        claw.x = CLAW_DROP_X
        claw.z = CLAW_DROP_Z
        resetRailVel(claw)
        claw.open = LERP(claw.open, 1, Math.min(1, dt * CLAW_OPEN_AT_DROP_RATE))
      } else {
        claw.open = LERP(claw.open, 0, Math.min(1, dt * 6))
      }
      if (claw.carrying && atDrop && claw.open > 0.68 && !state.pendingTurnComplete) {
        const plush = claw.carrying
        addScore(state, claw.activePlayer, plush.value)
        releaseToFalling(state, plush)
        state.pendingTurnComplete = { player: claw.activePlayer, success: true, value: plush.value }
        claw.phase = 'dropping'
      }
      break
    }
    case 'dropping': {
      claw.open = LERP(claw.open, 1, Math.min(1, dt * 8))
      const fallDone = tickFalling(state, dt)
      if (fallDone) {
        consumeTurn(state)
        const pending = state.pendingTurnComplete
        state.pendingTurnComplete = null
        resetRailVel(claw)
        claw.phase = 'resetting'
        if (pending) {
          result.turnCompleted = {
            player: pending.player,
            success: pending.success,
            plushie: null,
            value: pending.value,
          }
        }
      }
      break
    }
    case 'resetting': {
      const rail = tickRailMove2D(claw, CENTER_X, CENTER_Z, dt, CLAW_RESET_RAIL)
      claw.targetX = CENTER_X
      claw.targetZ = CENTER_Z
      tickFalling(state, dt)
      if (rail.dist < 2.5 && rail.speed < 10 && !state.falling) {
        claw.x = CENTER_X
        claw.z = CENTER_Z
        resetRailVel(claw)
        switchTurn(state)
        if (state.gameOver) result.gameOver = true
      }
      break
    }
    default:
      break
  }

  return result
}

export function resolveClawWinner(state: ClawGameState): 'player' | 'char' | 'draw' {
  if (state.playerScore > state.charScore) return 'player'
  if (state.charScore > state.playerScore) return 'char'
  return 'draw'
}
