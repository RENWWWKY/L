import { useMemo, type ReactNode } from 'react'

/** 教程 / 引导文案：用 [[短语]] 标出需在正文中「高亮」强调的字句（金底样式，非界面聚光灯） */
const HL_RE = /\[\[([^\]]+)\]\]/g

export function parseMeetTutorialHighlightParts(text: string): { text: string; highlight: boolean }[] {
  const s = String(text ?? '')
  if (!s.includes('[[')) return [{ text: s, highlight: false }]
  const out: { text: string; highlight: boolean }[] = []
  let last = 0
  HL_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = HL_RE.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), highlight: false })
    out.push({ text: m[1], highlight: true })
    last = m.index + m[0].length
  }
  if (last < s.length) out.push({ text: s.slice(last), highlight: false })
  return out.length ? out : [{ text: s, highlight: false }]
}

export function MeetTutorialHighlightText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const parts = useMemo(() => parseMeetTutorialHighlightParts(text), [text])
  const nodes: ReactNode[] = parts.map((p, i) =>
    p.highlight ? (
      <mark
        key={i}
        className="rounded-[3px] bg-[#faf6ee] px-0.5 font-medium text-[#8a7340] not-italic ring-1 ring-[#D4AF37]/40"
      >
        {p.text}
      </mark>
    ) : (
      <span key={i}>{p.text}</span>
    ),
  )
  return <span className={className}>{nodes}</span>
}
