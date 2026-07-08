import type { ClawDifficultyLevel } from './clawDifficulty'
import { clawAiAimJitterPx, clawAiPickSuboptimal } from './clawDifficulty'
import { remainingPlushies } from './clawPlushies'
import type { ClawGameState } from './clawTypes'

export type ClawAiDecision = {
  targetX: number
  targetZ: number
  targetPlushId: string | null
}

export function clawAiDecide(state: ClawGameState, difficulty: ClawDifficultyLevel): ClawAiDecision {
  const available = remainingPlushies(state.plushies)
  if (available.length === 0) {
    return { targetX: state.claw.x, targetZ: state.claw.z, targetPlushId: null }
  }

  const ranked = [...available].sort((a, b) => {
    const da = Math.hypot(state.claw.x - a.x, state.claw.z - a.z)
    const db = Math.hypot(state.claw.x - b.x, state.claw.z - b.z)
    return b.value * 10 - db * 0.12 - (a.value * 10 - da * 0.12)
  })

  let pick = ranked[0]!
  if (clawAiPickSuboptimal(difficulty) && ranked.length > 1) {
    const subIdx = 1 + Math.floor(Math.random() * Math.min(3, ranked.length - 1))
    pick = ranked[subIdx]!
  }

  const jitter = clawAiAimJitterPx(difficulty)
  return {
    targetX: pick.x + jitter * (Math.random() - 0.5) * 2,
    targetZ: pick.z + jitter * (Math.random() - 0.5) * 2,
    targetPlushId: pick.id,
  }
}
