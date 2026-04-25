import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { Question } from './types'

type QnAFeedPageProps = {
  questions: Question[]
  onOpenPost: (id: string) => void
}

export function QnAFeedPage({ questions, onOpenPost }: QnAFeedPageProps) {
  const publicOnly = questions.filter((q) => q.visibility === 'public')
  const [visibleCount, setVisibleCount] = useState(10)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const hasMore = visibleCount < publicOnly.length
  const visibleList = useMemo(() => publicOnly.slice(0, visibleCount), [publicOnly, visibleCount])

  useEffect(() => {
    setVisibleCount(10)
  }, [questions.length])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 10, publicOnly.length))
        }
      },
      { rootMargin: '180px 0px 220px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [publicOnly.length])

  const fmtTime = (ts: number) => {
    const diff = Date.now() - ts
    const m = 60 * 1000
    const h = 60 * m
    const d = 24 * h
    if (diff < m) return '刚刚'
    if (diff < h) return `${Math.max(1, Math.floor(diff / m))}分钟前`
    if (diff < d) return `${Math.max(1, Math.floor(diff / h))}小时前`
    return `${Math.max(1, Math.floor(diff / d))}天前`
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto max-w-[560px]">
        <div className="mb-4 flex items-end justify-between">
          <p className="text-[10px] tracking-[0.28em] text-[#9CA3AF]">FEED</p>
          <p className="text-[11px] text-[#9CA3AF]">{publicOnly.length} questions</p>
        </div>
        <div className="space-y-4">
          {visibleList.map((q, idx) => (
            <motion.button
              key={q.id}
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(0.06 * idx, 0.24) }}
              whileTap={{ scale: 0.985 }}
              onClick={() => onOpenPost(q.id)}
              className="w-full rounded-2xl border border-black/8 bg-white/32 p-4 text-left shadow-[0_3px_20px_rgba(0,0,0,0.03)] backdrop-blur-[3px]"
            >
              {q.isContact ? (
                <div className="mb-2 inline-flex items-center rounded-full bg-[#111827] px-2.5 py-0.5 text-[10px] text-white">
                  👤 通讯录好友
                </div>
              ) : null}
              <p className="text-[17px] leading-relaxed text-[#111827]">{q.body}</p>
              <p className="mt-2 text-[11px] text-[#9CA3AF]">{fmtTime(q.createdAt)}</p>
              <div className="my-3 h-px bg-gradient-to-r from-transparent via-black/12 to-transparent" />
              {q.topAnswerSnippet ? (
                <div className="flex gap-2.5">
                  <div className="mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#F3F4F6]">
                    {q.topAnswerSnippet.isAnonymous ? (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-[#9CA3AF]">
                        ?
                      </div>
                    ) : q.topAnswerSnippet.avatarUrl ? (
                      <img
                        src={q.topAnswerSnippet.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-[#9CA3AF]">
                        ·
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-[#9CA3AF]">
                      <span className="font-medium text-[#6B7280]">{q.topAnswerSnippet.authorName}</span>
                      <span className="mx-1">·</span>
                      <span>TOP {q.topAnswerSnippet.likeCount}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-[#374151]">
                      {q.topAnswerSnippet.text}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-[#9CA3AF]">暂无回答 · 成为第一个声音</p>
              )}
            </motion.button>
          ))}
        </div>
        <div ref={sentinelRef} className="h-8" />
        {hasMore ? (
          <p className="py-2 text-center text-[11px] text-[#9CA3AF]">加载更多中...</p>
        ) : (
          <p className="py-2 text-center text-[11px] text-[#9CA3AF]">已加载全部内容</p>
        )}
      </div>
    </div>
  )
}
