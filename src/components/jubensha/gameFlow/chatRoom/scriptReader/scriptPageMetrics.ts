/** 正文 body-box 的可排版区域宽高（与 ScriptPageCapacityProbe / 翻页器同步） */

export type ScriptPageBodyMetrics = {
  width: number
  height: number
}

const METRICS_EPS_PX = 8

/** 低于此值视为布局未就绪（会导致「每页一字」） */
export const MIN_PAGE_BODY_WIDTH = 200
export const MIN_PAGE_BODY_HEIGHT = 140

let cached: ScriptPageBodyMetrics | null = null
const listeners = new Set<() => void>()

export function isValidPageBodyMetrics(
  metrics: ScriptPageBodyMetrics | null,
): metrics is ScriptPageBodyMetrics {
  if (!metrics) return false
  return metrics.width >= MIN_PAGE_BODY_WIDTH && metrics.height >= MIN_PAGE_BODY_HEIGHT
}

export function getPageBodyMetrics(): ScriptPageBodyMetrics | null {
  return cached
}

export function setPageBodyMetrics(width: number, height: number): void {
  const w = Math.round(width)
  const h = Math.round(height)
  if (w < MIN_PAGE_BODY_WIDTH || h < MIN_PAGE_BODY_HEIGHT) return
  if (
    cached &&
    Math.abs(cached.width - w) < METRICS_EPS_PX &&
    Math.abs(cached.height - h) < METRICS_EPS_PX
  ) {
    return
  }
  cached = { width: w, height: h }
  listeners.forEach((fn) => fn())
}

export function subscribePageBodyMetrics(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetPageBodyMetrics(): void {
  cached = null
}
