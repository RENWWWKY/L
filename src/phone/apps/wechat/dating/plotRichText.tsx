import { Fragment, type ReactNode } from 'react'

const QL = '\u201C'
const QR = '\u201D'

/**
 * 对白：略淡于上一版——仍能看出是台词块，整体更轻。
 */
const langCls =
  'my-0.5 inline-block max-w-full rounded-r-md rounded-l-sm border border-stone-200/55 border-l-[2.5px] border-l-stone-500/45 bg-[#f8f7f5] px-2.5 py-1 text-[15px] font-medium leading-relaxed tracking-[0.01em] text-stone-800/95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)]'
/** 内心 OS：浅灰字，无衬底、无描边 */
const osCls = 'text-[15px] font-normal italic leading-[1.75] text-[#b8b8bc]'

type Match = { end: number; node: ReactNode }

/**
 * 三种语义：**内心**、语言（「」/弯引号/英文引号）、其余为旁白（含人名、动作描写）。
 * 优先级：** → * → 「」 → “” → ""
 */
export function parsePlotRichText(s: string, depth = 0): ReactNode[] {
  if (!s) return []
  if (depth > 24) return [<Fragment key="deep">{s}</Fragment>]

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
    const t = s.slice(from, to)
    out.push(<Fragment key={nextKey()}>{t}</Fragment>)
  }

  const wrapLang = (keyK: string, children: ReactNode) => (
    <span key={keyK} className={langCls}>
      {children}
    </span>
  )

  const tryOs = (): Match | null => {
    if (!s.slice(i).startsWith('**')) return null
    const end = s.indexOf('**', i + 2)
    if (end === -1) return null
    const inner = s.slice(i + 2, end)
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
    if (s[i] !== '*') return null
    // 双星号由 tryOs 处理；这里只兜底单星号。
    if (s[i + 1] === '*') return null
    const end = s.indexOf('*', i + 1)
    if (end === -1) return null
    const inner = s.slice(i + 1, end)
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
    if (s[i] !== '「') return null
    const end = s.indexOf('」', i + 1)
    if (end === -1) return null
    const inner = s.slice(i + 1, end)
    const k = nextKey()
    return {
      end: end + 1,
      node: wrapLang(k, <>「{parsePlotRichText(inner, depth + 1)}」</>),
    }
  }

  const tryCurve = (): Match | null => {
    if (s[i] !== QL) return null
    const end = s.indexOf(QR, i + 1)
    if (end === -1) return null
    const inner = s.slice(i + 1, end)
    const k = nextKey()
    return {
      end: end + 1,
      node: wrapLang(
        k,
        <>
          {QL}
          {parsePlotRichText(inner, depth + 1)}
          {QR}
        </>,
      ),
    }
  }

  const tryAscii = (): Match | null => {
    if (s[i] !== '"') return null
    const end = s.indexOf('"', i + 1)
    if (end === -1 || end === i + 1) return null
    const inner = s.slice(i + 1, end)
    const k = nextKey()
    return {
      end: end + 1,
      node: wrapLang(
        k,
        <>
          {'"'}
          {parsePlotRichText(inner, depth + 1)}
          {'"'}
        </>,
      ),
    }
  }

  while (i < s.length) {
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
  emitPlain(plainStart, s.length)
  return out
}

export function PlotRichParagraph({ content, className }: { content: string; className?: string }) {
  return <span className={className}>{parsePlotRichText(content)}</span>
}
