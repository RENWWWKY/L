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
  /** 线下剧情时间轴解析出的故事内「现在」；与设备落库钟点独立 */
  storyCalendarAnchor?: string | null
}

/** 从 prompt 方括号前缀提取故事内公历时刻（排除 `[…·落库]` 系统回退） */
export function extractStoryCalendarFromPromptBracket(text: string): string | null {
  for (const m of String(text ?? '').matchAll(/\[([^\]]+)\]/g)) {
    const inner = m[1]?.trim() ?? ''
    if (!inner || inner.includes('·落库')) continue
    if (/^\d{4}年/.test(inner)) return inner
  }
  return null
}

/** 线上→线下：故事内时刻对齐，防把设备 10:20 误读成剧情清晨 */
export function buildCrossChannelStoryTimeSyncRule(params: {
  storyCalendarAnchor?: string | null
  hasOnlineInject?: boolean
}): string {
  const story = params.storyCalendarAnchor?.trim()
  if (!story || params.hasOnlineInject === false) return ''
  return (
    `【跨通道·故事内时刻对齐（最高优先级）】\n` +
    `- 当前故事内「现在」以【剧情时间轴·当前状态】为准；线下末条日历锚点参考：**${story}**。\n` +
    `- 若剧情轴当前锚点已**晚于**线下末条（线上时间设置推进过）：下方「尚未总结·私聊」接在推进后的「现在」；**禁止**因末条是更早一夜而把线下开场拉回该夜。\n` +
    `- 若剧情轴未推进：私聊在故事内理解为 **${story} 前后**（与线下末条同一时段/同一夜），是角色在该故事时刻**用手机远程发消息**。\n` +
    `- 若每条仍带方括号前缀，则为**设备真实发送/落库钟点**（你手机上几点点的发送），**不是**故事内剧情时刻；**禁止**把 10:20 等前缀误读成故事清晨、另一天或线下已过去的时段。\n` +
    `- 写线下承接时以剧情轴当前「现在」为时空锚（未推进则用 **${story}**）；线上关没开「时间感知」也不改变本条对齐规则。\n\n`
  )
}

export function formatDatingOnlineInjectScopeFooter(meta: DatingOnlineInjectScopeMeta): string {
  if (meta.privateMessageCount <= 0) return ''
  const anchor =
    meta.lastOfflineAiPlotTs != null
      ? `上一轮线下 AI（${formatSystemRecordTime(meta.lastOfflineAiPlotTs)}·落库）`
      : '记忆总结游标'
  const span =
    meta.onlineInjectMinTs != null &&
    meta.onlineInjectMaxTs != null &&
    meta.onlineInjectMinTs !== meta.onlineInjectMaxTs
      ? `；设备落库跨度 ${formatSystemRecordTime(meta.onlineInjectMinTs)} → ${formatSystemRecordTime(meta.onlineInjectMaxTs)}`
      : meta.onlineInjectMaxTs != null
        ? `；末条设备落库 ${formatSystemRecordTime(meta.onlineInjectMaxTs)}`
        : ''
  const story = meta.storyCalendarAnchor?.trim()
  const timeNote = story
    ? `故事内「现在」= **${story}**（以线下剧情为准）；${meta.onlineInjectMinTs != null ? '设备落库钟点见各行前缀或本注' : '本块按发送顺序排列'}，**勿把设备钟点当剧情时刻**`
    : `每条前缀为**系统落库时刻**（真实钟点，非剧情时间）`
  return (
    `（↑ 尚未经自动总结写入长期记忆；**本块仅含自${anchor}之后至本次线下生成前的 ${meta.privateMessageCount} 条私聊**${span}；` +
    `${timeNote}。更早线上事实**禁止**自行引用，除非长期记忆/向量召回已命中。）`
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

/** 取私聊注入块末尾若干条，供线上→线下开场锚点。 */
export function extractLatestOnlineChatAnchor(body: string, maxLines = 6): string {
  const lines = String(body ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- ') && l.includes('[私聊・'))
  if (!lines.length) return ''
  return lines
    .slice(-Math.max(1, maxLines))
    .map((l) => (l.length > 280 ? `…${l.slice(-280)}` : l))
    .join('\n')
}

/** 约会页生成线下剧情：线上末条空间/待兑现须直接承接，防无过渡跳次日。 */
export function buildOfflineOnlineSpatialContinuityRule(params: {
  unsPrivBlock: string
  onlineInjectScope?: DatingOnlineInjectScopeMeta | null
  peerName?: string | null
}): string {
  const scope = params.onlineInjectScope
  if (!scope || scope.privateMessageCount <= 0) return ''
  const peer = params.peerName?.trim() || '约会对象'
  const anchor = extractLatestOnlineChatAnchor(params.unsPrivBlock)
  const story = scope.storyCalendarAnchor?.trim()
  const lines = [
    `【线上→线下·承接铁律（最高优先级）】`,
    ...(story
      ? [
          `- **故事内时刻**：线下末条日历参考 **${story}**；故事「现在」以【剧情时间轴·当前状态】为准（若用户已在线上时间设置推进，则已晚于末条）。下列微信在故事内接在该「现在」前后，不是设备落库钟点所示的另一天。`,
        ]
      : []),
    `- 「尚未总结·私聊」含**上一轮线下 AI 之后**的 ${scope.privateMessageCount} 条微信：本轮线下须视为发生在该段聊天**之后**，与「最近剧情」**末尾**共同构成开场锚点（二者冲突时：**晚于线下的线上事实**优先纠偏当场状态）。`,
    `- **空间/待兑现**：线上末条若表明 ${peer} 在**门外/远程**、或已说出口「进去/过来/陪睡/别冻着/再不睡就进去」等待兑现，线下开场须**直接承接**（推门、隔门、进门、兑现或明确拒绝），**禁止**无视线上末条**无过渡**跳地点、或 ${peer} 像从未离线又端着全新道具出现。`,
    `- **时序**：剧情轴未推进时，禁止把同一晚线上刚结束的情节无旁白清零成清晨；**若剧情轴当前锚点已推进到次日/新时段**，线下须按推进后的「现在」开场，并用旁白交代间隔，**禁止**倒回推进前的末夜。`,
    `- 微信是**远程消息**：线上 ${peer} 说「进去」= 稍后可能**真人进入**同一物理空间；若用户在线上**升级请求**（如「想陪睡」），线下须响应该升级，勿只重复旧版「门外守夜」桥段。`,
    `- 【尾声延展】/【剧情时间轴】旧摘要只约束态度/背景，**不得**覆盖线上末条待兑现承诺与空间事实。`,
  ]
  if (anchor) {
    lines.push('', `【线上末条锚点（开场须承接）】`, anchor)
  }
  return `${lines.join('\n')}\n`
}
