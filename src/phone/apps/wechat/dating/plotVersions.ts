import type { StoryTimelineSummaryDelta } from '../memory/storyTimelineTypes'
import type { PlotItem } from './types'

/** 取 AI 剧情用于多版本存储/展示的正文与思维链（与 `StoryBlock` / `splitDatingAssistantOutput` 一致） */
export function getAiPlotVersionSlices(plot: PlotItem): {
  body: string
  logicPass?: string
  timelineSnapshot?: string
  timelineDelta?: StoryTimelineSummaryDelta
} {
  if (plot.type !== 'ai') return { body: plot.content }
  const { versions, versionLogicPasses, versionTimelineSnapshots, versionTimelineDeltas, currentVersionIndex } =
    getAiVersionArrays(plot)
  const i = Math.max(0, Math.min(versions.length - 1, currentVersionIndex))
  return {
    body: versions[i] ?? plot.content,
    logicPass: versionLogicPasses[i] ?? plot.logicPass,
    timelineSnapshot: versionTimelineSnapshots[i] ?? plot.timelineSnapshot,
    timelineDelta: versionTimelineDeltas[i] ?? plot.timelineDelta,
  }
}

export function getAiVersionArrays(plot: PlotItem): {
  versions: string[]
  versionLogicPasses: (string | undefined)[]
  versionTimelineSnapshots: (string | undefined)[]
  versionTimelineDeltas: (StoryTimelineSummaryDelta | undefined)[]
  currentVersionIndex: number
} {
  const versions = plot.versions?.length ? [...plot.versions] : [plot.content]
  const versionLogicPasses = plot.versionLogicPasses?.length
    ? [...plot.versionLogicPasses]
    : [plot.logicPass]
  const versionTimelineSnapshots = plot.versionTimelineSnapshots?.length
    ? [...plot.versionTimelineSnapshots]
    : [plot.timelineSnapshot]
  const versionTimelineDeltas = plot.versionTimelineDeltas?.length
    ? [...plot.versionTimelineDeltas]
    : [plot.timelineDelta]
  while (versionLogicPasses.length < versions.length) versionLogicPasses.push(undefined)
  while (versionTimelineSnapshots.length < versions.length) versionTimelineSnapshots.push(undefined)
  while (versionTimelineDeltas.length < versions.length) versionTimelineDeltas.push(undefined)
  const currentVersionIndex =
    typeof plot.currentVersionIndex === 'number' && Number.isFinite(plot.currentVersionIndex)
      ? Math.max(0, Math.min(versions.length - 1, plot.currentVersionIndex))
      : versions.length - 1
  return {
    versions,
    versionLogicPasses,
    versionTimelineSnapshots,
    versionTimelineDeltas,
    currentVersionIndex,
  }
}

/** 新建 AI 条时写入的首版结构（与 `PlotItem` 合并为完整对象） */
export function initialAiPlotVersions(
  content: string,
  logicPass?: string,
  planSummary?: string,
  timelineSnapshot?: string,
  timelineDelta?: StoryTimelineSummaryDelta,
): Pick<
  PlotItem,
  | 'content'
  | 'logicPass'
  | 'planSummary'
  | 'versions'
  | 'versionLogicPasses'
  | 'versionTimelineSnapshots'
  | 'versionTimelineDeltas'
  | 'timelineSnapshot'
  | 'timelineDelta'
  | 'currentVersionIndex'
> {
  const snap = timelineSnapshot?.trim() || undefined
  const delta = timelineDelta && Object.keys(timelineDelta).length ? timelineDelta : undefined
  return {
    content,
    logicPass,
    planSummary,
    versions: [content],
    versionLogicPasses: [logicPass],
    versionTimelineSnapshots: [snap],
    versionTimelineDeltas: [delta],
    timelineSnapshot: snap,
    timelineDelta: delta,
    currentVersionIndex: 0,
  }
}

/** 重新生成：追加新版本并指向最新 */
export function appendAiRegenerateVersion(
  prev: PlotItem,
  newContent: string,
  newLogicPass?: string,
  newPlanSummary?: string,
  newTimelineSnapshot?: string,
  newTimelineDelta?: StoryTimelineSummaryDelta,
): PlotItem {
  const { versions, versionLogicPasses, versionTimelineSnapshots, versionTimelineDeltas } =
    getAiVersionArrays(prev)
  const nextVs = [...versions, newContent]
  const nextLp = [...versionLogicPasses, newLogicPass]
  const nextTs = [...versionTimelineSnapshots, newTimelineSnapshot?.trim() || undefined]
  const nextTd = [...versionTimelineDeltas, newTimelineDelta]
  while (nextLp.length < nextVs.length) nextLp.push(undefined)
  while (nextTs.length < nextVs.length) nextTs.push(undefined)
  while (nextTd.length < nextVs.length) nextTd.push(undefined)
  const snap = nextTs[nextTs.length - 1]
  const delta = nextTd[nextTd.length - 1]
  return {
    ...prev,
    content: newContent,
    logicPass: newLogicPass,
    planSummary: newPlanSummary,
    versions: nextVs,
    versionLogicPasses: nextLp,
    versionTimelineSnapshots: nextTs,
    versionTimelineDeltas: nextTd,
    timelineSnapshot: snap,
    timelineDelta: delta,
    currentVersionIndex: nextVs.length - 1,
    timestamp: Date.now(),
  }
}

/** 切换当前展示版本，并同步顶层 content / logicPass / timelineSnapshot */
export function plotWithVersionIndex(plot: PlotItem, index: number): PlotItem {
  if (plot.type !== 'ai') return plot
  const { versions, versionLogicPasses, versionTimelineSnapshots, versionTimelineDeltas } =
    getAiVersionArrays(plot)
  const i = Math.max(0, Math.min(versions.length - 1, index))
  return {
    ...plot,
    content: versions[i]!,
    logicPass: versionLogicPasses[i],
    timelineSnapshot: versionTimelineSnapshots[i],
    timelineDelta: versionTimelineDeltas[i],
    versions,
    versionLogicPasses,
    versionTimelineSnapshots,
    versionTimelineDeltas,
    currentVersionIndex: i,
  }
}

/** 保存编辑：改写当前版本正文（各版本正文与 `versionLogicPasses` 平行存储） */
export function plotWithEditedCurrentVersion(plot: PlotItem, draftBody: string): PlotItem {
  if (plot.type !== 'ai') return { ...plot, content: draftBody.trimEnd() }
  const { versions, versionLogicPasses, versionTimelineSnapshots, versionTimelineDeltas, currentVersionIndex } =
    getAiVersionArrays(plot)
  const nextVs = [...versions]
  const nextLp = [...versionLogicPasses]
  const nextTs = [...versionTimelineSnapshots]
  const nextTd = [...versionTimelineDeltas]
  const i = currentVersionIndex
  nextVs[i] = draftBody.trimEnd()
  while (nextLp.length < nextVs.length) nextLp.push(undefined)
  while (nextTs.length < nextVs.length) nextTs.push(undefined)
  while (nextTd.length < nextVs.length) nextTd.push(undefined)
  return {
    ...plot,
    content: nextVs[i]!,
    logicPass: nextLp[i],
    timelineSnapshot: nextTs[i],
    timelineDelta: nextTd[i],
    versions: nextVs,
    versionLogicPasses: nextLp,
    versionTimelineSnapshots: nextTs,
    versionTimelineDeltas: nextTd,
    currentVersionIndex: i,
  }
}
