import { resolveOfflineDatingArchiveContext } from '../dating/offlineDatingArchiveResolve'
import { personaDb } from '../newFriendsPersona/idb'
import {
  ensureDatingPlotSummaryCursorSyncedFromPlotRows,
  maxOfflineOrLinkedPlotRowRecordedAtMs,
} from './storyTimelineDatingCursorSync'
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
    // 每轮写摘要模式：行表有 recordedAt 即视为已总结；游标 null 时不应整池清空
    if (cursors.datingPlot == null) return ts > 0
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

  await ensureDatingPlotSummaryCursorSyncedFromPlotRows(cid, rows)

  const ck = opts?.conversationKey?.trim()
  const archCtx = await resolveOfflineDatingArchiveContext(cid)
  const archiveId = archCtx?.archiveCharacterId?.trim() || cid
  const [datingPlotMain, datingPlotArchive, meet, memoryConversation] = await Promise.all([
    personaDb.getDatingPlotSummaryCursor(cid),
    archiveId !== cid ? personaDb.getDatingPlotSummaryCursor(archiveId) : Promise.resolve(null),
    personaDb.getMeetSummaryCursorTimestamp(cid),
    ck ? personaDb.getMemorySummaryCursorTimestamp(ck) : null,
  ])
  let datingPlot =
    Math.max(datingPlotMain ?? 0, datingPlotArchive ?? 0, maxOfflineOrLinkedPlotRowRecordedAtMs(rows) ?? 0) ||
    null

  const cursors = { datingPlot, meet, memoryConversation }
  return rows.filter((row) => isRowSummarizedForRecall(row, cursors))
}
