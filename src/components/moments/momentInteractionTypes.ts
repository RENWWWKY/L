/** 角色异步互动（仅存 charId，渲染时查通讯录） */
import {
  alignCharacterInteractionTiming,
  alignThreadedCommentDelays,
  clampMomentInteractionDelay,
  realignInteractionVisibleAt,
  staggerCrossCharacterDelays,
} from './momentInteractionTiming'
import type { PublisherSelfCommentDraft } from './momentCharacterPublishTypes'
import type { MomentComment } from './mockMoments'

export interface MomentInteraction {
  id: string
  charId: string
  type: 'like' | 'comment' | 'viewed'
  content?: string
  /** 解锁时间戳：发表时 Date.now() + delaySeconds * 1000 */
  visibleAt: number
  replyToCharId?: string
  /** 回复的目标评论互动 id */
  replyToInteractionId?: string
  /** 回复 stored 用户评论 id（唤起回应） */
  replyToCommentId?: string
  /** 发布者本人对评论的回复 */
  isAuthorReply?: boolean
  /** 发布者在自己动态下的评论区自评补充（非回复他人） */
  isPublisherSelfComment?: boolean
  /** 仅 viewed：停留秒数 */
  dwellSeconds?: number
}

export type AiMomentInteractionDraft = {
  charId: string
  type: 'like' | 'comment' | 'viewed'
  content?: string
  delaySeconds: number
  replyToCharId?: string
  dwellSeconds?: number
}

export function createInteractionId(): string {
  return `ix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 已有点赞/评论的角色 id（不含 viewed） */
export function collectEngagedCharacterIds(
  items: ReadonlyArray<Pick<AiMomentInteractionDraft | MomentInteraction, 'charId' | 'type'>>,
): Set<string> {
  const engaged = new Set<string>()
  for (const item of items) {
    if (item.type !== 'like' && item.type !== 'comment') continue
    const id = item.charId.trim()
    if (id) engaged.add(id)
  }
  return engaged
}

/** 去掉已有 like/comment 的角色的 viewed（访客仅表示沉默浏览） */
export function stripViewedForEngagedCharacters(
  drafts: AiMomentInteractionDraft[],
): AiMomentInteractionDraft[] {
  const engaged = collectEngagedCharacterIds(drafts)
  if (!engaged.size) return drafts
  return drafts.filter((d) => d.type !== 'viewed' || !engaged.has(d.charId.trim()))
}

export function stripViewedInteractionsForEngagedCharacters(
  interactions: MomentInteraction[],
): MomentInteraction[] {
  const engaged = collectEngagedCharacterIds(interactions)
  if (!engaged.size) return interactions
  return interactions.filter((ix) => ix.type !== 'viewed' || !engaged.has(ix.charId.trim()))
}

export function materializeInteractions(
  drafts: AiMomentInteractionDraft[],
  publishedAt: number,
  immediate = false,
): MomentInteraction[] {
  const cleaned = stripViewedForEngagedCharacters(drafts)
  const aligned = alignThreadedCommentDelays(
    staggerCrossCharacterDelays(alignCharacterInteractionTiming(cleaned)),
  )
  const sortedDrafts = [...aligned].sort(
    (a, b) => a.delaySeconds - b.delaySeconds || a.charId.localeCompare(b.charId),
  )

  const interactions: MomentInteraction[] = []
  const lastCommentIdByChar = new Map<string, string>()

  for (const d of sortedDrafts) {
    const ix: MomentInteraction = {
      id: createInteractionId(),
      charId: d.charId,
      type: d.type,
      content: d.type === 'comment' ? d.content?.trim() : undefined,
      visibleAt: immediate
        ? publishedAt
        : publishedAt + Math.max(0, d.delaySeconds) * 1000,
      replyToCharId: d.replyToCharId,
      dwellSeconds: d.type === 'viewed' ? d.dwellSeconds : undefined,
    }
    if (d.type === 'comment') {
      const replyToChar = d.replyToCharId?.trim()
      if (replyToChar) {
        const parentId = lastCommentIdByChar.get(replyToChar)
        if (parentId) ix.replyToInteractionId = parentId
      }
      lastCommentIdByChar.set(d.charId.trim(), ix.id)
    }
    interactions.push(ix)
  }

  return alignInteractionVisibleAtToParents(interactions)
}

export type ElicitReplyInteractionDraft = {
  authorCharId: string
  content: string
  replyToCommentId: string
  replyToCharId?: string
  delaySeconds?: number
  /** 发布者本人回复为 true；共同好友评区回复为 false */
  isAuthorReply?: boolean
}

/** 子回复解锁时间仅须严格晚于直接父评论（具体间隔由 AI delay 决定） */
const MIN_AFTER_PARENT_MS = 1

function alignInteractionVisibleAtToParents(
  interactions: MomentInteraction[],
  gapMs = MIN_AFTER_PARENT_MS,
): MomentInteraction[] {
  const byId = new Map(interactions.map((ix) => [ix.id, ix]))
  let changed = true
  let guard = 0
  const out = interactions.map((ix) => ({ ...ix }))

  while (changed && guard <= out.length + 2) {
    changed = false
    guard += 1
    for (const ix of out) {
      if (ix.type !== 'comment') continue
      const parentId = ix.replyToInteractionId?.trim()
      if (!parentId) continue
      const parent = byId.get(parentId)
      if (!parent) continue
      const minVisibleAt = parent.visibleAt + gapMs
      if (ix.visibleAt < minVisibleAt) {
        ix.visibleAt = minVisibleAt
        changed = true
      }
    }
  }

  return out
}

export type CommentReplyAnchor = {
  visibleAt: number
  charId?: string
  interactionId?: string
}

/** 解析回复锚点（stored 评论或已物化互动），用于对齐解锁时间与引用对象 */
export function resolveCommentReplyAnchor(
  targetId: string,
  comments: MomentComment[] | undefined,
  interactions: MomentInteraction[] | undefined,
): CommentReplyAnchor | null {
  const id = targetId.trim()
  if (!id) return null

  for (const c of comments ?? []) {
    if (c.id !== id || c.isAuthorReply) continue
    const visibleAt =
      typeof c.createdAt === 'number' && Number.isFinite(c.createdAt) ? c.createdAt : 0
    return {
      visibleAt,
      charId: c.authorCharacterId,
    }
  }

  for (const ix of interactions ?? []) {
    if (ix.id !== id || ix.type !== 'comment') continue
    return {
      visibleAt: ix.visibleAt,
      charId: ix.charId,
      interactionId: ix.id,
    }
  }

  return null
}

/** 唤起回应：将 AI 回复写入 interactions，支持延时解锁 */
export function materializeElicitReplyInteractions(
  drafts: ElicitReplyInteractionDraft[],
  startedAt: number,
  immediate = false,
  anchorContext?: {
    comments?: MomentComment[]
    interactions?: MomentInteraction[]
  },
): MomentInteraction[] {
  const comments = anchorContext?.comments ?? []
  const interactions = anchorContext?.interactions ?? []

  return drafts
    .map((d) => ({
      ...d,
      content: d.content.trim(),
    }))
    .filter((d) => d.content)
    .map((d, index) => {
      const baseDelay = d.delaySeconds ?? 35 + index * 30
      const delay = immediate ? 0 : clampInteractionDelay(baseDelay)
      let visibleAt = immediate ? startedAt : startedAt + delay * 1000

      const anchor = resolveCommentReplyAnchor(d.replyToCommentId, comments, interactions)
      let replyToCharId = d.replyToCharId?.trim()
      let replyToInteractionId: string | undefined

      if (anchor) {
        visibleAt = Math.max(visibleAt, anchor.visibleAt + MIN_AFTER_PARENT_MS)
        if (!replyToCharId && anchor.charId?.trim()) {
          replyToCharId = anchor.charId.trim()
        }
        if (anchor.interactionId) {
          replyToInteractionId = anchor.interactionId
        }
      }

      return {
        id: createInteractionId(),
        charId: d.authorCharId,
        type: 'comment' as const,
        content: d.content,
        visibleAt,
        replyToCommentId: d.replyToCommentId,
        ...(replyToCharId ? { replyToCharId } : {}),
        ...(replyToInteractionId ? { replyToInteractionId } : {}),
        isAuthorReply: d.isAuthorReply ?? true,
      }
    })
}

/** 用户新发评论后，将尚未解锁的互动顺延到其之后（保持底部时序） */
export function reanchorPendingInteractionsAfterUserComment(
  interactions: MomentInteraction[],
  userCommentCreatedAt: number,
): MomentInteraction[] {
  const now = Date.now()
  let pendingIndex = 0
  return interactions.map((ix) => {
    if (ix.visibleAt <= now) return ix
    pendingIndex += 1
    const minVisibleAt = userCommentCreatedAt + 1500 + pendingIndex * 1200
    if (ix.visibleAt >= minVisibleAt) return ix
    return { ...ix, visibleAt: minVisibleAt }
  })
}

export function getUnlockedInteractions(
  interactions: MomentInteraction[] | undefined,
  now: number,
): MomentInteraction[] {
  return (interactions ?? []).filter((i) => i.visibleAt <= now)
}

/** 将尚未解锁的互动全部提前到当前时刻（单条动态访客面板「直接显示」） */
export function revealAllPendingMomentInteractions(
  interactions: MomentInteraction[] | undefined,
  now: number,
): MomentInteraction[] | null {
  if (!interactions?.length) return null
  let changed = false
  const next = interactions.map((ix) => {
    if (ix.visibleAt <= now) return ix
    changed = true
    return { ...ix, visibleAt: now }
  })
  return changed ? next : null
}

function clampInteractionDelay(seconds: number): number {
  return clampMomentInteractionDelay(seconds)
}

/** 瞬时生成：一次性物化点赞、评论与发布者回复（回复解锁 = 评论 visibleAt + reply.delaySeconds） */
export type InstantGenInteractionInput = {
  type: 'like' | 'comment'
  authorId: string
  delaySeconds: number
  id?: string
  content?: string
  replyTo?: string
  reply?: { content: string; delaySeconds: number }
}

export function materializeInstantGenInteractions(
  drafts: InstantGenInteractionInput[],
  publishedAt: number,
  authorCharId: string,
): MomentInteraction[] {
  const out: MomentInteraction[] = []
  const draftIdToInteraction = new Map<string, { id: string; charId: string }>()

  for (const d of drafts) {
    if (d.type === 'like') {
      out.push({
        id: createInteractionId(),
        charId: d.authorId,
        type: 'like',
        visibleAt: publishedAt + clampInteractionDelay(d.delaySeconds) * 1000,
      })
      continue
    }

    const commentId = d.id?.trim() || createInteractionId()
    const commentVisibleAt = publishedAt + clampInteractionDelay(d.delaySeconds) * 1000
    const replyToRef = d.replyTo?.trim()
    const parent = replyToRef ? draftIdToInteraction.get(replyToRef) : undefined
    const replyContent = d.reply?.content?.trim()
    const isPublisherSelfComment =
      d.authorId.trim() === authorCharId.trim() && !replyToRef && !replyContent

    out.push({
      id: commentId,
      charId: d.authorId,
      type: 'comment',
      content: d.content?.trim(),
      visibleAt: commentVisibleAt,
      ...(isPublisherSelfComment ? { isPublisherSelfComment: true } : {}),
      ...(parent
        ? {
            replyToInteractionId: parent.id,
            replyToCharId: parent.charId,
          }
        : {}),
    })
    if (d.id?.trim()) {
      draftIdToInteraction.set(d.id.trim(), { id: commentId, charId: d.authorId })
    }
    draftIdToInteraction.set(commentId, { id: commentId, charId: d.authorId })

    if (replyContent) {
      const replyDelay = clampInteractionDelay(d.reply?.delaySeconds ?? 90)
      out.push({
        id: createInteractionId(),
        charId: authorCharId,
        type: 'comment',
        content: replyContent,
        visibleAt: commentVisibleAt + replyDelay * 1000,
        replyToInteractionId: commentId,
        replyToCharId: d.authorId,
        isAuthorReply: true,
      })
    }
  }

  return realignInteractionVisibleAt(out, publishedAt)
}

/** 发布者在自己动态下的评论区自评补充 */
export function materializePublisherSelfComments(
  drafts: PublisherSelfCommentDraft[],
  publisherCharId: string,
  publishedAt: number,
  immediate = false,
): MomentInteraction[] {
  const publisherId = publisherCharId.trim()
  if (!publisherId) return []

  return drafts
    .map((d) => ({
      content: d.content.trim(),
      delaySeconds: d.delaySeconds ?? 45,
    }))
    .filter((d) => d.content)
    .map((d, index) => {
      const delay = immediate ? 0 : clampInteractionDelay(d.delaySeconds + index * 20)
      return {
        id: createInteractionId(),
        charId: publisherId,
        type: 'comment' as const,
        content: d.content,
        visibleAt: immediate ? publishedAt : publishedAt + delay * 1000,
        isPublisherSelfComment: true,
      }
    })
}
