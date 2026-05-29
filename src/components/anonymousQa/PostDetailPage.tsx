import { ChevronDown, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'

import type { QnAAnswer, Question } from './types'

type PostDetailPageProps = {
  question: Question | null
  onBack: () => void
  onSubmitComment?: (text: string) => void
  aiReplying?: boolean
}

function formatFullDateTime(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}年${m}月${day}日 ${hh}:${mm}`
}

function formatTimeTag(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function PostDetailPage({ question, onBack, onSubmitComment, aiReplying = false }: PostDetailPageProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [commentInput, setCommentInput] = useState('')
  const [votes, setVotes] = useState<
    Record<
      string,
      {
        like: number
        dislike: number
        vote: 'like' | 'dislike' | null
        likeBurst?: boolean
        dislikeBurst?: boolean
      }
    >
  >({})

  const merged = useMemo(() => {
    if (!question) return []
    return question.answers.map((a) => {
      const v = votes[a.id]
      return {
        ...a,
        likeCount: v?.like ?? a.likeCount,
        dislikeCount: v?.dislike ?? a.dislikeCount,
        likeBurst: v?.likeBurst,
        dislikeBurst: v?.dislikeBurst,
        vote: v?.vote ?? null,
      }
    })
  }, [question, votes])

  if (!question) return null

  const toggleExpand = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }))

  const onLike = (a: QnAAnswer) => {
    if (votes[a.id]?.vote) return
    setVotes((prev) => ({
      ...prev,
      [a.id]: {
        like: (prev[a.id]?.like ?? a.likeCount) + 1,
        dislike: prev[a.id]?.dislike ?? a.dislikeCount,
        vote: 'like',
        likeBurst: true,
        dislikeBurst: false,
      },
    }))
    window.setTimeout(() => {
      setVotes((p) => ({ ...p, [a.id]: { ...p[a.id]!, likeBurst: false } }))
    }, 380)
  }

  const onDislike = (a: QnAAnswer) => {
    if (votes[a.id]?.vote) return
    setVotes((prev) => ({
      ...prev,
      [a.id]: {
        like: prev[a.id]?.like ?? a.likeCount,
        dislike: (prev[a.id]?.dislike ?? a.dislikeCount) + 1,
        vote: 'dislike',
        dislikeBurst: true,
        likeBurst: false,
      },
    }))
    window.setTimeout(() => {
      setVotes((p) => ({ ...p, [a.id]: { ...p[a.id]!, dislikeBurst: false } }))
    }, 380)
  }

  const submitComment = () => {
    const text = commentInput.trim()
    if (!text) return
    onSubmitComment?.(text)
    setCommentInput('')
  }

  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <header
        className="flex shrink-0 items-center justify-between border-b border-black/6 bg-white/92 px-3 pb-2 backdrop-blur-md"
        style={{ paddingTop: 'max(0px, env(safe-area-inset-top, 0px))' }}
      >
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#111827]"
        >
          <X className="size-5" />
        </motion.button>
        <span className="text-[10px] tracking-[0.25em] text-[#9CA3AF]">THREAD</span>
        <div className="w-9" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <p className="mx-auto max-w-[560px] text-[20px] leading-relaxed text-[#111827]">{question.body}</p>
        <p className="mx-auto mt-3 max-w-[560px] text-[11px] text-[#9CA3AF]">
          {question.visibility === 'directed' ? '定向提问 · 仅受邀答主可回答' : '公开提问'}
          <span className="mx-1">·</span>
          <span>{formatFullDateTime(question.createdAt)}</span>
        </p>

        <div className="mx-auto mt-8 max-w-[560px] space-y-6">
          {merged.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-black/8 bg-white/30 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] backdrop-blur-[3px]"
            >
              <div className="flex gap-3">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#F3F4F6]">
                  {a.isAnonymous ? (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-[#9CA3AF]">?</div>
                  ) : (
                    <img src={a.authorAvatarUrl || ''} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#111827]">
                    <span>{a.authorName}</span>
                    <span className="text-[11px] font-normal text-[#9CA3AF]">{formatTimeTag(a.createdAt)}</span>
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-[#374151]">{a.content}</p>
                  <div className="relative mt-3 flex items-center gap-4">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => onLike(a)}
                      className={`relative flex items-center gap-1 text-[12px] ${
                        a.vote === 'like'
                          ? 'text-[#111827]'
                          : a.vote
                            ? 'text-[#C4C7CF]'
                            : 'text-[#6B7280]'
                      }`}
                    >
                      <ThumbsUp className="size-4" strokeWidth={1.5} />
                      <span>{a.likeCount}</span>
                      <AnimatePresence>
                        {a.likeBurst ? (
                          <motion.div key="burst" className="pointer-events-none absolute left-1/2 top-1/2">
                            {Array.from({ length: 8 }).map((_, i) => {
                              const angle = (i / 8) * Math.PI * 2
                              const x = Math.cos(angle) * 14
                              const y = Math.sin(angle) * 14
                              return (
                                <motion.span
                                  key={i}
                                  className="absolute h-1 w-1 rounded-full bg-[#111827]/75"
                                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                                  animate={{ x, y, opacity: 0, scale: 0.2 }}
                                  transition={{ duration: 0.34, ease: 'easeOut' }}
                                />
                              )
                            })}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => onDislike(a)}
                      className={`flex items-center gap-1 text-[12px] ${
                        a.vote === 'dislike'
                          ? 'text-[#111827]'
                          : a.vote
                            ? 'text-[#C4C7CF]'
                            : 'text-[#9CA3AF]'
                      }`}
                    >
                      <ThumbsDown className="size-4" strokeWidth={1.5} />
                      <span>{a.dislikeCount}</span>
                      <AnimatePresence>
                        {a.dislikeBurst ? (
                          <motion.div key="dislike-burst" className="pointer-events-none absolute left-1/2 top-1/2">
                            {Array.from({ length: 8 }).map((_, i) => {
                              const angle = (i / 8) * Math.PI * 2
                              const x = Math.cos(angle) * 14
                              const y = Math.sin(angle) * 14
                              return (
                                <motion.span
                                  key={i}
                                  className="absolute h-1 w-1 rounded-full bg-[#6B7280]/70"
                                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                                  animate={{ x, y, opacity: 0, scale: 0.2 }}
                                  transition={{ duration: 0.34, ease: 'easeOut' }}
                                />
                              )
                            })}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </motion.button>
                  </div>
                </div>
              </div>

              {a.replies.length > 0 ? (
                <div className="mt-4 border-t border-black/5 pt-3">
                  {(expanded[a.id] ? a.replies : a.replies.slice(0, 1)).map((r) => (
                    <div key={r.id} className="mb-2 rounded-lg bg-[#F9FAFB] px-2.5 py-2 text-[13px] leading-relaxed text-[#4B5563]">
                      <span className="font-medium text-[#111827]">{r.authorName}</span>
                      {r.replyToName ? (
                        <>
                          <span className="text-[#9CA3AF]"> 回复 </span>
                          <span className="font-medium text-[#111827]">{r.replyToName}</span>
                        </>
                      ) : null}
                      <span className="mx-1">:</span>
                      {r.content}
                      <span className="ml-2 text-[11px] text-[#9CA3AF]">{formatTimeTag(r.createdAt)}</span>
                    </div>
                  ))}
                  {!expanded[a.id] && a.replies.length > 1 ? (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleExpand(a.id)}
                      className="flex w-full items-center justify-center gap-1 py-1 text-[12px] text-[#6B7280]"
                    >
                      <span>展开 {a.replies.length - 1} 条回复</span>
                      <ChevronDown className="size-3.5" />
                    </motion.button>
                  ) : expanded[a.id] && a.replies.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => toggleExpand(a.id)}
                      className="mt-1 w-full text-center text-[12px] text-[#9CA3AF]"
                    >
                      收起
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          {question.answers.length === 0 ? (
            <p className="text-center text-[13px] text-[#9CA3AF]">还没有回答 · 静候第一声回响</p>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-black/6 bg-white/92 px-4 pb-[calc(8px+env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur-md">
        {aiReplying ? (
          <p className="mb-2 text-[11px] text-[#9CA3AF]">网友正在输入中...</p>
        ) : null}
        <div className="flex items-center gap-2">
          <input
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitComment()
            }}
            placeholder="写下你的评论..."
            className="h-10 min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 text-[13px] text-[#111827] outline-none placeholder:text-[#9CA3AF]"
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={submitComment}
            className="h-10 rounded-xl bg-[#111827] px-4 text-[12px] text-white"
          >
            发送
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
