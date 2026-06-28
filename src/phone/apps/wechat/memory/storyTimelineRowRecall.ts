import type { ApiConfig } from '../../api/types'
import type { MemorySettingsRow } from '../newFriendsPersona/types'
import { personaDb } from '../newFriendsPersona/idb'
import { fetchEmbeddingVectorUnified } from './memoryEmbeddingProvider'
import {
  STORY_TIMELINE_ROW_VECTOR_MIN_SIM,
  STORY_TIMELINE_VECTOR_RECALL_TOP_K,
  computeStoryTimelineRowTextHash,
  type StoryTimelinePlotRow,
  type StoryTimelineVectorRecallHit,
} from './storyTimelineTypes'
import { cosineSimilarity, isMemoryVectorRecallEnabled } from './memoryVectorRecall'
import { filterSummarizedStoryTimelineRows } from './summarizedStoryTimelineRowFilter'

const ROW_EMBED_BATCH = 8
const ROW_EMBED_CAP_PER_CALL = 16

function rowNeedsReembed(row: StoryTimelinePlotRow, queryDim: number): boolean {
  if (!row.rowText.trim()) return false
  const h = computeStoryTimelineRowTextHash(row.rowText)
  if (row.textHash !== h) return true
  const emb = row.embedding
  if (!Array.isArray(emb) || emb.length !== queryDim) return true
  return false
}

/** 为缺失向量的剧情摘要行补算 embedding 并写回 */
export async function backfillStoryTimelineRowEmbeddingsBestEffort(params: {
  characterId: string
  rows: StoryTimelinePlotRow[]
  settings: MemorySettingsRow
  chatApiConfig: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null
  queryDim: number
  provider: string
  modelId: string
}): Promise<void> {
  const stale = params.rows
    .filter((r) => rowNeedsReembed(r, params.queryDim))
    .slice(0, ROW_EMBED_CAP_PER_CALL)
  if (!stale.length) return

  for (let i = 0; i < stale.length; i += ROW_EMBED_BATCH) {
    const chunk = stale.slice(i, i + ROW_EMBED_BATCH)
    for (const row of chunk) {
      try {
        const hit = await fetchEmbeddingVectorUnified(params.settings, params.chatApiConfig, row.rowText)
        if (!hit?.vec.length || hit.vec.length !== params.queryDim) continue
        await personaDb.upsertStoryTimelinePlotRow({
          ...row,
          textHash: computeStoryTimelineRowTextHash(row.rowText),
          embedding: hit.vec,
          embeddingProvider: hit.provider,
          embeddingModelId: hit.modelId,
        })
      } catch {
        /* skip row */
      }
    }
  }
}

/** 从剧情摘要行表语义召回（排除已在近端注入的行；仅游标已覆盖的已总结行） */
export async function recallStoryTimelineRowsByVector(params: {
  characterId: string
  relevanceText: string
  excludeRowIds: Set<string>
  settings: MemorySettingsRow
  chatApiConfig: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null
  conversationKey?: string | null
}): Promise<StoryTimelineVectorRecallHit[]> {
  const cid = params.characterId.trim()
  if (!cid) return []
  if (params.settings.memoryContextVectorRecallEnabled === false) return []
  if (!isMemoryVectorRecallEnabled(params.settings, { apiConfig: params.chatApiConfig })) return []

  const hay = String(params.relevanceText ?? '').trim()
  if (hay.length < 10) return []

  try {
    const query = await fetchEmbeddingVectorUnified(params.settings, params.chatApiConfig, hay)
    if (!query?.vec.length) return []

    let rows = await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)
    rows = await filterSummarizedStoryTimelineRows(cid, rows, {
      conversationKey: params.conversationKey,
    })
    await backfillStoryTimelineRowEmbeddingsBestEffort({
      characterId: cid,
      rows,
      settings: params.settings,
      chatApiConfig: params.chatApiConfig,
      queryDim: query.vec.length,
      provider: query.provider,
      modelId: query.modelId,
    })

    rows = await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)
    const scored: { row: StoryTimelinePlotRow; sim: number }[] = []
    for (const row of rows) {
      if (params.excludeRowIds.has(row.id)) continue
      if (row.embeddingProvider && row.embeddingProvider !== query.provider) continue
      const emb = row.embedding
      if (!Array.isArray(emb) || emb.length !== query.vec.length) continue
      const sim = cosineSimilarity(query.vec, emb)
      if (sim >= STORY_TIMELINE_ROW_VECTOR_MIN_SIM) scored.push({ row, sim })
    }
    scored.sort((a, b) => b.sim - a.sim)
    return scored.slice(0, STORY_TIMELINE_VECTOR_RECALL_TOP_K).map((x) => ({ row: x.row, sim: x.sim }))
  } catch {
    return []
  }
}
