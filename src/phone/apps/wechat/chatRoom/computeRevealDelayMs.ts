/** AI 对方消息逐条露出前的动态间隔（毫秒）：短句偏快，长句偏慢；语音按时长。 */

export type RevealDelayMessage = {
  chatHistory?: unknown
  voice?: { durationSec?: number }
  text?: string
}

export function messagePlainTextForDelay(msg: RevealDelayMessage): string {
  if (msg.chatHistory) return '[聊天记录]'
  const t = typeof msg.text === 'string' ? msg.text.trim() : ''
  if (t) return t
  if (msg.voice) return '[语音]'
  return '…'
}

export function computeRevealDelayMs(msg: RevealDelayMessage): number {
  if (msg.chatHistory) return 120
  const dur = msg.voice?.durationSec
  if (typeof dur === 'number' && dur > 0) {
    return Math.max(200, Math.min(30_000, Math.round(dur * 1000)))
  }
  const text = messagePlainTextForDelay(msg)
  const n = [...text].length
  if (n < 200) return Math.max(280, Math.round((n / 5) * 1000))
  return Math.max(400, Math.round((n / 15) * 1000))
}
