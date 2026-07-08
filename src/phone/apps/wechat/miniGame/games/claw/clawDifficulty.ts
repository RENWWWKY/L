/** 抓娃娃机 AI 难度：1=明显放水 … 5=全力 */
export type ClawDifficultyLevel = 1 | 2 | 3 | 4 | 5

export const CLAW_DIFFICULTY_DEFAULT: ClawDifficultyLevel = 3

export function clampClawDifficultyLevel(raw: unknown): ClawDifficultyLevel {
  const n = typeof raw === 'number' ? Math.round(raw) : Number.parseInt(String(raw ?? ''), 10)
  if (n <= 1) return 1
  if (n === 2) return 2
  if (n === 4) return 4
  if (n >= 5) return 5
  return 3
}

/** 角色瞄准误差（像素） */
export function clawAiAimJitterPx(difficulty: ClawDifficultyLevel): number {
  if (difficulty <= 1) return 48 + Math.random() * 40
  if (difficulty === 2) return 28 + Math.random() * 24
  if (difficulty === 3) return 14 + Math.random() * 14
  if (difficulty === 4) return 6 + Math.random() * 8
  return 2 + Math.random() * 4
}

/** 角色是否故意选次优目标 */
export function clawAiPickSuboptimal(difficulty: ClawDifficultyLevel): boolean {
  if (difficulty <= 1) return Math.random() < 0.65
  if (difficulty === 2) return Math.random() < 0.35
  if (difficulty === 3) return Math.random() < 0.12
  return false
}

/** 抓取成功率倍率（角色侧略占优势以制造竞争感） */
export function clawGrabSuccessMultiplier(
  difficulty: ClawDifficultyLevel,
  player: 1 | 2,
): number {
  const base = player === 2 ? 1.05 : 1
  if (difficulty <= 1) return base * (player === 2 ? 0.72 : 0.88)
  if (difficulty === 2) return base * (player === 2 ? 0.82 : 0.92)
  if (difficulty === 3) return base
  if (difficulty === 4) return base * (player === 2 ? 1.08 : 0.96)
  return base * (player === 2 ? 1.12 : 0.94)
}

export function clawThinkDelayMs(difficulty: ClawDifficultyLevel): number {
  const min = difficulty <= 2 ? 800 : 600
  const max = difficulty >= 4 ? 1800 : 2400
  return Math.round(min + Math.random() * (max - min))
}
