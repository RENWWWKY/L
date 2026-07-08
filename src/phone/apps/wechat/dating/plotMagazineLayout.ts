import type { PlotImageItem } from './types'

export type PlotMagazineFloat = 'left' | 'right'

export type PlotMagazineSegment =
  | { type: 'text'; content: string }
  | { type: 'image'; image: PlotImageItem; float: PlotMagazineFloat }

/** 将剧情正文拆成可穿插配图的段落块 */
export function splitPlotBodyParagraphs(body: string): string[] {
  const t = String(body ?? '').trim()
  if (!t) return []

  const byDouble = t
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (byDouble.length > 1) return byDouble

  const bySingle = t
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (bySingle.length > 1) return bySingle

  const sentences = t.split(/(?<=[。！？!?…]+)/).map((s) => s.trim()).filter(Boolean)
  if (sentences.length <= 2) return [t]

  const groups: string[] = []
  let buf = ''
  for (const sentence of sentences) {
    buf += sentence
    if (buf.length >= 72 || /[。！？!?…]$/.test(buf)) {
      groups.push(buf.trim())
      buf = ''
    }
  }
  if (buf.trim()) groups.push(buf.trim())
  return groups.length > 1 ? groups : [t]
}

/**
 * 小图 + 正文杂志风：配图均匀插入段落间，左右交替浮动供文字环绕。
 */
export function buildPlotMagazineSegments(body: string, images: PlotImageItem[]): PlotMagazineSegment[] {
  const paragraphs = splitPlotBodyParagraphs(body)
  const imgs = images.filter((img) => img.url?.trim())
  if (!paragraphs.length) return []
  if (!imgs.length) return paragraphs.map((content) => ({ type: 'text', content }))

  const insertAfter = new Map<number, PlotImageItem[]>()
  const paraCount = paragraphs.length

  for (let i = 0; i < imgs.length; i++) {
    const paraIdx =
      paraCount <= 1
        ? 0
        : Math.min(paraCount - 1, Math.floor(((i + 1) * paraCount) / (imgs.length + 1)))
    const bucket = insertAfter.get(paraIdx) ?? []
    bucket.push(imgs[i]!)
    insertAfter.set(paraIdx, bucket)
  }

  const out: PlotMagazineSegment[] = []
  let floatToggle = 0

  for (let p = 0; p < paragraphs.length; p++) {
    const pending = insertAfter.get(p) ?? []
    for (const image of pending) {
      out.push({
        type: 'image',
        image,
        float: floatToggle % 2 === 0 ? 'left' : 'right',
      })
      floatToggle += 1
    }
    out.push({ type: 'text', content: paragraphs[p]! })
  }

  return out
}
