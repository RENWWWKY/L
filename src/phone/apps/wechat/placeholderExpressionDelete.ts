/** 与 `expandLinkedMemoryPlaceholders` 一致：`{{xxx}}`，中间不出现 `}` */
const PLACEHOLDER_SPAN_RE = /\{\{[^}]+\}\}/g

export function placeholderExpressionSpans(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  PLACEHOLDER_SPAN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PLACEHOLDER_SPAN_RE.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length })
  }
  return out
}

/**
 * Backspace：下一次会删到占位符里任意一字时 → 删掉整段 `{{…}}`。
 * Delete：下一次正向删会碰到占位符里任意一字时 → 删掉整段。
 */
export function tryDeleteWholePlaceholderExpressionAtCaret(
  text: string,
  caretStart: number,
  caretEnd: number,
  key: 'Backspace' | 'Delete',
): { next: string; caret: number } | null {
  if (caretStart !== caretEnd) return null
  const caret = caretStart
  const spans = placeholderExpressionSpans(text)
  if (key === 'Backspace') {
    const hit = spans.find(({ start: s, end: e }) => caret > s && caret <= e)
    if (!hit) return null
    return { next: text.slice(0, hit.start) + text.slice(hit.end), caret: hit.start }
  }
  const hit = spans.find(({ start: s, end: e }) => caret >= s && caret < e)
  if (!hit) return null
  return { next: text.slice(0, hit.start) + text.slice(hit.end), caret: hit.start }
}
