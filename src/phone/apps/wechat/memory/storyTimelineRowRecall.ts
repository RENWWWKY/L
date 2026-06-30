import type { ApiConfig } from '../../api/types'
import type { MemorySettingsRow } from '../newFriendsPersona/types'
import { personaDb } from '../newFriendsPersona/idb'
import { fetchEmbeddingVectorUnified, fetchEmbeddingVectorsUnified } from './memoryEmbeddingProvider'
import {
  mergeStoryTimelineVectorRecallHits,
  resolveStoryTimelineRowRecallScore,
  buildStoryTimelineRecallQuerySlices,
  computeStoryTimelineRowTextHash,
  resolveStoryTimelineRowVectorEmbedText,
  scoreStoryTimelineRowQueryLexicalOverlap,
  type StoryTimelinePlotRow,
  type StoryTimelineRowRecallScore,
  type StoryTimelineVectorRecallHit,
} from './storyTimelineTypes'
import { cosineSimilarity, isMemoryVectorRecallEnabled } from './memoryVectorRecall'
import { filterSummarizedStoryTimelineRows } from './summarizedStoryTimelineRowFilter'

const ROW_EMBED_BATCH = 8
const ROW_EMBED_CAP_PER_CALL = 48
const ROW_EMBED_MAX_ROUNDS = 8

function rowEmbeddingMissing(row: StoryTimelinePlotRow): boolean {
  return !Array.isArray(row.embedding) || !row.embedding.length
}

function rowNeedsReembed(
  row: StoryTimelinePlotRow,
  queryDim: number,
  provider?: string,
): boolean {
  const embedText = resolveStoryTimelineRowVectorEmbedText(row)
  if (!embedText.trim()) return false
  const h = computeStoryTimelineRowTextHash(embedText)
  if (row.embeddingHash !== h) return true
  const emb = row.embedding
  if (!Array.isArray(emb) || emb.length !== queryDim) return true
  if (provider && row.embeddingProvider && row.embeddingProvider !== provider) return true
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
    .filter(
      (r) => rowNeedsReembed(r, params.queryDim, params.provider) || rowEmbeddingMissing(r),
    )
    .sort(
      (a, b) =>
        (rowEmbeddingMissing(b) ? 1 : 0) - (rowEmbeddingMissing(a) ? 1 : 0) ||
        a.recordedAt - b.recordedAt,
    )
    .slice(0, ROW_EMBED_CAP_PER_CALL)
  if (!stale.length) return

  for (let i = 0; i < stale.length; i += ROW_EMBED_BATCH) {
    const chunk = stale.slice(i, i + ROW_EMBED_BATCH)
    for (const row of chunk) {
      try {
        const embedText = resolveStoryTimelineRowVectorEmbedText(row)
        const hit = await fetchEmbeddingVectorUnified(params.settings, params.chatApiConfig, embedText)
        if (!hit?.vec.length || hit.vec.length !== params.queryDim) continue
        const embedHash = computeStoryTimelineRowTextHash(embedText)
        await personaDb.upsertStoryTimelinePlotRow({
          ...row,
          embeddingHash: embedHash,
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
  /** 用户输入 + 近期剧情焦点 */
  recallQueryFocus?: string
  /** 仅用户当轮输入 */
  recallQueryUserText?: string
  excludeRowIds: Set<string>
  settings: MemorySettingsRow
  chatApiConfig: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null
  conversationKey?: string | null
}): Promise<StoryTimelineVectorRecallHit[]> {
  const cid = params.characterId.trim()
  if (!cid) return []
  if (!isMemoryVectorRecallEnabled(params.settings, { apiConfig: params.chatApiConfig })) return []

  const hay = String(params.relevanceText ?? '').trim()
  const focus = String(params.recallQueryFocus ?? '').trim()
  const userText = String(params.recallQueryUserText ?? '').trim()
  if (hay.length < 10 && focus.length < 10 && userText.length < 4) return []

  const querySlices = buildStoryTimelineRecallQuerySlices(hay, {
    focus: focus || undefined,
    userText: userText || undefined,
  })
  const lexicalHay = [userText, focus, hay].filter(Boolean).join('\n')

  let queryVecs: Awaited<ReturnType<typeof fetchEmbeddingVectorsUnified>> = []
  try {
    queryVecs = await fetchEmbeddingVectorsUnified(params.settings, params.chatApiConfig, querySlices)
  } catch {
    queryVecs = []
  }
  const refQuery = queryVecs[0] ?? null

  try {
    let rows = await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)
    rows = await filterSummarizedStoryTimelineRows(cid, rows, {
      conversationKey: params.conversationKey,
    })
    const candidateIds = new Set(rows.map((r) => r.id))
    if (!candidateIds.size) return []

    if (refQuery?.vec.length) {
      for (let round = 0; round < ROW_EMBED_MAX_ROUNDS; round++) {
        const batchRows = (await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)).filter((r) =>
          candidateIds.has(r.id),
        )
        const staleCount = batchRows.filter(
          (r) =>
            rowEmbeddingMissing(r) ||
            rowNeedsReembed(r, refQuery.vec.length, refQuery.provider),
        ).length
        if (!staleCount) break
        await backfillStoryTimelineRowEmbeddingsBestEffort({
          characterId: cid,
          rows: batchRows,
          settings: params.settings,
          chatApiConfig: params.chatApiConfig,
          queryDim: refQuery.vec.length,
          provider: refQuery.provider,
          modelId: refQuery.modelId,
        })
      }
    }

    const fresh = await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)
    const scored: StoryTimelineRowRecallScore[] = []
    for (const row of fresh) {
      if (!candidateIds.has(row.id)) continue
      if (params.excludeRowIds.has(row.id)) continue

      let focusSim = -1
      const emb = row.embedding
      if (emb?.length && queryVecs.length) {
        const sims = queryVecs
          .filter((q) => q.vec.length === emb.length)
          .map((q) => cosineSimilarity(q.vec, emb))
        if (sims.length) focusSim = Math.max(...sims)
      }

      const lexicalSim = scoreStoryTimelineRowQueryLexicalOverlap(row, lexicalHay)
      scored.push({
        row,
        ...resolveStoryTimelineRowRecallScore({ focusSim, lexicalSim }),
      })
    }
    return mergeStoryTimelineVectorRecallHits(scored)
  } catch {
    return []
  }
}
