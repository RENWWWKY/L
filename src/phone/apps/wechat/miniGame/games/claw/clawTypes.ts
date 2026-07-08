/** 抓娃娃机 · 3D 世界坐标与类型 */

import type { PlushKind } from './clawPlushCatalog'

export type { PlushKind } from './clawPlushCatalog'

export type ClawPlayer = 1 | 2

/** 世界坐标：x=左右, y=高度, z=前后深度（越大越靠里） */
export type Plushie = {
  id: string
  kind: PlushKind
  x: number
  y: number
  z: number
  radius: number
  value: number
  grabFactor: number
  grabbedBy: ClawPlayer | null
  restX: number
  restY: number
  restZ: number
  vx: number
  vy: number
  vz: number
}

export type FallingPlush = {
  kind: PlushKind
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  radius: number
  fade: number
}

export type ClawPhase =
  | 'idle'
  | 'moving'
  | 'descending'
  | 'grabbing'
  | 'ascending'
  | 'delivering'
  | 'dropping'
  | 'resetting'

export type ClawAnimState = {
  x: number
  y: number
  z: number
  targetX: number
  targetZ: number
  phase: ClawPhase
  open: number
  carrying: Plushie | null
  carryFromX: number
  carryFromY: number
  carryFromZ: number
  carryAttach: number
  swingAngle: number
  swingVel: number
  prevX: number
  prevZ: number
  railVelX: number
  railVelZ: number
  carryLagX: number
  carryLagY: number
  carryLagZ: number
  carryLagVx: number
  carryLagVy: number
  carryLagVz: number
  activePlayer: ClawPlayer
  turnIndex: number
}

export type ClawGameState = {
  plushies: Plushie[]
  claw: ClawAnimState
  falling: FallingPlush | null
  pendingTurnComplete: {
    player: ClawPlayer
    success: boolean
    value: number
  } | null
  playerScore: number
  charScore: number
  playerTurnsLeft: number
  charTurnsLeft: number
  gameOver: boolean
  /** 本局随机选中的 4 种玩偶 */
  sessionKinds: PlushKind[]
}

/** 屏幕画布逻辑尺寸 */
export const CLAW_ARENA_W = 320
export const CLAW_ARENA_H = 400

/** 3D 世界边界 */
export const CLAW_MIN_X = 48
export const CLAW_MAX_X = 272
export const CLAW_MIN_Z = 52
export const CLAW_MAX_Z = 208
export const CLAW_RAIL_Y = 248
export const CLAW_FLOOR_Y = 28
export const CLAW_DESCEND_Y = CLAW_FLOOR_Y + 36
export const CLAW_DROP_X = 68
export const CLAW_DROP_Z = CLAW_MIN_Z + 8

export const CLAW_TURNS_PER_PLAYER = 3

export function clampClawX(x: number): number {
  return Math.max(CLAW_MIN_X, Math.min(CLAW_MAX_X, x))
}

export function clampClawZ(z: number): number {
  return Math.max(CLAW_MIN_Z, Math.min(CLAW_MAX_Z, z))
}
