import { ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMemo } from 'react'

import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'

import { ArchiveTimelineDateColumn, MomentBodyText } from './ArchiveTimelineDateColumn'
import { getCalendarYear, shouldShowArchiveYearHeader } from './utils/archiveTimelineDate'
import type { MomentItemModel } from './mockMoments'
import { ArchiveTextOnlyMomentStrip, MomentArchiveThumbnail } from './MomentArchiveThumbnail'
import { MomentsContentBackdrop, MomentsContentBackgroundLayer } from './MomentsContentBackdrop'
import { formatMomentLocationDisplay } from './momentLocationUtils'
import { sanitizeMomentBodyText } from './momentTextSanitize'
import type { MomentContactRef } from './newMomentTypes'

type PinnedMomentsListPageProps = {
  moments: MomentItemModel[]
  onBack: () => void
  onOpenMoment: (moment: MomentItemModel) => void
  currentUserName?: string
  currentUserAvatarUrl?: string
  momentContacts?: MomentContactRef[]
  momentRelationships?: Relationship[]
  playerIdentityId?: string | null
  replyingMomentId?: string | null
  replyingAuthorName?: string | null
  replyingTargetName?: string | null
  highlightCommentId?: string | null
  onOpenFloatingInput?: (momentId: string, replyTo?: string) => void
  onToggleLike?: (momentId: string, liked: boolean) => void | Promise<void>
  onCharacterMomentInteractionsUnlocked?: (momentId: string) => void
  onTogglePin?: (momentId: string) => void | Promise<void>
  onDelete?: (momentId: string) => void | Promise<void>
  subjectCharacterId?: string
  subjectDisplayName?: string
  subjectAvatarUrl?: string
  pinnedTitle?: string
}

function PinnedListMomentRow({
  moment,
  showDateLabel,
  onOpen,
}: {
  moment: MomentItemModel
  showDateLabel: boolean
  onOpen: () => void
}) {
  const content = sanitizeMomentBodyText(moment.content)
  const images = moment.images ?? []
  const hasImages = images.length > 0
  const hasText = content.length > 0
  const locationLabel = formatMomentLocationDisplay(moment.location)

  return (
    <article className="flex items-start gap-3 pb-5">
      <div className="w-[20%] shrink-0 self-start pt-0.5">
        <ArchiveTimelineDateColumn
          timestamp={moment.timestamp}
          locationLabel={locationLabel}
          showDateLabel={showDateLabel}
        />
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 self-start text-left transition-opacity hover:opacity-85"
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
    </article>
  )
}

export function PinnedMomentsListPage({
  moments,
  onBack,
  onOpenMoment,
  pinnedTitle = '我的置顶',
}: PinnedMomentsListPageProps) {
  const rows = useMemo(
    () =>
      [...moments].sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id)),
    [moments],
  )

  return (
    <motion.div
      className="absolute inset-0 z-[430] flex flex-col bg-transparent"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 42 }}
    >
      <header
        className="relative flex shrink-0 items-center border-b border-gray-100 bg-white/90 px-3 pb-3 backdrop-blur-md"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/[0.04]"
        >
          <ChevronLeft className="size-5 text-[#111827]" strokeWidth={1.5} />
        </button>
        <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-semibold text-[#111827]">
          {pinnedTitle}
        </h1>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <MomentsContentBackgroundLayer />
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <MomentsContentBackdrop className="min-h-full">
          <div className="px-5 pb-[max(28px,env(safe-area-inset-bottom,0px))] pt-4">
        {!rows.length ? (
          <p className="py-16 text-center text-[13px] text-gray-400">暂无置顶动态</p>
        ) : (
          rows.map((moment, index) => {
            const prev = index > 0 ? rows[index - 1] : null
            const year = getCalendarYear(moment.timestamp)
            const prevYear = prev ? getCalendarYear(prev.timestamp) : null
            const showYearHeader = shouldShowArchiveYearHeader(year, prevYear)
            const showDateLabel =
              !prev ||
              new Date(prev.timestamp).toDateString() !== new Date(moment.timestamp).toDateString()

            return (
              <div key={moment.id}>
                {showYearHeader ? (
                  <p className="mb-5 text-[15px] font-semibold text-[#0A0A0A]">{year}年</p>
                ) : null}
                <PinnedListMomentRow
                  moment={moment}
                  showDateLabel={showDateLabel}
                  onOpen={() => onOpenMoment(moment)}
                />
              </div>
            )
          })
        )}
          </div>
        </MomentsContentBackdrop>
        </div>
      </div>
    </motion.div>
  )
}
