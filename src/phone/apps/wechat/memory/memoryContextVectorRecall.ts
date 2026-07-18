import type { ApiConfig } from '../../api/types'
import type { MemorySettingsRow } from '../newFriendsPersona/types'
import { listSummarizedOfflinePlotContextLines } from '../dating/loadOfflineDatingPlotsForWechatPrompt'
import { listSummarizedPrivateChatContextLines } from '../wechatMemoryPromptBlocks'
import {
  buildMemoryContextVectorId,
  computeContextVectorTextHash,
  MEMORY_CONTEXT_VECTOR_CHUNK_CHAR_TARGET,
  type MemoryContextVectorSourceKind,
} from './memoryContextVectorTypes'
import type { MemoryVectorRecallOpts } from './memoryVectorRecall'

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

/** 游标已覆盖的私聊消息原文（非长期记忆 prose 摘要） */
async function gatherSummarizedOnlineChatCandidates(
  characterId: string,
  conversationKey?: string | null,
): Promise<ContextCandidate[]> {
  const cid = characterId.trim()
  const ck = conversationKey?.trim()
  if (!cid || !ck) return []
  const lines = await listSummarizedPrivateChatContextLines(ck)
  if (!lines.length) return []
  return chunkLinesToCandidates({
    characterId: cid,
    sourceKind: 'private_chat',
    sourceKey: ck,
    lines: lines.map((r) => ({
      line: r.line,
      timestamp: r.timestamp,
      messageId: r.messageId,
    })),
  })
}

/** 游标已覆盖的线下 AI 剧情正文（非玩家输入 / 非摘要表 rowText） */
async function gatherSummarizedOfflinePlotBodyCandidates(characterId: string): Promise<ContextCandidate[]> {
  const cid = characterId.trim()
  if (!cid) return []
  const lines = await listSummarizedOfflinePlotContextLines(cid)
  if (!lines.length) return []
  return chunkLinesToCandidates({
    characterId: cid,
    sourceKind: 'offline_plot',
    sourceKey: cid,
    lines: lines.map((r) => ({
      line: r.line,
      timestamp: r.timestamp,
      messageId: r.plotId,
    })),
  })
}

/**
 * 游标前原文语义召回：配置页开关已移除，永久不再注入 prompt。
 * 保留函数签名以免打断记忆拼装调用链。
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
  void params.characterId
  void params.conversationKey
  void params.relevanceText
  void params.settings
  void params.chatApiConfig
  void params.opts
  return { text: params.existingText, recalledCount: 0 }
}

export type ContextVectorRecallTraceItem = {
  relevanceScore: number
  content: string
  sourceKind: MemoryContextVectorSourceKind
}

/** 供思维溯源：游标前原文召回已下线，恒为空 */
export async function getContextVectorRecallTraceForPromptInjection(_params: {
  characterId: string
  conversationKey?: string | null
  relevanceText: string
  settings: MemorySettingsRow
  chatApiConfig: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null
  opts?: MemoryVectorRecallOpts | null
}): Promise<ContextVectorRecallTraceItem[]> {
  return []
}

/** 供思维溯源：列出本轮候选游标前原文（不写入 prompt） */
export async function listContextVectorCandidatesForTrace(params: {
  characterId: string
  conversationKey?: string | null
}): Promise<ContextCandidate[]> {
  const cid = params.characterId.trim()
  if (!cid) return []
  const [chat, plot] = await Promise.all([
    gatherSummarizedOnlineChatCandidates(cid, params.conversationKey),
    gatherSummarizedOfflinePlotBodyCandidates(cid),
  ])
  return [...chat, ...plot]
}
