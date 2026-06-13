import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'

import type { MomentComment, MomentItemModel } from './mockMoments'
import { getUnlockedInteractions } from './momentInteractionTypes'
import type { MomentsContactDirectory } from './momentsContactDirectory'
import type { MomentContactRef } from './newMomentTypes'
import {
  canCharacterInteractOnPublisherMoment,
  hasCharacterToCharacterBinding,
  resolveRelationshipBoundPeers,
} from './momentRelationshipGraph'
import type { ThreadReplyDraft } from './momentCommentThreadReplyAi'

export type CommentCatalogEntry = {
  id: string
  author: string
  authorCharId?: string
  content: string
  replyTo?: string
  /** 此话主要对谁说的（给 AI 读评串用） */
  addressedTo?: string
  /** 一级评用户 / 回复某角色 */
  addressKind?: 'user' | 'character' | 'publisher'
}

/** 用户朋友圈一级评论：默认话对发帖用户说 */
export function describeUserMomentTopLevelAddressee(userDisplayName: string): string {
  const user = userDisplayName.trim() || '用户'
  return `用户 ${user}（一级评圈；文中「你/给你/您」指发朋友圈的${user}本人，不是其他围观角色）`
}

/** 回复某角色评论时的受众说明 */
export function describeCharacterThreadAddressee(
  targetDisplayName: string,
  parentSpokeToUser = false,
): string {
  const target = targetDisplayName.trim() || '对方'
  if (parentSpokeToUser) {
    return `角色 ${target}（接话/围观；被回复的那条多半仍是在对用户说话，勿把其中的「你/给你」理解成在说你）`
  }
  return `角色 ${target}（回复该角色的评论）`
}

export function formatCommentCatalogEntryLine(c: CommentCatalogEntry): string {
  const replyPart = c.replyTo ? `，回复 ${c.replyTo}` : ''
  const audiencePart = c.addressedTo ? `（受众：${c.addressedTo}）` : ''
  return `- id: ${c.id}，${c.author}${replyPart}${audiencePart}：${c.content}`
}

export function formatUserMomentFirstCommentLine(params: {
  authorName: string
  charId: string
  content: string
  userDisplayName: string
}): string {
  const user = params.userDisplayName.trim() || '用户'
  return [
    `- ${params.authorName}（charId: ${params.charId}）评用户 ${user}：${params.content.trim()}`,
    `  ※ 此话对发朋友圈的用户说；「你/给你/您」指 ${user}，不是其他围观角色`,
  ].join('\n')
}

export type ThreadParticipant = {
  charId: string
  displayName: string
  role: 'publisher' | 'target' | 'commenter' | 'mutual'
}

export function resolveMomentCharacterIdByDisplayName(
  displayName: string,
  moment: MomentItemModel,
  contactDirectory: MomentsContactDirectory,
  momentContacts: MomentContactRef[],
): string | undefined {
  const name = displayName.trim()
  if (!name) return undefined

  const publisherId = moment.authorCharacterId?.trim()
  if (publisherId && contactDirectory.getDisplayName(publisherId) === name) {
    return publisherId
  }
  if (publisherId && moment.authorName.trim() === name) {
    return publisherId
  }

  for (const c of momentContacts) {
    const cid = c.characterId?.trim()
    if (!cid) continue
    if (c.name.trim() === name || contactDirectory.getDisplayName(cid) === name) {
      return cid
    }
  }

  for (const ix of moment.interactions ?? []) {
    if (ix.type !== 'comment') continue
    if (contactDirectory.getDisplayName(ix.charId) === name) return ix.charId
  }

  for (const c of moment.comments ?? []) {
    if (c.authorCharacterId && c.author.trim() === name) return c.authorCharacterId
  }

  return undefined
}

export function isUserReplyToPublisher(
  comment: MomentComment,
  publisherDisplayName: string,
): boolean {
  const replyTo = comment.replyTo?.trim()
  if (!replyTo) return true
  return replyTo === publisherDisplayName.trim()
}

export function buildMomentCommentCatalog(
  moment: MomentItemModel,
  contactDirectory: MomentsContactDirectory,
  now: number,
  options?: { userDisplayName?: string },
): CommentCatalogEntry[] {
  const catalog: CommentCatalogEntry[] = []
  const seen = new Set<string>()
  const userDisplayName = options?.userDisplayName?.trim() ?? ''
  const isUserAuthored = !!moment.isUserAuthored

  const entryById = new Map<string, CommentCatalogEntry>()

  for (const ix of getUnlockedInteractions(moment.interactions, now)) {
    if (ix.type !== 'comment' || !ix.content?.trim()) continue
    const replyToCharId = ix.replyToCharId?.trim()
    const replyTo = replyToCharId
      ? contactDirectory.getDisplayName(replyToCharId)
      : undefined
    let addressedTo: string | undefined
    let addressKind: CommentCatalogEntry['addressKind']
    if (replyToCharId && replyTo) {
      const parentRefId = ix.replyToInteractionId?.trim() || ix.replyToCommentId?.trim()
      const parent = parentRefId ? entryById.get(parentRefId) : undefined
      const parentSpokeToUser = parent
        ? parent.addressKind === 'user'
        : isUserAuthored
      addressedTo = describeCharacterThreadAddressee(replyTo, parentSpokeToUser)
      addressKind = 'character'
    } else if (isUserAuthored && userDisplayName) {
      addressedTo = describeUserMomentTopLevelAddressee(userDisplayName)
      addressKind = 'user'
    }
    const entry: CommentCatalogEntry = {
      id: ix.id,
      author: contactDirectory.getDisplayName(ix.charId),
      authorCharId: ix.charId,
      content: ix.content.trim(),
      replyTo,
      addressedTo,
      addressKind,
    }
    catalog.push(entry)
    entryById.set(ix.id, entry)
    seen.add(ix.id)
  }

  for (const c of moment.comments ?? []) {
    if (seen.has(c.id) || c.isAuthorReply) continue
    const replyTo = c.replyTo?.trim()
    let addressedTo: string | undefined
    let addressKind: CommentCatalogEntry['addressKind']
    if (replyTo) {
      const parent = c.replyToCommentId ? entryById.get(c.replyToCommentId) : undefined
      addressedTo = describeCharacterThreadAddressee(
        replyTo,
        parent?.addressKind === 'user' || (!parent && isUserAuthored),
      )
      addressKind = 'character'
    } else if (isUserAuthored && userDisplayName) {
      addressedTo = describeUserMomentTopLevelAddressee(userDisplayName)
      addressKind = 'user'
    }
    const entry: CommentCatalogEntry = {
      id: c.id,
      author: c.author,
      authorCharId: c.authorCharacterId,
      content: c.content,
      replyTo,
      addressedTo,
      addressKind,
    }
    catalog.push(entry)
    entryById.set(c.id, entry)
    seen.add(c.id)
  }

  return catalog
}

export function buildThreadParticipants(params: {
  moment: MomentItemModel
  publisherCharId: string
  targetCharId: string
  playerIdentityId?: string | null
  contactDirectory: MomentsContactDirectory
  momentContacts: MomentContactRef[]
  blockedCharacterIds: Set<string>
  relationships: ReadonlyArray<Relationship>
  now: number
}): ThreadParticipant[] {
  const byId = new Map<string, ThreadParticipant>()
  const rels = params.relationships
  const publisher = params.publisherCharId.trim()
  const target = params.targetCharId.trim()

  const add = (charId: string, role: ThreadParticipant['role']) => {
    const id = charId.trim()
    if (!id) return
    if (id !== publisher && !canCharacterInteractOnPublisherMoment(publisher, id, rels)) {
      return
    }
    const existing = byId.get(id)
    if (existing) {
      if (role === 'target' || (role === 'publisher' && existing.role !== 'target')) {
        byId.set(id, { ...existing, role })
      }
      return
    }
    byId.set(id, {
      charId: id,
      displayName: params.contactDirectory.getDisplayName(id),
      role,
    })
  }

  add(publisher, 'publisher')
  add(target, 'target')

  for (const ix of getUnlockedInteractions(params.moment.interactions, params.now)) {
    if (ix.type !== 'comment') continue
    add(ix.charId, 'commenter')
  }

  for (const c of params.moment.comments ?? []) {
    if (c.isAuthorReply || !c.authorCharacterId) continue
    add(c.authorCharacterId, 'commenter')
  }

  for (const peer of resolveRelationshipBoundPeers(
    publisher,
    params.momentContacts,
    rels,
    params.blockedCharacterIds,
  )) {
    add(peer.charId, 'mutual')
  }

  return [...byId.values()]
}

export function filterThreadRepliesByRelationshipBinding(
  drafts: ThreadReplyDraft[],
  catalog: CommentCatalogEntry[],
  rels: ReadonlyArray<Relationship>,
): ThreadReplyDraft[] {
  const authorByCommentId = new Map(catalog.map((c) => [c.id, c.authorCharId]))

  return drafts.filter((draft) => {
    const repliedAuthorCharId = authorByCommentId.get(draft.replyToCommentId)
    if (!repliedAuthorCharId) return true
    return hasCharacterToCharacterBinding(draft.authorCharId, repliedAuthorCharId, rels)
  })
}

export function findCommentAuthorName(
  comments: MomentComment[],
  catalog: CommentCatalogEntry[],
  commentId: string,
  contactDirectory: MomentsContactDirectory,
): string {
  const fromStored = comments.find((c) => c.id === commentId)
  if (fromStored) return fromStored.author

  const fromCatalog = catalog.find((c) => c.id === commentId)
  if (fromCatalog) return fromCatalog.author

  return contactDirectory.getDisplayName(commentId) || '对方'
}
