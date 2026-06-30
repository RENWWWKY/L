import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, Pencil, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { PostCard } from './components/PostCard'
import { PULSE_COLORS, PULSE_SHEET_SPRING } from './constants'
import { PublishEditor } from './PublishEditor'
import type { PulsePovOption, PulseProfileSegment, PulseProfileStats } from './pulseTypes'
import { formatPulseCount } from './pulseTypes'
import {
  usePulseLikedPosts,
  usePulseMediaPosts,
  usePulsePostsByAuthor,
} from './pulseStoreSelectors'
import { usePulseStore } from './usePulseStore'

const PROFILE_TABS: { id: PulseProfileSegment; label: string }[] = [
  { id: 'posts', label: '动态' },
  { id: 'media', label: '媒体' },
  { id: 'liked', label: '赞过' },
]

function PovSwitcherSheet({
  options,
  currentPovId,
  onSelect,
  onClose,
}: {
  options: PulsePovOption[]
  currentPovId: string
  onSelect: (id: string) => void
  onClose: () => void
}) {
  return (
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[1300] bg-black/15 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-label="关闭"
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-[1310] rounded-t-[24px] bg-white/95 px-5 pb-8 pt-4 backdrop-blur-2xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={PULSE_SHEET_SPRING}
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/10" />
        <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-400">POV Switch</p>
        <h3 className="mt-1 font-serif text-[18px] text-[#1C1C1E]">切换登录身份</h3>
        <div className="mt-5 space-y-2">
          {options.map((opt) => (
            <Pressable
              key={opt.povId}
              type="button"
              onClick={() => {
                onSelect(opt.povId)
                onClose()
              }}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 ${
                opt.povId === currentPovId ? 'bg-[#FCFCFC] shadow-[0_2px_15px_rgba(0,0,0,0.03)]' : ''
              }`}
            >
              {opt.avatarUrl ? (
                <img src={opt.avatarUrl} alt="" className="size-11 rounded-full object-cover" />
              ) : (
                <div className="size-11 rounded-full bg-[#F5F5F4]" />
              )}
              <span className="text-[14px] font-medium text-[#1C1C1E]">{opt.label}</span>
              {opt.povId === currentPovId ? (
                <span className="ml-auto text-[10px] tracking-wide" style={{ color: PULSE_COLORS.dustyRose }}>
                  当前
                </span>
              ) : null}
            </Pressable>
          ))}
        </div>
      </motion.div>
    </>
  )
}

export function PulseProfile({
  displayName,
  avatarUrl,
  stats,
  currentPovId,
  povOptions,
  onSwitchPov,
  onOpenPost,
}: {
  displayName: string
  avatarUrl?: string
  stats: PulseProfileStats
  currentPovId: string
  povOptions: PulsePovOption[]
  onSwitchPov: (povId: string) => void
  onOpenPost: (postId: string) => void
}) {
  const [tab, setTab] = useState<PulseProfileSegment>('posts')
  const [editorOpen, setEditorOpen] = useState(false)
  const [povOpen, setPovOpen] = useState(false)
  const toggleLike = usePulseStore((s) => s.toggleLike)

  const myPosts = usePulsePostsByAuthor(currentPovId)
  const mediaPosts = usePulseMediaPosts(currentPovId)
  const likedPosts = usePulseLikedPosts(currentPovId)

  const likesReceived = useMemo(
    () => myPosts.reduce((sum, p) => sum + p.likeCount, 0) + stats.likesReceived,
    [myPosts, stats.likesReceived],
  )

  const listPosts = tab === 'posts' ? myPosts : tab === 'media' ? mediaPosts : likedPosts

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-[#FCFCFC]">
        <div className="min-h-0 flex-1 overflow-y-auto pb-28">
          <div className="relative h-48 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${PULSE_COLORS.mistBlue}33 0%, ${PULSE_COLORS.dustyRose}22 50%, ${PULSE_COLORS.lightGold}18 100%)`,
              }}
            />
            <Pressable
              type="button"
              onClick={() => setPovOpen(true)}
              className="absolute right-4 top-4 rounded-full bg-white/80 px-3 py-1.5 text-[11px] tracking-wide text-[#1C1C1E] shadow-[0_2px_15px_rgba(0,0,0,0.06)] backdrop-blur-md"
              style={{ boxShadow: `0 0 24px ${PULSE_COLORS.lightGold}33` }}
            >
              <span className="flex items-center gap-1">
                <Sparkles className="size-3" strokeWidth={1.4} style={{ color: PULSE_COLORS.lightGold }} />
                切换登录身份
              </span>
            </Pressable>
          </div>

          <div className="relative px-4">
            <div className="-mt-12 flex items-end gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="size-[88px] rounded-full border-4 border-white object-cover shadow-[0_2px_15px_rgba(0,0,0,0.06)]"
                />
              ) : (
                <div className="size-[88px] rounded-full border-4 border-white bg-[#F5F5F4] shadow-[0_2px_15px_rgba(0,0,0,0.06)]" />
              )}
            </div>

            <div className="mt-3 flex items-center gap-1">
              <h1 className="text-[20px] font-semibold text-[#1C1C1E]">{displayName}</h1>
              <BadgeCheck className="size-4" style={{ color: PULSE_COLORS.mistBlue }} strokeWidth={1.5} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-neutral-600">
              <span>
                关注 <strong className="font-mono font-semibold text-[#1C1C1E]">{stats.following}</strong>
              </span>
              <span className="text-neutral-300">|</span>
              <span>
                粉丝{' '}
                <strong className="font-mono font-semibold text-[#1C1C1E]">
                  {formatPulseCount(stats.followers || myPosts.length * 12)}
                </strong>
              </span>
              <span className="text-neutral-300">|</span>
              <span>
                获赞与收藏{' '}
                <strong className="font-mono font-semibold text-[#1C1C1E]">
                  {formatPulseCount(likesReceived)}
                </strong>
              </span>
            </div>

            <div className="mt-3 flex items-start gap-2">
              <p className="flex-1 font-serif text-[13px] italic leading-relaxed text-neutral-400">
                在脉冲里，每一句话都是一次呼吸。
              </p>
              <Pencil className="mt-0.5 size-3.5 shrink-0 text-neutral-300" strokeWidth={1.3} />
            </div>

            <div className="mt-5 flex border-b border-black/[0.04]">
              {PROFILE_TABS.map(({ id, label }) => {
                const active = tab === id
                return (
                  <Pressable
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className="relative flex-1 py-3 text-center"
                  >
                    <span className={`text-[14px] ${active ? 'font-semibold text-[#1C1C1E]' : 'text-neutral-400'}`}>
                      {label}
                    </span>
                    {active ? (
                      <motion.span
                        layoutId="pulse-profile-tab"
                        className="absolute inset-x-4 bottom-0 h-[2px] rounded-full"
                        style={{ backgroundColor: PULSE_COLORS.dustyRose }}
                      />
                    ) : null}
                  </Pressable>
                )
              })}
            </div>

            <div className="mt-4 space-y-3 pb-4">
              {listPosts.length ? (
                listPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentPovId={currentPovId}
                    onOpen={() => onOpenPost(post.id)}
                    onLike={() => toggleLike(post.id)}
                    compact
                  />
                ))
              ) : (
                <p className="py-12 text-center text-[13px] text-neutral-400">
                  {tab === 'liked' ? '还没有赞过的动态' : '暂无内容'}
                </p>
              )}
            </div>
          </div>
        </div>

        <Pressable
          type="button"
          onClick={() => setEditorOpen(true)}
          className="fixed bottom-24 right-4 z-20 rounded-full bg-[#1C1C1E] px-4 py-3 text-[11px] tracking-[0.08em] text-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          + 写微博
        </Pressable>
      </div>

      <AnimatePresence>
        {editorOpen ? (
          <PublishEditor
            authorPovId={currentPovId}
            authorName={displayName}
            authorAvatarUrl={avatarUrl}
            onClose={() => setEditorOpen(false)}
            onPublished={() => setEditorOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {povOpen ? (
          <PovSwitcherSheet
            options={povOptions}
            currentPovId={currentPovId}
            onSelect={onSwitchPov}
            onClose={() => setPovOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}
