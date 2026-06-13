import { ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'

import type { MomentsContactDirectory } from './momentsContactDirectory'
import { MomentsSerifNumericValue } from './ArchiveTimelineDateColumn'
import { useMomentsStore } from './useMomentsStore'
import { resolveProfileAvatarPreviewUrl } from '../../phone/utils/characterAvatarUrl'

type MomentNoticeBadgeProps = {
  contactDirectory: MomentsContactDirectory
  onOpenHistory: () => void
}

export function MomentNoticeBadge({ contactDirectory, onOpenHistory }: MomentNoticeBadgeProps) {
  const unreadCount = useMomentsStore((s) => s.notices.filter((n) => !n.isRead).length)
  const latestUnread = useMomentsStore((s) => s.notices.find((n) => !n.isRead) ?? null)
  if (unreadCount <= 0 || !latestUnread) return null

  const actorName = contactDirectory.getDisplayName(latestUnread.actorId) || '好友'
  const avatarUrl = resolveProfileAvatarPreviewUrl(
    contactDirectory.getAvatar(latestUnread.actorId),
  )
  const label =
    unreadCount > 1
      ? `${actorName} 等 `
      : actorName

  return (
    <div className="pointer-events-none absolute inset-x-0 top-full z-20 flex items-center justify-center px-5 pt-9">
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        whileTap={{ scale: 0.985 }}
        onClick={onOpenHistory}
        aria-label={`${unreadCount} 条未读互动消息`}
        className="pointer-events-auto inline-flex max-w-[min(100%,320px)] items-center gap-2.5 rounded-full border border-white/70 bg-white/82 py-1.5 pl-1.5 pr-3 shadow-[0_6px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="size-8 shrink-0 rounded-full object-cover ring-1 ring-black/[0.06]"
          />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[11px] font-medium text-[#6B7280] ring-1 ring-black/[0.06]">
            {actorName.slice(0, 1)}
          </span>
        )}
        <span className="min-w-0 truncate text-[13px] leading-snug text-[#374151]">
          <span className="font-medium text-[#111827]">{label}</span>
          {unreadCount > 1 ? (
            <>
              <MomentsSerifNumericValue value={unreadCount} className="font-semibold tabular-nums text-[#111827]" />
              <span className="font-normal text-[#6B7280]"> 条互动</span>
            </>
          ) : (
            <span className="font-normal text-[#6B7280]"> 有新的互动</span>
          )}
        </span>
        <ChevronRight className="size-3.5 shrink-0 text-[#C4C4C4]" strokeWidth={1.75} aria-hidden />
      </motion.button>
    </div>
  )
}
