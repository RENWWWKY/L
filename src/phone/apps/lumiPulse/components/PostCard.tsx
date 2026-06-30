import { motion } from 'framer-motion'
import { BadgeCheck, Heart, MessageCircle, Repeat2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { PULSE_CARD_SHADOW, PULSE_COLORS, PULSE_LIKE_SPRING } from '../constants'
import type { PulsePost } from '../pulseTypes'

const LINE_CLAMP = 5

function formatPulseTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - ts) / 60_000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function PostImageGrid({ urls }: { urls: string[] }) {
  const visible = urls.slice(0, 9)
  const cols = visible.length === 1 ? 1 : visible.length <= 4 ? 2 : 3

  return (
    <div
      className="mt-3 grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {visible.map((url, i) => (
        <div key={`${url}-${i}`} className="aspect-square overflow-hidden rounded-xl bg-[#F5F5F4]">
          <img src={url} alt="" className="size-full object-cover" draggable={false} />
        </div>
      ))}
    </div>
  )
}

function VerifiedBadge() {
  return (
    <BadgeCheck
      className="size-[14px] shrink-0"
      style={{ color: PULSE_COLORS.mistBlue }}
      strokeWidth={1.6}
      aria-label="认证"
    />
  )
}

export function PostCard({
  post,
  currentPovId,
  onOpen,
  onLike,
  compact = false,
}: {
  post: PulsePost
  currentPovId: string
  onOpen: () => void
  onLike: () => void
  compact?: boolean
}) {
  const liked = post.likedByPovIds.includes(currentPovId)
  const [expanded, setExpanded] = useState(false)

  const { preview, needsClamp } = useMemo(() => {
    const lines = post.content.split('\n')
    if (lines.length <= LINE_CLAMP && post.content.length < 180) {
      return { preview: post.content, needsClamp: false }
    }
    const clipped = lines.slice(0, LINE_CLAMP).join('\n')
    return { preview: clipped, needsClamp: true }
  }, [post.content])

  return (
    <motion.article
      layout
      className={`bg-white px-4 py-4 ${compact ? '' : 'mb-3'} ${PULSE_CARD_SHADOW} rounded-2xl`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <Pressable type="button" onClick={onOpen} className="block w-full text-left">
        <header className="flex items-center gap-3">
          {post.authorAvatarUrl ? (
            <img
              src={post.authorAvatarUrl}
              alt=""
              className="size-11 rounded-full object-cover ring-1 ring-black/[0.04]"
            />
          ) : (
            <div className="size-11 rounded-full bg-[#F5F5F4]" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate text-[15px] font-semibold text-[#1C1C1E]">{post.authorName}</p>
              {post.verified ? <VerifiedBadge /> : null}
            </div>
            <p className="text-[11px] text-neutral-400">{formatPulseTime(post.createdAt)}</p>
          </div>
        </header>

        <div className="mt-3">
          <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed tracking-[0.01em] text-[#1C1C1E]">
            {expanded || !needsClamp ? post.content : preview}
            {!expanded && needsClamp ? '…' : null}
          </p>
          {needsClamp && !expanded ? (
            <Pressable
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(true)
              }}
              className="mt-1 text-[13px] font-medium"
              style={{ color: PULSE_COLORS.mistBlue }}
            >
              全文
            </Pressable>
          ) : null}
        </div>

        {post.imageUrls?.length ? <PostImageGrid urls={post.imageUrls} /> : null}
      </Pressable>

      <div className="mt-4 flex items-center justify-between px-1 text-neutral-400">
        <Pressable
          type="button"
          onClick={onOpen}
          className="flex items-center gap-1.5 text-[12px] tracking-wide"
        >
          <Repeat2 className="size-[16px]" strokeWidth={1.3} />
          <span>{post.repostCount || ''}</span>
        </Pressable>
        <Pressable
          type="button"
          onClick={onOpen}
          className="flex items-center gap-1.5 text-[12px] tracking-wide"
        >
          <MessageCircle className="size-[16px]" strokeWidth={1.3} />
          <span>{post.commentCount || ''}</span>
        </Pressable>
        <Pressable type="button" onClick={onLike} className="flex items-center gap-1.5 text-[12px] tracking-wide">
          <motion.span
            key={liked ? 'on' : 'off'}
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={PULSE_LIKE_SPRING}
          >
            <Heart
              className="size-[16px]"
              strokeWidth={1.3}
              fill={liked ? PULSE_COLORS.dustyRose : 'none'}
              style={{ color: liked ? PULSE_COLORS.dustyRose : 'currentColor' }}
            />
          </motion.span>
          <span style={liked ? { color: PULSE_COLORS.dustyRose } : undefined}>{post.likeCount || ''}</span>
        </Pressable>
      </div>
    </motion.article>
  )
}
