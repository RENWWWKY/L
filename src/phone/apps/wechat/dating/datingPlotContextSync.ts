import type { ApiConfigCore } from '../../api/types'
import type { DatingPlotSnapshotItem } from '../unifiedMemoryAutoSummary'
import { rebuildStoryTimelineFromDatingPlots } from '../memory/storyTimelinePersist'
import { computeStoryTimelineTodosAfterRemovingPlots } from '../memory/storyTimelineOfflineTodoLedger'
import { personaDb } from '../newFriendsPersona/idb'
import { rebuildWorldBookAfterFromDatingPlotList } from '../newFriendsPersona/worldBookAfterPatch'
import type { PlotItem } from './types'
import { resolveOfflineDatingArchiveContext } from './offlineDatingArchiveResolve'

/** 删除/回滚 plot 时用于清理关联记忆的 owner id 集合。 */
export async function resolveDatingPlotLinkedOwnerIds(characterId: string): Promise<string[]> {
  const cid = characterId.trim()
  if (!cid) return []
  try {
    const ctx = await resolveOfflineDatingArchiveContext(cid)
    if (!ctx) return [cid]
    return [...new Set([ctx.perspectiveCharacterId, ctx.archiveCharacterId].map((x) => x.trim()).filter(Boolean))]
  } catch {
    return [cid]
  }
}

/** 线下 plot 增删改后：清掉该角色视角下已索引的 offline_plot 向量，避免语义召回捞到已删旧稿。 */
export async function clearOfflinePlotContextVectorsForCharacter(characterId: string): Promise<void> {
  const cid = characterId.trim()
  if (!cid) return
  await personaDb.deleteMemoryContextVectorsBySourceKind(cid, 'offline_plot')
}

/** 删除 AI 剧情气泡时：清关联记忆（按 plot id）。 */
export async function clearLinkedMemoriesForDeletedDatingPlots(params: {
  linkedFromCharacterIds: readonly string[]
  deletedAiPlotIds: readonly string[]
}): Promise<void> {
  const owners = params.linkedFromCharacterIds.map((x) => x.trim()).filter(Boolean)
  const ids = params.deletedAiPlotIds.map((x) => x.trim()).filter(Boolean)
  if (!owners.length || !ids.length) return
  for (const plotId of ids) {
    await personaDb.deleteAutoLinkedMemoriesForDatingRoundMulti(owners, plotId)
  }
}

export function collectDeletedAiPlotIds(
  prevPlots: ReadonlyArray<{ id?: string; type?: string }>,
  nextPlots: ReadonlyArray<{ id?: string; type?: string }>,
): string[] {
  const nextIds = new Set(nextPlots.map((p) => p.id?.trim()).filter(Boolean))
  const out: string[] = []
  for (const p of prevPlots) {
    if (p.type !== 'ai') continue
    const id = p.id?.trim()
    if (!id) continue
    if (!nextIds.has(id)) out.push(id)
  }
  return out
}

export function collectDeletedPlotItems(prevPlots: ReadonlyArray<PlotItem>, nextPlots: ReadonlyArray<PlotItem>): PlotItem[] {
  const nextIds = new Set(nextPlots.map((p) => p.id?.trim()).filter(Boolean))
  const out: PlotItem[] = []
  for (const p of prevPlots) {
    const id = p.id?.trim()
    if (!id) continue
    if (!nextIds.has(id)) out.push(p)
  }
  return out
}

export type DatingPlotListMutationCleanupParams = {
  perspectiveCharacterId: string
  linkedFromCharacterIds: readonly string[]
  prevPlots: ReadonlyArray<{ id?: string; type?: string }>
  nextPlots: DatingPlotSnapshotItem[] | ReadonlyArray<{ id?: string; type?: string }>
}

/** plot 列表变更后统一清理：offline 向量 + 被删 AI 轮的关联记忆。 */
export async function cleanupDatingPlotListMutation(params: DatingPlotListMutationCleanupParams): Promise<void> {
  await clearOfflinePlotContextVectorsForCharacter(params.perspectiveCharacterId)
  const deletedAiIds = collectDeletedAiPlotIds(params.prevPlots, params.nextPlots)
  if (deletedAiIds.length) {
    await clearLinkedMemoriesForDeletedDatingPlots({
      linkedFromCharacterIds: params.linkedFromCharacterIds,
      deletedAiPlotIds: deletedAiIds,
    })
  }
}

export type DatingPlotListMutationSideEffectsParams = {
  perspectiveCharacterId: string
  linkedFromCharacterIds: readonly string[]
  prevPlots: PlotItem[]
  nextPlots: PlotItem[]
  apiConfig?: ApiConfigCore | null
}

/**
 * 约会剧情列表缩短后：清关联记忆、删被删轮的线下摘要、重建剩余摘要表，并将尾声延展回退到剩余轮次对应快照。
 */
export async function finalizeDatingPlotListMutationSideEffects(
  params: DatingPlotListMutationSideEffectsParams,
): Promise<void> {
  await cleanupDatingPlotListMutation({
    perspectiveCharacterId: params.perspectiveCharacterId,
    linkedFromCharacterIds: params.linkedFromCharacterIds,
    prevPlots: params.prevPlots,
    nextPlots: params.nextPlots,
  })

  const deletedPlots = collectDeletedPlotItems(params.prevPlots, params.nextPlots)
  const deletedAiPlotIds = deletedPlots.filter((p) => p.type === 'ai').map((p) => p.id.trim()).filter(Boolean)

  for (const plotId of deletedAiPlotIds) {
    try {
      await personaDb.deleteStoryTimelinePlotRowsForPlotIdGlobally(plotId)
    } catch (e) {
      console.warn('[dating] delete story timeline rows for removed plot failed', plotId, e)
    }
  }

  const charId = params.perspectiveCharacterId.trim()
  if (charId) {
    try {
      const prevTodos = (await personaDb.getStoryTimelineState(charId))?.todos ?? []
      const todosOverride = computeStoryTimelineTodosAfterRemovingPlots(
        params.prevPlots,
        params.nextPlots,
        prevTodos,
      )
      await rebuildStoryTimelineFromDatingPlots(charId, params.nextPlots, {
        apiConfig: params.apiConfig ?? null,
        todosOverride,
      })
    } catch (e) {
      console.warn('[dating] story timeline rebuild after plot mutation failed', e)
    }

    try {
      const charRow = await personaDb.getCharacter(charId)
      if (charRow) {
        const restored = rebuildWorldBookAfterFromDatingPlotList(
          charRow,
          params.nextPlots,
          deletedPlots,
        )
        if (restored) await personaDb.upsertCharacter(restored)
      }
    } catch (e) {
      console.warn('[dating] epilogue sync after plot mutation failed', e)
    }
  }
}
