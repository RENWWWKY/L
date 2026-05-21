import { formatWeChatChatTimestamp, shouldRenderWeChatTimestamp } from '../wechat/time/wechatTimeUtils'
import type { MeetChatMessage } from './meetTypes'

export type MeetChatTimelineTimeRow = {
  kind: 'time'
  id: string
  text: string
}

export type MeetChatTimelineMessageRow = {
  kind: 'message'
  message: MeetChatMessage
  index: number
}

export type MeetChatTimelineRow = MeetChatTimelineTimeRow | MeetChatTimelineMessageRow

function messageTimestampMs(m: MeetChatMessage, fallbackMs: number): number {
  const t = m.ts
  return typeof t === 'number' && Number.isFinite(t) && t > 0 ? t : fallbackMs
}

/** 与微信 ChatRoom.rebuildChatItemsWithTimestamps 一致：首条必显；相邻消息间隔 ≥5 分钟再显 */
export function buildMeetChatTimelineRows(
  messages: MeetChatMessage[],
  currentTimeMs: number,
): MeetChatTimelineRow[] {
  const formatTimeLabel = (ts: number) => formatWeChatChatTimestamp(ts, currentTimeMs)

  if (messages.length === 0) {
    return [{ kind: 'time', id: `t-empty-${currentTimeMs}`, text: formatTimeLabel(currentTimeMs) }]
  }

  const rows: MeetChatTimelineRow[] = []
  let lastShownTime: number | null = null

  messages.forEach((message, index) => {
    const ts = messageTimestampMs(message, currentTimeMs)
    if (shouldRenderWeChatTimestamp(lastShownTime, ts)) {
      rows.push({
        kind: 'time',
        id: `t-${message.id}-${ts}`,
        text: formatTimeLabel(ts),
      })
      lastShownTime = ts
    }
    rows.push({ kind: 'message', message, index })
  })

  return rows
}
