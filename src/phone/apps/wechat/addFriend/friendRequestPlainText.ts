import { isFriendRequestProtocolLine } from './friendRequestDecisionParse'

/** 验证申请会话仅允许纯文本单行 */
export function sanitizeFriendRequestPlainText(input: string): string {
  const singleLine = String(input || '').replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!singleLine) return ''
  if (isFriendRequestProtocolLine(singleLine)) return ''
  if (/^<\/?(?:friend_request_response|decision|post_accept_greeting)\b/i.test(singleLine)) return ''
  const lower = singleLine.toLowerCase()
  if (singleLine.startsWith('[表情包]') || singleLine.startsWith('[表情]')) return ''
  if (singleLine.startsWith('[引用') || singleLine.includes('[引用:') || singleLine.includes('【引用')) return ''
  if (lower.includes('/image/') || /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(singleLine)) return ''
  return singleLine.slice(0, 120)
}
