import { getAiPlotActiveTimelineDelta } from '../dating/plotTimelineDelta'
import type { PlotItem } from '../dating/types'
import { personaDb } from '../newFriendsPersona/idb'
import {
  applyStoryTimelineTodoLedgerFromRoundSummary,
  cloneStoryTimelineTodos,
  createEmptyStoryTimelineState,
  type StoryTimelineSummaryDelta,
  type StoryTimelineTodoEntry,
} from './storyTimelineTypes'

function storyDayFromDelta(delta: StoryTimelineSummaryDelta | null | undefined): string | undefined {
  return delta?.story_day_end?.trim() || delta?.story_day?.trim() || undefined
}

function applyDeltaToTodos(
  todos: StoryTimelineTodoEntry[],
  delta: StoryTimelineSummaryDelta | null | undefined,
): StoryTimelineTodoEntry[] {
  const summary = delta?.event_summary?.trim() || ''
  if (!summary) return todos
  return applyStoryTimelineTodoLedgerFromRoundSummary(todos, summary, storyDayFromDelta(delta))
}

/** 读取当前台账快照，挂到本段 AI 剧情上供删除/重生回退 */
export async function snapshotStoryTimelineTodoLedgerBefore(
  characterId: string,
): Promise<StoryTimelineTodoEntry[]> {
  const cid = characterId.trim()
  if (!cid) return []
  const prev = await personaDb.getStoryTimelineState(cid)
  return cloneStoryTimelineTodos(prev?.todos)
}

/**
 * 删除若干 AI 剧情后：回退到最早被删段的 todoLedgerBefore，再按剩余后续段摘要重放。
 * 无快照的旧档则保留 fallback（不回放历史）。
 */
export function computeStoryTimelineTodosAfterRemovingPlots(
  prevPlots: readonly PlotItem[],
  nextPlots: readonly PlotItem[],
  fallbackTodos: StoryTimelineTodoEntry[],
): StoryTimelineTodoEntry[] {
  const nextIds = new Set(nextPlots.map((p) => p.id))
  const deletedAi = prevPlots
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.type === 'ai' && !nextIds.has(p.id))
  if (!deletedAi.length) return cloneStoryTimelineTodos(fallbackTodos)

  const earliest = deletedAi.reduce((a, b) => (a.i <= b.i ? a : b))
  const hasBefore = Array.isArray(earliest.p.todoLedgerBefore)
  if (!hasBefore) return cloneStoryTimelineTodos(fallbackTodos)

  let todos = cloneStoryTimelineTodos(earliest.p.todoLedgerBefore)
  for (let i = earliest.i + 1; i < prevPlots.length; i++) {
    const p = prevPlots[i]!
    if (p.type !== 'ai' || !nextIds.has(p.id)) continue
    todos = applyDeltaToTodos(todos, getAiPlotActiveTimelineDelta(p))
  }
  return todos
}

/**
 * 重新生成某段之前：回退到该段 todoLedgerBefore（无快照则不动）。
 */
export function resolveStoryTimelineTodosBeforeRegeneratingPlot(
  plot: PlotItem,
  fallbackTodos: StoryTimelineTodoEntry[],
): StoryTimelineTodoEntry[] | undefined {
  if (!Array.isArray(plot.todoLedgerBefore)) return undefined
  return cloneStoryTimelineTodos(plot.todoLedgerBefore ?? fallbackTodos)
}

/**
 * 本轮线下新摘要：只根据该段 active timeline delta 更新待办（不回放历史）。
 * 若提供 afterPlots，则在本段之后还有未改动的后续段时，按它们的摘要接着重放。
 */
export async function applyStoryTimelineTodoLedgerFromOfflineRound(params: {
  characterId: string
  /** 本轮新生成/重生的 AI 剧情 */
  roundPlot: PlotItem | null | undefined
  /** 该段之后仍保留的剧情（重生中间段时需要） */
  afterPlots?: readonly PlotItem[] | null
}): Promise<boolean> {
  const cid = params.characterId.trim()
  const roundPlot = params.roundPlot
  if (!cid || !roundPlot || roundPlot.type !== 'ai') return false

  const prev = (await personaDb.getStoryTimelineState(cid)) ?? createEmptyStoryTimelineState(cid)
  let todos = cloneStoryTimelineTodos(prev.todos)
  const beforeSig = JSON.stringify(todos)

  todos = applyDeltaToTodos(todos, getAiPlotActiveTimelineDelta(roundPlot))
  for (const p of params.afterPlots ?? []) {
    if (p.type !== 'ai') continue
    todos = applyDeltaToTodos(todos, getAiPlotActiveTimelineDelta(p))
  }

  if (JSON.stringify(todos) === beforeSig) return false
  await personaDb.putStoryTimelineState({
    ...prev,
    characterId: cid,
    todos,
    updatedAt: Date.now(),
  })
  return true
}
