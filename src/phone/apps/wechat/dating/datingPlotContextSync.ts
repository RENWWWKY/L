import type { DatingPlotSnapshotItem } from '../unifiedMemoryAutoSummary'
import { personaDb } from '../newFriendsPersona/idb'
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
