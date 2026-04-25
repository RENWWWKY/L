import type { PlotItem } from './types'
import { splitDatingAssistantOutput } from './plotCoT'

/** 取 AI 剧情用于多版本存储/展示的正文与思维链（与 `StoryBlock` / `splitDatingAssistantOutput` 一致） */
export function getAiPlotVersionSlices(plot: PlotItem): { body: string; logicPass?: string } {
  if (plot.type !== 'ai') return { body: plot.content }
  const stored = plot.logicPass?.trim()
  if (stored) return { body: plot.content, logicPass: stored }
  const sp = splitDatingAssistantOutput(plot.content)
  return { body: sp.content, logicPass: sp.logicPass || plot.planSummary?.trim() || undefined }
}

export function getAiVersionArrays(plot: PlotItem): {
  versions: string[]
  versionLogicPasses: (string | undefined)[]
  currentVersionIndex: number
} {
  if (plot.type !== 'ai') {
    return { versions: [plot.content], versionLogicPasses: [undefined], currentVersionIndex: 0 }
  }
  if (plot.versions?.length) {
    const vs = [...plot.versions]
    const lp =
      plot.versionLogicPasses && plot.versionLogicPasses.length === vs.length
        ? [...plot.versionLogicPasses]
        : vs.map(() => plot.logicPass)
    const idx = Math.max(0, Math.min(vs.length - 1, plot.currentVersionIndex ?? vs.length - 1))
    return { versions: vs, versionLogicPasses: lp, currentVersionIndex: idx }
  }
  const { body, logicPass } = getAiPlotVersionSlices(plot)
  return {
    versions: [body],
    versionLogicPasses: [logicPass],
    currentVersionIndex: 0,
  }
}

/** 新建 AI 条时写入的首版结构（与 `PlotItem` 合并为完整对象） */
export function initialAiPlotVersions(
  content: string,
  logicPass?: string,
  planSummary?: string,
): Pick<PlotItem, 'content' | 'logicPass' | 'planSummary' | 'versions' | 'versionLogicPasses' | 'currentVersionIndex'> {
  return {
    content,
    logicPass,
    planSummary,
    versions: [content],
    versionLogicPasses: [logicPass],
    currentVersionIndex: 0,
  }
}

/** 重新生成：追加新版本并指向最新 */
export function appendAiRegenerateVersion(
  prev: PlotItem,
  newContent: string,
  newLogicPass?: string,
  newPlanSummary?: string,
): PlotItem {
  const { versions, versionLogicPasses } = getAiVersionArrays(prev)
  const nextVs = [...versions, newContent]
  const nextLp = [...versionLogicPasses, newLogicPass]
  while (nextLp.length < nextVs.length) nextLp.push(undefined)
  return {
    ...prev,
    content: newContent,
    logicPass: newLogicPass,
    planSummary: newPlanSummary,
    versions: nextVs,
    versionLogicPasses: nextLp,
    currentVersionIndex: nextVs.length - 1,
    timestamp: Date.now(),
  }
}

/** 切换当前展示版本，并同步顶层 content / logicPass */
export function plotWithVersionIndex(plot: PlotItem, index: number): PlotItem {
  if (plot.type !== 'ai') return plot
  const { versions, versionLogicPasses } = getAiVersionArrays(plot)
  const i = Math.max(0, Math.min(versions.length - 1, index))
  return {
    ...plot,
    content: versions[i]!,
    logicPass: versionLogicPasses[i],
    versions,
    versionLogicPasses,
    currentVersionIndex: i,
  }
}

/** 保存编辑：改写当前版本正文（各版本正文与 `versionLogicPasses` 平行存储） */
export function plotWithEditedCurrentVersion(plot: PlotItem, draftBody: string): PlotItem {
  if (plot.type !== 'ai') return { ...plot, content: draftBody.trimEnd() }
  const { versions, versionLogicPasses, currentVersionIndex } = getAiVersionArrays(plot)
  const nextVs = [...versions]
  const nextLp = [...versionLogicPasses]
  const i = currentVersionIndex
  nextVs[i] = draftBody.trimEnd()
  while (nextLp.length < nextVs.length) nextLp.push(undefined)
  return {
    ...plot,
    content: nextVs[i]!,
    logicPass: nextLp[i],
    versions: nextVs,
    versionLogicPasses: nextLp,
    currentVersionIndex: i,
  }
}
