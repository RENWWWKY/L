/** 新朋友验证：解析模型在输出最前写入的裁决 XML，并从可见气泡文本中剔除 */

export type FriendRequestDecision = 'accept' | 'decline'

export type FriendRequestDecisionParsed = {
  decision: FriendRequestDecision
  /** accept 时：通过好友后在本会话「验证消息」分割线之下展示的打招呼（1~3 行） */
  postAcceptGreetingLines: string[]
}

const FRIEND_REQUEST_BLOCK = /<friend_request_response\b[^>]*>[\s\S]*?<\/friend_request_response>/gi
const FRIEND_REQUEST_OPEN_TAIL = /<friend_request_response\b[^>]*>[\s\S]*$/i

const PROTOCOL_LINE_RE =
  /^<\/?(?:friend_request_response|decision|post_accept_greeting)\b[^>]*>$/i

/** 是否为裁决协议行（不得作为验证聊天气泡展示） */
export function isFriendRequestProtocolLine(line: string): boolean {
  const t = String(line ?? '').trim()
  if (!t) return true
  if (PROTOCOL_LINE_RE.test(t)) return true
  if (/^<friend_request_response\b/i.test(t) && !t.includes('</friend_request_response')) return true
  if (/^<\/friend_request_response\s*>$/i.test(t)) return true
  if (/^<decision\b/i.test(t) && /<\/decision\s*>$/i.test(t)) return true
  if (/^<post_accept_greeting\b/i.test(t) && /<\/post_accept_greeting\s*>$/i.test(t)) return true
  return false
}

/** 从可见文本中移除裁决 XML 与孤立标签行 */
export function stripFriendRequestProtocolArtifacts(text: string): string {
  let s = String(text ?? '')
  s = s.replace(FRIEND_REQUEST_BLOCK, '\n')
  s = s.replace(FRIEND_REQUEST_OPEN_TAIL, '\n')
  s = s.replace(/<\/?friend_request_response\b[^>]*>/gi, '\n')
  s = s.replace(/<\/?decision\b[^>]*>[\s\S]*?<\/decision>/gi, '\n')
  s = s.replace(/<\/?post_accept_greeting\b[^>]*>[\s\S]*?<\/post_accept_greeting>/gi, '\n')
  s = s.replace(/<\/?decision\b[^>]*>/gi, '\n')
  s = s.replace(/<\/?post_accept_greeting\b[^>]*>/gi, '\n')
  return s
    .split(/\r?\n+/)
    .map((ln) => ln.trim())
    .filter((ln) => ln && !isFriendRequestProtocolLine(ln))
    .join('\n')
    .trim()
}

function parseInner(inner: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = inner.match(re)
  return (m?.[1] ?? '').trim()
}

function parseDecisionFromLooseText(src: string): FriendRequestDecision | null {
  const block = src.match(/<friend_request_response\b[^>]*>([\s\S]*?)<\/friend_request_response>/i)
  const inner = block?.[1] ?? src
  const decTag = parseInner(inner, 'decision').toLowerCase()
  if (decTag === 'accept' || decTag === 'decline') return decTag
  const loose = inner.match(/<decision>\s*(accept|decline)\s*<\/decision>/i)
  if (loose) return loose[1]!.toLowerCase() as FriendRequestDecision
  if (/\baccept\b/i.test(inner) && !/\bdecline\b/i.test(inner)) return 'accept'
  if (/\bdecline\b/i.test(inner)) return 'decline'
  return null
}

function parseGreetingLines(inner: string): string[] {
  const greetRaw = parseInner(inner, 'post_accept_greeting')
  return greetRaw
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter((s) => s && !isFriendRequestProtocolLine(s))
    .slice(0, 3)
}

export function stripFriendRequestDecisionBlock(raw: string): {
  parsed: FriendRequestDecisionParsed | null
  bodyForBubbles: string
} {
  const src = String(raw ?? '').trim()
  if (!src) return { parsed: null, bodyForBubbles: '' }

  const blockMatch = src.match(/<friend_request_response\b[^>]*>([\s\S]*?)<\/friend_request_response>/i)
  const inner = blockMatch?.[1] ?? src
  const decision = parseDecisionFromLooseText(src)
  if (!decision) {
    return { parsed: null, bodyForBubbles: stripFriendRequestProtocolArtifacts(src) }
  }
  const postAcceptGreetingLines = decision === 'accept' ? parseGreetingLines(inner) : []
  const greetingExclude = new Set(postAcceptGreetingLines.map((g) => g.toLowerCase()))
  const bodyForBubbles = stripFriendRequestProtocolArtifacts(src)
    .split(/\r?\n+/)
    .map((ln) => ln.trim())
    .filter((ln) => ln && !isFriendRequestProtocolLine(ln))
    .filter((ln) => !greetingExclude.has(ln.toLowerCase()))
    .join('\n')
    .trim()
  return { parsed: { decision, postAcceptGreetingLines }, bodyForBubbles }
}

export function splitFriendRequestReplyLines(
  body: string,
  excludeLines: string[] = [],
): string[] {
  const exclude = new Set(excludeLines.map((g) => g.trim().toLowerCase()).filter(Boolean))
  return stripFriendRequestProtocolArtifacts(body)
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter((s) => s && !isFriendRequestProtocolLine(s))
    .filter((s) => !exclude.has(s.toLowerCase()))
    .slice(0, 4)
}
