import type { DatingPlotSnapshotItem } from '../unifiedMemoryAutoSummary'
import {
  composeStoryTimelineCalendarAnchorLabel,
  hasTimelineDeltaContent,
  STORY_TIMELINE_GREGORIAN_ANCHOR_RE,
} from '../memory/storyTimelineTypes'
import { formatSystemRecordTime, resolvePlotSystemRecordedAtMs } from '../wechatCrossChannelTimeline'
import { getAiPlotActiveTimelineDelta } from './plotTimelineDelta'
import type { PlotItem } from './types'

type PlotStoryTimeRef = Pick<
  DatingPlotSnapshotItem,
  'type' | 'timelineDelta' | 'timelineSnapshot' | 'timestamp'
>

/** 从 AI 剧情 timeline 增量 / 快照解析故事内公历时刻（优先区间 end） */
export function resolvePlotStoryCalendarLabel(
  plot: PlotStoryTimeRef | PlotItem,
): string | null {
  if (plot.type !== 'ai') return null
  const delta =
    'versions' in plot && plot.type === 'ai'
      ? getAiPlotActiveTimelineDelta(plot as PlotItem)
      : plot.timelineDelta
  if (delta && hasTimelineDeltaContent(delta)) {
    const label = composeStoryTimelineCalendarAnchorLabel(delta)
    if (label) {
      const parts = label.split(/\s*-\s*/)
      return (parts[parts.length - 1] ?? parts[0] ?? '').trim() || null
    }
  }
  const snap = String(plot.timelineSnapshot ?? '').trim()
  const anchorMatch = snap.match(/【本轮锚点】([^\n]+)/)
  const anchorText = anchorMatch?.[1]?.trim() ?? ''
  if (anchorText) {
    const cal = anchorText.match(STORY_TIMELINE_GREGORIAN_ANCHOR_RE)
    if (cal?.[0]) {
      const parts = cal[0].split(/\s*-\s*/)
      return (parts[parts.length - 1] ?? parts[0] ?? '').trim() || null
    }
    const first = anchorText.split(' · ')[0]?.trim()
    if (first && /^\d{4}年/.test(first)) return first
  }
  return null
}

/** prompt / 思维溯源前缀：优先故事内公历，无锚点则回退系统落库时刻 */
export function formatPlotPromptTimeBracket(
  plot: PlotStoryTimeRef | PlotItem,
  opts?: { storyCalendarFallback?: string | null; markSystemFallback?: boolean },
): string {
  const story =
    plot.type === 'ai'
      ? resolvePlotStoryCalendarLabel(plot)
      : opts?.storyCalendarFallback?.trim() || null
  if (story) return `[${story}]`
  const ts = resolvePlotSystemRecordedAtMs(plot)
  const sys = formatSystemRecordTime(ts)
  return opts?.markSystemFallback !== false ? `[${sys}·落库]` : `[${sys}]`
}
