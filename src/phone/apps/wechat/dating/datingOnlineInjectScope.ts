import {
  buildOfflinePlotGenerationTimelineRule,
  buildCrossChannelTimelineSnapshot,
  formatSystemRecordTime,
  resolveLastOfflineAiPlotTimestampMs,
} from '../wechatCrossChannelTimeline'

export { resolveLastOfflineAiPlotTimestampMs }

export function resolveDatingOnlineInjectMinTimestamp(params: {
  memorySummaryCursorTs: number | null
  lastOfflineAiPlotTs: number | null
}): number {
  const memFloor = (params.memorySummaryCursorTs ?? 0) + 1
  const plotFloor =
    params.lastOfflineAiPlotTs != null && Number.isFinite(params.lastOfflineAiPlotTs)
      ? params.lastOfflineAiPlotTs + 1
      : 0
  return Math.max(memFloor, plotFloor)
}

export type DatingOnlineInjectScopeMeta = {
  minMessageTimestamp: number
  lastOfflineAiPlotTs: number | null
  privateMessageCount: number
  onlineInjectMinTs: number | null
  onlineInjectMaxTs: number | null
}

export function formatDatingOnlineInjectScopeFooter(meta: DatingOnlineInjectScopeMeta): string {
  if (meta.privateMessageCount <= 0) return ''
  const anchor =
    meta.lastOfflineAiPlotTs != null
      ? `上一轮线下 AI（${formatSystemRecordTime(meta.lastOfflineAiPlotTs)}）`
      : '记忆总结游标'
  const span =
    meta.onlineInjectMinTs != null &&
    meta.onlineInjectMaxTs != null &&
    meta.onlineInjectMinTs !== meta.onlineInjectMaxTs
      ? `；时间跨度 ${formatSystemRecordTime(meta.onlineInjectMinTs)} → ${formatSystemRecordTime(meta.onlineInjectMaxTs)}`
      : meta.onlineInjectMaxTs != null
        ? `；发送于 ${formatSystemRecordTime(meta.onlineInjectMaxTs)}`
        : ''
  return (
    `（↑ 尚未经自动总结写入长期记忆；**本块仅含自${anchor}之后至本次线下生成前的 ${meta.privateMessageCount} 条私聊**${span}；` +
    `每条前缀为**系统落库时刻**（真实钟点，非剧情时间）。更早线上事实**禁止**自行引用，除非长期记忆/向量召回已命中。）`
  )
}

export function formatDatingGroupOnlineInjectScopeFooter(params: {
  lastOfflineAiPlotTs: number | null
  lineCount: number
}): string {
  if (params.lineCount <= 0) return ''
  const anchor =
    params.lastOfflineAiPlotTs != null
      ? `上一轮线下 AI（${formatSystemRecordTime(params.lastOfflineAiPlotTs)}）`
      : '记忆总结游标'
  return (
    `（↑ 本块仅含自${anchor}之后至本次线下生成前的未总结群聊；每条前缀为**系统落库时刻**（真实钟点，非剧情时间）。` +
    `更早内容禁止自行引用，除非长期记忆/向量召回已命中。）`
  )
}

/** 约会 system prompt：系统落库时刻·跨通道先后 + 线上时间窗 */
export function formatDatingOnlineTemporalScopePromptRule(
  meta: DatingOnlineInjectScopeMeta,
  generationTs = Date.now(),
): string {
  if (meta.privateMessageCount <= 0 && meta.lastOfflineAiPlotTs == null) return ''
  const snap = buildCrossChannelTimelineSnapshot({
    lastOfflineAiPlotTs: meta.lastOfflineAiPlotTs,
    onlineInjectMinTs: meta.onlineInjectMinTs,
    onlineInjectMaxTs: meta.onlineInjectMaxTs,
    generationTs,
  })
  return buildOfflinePlotGenerationTimelineRule(snap)
}
