export const DATING_PLOT_IMAGE_COUNT_MIN = 0
export const DATING_PLOT_IMAGE_COUNT_MAX = 6
export const DATING_PLOT_IMAGE_DEFAULT_MIN = 1
export const DATING_PLOT_IMAGE_DEFAULT_MAX = 2

export function clampDatingPlotImageCount(n: number): number {
  if (!Number.isFinite(n)) return DATING_PLOT_IMAGE_DEFAULT_MIN
  return Math.max(DATING_PLOT_IMAGE_COUNT_MIN, Math.min(DATING_PLOT_IMAGE_COUNT_MAX, Math.round(n)))
}

export function parseDatingPlotImageCountRange(
  minRaw?: number,
  maxRaw?: number,
): { min: number; max: number } {
  let min = clampDatingPlotImageCount(
    typeof minRaw === 'number' && Number.isFinite(minRaw) ? minRaw : DATING_PLOT_IMAGE_DEFAULT_MIN,
  )
  let max = clampDatingPlotImageCount(
    typeof maxRaw === 'number' && Number.isFinite(maxRaw) ? maxRaw : DATING_PLOT_IMAGE_DEFAULT_MAX,
  )
  if (min > max) [min, max] = [max, min]
  return { min, max }
}

export function drawDatingPlotImageCount(range: { min: number; max: number }): number {
  if (range.min >= range.max) return range.min
  return range.min + Math.floor(Math.random() * (range.max - range.min + 1))
}

export function formatDatingPlotImageCountLabel(range: { min: number; max: number }): string {
  if (range.min === range.max) return `${range.min} 张`
  return `${range.min}～${range.max} 张`
}
