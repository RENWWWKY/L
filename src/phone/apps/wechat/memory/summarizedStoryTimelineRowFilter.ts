import { personaDb } from '../newFriendsPersona/idb'
import type { StoryTimelineEventScope, StoryTimelinePlotRow } from './storyTimelineTypes'

function rowRecordedAtMs(row: StoryTimelinePlotRow): number {
  const ts = row.recordedAt
  return typeof ts === 'number' && Number.isFinite(ts) ? ts : 0
}

function isRowSummarizedForRecall(
  row: StoryTimelinePlotRow,
  cursors: {
    datingPlot: number | null
    meet: number | null
    memoryConversation: number | null
  },
): boolean {
  const ts = rowRecordedAtMs(row)
  if (ts <= 0) return false
  const scope: StoryTimelineEventScope = row.sourceScope ?? 'private'

  if (scope === 'offline' || scope === 'linked') {
    if (cursors.datingPlot == null) return false
    return ts <= cursors.datingPlot
  }
  if (scope === 'meet') {
    if (cursors.meet == null) return false
    return ts <= cursors.meet
  }
  if (cursors.memoryConversation == null) return false
  return ts <= cursors.memoryConversation
}

/** 游标后未总结剧情/聊天对应的行表条目，不得进入「已总结片段」语义召回 */
export async function filterSummarizedStoryTimelineRows(
  characterId: string,
  rows: StoryTimelinePlotRow[],
  opts?: { conversationKey?: string | null },
): Promise<StoryTimelinePlotRow[]> {
  if (!rows.length) return []
  const cid = characterId.trim()
  if (!cid) return []

  const ck = opts?.conversationKey?.trim()
  const [datingPlot, meet, memoryConversation] = await Promise.all([
    personaDb.getDatingPlotSummaryCursor(cid),
    personaDb.getMeetSummaryCursorTimestamp(cid),
    ck ? personaDb.getMemorySummaryCursorTimestamp(ck) : null,
  ])

  const cursors = { datingPlot, meet, memoryConversation }
  return rows.filter((row) => isRowSummarizedForRecall(row, cursors))
}
