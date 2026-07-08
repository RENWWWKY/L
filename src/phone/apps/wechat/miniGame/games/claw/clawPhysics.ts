/** 轻量物理：弹簧阻尼、单摆、重力落体、3D 堆叠 */

export function integrateSpring1D(
  pos: number,
  vel: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): { pos: number; vel: number } {
  const accel = (target - pos) * stiffness - vel * damping
  const nextVel = vel + accel * dt
  return { pos: pos + nextVel * dt, vel: nextVel }
}

export type SmoothMoveOpts = {
  stiffness?: number
  damping?: number
  maxSpeed?: number
}

/** 弹簧阻尼平移：加减速自然，比线性 LERP 更丝滑 */
export function smoothMove1D(
  pos: number,
  vel: number,
  target: number,
  dt: number,
  opts: SmoothMoveOpts = {},
): { pos: number; vel: number } {
  const stiffness = opts.stiffness ?? 22
  const damping = opts.damping ?? 11
  const next = integrateSpring1D(pos, vel, target, stiffness, damping, dt)
  if (opts.maxSpeed != null) {
    next.vel = Math.max(-opts.maxSpeed, Math.min(opts.maxSpeed, next.vel))
  }
  return next
}

export function tickPendulum(
  angle: number,
  vel: number,
  dt: number,
  driveImpulse: number,
): { angle: number; vel: number } {
  const gravity = 42
  const length = 1.05
  const damping = 4.2
  const accel = (-gravity / length) * Math.sin(angle) - damping * vel + driveImpulse
  const nextVel = vel + accel * dt
  return { angle: angle + nextVel * dt, vel: nextVel }
}

export function pendulumOffset(angle: number, ropeLen: number): { ox: number; oy: number } {
  return {
    ox: Math.sin(angle) * ropeLen * 0.22,
    oy: (1 - Math.cos(angle)) * ropeLen * 0.06,
  }
}

export type GravityBody3 = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}

export function tickGravityBody3(
  body: GravityBody3,
  dt: number,
  opts: {
    floorY: number
    minX: number
    maxX: number
    minZ: number
    maxZ: number
    gravity?: number
    bounce?: number
  },
): boolean {
  const gravity = opts.gravity ?? 520
  const bounce = opts.bounce ?? 0.32
  body.vy += gravity * dt
  body.x += body.vx * dt
  body.y += body.vy * dt
  body.z += body.vz * dt

  if (body.x < opts.minX) {
    body.x = opts.minX
    body.vx *= -bounce
  }
  if (body.x > opts.maxX) {
    body.x = opts.maxX
    body.vx *= -bounce
  }
  if (body.z < opts.minZ) {
    body.z = opts.minZ
    body.vz *= -bounce
  }
  if (body.z > opts.maxZ) {
    body.z = opts.maxZ
    body.vz *= -bounce
  }

  if (body.y >= opts.floorY) {
    body.y = opts.floorY
    if (Math.abs(body.vy) > 36) {
      body.vy *= -bounce
      body.vx *= 0.7
      body.vz *= 0.7
      return false
    }
    body.vy = 0
    body.vx *= 0.78
    body.vz *= 0.78
    return Math.hypot(body.vx, body.vz) < 10
  }
  return false
}

export type PileBody3 = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  restX: number
  restY: number
  restZ: number
  radius: number
}

export function tickPlushPile3D(
  bodies: PileBody3[],
  dt: number,
  opts: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
    clawX?: number
    clawY?: number
    clawZ?: number
    clawPush?: boolean
  },
): void {
  const k = 36
  const d = 7.2
  const maxDt = Math.min(dt, 0.033)

  for (const b of bodies) {
    b.vx += (b.restX - b.x) * k * maxDt - b.vx * d * maxDt
    b.vy += (b.restY - b.y) * k * maxDt - b.vy * d * maxDt
    b.vz += (b.restZ - b.z) * k * maxDt - b.vz * d * maxDt
    b.x += b.vx * maxDt
    b.y += b.vy * maxDt
    b.z += b.vz * maxDt

    if (b.y > b.restY) {
      b.y = b.restY
      b.vy *= -0.25
    }
    if (b.y < b.restY - 1) {
      b.y = b.restY
      b.vy = 0
    }
    b.x = Math.max(opts.minX + b.radius, Math.min(opts.maxX - b.radius, b.x))
    b.z = Math.max(opts.minZ + b.radius, Math.min(opts.maxZ - b.radius, b.z))
  }

  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const a = bodies[i]!
      const b = bodies[j]!
      const dx = b.x - a.x
      const dz = b.z - a.z
      const dist = Math.hypot(dx, dz) || 0.001
      const minDist = a.radius + b.radius - 3
      if (dist >= minDist) continue
      const overlap = (minDist - dist) * 0.5
      const nx = dx / dist
      const nz = dz / dist
      a.x -= nx * overlap
      a.z -= nz * overlap
      b.x += nx * overlap
      b.z += nz * overlap
      a.vx -= nx * overlap * 2
      a.vz -= nz * overlap * 2
      b.vx += nx * overlap * 2
      b.vz += nz * overlap * 2
    }
  }

  if (opts.clawPush && opts.clawX != null && opts.clawZ != null) {
    for (const b of bodies) {
      const dx = b.x - opts.clawX
      const dz = b.z - opts.clawZ
      const dy = opts.clawY != null ? b.y - opts.clawY : 0
      const dist = Math.hypot(dx, dz, dy * 0.5)
      if (dist > 58) continue
      const force = (1 - dist / 58) * 130
      b.vx += (dx / (dist || 1)) * force * maxDt
      b.vz += (dz / (dist || 1)) * force * maxDt
      b.vy -= force * 0.25 * maxDt
    }
  }
}
