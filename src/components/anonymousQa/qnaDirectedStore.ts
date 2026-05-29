import type {
  QnADirectedPost,
  QnADirectedPostsSnapshot,
  QnAThreadComment,
  QnAThreadReply,
} from './qnaStoreTypes'
import { revealAllCommentsOnPost } from './qnaUnifiedComments'
import {
  deleteQnaDirectedPostsRecord,
  loadQnaDirectedPostsRecord,
  saveQnaDirectedPostsRecord,
} from './qnaPersistence'

type Listener = () => void

let posts: Record<string, QnADirectedPost> = {}
let now = Date.now()
const listeners = new Set<Listener>()
let tickHandle: ReturnType<typeof setInterval> | null = null
let hydrated = false
let hydratePromise: Promise<void> | null = null

function emit() {
  for (const l of listeners) l()
}

function persistToIndexedDb() {
  void saveQnaDirectedPostsRecord(posts).catch(() => {
    // ignore quota / IDB transient errors
  })
}

export async function hydrateQnaDirectedStore(): Promise<void> {
  if (hydrated) return
  if (hydratePromise) return hydratePromise
  hydratePromise = (async () => {
    try {
      posts = await loadQnaDirectedPostsRecord()
    } catch {
      posts = {}
    }
    hydrated = true
    now = Date.now()
    emit()
  })()
  return hydratePromise
}

/** 微信深度注销后清空内存并抹 IDB */
export async function resetQnaDirectedStore(): Promise<void> {
  posts = {}
  hydrated = true
  hydratePromise = Promise.resolve()
  now = Date.now()
  try {
    await deleteQnaDirectedPostsRecord()
  } catch {
    // ignore
  }
  emit()
}

function ensureTick() {
  if (tickHandle != null) return
  tickHandle = setInterval(() => {
    now = Date.now()
    emit()
  }, 1000)
}

export function subscribeQnaDirectedStore(listener: Listener): () => void {
  void hydrateQnaDirectedStore()
  listeners.add(listener)
  ensureTick()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && tickHandle != null) {
      clearInterval(tickHandle)
      tickHandle = null
    }
  }
}

let snapshotCache: QnADirectedPostsSnapshot | null = null
let snapshotCachePosts: typeof posts = posts
let snapshotCacheNow = now

/** 须返回稳定引用，否则 useSyncExternalStore 会无限重渲染 */
export function getQnaDirectedStoreSnapshot(): QnADirectedPostsSnapshot {
  if (snapshotCache && snapshotCachePosts === posts && snapshotCacheNow === now) {
    return snapshotCache
  }
  snapshotCachePosts = posts
  snapshotCacheNow = now
  snapshotCache = { posts: { ...posts }, now }
  return snapshotCache
}

export function getQnaDirectedPost(id: string): QnADirectedPost | null {
  return posts[id.trim()] ?? null
}

export function upsertQnaDirectedPost(post: QnADirectedPost): void {
  posts = { ...posts, [post.id]: post }
  if (hydrated) persistToIndexedDb()
  emit()
}

export function buildDelayedCommentsFromAi(
  rows: Array<{
    id: string
    authorName: string
    authorAvatar: string
    authorCharacterId?: string
    relationLabel?: string
    content: string
    delayInSeconds: number
  }>,
  baseMs = Date.now(),
): import('./qnaStoreTypes').DelayedComment[] {
  return rows.map((r) => {
    const delay = Math.max(0, Math.floor(r.delayInSeconds))
    return {
      id: r.id,
      authorName: r.authorName,
      authorAvatar: r.authorAvatar,
      authorCharacterId: r.authorCharacterId,
      relationLabel: r.relationLabel,
      content: r.content,
      delayInSeconds: delay,
      visibleAt: baseMs + delay * 1000,
      createdAt: baseMs + delay * 1000,
    }
  })
}

export function getVisibleComments(post: QnADirectedPost, atMs = Date.now()) {
  return post.comments.filter((c) => atMs >= c.visibleAt)
}

export function getVisibleThreadReplies(comment: QnAThreadComment, atMs = Date.now()): QnAThreadReply[] {
  return comment.replies.filter((r) => !r.visibleAt || r.visibleAt <= atMs)
}

export function patchQnaDirectedPost(
  id: string,
  updater: (post: QnADirectedPost) => QnADirectedPost,
): void {
  const cur = posts[id.trim()]
  if (!cur) return
  upsertQnaDirectedPost(updater(cur))
}

/** 帖子详情：跳过延时，立即展示全部评论互动 */
export function revealAllDirectedPostComments(postId: string, atMs = Date.now()): void {
  const id = postId.trim()
  const cur = posts[id]
  if (!cur) return
  upsertQnaDirectedPost(revealAllCommentsOnPost(cur, atMs))
}
