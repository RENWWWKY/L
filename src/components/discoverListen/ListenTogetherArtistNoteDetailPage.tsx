import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Heart, Loader2, MessageCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ArtistNoteBody } from './artistNoteDisplay'
import { ListenTogetherHeaderRefreshButton } from './ListenTogetherHeaderRefreshButton'
import { ListenNum, ListenNumericText } from './ListenNum'
import { ListenNeteaseCommentText } from './ListenNeteaseCommentText'
import {
  fetchEventComments,
  type NeteaseArtistNote,
  type NeteaseSongComment,
} from './neteaseMusicApi'

const COMMENT_PAGE_SIZE = 30

function formatCommentTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function CommentItem({ comment }: { comment: NeteaseSongComment }) {
  return (
    <article className="flex gap-3 rounded-2xl bg-white px-3 py-3 ring-1 ring-stone-100/80">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-100">
        {comment.avatar ? (
          <img
            src={comment.avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[12px] text-stone-400">
            {comment.nickname.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-medium text-stone-700">
            <ListenNumericText text={comment.nickname} />
          </p>
          {comment.isHot ? (
            <span className="shrink-0 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-400">
              热评
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-stone-600">
          <ListenNeteaseCommentText text={comment.content} />
        </p>
        <div className="mt-2.5 flex items-center gap-3 text-[12px] text-stone-400">
          <ListenNumericText text={formatCommentTime(comment.time)} />
          {comment.likedCount > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <Heart className="size-3.5 text-rose-300" strokeWidth={1.5} />
              <ListenNum>{comment.likedCount}</ListenNum>
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export type ListenTogetherArtistNoteDetailPageProps = {
  open: boolean
  note: NeteaseArtistNote | null
  artistName: string
  artistAvatar: string
  cookie: string
  scrollToComments?: boolean
  onBack: () => void
  className?: string
}

export function ListenTogetherArtistNoteDetailPage({
  open,
  note,
  artistName,
  artistAvatar,
  cookie,
  scrollToComments = false,
  onBack,
  className = '',
}: ListenTogetherArtistNoteDetailPageProps) {
  const commentsRef = useRef<HTMLDivElement>(null)
  const [hot, setHot] = useState<NeteaseSongComment[]>([])
  const [items, setItems] = useState<NeteaseSongComment[]>([])
  const [total, setTotal] = useState(0)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadFirst = useCallback(async (force = false) => {
    if (!note?.threadId || !cookie) return
    if (force) {
      setHot([])
      setItems([])
      setTotal(0)
      setMore(false)
    }
    setLoading(true)
    setError(null)
    try {
      const page = await fetchEventComments(cookie, note.threadId, COMMENT_PAGE_SIZE, 0)
      setHot(page.hot)
      setItems(page.items)
      setTotal(page.total)
      setMore(page.more)
    } catch (e) {
      setHot([])
      setItems([])
      setError(e instanceof Error ? e.message : '加载评论失败')
    } finally {
      setLoading(false)
    }
  }, [cookie, note?.threadId])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadFirst(true)
    } finally {
      setRefreshing(false)
    }
  }, [loadFirst])

  useEffect(() => {
    if (!open || !note) return
    setHot([])
    setItems([])
    setTotal(0)
    setMore(false)
    void loadFirst()
  }, [open, note?.id, loadFirst, note])

  useEffect(() => {
    if (!open || !scrollToComments || loading) return
    const timer = window.setTimeout(() => {
      commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [open, scrollToComments, loading])

  const loadMore = useCallback(async () => {
    if (!note?.threadId || !cookie || loadingMore || !more) return
    setLoadingMore(true)
    try {
      const page = await fetchEventComments(
        cookie,
        note.threadId,
        COMMENT_PAGE_SIZE,
        items.length,
      )
      setItems((prev) => {
        const seen = new Set(prev.map((c) => c.id))
        const merged = [...prev]
        for (const c of page.items) {
          if (!seen.has(c.id)) {
            seen.add(c.id)
            merged.push(c)
          }
        }
        return merged
      })
      setMore(page.more)
      setTotal(page.total)
    } catch {
      /* 保留已加载 */
    } finally {
      setLoadingMore(false)
    }
  }, [cookie, items.length, loadingMore, more, note?.threadId])

  if (!note) return null

  const displayTotal = total || note.commentCount || hot.length + items.length

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal
          aria-label="笔记详情"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className={`fixed inset-0 z-[110] mx-auto flex max-w-[560px] flex-col bg-stone-50 ${className}`}
        >
          <header className="shrink-0 border-b border-stone-100/80 bg-stone-50/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="返回"
                onClick={onBack}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-white"
              >
                <ArrowLeft className="size-5" strokeWidth={1.5} />
              </button>
              <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-stone-800">
                笔记详情
              </h1>
              <ListenTogetherHeaderRefreshButton
                variant="ghost"
                loading={refreshing || loading}
                onClick={() => void handleRefresh()}
              />
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto pb-[max(16px,env(safe-area-inset-bottom))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <article className="bg-white shadow-sm ring-1 ring-stone-100/80">
              <ArtistNoteBody
                note={note}
                artistName={artistName}
                artistAvatar={artistAvatar}
                showStats
              />
            </article>

            <div ref={commentsRef} className="mt-4 px-4">
              <div className="mb-3 flex items-center gap-1.5">
                <MessageCircle className="size-4 text-rose-400" strokeWidth={1.5} />
                <h2 className="text-[15px] font-medium text-stone-800">
                  评论
                  {displayTotal > 0 ? (
                    <span className="ml-1 text-[13px] font-normal text-stone-400">
                      <ListenNum>{displayTotal.toLocaleString()}</ListenNum>
                    </span>
                  ) : null}
                </h2>
              </div>

              {loading ? (
                <p className="flex items-center justify-center gap-2 py-16 text-[13px] text-stone-400">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  加载评论中…
                </p>
              ) : null}

              {error && !loading ? (
                <div className="py-12 text-center">
                  <p className="text-[13px] text-rose-400">{error}</p>
                  <button
                    type="button"
                    onClick={() => void loadFirst()}
                    className="mt-3 text-[12px] text-stone-500 underline"
                  >
                    重试
                  </button>
                </div>
              ) : null}

              {!loading && !error ? (
                <div className="space-y-3">
                  {hot.length === 0 && items.length === 0 ? (
                    <p className="py-12 text-center text-[14px] text-stone-400">暂无评论</p>
                  ) : null}
                  {hot.map((c) => (
                    <CommentItem key={`hot-${c.id}`} comment={c} />
                  ))}
                  {items.map((c) => (
                    <CommentItem key={c.id} comment={c} />
                  ))}
                  {more ? (
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => void loadMore()}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-[14px] font-medium text-stone-600 shadow-sm ring-1 ring-stone-100 disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          加载中…
                        </>
                      ) : (
                        '加载更多评论'
                      )}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
