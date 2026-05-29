import { getVisibleComments, getVisibleThreadReplies } from './qnaDirectedStore'
import type { QnaContactDisplayIndex } from './qnaContactDisplay'
import { repairMisplacedThreadReplies } from './qnaThreadReplyRouting'
import type {
  DelayedComment,
  QnADirectedPost,
  QnACommentAuthorType,
  QnAThreadComment,
  QnAThreadReply,
} from './qnaStoreTypes'

function sortTime(c: { createdAt: number; visibleAt?: number }): number {
  return c.visibleAt ?? c.createdAt
}

function bondToThreadComment(c: DelayedComment): QnAThreadComment {
  const ts = c.createdAt ?? c.visibleAt
  return {
    id: `bond-${c.id}`,
    createdAt: ts,
    authorType: 'character',
    authorName: c.authorName,
    authorAvatar: c.authorAvatar,
    authorCharacterId: c.authorCharacterId,
    relationLabel: c.relationLabel,
    content: c.content,
    replies: [],
    fromBondEcho: true,
  }
}

/** 羁绊围观：每条延时评论独立成一条顶层主评（勿误塞进楼中楼） */
export function packBondCommentsAsThreads(visible: DelayedComment[]): QnAThreadComment[] {
  return [...visible]
    .sort((a, b) => a.visibleAt - b.visibleAt)
    .map(bondToThreadComment)
}

/** 修复旧版误把多条围观压成「1 主评 + N 假回复」的持久化数据 */
function flattenLegacyBondPack(tc: QnAThreadComment): QnAThreadComment[] {
  if (!tc.fromBondEcho || !tc.replies.length) return [tc]
  const legacyPacked = tc.replies.every((r) => r.id.startsWith('bond-r-'))
  if (!legacyPacked) return [tc]

  const root = { ...tc, replies: [] }
  const promoted = tc.replies.map((r) => ({
    id: r.id.replace(/^bond-r-/, 'bond-'),
    createdAt: r.createdAt,
    visibleAt: r.visibleAt,
    authorType: 'character' as const,
    authorName: r.authorName,
    authorAvatar: r.authorAvatar,
    authorCharacterId: r.authorCharacterId,
    relationLabel: r.relationLabel,
    content: r.content,
    replies: [] as QnAThreadReply[],
    fromBondEcho: true,
  }))
  return [root, ...promoted]
}

export function normalizeThreadComment(c: QnAThreadComment): QnAThreadComment {
  return {
    ...c,
    authorType: c.authorType ?? 'user',
    replies: c.replies ?? [],
  }
}

/** 统一评论区：羁绊围观（已解锁）+ 玩家/角色 threadComments，按时间排序 */
export function buildUnifiedCommentList(
  post: QnADirectedPost,
  nowMs: number,
  contactIndex?: QnaContactDisplayIndex,
): QnAThreadComment[] {
  const visibleBond = getVisibleComments(post, nowMs)
  const bondPacked = packBondCommentsAsThreads(visibleBond)
  const bondIds = new Set(bondPacked.map((b) => b.id))

  // 仅在与 comments[] 延时流重复时跳过；「全部显示」迁入的 fromBondEcho 须保留
  const threads = (post.threadComments ?? [])
    .map(normalizeThreadComment)
    .filter((t) => !t.visibleAt || t.visibleAt <= nowMs)
    .filter((t) => !bondIds.has(t.id))
    .flatMap(flattenLegacyBondPack)

  const merged = [...bondPacked, ...threads]
  merged.sort((a, b) => sortTime(a) - sortTime(b))
  return repairMisplacedThreadReplies(
    merged,
    { targetCharacterName: post.targetCharacterName },
    contactIndex,
  )
}

export function countUnifiedComments(post: QnADirectedPost, nowMs: number): number {
  const list = buildUnifiedCommentList(post, nowMs)
  return list.reduce(
    (n, c) => n + 1 + getVisibleThreadReplies(c, nowMs).length,
    0,
  )
}

/** 将已显示的羁绊评论迁入 threadComments，便于玩家回复后持久化 */
export function migrateVisibleBondIntoThreads(post: QnADirectedPost, nowMs: number): QnADirectedPost {
  const visible = getVisibleComments(post, nowMs)
  if (!visible.length) return post

  const packed = packBondCommentsAsThreads(visible)
  const pending = post.comments.filter((c) => c.visibleAt > nowMs)
  const existing = post.threadComments ?? []
  const existingIds = new Set(existing.map((c) => c.id))

  const toAdd = packed.filter((p) => !existingIds.has(p.id))
  if (!toAdd.length && pending.length === post.comments.length) return post

  return {
    ...post,
    comments: pending,
    threadComments: [...toAdd, ...existing],
  }
}

export function resolveThreadCommentId(
  post: QnADirectedPost,
  commentId: string,
  nowMs: number,
): { post: QnADirectedPost; commentId: string } {
  if (commentId.startsWith('bond-')) {
    const migrated = migrateVisibleBondIntoThreads(post, nowMs)
    const hit = (migrated.threadComments ?? []).find((c) => c.id === commentId)
    if (hit) return { post: migrated, commentId: hit.id }
    const packed = packBondCommentsAsThreads(getVisibleComments(post, nowMs))
    const packedHit = packed.find((c) => c.id === commentId)
    if (packedHit) {
      const m2 = migrateVisibleBondIntoThreads(post, nowMs)
      return { post: m2, commentId: packedHit.id }
    }
  }
  return { post, commentId }
}

export function displayAuthorType(c: QnAThreadComment): QnACommentAuthorType {
  return c.authorType ?? 'user'
}

/** 尚未到点显示的羁绊围观 + 楼中楼回复数量 */
export function countPendingDirectedComments(post: QnADirectedPost, nowMs: number): number {
  let n = post.comments.filter((c) => c.visibleAt > nowMs).length
  for (const tc of post.threadComments ?? []) {
    if (tc.visibleAt != null && tc.visibleAt > nowMs) n += 1
    n += tc.replies.filter((r) => r.visibleAt != null && r.visibleAt > nowMs).length
  }
  return n
}

/** 跳过延时：立刻展示全部评论互动并写入 store */
export function revealAllCommentsOnPost(post: QnADirectedPost, atMs = Date.now()): QnADirectedPost {
  const unlockedBond = post.comments.map((c) => ({
    ...c,
    visibleAt: atMs,
    createdAt: c.createdAt ?? c.visibleAt,
  }))

  const unlockedThreads = (post.threadComments ?? []).map((tc) => ({
    ...normalizeThreadComment(tc),
    visibleAt: tc.visibleAt != null && tc.visibleAt > atMs ? atMs : tc.visibleAt,
    replies: tc.replies.map((r) => ({
      ...r,
      visibleAt: r.visibleAt != null && r.visibleAt > atMs ? atMs : r.visibleAt,
    })),
  }))

  const interim: QnADirectedPost = {
    ...post,
    comments: unlockedBond,
    threadComments: unlockedThreads,
  }
  const migrated = migrateVisibleBondIntoThreads(interim, atMs)
  return {
    ...migrated,
    threadComments: (migrated.threadComments ?? []).map((tc) => ({
      ...tc,
      visibleAt: tc.visibleAt != null && tc.visibleAt > atMs ? atMs : tc.visibleAt,
      replies: tc.replies.map((r) => ({
        ...r,
        visibleAt: r.visibleAt != null && r.visibleAt > atMs ? atMs : r.visibleAt,
      })),
    })),
  }
}
