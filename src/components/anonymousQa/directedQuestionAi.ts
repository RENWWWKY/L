import { openAiCompatibleChat, type OpenAiCompatibleMessage } from '../../phone/apps/wechat/newFriendsPersona/ai'
import { pickNetworkBoundCommenters } from './qnaDirectedNetworkRoster'
import { apiReadyForQna, buildQnaDirectedMergedSystemPrompt } from './qnaCharacterMemoryPrompt'
import { buildQnaContactDisplayIndex, resolveContactDisplayName } from './qnaContactDisplay'
import {
  DIRECTED_COMMENT_DRAMA_RULES,
  DIRECTED_QUESTION_ANONYMITY_PREMISE,
} from './qnaDirectedPlayerDisplay'
import { namesMatch } from './qnaThreadReplyRouting'
import type { MockContact } from './types'
import type { AnonymousQaWechatContext } from './buildAnonymousQaPersonaContext'

export type DirectedInitialReplyRow = {
  id: string
  authorName: string
  replyToName: string
  content: string
  delayInSeconds: number
  asAuthor?: boolean
}

export type DirectedInitialTopCommentRow = {
  id: string
  authorName: string
  content: string
  delayInSeconds: number
  replies: DirectedInitialReplyRow[]
}

export type DirectedDualOutput = {
  characterAnswer: string
  /** 一级评论 + 其下楼中楼（与玩家后续评论结构一致） */
  commentThreads: DirectedInitialTopCommentRow[]
}

const DIRECTED_DUAL_OUTPUT_APPENDIX = `
---
【系统任务：定向提问 · 答主回答 + 评论区】
你正在「匿问我答」中收到一条**只由你回答**的定向提问。
**提问者身份对所有人保密**——你不知道是谁问的，只能根据正文口吻猜测，禁止笃定认人。
请同时输出：
1) characterAnswer：被提问角色本人主回答（50–100 字，贴合人设，禁止 OOC）；
2) commentThreads：评论区。每条为**一级评论**（羁绊角色围观主楼），其下 replies 仅为**该楼内的接话**（可因情敌/吃醋等人设**修罗场互怼**，答主偶尔插一句），不得把本该一级的评论塞进 replies。

严格返回**纯 JSON**（不要 Markdown）：
{
  "characterAnswer": "主回答正文",
  "commentThreads": [
    {
      "id": "tc_1",
      "authorName": "羁绊角色A（来自名单）",
      "content": "一级评论正文",
      "delayInSeconds": 15,
      "replies": [
        {
          "id": "tr_1_1",
          "authorName": "羁绊角色B",
          "replyToName": "羁绊角色A",
          "content": "接话正文",
          "delayInSeconds": 22
        },
        {
          "id": "tr_1_2",
          "authorName": "答主备注名",
          "replyToName": "羁绊角色B",
          "content": "答主接话",
          "delayInSeconds": 30,
          "asAuthor": true
        }
      ]
    },
    {
      "id": "tc_2",
      "authorName": "羁绊角色C",
      "content": "另一条一级评论",
      "delayInSeconds": 40,
      "replies": []
    }
  ]
}
规则：
- commentThreads：1–3 条一级评论；每条 authorName 必须来自羁绊名单；鼓励至少一条一级或楼中楼出现羁绊互怼（情敌/吃醋等须贴合人脉，禁止 OOC）；
- replies：0–3 条，只挂在对应的一级评论下；replyToName 填被接话者备注名；
- 答主本人若在 replies 中出现，authorName 用答主备注名，并设 asAuthor: true；
- delayInSeconds：一级建议 12–50，楼中楼比所属一级更大 5–20；彼此错开；
- 一级之间禁止用 replies 串联；另一条一级必须新建 commentThreads 元素；
- authorName / replyToName 必须使用羁绊名单中的**通讯录展示名**（有备注用备注，无备注用微信昵称），禁止用人设真实姓名；
- 禁止 Emoji；勿编造与记忆、人脉关系明显冲突的事实；
- 写某角色台词前须对照 system 中该角色的【记忆参考】节（与微信私聊同源），禁止角色间串台；
- 答主与羁绊围观均**不得认定或直呼提问者**；若想试探只能用含糊语气，禁止「就是你」类断言；
${DIRECTED_COMMENT_DRAMA_RULES}
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
    const obj = text.match(/\{[\s\S]*\}/)
    if (!obj) return null
    try {
      return JSON.parse(obj[0]) as T
    } catch {
      return null
    }
  }
}

function clampDelay(n: unknown, fallback: number): number {
  return Math.max(5, Math.min(300, Math.floor(Number(n) || fallback)))
}

type AiReplyRow = {
  id?: string
  authorName?: string
  replyToName?: string
  content?: string
  delayInSeconds?: number
  asAuthor?: boolean
}

type AiThreadRow = {
  id?: string
  authorName?: string
  content?: string
  delayInSeconds?: number
  replies?: AiReplyRow[]
}

type AiPayload = {
  characterAnswer?: string
  commentThreads?: AiThreadRow[]
  /** 旧版扁平 comments，兼容解析 */
  comments?: Array<{
    id?: string
    authorName?: string
    content?: string
    delayInSeconds?: number
  }>
}

async function normalizeDualOutput(
  raw: AiPayload | null,
  mutuals: MockContact[],
  target: MockContact,
  allContacts: MockContact[],
): Promise<DirectedDualOutput | null> {
  const answer = String(raw?.characterAnswer ?? '').trim()
  if (!answer) return null

  const index = await buildQnaContactDisplayIndex([...allContacts, target])
  const targetDisplay = target.remarkName.trim()

  const threads: DirectedInitialTopCommentRow[] = []

  if (Array.isArray(raw?.commentThreads) && raw.commentThreads.length) {
    for (let i = 0; i < Math.min(4, raw.commentThreads.length); i++) {
      const t = raw.commentThreads[i]
      const authorName = resolveContactDisplayName(
        String(t.authorName ?? mutuals[i]?.remarkName ?? '').trim(),
        index,
      )
      const content = String(t.content ?? '').trim()
      if (!authorName || !content) continue
      const replies: DirectedInitialReplyRow[] = []
      if (Array.isArray(t.replies)) {
        for (let j = 0; j < Math.min(4, t.replies.length); j++) {
          const r = t.replies[j]
          const rName = resolveContactDisplayName(String(r.authorName ?? '').trim(), index)
          const rContent = String(r.content ?? '').trim()
          if (!rName || !rContent) continue
          const rDisplay = resolveContactDisplayName(rName, index)
          const asAuthor =
            r.asAuthor === true || rDisplay === targetDisplay || namesMatch(rDisplay, targetDisplay)
          replies.push({
            id: String(r.id ?? `tr_${i + 1}_${j + 1}`).trim(),
            authorName: rDisplay,
            replyToName:
              resolveContactDisplayName(String(r.replyToName ?? authorName).trim(), index) ||
              authorName,
            content: rContent,
            delayInSeconds: clampDelay(r.delayInSeconds, 18 + i * 15 + j * 8),
            asAuthor,
          })
        }
      }
      threads.push({
        id: String(t.id ?? `tc_${i + 1}`).trim(),
        authorName,
        content,
        delayInSeconds: clampDelay(t.delayInSeconds, 12 + i * 20),
        replies,
      })
    }
  } else if (Array.isArray(raw?.comments)) {
    for (let i = 0; i < Math.min(3, raw.comments.length); i++) {
      const c = raw.comments[i]
      const authorName = resolveContactDisplayName(
        String(c.authorName ?? mutuals[i]?.remarkName ?? '').trim(),
        index,
      )
      const content = String(c.content ?? '').trim()
      if (!authorName || !content) continue
      threads.push({
        id: String(c.id ?? `tc_${i + 1}`).trim(),
        authorName,
        content,
        delayInSeconds: clampDelay(c.delayInSeconds, 12 + i * 22),
        replies: [],
      })
    }
  }

  return { characterAnswer: answer, commentThreads: threads }
}

function fallbackOutput(target: MockContact, mutuals: MockContact[]): DirectedDualOutput {
  const m0 = mutuals[0]?.remarkName ?? '路人甲'
  const m1 = mutuals[1]?.remarkName ?? '路人乙'
  const m2 = mutuals[2]?.remarkName
  const targetName = target.remarkName.trim()

  const threads: DirectedInitialTopCommentRow[] = [
    {
      id: 'tc_1',
      authorName: m0,
      content: '他居然回了，有点东西。',
      delayInSeconds: 15,
      replies:
        mutuals.length > 1
          ? [
              {
                id: 'tr_1_1',
                authorName: m1,
                replyToName: m0,
                content: '你这吃瓜速度比网速还快。',
                delayInSeconds: 24,
              },
              {
                id: 'tr_1_2',
                authorName: targetName,
                replyToName: m1,
                content: '少说两句，我自己会分辨。',
                delayInSeconds: 32,
                asAuthor: true,
              },
            ]
          : [],
    },
  ]

  if (m2 && mutuals.length > 2) {
    threads.push({
      id: 'tc_2',
      authorName: m2,
      content: '匿名还这么认真，少见。',
      delayInSeconds: 45,
      replies: [],
    })
  } else if (mutuals.length > 1 && !m2) {
    threads.push({
      id: 'tc_2',
      authorName: m1,
      content: '下一条匿名提问记得@我。',
      delayInSeconds: 48,
      replies: [],
    })
  }

  return {
    characterAnswer: `这条定向提问我看见了。不知道是谁问的，但问题本身值得认真想——我会想清楚再答。`,
    commentThreads: threads,
  }
}

export async function generateDirectedQuestionDualOutput(params: {
  questionBody: string
  targetContact: MockContact
  contacts: MockContact[]
  wechatCtx: AnonymousQaWechatContext | null
}): Promise<DirectedDualOutput> {
  const target = params.targetContact
  const cid = target.characterId?.trim()
  const mutuals = await pickNetworkBoundCommenters(params.contacts, target)
  const mutualRoster =
    mutuals.length > 0
      ? mutuals.map((c) => `- ${c.remarkName}（羁绊角色）`).join('\n')
      : '（暂无羁绊角色）'

  if (!cid || !params.wechatCtx || !apiReadyForQna(params.wechatCtx.apiConfig)) {
    return fallbackOutput(target, mutuals)
  }

  const merged = await buildQnaDirectedMergedSystemPrompt({
    authorCharacterId: cid,
    authorRemarkName: target.remarkName,
    boundSpeakers: mutuals
      .filter((m) => m.characterId)
      .map((m) => ({ characterId: m.characterId!, remarkName: m.remarkName })),
    wechatCtx: params.wechatCtx,
    relevanceHaystack: params.questionBody,
    playerDisplayNameFallback: params.wechatCtx.playerDisplayName.trim() || '朋友',
  })
  if (!merged) return fallbackOutput(target, mutuals)

  const system = merged.system

  const userTask = `${DIRECTED_QUESTION_ANONYMITY_PREMISE}\n\n【定向提问正文 · 提问者身份未知】\n${params.questionBody.trim()}\n\n【被提问角色 · 答主】${target.remarkName}\n\n【羁绊围观名单（一级评论 authorName 只能从中选；答主接话用答主名并 asAuthor:true）】\n${mutualRoster}`

  const messages: OpenAiCompatibleMessage[] = [
    { role: 'system', content: `${system}\n\n${DIRECTED_DUAL_OUTPUT_APPENDIX}` },
    { role: 'user', content: userTask },
  ]

  try {
    const raw = await openAiCompatibleChat(params.wechatCtx.apiConfig, messages, {
      temperature: 0.82,
      max_tokens: 2000,
    })
    const parsed = await normalizeDualOutput(
      safeParseJson<AiPayload>(raw),
      mutuals,
      target,
      params.contacts,
    )
    if (!parsed) return fallbackOutput(target, mutuals)
    return parsed
  } catch {
    return fallbackOutput(target, mutuals)
  }
}

/** @deprecated 旧版扁平列表；新逻辑请用 buildThreadCommentsFromDirectedOutput */
export function resolveCommentAvatars(
  comments: Array<{ authorName: string; id: string; content: string; delayInSeconds: number }>,
  contacts: MockContact[],
): Array<{ authorName: string; authorAvatar: string; authorCharacterId?: string }> {
  return comments.map((c) => {
    const byName = contacts.find((x) => x.remarkName === c.authorName)
    const hit = byName
    return {
      ...c,
      authorAvatar: hit?.avatarUrl?.trim() || '/image/个人名片默认头像1.png',
      authorCharacterId: hit?.characterId,
    }
  })
}
