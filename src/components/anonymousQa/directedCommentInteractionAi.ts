import { openAiCompatibleChat, type OpenAiCompatibleMessage } from '../../phone/apps/wechat/newFriendsPersona/ai'
import type { MockContact } from './types'
import type { QnADirectedPost, QnAThreadReply } from './qnaStoreTypes'
import type { AnonymousQaWechatContext } from './buildAnonymousQaPersonaContext'
import { enrichDirectedCommentsWithRelationLabels } from './qnaDirectedRelationLabel'
import {
  apiReadyForQna,
  buildQnaDirectedInteractionMessages,
} from './qnaCharacterMemoryPrompt'
import {
  buildDirectedInteractionRosterText,
  filterDirectedInteractionReplies,
  pickNetworkBoundCommenters,
} from './qnaDirectedNetworkRoster'
import {
  buildQnaContactDisplayIndex,
  resolveCharacterIdByDisplayName,
  resolveContactDisplayName,
} from './qnaContactDisplay'
import {
  describeInteractionParseFailure,
  parseInteractionRepliesFromRaw,
} from './qnaDirectedJsonParse'
import {
  DIRECTED_ANONYMOUS_AUTHOR,
  DIRECTED_COMMENT_DRAMA_RULES,
  DIRECTED_QUESTION_ANONYMITY_PREMISE,
  normalizeDirectedPlayerReplyToName,
} from './qnaDirectedPlayerDisplay'

export class DirectedInteractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DirectedInteractionError'
  }
}

function buildInteractionAppendix(playerTargetLabel: string): string {
  return `
---
【输出格式 · 必须遵守】
生成 3~4 条连续群聊式回复，放入 replies 数组。

规则：
1) 第一条须为名单内羁绊角色，replyToName 为「${playerTargetLabel}」；
2) authorName / replyToName 必须与名单中的**通讯录展示名**完全一致（备注优先，无备注即微信昵称），禁止用人设真实姓名；
3) authorType 为 "character" 或 "author"；
4) 彼此无人脉直接关系的羁绊禁止互接；有敌对/情敌/竞争等人脉边的可在楼中楼互怼（修罗场），须贴合人设、禁止 OOC；
5) 每条 content 15~45 字；禁止 Emoji；
6) 鼓励至少一条羁绊↔羁绊互怼或拆台（须有人脉/情敌/竞争依据），不必全员只对玩家客气。

示例（字段名不可改，内容须自拟）：
{"replies":[{"id":"r1","authorName":"羁绊名","authorType":"character","replyToName":"${playerTargetLabel}","content":"……","delayInSeconds":2}]}

${DIRECTED_COMMENT_DRAMA_RULES}
`.trim()
}

type AiReplyRow = {
  id?: string
  authorName?: string
  authorType?: string
  replyToName?: string
  content?: string
  delayInSeconds?: number
}

export function buildStaggeredThreadReplies(
  rows: Array<{
    id: string
    authorType: 'author' | 'character'
    authorName: string
    authorAvatar: string
    authorCharacterId?: string
    relationLabel?: string
    replyToName?: string
    content: string
    delayInSeconds: number
  }>,
  baseMs = Date.now(),
): QnAThreadReply[] {
  return rows.map((r) => {
    const delay = Math.max(0, Math.floor(r.delayInSeconds))
    return {
      id: r.id,
      createdAt: baseMs,
      authorType: r.authorType,
      authorName: r.authorName,
      authorAvatar: r.authorAvatar,
      authorCharacterId: r.authorCharacterId,
      relationLabel: r.relationLabel,
      replyToName: r.replyToName,
      content: r.content,
      visibleAt: baseMs + delay * 1000,
    }
  })
}

async function requestInteractionReplies(
  cfg: NonNullable<AnonymousQaWechatContext['apiConfig']>,
  messages: OpenAiCompatibleMessage[],
): Promise<string> {
  return openAiCompatibleChat(cfg, messages, {
    temperature: 0.55,
    max_tokens: 2000,
  })
}

export async function generateDirectedThreadInteraction(params: {
  post: QnADirectedPost
  userComment: string
  playerWechatNickname: string
  userCommentAnonymous?: boolean
  contacts: MockContact[]
  wechatCtx: AnonymousQaWechatContext | null
  replyToName?: string
  replyToContent?: string
}): Promise<QnAThreadReply[]> {
  const { post, userComment, contacts, wechatCtx } = params
  const replyToName = params.replyToName?.trim()
  const replyToContent = params.replyToContent?.trim()
  const authorId = post.targetCharacterId.trim()
  const authorName = post.targetCharacterName.trim()
  const playerWx = params.playerWechatNickname.trim() || '我'
  const userCommentAnonymous = params.userCommentAnonymous === true
  const playerTargetLabel = userCommentAnonymous ? DIRECTED_ANONYMOUS_AUTHOR : playerWx
  const interactionAppendix = buildInteractionAppendix(playerTargetLabel)

  if (!wechatCtx || !apiReadyForQna(wechatCtx.apiConfig)) {
    throw new DirectedInteractionError('请先在设置中配置可用的模型 API')
  }

  const targetContact: MockContact = {
    id: post.targetContactId ?? post.targetCharacterId,
    remarkName: authorName,
    characterId: authorId,
    avatarUrl: post.targetCharacterAvatar,
  }
  const bound = await pickNetworkBoundCommenters(contacts, targetContact)
  if (!bound.length) {
    throw new DirectedInteractionError('答主暂无已绑定人脉的羁绊角色，无法触发互动')
  }

  const contactIndex = await buildQnaContactDisplayIndex(contacts)
  const displayAuthorName = resolveContactDisplayName(authorName, contactIndex)
  const roster = buildDirectedInteractionRosterText(bound, displayAuthorName, authorId, playerWx, {
    userCommentAnonymous,
  })
  const haystack = `${post.question}\n${post.characterAnswer}\n${userComment}`

  const replyCtx =
    replyToName && replyToContent
      ? `\n\n【玩家正在回复】${replyToName}：${replyToContent}`
      : replyToName
        ? `\n\n【玩家回复对象】${replyToName}`
        : ''

  const userTask = `${DIRECTED_QUESTION_ANONYMITY_PREMISE}\n\n【定向提问 · 提问者身份未知】\n${post.question}\n\n【答主 ${displayAuthorName} 的回答】\n${post.characterAnswer}\n\n【玩家评论】\n${userComment.trim()}${replyCtx}\n\n【可出场名单 · authorName/replyToName 必须与下列展示名完全一致】\n${roster}`

  const built = await buildQnaDirectedInteractionMessages({
    authorCharacterId: authorId,
    authorRemarkName: displayAuthorName,
    boundSpeakers: bound
      .filter((c) => c.characterId)
      .map((c) => ({ characterId: c.characterId!, remarkName: c.remarkName })),
    wechatCtx,
    relevanceHaystack: haystack,
    userTaskBody: userTask,
    formatAppendix: interactionAppendix,
    playerDisplayNameFallback: playerWx,
    playerWechatNickname: playerWx,
    userCommentAnonymous,
  })

  if (!built) {
    throw new DirectedInteractionError('答主角色档案加载失败，请检查人设是否完整')
  }

  const cfg = wechatCtx.apiConfig!
  let rawRows: AiReplyRow[] = []

  try {
    let raw = await requestInteractionReplies(cfg, built.messages)
    let replies = parseInteractionRepliesFromRaw(raw)

    if (!replies?.length) {
      const retryMessages: OpenAiCompatibleMessage[] = [
        {
          role: 'system',
          content:
            '你只输出一个 JSON 对象，形如 {"replies":[...]}。禁止 Markdown、禁止解释、禁止空字段。',
        },
        {
          role: 'user',
          content: `${userTask}\n\n【玩家评论区展示名】${playerTargetLabel}\n\n${interactionAppendix}`,
        },
      ]
      raw = await requestInteractionReplies(cfg, retryMessages)
      replies = parseInteractionRepliesFromRaw(raw)
    }

    if (!replies?.length) {
      throw new DirectedInteractionError(describeInteractionParseFailure(raw))
    }
    rawRows = replies as AiReplyRow[]
  } catch (e) {
    if (e instanceof DirectedInteractionError) throw e
    const msg = e instanceof Error ? e.message.trim() : ''
    throw new DirectedInteractionError(msg ? `模型请求失败：${msg}` : '模型请求失败，请稍后重试')
  }

  const filtered = await filterDirectedInteractionReplies(rawRows, {
    authorName: displayAuthorName,
    authorId,
    playerWechatNickname: built.playerWechatNickname,
    playerIdentityName: built.playerIdentityName,
    userCommentAnonymous: built.userCommentAnonymous,
    bound,
  })

  const normalized = filtered
    .slice(0, 5)
    .map((r, i) => ({
      id: String(r.id ?? `tr_${i}`).trim() || `tr_${i}`,
      authorName: resolveContactDisplayName(String(r.authorName ?? displayAuthorName).trim(), contactIndex),
      authorType: (r.authorType === 'author' ? 'author' : 'character') as QnAThreadReply['authorType'],
      replyToName: normalizeDirectedPlayerReplyToName(
        resolveContactDisplayName(String(r.replyToName ?? playerTargetLabel).trim(), contactIndex),
        {
          wechatNickname: built.playerWechatNickname,
          identityName: built.playerIdentityName,
          anonymousLabel: built.userCommentAnonymous ? DIRECTED_ANONYMOUS_AUTHOR : undefined,
        },
      ),
      content: String(r.content ?? '').trim(),
      delayInSeconds: Math.max(1, Math.min(120, Math.floor(Number(r.delayInSeconds) || 2 + i * 3))),
    }))
    .filter((r) => r.content.length > 0)

  if (!normalized.length) {
    throw new DirectedInteractionError('生成内容为空或不符合人脉规则，请重试')
  }

  const withAvatars = normalized.map((r) => {
    if (r.authorType === 'author') {
      return {
        ...r,
        authorAvatar: post.targetCharacterAvatar?.trim() || '/image/个人名片默认头像1.png',
        authorCharacterId: authorId,
        relationLabel: '答主',
      }
    }
    const cid = resolveCharacterIdByDisplayName(r.authorName, contactIndex)
    const hit =
      (cid ? bound.find((c) => c.characterId === cid) ?? contacts.find((c) => c.characterId === cid) : null) ??
      bound.find((c) => c.remarkName === r.authorName) ??
      contacts.find((c) => c.remarkName === r.authorName)
    return {
      ...r,
      authorAvatar: hit?.avatarUrl?.trim() || '/image/个人名片默认头像1.png',
      authorCharacterId: hit?.characterId,
    }
  })

  const enriched = await enrichDirectedCommentsWithRelationLabels({
    targetCharacterId: authorId,
    comments: withAvatars.map((r) => ({
      authorCharacterId: r.authorCharacterId,
      authorName: r.authorName,
    })),
  })

  const rowsForStagger = withAvatars.map((r, i) => ({
    id: r.id,
    authorType: r.authorType as 'author' | 'character',
    authorName: r.authorName,
    authorAvatar: r.authorAvatar,
    authorCharacterId: r.authorCharacterId,
    relationLabel: r.authorType === 'author' ? '答主' : enriched[i]?.relationLabel,
    replyToName: r.replyToName,
    content: r.content,
    delayInSeconds: r.delayInSeconds,
  }))

  return buildStaggeredThreadReplies(rowsForStagger)
}
