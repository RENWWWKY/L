export type LyricWord = {
  text: string
  startMs: number
  durationMs: number
}

export type ParsedLyricLine = {
  /** 该行开始时间（毫秒） */
  timeMs: number
  text: string
  /** 逐字时间轴（来自 YRC） */
  words?: LyricWord[]
}

const LRC_TAG_RE = /\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g

/** 解析网易云 LRC 文本为带时间轴的歌词行 */
export function parseLrcContent(lrc: string): ParsedLyricLine[] {
  const lines: ParsedLyricLine[] = []

  for (const rawLine of lrc.split(/\r?\n/)) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue
    if (/^\[(?:ti|ar|al|by|offset|id|ve|re):/i.test(trimmed)) continue

    const text = trimmed.replace(LRC_TAG_RE, '').trim()
    if (!text) continue

    let matched = false
    LRC_TAG_RE.lastIndex = 0
    let m = LRC_TAG_RE.exec(trimmed)
    while (m) {
      matched = true
      const min = Number(m[1])
      const sec = Number(m[2])
      const fracRaw = m[3] ?? '0'
      const ms = fracRaw.length >= 3 ? Number(fracRaw.slice(0, 3)) : Number(fracRaw.padEnd(3, '0'))
      lines.push({ timeMs: (min * 60 + sec) * 1000 + ms, text })
      m = LRC_TAG_RE.exec(trimmed)
    }

    if (!matched) {
      lines.push({ timeMs: 0, text })
    }
  }

  lines.sort((a, b) => a.timeMs - b.timeMs || a.text.localeCompare(b.text))

  const deduped: ParsedLyricLine[] = []
  for (const line of lines) {
    const prev = deduped[deduped.length - 1]
    if (prev && prev.timeMs === line.timeMs && prev.text === line.text) continue
    deduped.push(line)
  }
  return deduped
}

/** 根据当前播放时间（毫秒）定位应高亮的歌词行 */
export function activeLyricIndex(
  lines: ParsedLyricLine[],
  currentTimeMs: number,
  durationMs = 0,
): number {
  if (lines.length === 0) return 0

  const hasRealTiming =
    lines.length > 1 && lines.some((l, i) => i > 0 && l.timeMs > lines[0].timeMs)

  if (!hasRealTiming) {
    if (durationMs <= 0) return 0
    const ratio = Math.max(0, Math.min(1, currentTimeMs / durationMs))
    return Math.min(lines.length - 1, Math.floor(ratio * lines.length))
  }

  let idx = 0
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].timeMs <= currentTimeMs + 80) idx = i
    else break
  }
  return idx
}

export function lyricTexts(lines: ParsedLyricLine[]): string[] {
  return lines.map((l) => l.text)
}

/** LRC 时间轴展示为 mm:ss */
export function formatLyricTime(timeMs: number): string {
  const totalSec = Math.max(0, Math.floor(timeMs / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 根据滚动容器中心线位置，计算落在光标处的歌词行 */
/** 当前行内播放进度 0–1（无逐字歌词时用于 KTV 扫字） */
export function lineFillProgress(
  lineStartMs: number,
  lineEndMs: number,
  currentTimeMs: number,
): number {
  const span = Math.max(280, lineEndMs - lineStartMs)
  if (currentTimeMs <= lineStartMs) return 0
  if (currentTimeMs >= lineEndMs) return 1
  return (currentTimeMs - lineStartMs) / span
}

/** 单字/词播放进度 0–1 */
export function wordFillProgress(
  word: LyricWord,
  currentTimeMs: number,
  nextWordStartMs?: number,
): number {
  const endMs = nextWordStartMs ?? word.startMs + word.durationMs
  if (currentTimeMs <= word.startMs) return 0
  if (currentTimeMs >= endMs) return 1
  return (currentTimeMs - word.startMs) / Math.max(1, endMs - word.startMs)
}

export function lineEndTimeMs(
  lines: ParsedLyricLine[],
  lineIndex: number,
  durationMs = 0,
): number {
  const line = lines[lineIndex]
  if (!line) return 0
  if (line.words && line.words.length > 0) {
    const last = line.words[line.words.length - 1]!
    return last.startMs + last.durationMs + 120
  }
  const next = lines[lineIndex + 1]
  if (next) return next.timeMs
  if (durationMs > line.timeMs) return durationMs
  return line.timeMs + 4500
}

export function lyricIndexAtScrollCenter(
  container: HTMLElement,
  lineElements: Array<HTMLElement | null>,
): number {
  if (lineElements.length === 0) return 0
  const centerY = container.scrollTop + container.clientHeight / 2
  let best = 0
  let bestDist = Infinity
  lineElements.forEach((el, i) => {
    if (!el) return
    const lineCenter = el.offsetTop + el.offsetHeight / 2
    const dist = Math.abs(lineCenter - centerY)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  })
  return best
}
