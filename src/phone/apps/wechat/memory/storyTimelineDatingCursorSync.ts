import { resolveOfflineDatingArchiveContext } from '../dating/offlineDatingArchiveResolve'
import { personaDb } from '../newFriendsPersona/idb'
import type { StoryTimelinePlotRow } from './storyTimelineTypes'

function rowRecordedAtMs(row: StoryTimelinePlotRow): number {
  const ts = row.recordedAt
  return typeof ts === 'number' && Number.isFinite(ts) ? ts : 0
}

/** offline / linked 摘要行中最大的 recordedAt（用于推进约会 plot 游标） */
export function maxOfflineOrLinkedPlotRowRecordedAtMs(rows: StoryTimelinePlotRow[]): number | null {
  let max = 0
  let found = false
  for (const row of rows) {
    const scope = row.sourceScope ?? 'private'
    if (scope !== 'offline' && scope !== 'linked') continue
    const ts = rowRecordedAtMs(row)
    if (ts <= 0) continue
    found = true
    if (ts > max) max = ts
  }
  return found ? max : null
}

/** 将 datingPlotSummaryCursor 推进到 timestampMs（仅向前，不后退） */
export async function advanceDatingPlotSummaryCursorIfNeeded(
  characterId: string,
  timestampMs: number,
): Promise<void> {
  const cid = characterId.trim()
  if (!cid || !Number.isFinite(timestampMs) || timestampMs <= 0) return
  const ts = Math.floor(timestampMs)

  const current = await personaDb.getDatingPlotSummaryCursor(cid)
  if (current == null || ts > current) {
    await personaDb.setDatingPlotSummaryCursor(cid, ts)
  }

  const ctx = await resolveOfflineDatingArchiveContext(cid)
  const archiveId = ctx?.archiveCharacterId?.trim()
  if (archiveId && archiveId !== cid) {
    const archiveCurrent = await personaDb.getDatingPlotSummaryCursor(archiveId)
    if (archiveCurrent == null || ts > archiveCurrent) {
      await personaDb.setDatingPlotSummaryCursor(archiveId, ts)
    }
  }
}

/** 按行表 offline/linked 摘要推进游标（每轮写摘要 / rebuild 后调用） */
export async function syncDatingPlotSummaryCursorFromPlotRows(
  characterId: string,
  rows: StoryTimelinePlotRow[],
): Promise<void> {
  const maxTs = maxOfflineOrLinkedPlotRowRecordedAtMs(rows)
  if (maxTs == null) return
  await advanceDatingPlotSummaryCursorIfNeeded(characterId, maxTs)
}

/**
 * 老存档补救：已有 offline/linked 摘要行但游标未设或落后时，补到最新行时间戳，
 * 使剧情摘要向量召回候选池可用。
 */
export async function ensureDatingPlotSummaryCursorSyncedFromPlotRows(
  characterId: string,
  rows?: StoryTimelinePlotRow[],
): Promise<void> {
  const cid = characterId.trim()
  if (!cid) return
  const list = rows ?? (await personaDb.listStoryTimelinePlotRowsByCharacterId(cid))
  await syncDatingPlotSummaryCursorFromPlotRows(cid, list)
}
