import { Heart, MessageCircle, MoreHorizontal } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'

import { MomentBodyText, MomentPublishTimeLabel } from './ArchiveTimelineDateColumn'
import { MomentInteractionArea } from './MomentInteractionArea'
import type { MomentItemModel } from './mockMoments'
import { MOMENT_BODY_COLLAPSE_CHARS } from './momentContentLimits'
import { resolveMomentAuthorDisplay } from './momentAuthorDisplay'
import { formatMomentLocationDisplay } from './momentLocationUtils'
import { momentMentionsUser } from './momentMentionUtils'
import { sanitizeMomentBodyText } from './momentTextSanitize'
import type { MomentsContactDirectory } from './momentsContactDirectory'
import { MomentVisibilityProtocolInspector } from './MomentVisibilityProtocolInspector'
import type { MomentContactRef } from './newMomentTypes'
import type { OnOpenMomentParticipantProfile } from './momentProfileNavigation'
import { profilePayloadFromMomentAuthor } from './momentProfileNavigation'
import { UserMomentEditMenu } from './UserMomentEditMenu'
import { MomentVisitorRecordButton, type MomentRevealPendingResult } from './MomentVisitorRecordButton'
import { MomentInteractionGeneratingStrip } from './MomentInteractionGeneratingStrip'
import { useMomentInteractionGenerationState } from './useMomentInteractionGenerationPending'
import { MomentImageViewer } from './MomentImageViewer'
import { useResolvedMomentImages } from './resolveMomentImageSrc'

type MomentItemProps = {
  item: MomentItemModel
  currentUserName: string
  currentUserAvatarUrl?: string
  now: number
  defaultExpanded?: boolean
  showParticipantAvatars?: boolean
  contactDirectory: MomentsContactDirectory
  momentContacts?: MomentContactRef[]
  momentRelationships?: Relationship[]
  playerIdentityId?: string | null
  isReplying?: boolean
  replyingAuthorName?: string | null
  replyingTargetName?: string | null
  highlightCommentId?: string | null
  onOpenFloatingInput?: (momentId: string, replyTo?: string) => void
  onToggleLike?: (momentId: string, liked: boolean) => void | Promise<void>
  onCharacterMomentInteractionsUnlocked?: (momentId: string) => void
  onTogglePin?: (momentId: string) => void | Promise<void>
  onDelete?: (momentId: string) => void | Promise<void>
  onRevealPendingInteractions?: (
    momentId: string,
  ) => void | Promise<void | MomentRevealPendingResult>
  /** 个人相册页：允许角色主体置顶自己的动态 */
  allowSubjectPin?: boolean
  /** 详情页：在发布日期旁显示「提到了你」 */
  showMentionLabel?: boolean
  onOpenParticipantProfile?: OnOpenMomentParticipantProfile
  /** 个人相册页：当前主体角色的最新资料（覆盖动态落库时的头像快照） */
  subjectCharacterId?: string
  subjectDisplayName?: string
  subjectAvatarUrl?: string
}

function getGridClass(imageCount: number): string {
  if (imageCount <= 1) return 'grid-cols-1'
  if (imageCount === 3) return 'grid-cols-3'
  if (imageCount <= 4) return 'grid-cols-2'
  return 'grid-cols-3'
}

export function MomentItem({
  item,
  currentUserName,
  currentUserAvatarUrl,
  now,
  defaultExpanded = false,
  showParticipantAvatars = false,
  contactDirectory,
  momentContacts = [],
  momentRelationships = [],
  playerIdentityId,
  isReplying = false,
  replyingAuthorName,
  replyingTargetName,
  highlightCommentId,
  onOpenFloatingInput,
  onToggleLike,
  onCharacterMomentInteractionsUnlocked,
  onTogglePin,
  onDelete,
  onRevealPendingInteractions,
  allowSubjectPin = false,
  showMentionLabel = false,
  onOpenParticipantProfile,
  subjectCharacterId,
  subjectDisplayName,
  subjectAvatarUrl,
}: MomentItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [liked, setLiked] = useState(() => (item.likes ?? []).includes(currentUserName))
  const [actionOpen, setActionOpen] = useState(false)
  const [likeBurst, setLikeBurst] = useState(false)
  const [imageViewerIndex, setImageViewerIndex] = useState<number | null>(null)
  const likeCloseTimerRef = useRef<number | null>(null)
  const isUserAuthored = !!item.isUserAuthored
  const generationState = useMomentInteractionGenerationState(item.id)
  const showGeneratingStrip = isUserAuthored && generationState.pending
  const showFallbackStrip =
    isUserAuthored &&
    !generationState.pending &&
    generationState.outcome === 'fallback_only' &&
    now - generationState.outcomeAt < 60_000

  const showUserEditMenu = isUserAuthored && onTogglePin && onDelete
  const showCharacterPinMenu = allowSubjectPin && !isUserAuthored && onTogglePin
  const cleanedContent = sanitizeMomentBodyText(item.content)
  const hasBodyText = cleanedContent.length > 0
  const hasLongText = cleanedContent.length > MOMENT_BODY_COLLAPSE_CHARS
  const content =
    hasLongText && !expanded
      ? `${cleanedContent.slice(0, MOMENT_BODY_COLLAPSE_CHARS)}...`
      : cleanedContent
  const images = useResolvedMomentImages(item.images)
  const locationLabel = formatMomentLocationDisplay(item.location)
  const feedComments = !isUserAuthored ? (item.comments ?? []) : undefined
  const legacyComments = isUserAuthored ? [] : []
  const userComments = isUserAuthored ? (item.comments ?? []) : []
  const legacyLikeNames = isUserAuthored ? [] : (item.likes ?? [])
  const mentionsCurrentUser = momentMentionsUser(item)
  const authorDisplay = useMemo(
    () =>
      resolveMomentAuthorDisplay(item, {
        currentUserName,
        currentUserAvatarUrl,
        contactDirectory,
        subjectCharacterId,
        subjectDisplayName,
        subjectAvatarUrl,
      }),
    [
      contactDirectory,
      currentUserAvatarUrl,
      currentUserName,
      item,
      subjectAvatarUrl,
      subjectCharacterId,
      subjectDisplayName,
    ],
  )

  useEffect(() => {
    setLiked((item.likes ?? []).includes(currentUserName))
  }, [currentUserName, item.id, item.likes])

  useEffect(() => {
    return () => {
      if (likeCloseTimerRef.current != null) {
        window.clearTimeout(likeCloseTimerRef.current)
      }
    }
  }, [])

  const openFloatingInput = (replyTo?: string) => {
    setActionOpen(false)
    onOpenFloatingInput?.(item.id, replyTo)
  }

  return (
    <article className="px-4 py-4">
      <div className="flex items-start gap-3">
        {onOpenParticipantProfile ? (
          <button
            type="button"
            onClick={() => {
              const payload = profilePayloadFromMomentAuthor({
                item,
                authorName: authorDisplay.name,
                authorAvatarUrl: authorDisplay.avatarUrl || item.authorAvatar,
              })
              if (payload) onOpenParticipantProfile(payload)
            }}
            className="mt-0.5 shrink-0 self-start rounded-xl transition-opacity hover:opacity-85 focus:outline-none"
            aria-label={`查看 ${authorDisplay.name} 资料`}
          >
            <img
              src={authorDisplay.avatarUrl || item.authorAvatar}
              alt={authorDisplay.name}
              className="h-10 w-10 rounded-xl object-cover"
            />
          </button>
        ) : (
          <img
            src={authorDisplay.avatarUrl || item.authorAvatar}
            alt={authorDisplay.name}
            className="mt-0.5 h-10 w-10 shrink-0 self-start rounded-xl object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-[15px] font-semibold text-[#111827]">{authorDisplay.name}</h3>
            {showUserEditMenu ? (
              <div className="flex shrink-0 items-center gap-0.5">
                <MomentVisitorRecordButton
                  momentId={item.id}
                  interactions={item.interactions}
                  now={now}
                  contactDirectory={contactDirectory}
                  onRevealPendingInteractions={
                    onRevealPendingInteractions
                      ? () => onRevealPendingInteractions(item.id)
                      : undefined
                  }
                />
                <UserMomentEditMenu
                  isPinned={item.isPinned}
                  onTogglePin={() => void onTogglePin(item.id)}
                  onDelete={() => void onDelete(item.id)}
                />
              </div>
            ) : showCharacterPinMenu ? (
              <UserMomentEditMenu
                isPinned={item.isPinned}
                onTogglePin={() => void onTogglePin(item.id)}
                showDelete={false}
              />
            ) : !isUserAuthored ? (
              <MomentVisibilityProtocolInspector
                privacy={item.privacy}
                contactDirectory={contactDirectory}
                momentContacts={momentContacts}
                currentUserName={currentUserName}
              />
            ) : null}
          </div>
          {hasBodyText ? (
            <MomentBodyText
              text={content}
              className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#111827]"
            />
          ) : null}
          {hasBodyText && hasLongText ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[12px] font-medium tracking-wide text-[#6B7280]"
            >
              {expanded ? '收起' : '全文'}
            </button>
          ) : null}

          {images.length ? (
            <div
              className={`mt-2 grid ${getGridClass(images.length)} gap-1.5 ${
                images.length === 1
                  ? 'max-w-[220px]'
                  : images.length === 3
                    ? 'max-w-[300px]'
                    : 'max-w-[280px]'
              }`}
            >
              {images.map((src, imageIndex) => (
                <motion.button
                  key={`${item.id}-img-${imageIndex}`}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  className="overflow-hidden rounded-lg"
                  onClick={() => setImageViewerIndex(imageIndex)}
                >
                  <img
                    src={src}
                    alt="Moment"
                    className={`w-full object-cover ${images.length === 1 ? 'aspect-[2/3]' : 'aspect-square'}`}
                  />
                </motion.button>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <MomentPublishTimeLabel timestamp={item.timestamp} nowMs={now} />
                {showMentionLabel && mentionsCurrentUser ? (
                  <span className="text-[12px] font-medium text-[#576B95]">提到了你</span>
                ) : null}
              </div>
              {locationLabel ? (
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#64748B]">
                  {locationLabel}
                </p>
              ) : null}
            </div>
            <div className="relative ml-auto shrink-0">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setActionOpen((v) => !v)}
                className="rounded-md border border-black/10 bg-white px-2 py-1 text-[#6B7280]"
              >
                <MoreHorizontal className="size-4" />
              </motion.button>
              <AnimatePresence>
                {actionOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    className="absolute right-0 top-9 z-10 flex overflow-hidden rounded-lg border border-black/10 bg-white shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
                  >
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        const nextLiked = !liked
                        setLiked(nextLiked)
                        void onToggleLike?.(item.id, nextLiked)
                        if (!nextLiked) {
                          setActionOpen(false)
                          return
                        }
                        if (likeCloseTimerRef.current != null) {
                          window.clearTimeout(likeCloseTimerRef.current)
                        }
                        setLikeBurst(true)
                        likeCloseTimerRef.current = window.setTimeout(() => {
                          setLikeBurst(false)
                          setActionOpen(false)
                          likeCloseTimerRef.current = null
                        }, 420)
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-[11px] tracking-[0.08em] text-[#111827]"
                    >
                      <motion.span
                        animate={liked ? { scale: [1, 1.22, 1] } : { scale: 1 }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                      >
                        <Heart className={`size-3.5 ${liked ? 'fill-[#111827]' : ''}`} />
                      </motion.span>
                      LIKE
                    </motion.button>
                    <AnimatePresence>
                      {likeBurst ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="pointer-events-none absolute inset-0"
                        >
                          {Array.from({ length: 8 }).map((_, i) => {
                            const angle = (i / 8) * Math.PI * 2
                            const x = Math.cos(angle) * 28
                            const y = Math.sin(angle) * 18
                            return (
                              <motion.span
                                key={i}
                                className="absolute right-[86px] top-[18px] h-1.5 w-1.5 rounded-full bg-[#111827]/60"
                                initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
                                animate={{ x, y, opacity: 0, scale: 0.35 }}
                                transition={{ duration: 0.36, ease: 'easeOut' }}
                              />
                            )
                          })}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                    <div className="w-px bg-black/10" />
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => openFloatingInput()}
                      className="flex items-center gap-1.5 px-3 py-2 text-[11px] tracking-[0.08em] text-[#111827]"
                    >
                      <MessageCircle className="size-3.5" />
                      COMMENT
                    </motion.button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {showGeneratingStrip ? (
            <MomentInteractionGeneratingStrip className="mt-2" mode="generating" />
          ) : showFallbackStrip ? (
            <MomentInteractionGeneratingStrip className="mt-2" mode="fallback_only" />
          ) : null}

          <MomentInteractionArea
            momentId={item.id}
            now={now}
            legacyLikeNames={legacyLikeNames}
            userLikeName={liked ? currentUserName : null}
            feedComments={feedComments}
            legacyComments={legacyComments}
            userComments={userComments}
            interactions={item.interactions}
            contactDirectory={contactDirectory}
            momentContacts={momentContacts}
            momentRelationships={momentRelationships}
            playerIdentityId={playerIdentityId}
            publisherCharacterId={item.authorCharacterId}
            replyingAuthorName={isReplying ? replyingAuthorName : null}
            replyingTargetName={isReplying ? replyingTargetName : null}
            highlightCommentId={highlightCommentId}
            currentUserName={currentUserName}
            currentUserAvatarUrl={currentUserAvatarUrl}
            showParticipantAvatars={showParticipantAvatars}
            onOpenParticipantProfile={onOpenParticipantProfile}
            onReply={(targetName) => openFloatingInput(targetName)}
            onInteractionsUnlocked={onCharacterMomentInteractionsUnlocked}
          />
        </div>
      </div>

      <MomentImageViewer
        open={imageViewerIndex !== null}
        images={images}
        initialIndex={imageViewerIndex ?? 0}
        allowSave={!isUserAuthored}
        onClose={() => setImageViewerIndex(null)}
      />
    </article>
  )
}
