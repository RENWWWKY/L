import type { ApiConfig } from '../../api/types'
import type { MemorySettingsRow } from '../newFriendsPersona/types'
import { personaDb } from '../newFriendsPersona/idb'
import { fetchEmbeddingVectorUnified, fetchEmbeddingVectorsUnified } from './memoryEmbeddingProvider'
import {
  buildMemoryContextVectorId,
  computeContextVectorTextHash,
  MEMORY_CONTEXT_VECTOR_CHUNK_CHAR_TARGET,
  MEMORY_CONTEXT_VECTOR_INDEX_BATCH,
  MEMORY_CONTEXT_VECTOR_MAX_PER_CHARACTER,
  MEMORY_CONTEXT_VECTOR_MIN_SIM,
  MEMORY_CONTEXT_VECTOR_RECALL_TOP_K,
  type MemoryContextVectorEntry,
  type MemoryContextVectorSourceKind,
} from './memoryContextVectorTypes'
import type { StoryTimelineEventScope } from './storyTimelineTypes'
import { filterSummarizedStoryTimelineRows } from './summarizedStoryTimelineRowFilter'
import { cosineSimilarity, isMemoryVectorRecallEnabled, type MemoryVectorRecallOpts } from './memoryVectorRecall'

type ContextCandidate = {
  id: string
  characterId: string
  sourceKind: MemoryContextVectorSourceKind
  sourceKey: string
  text: string
  textHash: string
  messageTimestamp?: number
}

function chunkLinesToCandidates(params: {
  characterId: string
  sourceKind: MemoryContextVectorSourceKind
  sourceKey: string
  lines: Array<{ line: string; timestamp?: number; messageId?: string }>
}): ContextCandidate[] {
  const out: ContextCandidate[] = []
  let buf: string[] = []
  let bufLen = 0
  let bufTs = 0
  let bufMsgId = ''

  const flush = () => {
    if (!buf.length) return
    const text = buf.join('\n').trim()
    if (text.length < 24) {
      buf = []
      bufLen = 0
      bufMsgId = ''
      bufTs = 0
      return
    }
    const textHash = computeContextVectorTextHash(text)
    out.push({
      id: buildMemoryContextVectorId({
        characterId: params.characterId,
        sourceKind: params.sourceKind,
        sourceKey: params.sourceKey,
        textHash,
      }),
      characterId: params.characterId,
      sourceKind: params.sourceKind,
      sourceKey: params.sourceKey,
      text: text.slice(0, 2400),
      textHash,
      messageTimestamp: bufTs || undefined,
    })
    buf = []
    bufLen = 0
    bufMsgId = ''
    bufTs = 0
  }

  for (const row of params.lines) {
    const line = row.line.trim()
    if (!line) continue
    if (!bufMsgId && row.messageId) bufMsgId = row.messageId
    if (!bufTs && row.timestamp) bufTs = row.timestamp
    buf.push(line)
    bufLen += line.length
    if (buf.length >= 5 || bufLen >= MEMORY_CONTEXT_VECTOR_CHUNK_CHAR_TARGET) flush()
  }
  flush()
  return out
}

function summarizedMemoryScopeLabel(scope: string | undefined): string {
  switch (scope) {
    case 'group':
      return '已总结·群聊'
    case 'meet':
      return '已总结·遇见'
    case 'linked':
      return '已总结·关联'
    case 'moment':
      return '已总结·朋友圈'
    default:
      return '已总结·私聊'
  }
}

/** 长期记忆档案馆：已自动/手动总结入库的条目（不含游标后未总结原文） */
async function gatherSummarizedMemoryCandidates(characterId: string): Promise<ContextCandidate[]> {
  const cid = characterId.trim()
  if (!cid) return []
  const memories = await personaDb.listCharacterMemoriesForCharacter(cid)
  const lines: Array<{ line: string; timestamp?: number; messageId?: string }> = []
  for (const m of memories) {
    const content = String(m.content || '').trim()
    if (!content || content.length < 16) continue
    lines.push({
      line: `- [${summarizedMemoryScopeLabel(m.memoryScope)}] ${content.slice(0, 900)}`,
      timestamp: m.updatedAt,
      messageId: m.id,
    })
  }
  return chunkLinesToCandidates({
    characterId: cid,
    sourceKind: 'private_chat',
    sourceKey: cid,
    lines,
  })
}

function summarizedTimelineScopeLabel(scope: StoryTimelineEventScope | undefined): string {
  switch (scope) {
    case 'offline':
      return '线下'
    case 'meet':
      return '遇见'
    case 'group':
      return '群聊'
    case 'linked':
      return '关联'
    default:
      return '线上'
  }
}

/** 剧情时间轴行表：仅游标已覆盖的摘要行（不含游标后未总结 plot / 聊天原文） */
async function gatherSummarizedTimelineCandidates(
  characterId: string,
  conversationKey?: string | null,
): Promise<ContextCandidate[]> {
  const cid = characterId.trim()
  if (!cid) return []
  const allRows = await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)
  const rows = await filterSummarizedStoryTimelineRows(cid, allRows, { conversationKey })
  const lines: Array<{ line: string; timestamp?: number; messageId?: string }> = []
  for (const row of rows) {
    const text = String(row.rowText || '').trim()
    if (!text || text.length < 16) continue
    const scope = summarizedTimelineScopeLabel(row.sourceScope)
    lines.push({
      line: `- [已总结·${scope}剧情] ${text.slice(0, 900)}`,
      timestamp: row.recordedAt,
      messageId: row.id,
    })
  }
  return chunkLinesToCandidates({
    characterId: cid,
    sourceKind: 'offline_plot',
    sourceKey: cid,
    lines,
  })
}

function entryNeedsReembed(entry: MemoryContextVectorEntry, queryDim: number, provider: string, modelId: string): boolean {
  if (!Array.isArray(entry.embedding) || entry.embedding.length !== queryDim) return true
  if (entry.embeddingProvider !== provider) return true
  if (entry.embeddingModelId !== modelId) return true
  return false
}

async function backfillContextVectorsBestEffort(params: {
  characterId: string
  candidates: ContextCandidate[]
  stored: MemoryContextVectorEntry[]
  settings: MemorySettingsRow
  chatApiConfig: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null
  queryDim: number
  provider: 'local' | 'api'
  modelId: string
}): Promise<void> {
  const storedById = new Map(params.stored.map((e) => [e.id, e]))
  const stale = params.candidates.filter((c) => {
    const prev = storedById.get(c.id)
    if (!prev) return true
    return entryNeedsReembed(prev, params.queryDim, params.provider, params.modelId)
  })
  if (!stale.length) return

  const batch = stale.slice(0, MEMORY_CONTEXT_VECTOR_INDEX_BATCH)
  const texts = batch.map((c) => c.text)
  try {
    const embedded = await fetchEmbeddingVectorsUnified(params.settings, params.chatApiConfig, texts)
    const now = Date.now()
    for (let i = 0; i < batch.length; i++) {
      const c = batch[i]
      const hit = embedded[i]
      if (!hit?.vec?.length || hit.vec.length !== params.queryDim) continue
      await personaDb.upsertMemoryContextVector({
        id: c.id,
        characterId: c.characterId,
        sourceKind: c.sourceKind,
        sourceKey: c.sourceKey,
        text: c.text,
        textHash: c.textHash,
        embedding: hit.vec,
        embeddingProvider: hit.provider,
        embeddingModelId: hit.modelId,
        messageTimestamp: c.messageTimestamp,
        updatedAt: now,
      })
    }
    await personaDb.pruneMemoryContextVectors(params.characterId, MEMORY_CONTEXT_VECTOR_MAX_PER_CHARACTER)
  } catch {
    /* best effort */
  }
}

function formatContextRecallBlock(snippets: string[]): string {
  if (!snippets.length) return ''
  const body = snippets.map((s, i) => `${i + 1}. ${s}`).join('\n')
  return (
    `【语义召回·已总结片段】\n` +
    `${body}\n` +
    `（↑ 来自已入库的长期记忆与剧情时间轴摘要；游标后未总结原文见下方「尚未总结」块；勿机械复读。）`
  )
}

/**
 * 对已总结长期记忆 / 剧情时间轴行建索引并语义召回，追加到长期记忆 prompt 尾部。
 */
export async function appendContextVectorRecallToMemoryText(params: {
  characterId: string
  conversationKey?: string | null
  relevanceText: string
  settings: MemorySettingsRow
  chatApiConfig: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null
  opts?: MemoryVectorRecallOpts | null
  existingText: string
}): Promise<{ text: string; recalledCount: number }> {
  const cid = params.characterId.trim()
  if (!cid) return { text: params.existingText, recalledCount: 0 }
  if (params.settings.memoryContextVectorRecallEnabled === false) {
    return { text: params.existingText, recalledCount: 0 }
  }
  if (!isMemoryVectorRecallEnabled(params.settings, params.opts ?? null)) {
    return { text: params.existingText, recalledCount: 0 }
  }

  const rawHay = String(params.relevanceText || '').trim()
  if (rawHay.length < 10) return { text: params.existingText, recalledCount: 0 }

  try {
    const query = await fetchEmbeddingVectorUnified(params.settings, params.chatApiConfig, rawHay)
    if (!query?.vec.length) return { text: params.existingText, recalledCount: 0 }

    const [memCandidates, timelineCandidates] = await Promise.all([
      gatherSummarizedMemoryCandidates(cid),
      gatherSummarizedTimelineCandidates(cid, params.conversationKey),
    ])
    const candidates = [...memCandidates, ...timelineCandidates]
    if (!candidates.length) return { text: params.existingText, recalledCount: 0 }

    const candidateIds = new Set(candidates.map((c) => c.id))
    const stored = await personaDb.listMemoryContextVectorsByCharacterId(cid)
    await backfillContextVectorsBestEffort({
      characterId: cid,
      candidates,
      stored,
      settings: params.settings,
      chatApiConfig: params.chatApiConfig,
      queryDim: query.vec.length,
      provider: query.provider,
      modelId: query.modelId,
    })

    const fresh = await personaDb.listMemoryContextVectorsByCharacterId(cid)
    const scored: { entry: MemoryContextVectorEntry; sim: number }[] = []
    for (const entry of fresh) {
      if (!candidateIds.has(entry.id)) continue
      if (entry.embeddingProvider !== query.provider) continue
      if (entry.embedding.length !== query.vec.length) continue
      const sim = cosineSimilarity(query.vec, entry.embedding)
      if (sim >= MEMORY_CONTEXT_VECTOR_MIN_SIM) scored.push({ entry, sim })
    }
    scored.sort((a, b) => b.sim - a.sim)
    const top = scored.slice(0, MEMORY_CONTEXT_VECTOR_RECALL_TOP_K)
    if (!top.length) return { text: params.existingText, recalledCount: 0 }

    const snippets = top.map(({ entry, sim }) => {
      const tag =
        entry.sourceKind === 'offline_plot'
          ? '已总结·剧情'
          : entry.sourceKind === 'meet_chat'
            ? '已总结·遇见'
            : '已总结·记忆'
      return `（${tag}·sim ${sim.toFixed(2)}）${entry.text}`
    })
    const block = formatContextRecallBlock(snippets)
    const merged = params.existingText.trim() ? `${params.existingText.trim()}\n\n${block}` : block
    return { text: merged, recalledCount: top.length }
  } catch {
    return { text: params.existingText, recalledCount: 0 }
  }
}

export type ContextVectorRecallTraceItem = {
  relevanceScore: number
  content: string
  sourceKind: MemoryContextVectorSourceKind
}

/** 供思维溯源：与 appendContextVectorRecallToMemoryText 同源的语义召回结果 */
export async function getContextVectorRecallTraceForPromptInjection(params: {
  characterId: string
  conversationKey?: string | null
  relevanceText: string
  settings: MemorySettingsRow
  chatApiConfig: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null
  opts?: MemoryVectorRecallOpts | null
}): Promise<ContextVectorRecallTraceItem[]> {
  const cid = params.characterId.trim()
  if (!cid) return []
  if (params.settings.memoryContextVectorRecallEnabled === false) return []
  if (!isMemoryVectorRecallEnabled(params.settings, params.opts ?? null)) return []

  const rawHay = String(params.relevanceText || '').trim()
  if (rawHay.length < 10) return []

  try {
    const query = await fetchEmbeddingVectorUnified(params.settings, params.chatApiConfig, rawHay)
    if (!query?.vec.length) return []

    const [memCandidates, timelineCandidates] = await Promise.all([
      gatherSummarizedMemoryCandidates(cid),
      gatherSummarizedTimelineCandidates(cid, params.conversationKey),
    ])
    const candidates = [...memCandidates, ...timelineCandidates]
    if (!candidates.length) return []

    const candidateIds = new Set(candidates.map((c) => c.id))
    const stored = await personaDb.listMemoryContextVectorsByCharacterId(cid)
    await backfillContextVectorsBestEffort({
      characterId: cid,
      candidates,
      stored,
      settings: params.settings,
      chatApiConfig: params.chatApiConfig,
      queryDim: query.vec.length,
      provider: query.provider,
      modelId: query.modelId,
    })

    const fresh = await personaDb.listMemoryContextVectorsByCharacterId(cid)
    const scored: { entry: MemoryContextVectorEntry; sim: number }[] = []
    for (const entry of fresh) {
      if (!candidateIds.has(entry.id)) continue
      if (entry.embeddingProvider !== query.provider) continue
      if (entry.embedding.length !== query.vec.length) continue
      const sim = cosineSimilarity(query.vec, entry.embedding)
      if (sim >= MEMORY_CONTEXT_VECTOR_MIN_SIM) scored.push({ entry, sim })
    }
    scored.sort((a, b) => b.sim - a.sim)
    return scored.slice(0, MEMORY_CONTEXT_VECTOR_RECALL_TOP_K).map(({ entry, sim }) => ({
      relevanceScore: sim,
      content: entry.text,
      sourceKind: entry.sourceKind,
    }))
  } catch {
    return []
  }
}

/** 供思维溯源：列出本轮候选已总结片段（不写入 prompt） */
export async function listContextVectorCandidatesForTrace(params: {
  characterId: string
  conversationKey?: string | null
}): Promise<ContextCandidate[]> {
  const cid = params.characterId.trim()
  if (!cid) return []
  const [mem, timeline] = await Promise.all([
    gatherSummarizedMemoryCandidates(cid),
    gatherSummarizedTimelineCandidates(cid, params.conversationKey),
  ])
  return [...mem, ...timeline]
}
