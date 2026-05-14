import { Fragment, type ReactNode } from 'react'

const QL = '\u201C'
const QR = '\u201D'
/** 少数排版/导出用弯引号变体 */
const Q_OPEN_ALT = '\u201F'
/** 闭合侧：优先标准右弯引号；若无再兜底全角直引号（少数输入法） */
function indexOfClosingCurve(t: string, from: number): number {
  const jR = t.indexOf(QR, from)
  if (jR !== -1) return jR
  return t.indexOf('\uFF02', from)
}

/** 内心 OS：浅灰字，无衬底、无描边 */
const osCls = 'text-[15px] font-normal italic leading-[1.75] text-[#b8b8bc]'

/** 对白：柔和轻奢感（暖米底、香槟描边、略收紧字距），与旁灰正文区分 */
const dialogueCls =
  'inline not-italic rounded-[6px] bg-[#faf8f4] px-[0.28em] py-[0.12em] font-medium tracking-[0.02em] text-[#3f3a33] shadow-[0_1px_3px_rgba(62,56,48,0.06)] ring-1 ring-[#ebe3d7]/90 [box-decoration-break:clone]'

function normalizeRichTextSource(s: string): string {
  return String(s || '')
    .replace(/\uFEFF/g, '')
    .replace(/\uFF0A/g, '*')
}

type Match = { end: number; node: ReactNode }

/**
 * 三种语义：**内心**、对白（「」/弯引号/英文引号）、其余为旁白。
 * 对白：柔和轻奢底纹 + 细描边区分旁白（非 VN 气泡卡片）。
 * 优先级：** → * → 「」 → “” / ‟ → 半角 ""
 * 半角直引号对白在展示层映射为弯引号并套用 dialogueCls；顶层将全角＊规范为半角 * 以便 **内心** 命中。
 */
export function parsePlotRichText(s: string, depth = 0): ReactNode[] {
  const t = depth === 0 ? normalizeRichTextSource(s) : s
  if (!t) return []
  if (depth > 24) return [<Fragment key="deep">{t}</Fragment>]

  const out: ReactNode[] = []
  let plainStart = 0
  let i = 0
  let key = 0
  const nextKey = () => {
    key += 1
    return `k-${depth}-${key}`
  }

  const emitPlain = (from: number, to: number) => {
    if (from >= to) return
    const chunk = t.slice(from, to)
    out.push(<Fragment key={nextKey()}>{chunk}</Fragment>)
  }

  const tryOs = (): Match | null => {
    if (!t.slice(i).startsWith('**')) return null
    const end = t.indexOf('**', i + 2)
    if (end === -1) return null
    const inner = t.slice(i + 2, end)
    const k = nextKey()
    return {
      end: end + 2,
      node: (
        <span key={k} className={osCls}>
          {parsePlotRichText(inner, depth + 1)}
        </span>
      ),
    }
  }

  const trySingleOs = (): Match | null => {
    if (t[i] !== '*') return null
    // 双星号由 tryOs 处理；这里只兜底单星号。
    if (t[i + 1] === '*') return null
    const end = t.indexOf('*', i + 1)
    if (end === -1) return null
    const inner = t.slice(i + 1, end)
    if (!inner.trim()) return null
    const k = nextKey()
    return {
      end: end + 1,
      node: (
        <span key={k} className={osCls}>
          {parsePlotRichText(inner, depth + 1)}
        </span>
      ),
    }
  }

  const tryCorner = (): Match | null => {
    if (t[i] !== '「') return null
    const end = t.indexOf('」', i + 1)
    if (end === -1) return null
    const inner = t.slice(i + 1, end)
    const k = nextKey()
    return {
      end: end + 1,
      node: (
        <span key={k} className={dialogueCls}>
          「{parsePlotRichText(inner, depth + 1)}」
        </span>
      ),
    }
  }

  const tryCurve = (): Match | null => {
    if (t[i] !== QL && t[i] !== Q_OPEN_ALT) return null
    const end = indexOfClosingCurve(t, i + 1)
    if (end === -1) return null
    const inner = t.slice(i + 1, end)
    const k = nextKey()
    return {
      end: end + 1,
      node: (
        <span key={k} className={dialogueCls}>
          {QL}
          {parsePlotRichText(inner, depth + 1)}
          {QR}
        </span>
      ),
    }
  }

  const tryAscii = (): Match | null => {
    if (t[i] !== '"') return null
    const end = t.indexOf('"', i + 1)
    if (end === -1 || end === i + 1) return null
    const inner = t.slice(i + 1, end)
    const k = nextKey()
    return {
      end: end + 1,
      node: (
        <span key={k} className={dialogueCls}>
          {QL}
          {parsePlotRichText(inner, depth + 1)}
          {QR}
        </span>
      ),
    }
  }

  while (i < t.length) {
    const m = tryOs() ?? trySingleOs() ?? tryCorner() ?? tryCurve() ?? tryAscii()
    if (m) {
      emitPlain(plainStart, i)
      out.push(m.node)
      i = m.end
      plainStart = i
      continue
    }
    i += 1
  }
  emitPlain(plainStart, t.length)
  return out
}

export function PlotRichParagraph({ content, className }: { content: string; className?: string }) {
  const merged = ['whitespace-pre-wrap break-words', className].filter(Boolean).join(' ')
  return <span className={merged}>{parsePlotRichText(content)}</span>
}
