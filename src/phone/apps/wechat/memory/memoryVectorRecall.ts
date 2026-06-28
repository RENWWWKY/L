import type { CharacterMemory, MemorySettingsRow } from '../newFriendsPersona/types'
import type { ApiConfig } from '../../api/types'
import { DEFAULT_MEMORY_EMBEDDING_MODEL } from './memoryEmbeddingApi'
import {
  fetchEmbeddingVectorUnified,
  fetchEmbeddingVectorsUnified,
  isMemoryEmbeddingAvailable,
} from './memoryEmbeddingProvider'
import { flattenMemoryTriggerKeywords, isMemoryAlwaysTrigger } from './memoryTriggerUtils'

const MAX_EMBED_CHARS = 8000
const STALE_EMBED_CAP_PER_CALL = 28
const EMBEDDING_BATCH = 16

function djb2Hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(33, h) ^ s.charCodeAt(i)
  }
  return (h >>> 0).toString(16)
}

/** 写入向量用的正文（记忆正文 + 触发词） */
export function buildMemoryEmbedText(m: CharacterMemory): string {
  const body = String(m.content ?? '').trim().slice(0, MAX_EMBED_CHARS)
  const kws = flattenMemoryTriggerKeywords(m)
  const tail = kws.length ? `\n【触发词】${kws.join('、')}` : ''
  return `${body}${tail}`.slice(0, MAX_EMBED_CHARS)
}

export function computeMemoryEmbeddingHash(m: CharacterMemory): string {
  return djb2Hash(buildMemoryEmbedText(m))
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return -1
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  if (!Number.isFinite(denom) || denom <= 0) return -1
  return dot / denom
}

function needsReembed(m: CharacterMemory, queryDim: number): boolean {
  const body = String(m.content ?? '').trim()
  if (!body) return false
  const h = computeMemoryEmbeddingHash(m)
  const emb = m.memoryEmbedding
  if (!Array.isArray(emb) || emb.length < 8) return true
  if (emb.length !== queryDim) return true
  if (m.memoryEmbeddingHash !== h) return true
  return false
}

/**
 * 为一批记忆补算 embedding 并写库（每轮上限）。
 */
export async function backfillMemoryEmbeddingsBestEffort(params: {
  memories: CharacterMemory[]
  upsert: (m: CharacterMemory) => Promise<void>
  settings: MemorySettingsRow
  chatApiConfig: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null
  queryDim: number
  embeddingProvider: 'local' | 'api'
  embeddingModelId: string
}): Promise<void> {
  const { memories, upsert, settings, chatApiConfig, queryDim, embeddingProvider, embeddingModelId } = params
  const stale = memories.filter((m) => needsReembed(m, queryDim)).slice(0, STALE_EMBED_CAP_PER_CALL)
  if (!stale.length) return

  for (let i = 0; i < stale.length; i += EMBEDDING_BATCH) {
    const chunk = stale.slice(i, i + EMBEDDING_BATCH)
    const texts = chunk.map((m) => buildMemoryEmbedText(m))
    try {
      const embedded = await fetchEmbeddingVectorsUnified(settings, chatApiConfig, texts)
      const now = Date.now()
      for (let j = 0; j < chunk.length; j++) {
        const m = chunk[j]
        const hit = embedded[j]
        if (!hit?.vec?.length || hit.vec.length !== queryDim) continue
        if (hit.provider !== embeddingProvider && hit.modelId !== embeddingModelId) {
          /* 维度一致即可写入 */
        }
        const hash = computeMemoryEmbeddingHash(m)
        await upsert({
          ...m,
          memoryEmbedding: hit.vec,
          memoryEmbeddingHash: hash,
          updatedAt: now,
        })
      }
    } catch {
      for (const m of chunk) {
        try {
          const hit = await fetchEmbeddingVectorUnified(settings, chatApiConfig, buildMemoryEmbedText(m))
          if (!hit?.vec.length || hit.vec.length !== queryDim) continue
          await upsert({
            ...m,
            memoryEmbedding: hit.vec,
            memoryEmbeddingHash: computeMemoryEmbeddingHash(m),
            updatedAt: Date.now(),
          })
        } catch {
          /* skip */
        }
      }
    }
  }
}

function scoreMemoriesByVectorSimilarity(params: {
  candidates: CharacterMemory[]
  queryVec: number[]
  topK: number
  minSim: number
  excludeIds: Set<string>
}): { m: CharacterMemory; sim: number }[] {
  const { candidates, queryVec, topK, minSim, excludeIds } = params
  const scored: { m: CharacterMemory; sim: number }[] = []
  for (const m of candidates) {
    if (excludeIds.has(m.id)) continue
    if (isMemoryAlwaysTrigger(m)) continue
    const emb = m.memoryEmbedding
    if (!Array.isArray(emb) || emb.length !== queryVec.length) continue
    const sim = cosineSimilarity(queryVec, emb)
    if (sim >= minSim) scored.push({ m, sim })
  }
  scored.sort((a, b) => b.sim - a.sim)
  return scored.slice(0, topK)
}

export function pickMemoriesByVectorSimilarity(params: {
  candidates: CharacterMemory[]
  queryVec: number[]
  topK: number
  minSim: number
  excludeIds: Set<string>
}): CharacterMemory[] {
  return scoreMemoriesByVectorSimilarity(params).map((x) => x.m)
}

/** 与 {@link pickMemoriesByVectorSimilarity} 相同筛选规则，额外返回余弦相似度（供思维溯源等 UI） */
export function pickMemoriesByVectorSimilarityScored(params: {
  candidates: CharacterMemory[]
  queryVec: number[]
  topK: number
  minSim: number
  excludeIds: Set<string>
}): { memory: CharacterMemory; score: number }[] {
  return scoreMemoriesByVectorSimilarity(params).map(({ m, sim }) => ({ memory: m, score: sim }))
}

export type MemoryPromptLineScope = {
  wechatAccountId: string
  sessionPlayerIdentityId: string
}

export type MemoryPromptInjectionBucket = 'own' | 'linked'

export type MemoryVectorRecallOpts = {
  apiConfig: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null
  embeddingModelId?: string
  disableVector?: boolean
  /** 私聊 storage 键（保留兼容；已总结片段召回不再索引游标后原文） */
  conversationKey?: string | null
  /** 多号分线：长期记忆按来源微信线分组注入 */
  lineScope?: MemoryPromptLineScope | null
  /**
   * own：角色私聊自有长期记忆（默认，不含 memoryScope=linked）
   * linked：线下关联记忆（约会总结写入人脉 NPC 的 `[关联线下]` 条目）
   */
  memoryBucket?: MemoryPromptInjectionBucket
}

export function isMemoryVectorRecallEnabled(settings: MemorySettingsRow, opts?: MemoryVectorRecallOpts | null): boolean {
  if (opts?.disableVector) return false
  if (settings.memoryVectorRecallEnabled === false) return false
  return isMemoryEmbeddingAvailable(settings, opts?.apiConfig ?? null)
}

export function resolveMemoryEmbeddingModelId(settings: MemorySettingsRow, opts?: MemoryVectorRecallOpts | null): string {
  const o = opts?.embeddingModelId?.trim()
  if (o) return o
  const s = settings.memoryEmbeddingModelId?.trim()
  if (s) return s
  return DEFAULT_MEMORY_EMBEDDING_MODEL
}

export const MEMORY_VECTOR_TOP_PRIVATE = 5
export const MEMORY_VECTOR_TOP_GROUP = 4
export const MEMORY_VECTOR_MIN_SIM = 0.70

/** 关键词子串命中后的语义确认门槛（query↔记忆向量余弦；向量未就绪时不校验） */
export const MEMORY_KEYWORD_HIT_MIN_SIM = 0.75

export function memoryKeywordHitVectorSim(m: CharacterMemory, queryVec: number[] | null | undefined): number | null {
  if (!queryVec?.length) return null
  const emb = m.memoryEmbedding
  if (!Array.isArray(emb) || emb.length !== queryVec.length) return null
  return cosineSimilarity(queryVec, emb)
}

/** 子串命中候选在向量可用时须达 {@link MEMORY_KEYWORD_HIT_MIN_SIM}，否则剔除 */
export function filterKeywordHitsByVectorConfirm(params: {
  hits: CharacterMemory[]
  queryVec: number[] | null | undefined
  minSim?: number
}): CharacterMemory[] {
  const { hits, queryVec, minSim = MEMORY_KEYWORD_HIT_MIN_SIM } = params
  if (!queryVec?.length) return hits
  return hits.filter((m) => {
    const sim = memoryKeywordHitVectorSim(m, queryVec)
    if (sim == null) return false
    return sim >= minSim
  })
}
