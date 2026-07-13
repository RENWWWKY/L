export const MEMORY_SUMMARY_DEBUG_OUTPUT_MAX = 12000

export type MemorySummaryParsedPreviewInput = {
  content?: string
  rowTitle?: string
  rowKeywords?: string[]
  memoryTriggerCategory?: string
  memoryTriggerPrecise?: string
}

export function clampMemorySummaryDebugOutput(raw: string | null | undefined): string | undefined {
  const s = String(raw ?? '').trim()
  if (!s) return undefined
  if (s.length <= MEMORY_SUMMARY_DEBUG_OUTPUT_MAX) return s
  return `${s.slice(0, MEMORY_SUMMARY_DEBUG_OUTPUT_MAX)}\n\n…（已截断，完整输出约 ${s.length} 字）`
}

export function formatMemorySummaryParsedPreview(summary: MemorySummaryParsedPreviewInput): string {
  const lines: string[] = []
  if (summary.rowTitle?.trim()) lines.push(`【解析·标题】${summary.rowTitle.trim()}`)
  if (summary.rowKeywords?.length) {
    lines.push(`【解析·关键词】${summary.rowKeywords.join('、')}`)
  }
  const body = String(summary.content ?? '').trim()
  if (body) lines.push(`【解析·正文】\n${body}`)
  if (summary.memoryTriggerCategory?.trim()) {
    lines.push(`【解析·category】${summary.memoryTriggerCategory.trim()}`)
  }
  if (summary.memoryTriggerPrecise?.trim()) {
    lines.push(`【解析·precise】${summary.memoryTriggerPrecise.trim()}`)
  }
  return lines.join('\n\n') || '（解析后无有效字段）'
}

export function formatLinkedMemorySummaryParsedPreview(
  summary: MemorySummaryParsedPreviewInput & { linked?: Array<{ characterId: string; content: string }> },
): string {
  const base = formatMemorySummaryParsedPreview(summary)
  const linked = summary.linked ?? []
  if (!linked.length) return base
  const linkedLines = linked
    .map((e) => {
      const id = e.characterId.trim()
      const content = String(e.content ?? '').trim()
      if (!id || !content) return ''
      return `【linked · ${id}】\n${content}`
    })
    .filter(Boolean)
  return [base, linkedLines.join('\n\n')].filter(Boolean).join('\n\n')
}
