import { Heart, MessageCircle, MoreHorizontal, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

import { InteractionPanel } from './InteractionPanel'
import type { MomentItemModel } from './mockMoments'
import { formatMomentTime } from './utils/timeFormat'

type MomentItemProps = {
  item: MomentItemModel
  currentUserName: string
}

function formatLocation(location?: string): string {
  if (!location) return ''
  return location
    .split(/[·,，/]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .join('·')
}

function getGridClass(imageCount: number): string {
  if (imageCount <= 1) return 'grid-cols-1'
  if (imageCount <= 4) return 'grid-cols-2'
  return 'grid-cols-3'
}

export function MomentItem({ item, currentUserName }: MomentItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [liked, setLiked] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)
  const [replyHint, setReplyHint] = useState<string | null>(null)
  const [likeBurst, setLikeBurst] = useState(false)
  const likeCloseTimerRef = useRef<number | null>(null)
  const hasLongText = item.content.length > 120
  const content = hasLongText && !expanded ? `${item.content.slice(0, 120)}...` : item.content
  const images = (item.images ?? []).slice(0, 9)
  const locationLabel = formatLocation(item.location)
  const likeUsers = useMemo(
    () => (liked ? [currentUserName, ...(item.likes ?? [])] : item.likes ?? []),
    [currentUserName, item.likes, liked],
  )
  const timeLabel = formatMomentTime(item.timestamp)

  useEffect(() => {
    return () => {
      if (likeCloseTimerRef.current != null) {
        window.clearTimeout(likeCloseTimerRef.current)
      }
    }
  }, [])

  return (
    <article className="px-4 py-4">
      <div className="flex gap-3">
        <img src={item.authorAvatar} alt={item.authorName} className="mt-0.5 h-10 w-10 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-[#111827]">{item.authorName}</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#111827]">{content}</p>
          {hasLongText ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[12px] font-medium tracking-wide text-[#6B7280]"
            >
              {expanded ? '收起' : '全文'}
            </button>
          ) : null}

          {images.length ? (
            <div className={`mt-2 grid ${getGridClass(images.length)} gap-1.5 ${images.length === 1 ? 'max-w-[220px]' : 'max-w-[280px]'}`}>
              {images.map((src) => (
                <motion.button
                  key={src}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  className="overflow-hidden rounded-lg"
                  onClick={() => window.alert('Image preview mock')}
                >
                  <img
                    src={src}
                    alt="Moment"
                    className={`w-full object-cover ${images.length === 1 ? 'h-[150px]' : 'aspect-square'}`}
                  />
                </motion.button>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex items-center gap-2">
            {locationLabel ? <span className="text-[12px] text-[#64748B]">{locationLabel}</span> : null}
            <span className="text-[12px] text-[#9CA3AF]">{timeLabel}</span>
            <div className="relative ml-auto">
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
                      onClick={() => {
                        setReplyHint(`回复 ${item.authorName}`)
                        setActionOpen(false)
                      }}
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

          <InteractionPanel
            likes={likeUsers}
            comments={item.comments}
            onReplyMock={(comment) => setReplyHint(`回复 ${comment.author}`)}
          />
          <AnimatePresence>
            {replyHint ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="mt-2 flex items-center gap-2 rounded-lg border border-black/10 bg-white px-2 py-1.5"
              >
                <span className="text-[11px] tracking-[0.08em] text-[#6B7280]">{replyHint}</span>
                <input
                  placeholder="Write a reply..."
                  className="h-7 min-w-0 flex-1 bg-transparent text-[12px] text-[#111827] outline-none placeholder:text-[#9CA3AF]"
                />
                <button type="button" onClick={() => setReplyHint(null)} className="text-[#9CA3AF]">
                  <X className="size-3.5" />
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </article>
  )
}
