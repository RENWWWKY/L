import type { QnaContactDisplayIndex } from './qnaContactDisplay'
import { resolveContactDisplayName, resolveCharacterIdByDisplayName } from './qnaContactDisplay'
import type { QnAThreadComment, QnAThreadReply } from './qnaStoreTypes'

function replySortKey(r: QnAThreadReply): number {
  return r.visibleAt ?? r.createdAt
}

/** 备注名互认：完全一致，或一方包含另一方（≥2 字） */
export function namesMatch(a: string, b: string): boolean {
  const x = a.trim()
  const y = b.trim()
  if (!x || !y) return false
  if (x === y) return true
  if (x.length >= 2 && y.includes(x)) return true
  if (y.length >= 2 && x.includes(y)) return true
  return false
}

export function findLatestUserThreadId(threads: QnAThreadComment[]): string | null {
  let best: QnAThreadComment | null = null
  for (const t of threads) {
    if (t.authorType !== 'user') continue
    if (!best || t.createdAt >= best.createdAt) best = t
  }
  return best?.id ?? null
}

function threadAuthorMatches(
  threadAuthor: string,
  targetName: string,
  index?: QnaContactDisplayIndex,
): boolean {
  if (namesMatch(threadAuthor, targetName)) return true
  if (!index) return false
  return (
    resolveContactDisplayName(threadAuthor, index) === resolveContactDisplayName(targetName, index)
  )
}

/** 被 @ 的角色对应的一级楼（含楼中楼作者、正文提及；可按通讯录别名匹配） */
export function findThreadByReplyTargetName(
  threads: QnAThreadComment[],
  target: string,
  index?: QnaContactDisplayIndex,
): string | null {
  const t = target.trim()
  if (!t) return null
  const canonical = index ? resolveContactDisplayName(t, index) : t

  for (const row of threads) {
    if (threadAuthorMatches(canonical, row.authorName, index)) return row.id
  }
  for (const row of threads) {
    if (row.replies.some((r) => threadAuthorMatches(canonical, r.authorName, index))) return row.id
  }
  for (const row of threads) {
    const body = row.content.trim()
    if (body.includes(canonical) || body.includes(t)) return row.id
    if (canonical.length >= 2 && body.includes(canonical.slice(-2))) return row.id
  }
  if (index) {
    const cid = resolveCharacterIdByDisplayName(t, index)
    if (cid) {
      for (const row of threads) {
        if (row.authorCharacterId === cid) return row.id
      }
    }
  }
  return null
}

/** 发言者自己的一级评论楼 */
export function findAuthorTopLevelThreadId(
  threads: QnAThreadComment[],
  authorName: string,
  index?: QnaContactDisplayIndex,
): string | null {
  const hit = threads.find(
    (t) => t.authorType !== 'user' && threadAuthorMatches(authorName, t.authorName, index),
  )
  return hit?.id ?? null
}

type RoutingOpts = {
  playerLabels: string[]
  authorName: string
  /** 本次「触发互动」锚定的用户评论 id，勿用 findLatestUser */
  interactionAnchorId: string
  contactIndex?: QnaContactDisplayIndex
}

/**
 * 决定楼中楼挂哪条一级评论。
 * 找不到 @ 对象时挂在【发言者自己的一级楼】，禁止默认塞进「最新用户评论」。
 */
export function resolveReplyHostThreadId(
  threads: QnAThreadComment[],
  reply: Pick<QnAThreadReply, 'authorName' | 'replyToName' | 'authorType'>,
  opts: RoutingOpts,
): string {
  const target = reply.replyToName?.trim() ?? ''
  const playerSet = new Set(opts.playerLabels.map((p) => p.trim()).filter(Boolean))

  if (target && [...playerSet].some((p) => namesMatch(p, target))) {
    return opts.interactionAnchorId
  }

  if (target && namesMatch(target, opts.authorName)) {
    return opts.interactionAnchorId
  }

  if (target) {
    const byTarget = findThreadByReplyTargetName(threads, target, opts.contactIndex)
    if (byTarget) return byTarget
  }

  const byAuthor = findAuthorTopLevelThreadId(threads, reply.authorName, opts.contactIndex)
  if (byAuthor) return byAuthor

  return opts.interactionAnchorId
}

export function distributeInteractionReplies(
  threads: QnAThreadComment[],
  anchorThreadId: string,
  newReplies: QnAThreadReply[],
  opts: { playerLabels: string[]; authorName: string; contactIndex?: QnaContactDisplayIndex },
): QnAThreadComment[] {
  const routing: RoutingOpts = {
    ...opts,
    interactionAnchorId: anchorThreadId,
    contactIndex: opts.contactIndex,
  }
  const next = threads.map((t) => ({ ...t, replies: [...t.replies] }))
  const byId = new Map(next.map((t) => [t.id, t]))

  for (const reply of newReplies) {
    const hostId = resolveReplyHostThreadId(next, reply, routing)
    const host = byId.get(hostId)
    if (!host) continue
    host.replies.push(reply)
    host.replies.sort((a, b) => replySortKey(a) - replySortKey(b))
  }

  return next
}

/**
 * 只修一种错：挂在【用户楼】下，但 @ 的是角色 → 迁到对应 NPC 楼。
 * 不会把 NPC 楼中楼误迁到「最新用户评论」。
 */
export function repairMisplacedThreadReplies(
  threads: QnAThreadComment[],
  _post: { targetCharacterName: string },
  contactIndex?: QnaContactDisplayIndex,
): QnAThreadComment[] {
  const playerLabels = threads
    .filter((t) => t.authorType === 'user')
    .map((t) => t.authorName.trim())
    .filter(Boolean)

  const next = threads.map((t) => ({ ...t, replies: [...t.replies] }))
  const pending: Array<{ reply: QnAThreadReply; toId: string }> = []

  for (const t of next) {
    if (t.authorType !== 'user') continue

    const keep: QnAThreadReply[] = []
    for (const r of t.replies) {
      if (r.authorType === 'user') {
        keep.push(r)
        continue
      }

      const targetName = r.replyToName?.trim() ?? ''
      const isPlayerTarget =
        targetName.length > 0 &&
        playerLabels.some((p) => namesMatch(p, targetName))

      if (isPlayerTarget) {
        keep.push(r)
        continue
      }

      if (!targetName) {
        keep.push(r)
        continue
      }

      const dest =
        findThreadByReplyTargetName(next, targetName, contactIndex) ??
        findAuthorTopLevelThreadId(next, r.authorName, contactIndex)

      if (dest && dest !== t.id) {
        pending.push({ reply: r, toId: dest })
      } else {
        keep.push(r)
      }
    }
    t.replies = keep
  }

  const byId = new Map(next.map((row) => [row.id, row]))
  for (const { reply, toId } of pending) {
    byId.get(toId)?.replies.push(reply)
  }

  for (const row of next) {
    row.replies.sort((a, b) => replySortKey(a) - replySortKey(b))
  }

  return next
}
