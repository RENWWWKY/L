import type { ApiConfig } from '../../phone/apps/api/types'
import { openAiCompatibleChat, type OpenAiCompatibleMessage } from '../../phone/apps/wechat/newFriendsPersona/ai'
import { loadPrivateChatNetworkRelationshipsBlock } from '../../phone/apps/wechat/networkRelationshipsPrompt'
import { buildSystemContent } from '../../phone/apps/wechat/wechatChatAi'
import type { MockContact, QnAAnswer, Question } from './types'
import {
  buildAnonymousQaPersonaPromptPack,
  type AnonymousQaWechatContext,
} from './buildAnonymousQaPersonaContext'

export type DynamicReplyRow = {
  authorMask: string
  content: string
  /** 人脉 NPC 跟帖：展示名可用备注，内容仍匿名 */
  fromContactCharacterId?: string
}

const QNA_PERSONA_REPLY_APPENDIX = `
---
【匿问我答 · 跟帖任务】
你在「匿问我答」社区里发言。身份是**匿名**（对外显示「匿名」或「你的某位好友」等掩码，不要自曝真名/微信昵称）。
须严格贴合上方人设、长期记忆、线上私聊与线下剧情参考；语气可有网感，但不要 OOC。
禁止编造与记忆/聊天记录明显矛盾的事实；不确定时用含蓄、试探口吻。

仅输出 JSON 数组，不要 Markdown：
[{"authorMask":"匿名","content":"..."}]
`.trim()

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? ''
    if (fenced) {
      try {
        return JSON.parse(fenced) as T
      } catch {
        return null
      }
    }
    const arrayMatch = text.match(/\[[\s\S]*\]/)
    if (!arrayMatch) return null
    try {
      return JSON.parse(arrayMatch[0]) as T
    } catch {
      return null
    }
  }
}

function apiReady(cfg: ApiConfig | null): cfg is ApiConfig {
  return !!(cfg?.apiUrl?.trim() && cfg?.apiKey?.trim() && cfg?.modelId?.trim())
}

async function callPersonaJsonReplies(params: {
  wechatCtx: AnonymousQaWechatContext
  characterId: string
  userTask: string
  countHint: number
}): Promise<DynamicReplyRow[]> {
  const cfg = params.wechatCtx.apiConfig
  if (!apiReady(cfg)) return []

  const pack = await buildAnonymousQaPersonaPromptPack({
    characterId: params.characterId,
    wechatCtx: params.wechatCtx,
    relevanceHaystack: params.userTask,
  })
  if (!pack.character) return []

  const networkRelationshipsBlock = await loadPrivateChatNetworkRelationshipsBlock({
    character: pack.character,
    sessionPlayerIdentityId: params.wechatCtx.playerIdentityId,
  })

  const system = buildSystemContent({
    character: pack.character,
    playerIdentity: pack.playerIdentity,
    playerDisplayName: params.wechatCtx.playerDisplayName.trim() || '朋友',
    promptMode: 'persona',
    longTermMemoryNotes: pack.longTermMemoryNotes || undefined,
    worldBackgroundPrompt: pack.worldBackgroundPrompt,
    offlineDatingPlotsContext: pack.offlineDatingPlotsContext || undefined,
    unsummarizedPrivateNotes: pack.unsummarizedPrivateNotes || undefined,
    unsummarizedGroupNotes: pack.unsummarizedGroupNotes || undefined,
    meetEncounterMemoriesContext: pack.meetEncounterMemoriesContext || undefined,
    unsummarizedMeetNotes: pack.unsMeet || undefined,
    networkRelationshipsBlock: networkRelationshipsBlock || undefined,
    chatMemberIds: [params.characterId],
  })

  const messages: OpenAiCompatibleMessage[] = [
    { role: 'system', content: `${system}\n\n${QNA_PERSONA_REPLY_APPENDIX}` },
    {
      role: 'user',
      content: `${params.userTask}\n\n请生成 ${params.countHint} 条跟帖 JSON。`,
    },
  ]

  try {
    const raw = await openAiCompatibleChat(cfg, messages, { temperature: 0.86, max_tokens: 1200 })
    const rows = safeParseJson<DynamicReplyRow[]>(raw)
    if (!Array.isArray(rows) || !rows.length) return []
    return rows
      .slice(0, params.countHint)
      .map((r) => ({
        authorMask: String(r.authorMask ?? '匿名').trim() || '匿名',
        content: String(r.content ?? '').trim(),
        fromContactCharacterId: params.characterId,
      }))
      .filter((r) => r.content.length > 0)
  } catch {
    return []
  }
}

/** 混合：通讯录好友用人设跟帖，其余用通用吃瓜群众。 */
export async function generatePersonaAwareDynamicReplies(args: {
  postBody: string
  isContact: boolean
  contactCharacterId?: string
  recentComments: string
  userComment: string
  wechatCtx: AnonymousQaWechatContext | null
  fallbackGeneric: () => Promise<DynamicReplyRow[]>
}): Promise<DynamicReplyRow[]> {
  const cid = args.contactCharacterId?.trim()
  const ctx = args.wechatCtx
  const wantPersona = !!(args.isContact && cid && ctx && apiReady(ctx.apiConfig))

  const userTask = [
    `【原帖】${args.postBody}`,
    `【是否通讯录好友匿名帖】${args.isContact ? '是' : '否'}`,
    `【已有评论】\n${args.recentComments || '（暂无）'}`,
    `【用户刚发的回复】${args.userComment}`,
    '【要求】生成不同视角跟帖：可含赞同/反驳/吃瓜/楼主补充；若你是「好友匿名帖」里的那位好友，其中至少一条要像本人憋不住来补充或澄清。',
  ].join('\n')

  if (!wantPersona) {
    return args.fallbackGeneric()
  }

  const personaRows = await callPersonaJsonReplies({
    wechatCtx: ctx,
    characterId: cid!,
    userTask,
    countHint: 2,
  })

  const generic = await args.fallbackGeneric()
  const merged = [...personaRows, ...generic].slice(0, 3)
  if (merged.length) return merged
  return generic.length ? generic : personaRows
}

export function contactRosterForQuestionPrompt(contacts: MockContact[]): string {
  const friends = contacts.filter((c) => c.id !== 'self' && c.characterId)
  if (!friends.length) return '（当前无已绑定人设的通讯录好友）'
  return friends
    .map((c) => `- ${c.remarkName}（内部 id: ${c.characterId}）`)
    .join('\n')
}

export function pickContactForGeneratedRow(
  contacts: MockContact[],
  idx: number,
  preferDirected?: boolean,
): MockContact | null {
  const pool = contacts.filter((c) => c.id !== 'self' && c.characterId)
  if (!pool.length) return null
  if (preferDirected) return pool[idx % pool.length] ?? pool[0]!
  return pool[(idx + Math.floor(Math.random() * pool.length)) % pool.length] ?? pool[0]!
}

export function attachContactMetaToQuestion(
  q: Question,
  contact: MockContact | null,
  forceContact?: boolean,
): Question {
  if (!contact?.characterId) return q
  const isContact = forceContact ?? q.isContact
  if (!isContact) return q
  return {
    ...q,
    isContact: true,
    contactCharacterId: contact.characterId,
    authorMask: q.authorMask || '你的某位好友',
    targetUserIds: q.visibility === 'directed' ? [contact.id] : q.targetUserIds,
    targetDisplayNames: q.visibility === 'directed' ? [contact.remarkName] : q.targetDisplayNames,
  }
}

export function mapPersonaReplyToAnswer(row: DynamicReplyRow, contacts: MockContact[]): QnAAnswer {
  const linked = row.fromContactCharacterId
    ? contacts.find((c) => c.characterId === row.fromContactCharacterId)
    : null
  const display = String(row.authorMask ?? '').trim() || '匿名'
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    authorId: linked?.characterId ? `persona-${linked.characterId}` : `ai-${Math.random().toString(36).slice(2, 8)}`,
    authorName: display,
    authorAvatarUrl: undefined,
    isAnonymous: true,
    content: row.content,
    likeCount: Math.floor(Math.random() * 20),
    dislikeCount: Math.floor(Math.random() * 3),
    replies: [],
  }
}
