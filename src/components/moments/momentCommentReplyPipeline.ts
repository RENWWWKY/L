import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'
import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'

import { generateMomentAuthorReplies } from './momentCommentReplyAi'
import {
  buildMomentCommentCatalog,
  buildThreadParticipants,
  filterThreadRepliesByRelationshipBinding,
  isUserReplyToPublisher,
  resolveMomentCharacterIdByDisplayName,
} from './momentCommentThreadContext'
import { generateMomentThreadReplies } from './momentCommentThreadReplyAi'
import {
  buildPublisherElicitDrafts,
  buildThreadElicitDrafts,
  markCommentsElicited,
} from './momentCommentUtils'
import type { MomentsContactDirectory } from './momentsContactDirectory'
import type { MomentComment, MomentItemModel } from './mockMoments'
import type { ElicitReplyInteractionDraft, MomentInteraction } from './momentInteractionTypes'
import { materializeElicitReplyInteractions } from './momentInteractionTypes'
import type { MomentContactRef } from './newMomentTypes'

export type RunMomentCommentReplyPipelineParams = {
  wechatCtx: AnonymousQaWechatContext
  moment: MomentItemModel
  comments: MomentComment[]
  interactions: MomentInteraction[]
  pendingComments: MomentComment[]
  userDisplayName: string
  contactDirectory: MomentsContactDirectory
  momentContacts: MomentContactRef[]
  blockedCharacterIds: Set<string>
  momentRelationships: Relationship[]
  enableDelayedInteraction: boolean
  now?: number
}

export type MomentCommentReplyPipelineResult = {
  comments: MomentComment[]
  interactions: MomentInteraction[]
  highlightInteractionId: string | null
}

export async function runMomentCommentReplyPipeline(
  params: RunMomentCommentReplyPipelineParams,
): Promise<MomentCommentReplyPipelineResult> {
  const {
    wechatCtx,
    moment,
    comments,
    interactions,
    pendingComments,
    userDisplayName,
    contactDirectory,
    momentContacts,
    blockedCharacterIds,
    momentRelationships,
    enableDelayedInteraction,
    now = Date.now(),
  } = params

  const charId = moment.authorCharacterId?.trim()
  if (!pendingComments.length) {
    return { comments, interactions, highlightInteractionId: null }
  }
  if (!moment.isUserAuthored && !charId) {
    return { comments, interactions, highlightInteractionId: null }
  }

  const authorName = charId
    ? contactDirectory.getDisplayName(charId)
    : moment.authorName.trim() || userDisplayName
  const elicitStartedAt = Date.now()
  const immediate = !enableDelayedInteraction
  const elicitDrafts: ElicitReplyInteractionDraft[] = []
  let delayOffset = 0

  const publisherPending: MomentComment[] = []
  const threadPending: MomentComment[] = []

  for (const userComment of pendingComments) {
    const targetName = userComment.replyTo?.trim() ?? ''
    const targetCharId = resolveMomentCharacterIdByDisplayName(
      targetName,
      moment,
      contactDirectory,
      momentContacts,
    )
    if (moment.isUserAuthored) {
      if (targetCharId && !isUserReplyToPublisher(userComment, authorName)) {
        threadPending.push(userComment)
      }
      continue
    }
    if (!targetCharId || isUserReplyToPublisher(userComment, authorName)) {
      publisherPending.push(userComment)
    } else {
      threadPending.push(userComment)
    }
  }

  if (publisherPending.length && charId && !moment.isUserAuthored) {
    const replyTexts = await generateMomentAuthorReplies({
      wechatCtx,
      characterId: charId,
      momentContent: moment.content,
      momentImages: moment.images,
      userDisplayName,
      pendingComments: publisherPending,
      replyMode: publisherPending.length > 1 ? 'unified' : 'per-comment',
    })
    const anchorComment = publisherPending[publisherPending.length - 1]!
    elicitDrafts.push(...buildPublisherElicitDrafts(anchorComment, replyTexts, charId, delayOffset))
    delayOffset += replyTexts.filter((t) => t.trim()).length
  }

  for (const userComment of threadPending) {
    const momentSnapshot: MomentItemModel = { ...moment, comments }
    const commentCatalog = buildMomentCommentCatalog(momentSnapshot, contactDirectory, now, {
      userDisplayName,
    })
    const targetName = userComment.replyTo?.trim() ?? ''
    const targetCharId = resolveMomentCharacterIdByDisplayName(
      targetName,
      moment,
      contactDirectory,
      momentContacts,
    )
    if (!targetCharId) continue

    const participants = buildThreadParticipants({
      moment: momentSnapshot,
      publisherCharId: charId ?? targetCharId,
      targetCharId,
      playerIdentityId: wechatCtx.playerIdentityId,
      contactDirectory,
      momentContacts,
      blockedCharacterIds,
      relationships: momentRelationships,
      now,
    })

    const rawDrafts = await generateMomentThreadReplies({
      wechatCtx,
      momentContent: moment.content,
      momentImages: moment.images,
      publisherDisplayName: authorName,
      publisherCharacterId: charId ?? targetCharId,
      targetCharacterId: targetCharId,
      targetDisplayName: targetName,
      userDisplayName,
      userComment,
      commentCatalog,
      participants,
      momentRelationships,
    })

    let drafts = filterThreadRepliesByRelationshipBinding(
      rawDrafts,
      commentCatalog,
      momentRelationships,
    )
    if (!drafts.length) {
      drafts = rawDrafts.filter(
        (d) => d.authorCharId === targetCharId && d.replyToCommentId === userComment.id,
      )
    }

    elicitDrafts.push(
      ...buildThreadElicitDrafts(drafts, delayOffset).map((draft) => ({
        ...draft,
        replyToCharId:
          draft.replyToCharId ??
          commentCatalog.find((c) => c.id === draft.replyToCommentId)?.authorCharId,
      })),
    )
    delayOffset += drafts.filter((d) => d.content.trim()).length
  }

  const markedComments = markCommentsElicited(
    comments,
    new Set(pendingComments.map((c) => c.id)),
  )
  const newInteractions = materializeElicitReplyInteractions(
    elicitDrafts,
    elicitStartedAt,
    immediate,
    { comments, interactions },
  )
  const mergedInteractions = [...interactions, ...newInteractions]

  return {
    comments: markedComments,
    interactions: mergedInteractions,
    highlightInteractionId: newInteractions[0]?.id ?? null,
  }
}
