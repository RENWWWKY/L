import {
  formatStoryTimelineDeltaForDisplay,
  parseStoryTimelineSummaryDelta,
  type StoryTimelineSummaryDelta,
} from '../memory/storyTimelineTypes'
import { parseUnifiedMemorySummaryWithLinkedModelOutput, splitDatingAiResponseAndUnifiedMemoryJson } from '../wechatChatAi'

export function extractTimelineDeltaFromMemoryJsonText(
  memoryJsonText: string | null | undefined,
): StoryTimelineSummaryDelta | undefined {
  const raw = String(memoryJsonText ?? '').trim()
  if (!raw) return undefined
  try {
    const summary = parseUnifiedMemorySummaryWithLinkedModelOutput(raw)
    return summary.primary.timeline
  } catch {
    return undefined
  }
}

/** 从模型尾部 JSON 提取本轮剧情时间轴增量，供 plot 存档与 UI 折叠展示。 */
export function extractTimelineSnapshotTextFromMemoryJsonTail(
  memoryJsonText: string | null | undefined,
  recordedAtMs?: number,
): string {
  const delta = extractTimelineDeltaFromMemoryJsonText(memoryJsonText)
  if (!delta) return ''
  return formatStoryTimelineDeltaForDisplay(delta, { recordedAtMs })
}

export function extractTimelineSnapshotTextFromAiTextRaw(aiTextRaw: string, recordedAtMs?: number): string {
  const { memoryJsonText } = splitDatingAiResponseAndUnifiedMemoryJson(aiTextRaw)
  return extractTimelineSnapshotTextFromMemoryJsonTail(memoryJsonText, recordedAtMs)
}

/** 解析 inline JSON 内 timeline 字段（容错：直接 parse 顶层 timeline）。 */
export function parseTimelineDeltaFromMemoryJsonLoose(raw: string): StoryTimelineSummaryDelta | undefined {
  const fromUnified = extractTimelineDeltaFromMemoryJsonText(raw)
  if (fromUnified) return fromUnified
  try {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) return undefined
    const j = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
    const primary = j.primary
    if (primary && typeof primary === 'object') {
      return parseStoryTimelineSummaryDelta((primary as Record<string, unknown>).timeline)
    }
    return parseStoryTimelineSummaryDelta(j.timeline)
  } catch {
    return undefined
  }
}
