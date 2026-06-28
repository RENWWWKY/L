import type { MemoryEmbeddingProviderKind } from './memoryEmbeddingProvider'

export type MemoryContextVectorSourceKind = 'private_chat' | 'offline_plot' | 'meet_chat'

/** IndexedDB `memoryContextVectors` 行：已总结记忆 / 剧情时间轴片段向量 */
export type MemoryContextVectorEntry = {
  id: string
  characterId: string
  sourceKind: MemoryContextVectorSourceKind
  /** 私聊 conversationKey 或 plotId / meet 键 */
  sourceKey: string
  text: string
  textHash: string
  embedding: number[]
  embeddingProvider: MemoryEmbeddingProviderKind
  embeddingModelId: string
  messageTimestamp?: number
  updatedAt: number
}

export const MEMORY_CONTEXT_VECTOR_MAX_PER_CHARACTER = 180
export const MEMORY_CONTEXT_VECTOR_INDEX_BATCH = 12
export const MEMORY_CONTEXT_VECTOR_RECALL_TOP_K = 4
export const MEMORY_CONTEXT_VECTOR_MIN_SIM = 0.70
export const MEMORY_CONTEXT_VECTOR_CHUNK_CHAR_TARGET = 680

export function computeContextVectorTextHash(text: string): string {
  const s = String(text ?? '').trim()
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(33, h) ^ s.charCodeAt(i)
  }
  return (h >>> 0).toString(16)
}

export function buildMemoryContextVectorId(params: {
  characterId: string
  sourceKind: MemoryContextVectorSourceKind
  sourceKey: string
  textHash: string
}): string {
  return `${params.characterId}:${params.sourceKind}:${params.sourceKey}:${params.textHash}`
}
