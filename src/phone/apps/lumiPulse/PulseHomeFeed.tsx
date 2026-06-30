import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { PostCard } from './components/PostCard'
import { PULSE_COLORS } from './constants'
import { PublishEditor } from './PublishEditor'
import type { PulseHomeSegment } from './pulseTypes'
import { usePulseHomePosts } from './pulseStoreSelectors'
import { usePulseStore } from './usePulseStore'

const SEGMENTS: { id: PulseHomeSegment; label: string }[] = [
  { id: 'following', label: '关注' },
  { id: 'recommended', label: '推荐' },
]

export function PulseHomeFeed({
  currentPovId,
  authorName,
  authorAvatarUrl,
  onOpenPost,
}: {
  currentPovId: string
  authorName: string
  authorAvatarUrl?: string
  onOpenPost: (postId: string) => void
}) {
  const [segment, setSegment] = useState<PulseHomeSegment>('following')
  const [editorOpen, setEditorOpen] = useState(false)
  const posts = usePulseHomePosts(segment, currentPovId)
  const toggleLike = usePulseStore((s) => s.toggleLike)

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-[#FCFCFC]">
        <header className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1">
          <div className="flex items-center gap-6">
            {SEGMENTS.map(({ id, label }) => {
              const active = segment === id
              return (
                <Pressable key={id} type="button" onClick={() => setSegment(id)} className="relative py-2">
                  <span
                    className={`text-[16px] ${active ? 'font-semibold text-[#1C1C1E]' : 'text-neutral-400'}`}
                  >
                    {label}
                  </span>
                  {active ? (
                    <motion.span
                      layoutId="pulse-home-seg"
                      className="absolute inset-x-0 -bottom-0.5 mx-auto h-[2px] w-5 rounded-full"
                      style={{ backgroundColor: PULSE_COLORS.dustyRose }}
                    />
                  ) : null}
                </Pressable>
              )
            })}
          </div>
          <Pressable
            type="button"
            onClick={() => setEditorOpen(true)}
            className="flex size-9 items-center justify-center rounded-full bg-[#1C1C1E] text-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
            aria-label="发布"
          >
            <Plus className="size-5" strokeWidth={1.5} />
          </Pressable>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-28 pt-1">
          {posts.length ? (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentPovId={currentPovId}
                onOpen={() => onOpenPost(post.id)}
                onLike={() => toggleLike(post.id)}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
              <p className="font-serif text-[15px] text-neutral-500">
                {segment === 'following' ? '关注流尚空' : '推荐流尚空'}
              </p>
              <p className="mt-2 text-[12px] text-neutral-400">点击右上角发布，或去发现页演化热搜</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editorOpen ? (
          <PublishEditor
            authorPovId={currentPovId}
            authorName={authorName}
            authorAvatarUrl={authorAvatarUrl}
            onClose={() => setEditorOpen(false)}
            onPublished={() => setEditorOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}
