import { WeiboFaceByValues } from './pulseWeiboFaceData'
import { PUBLISH_SYNTAX_COLORS } from './pulsePublishSyntax'

/** 微博方括号表情 + #话题# + @艾特 + 【超话】 */
const RICH_TOKEN =
  /\[([\u4e00-\u9fa5a-z0-9_]+?)\]|#\s*([^#[\]\s\n]{1,32})(?:#|(?=\s))|#\s*([^#[\]\s\n]{1,32})$|@([^\s@【】\[\]\n#]{1,24})(?=\s|$)|【([^】]{1,32})】/gi

export type PulseWeiboRichPart =
  | { type: 'text'; value: string }
  | { type: 'face'; name: string; url: string }
  | { type: 'hashtag'; tag: string; raw: string }
  | { type: 'mention'; name: string; raw: string }
  | { type: 'supertopic'; name: string; raw: string }

/** 解析正文中的 [doge]、#话题#、@艾特、【超话】 */
export function parsePulseWeiboRichText(text: string): PulseWeiboRichPart[] {
  if (!text) return []

  const hits: Array<{ start: number; end: number; part: PulseWeiboRichPart }> = []
  let match: RegExpExecArray | null

  RICH_TOKEN.lastIndex = 0
  while ((match = RICH_TOKEN.exec(text)) !== null) {
    const faceName = match[1]
    const tagMain = match[2]
    const tagTail = match[3]
    const mentionName = match[4]
    const superName = match[5]

    if (faceName) {
      const url = WeiboFaceByValues[faceName as keyof typeof WeiboFaceByValues]
      hits.push({
        start: match.index,
        end: match.index + match[0].length,
        part: url
          ? { type: 'face', name: faceName, url }
          : { type: 'text', value: match[0] },
      })
    } else if (tagMain || tagTail) {
      hits.push({
        start: match.index,
        end: match.index + match[0].length,
        part: { type: 'hashtag', tag: (tagMain ?? tagTail)!.trim(), raw: match[0] },
      })
    } else if (mentionName) {
      hits.push({
        start: match.index,
        end: match.index + match[0].length,
        part: { type: 'mention', name: mentionName.trim(), raw: match[0] },
      })
    } else if (superName) {
      hits.push({
        start: match.index,
        end: match.index + match[0].length,
        part: { type: 'supertopic', name: superName.trim(), raw: match[0] },
      })
    }
  }

  hits.sort((a, b) => a.start - b.start)

  const parts: PulseWeiboRichPart[] = []
  let cursor = 0
  for (const hit of hits) {
    if (hit.start < cursor) continue
    if (hit.start > cursor) {
      parts.push({ type: 'text', value: text.slice(cursor, hit.start) })
    }
    parts.push(hit.part)
    cursor = hit.end
  }
  if (cursor < text.length) {
    parts.push({ type: 'text', value: text.slice(cursor) })
  }

  return parts.length ? parts : [{ type: 'text', value: text }]
}

/** 在输入框光标处插入文本 */
export function insertAtTextareaCursor(
  current: string,
  insert: string,
  el: HTMLTextAreaElement | HTMLInputElement | null,
): { next: string; cursor: number } {
  if (!el) {
    return { next: current + insert, cursor: current.length + insert.length }
  }
  const start = el.selectionStart ?? current.length
  const end = el.selectionEnd ?? current.length
  const next = current.slice(0, start) + insert + current.slice(end)
  return { next, cursor: start + insert.length }
}

export { PUBLISH_SYNTAX_COLORS }
