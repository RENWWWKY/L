import type { StoryTimelineSummaryDelta } from '../memory/storyTimelineTypes'
import { getAiPlotVersionSlices } from './plotVersions'
import type { PlotItem } from './types'

/** 取 AI 剧情当前展示版本对应的 timeline JSON 增量（供持久化重建） */
export function getAiPlotActiveTimelineDelta(plot: PlotItem): StoryTimelineSummaryDelta | undefined {
  if (plot.type !== 'ai') return undefined
  return getAiPlotVersionSlices(plot).timelineDelta
}
