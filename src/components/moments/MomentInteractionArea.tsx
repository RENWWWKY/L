import { Heart, MessageCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { memo, useEffect, useMemo, useRef } from 'react'

import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'

import type { MomentComment } from './mockMoments'
import {
  buildFlatCommentTimeline,
  getLastPlayerCommentId,
  type MomentCommentDisplayRow,
} from './momentCommentDisplayOrder'
import type { MomentInteraction } from './momentInteractionTypes'
import { getUnlockedInteractions } from './momentInteractionTypes'
import type { MomentsContactDirectory } from './momentsContactDirectory'
import type { MomentContactRef } from './newMomentTypes'
import {
  canPlayerSeeCharacterMomentActivity,
  resolveCharIdByDisplayName,
} from './momentRelationshipGraph'
import {
  InteractionParticipantAvatar,
  resolveInteractionParticipant,
  type InteractionParticipantMeta,
} from './momentInteractionParticipant'
import { profilePayloadFromParticipantMeta } from './momentProfileNavigation'
import type { OnOpenMomentParticipantProfile } from './momentProfileNavigation'
import { ReplyingIndicator } from './ReplyingIndicator'
import { sanitizeMomentText } from './momentTextSanitize'
import { MomentCommentTimeLabel } from './ArchiveTimelineDateColumn'

type DisplayComment =
  | { kind: 'user'; id: string; sortAt: number; author: string; content: string; replyTo?: string }
  | {
      kind: 'ai'
      id: string
      sortAt: number
      charId: string
      author: string
      content: string
      replyTo?: string
      visibleAt: number
      isAuthorReply?: boolean
      parentCommentId?: string
    }
  | {
      kind: 'stored-author'
      id: string
      sortAt: number
      author: string
      content: string
      replyToName: string
    }

type MomentInteractionAreaProps = {
  momentId?: string
  now: number
  legacyLikeNames?: string[]
  userLikeName?: string | null
  feedComments?: MomentComment[]
  legacyComments?: MomentComment[]
  userComments?: MomentComment[]
  interactions?: MomentInteraction[]
  contactDirectory: MomentsContactDirectory
  momentContacts?: MomentContactRef[]
  momentRelationships?: Relationship[]
  playerIdentityId?: string | null
  publisherCharacterId?: string
  replyingAuthorName?: string | null
  replyingTargetName?: string | null
  highlightCommentId?: string | null
  currentUserName?: string
  currentUserAvatarUrl?: string
  /** 详情页展示头像与备注；浏览页仅文字 */
  showParticipantAvatars?: boolean
  onOpenParticipantProfile?: OnOpenMomentParticipantProfile
  onReply?: (targetName: string, charId?: string) => void
  /** 延迟互动首次解锁时回调（用于静默刻录记忆） */
  onInteractionsUnlocked?: (momentId: string) => void
}

const SPRING_IN = { type: 'spring' as const, stiffness: 380, damping: 42 }

function MomentInteractionAreaInner({
  momentId,
  now,
  legacyLikeNames = [],
  userLikeName,
  feedComments,
  legacyComments = [],
  userComments = [],
  interactions = [],
  contactDirectory,
  momentContacts = [],
  momentRelationships = [],
  playerIdentityId,
  publisherCharacterId,
  replyingAuthorName,
  replyingTargetName,
  highlightCommentId,
  currentUserName = '',
  currentUserAvatarUrl,
  showParticipantAvatars = false,
  onOpenParticipantProfile,
  onReply,
  onInteractionsUnlocked,
}: MomentInteractionAreaProps) {
  const seenUnlockIdsRef = useRef<Set<string>>(new Set())
  const publisherId = publisherCharacterId?.trim()

  const openParticipantProfile = (meta: InteractionParticipantMeta) => {
    const payload = profilePayloadFromParticipantMeta(meta)
    if (payload) onOpenParticipantProfile?.(payload)
  }

  const resolveParticipant = (
    displayName: string,
    charId?: string,
  ): InteractionParticipantMeta =>
    resolveInteractionParticipant({
      displayName,
      charId,
      currentUserName,
      currentUserAvatarUrl,
      contactDirectory,
      momentContacts,
    })

  const resolveInteractorCharId = (authorName: string, authorCharacterId?: string): string | undefined => {
    if (authorCharacterId?.trim()) return authorCharacterId.trim()
    return resolveCharIdByDisplayName(authorName, momentContacts, contactDirectory.getDisplayName)
  }

  const canSeeCharacter = (charId: string | undefined): boolean => {
    if (!charId) return true
    return canPlayerSeeCharacterMomentActivity(
      playerIdentityId,
      charId,
      publisherId,
      momentRelationships,
    )
  }

  const unlocked = useMemo(() => {
    const all = getUnlockedInteractions(interactions, now)
    if (!publisherId || !momentRelationships.length) return all
    return all.filter((ix) => canSeeCharacter(ix.charId))
  }, [interactions, momentRelationships, now, playerIdentityId, publisherId])

  const rawOrderedComments = feedComments ?? [...legacyComments, ...userComments]

  const orderedComments = useMemo(() => {
    if (!publisherId) return rawOrderedComments
    const player = currentUserName.trim()
    return rawOrderedComments.filter((c) => {
      if (!c.isAuthorReply && player && c.author.trim() === player) return true
      const charId = resolveInteractorCharId(c.author, c.authorCharacterId)
      if (!charId) return true
      return canSeeCharacter(charId)
    })
  }, [
    contactDirectory,
    currentUserName,
    momentContacts,
    momentRelationships,
    playerIdentityId,
    publisherId,
    rawOrderedComments,
  ])

  const likeEntries = useMemo(() => {
    const entries: { id: string; meta: InteractionParticipantMeta }[] = []
    const seenRemarks = new Set<string>()

    const pushEntry = (id: string, displayName: string, charId?: string) => {
      const meta = resolveParticipant(displayName, charId)
      if (seenRemarks.has(meta.remark)) return
      seenRemarks.add(meta.remark)
      entries.push({ id, meta })
    }

    if (userLikeName) pushEntry('user-like', userLikeName)
    for (const ix of unlocked) {
      if (ix.type !== 'like') continue
      if (!canSeeCharacter(ix.charId)) continue
      pushEntry(ix.id, contactDirectory.getDisplayName(ix.charId), ix.charId)
    }
    for (const n of legacyLikeNames) {
      const charId = resolveCharIdByDisplayName(n, momentContacts, contactDirectory.getDisplayName)
      if (charId && !canSeeCharacter(charId)) continue
      pushEntry(`legacy-like-${n}`, n, charId)
    }
    return entries
  }, [
    contactDirectory,
    currentUserAvatarUrl,
    currentUserName,
    legacyLikeNames,
    momentContacts,
    momentRelationships,
    playerIdentityId,
    publisherId,
    unlocked,
    userLikeName,
  ])

  const commentTimeline = useMemo((): MomentCommentDisplayRow[] => {
    const commentInteractions = interactions.filter((ix) => ix.type === 'comment')
    return buildFlatCommentTimeline({
      comments: orderedComments,
      commentInteractions,
      now,
      resolveAuthorName: (charId) => contactDirectory.getDisplayName(charId),
      publisherCharacterId: publisherId,
    })
  }, [contactDirectory, now, orderedComments, publisherId, interactions])

  const flatDisplayComments = useMemo((): DisplayComment[] => {
    return commentTimeline.map((row) => {
      if (row.kind === 'stored-author') {
        return {
          kind: 'stored-author',
          id: row.id,
          sortAt: row.sortAt,
          author: row.author,
          content: row.content,
          replyToName: row.replyToName ?? '你',
        }
      }
      if (row.kind === 'ai') {
        return {
          kind: 'ai',
          id: row.id,
          sortAt: row.sortAt,
          charId: row.charId ?? '',
          author: row.author,
          content: row.content,
          replyTo: row.replyTo,
          visibleAt: row.sortAt,
          isAuthorReply: !!row.replyTo,
        }
      }
      return {
        kind: 'user',
        id: row.id,
        sortAt: row.sortAt,
        author: row.author,
        content: row.content,
        replyTo: row.replyTo,
      }
    })
  }, [commentTimeline])

  const lastUserCommentId = useMemo(
    () => getLastPlayerCommentId(orderedComments, currentUserName),
    [currentUserName, orderedComments],
  )

  const newlyUnlockedIds = useMemo(() => {
    const fresh = new Set<string>()
    for (const ix of unlocked) {
      if (!seenUnlockIdsRef.current.has(ix.id)) fresh.add(ix.id)
    }
    return fresh
  }, [unlocked])

  useEffect(() => {
    if (!newlyUnlockedIds.size) return
    if (momentId?.trim() && onInteractionsUnlocked) {
      onInteractionsUnlocked(momentId.trim())
    }
    for (const id of newlyUnlockedIds) seenUnlockIdsRef.current.add(id)
  }, [momentId, newlyUnlockedIds, onInteractionsUnlocked])

  const showReplying =
    !!replyingAuthorName?.trim() && !!replyingTargetName?.trim() && !!lastUserCommentId

  const hasLikes = likeEntries.length > 0
  const hasComments = flatDisplayComments.length > 0 || showReplying
  if (!hasLikes && !hasComments) return null

  const resolveCommentParticipant = (comment: DisplayComment): InteractionParticipantMeta => {
    if (comment.kind === 'ai') {
      return resolveParticipant(comment.author, comment.charId)
    }
    if (comment.kind === 'stored-author') {
      return resolveParticipant(comment.author, publisherId)
    }
    return resolveParticipant(comment.author)
  }

  const renderFeedCommentBody = (comment: DisplayComment) => {
    const body = sanitizeMomentText('content' in comment ? comment.content : '')
    if (comment.kind === 'stored-author') {
      return (
        <>
          <span className="font-semibold text-[#111827]">{comment.author}</span>
          <span className="mx-1 text-[#9CA3AF]">回复</span>
          <span className="font-semibold text-[#111827]">{comment.replyToName}</span>
          <span className="mx-1">:</span>
          <span>{body}</span>
        </>
      )
    }
    if (comment.kind === 'ai' && comment.replyTo && !comment.isAuthorReply) {
      return (
        <>
          <span className="font-semibold text-[#111827]">{comment.author}</span>
          <span className="mx-1 text-[#9CA3AF]">回复</span>
          <span className="font-semibold text-[#111827]">{comment.replyTo}</span>
          <span className="mx-1">:</span>
          <span>{body}</span>
        </>
      )
    }
    if (comment.kind === 'ai' && comment.isAuthorReply && comment.replyTo) {
      return (
        <>
          <span className="font-semibold text-[#111827]">{comment.author}</span>
          <span className="mx-1 text-[#9CA3AF]">回复</span>
          <span className="font-semibold text-[#111827]">{comment.replyTo}</span>
          <span className="mx-1">:</span>
          <span>{body}</span>
        </>
      )
    }
    if (comment.kind === 'user' && comment.replyTo) {
      return (
        <>
          <span className="font-semibold text-[#111827]">{comment.author}</span>
          <span className="mx-1 text-[#9CA3AF]">回复</span>
          <span className="font-semibold text-[#111827]">{comment.replyTo}</span>
          <span className="mx-1">:</span>
          <span>{body}</span>
        </>
      )
    }
    return (
      <>
        <span className="font-semibold text-[#111827]">
          {'author' in comment ? comment.author : ''}
        </span>
        <span className="mx-1">:</span>
        <span>{body}</span>
      </>
    )
  }

  const renderDetailCommentText = (comment: DisplayComment) => {
    const body = sanitizeMomentText('content' in comment ? comment.content : '')

    if (comment.kind === 'stored-author') {
      return (
        <>
          <span className="text-[#9CA3AF]">回复 </span>
          <span className="font-semibold text-[#111827]">{comment.replyToName}</span>
          <span className="text-[#111827]">：{body}</span>
        </>
      )
    }
    if (comment.kind === 'ai' && comment.replyTo && !comment.isAuthorReply) {
      return (
        <>
          <span className="text-[#9CA3AF]">回复 </span>
          <span className="font-semibold text-[#111827]">{comment.replyTo}</span>
          <span className="text-[#111827]">：{body}</span>
        </>
      )
    }
    if (comment.kind === 'ai' && comment.isAuthorReply && comment.replyTo) {
      return (
        <>
          <span className="text-[#9CA3AF]">回复 </span>
          <span className="font-semibold text-[#111827]">{comment.replyTo}</span>
          <span className="text-[#111827]">：{body}</span>
        </>
      )
    }
    if (comment.kind === 'user' && comment.replyTo) {
      return (
        <>
          <span className="text-[#9CA3AF]">回复 </span>
          <span className="font-semibold text-[#111827]">{comment.replyTo}</span>
          <span className="text-[#111827]">：{body}</span>
        </>
      )
    }
    return <span className="text-[#111827]">{body}</span>
  }

  const renderCommentRow = (comment: DisplayComment, animateIn = false) => {
    const charId = comment.kind === 'ai' ? comment.charId : undefined
    const meta = resolveCommentParticipant(comment)
    const commentTime = comment.sortAt

    return (
      <motion.div
        key={comment.id}
        initial={animateIn ? { height: 0, opacity: 0 } : false}
        animate={{ height: 'auto', opacity: 1 }}
        transition={SPRING_IN}
        className="overflow-hidden"
      >
        {showParticipantAvatars ? (
          <div className="flex w-full items-start gap-2.5 py-3">
            <InteractionParticipantAvatar
              meta={meta}
              size="md"
              onClick={onOpenParticipantProfile ? () => openParticipantProfile(meta) : undefined}
            />
            <button
              type="button"
              onClick={() => onReply?.('author' in comment ? comment.author : '', charId)}
              className="min-w-0 flex-1 text-left transition-colors focus:outline-none"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[15px] font-semibold leading-snug text-[#111827]">
                  {meta.remark}
                </span>
                {commentTime ? (
                  <MomentCommentTimeLabel timestamp={commentTime} />
                ) : null}
              </div>
              <p className="mt-1 text-[15px] leading-[1.45] text-[#111827]">
                {renderDetailCommentText(comment)}
              </p>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onReply?.('author' in comment ? comment.author : '', charId)}
            className="block w-full rounded-md px-0.5 py-0.5 text-left text-[13px] leading-relaxed text-[#374151] transition-colors hover:bg-white/80 focus:outline-none"
          >
            {renderFeedCommentBody(comment)}
          </button>
        )}
      </motion.div>
    )
  }

  return (
    <div className="mt-3 rounded-xl bg-gray-50/50 p-3">
      {hasLikes ? (
        <div
          className={`flex items-start text-[13px] leading-relaxed text-[#6B7280] ${
            showParticipantAvatars ? 'gap-2' : 'gap-1.5'
          }`}
        >
          <Heart
            className={`size-3.5 shrink-0 text-[#9CA3AF] ${
              showParticipantAvatars ? 'mt-[3px]' : 'mt-[2px]'
            }`}
            strokeWidth={1.75}
            fill="none"
          />
          {showParticipantAvatars ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {likeEntries.map((entry) => (
                <InteractionParticipantAvatar
                  key={entry.id}
                  meta={entry.meta}
                  size="md"
                  onClick={
                    onOpenParticipantProfile ? () => openParticipantProfile(entry.meta) : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <span>{likeEntries.map((entry) => entry.meta.remark).join('，')}</span>
          )}
        </div>
      ) : null}

      {hasComments ? (
        <div
          className={
            showParticipantAvatars
              ? hasLikes
                ? 'mt-1 border-t border-[#ececec]'
                : ''
              : hasLikes
                ? 'mt-2 space-y-1.5'
                : 'space-y-1.5'
          }
        >
          {showParticipantAvatars ? (
            <div className="flex items-start gap-2">
              <MessageCircle
                className="mt-[11px] size-3.5 shrink-0 text-[#9CA3AF]"
                strokeWidth={1.75}
              />
              <div className="min-w-0 flex-1 divide-y divide-[#ececec]">
                <AnimatePresence initial={false}>
                  {flatDisplayComments.map((comment) => {
                    const animateIn =
                      comment.kind === 'ai' && newlyUnlockedIds.has(comment.id)
                    const animateStoredIn =
                      comment.kind === 'stored-author' && comment.id === highlightCommentId
                    return renderCommentRow(comment, animateIn || animateStoredIn)
                  })}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {flatDisplayComments.map((comment) => {
                const animateIn = comment.kind === 'ai' && newlyUnlockedIds.has(comment.id)
                const animateStoredIn =
                  comment.kind === 'stored-author' && comment.id === highlightCommentId
                return (
                  <div key={comment.id}>
                    {renderCommentRow(comment, animateIn || animateStoredIn)}
                  </div>
                )
              })}
            </AnimatePresence>
          )}
          <AnimatePresence initial={false}>
            {showReplying ? (
              <ReplyingIndicator
                key="replying-indicator"
                authorName={replyingAuthorName!}
                targetName={replyingTargetName!}
              />
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  )
}

export const MomentInteractionArea = memo(MomentInteractionAreaInner)
