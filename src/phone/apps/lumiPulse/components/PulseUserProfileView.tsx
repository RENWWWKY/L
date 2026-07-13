import { motion } from 'framer-motion'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'

import { Pressable } from '../../../components/Pressable'
import { PostCard } from './PostCard'
import { PulseNum } from './PulseNum'
import { PULSE_COLORS, PULSE_DEFAULT_COVER, PULSE_MODAL_SPRING } from '../constants'
import { resolvePulseAuthorAvatarUrl } from '../pulseNetizenAvatar'
import type { PulseFollowingUser } from '../pulseTypes'
import { usePulsePostsByAuthor } from '../pulseStoreSelectors'
import { usePulseStore } from '../usePulseStore'

/** 他人微博主页 — 从关注列表头像进入 */
export function PulseUserProfileView({
  user,
  currentPlayerPovId,
  onBack,
  onOpenPost,
  onRepostPost,
}: {
  user: PulseFollowingUser
  currentPlayerPovId: string
  onBack: () => void
  onOpenPost: (postId: string) => void
  onRepostPost: (postId: string) => void
}) {
  const toggleLike = usePulseStore((s) => s.toggleLike)
  const posts = usePulsePostsByAuthor(user.povId)
  const avatarSrc = resolvePulseAuthorAvatarUrl(user.avatarUrl)

  const likesTotal = useMemo(() => posts.reduce((sum, p) => sum + p.likeCount, 0), [posts])

  return (
    <motion.div
      className="fixed inset-0 z-[1260] flex flex-col bg-[#FCFCFC]"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={PULSE_MODAL_SPRING}
    >
      <header
        className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3 py-3"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable
          type="button"
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-full bg-white/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] backdrop-blur-md"
        >
          <ArrowLeft className="size-5" strokeWidth={1.3} />
        </Pressable>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="relative h-40 overflow-hidden">
          <img src={PULSE_DEFAULT_COVER} alt="" className="size-full object-cover" draggable={false} />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: `linear-gradient(180deg, transparent 40%, ${PULSE_COLORS.bg} 100%)` }}
          />
        </div>

        <div className="relative px-4">
          <div className="-mt-10">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
                className="size-20 rounded-full border-4 border-white object-cover shadow-[0_2px_15px_rgba(0,0,0,0.06)]"
              />
            ) : (
              <div className="size-20 rounded-full border-4 border-white bg-[#F5F5F4] shadow-[0_2px_15px_rgba(0,0,0,0.06)]" />
            )}
          </div>

          <div className="mt-2 flex items-center gap-1">
            <h1 className="text-[18px] font-semibold text-[#1C1C1E]">{user.name}</h1>
            {user.verified ? (
              <ShieldCheck className="size-4" style={{ color: PULSE_COLORS.lightGold }} strokeWidth={1.5} />
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 text-[13px] text-neutral-600">
            <span>
              微博{' '}
              <strong className="font-semibold text-[#1C1C1E]">
                <PulseNum>{posts.length}</PulseNum>
              </strong>
            </span>
            <span className="text-neutral-300">|</span>
            <span>
              获赞{' '}
              <strong className="font-semibold text-[#1C1C1E]">
                <PulseNum>{likesTotal}</PulseNum>
              </strong>
            </span>
          </div>

          <p className="mt-3 font-serif text-[13px] italic leading-relaxed text-neutral-400">
            {user.bio?.trim() || '这位用户还没有留下简介。'}
          </p>

          <div className="mt-5 border-b border-black/[0.04] pb-2">
            <span className="text-[14px] font-semibold text-[#1C1C1E]">动态</span>
          </div>

          <div className="mt-3 space-y-3 pb-4">
            {posts.length ? (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentPovId={currentPlayerPovId}
                  onOpen={() => onOpenPost(post.id)}
                  onLike={() => toggleLike(post.id)}
                  onRepost={() => onRepostPost(post.id)}
                  compact
                />
              ))
            ) : (
              <p className="py-12 text-center text-[13px] text-neutral-400">TA 还没有发布动态</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
