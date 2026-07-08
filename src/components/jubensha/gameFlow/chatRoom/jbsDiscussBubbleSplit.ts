import type { JBSChatMessage } from './jbsFlowTypes'

/** 对白气泡软上限：优先整句，仅在单句过长时再按逗号/硬切 */
export const DISCUSS_BUBBLE_MAX_CHARS = 28

/** 神态旁白整段上限：短于此时不切分 */
export const DISCUSS_ASIDE_MAX_CHARS = 40

const MEANINGFUL_RE = /[\p{L}\p{N}]/u

function graphemeLen(s: string): number {
  return Array.from(s).length
}

function isMeaningfulChunk(s: string): boolean {
  const t = s.trim()
  return t.length > 0 && MEANINGFUL_RE.test(t)
}

/** 单句仍超长：在逗号/顿号处尽量打包；不在 19:43 等时间点中间断开 */
function splitOnClauseBoundaries(text: string): string[] {
  const chars = Array.from(text)
  if (!chars.length) return []

  const parts: string[] = []
  let start = 0

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i]!
    const prev = i > 0 ? chars[i - 1]! : ''
    const next = i < chars.length - 1 ? chars[i + 1]! : ''

    const isTimeColon =
      (ch === ':' || ch === '：') && /\d/u.test(prev) && /\d/u.test(next)
    const isClauseEnd =
      '，、,；;'.includes(ch) || ((ch === ':' || ch === '：') && !isTimeColon)

    if (isClauseEnd) {
      parts.push(chars.slice(start, i + 1).join(''))
      start = i + 1
    }
  }

  if (start < chars.length) {
    parts.push(chars.slice(start).join(''))
  }

  return parts.map((p) => p.trim()).filter(Boolean)
}

/** 硬切时避开 19:43 / 19：48 等时间点 */
function findSafeHardCutEnd(text: string, maxLen: number): number {
  const chars = Array.from(text)
  if (chars.length <= maxLen) return chars.length

  let cut = maxLen
  const slice = chars.slice(0, cut).join('')
  const trailingTime = /(\d{1,2}[:：]\d*)$/.exec(slice)
  if (trailingTime && trailingTime[1] && !/\d{1,2}[:：]\d{1,2}$/.test(trailingTime[1])) {
    cut = slice.length - trailingTime[1].length
    if (cut <= 0) cut = maxLen
  }

  const head = chars.slice(0, cut).join('')
  const danglingColon = /(\d{1,2}[:：])$/.exec(head)
  if (danglingColon) {
    cut -= danglingColon[1].length
    if (cut <= 0) cut = maxLen
  }

  return Math.max(1, cut)
}

function hardSliceProse(text: string, maxChars: number): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (graphemeLen(trimmed) <= maxChars) return [trimmed]

  const chunks: string[] = []
  let rest = trimmed
  while (graphemeLen(rest) > maxChars) {
    const cut = findSafeHardCutEnd(rest, maxChars)
    const piece = Array.from(rest).slice(0, cut).join('').trim()
    if (!isMeaningfulChunk(piece)) break
    chunks.push(piece)
    rest = Array.from(rest).slice(cut).join('').trim()
  }
  if (rest && isMeaningfulChunk(rest)) chunks.push(rest)
  return chunks
}

/** 单句仍超长：在逗号/顿号处尽量打包，最后才硬切 */
function packOversizedSegment(text: string, maxLen: number): string[] {
  if (graphemeLen(text) <= maxLen) return [text]

  const commaParts = splitOnClauseBoundaries(text)
  if (commaParts.length <= 1) return hardSliceProse(text, maxLen)

  const packed: string[] = []
  let buf = ''

  const flush = () => {
    const t = buf.trim()
    if (isMeaningfulChunk(t)) packed.push(t)
    buf = ''
  }

  for (const part of commaParts) {
    const next = buf ? buf + part : part
    if (graphemeLen(next) <= maxLen) {
      buf = next
      continue
    }
    flush()
    if (graphemeLen(part) <= maxLen) {
      buf = part
    } else {
      flush()
      packed.push(...packOversizedSegment(part, maxLen))
    }
  }
  flush()
  return packed.length ? packed : hardSliceProse(text, maxLen)
}

/**
 * 将一段对白/旁白拆成多条气泡：先按句号/问号/叹号保整句，再按逗号，最后硬切。
 * 禁止产出仅含标点的碎片。
 */
export function splitDiscussBubbleChunks(
  text: string,
  maxLen = DISCUSS_BUBBLE_MAX_CHARS,
): string[] {
  const raw = text.trim()
  if (!raw) return []
  if (graphemeLen(raw) <= maxLen) return [raw]

  const sentences = raw.split(/(?<=[。！？!?…])/u).map((x) => x.trim()).filter(Boolean)
  const segments = sentences.length ? sentences : [raw]

  const chunks: string[] = []
  let buf = ''

  const flushBuf = () => {
    const t = buf.trim()
    if (isMeaningfulChunk(t)) chunks.push(t)
    buf = ''
  }

  for (const seg of segments) {
    if (graphemeLen(seg) <= maxLen) {
      const merged = buf ? buf + seg : seg
      if (graphemeLen(merged) <= maxLen) {
        buf = merged
      } else {
        flushBuf()
        buf = seg
      }
      continue
    }
    flushBuf()
    chunks.push(...packOversizedSegment(seg, maxLen))
  }
  flushBuf()
  return chunks.length ? chunks : [raw]
}

export type NpcBubbleSegment = {
  body: string
  actionLine?: string
  bubbleContinued?: boolean
}

/** 单条 beat 拆成多条 UI 气泡（旁白尽量整段，对白按整句优先切分） */
export function expandNpcReplyToBubbleSegments(reply: {
  action?: string
  line: string
}): NpcBubbleSegment[] {
  const action = reply.action?.trim()
  const line = reply.line?.trim()
  if (!action && !line) return []

  const segments: NpcBubbleSegment[] = []
  let continued = false

  if (action) {
    const actionChunks =
      graphemeLen(action) <= DISCUSS_ASIDE_MAX_CHARS
        ? [action]
        : splitDiscussBubbleChunks(action, DISCUSS_ASIDE_MAX_CHARS)
    for (const chunk of actionChunks) {
      segments.push({ body: '', actionLine: chunk, bubbleContinued: continued })
      continued = true
    }
  }
  if (line) {
    for (const chunk of splitDiscussBubbleChunks(line)) {
      segments.push({ body: chunk, bubbleContinued: continued })
      continued = true
    }
  }
  return segments
}

/** 还原给模型的 transcript：同组 split 气泡合并回完整一句 */
export function mergeDiscussBubbleMessages(messages: readonly JBSChatMessage[]): JBSChatMessage[] {
  const out: JBSChatMessage[] = []

  for (const msg of messages) {
    const prev = out[out.length - 1]
    const group = msg.discussBubbleGroup?.trim()
    if (
      group &&
      prev &&
      prev.discussBubbleGroup === group &&
      prev.kind === msg.kind &&
      prev.roleName === msg.roleName
    ) {
      out[out.length - 1] = {
        ...prev,
        body: `${prev.body}${msg.body}`,
        actionLine: [prev.actionLine, msg.actionLine].filter(Boolean).join('') || undefined,
      }
      continue
    }
    out.push({ ...msg })
  }
  return out
}
