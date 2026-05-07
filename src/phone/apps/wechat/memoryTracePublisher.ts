import type { ApiConfig } from '../../api/types'
import { buildWorldbookContext } from '../../worldbook/buildWorldbookContext'
import { getWorldbookLoreEntriesSnapshot } from '../../worldbook/worldbookLoreStore'
import type { GlobalWechatPlate } from '../../worldbook/globalWorldBookTypes'
import type { Character } from './newFriendsPersona/types'
import { personaDb } from './newFriendsPersona/idb'
import { buildMemoryRelevanceHaystack } from './wechatMemoryPromptBlocks'
import { listUnsummarizedOfflinePlotTraceItems } from './dating/loadOfflineDatingPlotsForWechatPrompt'
import type { MemoryTraceData } from './memoryTraceTypes'
import { setLastMemoryTrace } from './memoryTraceStore'
import type { ChatTranscriptTurn } from './wechatChatAi'
import { WECHAT_HISTORY_MAX_MESSAGES, buildCharacterCard, buildWorldBookText } from './wechatChatAi'
import { splitDatingAssistantOutput } from './dating/plotCoT'

/** 思维溯源不做客户端字数截断；人设世界书与模型注入同源，仅放宽 maxChars */
const TRACE_WORLD_BOOK_MAX_CHARS = Number.MAX_SAFE_INTEGER

/** 思维溯源「样本锚定」：展示本轮模型输出的最后一条可见气泡全文 */
function lastNonEmptyBubbleText(replyBubbles: string[]): string {
  const cleaned = replyBubbles.map((s) => String(s ?? '').trim()).filter(Boolean)
  return cleaned.length ? cleaned[cleaned.length - 1]! : ''
}

function personaTagsFromCharacter(ch: Character | null): string[] {
  if (!ch) return []
  const tags: string[] = []
  const push = (x: string | null | undefined) => {
    const v = String(x ?? '').trim()
    if (v && !tags.includes(v)) tags.push(v)
  }
  push(ch.name)
  push(ch.identity)
  push(ch.mbti)
  push(ch.zodiac)
  for (const x of ch.interests ?? []) push(x)
  for (const x of ch.painPoints ?? []) push(x)
  return tags.slice(0, 12)
}

/** 思维溯源「核心基底」：与人设卡编辑字段对齐的完整正文 */
function buildFullPersonaDetailForMemoryTrace(ch: Character | null): string {
  if (!ch) return ''
  const card = buildCharacterCard(ch)
  const parts: string[] = [`【档案摘要·与模型注入同源】\n${card}`]
  if (ch.wechatId?.trim()) parts.push(`【微信号（展示用）】${ch.wechatId.trim()}`)
  if (ch.bio?.trim()) parts.push(`【简介 / 人设长文】\n${ch.bio.trim()}`)
  if (ch.motto?.trim()) parts.push(`【座右铭】\n${ch.motto.trim()}`)
  if (ch.openingLines?.trim()) parts.push(`【默认开场白（每行一条气泡）】\n${ch.openingLines.trim()}`)
  if (ch.interests?.length) parts.push(`【兴趣标签】${ch.interests.map((x) => String(x ?? '').trim()).filter(Boolean).join('、')}`)
  if (ch.painPoints?.length) parts.push(`【雷点】${ch.painPoints.map((x) => String(x ?? '').trim()).filter(Boolean).join('、')}`)
  if (ch.remark?.trim()) parts.push(`【通讯录备注】${ch.remark.trim()}`)
  if (ch.schedule) {
    try {
      parts.push(`【日程表·完整数据】\n${JSON.stringify(ch.schedule)}`)
    } catch {
      parts.push('【日程表】（序列化失败，请人设页查看）')
    }
  }
  return parts.join('\n\n').trim()
}

function countTranscriptTurns(transcript: ChatTranscriptTurn[]): number {
  return transcript.filter((t) => String(t.text ?? '').trim().length > 0).length
}

function activeSessionMessageCount(transcript: ChatTranscriptTurn[]): number {
  return Math.min(countTranscriptTurns(transcript), WECHAT_HISTORY_MAX_MESSAGES)
}

export async function publishWeChatPrivatePersonaMemoryTrace(params: {
  character: Character | null
  charDisplayName: string
  transcript: ChatTranscriptTurn[]
  biasText: string
  worldBackgroundPrompt: string
  offlineDatingPlotsContext: string
  unsPrivateNotes: string
  unsGroupNotes: string
  recentGroupChatsReference: string
  chatMemberIds: string[]
  globalWechatPlate: GlobalWechatPlate
  apiConfig: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null
  replyBubbles: string[]
}): Promise<void> {
  const cid = params.character?.id?.trim()
  if (!cid) return

  const hay = buildMemoryRelevanceHaystack([
    ...params.transcript.slice(-32).map((t) => t.text),
    params.biasText,
  ])
  const deep = await personaDb.getCharacterMemoryRelevanceTraceByRelevance(cid, hay, {
    apiConfig: params.apiConfig?.apiUrl?.trim() && params.apiConfig?.apiKey?.trim() ? params.apiConfig : null,
  })

  const personaDetail = buildFullPersonaDetailForMemoryTrace(params.character)
  const characterWorldBook = buildWorldBookText(params.character, TRACE_WORLD_BOOK_MAX_CHARS).trim()
  const globalWorldbook = buildWorldbookContext(
    params.chatMemberIds,
    getWorldbookLoreEntriesSnapshot(),
    params.globalWechatPlate,
    { skipLengthCap: true, plainUserEntriesOnly: true },
  ).trim()

  const offlinePlots = await listUnsummarizedOfflinePlotTraceItems(cid, params.charDisplayName, {
    fullSnippet: true,
    maxItems: 2000,
  })

  const unsChats: MemoryTraceData['contextMatrix']['recentContext']['unsummarizedChats'] = []
  if (params.unsPrivateNotes.trim()) {
    unsChats.push({
      type: 'private',
      source: '私聊（记忆总结游标后）',
      snippet: params.unsPrivateNotes.trim(),
    })
  }
  if (params.unsGroupNotes.trim()) {
    unsChats.push({
      type: 'group',
      source: '各群（游标后摘录）',
      snippet: params.unsGroupNotes.trim(),
    })
  }
  if (params.recentGroupChatsReference.trim()) {
    unsChats.push({
      type: 'group',
      source: '群聊近期参考（本地摘录）',
      snippet: params.recentGroupChatsReference.trim(),
    })
  }
  if (params.offlineDatingPlotsContext.trim()) {
    unsChats.push({
      type: 'private',
      source: '线下约会/剧情 · 注入摘录',
      snippet: params.offlineDatingPlotsContext.trim(),
    })
  }

  const lastReply = lastNonEmptyBubbleText(params.replyBubbles)

  const data: MemoryTraceData = {
    lastReply: lastReply || '（本轮无可见文本气泡）',
    charName: params.charDisplayName.trim() || params.character?.name?.trim() || '角色',
    contextMatrix: {
      baseDirectives: {
        persona: personaTagsFromCharacter(params.character),
        personaDetail,
        worldBackground: params.worldBackgroundPrompt.trim(),
        characterWorldBook: characterWorldBook || '（未绑定或未启用人设世界书条目）',
        globalWorldbook: globalWorldbook || '（当前场景无匹配的档案室全局条目）',
        worldbooks: [],
      },
      recentContext: {
        activeSessionMessages: activeSessionMessageCount(params.transcript),
        unsummarizedOfflinePlots: offlinePlots.length ? offlinePlots : [],
        unsummarizedChats: unsChats,
      },
      deepMemory: {
        keywordHits: deep.keywordHits,
        vectorRetrievals: deep.vectorRetrievals,
      },
    },
  }
  setLastMemoryTrace(data)
}

/** 群多角色：以首名 NPC 的长期记忆 trace 为主，并合并档案室与群级未总结摘录 */
export async function publishWeChatGroupMemoryTrace(params: {
  groupName: string
  transcript: ChatTranscriptTurn[]
  biasText: string
  primaryNpcCharacterId: string
  primaryNpcDisplayName: string
  worldBackgroundFirst?: string
  offlinePlotsCombined: string
  groupUnsummarizedNotes: string
  wbGroupCharIds: string[]
  apiConfig: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null
  replyBubbles: string[]
}): Promise<void> {
  const cid = params.primaryNpcCharacterId.trim()
  if (!cid) return

  const hay = buildMemoryRelevanceHaystack([
    ...params.transcript.slice(-36).map((t) => `${t.speakerLabel ?? ''} ${t.text}`),
    params.biasText,
    params.offlinePlotsCombined,
  ])
  const deep = await personaDb.getCharacterMemoryRelevanceTraceByRelevance(cid, hay, {
    apiConfig: params.apiConfig?.apiUrl?.trim() && params.apiConfig?.apiKey?.trim() ? params.apiConfig : null,
  })

  const primaryChar = await personaDb.getCharacter(cid)
  const personaDetail = buildFullPersonaDetailForMemoryTrace(primaryChar)
  const characterWorldBook = buildWorldBookText(primaryChar, TRACE_WORLD_BOOK_MAX_CHARS).trim()
  const globalWorldbook = buildWorldbookContext(
    params.wbGroupCharIds,
    getWorldbookLoreEntriesSnapshot(),
    'group_chat',
    { skipLengthCap: true, plainUserEntriesOnly: true },
  ).trim()

  const unsChats: MemoryTraceData['contextMatrix']['recentContext']['unsummarizedChats'] = []
  if (params.groupUnsummarizedNotes.trim()) {
    unsChats.push({
      type: 'group',
      source: `本群：${params.groupName}`,
      snippet: params.groupUnsummarizedNotes.trim(),
    })
  }
  if (params.offlinePlotsCombined.trim()) {
    unsChats.push({
      type: 'group',
      source: '线下剧情摘录（多成员合并）',
      snippet: params.offlinePlotsCombined.trim(),
    })
  }

  const lastReply = lastNonEmptyBubbleText(params.replyBubbles)

  const data: MemoryTraceData = {
    lastReply: lastReply || '（本轮无可见文本气泡）',
    charName: params.groupName.trim() || '群聊',
    contextMatrix: {
      baseDirectives: {
        persona: [`多角色会话`, `主参考记忆：${params.primaryNpcDisplayName}`],
        personaDetail:
          personaDetail.trim() ||
          `【群聊说明】本溯源以首位发言 NPC「${params.primaryNpcDisplayName}」的人设档案为主参考；多角色台词由群聊管线分别注入。`,
        worldBackground: (params.worldBackgroundFirst ?? '').trim(),
        characterWorldBook: characterWorldBook || '（该 NPC 未绑定或未启用人设世界书）',
        globalWorldbook: globalWorldbook || '（当前群场景无匹配的档案室全局条目）',
        worldbooks: [],
      },
      recentContext: {
        activeSessionMessages: activeSessionMessageCount(params.transcript),
        unsummarizedOfflinePlots: [],
        unsummarizedChats: unsChats,
      },
      deepMemory: {
        keywordHits: deep.keywordHits,
        vectorRetrievals: deep.vectorRetrievals,
      },
    },
  }
  setLastMemoryTrace(data)
}

export async function publishDatingOfflineMemoryTrace(params: {
  characterId: string
  charName: string
  identityTags: string[]
  worldBackground: string
  datingArchiveBlock: string
  /** 与 `datingArchiveBlock` 同源筛选，仅条目标题+正文（思维溯源无注入前言时用） */
  datingArchiveBlockPlain?: string
  isVnMode: boolean
  historyPlotCount: number
  userText?: string
  unsPrivateBlock: string
  unsGroupBlock: string
  unsOfflineBlock: string
  apiConfig: { apiUrl?: string; apiKey?: string; modelId?: string } | null
  rawAssistantOutput: string
}): Promise<void> {
  const cid = params.characterId.trim()
  if (!cid) return

  const hay = buildMemoryRelevanceHaystack([params.userText, params.unsPrivateBlock, params.unsGroupBlock])
  const deep = await personaDb.getCharacterMemoryRelevanceTraceByRelevance(cid, hay, {
    apiConfig: params.apiConfig?.apiUrl?.trim() && params.apiConfig?.apiKey?.trim() ? params.apiConfig : null,
  })

  const plate = params.isVnMode ? ('vn' as const) : ('offline_plot' as const)
  const chRow = await personaDb.getCharacter(cid)
  const personaDetail = buildFullPersonaDetailForMemoryTrace(chRow)
  const characterWorldBook = buildWorldBookText(chRow, TRACE_WORLD_BOOK_MAX_CHARS).trim()
  const globalWorldbook = buildWorldbookContext([cid], getWorldbookLoreEntriesSnapshot(), plate, {
    skipLengthCap: true,
    plainUserEntriesOnly: true,
  }).trim()
  const offlinePlots = await listUnsummarizedOfflinePlotTraceItems(cid, params.charName, {
    fullSnippet: true,
    maxItems: 2000,
  })

  const unsChats: MemoryTraceData['contextMatrix']['recentContext']['unsummarizedChats'] = []
  if (params.unsPrivateBlock.trim()) {
    unsChats.push({ type: 'private', source: '尚未总结 · 私聊', snippet: params.unsPrivateBlock.trim() })
  }
  if (params.unsGroupBlock.trim()) {
    unsChats.push({ type: 'group', source: '尚未总结 · 群聊', snippet: params.unsGroupBlock.trim() })
  }

  const lastReply = splitDatingAssistantOutput(params.rawAssistantOutput).content.trim()

  const data: MemoryTraceData = {
    lastReply: lastReply || '（本轮无正文）',
    charName: params.charName.trim() || '约会',
    contextMatrix: {
      baseDirectives: {
        persona: [...params.identityTags].slice(0, 12),
        personaDetail: personaDetail.trim() || params.identityTags.join('、'),
        worldBackground: params.worldBackground.trim(),
        characterWorldBook: characterWorldBook || '（未绑定或未启用人设世界书）',
        globalWorldbook:
          globalWorldbook.trim() ||
          (params.datingArchiveBlockPlain?.trim() ?? '') ||
          '（当前板块无档案室条目）',
        worldbooks: [],
      },
      recentContext: {
        activeSessionMessages: Math.min(Math.max(0, params.historyPlotCount), 32),
        unsummarizedOfflinePlots: offlinePlots.length
          ? offlinePlots
          : params.unsOfflineBlock.trim()
            ? [{ date: '—', snippet: params.unsOfflineBlock.trim() }]
            : [],
        unsummarizedChats: unsChats,
      },
      deepMemory: {
        keywordHits: deep.keywordHits,
        vectorRetrievals: deep.vectorRetrievals,
      },
    },
  }
  setLastMemoryTrace(data)
}
