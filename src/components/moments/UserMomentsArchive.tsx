import { AnimatePresence, motion } from 'framer-motion'
import { Camera, ChevronRight, History } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'
import { useCurrentApiConfig } from '../../phone/apps/api/ApiSettingsContext'
import { DEFAULT_PUBLIC_AVATAR_PATH } from '../../phone/types'
import { resolvePublicImageUrl } from '../../publicAssetUrl'
import { resolveProfileAvatarPreviewUrl } from '../../phone/utils/characterAvatarUrl'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'

import { ArchiveTimelineDateColumn, MomentBodyText, momentsSerifNumericStyle } from './ArchiveTimelineDateColumn'
import { ArchiveMomentsHeader } from './ArchiveMomentsHeader'
import { FloatingInput } from './FloatingInput'
import { ArchiveTextOnlyMomentStrip, MomentArchiveThumbnail, MOMENT_ARCHIVE_TEXT_STRIP_CLASS, MOMENT_ARCHIVE_THUMB_OUTER_CLASS } from './MomentArchiveThumbnail'
import { MomentDetailPage } from './MomentDetailPage'
import { MomentHistoricalGenModal } from './MomentHistoricalGenModal'
import { MomentsCover } from './MomentsCover'
import { MomentsContentBackdrop, MomentsContentBackgroundLayer } from './MomentsContentBackdrop'
import { PinnedMomentsListPage } from './PinnedMomentsListPage'
import { PublishMomentPage } from './PublishMomentPage'
import type { MomentItemModel } from './mockMoments'
import { generateMomentInteractions, countAiEngagementDrafts } from './momentInteractionAi'
import { finalizeUserMomentEngagementDrafts } from './momentUserInteractionAi'
import type { AiMomentInteractionDraft } from './momentInteractionTypes'
import {
  materializeInteractions,
} from './momentInteractionTypes'
import { filterAllowedMomentCharacters } from './momentPrivacyAudience'
import {
  filterPlayerBoundMomentCharacters,
} from './momentRelationshipGraph'
import { buildMomentsContactDirectory } from './momentsContactDirectory'
import { patchUserMoment, upsertUserMoment } from './momentsFeedStorage'
import { formatMomentLocationDisplay } from './momentLocationUtils'
import { scheduleMomentInteractionMemoryArchive } from './momentInteractionMemoryBridge'
import {
  ensureMentionedCharacterAwarenessDrafts,
  filterMentionedCharactersByAudience,
} from './momentMentionUtils'
import { sanitizeMomentBodyText } from './momentTextSanitize'
import type { NewMomentDraft } from './newMomentTypes'
import { draftToMomentItem } from './publishMomentUtils'
import { isElicitReplyInFlight } from './momentElicitReplyGuard'
import type { ArchiveTimelineEntry } from './userMomentsArchiveFilters'
import { filterMomentsForArchiveSubject } from './userMomentsArchiveFilters'
import { getCalendarYear, shouldShowArchiveYearHeader } from './utils/archiveTimelineDate'
import { useArchiveLazySlice } from './useArchiveLazySlice'
import { useMomentFeedInteractions } from './useMomentFeedInteractions'
import { profilePayloadFromArchiveSubject } from './momentProfileNavigation'
import type { OnOpenMomentParticipantProfile } from './momentProfileNavigation'
import { useMomentsContactTags } from './momentsContactTagsStore'
import { useMomentsSettingsStore } from './useMomentsSettingsStore'
import { useSyncMomentInteractionNotices } from './useSyncMomentInteractionNotices'
import { useUserMomentsArchive } from './useUserMomentsArchive'
import { useMomentInteractionClock } from './useMomentInteractionClock'
import { useResolvedMomentsImageGenSettings } from './useResolvedMomentsImageGenSettings'
import { resolveUserMomentEngagementRules } from './userMomentEngagementRules'
import {
  applyQueuedRevealAfterGeneration,
  markMomentInteractionGenerationEnd,
  markMomentInteractionGenerationStart,
} from './momentInteractionGenerationRegistry'

type UserMomentsArchiveProps = {
  userId: string
  accountId: string | null | undefined
  selfProfile?: {
    displayName: string
    signature?: string
    avatarUrl?: string
    coverUrl?: string
  }
  momentContacts?: import('./newMomentTypes').MomentContactRef[]
  qnaWechatCtx?: AnonymousQaWechatContext | null
  onOpenParticipantProfile?: OnOpenMomentParticipantProfile
  /** 封面与标题展示名（微信备注优先；联系人资料页传入） */
  coverNickname?: string
  onBack: () => void
}

const listVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.06 },
  },
}

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const },
  },
}

function PinnedBarPreview({ moment }: { moment: MomentItemModel }) {
  const images = (moment.images ?? []).slice(0, 9)
  if (images.length) {
    return <MomentArchiveThumbnail images={images} variant="timeline" />
  }
  const content = sanitizeMomentBodyText(moment.content)
  return <ArchiveTextOnlyMomentStrip content={content} variant="pinnedBar" />
}

function TimelineMomentCard({
  moment,
  onOpen,
}: {
  moment: MomentItemModel
  onOpen: () => void
}) {
  const images = (moment.images ?? []).slice(0, 9)
  const content = sanitizeMomentBodyText(moment.content)
  const hasImages = images.length > 0
  const hasText = content.length > 0

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left transition-opacity hover:opacity-85"
    >
      {hasImages ? (
        <div className={`flex gap-3 ${hasText ? 'items-start' : 'items-center'}`}>
          <MomentArchiveThumbnail images={images} variant="timeline" />
          {hasText ? (
            <div className="min-w-0 flex-1">
              <MomentBodyText
                text={content}
                className="text-[14px] leading-[1.55] text-[#111827] line-clamp-3"
              />
            </div>
          ) : null}
        </div>
      ) : hasText ? (
        <ArchiveTextOnlyMomentStrip content={content} variant="timeline" />
      ) : null}
    </button>
  )
}

function CameraTodayEntry({ onOpenPublish }: { onOpenPublish?: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpenPublish}
      disabled={!onOpenPublish}
      className={`${MOMENT_ARCHIVE_THUMB_OUTER_CLASS} flex items-center justify-center rounded-lg bg-gray-50 transition-colors hover:bg-gray-100/90 disabled:cursor-default disabled:opacity-60`}
    >
      <Camera className="size-6 text-gray-300" strokeWidth={1.25} />
    </button>
  )
}

function TimelineRow({
  entry,
  showDateLabel,
  onOpenMoment,
  onOpenPublish,
}: {
  entry: ArchiveTimelineEntry
  showDateLabel: boolean
  onOpenMoment: (moment: MomentItemModel) => void
  onOpenPublish?: () => void
}) {
  const timestamp = entry.kind === 'moment' ? entry.moment.timestamp : Date.now()
  const locationLabel =
    entry.kind === 'moment' ? formatMomentLocationDisplay(entry.moment.location) : undefined

  return (
    <motion.article
      variants={rowVariants}
      className={`flex items-start gap-3 ${showDateLabel ? 'pb-5' : 'pb-3'}`}
    >
      <div className="w-[20%] shrink-0 self-start pt-0.5">
        <ArchiveTimelineDateColumn
          timestamp={timestamp}
          locationLabel={locationLabel}
          showDateLabel={showDateLabel}
        />
      </div>

      <div className="min-w-0 flex-1 self-start">
        {entry.kind === 'camera' ? (
          <CameraTodayEntry onOpenPublish={onOpenPublish} />
        ) : (
          <TimelineMomentCard moment={entry.moment} onOpen={() => onOpenMoment(entry.moment)} />
        )}
      </div>
    </motion.article>
  )
}

export function UserMomentsArchive({
  userId,
  accountId,
  selfProfile,
  momentContacts = [],
  qnaWechatCtx = null,
  onOpenParticipantProfile,
  coverNickname,
  onBack,
}: UserMomentsArchiveProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const coverWrapRef = useRef<HTMLDivElement | null>(null)
  const [headerOpacity, setHeaderOpacity] = useState(0)
  const [detailMomentId, setDetailMomentId] = useState<string | null>(null)
  const [pinnedListOpen, setPinnedListOpen] = useState(false)
  const [historicalGenOpen, setHistoricalGenOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [blockedCharacterIds, setBlockedCharacterIds] = useState<Set<string>>(new Set())
  const interactionNow = useMomentInteractionClock(5000)
  const apiConfig = useCurrentApiConfig('chatCard')
  const { tags } = useMomentsContactTags()
  const { settings } = useMomentsSettingsStore()
  const { effectiveImageGen: imageGenSettings } = useResolvedMomentsImageGenSettings()
  const userMomentEngagementRules = useMemo(
    () => resolveUserMomentEngagementRules(settings.userMomentEngagement),
    [settings.userMomentEngagement],
  )

  const displayNickname = selfProfile?.displayName.trim() || '我'
  const displayAvatarUrl = resolveProfileAvatarPreviewUrl(selfProfile?.avatarUrl)

  const { loading, profile, allMoments, setAllMoments, pinnedMoments, timelineEntries } =
    useUserMomentsArchive({
      accountId,
      userId,
      selfProfile,
    })

  const {
    feedMomentContacts,
    momentRelationships,
    floatingTarget,
    setFloatingTarget,
    replyingMomentId,
    highlightCommentId,
    replyingAuthorName,
    canElicitActive,
    activeMoment,
    handleCharacterMomentArchiveTrigger,
    handlePostComment,
    handleElicitReply,
    handleToggleLike,
    handleTogglePin,
    handleDeleteMoment,
    handleRevealPendingInteractions,
    openFloatingInput,
    playerIdentityId,
  } = useMomentFeedInteractions({
    accountId,
    displayNickname,
    momentContacts,
    tags,
    qnaWechatCtx,
    userMoments: allMoments,
    setUserMoments: setAllMoments,
    onMomentDeleted: (momentId) => {
      if (detailMomentId === momentId) setDetailMomentId(null)
      if (floatingTarget?.momentId === momentId) setFloatingTarget(null)
    },
  })

  useSyncMomentInteractionNotices({
    moments: allMoments,
    now: interactionNow,
    userDisplayName: displayNickname,
    playerIdentityId,
    momentContacts,
  })

  const contactDirectory = useMemo(
    () => buildMomentsContactDirectory(feedMomentContacts),
    [feedMomentContacts],
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

      setAllMoments((prev) => {
        const merged = [item, ...prev.filter((m) => m.id !== item.id)]
        return filterMomentsForArchiveSubject(merged, userId)
      })

      void (async () => {
        let aiDrafts: AiMomentInteractionDraft[] = []
        try {
          const next = await upsertUserMoment(accountId, item)
          setAllMoments(filterMomentsForArchiveSubject(next, userId))

          scheduleMomentInteractionMemoryArchive({
            moment: item,
            apiConfig,
            wechatAccountId: accountId,
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
            console.error('[UserMomentsArchive] generateMomentInteractions failed', err)
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
          const patched = await patchUserMoment(accountId, item.id, { interactions })
          if (shouldGenerateInteractions) {
            markMomentInteractionGenerationEnd(item.id, countAiEngagementDrafts(aiDrafts))
          }
          setAllMoments(filterMomentsForArchiveSubject(patched, userId))
          scheduleMomentInteractionMemoryArchive({
            moment: withInteractions,
            apiConfig,
            wechatAccountId: accountId,
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
      accountId,
      apiConfig,
      contactDirectory,
      displayAvatarUrl,
      displayNickname,
      momentContacts,
      momentRelationships,
      qnaWechatCtx,
      setAllMoments,
      settings.enableDelayedInteraction,
      tags,
      userId,
      userMomentEngagementRules,
    ],
  )

  const openPublish = profile?.isCurrentUser ? () => setPublishOpen(true) : undefined

  const { visibleItems, sentinelRef, hasMore } = useArchiveLazySlice(timelineEntries)

  const detailMoment = useMemo(
    () => (detailMomentId ? allMoments.find((m) => m.id === detailMomentId) : undefined),
    [allMoments, detailMomentId],
  )

  const nickname = coverNickname?.trim() || profile?.displayName.trim() || '未命名'
  const headerTitle = `${nickname}的朋友圈`
  const isCharacterArchive = !!profile && !profile.isCurrentUser
  const coverUrl = profile?.coverUrl ?? ''
  const avatarUrl =
    profile?.avatarUrl || resolvePublicImageUrl(DEFAULT_PUBLIC_AVATAR_PATH)

  const emptyTimeline = useMemo(
    () => !loading && timelineEntries.length === 0,
    [loading, timelineEntries],
  )

  const hasSignature = !!profile?.signature?.trim()
  const hasPinnedBar = pinnedMoments.length > 0
  /** 个签在封面下方 absolute 露出：透明占位，勿加在置顶栏灰底上 */
  const archiveSignatureSpacer = hasSignature
    ? hasPinnedBar
      ? 'pt-[5.25rem]'
      : 'pt-12'
    : ''
  /** 无个签时置顶栏与封面间距（透明） */
  const archivePinnedTopSpacer = !hasSignature && hasPinnedBar ? 'pt-5' : ''

  const subjectAuthorProps = useMemo(
    () =>
      profile?.isCurrentUser
        ? {}
        : {
            subjectCharacterId: profile?.userId,
            subjectDisplayName: profile?.displayName,
            subjectAvatarUrl: profile?.avatarUrl,
          },
    [profile?.avatarUrl, profile?.displayName, profile?.isCurrentUser, profile?.userId],
  )

  const detailInteractionProps = {
    currentUserName: displayNickname,
    currentUserAvatarUrl: displayAvatarUrl,
    momentContacts: feedMomentContacts,
    momentRelationships,
    playerIdentityId,
    replyingMomentId,
    replyingAuthorName,
    replyingTargetName: displayNickname,
    highlightCommentId,
    onOpenFloatingInput: openFloatingInput,
    onToggleLike: handleToggleLike,
    onCharacterMomentInteractionsUnlocked: handleCharacterMomentArchiveTrigger,
    onTogglePin: handleTogglePin,
    onDelete: handleDeleteMoment,
    onRevealPendingInteractions: handleRevealPendingInteractions,
    onOpenParticipantProfile,
    allowSubjectPin: false,
    pinnedTitle: profile?.isCurrentUser ? '我的置顶' : `${nickname}的置顶`,
    ...subjectAuthorProps,
  }

  const openArchiveSubjectProfile = () => {
    if (!onOpenParticipantProfile || !profile) return
    onOpenParticipantProfile(
      profilePayloadFromArchiveSubject({
        isCurrentUser: profile.isCurrentUser,
        userId: profile.userId,
        displayName: nickname,
        avatarUrl,
      }),
    )
  }

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
  }, [loading, profile])

  useEffect(() => {
    if (!isCharacterArchive || !profile?.userId?.trim()) return
    let cancelled = false
    void (async () => {
      try {
        const character = await personaDb.getCharacter(profile.userId.trim())
        if (!cancelled && character?.momentsPermission?.blocked) {
          setBlockedCharacterIds(new Set([profile.userId.trim()]))
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isCharacterArchive, profile?.userId])

  const handleHistoricalPublished = async (items: MomentItemModel[]) => {
    let next = allMoments
    for (const item of items) {
      next = await upsertUserMoment(accountId, item)
    }
    setAllMoments(next)
  }

  const headerRightSlot = isCharacterArchive ? (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={() => setHistoricalGenOpen(true)}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full focus:outline-none"
      aria-label="生成历史朋友圈"
    >
      <History className="size-4" strokeWidth={1.75} />
    </motion.button>
  ) : null

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
        <ArchiveMomentsHeader
          title={headerTitle}
          opacity={headerOpacity}
          onBack={onBack}
          rightSlot={headerRightSlot}
        />
        <div className="mx-auto max-w-[560px]">
          <div ref={coverWrapRef} className="relative">
            {profile ? (
              <MomentsCover
                coverUrl={coverUrl}
                nickname={nickname}
                avatarUrl={avatarUrl}
                signature={profile?.signature}
                onAvatarClick={onOpenParticipantProfile ? openArchiveSubjectProfile : undefined}
              />
            ) : (
              <div
                className="w-full animate-pulse bg-gray-200"
                style={{ aspectRatio: '1.08 / 1' }}
              />
            )}
          </div>

          {archiveSignatureSpacer || archivePinnedTopSpacer ? (
            <div
              aria-hidden
              className={`${archiveSignatureSpacer} ${archivePinnedTopSpacer}`.trim()}
            />
          ) : null}
          {hasPinnedBar ? (
            <section className={`mb-6 mx-5 ${MOMENT_ARCHIVE_TEXT_STRIP_CLASS} px-4 py-3.5`}>
              <button
                type="button"
                onClick={() => setPinnedListOpen(true)}
                className="flex w-full items-center gap-4 text-left transition-opacity hover:opacity-85"
                aria-label="查看置顶朋友圈"
              >
                <div className="flex w-[20%] shrink-0 items-center self-stretch">
                  <span className="text-[14px] font-semibold leading-none text-[#0A0A0A]">置顶</span>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {pinnedMoments.slice(0, 5).map((moment) => (
                    <PinnedBarPreview key={moment.id} moment={moment} />
                  ))}
                </div>
                <ChevronRight className="size-4 shrink-0 self-center text-gray-300" strokeWidth={1.5} />
              </button>
            </section>
          ) : null}

          <MomentsContentBackdrop className="-mt-px">
          <div className={`px-5 pb-[max(28px,env(safe-area-inset-bottom,0px))]`}>
          {loading ? (
            <div className="space-y-10 py-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-12 w-[20%] rounded bg-gray-100" />
                  <div className="h-20 flex-1 rounded-xl bg-gray-50" />
                </div>
              ))}
            </div>
          ) : emptyTimeline ? (
            <p className="py-16 text-center text-[13px] leading-relaxed text-gray-400">
              {profile?.isCurrentUser ? '还没有留下任何动态' : '此处尚无公开动态'}
            </p>
          ) : (
            <motion.section
              variants={listVariants}
              initial="hidden"
              animate="show"
              className="pt-4"
            >
              {visibleItems.map((entry, index) => {
                const prev = index > 0 ? visibleItems[index - 1] : null
                const showDateLabel = !prev || prev.dayKey !== entry.dayKey
                const timestamp =
                  entry.kind === 'moment' ? entry.moment.timestamp : interactionNow
                const year = getCalendarYear(timestamp)
                const prevTimestamp = prev
                  ? prev.kind === 'moment'
                    ? prev.moment.timestamp
                    : interactionNow
                  : null
                const prevYear = prevTimestamp != null ? getCalendarYear(prevTimestamp) : null
                const showYearHeader = shouldShowArchiveYearHeader(
                  year,
                  prevYear,
                  interactionNow,
                )
                return (
                  <div key={entry.id}>
                    {showYearHeader ? (
                      <p
                        className="mb-5 text-[15px] font-semibold text-[#0A0A0A]"
                        style={momentsSerifNumericStyle}
                      >
                        {year}年
                      </p>
                    ) : null}
                    <TimelineRow
                      entry={entry}
                      showDateLabel={showDateLabel}
                      onOpenMoment={(moment) => setDetailMomentId(moment.id)}
                      onOpenPublish={openPublish}
                    />
                  </div>
                )
              })}
              {hasMore ? <div ref={sentinelRef} className="h-8" aria-hidden /> : null}
            </motion.section>
          )}
          </div>
          </MomentsContentBackdrop>
        </div>
      </div>

      <AnimatePresence>
        {historicalGenOpen && profile && isCharacterArchive ? (
          <MomentHistoricalGenModal
            open={historicalGenOpen}
            onClose={() => setHistoricalGenOpen(false)}
            wechatCtx={qnaWechatCtx}
            characterId={profile.userId}
            characterName={nickname}
            momentContacts={feedMomentContacts}
            blockedCharacterIds={blockedCharacterIds}
            imageGenSettings={imageGenSettings}
            onPublished={handleHistoricalPublished}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {pinnedListOpen ? (
          <PinnedMomentsListPage
            moments={pinnedMoments}
            onBack={() => setPinnedListOpen(false)}
            onOpenMoment={(moment) => setDetailMomentId(moment.id)}
            {...detailInteractionProps}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {detailMoment ? (
          <MomentDetailPage
            item={detailMoment}
            onBack={() => setDetailMomentId(null)}
            {...detailInteractionProps}
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

      <PublishMomentPage
        open={publishOpen}
        contacts={feedMomentContacts}
        onClose={() => setPublishOpen(false)}
        onPublish={handlePublish}
      />
    </div>
  )
}
