/** 世界书条目 AI 补全：默认目标字数（含标点，约） */
export const WB_ITEM_GEN_DEFAULT_CHARS = 100
export const WB_ITEM_GEN_MIN_CHARS = 40
export const WB_ITEM_GEN_MAX_CHARS = 800

export function clampWbItemGenTargetChars(n: number | undefined | null): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : WB_ITEM_GEN_DEFAULT_CHARS
  return Math.min(WB_ITEM_GEN_MAX_CHARS, Math.max(WB_ITEM_GEN_MIN_CHARS, v))
}
