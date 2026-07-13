import {
  extractStoryTimelineRowKeywordsFromRowText,
  extractStoryTimelineRowTitleFromRowText,
  normalizeStoryTimelineRowKeywords,
  normalizeStoryTimelineRowTitle,
  stripStoryTimelineTitleLine,
} from './storyTimelineTypes'

/** 扁平长期记忆总结 · 纯文本输出结构（与入库 formatOnlineMemorySummaryStorageBody 同构）。 */
export const FLAT_MEMORY_SUMMARY_PROSE_STRUCTURE = `
【输出格式】只输出下列三行结构（须保留【摘要标题】【摘要关键词】【摘要正文】标记行），禁止 JSON、禁止 markdown 代码围栏、禁止 JSON 前后任何解释或思维链：
【摘要标题】（4～10 字；概括本轮主题或情绪转折）
【摘要关键词】（3～5 个检索词，用顿号「、」分隔，每条 ≤5 个汉字）
【摘要正文】
（空一行后写第三人称备忘正文；60～200 字为宜，信息很少可更短）
`.trim()

export function buildFlatMemorySummaryProseOutputRule(placeholderInstruction: string): string {
  return `${FLAT_MEMORY_SUMMARY_PROSE_STRUCTURE}\n${placeholderInstruction}`.trim()
}

function stripModelFences(raw: string): string {
  return String(raw ?? '')
    .replace(/^```(?:json|markdown|text)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

/** 解析模型纯文本总结；无有效正文时返回 null（由调用方回退 JSON 解析）。 */
export function parseFlatMemorySummaryProseOutput(raw: string): {
  rowTitle?: string
  rowKeywords?: string[]
  content: string
} | null {
  const stripped = stripModelFences(String(raw ?? '')).trim()
  if (!stripped) return null

  const hasProseMarkers = /【摘要标题】|【摘要关键词】|【摘要正文】/.test(stripped)
  if (!hasProseMarkers) return null

  const rowTitle = normalizeStoryTimelineRowTitle(extractStoryTimelineRowTitleFromRowText(stripped))
  const rowKeywords = normalizeStoryTimelineRowKeywords(
    extractStoryTimelineRowKeywordsFromRowText(stripped),
  )

  const bodyMatch = stripped.match(/【摘要正文】\s*\n?([\s\S]+)/)
  let content = (bodyMatch?.[1] ?? '').trim()
  if (!content) {
    content = stripped
      .replace(/^【摘要标题】[^\n]*\n?/m, '')
      .replace(/^【摘要关键词】[^\n]*\n?/m, '')
      .replace(/^【摘要正文】\s*\n?/m, '')
      .trim()
  }

  if (!content) return null
  return {
    ...(rowTitle ? { rowTitle } : {}),
    ...(rowKeywords.length ? { rowKeywords } : {}),
    content: stripFlatMemorySummaryStorageMarkers(content),
  }
}

/** 去掉入库/storage 标记行，只保留叙事正文。 */
export function stripFlatMemorySummaryStorageMarkers(text: string): string {
  const stripped = stripStoryTimelineTitleLine(String(text ?? '').trim())
  return stripped
    .replace(/^【摘要正文】\s*\n?/m, '')
    .trim()
}
