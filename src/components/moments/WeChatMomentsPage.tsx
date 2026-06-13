import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'
import { useCurrentApiConfig } from '../../phone/apps/api/ApiSettingsContext'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { useWechatStore } from '../../phone/apps/wechat/useWechatStore'
import { resolveProfileAvatarPreviewUrl } from '../../phone/utils/characterAvatarUrl'

import { DynamicHeader } from './DynamicHeader'
import { FloatingInput } from './FloatingInput'
import { InteractionHistoryPage } from './InteractionHistoryPage'
import { InteractionSettingsPage } from './InteractionSettingsPage'
import { MomentDetailPage } from './MomentDetailPage'
import { MomentNoticeBadge } from './MomentNoticeBadge'
import { MomentsContentBackdrop, MomentsContentBackgroundLayer } from './MomentsContentBackdrop'
import { MomentsCoverEditorSheet } from './MomentsCoverEditorSheet'
import { MomentsFeed } from './MomentsFeed'
import { MomentsCover } from './MomentsCover'
import type { MomentComment, MomentItemModel } from './mockMoments'
import { runMomentCommentReplyPipeline } from './momentCommentReplyPipeline'
import {
  ELICIT_REPLY_ALREADY_PENDING_MESSAGE,
  getUnrepliedUserComments,
} from './momentCommentUtils'
import {
  isElicitReplyInFlight,
  notifyElicitReplyBlocked,
  releaseElicitReplyLock,
  resolveElicitReplyBlockReason,
  shouldAlertElicitDuplicateAfterPost,
  tryAcquireElicitReplyLock,
} from './momentElicitReplyGuard'
import { buildMomentsContactDirectory, enrichMomentContactsWithLiveCharacterAvatars } from './momentsContactDirectory'
import { isMomentsChatApiConfigured, MOMENTS_CHAT_API_NOT_CONFIGURED_MESSAGE } from './momentsChatApiReady'
import { resolveMomentsCoverDisplayUrl } from './momentsCoverDefaults'
import type { AiMomentInteractionDraft } from './momentInteractionTypes'
import { generateMomentInteractions, countAiEngagementDrafts } from './momentInteractionAi'
import { finalizeUserMomentEngagementDrafts } from './momentUserInteractionAi'
import { buildUserMomentLikePatch } from './momentInteractionNoticeEngine'
import {
  materializeInteractions,
  reanchorPendingInteractionsAfterUserComment,
  revealAllPendingMomentInteractions,
} from './momentInteractionTypes'
import { filterMomentsForUserFeed } from './momentFeedVisibility'
import { filterAllowedMomentCharacters } from './momentPrivacyAudience'
import {
  filterPlayerBoundMomentCharacters,
  loadMomentRelationships,
} from './momentRelationshipGraph'
import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'
import {
  loadUserMoments,
  migrateUserMomentInlineImagesIfNeeded,
  deleteUserMoment,
  patchUserMoment,
  upsertUserMoment,
} from './momentsFeedStorage'
import type { MomentContactRef, NewMomentDraft } from './newMomentTypes'
import type { OnOpenMomentParticipantProfile } from './momentProfileNavigation'
import { MomentInstantGenModal } from './MomentInstantGenModal'
import { PublishMomentPage } from './PublishMomentPage'
import { MomentsSettingsPage } from './MomentsSettingsPage'
import { useMomentsContactTags } from './momentsContactTagsStore'
import { useResolvedMomentsImageGenSettings } from './useResolvedMomentsImageGenSettings'
import { useMomentsSettingsStore } from './useMomentsSettingsStore'
import { useMomentsStore } from './useMomentsStore'
import { useSyncMomentInteractionNotices } from './useSyncMomentInteractionNotices'
import { useMomentInteractionClock } from './useMomentInteractionClock'
import { draftToMomentItem } from './publishMomentUtils'
import {
  ensureMentionedCharacterAwarenessDrafts,
  filterMentionedCharactersByAudience,
} from './momentMentionUtils'
import { scheduleMomentInteractionMemoryArchive } from './momentInteractionMemoryBridge'
import { deleteUserMomentDistributionForMoment } from './userMomentDistributionArchiveService'
import {
  appendVisitorFootprintInteractions,
  mergeMomentInteractions,
  momentNeedsVisitorFootprintBackfill,
  privacyMetaToDraftPrivacy,
} from './momentVisitorFootprints'
import { resolveUserMomentEngagementRules } from './userMomentEngagementRules'
import {
  applyQueuedRevealAfterGeneration,
  isMomentInteractionGenerationPending,
  markMomentInteractionGenerationEnd,
  markMomentInteractionGenerationStart,
  queueRevealWhenInteractionReady,
} from './momentInteractionGenerationRegistry'

type FloatingInputTarget = {
  momentId: string
  replyTo?: string
}

type ElicitSession = {
  momentId: string
  replyTo?: string
}

type MomentsSubView = 'feed' | 'interaction-history' | 'interaction-settings' | 'moment-detail'

function createCommentId(): string {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

type WeChatMomentsPageProps = {
  onBack?: () => void
  wechatNickname?: string
  wechatAvatarUrl?: string
  momentsCoverUrl?: string
  onMomentsCoverChange?: (url: string) => void | Promise<void>
  momentContacts?: MomentContactRef[]
  currentUserName?: string
  qnaWechatCtx?: AnonymousQaWechatContext | null
  onOpenParticipantProfile?: OnOpenMomentParticipantProfile
}

export function WeChatMomentsPage({
  onBack,
  wechatNickname,
  wechatAvatarUrl,
  momentsCoverUrl,
  onMomentsCoverChange,
  momentContacts = [],
  currentUserName = '我',
  qnaWechatCtx = null,
  onOpenParticipantProfile,
}: WeChatMomentsPageProps) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const { currentAccountId } = useWechatStore()
  const displayNickname = wechatNickname?.trim() || currentUserName.trim() || '我'
  const displayAvatarUrl = resolveProfileAvatarPreviewUrl(wechatAvatarUrl)
  const displayCoverUrl = resolveMomentsCoverDisplayUrl(momentsCoverUrl)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const coverWrapRef = useRef<HTMLDivElement | null>(null)
  const visitorBackfillDoneRef = useRef<Set<string>>(new Set())
  const [headerOpacity, setHeaderOpacity] = useState(0)
  const [coverEditorOpen, setCoverEditorOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [instantGenOpen, setInstantGenOpen] = useState(false)
  const [userMoments, setUserMoments] = useState<MomentItemModel[]>([])
  const [blockedCharacterIds, setBlockedCharacterIds] = useState<Set<string>>(new Set())
  const [floatingTarget, setFloatingTarget] = useState<FloatingInputTarget | null>(null)
  const [elicitSession, setElicitSession] = useState<ElicitSession | null>(null)
  const [replyingMomentId, setReplyingMomentId] = useState<string | null>(null)
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null)
  const [subView, setSubView] = useState<MomentsSubView>('feed')
  const [detailMomentId, setDetailMomentId] = useState<string | null>(null)
  const [momentRelationships, setMomentRelationships] = useState<Relationship[]>([])
  const [feedMomentContacts, setFeedMomentContacts] = useState<MomentContactRef[]>(momentContacts)
  const { tags } = useMomentsContactTags()
  const { settings } = useMomentsSettingsStore()
  const { effectiveImageGen: imageGenSettings } = useResolvedMomentsImageGenSettings()
  const userMomentEngagementRules = useMemo(
    () => resolveUserMomentEngagementRules(settings.userMomentEngagement),
    [settings.userMomentEngagement],
  )
  const bindNoticeAccount = useMomentsStore((s) => s.bindAccount)
  const interactionUnreadCount = useMomentsStore((s) => s.notices.filter((n) => !n.isRead).length)
  const interactionNow = useMomentInteractionClock(5000)

  useEffect(() => {
    let cancelled = false
    void loadMomentRelationships().then((rels) => {
      if (!cancelled) setMomentRelationships(rels)
    })
    return () => {
      cancelled = true
    }
  }, [currentAccountId])

  useEffect(() => {
    if (!currentAccountId) {
      setUserMoments([])
      return
    }
    let cancelled = false
    void (async () => {
      await migrateUserMomentInlineImagesIfNeeded(currentAccountId)
      const items = await loadUserMoments(currentAccountId)
      if (!cancelled) setUserMoments(items)
    })()
    return () => {
      cancelled = true
    }
  }, [currentAccountId])

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
    void bindNoticeAccount(currentAccountId)
  }, [bindNoticeAccount, currentAccountId])

  useSyncMomentInteractionNotices({
    moments: userMoments,
    now: interactionNow,
    userDisplayName: displayNickname,
    playerIdentityId: qnaWechatCtx?.playerIdentityId,
    momentContacts,
  })

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

  useEffect(() => {
    if (!currentAccountId) return
    let cancelled = false

    void (async () => {
      for (const moment of userMoments) {
        if (cancelled) return
        if (!momentNeedsVisitorFootprintBackfill(moment)) continue
        if (visitorBackfillDoneRef.current.has(moment.id)) continue

        const privacy = privacyMetaToDraftPrivacy(moment.privacy)
        let allowed = filterAllowedMomentCharacters(privacy, momentContacts, tags)
        allowed = filterPlayerBoundMomentCharacters(
          allowed,
          qnaWechatCtx?.playerIdentityId,
          momentRelationships,
        )
        if (!allowed.length) {
          visitorBackfillDoneRef.current.add(moment.id)
          continue
        }

        const stored = await loadUserMoments(currentAccountId)
        if (cancelled) return
        const live = stored.find((m) => m.id === moment.id) ?? moment
        if (!momentNeedsVisitorFootprintBackfill(live)) {
          visitorBackfillDoneRef.current.add(moment.id)
          continue
        }

        const extra = appendVisitorFootprintInteractions(
          live,
          allowed,
          !settings.enableDelayedInteraction,
        )
        if (!extra.length) {
          visitorBackfillDoneRef.current.add(moment.id)
          continue
        }

        const merged = mergeMomentInteractions(live.interactions, extra)
        const patched = await patchUserMoment(currentAccountId, moment.id, {
          interactions: merged,
        })
        if (cancelled) return
        setUserMoments((prev) => {
          const fromStorage = patched.find((m) => m.id === moment.id)
          const fromPrev = prev.find((m) => m.id === moment.id)
          if (!fromStorage || !fromPrev) return patched
          const storageCount = fromStorage.interactions?.length ?? 0
          const prevCount = fromPrev.interactions?.length ?? 0
          if (storageCount >= prevCount) return patched
          return patched.map((m) =>
            m.id === moment.id ? { ...m, interactions: fromPrev.interactions } : m,
          )
        })
        visitorBackfillDoneRef.current.add(moment.id)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    currentAccountId,
    momentContacts,
    momentRelationships,
    qnaWechatCtx?.playerIdentityId,
    settings.enableDelayedInteraction,
    tags,
    userMoments,
  ])

  const moments = useMemo(
    () => filterMomentsForUserFeed(userMoments, momentContacts, blockedCharacterIds),
    [userMoments, momentContacts, blockedCharacterIds],
  )

  const detailMoment = useMemo(
    () => (detailMomentId ? userMoments.find((m) => m.id === detailMomentId) : undefined),
    [detailMomentId, userMoments],
  )

  const existingMomentIds = useMemo(
    () => new Set(userMoments.map((m) => m.id)),
    [userMoments],
  )

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
        wechatAccountId: currentAccountId,
        playerIdentityId: qnaWechatCtx?.playerIdentityId ?? '__none__',
        playerDisplayName: displayNickname,
        contactDirectory,
        momentContacts,
        tags,
        now,
      })
    },
    [
      apiConfig,
      contactDirectory,
      currentAccountId,
      displayNickname,
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

  const handlePublish = useCallback(
    (draft: NewMomentDraft) => {
      const publishedAt = Date.now()
      const item = draftToMomentItem(
        draft,
        { name: displayNickname, avatar: displayAvatarUrl },
        tags,
      )
      const allowedByPrivacy = filterAllowedMomentCharacters(draft.privacy, momentContacts, tags)
      const allowed = filterPlayerBoundMomentCharacters(
        allowedByPrivacy,
        qnaWechatCtx?.playerIdentityId,
        momentRelationships,
      )
      const mentionedCharacters = filterMentionedCharactersByAudience(draft.mentions, allowed)
      const shouldGenerateInteractions =
        allowed.length > 0 && draft.privacy.mode !== 'private'

      if (shouldGenerateInteractions) {
        markMomentInteractionGenerationStart(item.id)
      }

      setUserMoments((prev) => [item, ...prev.filter((m) => m.id !== item.id)])
      scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })

      void (async () => {
        let aiDrafts: AiMomentInteractionDraft[] = []
        try {
          const next = await upsertUserMoment(currentAccountId, item)
          setUserMoments(next)

          scheduleMomentInteractionMemoryArchive({
            moment: item,
            apiConfig,
            wechatAccountId: currentAccountId,
            playerIdentityId: qnaWechatCtx?.playerIdentityId ?? '__none__',
            playerDisplayName: displayNickname,
            contactDirectory,
            momentContacts,
            tags,
            now: publishedAt,
          })

          if (!shouldGenerateInteractions) return

          try {
            aiDrafts = await generateMomentInteractions({
              apiConfig,
              momentContent: draft.content,
              imageCount: draft.images.length,
              momentImages: draft.images,
              allowedCharacters: allowed,
              mentionedCharacters,
              wechatCtx: qnaWechatCtx,
              momentPublishedAt: publishedAt,
              engagementRules: userMomentEngagementRules,
            })
            aiDrafts = ensureMentionedCharacterAwarenessDrafts(
              aiDrafts,
              mentionedCharacters.map((c) => c.charId),
            )
          } catch (err) {
            console.error('[WeChatMomentsPage] generateMomentInteractions failed', err)
          }

          const drafts = await finalizeUserMomentEngagementDrafts({
            drafts: aiDrafts,
            allowed,
            mentionedCharacterIds: new Set(mentionedCharacters.map((c) => c.charId)),
            playerIdentityId: qnaWechatCtx?.playerIdentityId,
            relationships: momentRelationships,
            engagementRules: userMomentEngagementRules,
            wechatCtx: qnaWechatCtx,
            momentContent: draft.content,
            momentImages: draft.images,
            imageCount: draft.images.length,
            momentPublishedAt: publishedAt,
          })

          if (!drafts.length && !mentionedCharacters.length) return

          let interactions = materializeInteractions(
            drafts,
            publishedAt,
            !settings.enableDelayedInteraction,
          )
          interactions = applyQueuedRevealAfterGeneration(item.id, interactions)
          const withInteractions = { ...item, interactions }
          const patched = await patchUserMoment(currentAccountId, item.id, { interactions })
          if (shouldGenerateInteractions) {
            markMomentInteractionGenerationEnd(item.id, countAiEngagementDrafts(aiDrafts))
          }
          setUserMoments(patched)
          scheduleMomentInteractionMemoryArchive({
            moment: withInteractions,
            apiConfig,
            wechatAccountId: currentAccountId,
            playerIdentityId: qnaWechatCtx?.playerIdentityId ?? '__none__',
            playerDisplayName: displayNickname,
            contactDirectory,
            momentContacts,
            tags,
            now: publishedAt,
          })
        } finally {
          if (shouldGenerateInteractions) {
            markMomentInteractionGenerationEnd(item.id, countAiEngagementDrafts(aiDrafts))
          }
        }
      })()
    },
    [
      apiConfig,
      contactDirectory,
      currentAccountId,
      displayAvatarUrl,
      displayNickname,
      momentContacts,
      momentRelationships,
      qnaWechatCtx,
      tags,
      settings.enableDelayedInteraction,
      userMomentEngagementRules,
    ],
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
      await patchUserMoment(currentAccountId, momentId, {
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
    [archiveCharacterMoment, currentAccountId, userMoments],
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

      const { momentId, comments, interactions, pendingComments, replyToHint, showErrorAlert } =
        params

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
        await patchUserMoment(currentAccountId, momentId, {
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
      archiveCharacterMoment,
      blockedCharacterIds,
      contactDirectory,
      currentAccountId,
      displayNickname,
      momentContacts,
      momentRelationships,
      qnaWechatCtx,
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
          await patchUserMoment(currentAccountId, momentId, { comments, interactions })
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
      contactDirectory,
      currentAccountId,
      displayNickname,
      floatingTarget,
      momentContacts,
      qnaWechatCtx,
      replyingMomentId,
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
      await patchUserMoment(currentAccountId, momentId, likePatch)
      if (!existing.isUserAuthored && existing.authorCharacterId) {
        archiveCharacterMoment({ ...existing, ...likePatch })
      } else if (existing.isUserAuthored) {
        archiveCharacterMoment({ ...existing, ...likePatch })
      }
    },
    [archiveCharacterMoment, currentAccountId, displayNickname, userMoments],
  )

  const handleTogglePin = useCallback(
    async (momentId: string) => {
      const existing = userMoments.find((m) => m.id === momentId)
      if (!existing?.isUserAuthored) return
      const nextPinned = !existing.isPinned
      setUserMoments((prev) =>
        prev.map((m) => (m.id === momentId ? { ...m, isPinned: nextPinned } : m)),
      )
      await patchUserMoment(currentAccountId, momentId, { isPinned: nextPinned })
      archiveCharacterMoment({ ...existing, isPinned: nextPinned })
    },
    [archiveCharacterMoment, currentAccountId, userMoments],
  )

  const handleDeleteMoment = useCallback(
    async (momentId: string) => {
      const existing = userMoments.find((m) => m.id === momentId)
      if (!existing?.isUserAuthored) return
      const next = await deleteUserMoment(currentAccountId, momentId)
      setUserMoments(next)
      await deleteUserMomentDistributionForMoment({ accountId: currentAccountId, momentId })
      if (detailMomentId === momentId) {
        setDetailMomentId(null)
        setSubView('feed')
      }
      if (floatingTarget?.momentId === momentId) {
        setFloatingTarget(null)
      }
    },
    [currentAccountId, detailMomentId, floatingTarget?.momentId, userMoments],
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
      await patchUserMoment(currentAccountId, momentId, { interactions })
      archiveCharacterMoment(updated)
      return 'revealed' as const
    },
    [archiveCharacterMoment, currentAccountId, userMoments],
  )

  const handleCharacterMomentPublished = useCallback(
    async (item: MomentItemModel) => {
      const next = await upsertUserMoment(currentAccountId, item)
      setUserMoments(next)
      scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      archiveCharacterMoment(item)
    },
    [archiveCharacterMoment, currentAccountId],
  )

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const syncHeaderOpacity = () => {
      const coverHeight = coverWrapRef.current?.offsetHeight ?? 260
      const fadeStart = Math.max(48, coverHeight - 180)
      const fadeEnd = Math.max(fadeStart + 1, coverHeight - 104)
      const y = el.scrollTop
      if (y <= fadeStart) {
        setHeaderOpacity(0)
        return
      }
      if (y >= fadeEnd) {
        setHeaderOpacity(1)
        return
      }
      const progress = (y - fadeStart) / (fadeEnd - fadeStart)
      setHeaderOpacity(Math.max(0, Math.min(1, progress)))
    }
    el.addEventListener('scroll', syncHeaderOpacity, { passive: true })
    window.addEventListener('resize', syncHeaderOpacity)
    syncHeaderOpacity()
    return () => {
      el.removeEventListener('scroll', syncHeaderOpacity)
      window.removeEventListener('resize', syncHeaderOpacity)
    }
  }, [])

  return (
    <div className="relative h-full min-h-0 overflow-hidden" data-moments-page-shell>
      <MomentsContentBackgroundLayer />
      <div
        ref={scrollerRef}
        className={`relative z-10 h-full min-h-0 overflow-y-auto bg-transparent text-[#111827] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
          floatingTarget ? 'pb-36' : 'pb-8'
        }`}
        data-moments-feed-scroller
      >
        <DynamicHeader
          opacity={headerOpacity}
          onBack={onBack}
          onOpenSettings={() => setSettingsOpen(true)}
          goToPublish={() => setPublishOpen(true)}
          onInstantGen={() => setInstantGenOpen(true)}
          onOpenInteractionHistory={() => setSubView('interaction-history')}
          interactionUnreadCount={interactionUnreadCount}
        />
        <div className="mx-auto max-w-[560px]">
          <div ref={coverWrapRef} className="relative">
            <MomentsCover
              coverUrl={displayCoverUrl}
              nickname={displayNickname}
              avatarUrl={displayAvatarUrl}
              onCoverClick={onMomentsCoverChange ? () => setCoverEditorOpen(true) : undefined}
              onAvatarClick={
                onOpenParticipantProfile
                  ? () =>
                      onOpenParticipantProfile({
                        kind: 'self',
                        remarkName: displayNickname,
                        avatarUrl: displayAvatarUrl,
                      })
                  : undefined
              }
            />
            <MomentNoticeBadge
              contactDirectory={contactDirectory}
              onOpenHistory={() => setSubView('interaction-history')}
            />
          </div>
          <MomentsContentBackdrop>
            <MomentsFeed
              moments={moments}
              currentUserName={displayNickname}
              currentUserAvatarUrl={displayAvatarUrl}
              momentContacts={feedMomentContacts}
              momentRelationships={momentRelationships}
              playerIdentityId={qnaWechatCtx?.playerIdentityId}
              replyingMomentId={replyingMomentId}
              replyingAuthorName={replyingAuthorName}
              replyingTargetName={displayNickname}
              highlightCommentId={highlightCommentId}
              onOpenFloatingInput={(momentId, replyTo) => setFloatingTarget({ momentId, replyTo })}
              onToggleLike={handleToggleLike}
              onCharacterMomentInteractionsUnlocked={handleCharacterMomentArchiveTrigger}
              onTogglePin={handleTogglePin}
              onDelete={handleDeleteMoment}
              onRevealPendingInteractions={handleRevealPendingInteractions}
              onOpenParticipantProfile={onOpenParticipantProfile}
            />
          </MomentsContentBackdrop>
        </div>
      </div>

      {onMomentsCoverChange ? (
        <MomentsCoverEditorSheet
          open={coverEditorOpen}
          coverUrl={momentsCoverUrl}
          onClose={() => setCoverEditorOpen(false)}
          onSave={onMomentsCoverChange}
        />
      ) : null}

      <PublishMomentPage
        open={publishOpen}
        contacts={momentContacts}
        onClose={() => setPublishOpen(false)}
        onPublish={handlePublish}
      />

      <MomentInstantGenModal
        open={instantGenOpen}
        onClose={() => setInstantGenOpen(false)}
        wechatCtx={qnaWechatCtx}
        momentContacts={momentContacts}
        imageGenSettings={imageGenSettings}
        onPublished={handleCharacterMomentPublished}
      />

      <AnimatePresence>
        {subView === 'interaction-history' ? (
          <InteractionHistoryPage
            contactDirectory={contactDirectory}
            existingMomentIds={existingMomentIds}
            onBack={() => setSubView('feed')}
            onOpenSettings={() => setSubView('interaction-settings')}
            onSelectMoment={(momentId) => {
              setDetailMomentId(momentId)
              setSubView('moment-detail')
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {subView === 'moment-detail' ? (
          detailMoment ? (
            <MomentDetailPage
              item={detailMoment}
              currentUserName={displayNickname}
              currentUserAvatarUrl={displayAvatarUrl}
              momentContacts={feedMomentContacts}
              momentRelationships={momentRelationships}
              playerIdentityId={qnaWechatCtx?.playerIdentityId}
              replyingMomentId={replyingMomentId}
              replyingAuthorName={replyingAuthorName}
              replyingTargetName={displayNickname}
              highlightCommentId={highlightCommentId}
              onBack={() => {
                setDetailMomentId(null)
                setSubView('interaction-history')
              }}
              onOpenFloatingInput={(momentId, replyTo) => setFloatingTarget({ momentId, replyTo })}
              onToggleLike={handleToggleLike}
              onCharacterMomentInteractionsUnlocked={handleCharacterMomentArchiveTrigger}
              onTogglePin={handleTogglePin}
              onDelete={handleDeleteMoment}
              onRevealPendingInteractions={handleRevealPendingInteractions}
              onOpenParticipantProfile={onOpenParticipantProfile}
            />
          ) : (
            <motion.div
              key="moment-detail-missing"
              className="absolute inset-0 z-[440] flex flex-col items-center justify-center bg-white px-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-center text-[14px] text-gray-500">该动态已不存在</p>
              <button
                type="button"
                className="mt-4 rounded-full bg-[#111827] px-5 py-2 text-[13px] text-white"
                onClick={() => {
                  setDetailMomentId(null)
                  setSubView('interaction-history')
                }}
              >
                返回
              </button>
            </motion.div>
          )
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {subView === 'interaction-settings' ? (
          <InteractionSettingsPage onBack={() => setSubView('interaction-history')} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen ? (
          <MomentsSettingsPage
            onBack={() => setSettingsOpen(false)}
            accountId={currentAccountId}
            onMomentsCleared={() => {
              setUserMoments([])
              setFloatingTarget(null)
              setElicitSession(null)
              setReplyingMomentId(null)
              setHighlightCommentId(null)
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {floatingTarget ? (
          <FloatingInput
            open
            canElicit={canElicitActive}
            busy={
              replyingMomentId === floatingTarget.momentId ||
              isElicitReplyInFlight(floatingTarget.momentId)
            }
            targetLabel={
              activeMoment
                ? floatingTarget.replyTo?.trim()
                  ? `回复 ${floatingTarget.replyTo.trim()}`
                  : `评论 ${activeMoment.authorName} 的朋友圈`
                : undefined
            }
            onClose={() => setFloatingTarget(null)}
            onPost={handlePostComment}
            onElicit={handleElicitReply}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
