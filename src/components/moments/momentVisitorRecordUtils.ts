import type { MomentInteraction } from './momentInteractionTypes'
import { getUnlockedInteractions } from './momentInteractionTypes'
import type { MomentsContactDirectory } from './momentsContactDirectory'
import { sanitizeMomentText } from './momentTextSanitize'

export type MomentVisitorRecord = {
  charId: string
  displayName: string
  avatarUrl?: string
  visitedAt: number
  liked: boolean
  commented: boolean
  commentPreview?: string
  /** 仅沉默浏览时有值 */
  dwellSeconds?: number
}

export function buildMomentVisitorRecords(
  interactions: MomentInteraction[] | undefined,
  now: number,
  contactDirectory: MomentsContactDirectory,
): MomentVisitorRecord[] {
  const unlocked = getUnlockedInteractions(interactions, now)
  const byChar = new Map<string, MomentInteraction[]>()

  for (const ix of unlocked) {
    if (ix.type !== 'like' && ix.type !== 'comment' && ix.type !== 'viewed') continue
    const charId = ix.charId.trim()
    if (!charId) continue
    const list = byChar.get(charId) ?? []
    list.push(ix)
    byChar.set(charId, list)
  }

  const records: MomentVisitorRecord[] = []
  for (const [charId, list] of byChar) {
    list.sort((a, b) => a.visibleAt - b.visibleAt)
    const liked = list.some((ix) => ix.type === 'like')
    const commentIx = list.find((ix) => ix.type === 'comment')
    const viewedIx = list.find((ix) => ix.type === 'viewed')
    const visitedAt = list[0]?.visibleAt ?? 0

    records.push({
      charId,
      displayName: contactDirectory.getDisplayName(charId),
      avatarUrl: contactDirectory.getAvatar(charId),
      visitedAt,
      liked,
      commented: !!commentIx,
      commentPreview: commentIx?.content
        ? sanitizeMomentText(commentIx.content).slice(0, 120)
        : undefined,
      dwellSeconds: !liked && !commentIx ? viewedIx?.dwellSeconds ?? 12 : undefined,
    })
  }

  records.sort((a, b) => b.visitedAt - a.visitedAt)
  return records
}

export function countMomentVisitorRecords(
  interactions: MomentInteraction[] | undefined,
  now: number,
): number {
  const unlocked = getUnlockedInteractions(interactions, now)
  const charIds = new Set<string>()
  for (const ix of unlocked) {
    if (ix.type !== 'like' && ix.type !== 'comment' && ix.type !== 'viewed') continue
    const id = ix.charId.trim()
    if (id) charIds.add(id)
  }
  return charIds.size
}

/** 延时解锁：尚未到 visibleAt 的角色数（将产生点赞/评论/浏览互动） */
export function countPendingMomentVisitorCharacters(
  interactions: MomentInteraction[] | undefined,
  now: number,
): number {
  const charIds = new Set<string>()
  for (const ix of interactions ?? []) {
    if (ix.visibleAt <= now) continue
    if (ix.type !== 'like' && ix.type !== 'comment' && ix.type !== 'viewed') continue
    const id = ix.charId.trim()
    if (id) charIds.add(id)
  }
  return charIds.size
}

export function describeMomentVisitorAction(record: MomentVisitorRecord): string {
  if (record.commented && record.liked) return '赞了并评论了'
  if (record.commented) return '评论了'
  if (record.liked) return '赞了'
  return `浏览了 ${record.dwellSeconds ?? 12} 秒`
}
