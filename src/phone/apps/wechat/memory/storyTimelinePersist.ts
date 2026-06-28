import { personaDb } from '../newFriendsPersona/idb'
import type { PlotItem } from '../dating/types'
import { getAiPlotActiveTimelineDelta } from '../dating/plotTimelineDelta'
import { recallStoryTimelineRowsByVector } from './storyTimelineRowRecall'
import {
  buildStoryTimelinePlotRowFromDelta,
  formatStoryTimelineDeltaForDisplay,
  formatStoryTimelineInjectBody,
  hasTimelineDeltaContent,
  mergeStoryTimelineState,
  STORY_TIMELINE_INJECT_RECENT_ROWS,
  type StoryTimelineEventScope,
  type StoryTimelinePromptLoadOpts,
  type StoryTimelineSummaryDelta,
} from './storyTimelineTypes'

/** 将 timeline 增量合并进当前状态，并 append 一行剧情摘要 */
export async function persistStoryTimelineFromSummaryDelta(
  characterId: string,
  delta: StoryTimelineSummaryDelta | undefined | null,
  scope: StoryTimelineEventScope,
  opts?: {
    plotId?: string | null
    recordedAtMs?: number
  },
): Promise<void> {
  const cid = characterId.trim()
  if (!cid || !delta) return
  const prev = await personaDb.getStoryTimelineState(cid)
  const merged = mergeStoryTimelineState(prev, cid, delta, scope)
  if (!merged) return
  await personaDb.putStoryTimelineState(merged)

  const recordedAt =
    typeof opts?.recordedAtMs === 'number' && Number.isFinite(opts.recordedAtMs)
      ? opts.recordedAtMs
      : merged.updatedAt
  const plotRow =
    buildStoryTimelinePlotRowFromDelta(cid, delta, scope, {
      plotId: opts?.plotId,
      recordedAtMs: recordedAt,
    }) ??
    (() => {
      const rowText = formatStoryTimelineDeltaForDisplay(delta, { recordedAtMs: recordedAt })
      if (!rowText.trim()) return null
      return buildStoryTimelinePlotRowFromDelta(
        cid,
        { ...delta, event_summary: delta.event_summary ?? '（本轮状态更新）' },
        scope,
        { plotId: opts?.plotId, recordedAtMs: recordedAt },
      )
    })()
  if (plotRow) {
    await personaDb.appendStoryTimelinePlotRow(plotRow)
  }
}

/**
 * 按约会 archive 当前选中版本重建剧情 state + plot 行表（每 plot 一行，重新生成覆盖不追加）。
 * 不带 plotId 的 summary 行保留不动。
 */
export async function rebuildStoryTimelineFromDatingPlots(
  characterId: string,
  plots: PlotItem[],
): Promise<void> {
  const cid = characterId.trim()
  if (!cid) return

  let merged: import('./storyTimelineTypes').StoryTimelineState | null = null
  const plotRows: NonNullable<ReturnType<typeof buildStoryTimelinePlotRowFromDelta>>[] = []

  for (const plot of plots) {
    if (plot.type !== 'ai') continue
    const delta = getAiPlotActiveTimelineDelta(plot)
    if (!delta || !hasTimelineDeltaContent(delta)) continue
    merged = mergeStoryTimelineState(merged, cid, delta, 'offline')
    const row = buildStoryTimelinePlotRowFromDelta(cid, delta, 'offline', {
      plotId: plot.id,
      recordedAtMs: plot.timestamp,
    })
    if (row) plotRows.push(row)
  }

  if (!merged && !plotRows.length) return

  await personaDb.deleteStoryTimelinePlotRowsWithPlotIdForCharacter(cid)
  if (merged) await personaDb.putStoryTimelineState(merged)
  for (const row of plotRows) {
    await personaDb.upsertStoryTimelinePlotRow(row)
  }
}

/** 旧 state.recentEvents → 行表（一次性迁移） */
export async function migrateStoryTimelineRecentEventsToRows(characterId: string): Promise<void> {
  const cid = characterId.trim()
  if (!cid) return
  const existing = await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)
  if (existing.length) return
  const state = await personaDb.getStoryTimelineState(cid)
  if (!state?.recentEvents.length) return
  for (const evt of state.recentEvents) {
    const delta: StoryTimelineSummaryDelta = {
      ...(evt.storyDay ? { story_day: evt.storyDay } : {}),
      ...(evt.storyTime ? { story_time: evt.storyTime } : {}),
      ...(evt.relativeTime ? { relative_time: evt.relativeTime } : {}),
      ...(evt.location ? { location: evt.location } : {}),
      ...(evt.charactersPresent?.length ? { characters_present: evt.charactersPresent } : {}),
      event_summary: evt.eventSummary,
    }
    const row = buildStoryTimelinePlotRowFromDelta(cid, delta, evt.sourceScope ?? 'offline', {
      recordedAtMs: evt.recordedAt,
    })
    if (row) await personaDb.appendStoryTimelinePlotRow(row)
  }
}

export async function loadStoryTimelinePromptBlock(
  characterId: string,
  opts?: StoryTimelinePromptLoadOpts,
): Promise<string> {
  const cid = characterId.trim()
  if (!cid) return ''

  await migrateStoryTimelineRecentEventsToRows(cid)

  const [state, allRows, memSettings] = await Promise.all([
    personaDb.getStoryTimelineState(cid),
    personaDb.listStoryTimelinePlotRowsByCharacterId(cid),
    personaDb.getMemorySettings(),
  ])

  const recentRows = allRows.slice(-STORY_TIMELINE_INJECT_RECENT_ROWS)
  const excludeIds = new Set(recentRows.map((r) => r.id))

  let vectorRows: Awaited<ReturnType<typeof recallStoryTimelineRowsByVector>> = []
  const apiConfig = opts?.apiConfig ?? null
  const relevanceText = String(opts?.relevanceText ?? '').trim()
  if (relevanceText.length >= 10) {
    vectorRows = await recallStoryTimelineRowsByVector({
      characterId: cid,
      relevanceText,
      excludeRowIds: excludeIds,
      settings: memSettings,
      chatApiConfig: apiConfig,
      conversationKey: opts?.conversationKey,
    })
  }

  const body = formatStoryTimelineInjectBody({ state, recentRows, vectorRows })
  if (!body.trim()) return ''

  const expandedBody = await personaDb.expandStoryTimelineTextForDisplay(cid, body)
  if (!expandedBody.trim()) return ''
  return `\n\n---\n【剧情时间轴】\n${expandedBody}\n`
}
