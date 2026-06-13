import { useMemo } from 'react'
import { motion } from 'framer-motion'

import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'

import { MomentItem } from './MomentItem'
import type { MomentRevealPendingResult } from './MomentVisitorRecordButton'
import type { MomentItemModel } from './mockMoments'
import { buildMomentsContactDirectory } from './momentsContactDirectory'
import type { MomentContactRef } from './newMomentTypes'
import type { OnOpenMomentParticipantProfile } from './momentProfileNavigation'
import { useMomentInteractionClock } from './useMomentInteractionClock'

type MomentsFeedProps = {
  moments: MomentItemModel[]
  currentUserName: string
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
  onRevealPendingInteractions?: (
    momentId: string,
  ) => void | Promise<void | MomentRevealPendingResult>
  onOpenParticipantProfile?: OnOpenMomentParticipantProfile
}

export function MomentsFeed({
  moments,
  currentUserName,
  currentUserAvatarUrl,
  momentContacts = [],
  momentRelationships = [],
  playerIdentityId,
  replyingMomentId,
  replyingAuthorName,
  replyingTargetName,
  highlightCommentId,
  onOpenFloatingInput,
  onToggleLike,
  onCharacterMomentInteractionsUnlocked,
  onTogglePin,
  onDelete,
  onRevealPendingInteractions,
  onOpenParticipantProfile,
}: MomentsFeedProps) {
  const now = useMomentInteractionClock(5000)
  const contactDirectory = useMemo(
    () => buildMomentsContactDirectory(momentContacts),
    [momentContacts],
  )

  return (
    <section className="mt-22 pt-4 divide-y divide-black/5">
      {!moments.length ? (
        <p className="px-6 py-16 text-center text-[13px] leading-relaxed text-[#9CA3AF]">
          暂无动态，点击右上角相机发布第一条朋友圈
        </p>
      ) : null}
      {moments.map((item, idx) => (
        <motion.div
          key={item.id}
          data-moment-id={item.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: Math.min(0.05 * idx, 0.2) }}
        >
          <MomentItem
            item={item}
            currentUserName={currentUserName}
            currentUserAvatarUrl={currentUserAvatarUrl}
            now={now}
            contactDirectory={contactDirectory}
            momentContacts={momentContacts}
            momentRelationships={momentRelationships}
            playerIdentityId={playerIdentityId}
            isReplying={replyingMomentId === item.id}
            replyingAuthorName={replyingAuthorName}
            replyingTargetName={replyingTargetName}
            highlightCommentId={highlightCommentId}
            onOpenFloatingInput={onOpenFloatingInput}
            onToggleLike={onToggleLike}
            onCharacterMomentInteractionsUnlocked={onCharacterMomentInteractionsUnlocked}
            onTogglePin={onTogglePin}
            onDelete={onDelete}
            onRevealPendingInteractions={onRevealPendingInteractions}
            onOpenParticipantProfile={onOpenParticipantProfile}
          />
        </motion.div>
      ))}
    </section>
  )
}
