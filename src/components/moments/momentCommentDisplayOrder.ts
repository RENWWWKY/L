import type { MomentComment } from './mockMoments'
import type { MomentInteraction } from './momentInteractionTypes'

/** 紧跟在某条评论后的连续角色回复（唤起回应插入的一批） */
export function gatherContiguousRepliesAfter(
  comments: MomentComment[],
  anchorId: string,
): MomentComment[] {
  const anchorIndex = comments.findIndex((c) => c.id === anchorId)
  if (anchorIndex < 0) return []

  const out: MomentComment[] = []
  for (let i = anchorIndex + 1; i < comments.length; i++) {
    const c = comments[i]!
    if (!c.isAuthorReply) break
    out.push(c)
  }
  return out
}

export type MomentCommentDisplayRow = {
  id: string
  sortAt: number
  kind: 'user' | 'ai' | 'stored-author'
  author: string
  content: string
  replyTo?: string
  replyToName?: string
  charId?: string
  replyToCharId?: string
  replyToInteractionId?: string
  replyToCommentId?: string
}

const THREAD_SORT_GAP_MS = 50

/** 仅按明确父评论 id 定位（不用 replyToCharId 猜，避免挂到错误父评） */
function findExplicitParentRowById(
  row: MomentCommentDisplayRow,
  rowById: Map<string, MomentCommentDisplayRow>,
): MomentCommentDisplayRow | undefined {
  const parentId = row.replyToInteractionId?.trim() || row.replyToCommentId?.trim()
  if (!parentId) return undefined
  return rowById.get(parentId)
}

/**
 * 递归 effectiveSortAt：子回复须晚于被回复的那条父评论，可与无关首评穿插。
 * 例：C1 → C2 → C3 → R4→C3 → R4→C1
 */
function applyEffectiveCommentSortAt(rows: MomentCommentDisplayRow[]): MomentCommentDisplayRow[] {
  const rowById = new Map(rows.map((row) => [row.id, row]))
  const cache = new Map<string, number>()

  const effectiveSortAt = (row: MomentCommentDisplayRow): number => {
    const hit = cache.get(row.id)
    if (hit != null) return hit

    let sortAt = row.sortAt
    const parent = findExplicitParentRowById(row, rowById)
    if (parent) {
      sortAt = Math.max(sortAt, effectiveSortAt(parent) + THREAD_SORT_GAP_MS)
    }

    cache.set(row.id, sortAt)
    return sortAt
  }

  return rows
    .map((row) => ({ ...row, sortAt: effectiveSortAt(row) }))
    .sort((a, b) => a.sortAt - b.sortAt || a.id.localeCompare(b.id))
}

function resolveCommentCreatedAt(
  comment: MomentComment,
  index: number,
  commentById: Map<string, MomentComment>,
): number {
  if (typeof comment.createdAt === 'number' && Number.isFinite(comment.createdAt)) {
    return comment.createdAt
  }
  if (comment.isAuthorReply) {
    const parentId = comment.replyToCommentId?.trim()
    const parent = parentId ? commentById.get(parentId) : undefined
    if (parent) {
      return resolveCommentCreatedAt(parent, index, commentById) + 400
    }
  }
  return index * 1000 + 100
}

type CommentAuthorRef = {
  author: string
  charId?: string
}

function buildCommentAuthorIndex(
  comments: MomentComment[],
  commentInteractions: MomentInteraction[],
  resolveAuthorName: (charId: string) => string,
): Map<string, CommentAuthorRef> {
  const byId = new Map<string, CommentAuthorRef>()
  for (const c of comments) {
    byId.set(c.id, {
      author: c.author.trim(),
      charId: c.authorCharacterId,
    })
  }
  for (const ix of commentInteractions) {
    if (ix.type !== 'comment') continue
    byId.set(ix.id, {
      author: resolveAuthorName(ix.charId),
      charId: ix.charId,
    })
  }
  return byId
}

function inferDisplayParentInteractionId(
  ix: MomentInteraction,
  commentInteractions: MomentInteraction[],
): string | undefined {
  const explicit = ix.replyToInteractionId?.trim()
  if (explicit) return explicit

  const commentId = ix.replyToCommentId?.trim()
  if (commentId && commentInteractions.some((row) => row.id === commentId)) {
    return commentId
  }

  const replyToCharId = ix.replyToCharId?.trim()
  if (!replyToCharId) return undefined

  const rootComments = commentInteractions.filter(
    (row) =>
      row.type === 'comment' &&
      row.id !== ix.id &&
      row.charId.trim() === replyToCharId &&
      !row.replyToCharId?.trim(),
  )
  if (rootComments.length === 1) return rootComments[0]!.id
  if (!rootComments.length) return undefined

  return [...rootComments].sort(
    (a, b) =>
      Math.abs(a.visibleAt - ix.visibleAt) - Math.abs(b.visibleAt - ix.visibleAt) ||
      a.visibleAt - b.visibleAt,
  )[0]!.id
}

function canDisplayCommentInteraction(
  ix: MomentInteraction,
  now: number,
  comments: MomentComment[],
  commentInteractions: MomentInteraction[],
): boolean {
  if (ix.type !== 'comment' || ix.visibleAt > now) return false

  const parentId = inferDisplayParentInteractionId(ix, commentInteractions)
  if (!parentId) return true

  const stored = comments.find((c) => c.id === parentId && !c.isAuthorReply)
  if (stored) return true

  const parent = commentInteractions.find((row) => row.id === parentId)
  if (!parent) return true
  return parent.visibleAt <= now
}

function resolveInteractionReplyToName(
  ix: MomentInteraction,
  authorById: Map<string, CommentAuthorRef>,
  commentInteractions: MomentInteraction[],
  resolveAuthorName: (charId: string) => string,
): string | undefined {
  const parentId = inferDisplayParentInteractionId(ix, commentInteractions)
  if (parentId) {
    const fromId = resolveReplyTargetAuthorName(parentId, authorById)
    if (fromId) return fromId
  }
  if (ix.replyToCommentId?.trim()) {
    const fromId = resolveReplyTargetAuthorName(ix.replyToCommentId, authorById)
    if (fromId) return fromId
  }
  if (ix.replyToCharId?.trim()) {
    return resolveAuthorName(ix.replyToCharId.trim())
  }
  return undefined
}

function resolveReplyTargetAuthorName(
  replyToCommentId: string | undefined,
  authorById: Map<string, CommentAuthorRef>,
): string | undefined {
  const id = replyToCommentId?.trim()
  if (!id) return undefined
  return authorById.get(id)?.author
}

function inferReplyToPublisherFromPriorRows(
  row: MomentCommentDisplayRow,
  priorRows: MomentCommentDisplayRow[],
  publisherCharId: string,
  resolveAuthorName: (charId: string) => string,
): string | undefined {
  if (!row.charId || row.charId === publisherCharId) return undefined
  const authorName = row.author.trim()
  for (let i = priorRows.length - 1; i >= 0; i--) {
    const prev = priorRows[i]!
    if (prev.charId !== publisherCharId) continue
    if (prev.replyTo?.trim() === authorName) {
      return resolveAuthorName(publisherCharId)
    }
  }
  return undefined
}

/** 评论区按 visibleAt 平铺；子回复仅等待其直接父评论解锁，可与无关一级评论穿插 */
export function buildFlatCommentTimeline(params: {
  comments: MomentComment[]
  /** 全部 comment 互动（含未解锁），用于引用解析与父链校验 */
  commentInteractions: MomentInteraction[]
  now: number
  resolveAuthorName: (charId: string) => string
  publisherCharacterId?: string
}): MomentCommentDisplayRow[] {
  const { comments, commentInteractions, now, resolveAuthorName, publisherCharacterId } = params
  const commentById = new Map(comments.map((c) => [c.id, c]))
  const authorById = buildCommentAuthorIndex(comments, commentInteractions, resolveAuthorName)
  const rows: MomentCommentDisplayRow[] = []

  comments.forEach((c, index) => {
    const sortAt = resolveCommentCreatedAt(c, index, commentById)
    if (c.isAuthorReply) {
      const replyToName =
        resolveReplyTargetAuthorName(c.replyToCommentId, authorById) ??
        c.replyTo?.trim() ??
        '你'
      rows.push({
        id: c.id,
        sortAt,
        kind: 'stored-author',
        author: c.author,
        content: c.content,
        replyToName,
        replyToCommentId: c.replyToCommentId,
      })
      return
    }
    rows.push({
      id: c.id,
      sortAt,
      kind: 'user',
      author: c.author,
      content: c.content,
      replyTo: c.replyTo,
    })
  })

  for (const ix of commentInteractions) {
    if (ix.type !== 'comment' || !ix.content?.trim()) continue
    if (!canDisplayCommentInteraction(ix, now, comments, commentInteractions)) {
      continue
    }

    const replyToName = resolveInteractionReplyToName(
      ix,
      authorById,
      commentInteractions,
      resolveAuthorName,
    )

    const parentInteractionId = inferDisplayParentInteractionId(ix, commentInteractions)

    rows.push({
      id: ix.id,
      sortAt: ix.visibleAt,
      kind: 'ai',
      author: resolveAuthorName(ix.charId),
      content: ix.content,
      replyTo: replyToName,
      charId: ix.charId,
      replyToCharId: ix.replyToCharId,
      replyToInteractionId: parentInteractionId,
      replyToCommentId: ix.replyToCommentId,
    })
  }

  const sorted = rows.sort((a, b) => a.sortAt - b.sortAt || a.id.localeCompare(b.id))
  const ordered = applyEffectiveCommentSortAt(sorted)
  const publisherId = publisherCharacterId?.trim()
  if (!publisherId) return ordered

  return ordered.map((row, index) => {
    if (row.kind !== 'ai' || row.replyTo?.trim()) return row
    const inferred = inferReplyToPublisherFromPriorRows(
      row,
      ordered.slice(0, index),
      publisherId,
      resolveAuthorName,
    )
    if (!inferred) return row
    return { ...row, replyTo: inferred }
  })
}

export function splitCommentsForDisplay(
  comments: MomentComment[],
  playerName: string,
): {
  nonPlayerComments: MomentComment[]
  playerComments: MomentComment[]
  authorRepliesByCommentId: Map<string, MomentComment[]>
  contiguousRepliesByPlayerId: Map<string, MomentComment[]>
} {
  const player = playerName.trim()
  const nonPlayerComments: MomentComment[] = []
  const playerComments: MomentComment[] = []
  const authorRepliesByCommentId = new Map<string, MomentComment[]>()
  const contiguousRepliesByPlayerId = new Map<string, MomentComment[]>()
  const consumedReplyIds = new Set<string>()

  for (const c of comments) {
    if (player && !c.isAuthorReply && c.author.trim() === player) {
      playerComments.push(c)
      const replies = gatherContiguousRepliesAfter(comments, c.id)
      if (replies.length) {
        contiguousRepliesByPlayerId.set(c.id, replies)
        for (const r of replies) consumedReplyIds.add(r.id)
      }
    }
  }

  for (const c of comments) {
    if (consumedReplyIds.has(c.id)) continue

    if (c.isAuthorReply) {
      const parentId = c.replyToCommentId?.trim()
      if (parentId) {
        const list = authorRepliesByCommentId.get(parentId) ?? []
        list.push(c)
        authorRepliesByCommentId.set(parentId, list)
      } else {
        nonPlayerComments.push(c)
      }
      continue
    }

    if (player && c.author.trim() === player) {
      continue
    }

    nonPlayerComments.push(c)
  }

  return { nonPlayerComments, playerComments, authorRepliesByCommentId, contiguousRepliesByPlayerId }
}

export function getLastPlayerCommentId(
  comments: MomentComment[],
  playerName: string,
): string | null {
  const player = playerName.trim()
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i]!
    if (!c.isAuthorReply && c.author.trim() === player) return c.id
  }
  return null
}
