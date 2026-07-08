import {
  buildSpawnKindList,
  getPlushCatalogEntry,
  pickSessionPlushKinds,
  type PlushKind,
} from './clawPlushCatalog'
import type { Plushie } from './clawTypes'
import { CLAW_FLOOR_Y, CLAW_MAX_X, CLAW_MAX_Z, CLAW_MIN_X, CLAW_MIN_Z } from './clawTypes'

export { getPlushCatalogEntry as getPlushMeta, pickSessionPlushKinds, type PlushKind }

const SPAWN_MARGIN = 22
const MAX_PLACE_ATTEMPTS = 96

function overlapsXZ(
  ax: number,
  az: number,
  ar: number,
  bx: number,
  bz: number,
  br: number,
  gap: number,
): boolean {
  return Math.hypot(ax - bx, az - bz) < ar + br - gap
}

function pickRandomXZ(
  radius: number,
  placed: Array<{ x: number; z: number; radius: number }>,
  minGap: number,
): { x: number; z: number } | null {
  const minX = CLAW_MIN_X + SPAWN_MARGIN + radius
  const maxX = CLAW_MAX_X - SPAWN_MARGIN - radius
  const minZ = CLAW_MIN_Z + SPAWN_MARGIN + radius
  const maxZ = CLAW_MAX_Z - SPAWN_MARGIN - radius

  for (let attempt = 0; attempt < MAX_PLACE_ATTEMPTS; attempt += 1) {
    const x = minX + Math.random() * (maxX - minX)
    const z = minZ + Math.random() * (maxZ - minZ)
    const ok = placed.every(
      (p) => !overlapsXZ(x, z, radius, p.x, p.z, p.radius, minGap),
    )
    if (ok) return { x, z }
  }
  return null
}

/** 玩偶中心高度：底部落在地板上 */
function plushSeatY(radius: number): number {
  return CLAW_FLOOR_Y + 3 + radius * 0.02
}

export function spawnPlushPile(sessionKinds: PlushKind[]): Plushie[] {
  const kindList = buildSpawnKindList(sessionKinds, 8)
  const plushies: Plushie[] = []
  const placed: Array<{ x: number; y: number; z: number; radius: number }> = []

  for (let i = 0; i < kindList.length; i += 1) {
    const kind = kindList[i]!
    const meta = getPlushCatalogEntry(kind)
    let minGap = 10
    let spot: { x: number; z: number } | null = null

    for (let relax = 0; relax < 4 && !spot; relax += 1) {
      spot = pickRandomXZ(meta.radius, placed, minGap)
      minGap -= 3
    }

    if (!spot) {
      const angle = Math.random() * Math.PI * 2
      const dist = 28 + Math.random() * 52
      const cx = (CLAW_MIN_X + CLAW_MAX_X) / 2
      const cz = (CLAW_MIN_Z + CLAW_MAX_Z) / 2
      spot = {
        x: Math.max(
          CLAW_MIN_X + meta.radius,
          Math.min(CLAW_MAX_X - meta.radius, cx + Math.cos(angle) * dist),
        ),
        z: Math.max(
          CLAW_MIN_Z + meta.radius,
          Math.min(CLAW_MAX_Z - meta.radius, cz + Math.sin(angle) * dist),
        ),
      }
    }

    const py = plushSeatY(meta.radius)
    placed.push({ x: spot.x, y: py, z: spot.z, radius: meta.radius })
    plushies.push({
      id: `p-${i}-${Math.random().toString(36).slice(2, 6)}`,
      kind,
      x: spot.x,
      y: py,
      z: spot.z,
      restX: spot.x,
      restY: py,
      restZ: spot.z,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: meta.radius,
      value: meta.value,
      grabFactor: meta.grabFactor,
      grabbedBy: null,
    })
  }

  return plushies
}

export function remainingPlushies(plushies: Plushie[]): Plushie[] {
  return plushies.filter((p) => p.grabbedBy == null)
}
