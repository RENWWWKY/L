import { resolveOfflineDatingArchiveContext } from '../dating/offlineDatingArchiveResolve'
import { personaDb } from '../newFriendsPersona/idb'
import type { ApiConfigCore } from '../../api/types'
import type { PlotItem } from '../dating/types'
import { getAiPlotActiveTimelineDelta } from '../dating/plotTimelineDelta'
import {
  buildParallelEventTimelineRowsForPlot,
  parallelEventMainPlotSummaryFootnote,
} from './storyTimelineParallelFanOut'
import {
  advanceDatingPlotSummaryCursorIfNeeded,
  ensureDatingPlotSummaryCursorSyncedFromPlotRows,
  syncDatingPlotSummaryCursorFromPlotRows,
} from './storyTimelineDatingCursorSync'
import { recallStoryTimelineRowsByVector } from './storyTimelineRowRecall'
import { MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS } from './memorySummaryRetention'
import {
  buildStoryTimelinePlotRowFromDelta,
  buildStoryTimelineMainCharPresenceOpts,
  createEmptyStoryTimelineState,
  enforceStoryTimelineDeltaChronology,
  formatStoryTimelineDeltaForDisplay,
  formatStoryTimelineInjectBody,
  formatStoryTimelineOpenAnchorsForSummaryPrompt,
  hasTimelineDeltaContent,
  mergeStoryTimelineState,
  parseStoryCalendarDayStartMs,
  resolveStoryTimelineCurrentCalendarMs,
  selectStoryTimelineRecentInjectRows,
  STORY_TIMELINE_EVENT_SUMMARY_MAX,
  type StoryTimelineEventScope,
  type StoryTimelineMainCharPresenceOpts,
  type StoryTimelinePromptLoadOpts,
  type StoryTimelineSummaryDelta,
} from './storyTimelineTypes'

async function loadStoryTimelineMainCharPresence(characterId: string): Promise<StoryTimelineMainCharPresenceOpts> {
  const cid = characterId.trim()
  if (!cid) return {}
  const ch = await personaDb.getCharacter(cid)
  return buildStoryTimelineMainCharPresenceOpts(cid, ch)
}

/** 将 timeline 增量合并进当前状态，并 append 一行剧情摘要 */
export async function persistStoryTimelineFromSummaryDelta(
  characterId: string,
  delta: StoryTimelineSummaryDelta | undefined | null,
  scope: StoryTimelineEventScope,
  opts?: {
    plotId?: string | null
    recordedAtMs?: number
    /** 私聊/群聊会话键：用于把剧情时间回写到近期消息 */
    conversationKey?: string | null
  },
): Promise<void> {
  const cid = characterId.trim()
  if (!cid || !delta) return
  const prev = await personaDb.getStoryTimelineState(cid)
  const floorMs =
    prev?.currentStoryDay?.trim()
      ? parseStoryCalendarDayStartMs(prev.currentStoryDay.trim())
      : null
  const enforcedDelta = enforceStoryTimelineDeltaChronology(delta, floorMs)
  const merged = mergeStoryTimelineState(prev, cid, enforcedDelta, scope)
  if (!merged) return
  await personaDb.putStoryTimelineState(merged)

  const recordedAt =
    typeof opts?.recordedAtMs === 'number' && Number.isFinite(opts.recordedAtMs)
      ? opts.recordedAtMs
      : merged.updatedAt
  const mainCharPresence = await loadStoryTimelineMainCharPresence(cid)
  const plotRow =
    buildStoryTimelinePlotRowFromDelta(cid, enforcedDelta, scope, {
      plotId: opts?.plotId,
      recordedAtMs: recordedAt,
      mainCharPresence,
    }) ??
    (() => {
      const rowText = formatStoryTimelineDeltaForDisplay(enforcedDelta, { recordedAtMs: recordedAt })
      if (!rowText.trim()) return null
      return buildStoryTimelinePlotRowFromDelta(
        cid,
        { ...enforcedDelta, event_summary: enforcedDelta.event_summary ?? '（本轮状态更新）' },
        scope,
        { plotId: opts?.plotId, recordedAtMs: recordedAt, mainCharPresence },
      )
    })()
  if (plotRow) {
    const plotId = opts?.plotId?.trim()
    // 同 plotId 若用户已手改摘要：本轮自动写入勿盖掉（重建路径也会保留 userEdited）
    if (plotId) {
      const existing = (await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)).find(
        (r) => r.plotId?.trim() === plotId && r.userEdited === true,
      )
      if (existing) {
        if (scope === 'offline' || scope === 'linked') {
          await advanceDatingPlotSummaryCursorIfNeeded(cid, plotRow.recordedAt)
        }
        return
      }
    }
    await personaDb.appendStoryTimelinePlotRow(plotRow)
    if (scope === 'offline' || scope === 'linked') {
      await advanceDatingPlotSummaryCursorIfNeeded(cid, plotRow.recordedAt)
    }
  }

  // 私聊/群聊：把本轮剧情时间回写到会话近期消息（系统落库时间保持不变）
  if ((scope === 'private' || scope === 'group') && opts?.conversationKey?.trim()) {
    try {
      const { stampConversationMessagesWithStoryTime } = await import('./stampChatMessagesStoryTime')
      await stampConversationMessagesWithStoryTime({
        conversationKey: opts.conversationKey.trim(),
        delta: enforcedDelta,
      })
    } catch {
      /* ignore */
    }
  }
}

/**
 * 按约会 archive 当前选中版本重建剧情 state + plot 行表（每 plot 一行，重新生成覆盖不追加）。
 * 不带 plotId 的 summary 行保留不动。
 * 用户在档案馆手动改过的行（userEdited）按 plotId 保留正文，不被 timelineDelta 盖回。
 */
export async function rebuildStoryTimelineFromDatingPlots(
  characterId: string,
  plots: PlotItem[],
  opts?: {
    apiConfig?: ApiConfigCore | null
  },
): Promise<{ parallelSummaryPlotIds: string[] }> {
  const cid = characterId.trim()
  if (!cid) return { parallelSummaryPlotIds: [] }

  const prevState = await personaDb.getStoryTimelineState(cid)
  const mainCharPresence = await loadStoryTimelineMainCharPresence(cid)
  const existingRows = await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)
  const userEditedByPlotId = new Map<string, (typeof existingRows)[number]>()
  for (const r of existingRows) {
    const pid = r.plotId?.trim()
    if (pid && r.userEdited === true) userEditedByPlotId.set(pid, r)
  }

  let merged: import('./storyTimelineTypes').StoryTimelineState | null = null
  const plotRows: NonNullable<ReturnType<typeof buildStoryTimelinePlotRowFromDelta>>[] = []
  const parallelSummaryPlotIds: string[] = []

  for (const plot of plots) {
    if (plot.type !== 'ai') continue
    let delta = getAiPlotActiveTimelineDelta(plot)
    if (plot.parallelEvent?.content?.trim() && delta && hasTimelineDeltaContent(delta)) {
      const foot = parallelEventMainPlotSummaryFootnote()
      const base = String(delta.event_summary ?? '').trim()
      delta = {
        ...delta,
        event_summary: `${base ? `${base}\n` : ''}${foot}`
          .trim()
          .slice(0, STORY_TIMELINE_EVENT_SUMMARY_MAX),
      }
    }
    if (delta && hasTimelineDeltaContent(delta)) {
      merged = mergeStoryTimelineState(merged, cid, delta, 'offline')
      const row = buildStoryTimelinePlotRowFromDelta(cid, delta, 'offline', {
        plotId: plot.id,
        recordedAtMs: plot.timestamp,
        mainCharPresence,
      })
      if (row) plotRows.push(row)
    }
    if (plot.parallelEvent?.content?.trim()) {
      const parallelRows = await buildParallelEventTimelineRowsForPlot(cid, plot, {
        apiConfig: opts?.apiConfig ?? null,
      })
      if (parallelRows.length) parallelSummaryPlotIds.push(plot.id)
      plotRows.push(...parallelRows)
    }
  }

  if (!merged && !plotRows.length) {
    // 剩余剧情无可用 delta（如重生首段 AI）：清空 plot 绑定行与世界锚点
    await personaDb.deleteStoryTimelinePlotRowsWithPlotIdForCharacter(cid)
    if (prevState) {
      await personaDb.putStoryTimelineState({
        ...createEmptyStoryTimelineState(cid),
        todos: [],
        ...(prevState?.manualAnchorBlock?.trim()
          ? { manualAnchorBlock: prevState.manualAnchorBlock }
          : {}),
      })
    }
    const allRowsEmpty = await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)
    await syncDatingPlotSummaryCursorFromPlotRows(cid, allRowsEmpty)
    return { parallelSummaryPlotIds: [] }
  }

  await personaDb.deleteStoryTimelinePlotRowsWithPlotIdForCharacter(cid)
  if (merged) {
    await personaDb.putStoryTimelineState({
      ...merged,
      todos: [],
      ...(prevState?.manualAnchorBlock?.trim()
        ? { manualAnchorBlock: prevState.manualAnchorBlock }
        : {}),
    })
  }
  for (const row of plotRows) {
    const pid = row.plotId?.trim()
    const locked = pid ? userEditedByPlotId.get(pid) : undefined
    if (locked) {
      await personaDb.upsertStoryTimelinePlotRow({
        ...locked,
        recordedAt: row.recordedAt,
        sourceScope: locked.sourceScope || row.sourceScope,
        userEdited: true,
      })
    } else {
      await personaDb.upsertStoryTimelinePlotRow(row)
    }
  }
  const allRows = await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)
  await syncDatingPlotSummaryCursorFromPlotRows(cid, allRows)
  return { parallelSummaryPlotIds }
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
  const migrated = await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)
  await syncDatingPlotSummaryCursorFromPlotRows(cid, migrated)
}

export async function loadStoryTimelinePromptBlock(
  characterId: string,
  opts?: StoryTimelinePromptLoadOpts,
): Promise<string> {
  const cid = characterId.trim()
  if (!cid) return ''

  await migrateStoryTimelineRecentEventsToRows(cid)

  const allRows = await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)
  await ensureDatingPlotSummaryCursorSyncedFromPlotRows(cid, allRows)

  const [state, memSettings, archCtx] = await Promise.all([
    personaDb.getStoryTimelineState(cid),
    personaDb.getMemorySettings(),
    resolveOfflineDatingArchiveContext(cid),
  ])
  const archiveId = archCtx?.archiveCharacterId?.trim() || cid
  const [datingPlotCursorMain, datingPlotCursorArchive] = await Promise.all([
    personaDb.getDatingPlotSummaryCursor(cid),
    archiveId !== cid ? personaDb.getDatingPlotSummaryCursor(archiveId) : Promise.resolve(null),
  ])
  const datingPlotCursor = Math.max(datingPlotCursorMain ?? 0, datingPlotCursorArchive ?? 0) || null

  const recentRows = selectStoryTimelineRecentInjectRows(allRows, {
    datingPlotCursor,
    skipUnsummarizedOfflineAiRounds: MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS,
  })
  const excludeIds = new Set(recentRows.map((r) => r.id))

  const currentStoryCalendarMs = resolveStoryTimelineCurrentCalendarMs({
    state,
    rows: allRows,
    storyCalendarAnchor: opts?.storyCalendarAnchor,
  })

  let vectorRows: Awaited<ReturnType<typeof recallStoryTimelineRowsByVector>> = []
  const apiConfig = opts?.apiConfig ?? null
  const relevanceText = String(opts?.relevanceText ?? '').trim()
  if (relevanceText.length >= 10) {
    vectorRows = await recallStoryTimelineRowsByVector({
      characterId: cid,
      relevanceText,
      recallQueryFocus: String(opts?.recallQueryFocus ?? '').trim() || undefined,
      recallQueryUserText: String(opts?.recallQueryUserText ?? '').trim() || undefined,
      excludeRowIds: excludeIds,
      currentStoryCalendarMs,
      settings: memSettings,
      chatApiConfig: apiConfig,
      conversationKey: opts?.conversationKey,
    })
  }

  const body = formatStoryTimelineInjectBody({
    state,
    recentRows,
    vectorRows,
    currentStoryCalendarMs,
    rowInjectOpts: {
      redactSidePerspectiveForMainChar: true,
      mainCharPresence: await loadStoryTimelineMainCharPresence(cid),
    },
  })
  if (!body.trim()) return ''

  const expandedBody = await personaDb.expandStoryTimelineTextForDisplay(cid, body)
  if (!expandedBody.trim()) return ''
  return `\n\n---\n【剧情时间轴】\n${expandedBody}\n`
}

/** 摘要补救 / 自动总结：加载未收动机伏笔清单 */
export async function loadStoryTimelineOpenAnchorsBlockForSummary(
  characterId: string,
): Promise<string> {
  const cid = characterId.trim()
  if (!cid) return ''
  const state = await personaDb.getStoryTimelineState(cid)
  return formatStoryTimelineOpenAnchorsForSummaryPrompt(state)
}
