import type { MockContact } from './types'
import type { DirectedDualOutput } from './directedQuestionAi'
import { buildQnaContactDisplayIndex, resolveContactDisplayName } from './qnaContactDisplay'
import { enrichDirectedCommentsWithRelationLabels } from './qnaDirectedRelationLabel'
import { namesMatch } from './qnaThreadReplyRouting'
import {
  filterDirectedInteractionReplies,
  pickNetworkBoundCommenters,
} from './qnaDirectedNetworkRoster'
import type { QnAThreadComment, QnAThreadReply } from './qnaStoreTypes'

const DEFAULT_AVATAR = '/image/个人名片默认头像1.png'

function resolveContactByDisplay(
  authorName: string,
  contacts: MockContact[],
  displayOf: (raw: string) => string,
) {
  const display = displayOf(authorName.trim())
  const hit = contacts.find((x) => namesMatch(x.remarkName, display))
  return {
    authorAvatar: hit?.avatarUrl?.trim() || DEFAULT_AVATAR,
    authorCharacterId: hit?.characterId,
  }
}

function clampDelay(n: number, fallback: number): number {
  return Math.max(5, Math.min(300, Math.floor(Number(n) || fallback)))
}

/** 首次定向提问 AI 结构 → 带延时解锁的 threadComments（一级 + 楼中楼分明） */
export async function buildThreadCommentsFromDirectedOutput(params: {
  output: DirectedDualOutput
  baseMs: number
  contacts: MockContact[]
  targetCharacterId: string
  targetCharacterName: string
  targetCharacterAvatar?: string
}): Promise<QnAThreadComment[]> {
  const { output, baseMs, contacts, targetCharacterId, targetCharacterName, targetCharacterAvatar } =
    params
  const authorAvatar = targetCharacterAvatar?.trim() || DEFAULT_AVATAR
  const threads: QnAThreadComment[] = []
  const targetContact: MockContact = {
    id: targetCharacterId,
    remarkName: targetCharacterName,
    characterId: targetCharacterId,
    avatarUrl: targetCharacterAvatar,
  }
  const bound = await pickNetworkBoundCommenters(contacts, targetContact)
  const contactIndex = await buildQnaContactDisplayIndex([...contacts, targetContact])
  const displayOf = (raw: string) => resolveContactDisplayName(raw, contactIndex)
  const targetDisplay = displayOf(targetCharacterName)
  const allowedTopNames = new Set(bound.map((c) => displayOf(c.remarkName)))

  for (let ti = 0; ti < output.commentThreads.length; ti++) {
    const row = output.commentThreads[ti]
    const topAuthor = displayOf(row.authorName)
    if (allowedTopNames.size > 0 && !allowedTopNames.has(topAuthor)) continue
    const topDelay = clampDelay(row.delayInSeconds, 12 + ti * 18)
    const topVisibleAt = baseMs + topDelay * 1000
    const topResolved = resolveContactByDisplay(row.authorName, contacts, displayOf)

    const replyRows = row.replies.map((r, ri) => {
      const replyDelay = clampDelay(r.delayInSeconds, topDelay + 4 + ri * 6)
      const replyAuthor = displayOf(r.authorName)
      const isAuthor =
        r.asAuthor === true || namesMatch(replyAuthor, targetDisplay)
      const resolved = isAuthor
        ? { authorAvatar, authorCharacterId: targetCharacterId }
        : resolveContactByDisplay(r.authorName, contacts, displayOf)
      return {
        id: r.id,
        authorName: replyAuthor,
        replyToName: displayOf(r.replyToName),
        content: r.content,
        delayInSeconds: replyDelay,
        asAuthor: isAuthor,
        ...resolved,
      }
    })

    const filteredReplyRows = await filterDirectedInteractionReplies(replyRows, {
      authorName: targetDisplay,
      authorId: targetCharacterId,
      playerWechatNickname: '',
      bound,
    })

    const enrichedReplies = await enrichDirectedCommentsWithRelationLabels({
      targetCharacterId,
      comments: filteredReplyRows.map((r) => ({
        authorCharacterId: r.authorCharacterId,
        authorName: r.authorName,
      })),
    })

    const replies: QnAThreadReply[] = filteredReplyRows.map((r, ri) => {
      const replyDelay = clampDelay(r.delayInSeconds, topDelay + 4 + ri * 6)
      const visibleAt = baseMs + replyDelay * 1000
      const isAuthor = r.asAuthor === true
      return {
        id: r.id,
        createdAt: visibleAt,
        visibleAt,
        authorType: isAuthor ? 'author' : 'character',
        authorName: r.authorName,
        authorAvatar: r.authorAvatar,
        authorCharacterId: r.authorCharacterId,
        relationLabel: isAuthor ? '答主' : enrichedReplies[ri]?.relationLabel,
        replyToName: r.replyToName,
        content: r.content,
      }
    })

    const topEnriched = await enrichDirectedCommentsWithRelationLabels({
      targetCharacterId,
      comments: [{ authorCharacterId: topResolved.authorCharacterId, authorName: topAuthor }],
    })

    threads.push({
      id: row.id,
      createdAt: topVisibleAt,
      visibleAt: topVisibleAt,
      authorType: 'character',
      authorName: topAuthor,
      authorAvatar: topResolved.authorAvatar,
      authorCharacterId: topResolved.authorCharacterId,
      relationLabel: topEnriched[0]?.relationLabel,
      content: row.content,
      replies,
      fromBondEcho: true,
    })
  }

  return threads
}
