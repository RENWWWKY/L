import { personaDb } from '../newFriendsPersona/idb'
import type { MemoryVectorRecallOpts } from './memoryVectorRecall'

/** 私聊注入：自有长期记忆 + 线下关联记忆分轨拼接（总结入库逻辑不变）。 */
export async function formatCharacterMemoriesForPromptInjection(
  characterId: string,
  relevanceText: string,
  opts?: MemoryVectorRecallOpts | null,
): Promise<string> {
  const cid = characterId.trim()
  if (!cid) return ''
  const [ownMem, linkedMem] = await Promise.all([
    personaDb.formatCharacterMemoriesForPromptByRelevance(cid, relevanceText, {
      ...opts,
      memoryBucket: 'own',
    }),
    personaDb.formatCharacterMemoriesForPromptByRelevance(cid, relevanceText, {
      ...opts,
      memoryBucket: 'linked',
    }),
  ])
  return [ownMem.trim(), linkedMem.trim()].filter(Boolean).join('\n\n')
}

/** 思维溯源：自有 + 关联记忆分轨召回后合并展示 */
export async function getCharacterMemoryRelevanceTraceForPromptInjection(
  characterId: string,
  relevanceText: string,
  opts?: MemoryVectorRecallOpts | null,
) {
  const cid = characterId.trim()
  if (!cid) return { keywordHits: [], vectorRetrievals: [] }
  const [own, linked] = await Promise.all([
    personaDb.getCharacterMemoryRelevanceTraceByRelevance(cid, relevanceText, {
      ...opts,
      memoryBucket: 'own',
    }),
    personaDb.getCharacterMemoryRelevanceTraceByRelevance(cid, relevanceText, {
      ...opts,
      memoryBucket: 'linked',
    }),
  ])
  return {
    keywordHits: [...own.keywordHits, ...linked.keywordHits],
    vectorRetrievals: [...own.vectorRetrievals, ...linked.vectorRetrievals],
  }
}
