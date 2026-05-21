/**
 * 遇见临时会话 · NPC 气泡逐条露出节奏（对齐微信 ChatRoom 文本分支的 stagger 思路）
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms))
}

/** 与微信 `computeOpponentStaggerDelayMs` 文本分支一致：短句偏快，长句偏慢 */
export function computeMeetNpcStaggerDelayMs(text: string): number {
  const n = [...String(text ?? '').trim()].length
  if (n <= 0) return 320
  if (n < 200) return Math.max(280, Math.round((n / 5) * 1000))
  return Math.max(400, Math.round((n / 15) * 1000))
}

/** 让出一帧，降低多条 push 被 React 合并到同一刷新的概率 */
export async function yieldToPaint(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
}

/** 最后一条口语气泡露出后，再露出契约/真心话等富交互卡片的间隔 */
export function computeMeetRichFollowUpDelayMs(lastBubbleText: string | undefined): number {
  const t = String(lastBubbleText ?? '').trim()
  if (!t) return 480
  return Math.min(1100, Math.max(380, Math.round(computeMeetNpcStaggerDelayMs(t) * 0.9)))
}
