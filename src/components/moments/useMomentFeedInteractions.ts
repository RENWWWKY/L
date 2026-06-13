import { useCallback, useEffect, useMemo, useState } from 'react'

import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'
import { useCurrentApiConfig } from '../../phone/apps/api/ApiSettingsContext'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'

import type { MomentComment, MomentItemModel } from './mockMoments'
import { runMomentCommentReplyPipeline } from './momentCommentReplyPipeline'
import {
  ELICIT_REPLY_ALREADY_PENDING_MESSAGE,
  getUnrepliedUserComments,
} from './momentCommentUtils'
import {
  notifyElicitReplyBlocked,
  releaseElicitReplyLock,
  resolveElicitReplyBlockReason,
  shouldAlertElicitDuplicateAfterPost,
  tryAcquireElicitReplyLock,
} from './momentElicitReplyGuard'
import {
  buildMomentsContactDirectory,
  enrichMomentContactsWithLiveCharacterAvatars,
} from './momentsContactDirectory'
import { isMomentsChatApiConfigured, MOMENTS_CHAT_API_NOT_CONFIGURED_MESSAGE } from './momentsChatApiReady'
import { scheduleMomentInteractionMemoryArchive } from './momentInteractionMemoryBridge'
import { buildUserMomentLikePatch } from './momentInteractionNoticeEngine'
import { reanchorPendingInteractionsAfterUserComment, revealAllPendingMomentInteractions } from './momentInteractionTypes'
import {
  isMomentInteractionGenerationPending,
  queueRevealWhenInteractionReady,
} from './momentInteractionGenerationRegistry'
import { loadMomentRelationships } from './momentRelationshipGraph'
import {
  deleteUserMoment,
  patchUserMoment,
} from './momentsFeedStorage'
import type { ContactTag, MomentContactRef } from './newMomentTypes'
import { deleteUserMomentDistributionForMoment } from './userMomentDistributionArchiveService'
import { useMomentsSettingsStore } from './useMomentsSettingsStore'

type FloatingInputTarget = {
  momentId: string
  replyTo?: string
}

type ElicitSession = {
  momentId: string
  replyTo?: string
}

function createCommentId(): string {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

type Params = {
  accountId: string | null | undefined
  displayNickname: string
  momentContacts: MomentContactRef[]
  tags?: ContactTag[]
  qnaWechatCtx: AnonymousQaWechatContext | null
  userMoments: MomentItemModel[]
  setUserMoments: React.Dispatch<React.SetStateAction<MomentItemModel[]>>
  onMomentDeleted?: (momentId: string) => void
}

export function useMomentFeedInteractions({
  accountId,
  displayNickname,
  momentContacts,
  tags = [],
  qnaWechatCtx,
  userMoments,
  setUserMoments,
  onMomentDeleted,
}: Params) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const { settings } = useMomentsSettingsStore()
  const [floatingTarget, setFloatingTarget] = useState<FloatingInputTarget | null>(null)
  const [elicitSession, setElicitSession] = useState<ElicitSession | null>(null)
  const [replyingMomentId, setReplyingMomentId] = useState<string | null>(null)
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null)
  const [momentRelationships, setMomentRelationships] = useState<Relationship[]>([])
  const [feedMomentContacts, setFeedMomentContacts] = useState<MomentContactRef[]>(momentContacts)
  const [blockedCharacterIds, setBlockedCharacterIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    void loadMomentRelationships().then((rels) => {
      if (!cancelled) setMomentRelationships(rels)
    })
    return () => {
      cancelled = true
    }
  }, [accountId])

  useEffect(() => {
    setFeedMomentContacts(momentContacts)
  }, [momentContacts])

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      const enriched = await enrichMomentContactsWithLiveCharacterAvatars(momentContacts)
      if (!cancelled) setFeedMomentContacts(enriched)
    }
    void refresh()
    const onStorage = () => void refresh()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => {
      cancelled = true
      window.removeEventListener('wechat-storage-changed', onStorage)
    }
  }, [momentContacts])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next = new Set<string>()
      for (const c of momentContacts) {
        const charId = c.characterId?.trim()
        if (!charId) continue
        try {
          const character = await personaDb.getCharacter(charId)
          if (character?.momentsPermission?.blocked) next.add(charId)
        } catch {
          // ignore
        }
      }
      if (!cancelled) setBlockedCharacterIds(next)
    })()
    return () => {
      cancelled = true
    }
  }, [momentContacts])

  const contactDirectory = useMemo(
    () => buildMomentsContactDirectory(feedMomentContacts),
    [feedMomentContacts],
  )

  const activeMoment = useMemo(
    () => (floatingTarget ? userMoments.find((m) => m.id === floatingTarget.momentId) : undefined),
    [floatingTarget, userMoments],
  )

  const canElicitActive = useMemo(() => {
    if (!qnaWechatCtx || !isMomentsChatApiConfigured(qnaWechatCtx.apiConfig)) return false
    return (
      resolveElicitReplyBlockReason({
        momentId: activeMoment?.id,
        moment: activeMoment,
        userName: displayNickname,
        contactDirectory,
        momentContacts,
        replyingMomentId,
      }) === null
    )
  }, [
    activeMoment,
    contactDirectory,
    displayNickname,
    momentContacts,
    qnaWechatCtx,
    replyingMomentId,
  ])

  const replyingAuthorName = useMemo(() => {
    if (!replyingMomentId) return null
    if (elicitSession?.momentId === replyingMomentId && elicitSession.replyTo?.trim()) {
      return elicitSession.replyTo.trim()
    }
    const moment = userMoments.find((m) => m.id === replyingMomentId)
    const charId = moment?.authorCharacterId?.trim()
    if (!charId) return moment?.authorName ?? null
    return contactDirectory.getDisplayName(charId)
  }, [contactDirectory, elicitSession, replyingMomentId, userMoments])

  const archiveCharacterMoment = useCallback(
    (moment: MomentItemModel, now = Date.now()) => {
      scheduleMomentInteractionMemoryArchive({
        moment,
        apiConfig,
        wechatAccountId: accountId,
        playerIdentityId: qnaWechatCtx?.playerIdentityId ?? '__none__',
        playerDisplayName: displayNickname,
        contactDirectory,
        momentContacts: feedMomentContacts.length ? feedMomentContacts : momentContacts,
        tags,
        now,
      })
    },
    [
      accountId,
      apiConfig,
      contactDirectory,
      displayNickname,
      feedMomentContacts,
      momentContacts,
      qnaWechatCtx?.playerIdentityId,
      tags,
    ],
  )

  const handleCharacterMomentArchiveTrigger = useCallback(
    (momentId: string) => {
      const moment = userMoments.find((m) => m.id === momentId)
      if (moment) archiveCharacterMoment(moment)
    },
    [archiveCharacterMoment, userMoments],
  )

  const handleAddComment = useCallback(
    async (momentId: string, comment: MomentComment) => {
      const existing = userMoments.find((m) => m.id === momentId)
      if (!existing) return
      const createdAt = comment.createdAt ?? Date.now()
      const withTimestamp = { ...comment, createdAt }
      const reanchoredInteractions = reanchorPendingInteractionsAfterUserComment(
        existing.interactions ?? [],
        createdAt,
      )
      const nextComments = [...(existing.comments ?? []), withTimestamp]
      const next = userMoments.map((m) =>
        m.id === momentId
          ? { ...m, comments: nextComments, interactions: reanchoredInteractions }
          : m,
      )
      setUserMoments(next)
      await patchUserMoment(accountId, momentId, {
        comments: nextComments,
        interactions: reanchoredInteractions,
      })
      if (!existing.isUserAuthored && existing.authorCharacterId) {
        archiveCharacterMoment({
          ...existing,
          comments: nextComments,
          interactions: reanchoredInteractions,
        })
      } else if (existing.isUserAuthored) {
        archiveCharacterMoment({
          ...existing,
          comments: nextComments,
          interactions: reanchoredInteractions,
        })
      }
      return { comments: nextComments, interactions: reanchoredInteractions }
    },
    [accountId, archiveCharacterMoment, setUserMoments, userMoments],
  )

  const triggerCommentReplyPipeline = useCallback(
    async (params: {
      momentId: string
      comments: MomentComment[]
      interactions: MomentItemModel['interactions']
      pendingComments: MomentComment[]
      replyToHint?: string
      showErrorAlert?: boolean
    }) => {
      const existing = userMoments.find((m) => m.id === params.momentId)
      if (!existing) return
      if (!qnaWechatCtx || !isMomentsChatApiConfigured(qnaWechatCtx.apiConfig)) return
      if (!params.pendingComments.length) return

      const { momentId, comments, interactions, pendingComments, replyToHint, showErrorAlert } = params

      setElicitSession(replyToHint !== undefined ? { momentId, replyTo: replyToHint } : null)

      try {
        const result = await runMomentCommentReplyPipeline({
          wechatCtx: qnaWechatCtx,
          moment: existing,
          comments,
          interactions: interactions ?? [],
          pendingComments,
          userDisplayName: displayNickname,
          contactDirectory,
          momentContacts,
          blockedCharacterIds,
          momentRelationships,
          enableDelayedInteraction: settings.enableDelayedInteraction,
        })

        setHighlightCommentId(result.highlightInteractionId)
        setUserMoments((prev) =>
          prev.map((m) =>
            m.id === momentId
              ? { ...m, comments: result.comments, interactions: result.interactions }
              : m,
          ),
        )
        await patchUserMoment(accountId, momentId, {
          comments: result.comments,
          interactions: result.interactions,
        })
        archiveCharacterMoment({
          ...existing,
          comments: result.comments,
          interactions: result.interactions,
        })
      } catch (err) {
        if (showErrorAlert) {
          const message = err instanceof Error ? err.message : '唤起回应失败，请重试'
          window.alert(message)
        }
      } finally {
        setElicitSession(null)
      }
    },
    [
      accountId,
      archiveCharacterMoment,
      blockedCharacterIds,
      contactDirectory,
      displayNickname,
      momentContacts,
      momentRelationships,
      qnaWechatCtx,
      setUserMoments,
      settings.enableDelayedInteraction,
      userMoments,
    ],
  )

  const handlePostComment = useCallback(
    async (text: string) => {
      if (!floatingTarget) return
      const comment: MomentComment = {
        id: createCommentId(),
        author: displayNickname,
        content: text,
        replyTo: floatingTarget.replyTo,
        createdAt: Date.now(),
      }
      await handleAddComment(floatingTarget.momentId, comment)
    },
    [displayNickname, floatingTarget, handleAddComment],
  )

  const handleElicitReply = useCallback(
    async (draftText: string) => {
      if (!floatingTarget) return
      const { momentId, replyTo } = floatingTarget
      const existing = userMoments.find((m) => m.id === momentId)
      if (!existing) return

      if (!qnaWechatCtx || !isMomentsChatApiConfigured(qnaWechatCtx.apiConfig)) {
        window.alert(MOMENTS_CHAT_API_NOT_CONFIGURED_MESSAGE)
        return
      }

      const blockReason = resolveElicitReplyBlockReason({
        momentId,
        moment: existing,
        userName: displayNickname,
        contactDirectory,
        momentContacts,
        replyingMomentId,
      })
      if (blockReason) {
        notifyElicitReplyBlocked(blockReason)
        return
      }

      if (!tryAcquireElicitReplyLock(momentId)) {
        notifyElicitReplyBlocked('in_flight')
        return
      }

      setReplyingMomentId(momentId)

      try {
        let comments = [...(existing.comments ?? [])]
        let interactions = [...(existing.interactions ?? [])]
        const trimmed = draftText.trim()
        if (trimmed) {
          const postedAt = Date.now()
          const posted: MomentComment = {
            id: createCommentId(),
            author: displayNickname,
            content: trimmed,
            replyTo,
            createdAt: postedAt,
          }
          comments = [...comments, posted]
          interactions = reanchorPendingInteractionsAfterUserComment(interactions, postedAt)
          const next = userMoments.map((m) =>
            m.id === momentId ? { ...m, comments, interactions } : m,
          )
          setUserMoments(next)
          await patchUserMoment(accountId, momentId, { comments, interactions })
        }

        const pending = getUnrepliedUserComments(comments, displayNickname)
        if (!pending.length) {
          if (
            shouldAlertElicitDuplicateAfterPost({
              moment: existing,
              userName: displayNickname,
              comments,
              interactions,
            })
          ) {
            window.alert(ELICIT_REPLY_ALREADY_PENDING_MESSAGE)
          }
          return
        }

        setFloatingTarget(null)

        await triggerCommentReplyPipeline({
          momentId,
          comments,
          interactions,
          pendingComments: pending,
          replyToHint: replyTo,
          showErrorAlert: true,
        })
      } finally {
        setReplyingMomentId(null)
        setElicitSession(null)
        releaseElicitReplyLock(momentId)
      }
    },
    [
      accountId,
      contactDirectory,
      displayNickname,
      floatingTarget,
      momentContacts,
      qnaWechatCtx,
      replyingMomentId,
      setUserMoments,
      triggerCommentReplyPipeline,
      userMoments,
    ],
  )

  const handleToggleLike = useCallback(
    async (momentId: string, liked: boolean) => {
      const existing = userMoments.find((m) => m.id === momentId)
      if (!existing) return
      const likePatch = buildUserMomentLikePatch(existing, displayNickname, liked)
      const next = userMoments.map((m) =>
        m.id === momentId ? { ...m, ...likePatch } : m,
      )
      setUserMoments(next)
      await patchUserMoment(accountId, momentId, likePatch)
      if (!existing.isUserAuthored && existing.authorCharacterId) {
        archiveCharacterMoment({ ...existing, ...likePatch })
      } else if (existing.isUserAuthored) {
        archiveCharacterMoment({ ...existing, ...likePatch })
      }
    },
    [accountId, archiveCharacterMoment, displayNickname, setUserMoments, userMoments],
  )

  const handleTogglePin = useCallback(
    async (momentId: string) => {
      const existing = userMoments.find((m) => m.id === momentId)
      if (!existing) return
      if (!existing.isUserAuthored && !existing.authorCharacterId?.trim()) return
      const nextPinned = !existing.isPinned
      setUserMoments((prev) =>
        prev.map((m) => (m.id === momentId ? { ...m, isPinned: nextPinned } : m)),
      )
      await patchUserMoment(accountId, momentId, { isPinned: nextPinned })
      if (existing.isUserAuthored) {
        archiveCharacterMoment({ ...existing, isPinned: nextPinned })
      }
    },
    [accountId, archiveCharacterMoment, setUserMoments, userMoments],
  )

  const handleDeleteMoment = useCallback(
    async (momentId: string) => {
      const existing = userMoments.find((m) => m.id === momentId)
      if (!existing?.isUserAuthored) return
      const next = await deleteUserMoment(accountId, momentId)
      setUserMoments(next)
      await deleteUserMomentDistributionForMoment({ accountId, momentId })
      if (floatingTarget?.momentId === momentId) {
        setFloatingTarget(null)
      }
      onMomentDeleted?.(momentId)
    },
    [accountId, floatingTarget?.momentId, onMomentDeleted, setUserMoments, userMoments],
  )

  const handleRevealPendingInteractions = useCallback(
    async (momentId: string) => {
      const existing = userMoments.find((m) => m.id === momentId)
      if (!existing?.isUserAuthored) return

      if (isMomentInteractionGenerationPending(momentId)) {
        queueRevealWhenInteractionReady(momentId)
        return 'queued' as const
      }

      const now = Date.now()
      const interactions = revealAllPendingMomentInteractions(existing.interactions, now)
      if (!interactions) return 'noop' as const
      const updated = { ...existing, interactions }
      setUserMoments((prev) => prev.map((m) => (m.id === momentId ? updated : m)))
      await patchUserMoment(accountId, momentId, { interactions })
      archiveCharacterMoment(updated)
      return 'revealed' as const
    },
    [accountId, archiveCharacterMoment, setUserMoments, userMoments],
  )

  const openFloatingInput = useCallback((momentId: string, replyTo?: string) => {
    setFloatingTarget({ momentId, replyTo })
  }, [])

  return {
    feedMomentContacts,
    momentRelationships,
    contactDirectory,
    floatingTarget,
    setFloatingTarget,
    replyingMomentId,
    highlightCommentId,
    replyingAuthorName,
    canElicitActive,
    activeMoment,
    archiveCharacterMoment,
    handleCharacterMomentArchiveTrigger,
    handlePostComment,
    handleElicitReply,
    handleToggleLike,
    handleTogglePin,
    handleDeleteMoment,
    handleRevealPendingInteractions,
    openFloatingInput,
    playerIdentityId: qnaWechatCtx?.playerIdentityId,
  }
}
