import { ChevronLeft, Heart, MoreHorizontal } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useRef } from 'react'

import { resolveProfileAvatarPreviewUrl } from '../../phone/utils/characterAvatarUrl'

import type { InteractionNotice } from './interactionNoticeTypes'
import type { MomentsContactDirectory } from './momentsContactDirectory'
import { isMomentThumbnailImage } from './momentPostThumbnail'
import { useResolvedMomentImages } from './resolveMomentImageSrc'
import { useMomentsStore } from './useMomentsStore'
import { MomentBodyText, MomentNoticeTimeLabel } from './ArchiveTimelineDateColumn'

type InteractionHistoryPageProps = {
  contactDirectory: MomentsContactDirectory
  existingMomentIds: ReadonlySet<string>
  onBack: () => void
  onOpenSettings: () => void
  onSelectMoment: (momentId: string) => void
}

const listVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.045, delayChildren: 0.04 },
  },
}

const rowVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  },
}

function DeletedContentThumbnail() {
  return (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-gray-100 px-1.5">
      <p className="text-center text-[10px] leading-snug text-gray-400">已删除内容</p>
    </div>
  )
}

function NoticeImageThumbnail({ thumbnail }: { thumbnail: string }) {
  const resolved = useResolvedMomentImages([thumbnail])
  const displaySrc = resolved[0]?.trim() ?? ''

  if (!displaySrc) {
    return <div className="size-14 shrink-0 animate-pulse rounded-md bg-gray-100" />
  }

  return (
    <img
      src={displaySrc}
      alt=""
      className="size-14 shrink-0 rounded-md object-cover bg-gray-100"
    />
  )
}

function NoticeThumbnail({ thumbnail, deleted }: { thumbnail: string; deleted?: boolean }) {
  if (deleted) return <DeletedContentThumbnail />
  if (isMomentThumbnailImage(thumbnail)) {
    return <NoticeImageThumbnail thumbnail={thumbnail} />
  }
  return (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-gray-100 px-1.5">
      <MomentBodyText
        text={thumbnail}
        className="line-clamp-3 text-center text-[9px] leading-snug text-gray-500"
      />
    </div>
  )
}

function NoticeRow({
  notice,
  contactDirectory,
  momentDeleted,
  onSelect,
}: {
  notice: InteractionNotice
  contactDirectory: MomentsContactDirectory
  momentDeleted: boolean
  onSelect: () => void
}) {
  const actorName = contactDirectory.getDisplayName(notice.actorId)
  const avatarUrl = resolveProfileAvatarPreviewUrl(contactDirectory.getAvatar(notice.actorId))

  return (
    <motion.button
      type="button"
      variants={rowVariants}
      whileTap={{ scale: 0.995 }}
      onClick={onSelect}
      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50/80"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gray-200 text-[12px] font-medium text-gray-600">
          {actorName.slice(0, 1)}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-[#0A0A0A]">{actorName}</p>
        {notice.type === 'like' ? (
          <Heart className="mt-1 size-3.5 text-gray-500" strokeWidth={1.5} fill="none" />
        ) : notice.type === 'mention' ? (
          <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600">提到了你</p>
        ) : (
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-gray-600">
            {notice.replyToName ? (
              <>
                <span className="text-gray-400">回复</span>
                <span className="mx-1 font-semibold text-[#0A0A0A]">{notice.replyToName}</span>
                <span className="text-gray-400">:</span>
                <span className="ml-1">{notice.content?.trim() || '…'}</span>
              </>
            ) : (
              notice.content?.trim() || (notice.type === 'reply' ? '回复了你' : '评论了')
            )}
          </p>
        )}
        <MomentNoticeTimeLabel timestamp={notice.timestamp} />
      </div>

      <NoticeThumbnail thumbnail={notice.postThumbnail} deleted={momentDeleted} />
    </motion.button>
  )
}

export function InteractionHistoryPage({
  contactDirectory,
  existingMomentIds,
  onBack,
  onOpenSettings,
  onSelectMoment,
}: InteractionHistoryPageProps) {
  const notices = useMomentsStore((s) => s.notices)
  const markAllRead = useMomentsStore((s) => s.markAllRead)
  const unreadNotices = useMemo(() => notices.filter((n) => !n.isRead), [notices])
  /** 进入页时若有未读则只展示未读；退出后再次进入（已无未读）则展示全部 */
  const viewModeRef = useRef<'unread' | 'all'>(unreadNotices.length > 0 ? 'unread' : 'all')
  const visibleNotices = viewModeRef.current === 'unread' ? unreadNotices : notices
  const pageTitle = viewModeRef.current === 'unread' ? '互动消息' : '全部互动消息'

  const handleBack = () => {
    markAllRead()
    onBack()
  }

  const handleSelectMoment = (momentId: string) => {
    markAllRead()
    onSelectMoment(momentId)
  }

  return (
    <motion.div
      className="absolute inset-0 z-[440] flex flex-col bg-white"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 42 }}
    >
      <header
        className="relative flex shrink-0 items-center border-b border-gray-100 px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          aria-label="返回"
          onClick={handleBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/[0.04]"
        >
          <ChevronLeft className="size-5 text-[#111827]" strokeWidth={1.5} />
        </button>
        <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-semibold text-[#111827]">
          {pageTitle}
        </h1>
        <div className="ml-auto flex shrink-0">
          <button
            type="button"
            aria-label="消息管理"
            onClick={onOpenSettings}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-black/[0.04]"
          >
            <MoreHorizontal className="size-5 text-[#111827]" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {!visibleNotices.length ? (
          <p className="px-6 py-20 text-center text-[13px] leading-relaxed text-gray-400">
            {viewModeRef.current === 'unread' ? '暂无未读互动消息' : '暂无互动消息'}
          </p>
        ) : (
          <motion.ul
            variants={listVariants}
            initial="hidden"
            animate="show"
            className="divide-y divide-gray-100 border-b border-gray-100"
          >
            <AnimatePresence initial={false}>
              {visibleNotices.map((notice) => (
                <li key={notice.id}>
                  <NoticeRow
                    notice={notice}
                    contactDirectory={contactDirectory}
                    momentDeleted={!existingMomentIds.has(notice.momentId)}
                    onSelect={() => handleSelectMoment(notice.momentId)}
                  />
                </li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </motion.div>
  )
}
