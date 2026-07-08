import { isMeetImportedWeChatMessageId } from '../lumiMeet/meetMemoryConstants'
import { formatZhDateWithWeekday } from './memory/storyTimelineTypes'
import { personaDb } from './newFriendsPersona/idb'
import type { WeChatChatMessage } from './newFriendsPersona/types'
import type { DatingPlotSnapshotItem } from './unifiedMemoryAutoSummary'
import { MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT } from './wechatMemoryPromptBlocks'

/** 系统落库时刻（公历真实钟点），用于跨通道排序；**不是**故事内剧情时间、**不是**【剧情时间轴】摘要时空。 */
export function formatSystemRecordTime(ts: number | null | undefined): string {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return '（时刻未知）'
  return formatZhDateWithWeekday(ts, { includeTime: true })
}

export function formatSystemRecordPrefix(ts: number | null | undefined): string {
  return `[${formatSystemRecordTime(ts)}]`
}

/** 与【剧情时间轴】独立：取本条在本机真实落库/生成的毫秒时间戳。 */
export function resolveMessageSystemRecordedAtMs(msg: Pick<WeChatChatMessage, 'timestamp' | 'systemRecordedAt'>): number {
  if (typeof msg.systemRecordedAt === 'number' && Number.isFinite(msg.systemRecordedAt)) {
    return msg.systemRecordedAt
  }
  return msg.timestamp
}

export function resolvePlotSystemRecordedAtMs(
  plot: Pick<DatingPlotSnapshotItem, 'timestamp'>,
): number {
  const ts = typeof plot.timestamp === 'number' && Number.isFinite(plot.timestamp) ? plot.timestamp : Date.now()
  return ts
}

export const SYSTEM_RECORD_TIME_SCOPE_NOTE =
  '「系统落库时刻」= 本条内容在本机**真实生成/落库**的公历钟点；**不是**故事内剧情日期/时段、**不是**【剧情时间轴】里的时空锚点、**不是**【当前时间】里的剧情感知时钟。两者独立，勿混用。'

export const SYSTEM_RECORD_TIME_CROSS_CHANNEL_FOOTER =
  `${SYSTEM_RECORD_TIME_SCOPE_NOTE} 故事内地点、时段、服装与伏笔以【剧情时间轴】为准；本块仅用于判断真实生成先后。`

export function resolveLastOfflineAiPlotTimestampMs(
  plots: ReadonlyArray<Pick<DatingPlotSnapshotItem, 'type' | 'timestamp'>>,
): number | null {
  let max: number | null = null
  for (const p of plots) {
    if (p.type !== 'ai') continue
    const ts = resolvePlotSystemRecordedAtMs(p)
    if (max == null || ts > max) max = ts
  }
  return max
}

export type CrossChannelTimelineSnapshot = {
  lastOfflineAiPlotTs: number | null
  onlineInjectMinTs: number | null
  onlineInjectMaxTs: number | null
  /** 本轮 AI 请求在本机发起时的真实公历毫秒 */
  generationTs: number
}

export function buildCrossChannelTimelineSnapshot(params: {
  lastOfflineAiPlotTs?: number | null
  onlineInjectMinTs?: number | null
  onlineInjectMaxTs?: number | null
  generationTs?: number
}): CrossChannelTimelineSnapshot {
  return {
    lastOfflineAiPlotTs: params.lastOfflineAiPlotTs ?? null,
    onlineInjectMinTs: params.onlineInjectMinTs ?? null,
    onlineInjectMaxTs: params.onlineInjectMaxTs ?? null,
    generationTs: params.generationTs ?? Date.now(),
  }
}

/** 游标后（及可选下限）私聊消息的系统落库时刻范围 */
export async function resolveOnlineMessageTimeBoundsForConversation(params: {
  conversationKey: string
  minMessageTimestamp?: number | null
}): Promise<{ minTs: number | null; maxTs: number | null; count: number }> {
  const ck = params.conversationKey.trim()
  if (!ck) return { minTs: null, maxTs: null, count: 0 }
  const cursor = await personaDb.getMemorySummaryCursorTimestamp(ck)
  const memFloor = (cursor ?? 0) + 1
  const extraFloor =
    params.minMessageTimestamp != null && Number.isFinite(params.minMessageTimestamp)
      ? params.minMessageTimestamp + 1
      : 0
  const fromTs = Math.max(memFloor, extraFloor)
  const rows = await personaDb.listWeChatChatMessagesFromTimestampAsc({
    conversationKey: ck,
    fromTimestampInclusive: fromTs,
    limit: MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT,
  })
  let minTs: number | null = null
  let maxTs: number | null = null
  let count = 0
  for (const m of rows) {
    if (isMeetImportedWeChatMessageId(m.id)) continue
    const recorded = resolveMessageSystemRecordedAtMs(m)
    if (!Number.isFinite(recorded)) continue
    count++
    if (minTs == null || recorded < minTs) minTs = recorded
    if (maxTs == null || recorded > maxTs) maxTs = recorded
  }
  return { minTs, maxTs, count }
}

/** 约会页生成线下剧情：阐明所注入线上段与本轮真实生成时刻的先后 */
export function buildOfflinePlotGenerationTimelineRule(snap: CrossChannelTimelineSnapshot): string {
  const genLabel = formatSystemRecordTime(snap.generationTs)
  const lines = [
    `【系统落库时刻·跨通道先后｜线下生成】`,
    SYSTEM_RECORD_TIME_SCOPE_NOTE,
    `本轮线下正文**在本机真实生成**于：${genLabel}。`,
  ]
  if (snap.onlineInjectMinTs != null && snap.onlineInjectMaxTs != null) {
    if (snap.onlineInjectMinTs === snap.onlineInjectMaxTs) {
      lines.push(
        `所注入「尚未总结·私聊/群聊」系统落库于 ${formatSystemRecordTime(snap.onlineInjectMaxTs)}。`,
      )
    } else {
      lines.push(
        `所注入「尚未总结·私聊/群聊」系统落库跨度：${formatSystemRecordTime(snap.onlineInjectMinTs)} → ${formatSystemRecordTime(snap.onlineInjectMaxTs)}（按条前缀排序）。`,
      )
    }
    lines.push(
      `因本轮真实生成 ${genLabel} **晚于**上述最晚线上落库，**本轮线下剧情须视为发生在这些线上消息之后**，须承接其事实与顺序（故事内时段仍以【剧情时间轴】为准）。`,
    )
    lines.push(
      `**空间承接**：线上末条若写 ${genLabel} 之前 ${snap.lastOfflineAiPlotTs != null ? '（且晚于上一轮线下）' : ''}的远程对话、门外守候、进门/陪睡等待兑现，线下开场须**直接承接**，禁止无过渡跳到次日清晨或无关换场；详见【线上→线下·承接铁律】。`,
    )
  }
  if (snap.lastOfflineAiPlotTs != null) {
    lines.push(
      `上一轮线下 AI 正文系统落库于 ${formatSystemRecordTime(snap.lastOfflineAiPlotTs)}；本块线上摘录均在其后、于 ${genLabel} 之前。`,
    )
  }
  lines.push(
    `各条前缀 \`[YYYY年M月D日 星期X HH:mm]\` 为**系统落库时刻**；**禁止**把较早落库条目当作本轮后才生成的内容。`,
    SYSTEM_RECORD_TIME_CROSS_CHANNEL_FOOTER,
  )
  return `${lines.join('\n')}\n`
}

/** 微信私聊生成线上回复：阐明相对最新线下剧情的真实落库先后 */
export function buildOnlineChatGenerationTimelineRule(snap: CrossChannelTimelineSnapshot): string {
  const genLabel = formatSystemRecordTime(snap.generationTs)
  const lines = [
    `【系统落库时刻·跨通道先后｜线上回复】`,
    SYSTEM_RECORD_TIME_SCOPE_NOTE,
    `本轮微信回复**在本机真实生成**于：${genLabel}。`,
  ]
  if (snap.lastOfflineAiPlotTs != null) {
    lines.push(`最新一轮线下 AI 正文系统落库于 ${formatSystemRecordTime(snap.lastOfflineAiPlotTs)}。`)
    lines.push(
      `**空间承接**：若注入了「尚未总结·线下剧情」，当场同室/分离/门内外/肢体距离以该块**最后一条 AI 剧情**为准；微信本轮为远程消息，勿用更早亲密同场或【尾声延展】覆盖末尾分离事实。`,
    )
  }
  if (snap.onlineInjectMinTs != null && snap.onlineInjectMaxTs != null) {
    if (snap.onlineInjectMinTs === snap.onlineInjectMaxTs) {
      lines.push(`所注入私聊/群聊摘录最晚一条落库于：${formatSystemRecordTime(snap.onlineInjectMaxTs)}。`)
    } else {
      lines.push(
        `所注入私聊/群聊摘录落库跨度：${formatSystemRecordTime(snap.onlineInjectMinTs)} → ${formatSystemRecordTime(snap.onlineInjectMaxTs)}。`,
      )
    }
    if (snap.lastOfflineAiPlotTs != null && snap.onlineInjectMaxTs > snap.lastOfflineAiPlotTs) {
      lines.push(
        `因最晚线上落库 **晚于** 最新线下落库，**本轮线上回复须视为发生在该线下剧情之后**（勿写线下尚未覆盖的「未来」；故事内时段仍以【剧情时间轴】为准）。`,
      )
    }
  } else if (snap.lastOfflineAiPlotTs != null) {
    lines.push(
      `当前无新注入私聊摘录；用户本轮发送/你本轮回复真实生成于 ${genLabel}，**晚于** 上述线下落库，须按此顺序承接。`,
    )
    lines.push(
      `**空间承接**：用户本轮为**远程微信**；须以「尚未总结·线下剧情」**最后一条 AI 剧情**为当场空间锚点（同室/分离/门内外/睡醒）。若线下末尾已写你离开房间或在门外守，禁止线上写「你缩在我怀里」等同场肢体接触。`,
    )
  }
  lines.push(
    `「尚未总结·私聊/群聊」与「尚未总结·线下剧情」中，每条前缀 \`[…]\` 为**系统落库时刻**；按落库先后理解因果，勿打乱顺序。`,
    SYSTEM_RECORD_TIME_CROSS_CHANNEL_FOOTER,
  )
  return `${lines.join('\n')}\n`
}

export async function buildOnlineChatCrossChannelTimelineRule(params: {
  characterId: string
  conversationKey: string
  /** 本轮 AI 请求真实发起时刻；默认 Date.now() */
  generationTs?: number
}): Promise<string> {
  const cid = params.characterId.trim()
  const ck = params.conversationKey.trim()
  if (!cid || !ck) return ''
  let lastOfflineAiPlotTs: number | null = null
  try {
    const { resolveOfflineDatingArchiveContext } = await import('./dating/offlineDatingArchiveResolve')
    const { loadDatingPlotsFromKv } = await import('./unifiedMemoryAutoSummary')
    const ctx = await resolveOfflineDatingArchiveContext(cid)
    if (ctx) {
      const plots = await loadDatingPlotsFromKv(ctx.archiveCharacterId)
      lastOfflineAiPlotTs = resolveLastOfflineAiPlotTimestampMs(plots)
    }
  } catch {
    lastOfflineAiPlotTs = null
  }
  const bounds = await resolveOnlineMessageTimeBoundsForConversation({
    conversationKey: ck,
    minMessageTimestamp: null,
  })
  if (!lastOfflineAiPlotTs && bounds.count === 0) return ''
  const snap = buildCrossChannelTimelineSnapshot({
    lastOfflineAiPlotTs,
    onlineInjectMinTs: bounds.minTs,
    onlineInjectMaxTs: bounds.maxTs,
    generationTs: params.generationTs ?? Date.now(),
  })
  return buildOnlineChatGenerationTimelineRule(snap)
}
