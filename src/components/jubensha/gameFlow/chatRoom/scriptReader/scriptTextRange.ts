/** 在纯文本容器内用字符偏移构造 Range */
export function rangeFromOffsets(
  root: HTMLElement,
  start: number,
  end: number,
): Range | null {
  if (start >= end) return null
  const range = document.createRange()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let offset = 0
  let started = false
  let node: Text | null

  while ((node = walker.nextNode() as Text | null)) {
    const len = node.textContent?.length ?? 0
    if (!started && offset + len > start) {
      range.setStart(node, Math.max(0, start - offset))
      started = true
    }
    if (started && offset + len >= end) {
      range.setEnd(node, Math.min(len, end - offset))
      return range
    }
    offset += len
  }
  return started ? range : null
}

export function offsetsFromRange(root: HTMLElement, range: Range): { start: number; end: number } | null {
  const pre = document.createRange()
  pre.selectNodeContents(root)
  pre.setEnd(range.startContainer, range.startOffset)
  const start = pre.toString().length
  pre.setEnd(range.endContainer, range.endOffset)
  const end = pre.toString().length
  if (end <= start) return null
  return { start, end }
}

export function offsetsFromWindowSelection(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  return offsetsFromRange(root, range)
}

export function rectsForOffsets(
  root: HTMLElement,
  start: number,
  end: number,
): DOMRect[] {
  const range = rangeFromOffsets(root, start, end)
  if (!range) return []
  return Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0)
}
