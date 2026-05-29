import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Heart, Loader2, MessageCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { ListenNum } from './ListenNum'
import { fetchSongComments, type NeteaseSongComment, type NeteaseSongItem } from './neteaseMusicApi'
import { getCachedSongComments, saveSongCommentsCache } from './songCommentsCache'

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
    <article className="flex gap-3 rounded-2xl bg-white/90 px-3 py-3 shadow-sm ring-1 ring-stone-100/80">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-100">
        {comment.avatar ? (
          <img src={comment.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[12px] text-stone-400">
            {comment.nickname.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-medium text-stone-700">{comment.nickname}</p>
          {comment.isHot ? (
            <span className="shrink-0 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-400">
              热评
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-stone-600">
          {comment.content}
        </p>
        <div className="mt-2.5 flex items-center gap-3 text-[12px] text-stone-400">
          <span>{formatCommentTime(comment.time)}</span>
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

export type ListenTogetherSongCommentsPageProps = {
  open: boolean
  song: NeteaseSongItem | null
  cookie: string
  onBack: () => void
  className?: string
}

export function ListenTogetherSongCommentsPage({
  open,
  song,
  cookie,
  onBack,
  className = '',
}: ListenTogetherSongCommentsPageProps) {
  const [hot, setHot] = useState<NeteaseSongComment[]>([])
  const [items, setItems] = useState<NeteaseSongComment[]>([])
  const [total, setTotal] = useState(0)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFirst = useCallback(async () => {
    if (!song?.id || !cookie) return
    const cached = await getCachedSongComments(song.id)
    if (cached) {
      setHot(cached.hot)
      setItems(cached.items)
      setTotal(cached.total)
      setMore(cached.more)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const page = await fetchSongComments(cookie, song.id, COMMENT_PAGE_SIZE, 0)
      setHot(page.hot)
      setItems(page.items)
      setTotal(page.total)
      setMore(page.more)
      await saveSongCommentsCache({
        songId: song.id,
        hot: page.hot,
        items: page.items,
        total: page.total,
        more: page.more,
        updatedAt: Date.now(),
      })
    } catch (e) {
      setHot([])
      setItems([])
      setError(e instanceof Error ? e.message : '加载评论失败')
    } finally {
      setLoading(false)
    }
  }, [song?.id, cookie])

  useEffect(() => {
    if (!open || !song) return
    setHot([])
    setItems([])
    setTotal(0)
    setMore(false)
    void loadFirst()
  }, [open, song?.id, loadFirst, song])

  const loadMore = useCallback(async () => {
    if (!song?.id || !cookie || loadingMore || !more) return
    setLoadingMore(true)
    try {
      const page = await fetchSongComments(cookie, song.id, COMMENT_PAGE_SIZE, items.length)
      setItems((prev) => {
        const seen = new Set(prev.map((c) => c.id))
        const merged = [...prev]
        for (const c of page.items) {
          if (!seen.has(c.id)) {
            seen.add(c.id)
            merged.push(c)
          }
        }
        setMore(page.more)
        setTotal(page.total)
        void saveSongCommentsCache({
          songId: song.id,
          hot,
          items: merged,
          total: page.total,
          more: page.more,
          updatedAt: Date.now(),
        })
        return merged
      })
    } catch {
      /* 保留已加载 */
    } finally {
      setLoadingMore(false)
    }
  }, [song?.id, cookie, loadingMore, more, items, hot])

  if (!song) return null

  const displayTotal = total || hot.length + items.length

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal
          aria-label={`${song.name} 的评论`}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className={`fixed inset-0 z-[110] mx-auto flex max-w-[560px] flex-col bg-stone-50 ${className}`}
        >
          <header className="shrink-0 border-b border-stone-100/80 bg-stone-50/95 px-4 pb-4 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md">
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                aria-label="返回"
                onClick={onBack}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-white"
              >
                <ArrowLeft className="size-5" strokeWidth={1.5} />
              </button>
              <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-stone-800">
                歌曲评论
              </h1>
            </div>

            <div className="flex gap-4">
              <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-stone-100 shadow-sm ring-1 ring-stone-100">
                {song.cover ? (
                  <img src={song.cover} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <h2 className="line-clamp-2 text-[18px] font-semibold leading-snug text-stone-800">
                  {song.name}
                </h2>
                <p className="mt-1 truncate text-[13px] text-stone-400">{song.artist}</p>
                <p className="mt-2 flex items-center gap-1 text-[13px] text-stone-500">
                  <MessageCircle className="size-3.5 text-rose-400" strokeWidth={1.5} />
                  <ListenNum>{displayTotal.toLocaleString()}</ListenNum> 条评论
                </p>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {loading ? (
              <p className="flex items-center justify-center gap-2 py-20 text-[13px] text-stone-400">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                加载评论中…
              </p>
            ) : null}

            {error && !loading ? (
              <div className="py-16 text-center">
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
                  <p className="py-20 text-center text-[14px] text-stone-400">暂无评论</p>
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
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
