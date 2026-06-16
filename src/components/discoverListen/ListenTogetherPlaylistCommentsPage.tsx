import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Loader2, MessageCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { ListenCommentItem } from './ListenCommentItem'
import { ListenCommentComposer, type ListenCommentAuthor } from './ListenCommentComposer'
import { ListenTogetherHeaderRefreshButton } from './ListenTogetherHeaderRefreshButton'
import { ListenTogetherActionToast } from './ListenTogetherActionToast'
import { ListenNum, ListenNumericText } from './ListenNum'
import { ShareCommentContactsDrawer } from './ShareCommentContactsDrawer'
import type { InviteableContact } from './useInviteableWeChatContacts'
import { sendListenCommentShareToContacts } from '../../phone/apps/wechat/musicSync/sendListenCommentShare'
import {
  fetchPlaylistComments,
  type NeteaseSongComment,
  type PlaylistMeta,
} from './neteaseMusicApi'
import {
  clearPlaylistCommentsCache,
  getCachedPlaylistComments,
  savePlaylistCommentsCache,
} from './listenTogetherPersistence'
import { getLocalComments } from './listenLocalComments'

const COMMENT_PAGE_SIZE = 30

export type ListenTogetherPlaylistCommentsPageProps = {
  open: boolean
  playlist: Pick<PlaylistMeta, 'id' | 'title' | 'cover' | 'commentCount'> | null
  cookie: string
  author?: ListenCommentAuthor
  onBack: () => void
  onRequireLogin?: () => void
  className?: string
}

export function ListenTogetherPlaylistCommentsPage({
  open,
  playlist,
  cookie,
  author,
  onBack,
  onRequireLogin,
  className = '',
}: ListenTogetherPlaylistCommentsPageProps) {
  const [hot, setHot] = useState<NeteaseSongComment[]>([])
  const [items, setItems] = useState<NeteaseSongComment[]>([])
  const [localComments, setLocalComments] = useState<NeteaseSongComment[]>([])
  const [total, setTotal] = useState(0)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [shareComment, setShareComment] = useState<NeteaseSongComment | null>(null)
  const [shareDrawerOpen, setShareDrawerOpen] = useState(false)
  const [shareSending, setShareSending] = useState(false)

  const persistComments = useCallback(
    async (
      nextHot: NeteaseSongComment[],
      nextItems: NeteaseSongComment[],
      nextTotal: number,
      nextMore: boolean,
    ) => {
      if (!playlist?.id) return
      await savePlaylistCommentsCache({
        playlistId: playlist.id,
        hot: nextHot,
        items: nextItems,
        total: nextTotal,
        more: nextMore,
        updatedAt: Date.now(),
      })
    },
    [playlist?.id],
  )

  const loadFirst = useCallback(async (force = false) => {
    if (!playlist?.id) return
    const local = await getLocalComments('playlist', playlist.id)
    setLocalComments(local)
    if (!cookie) {
      setLoading(false)
      setError(null)
      return
    }
    if (!force) {
      const cached = await getCachedPlaylistComments(playlist.id)
      if (cached) {
        setHot(cached.hot)
        setItems(cached.items)
        setTotal(cached.total)
        setMore(cached.more)
        setError(null)
        setLoading(false)
        return
      }
    }
    if (force) {
      setHot([])
      setItems([])
      setTotal(0)
      setMore(false)
    }
    setLoading(true)
    setError(null)
    try {
      const page = await fetchPlaylistComments(cookie, playlist.id, COMMENT_PAGE_SIZE, 0)
      setHot(page.hot)
      setItems(page.items)
      setTotal(page.total)
      setMore(page.more)
      await persistComments(page.hot, page.items, page.total, page.more)
    } catch (e) {
      if (!force) {
        const cached = await getCachedPlaylistComments(playlist.id)
        if (cached) {
          setHot(cached.hot)
          setItems(cached.items)
          setTotal(cached.total)
          setMore(cached.more)
          setError(null)
          return
        }
      }
      setHot([])
      setItems([])
      setError(e instanceof Error ? e.message : '加载评论失败')
    } finally {
      setLoading(false)
    }
  }, [playlist?.id, cookie, persistComments])

  const handleRefresh = useCallback(async () => {
    if (!playlist?.id) return
    setRefreshing(true)
    try {
      await clearPlaylistCommentsCache(playlist.id)
      await loadFirst(true)
    } finally {
      setRefreshing(false)
    }
  }, [playlist?.id, loadFirst])

  useEffect(() => {
    if (!open || !playlist) return
    setLocalComments([])
    void loadFirst()
  }, [open, playlist?.id, loadFirst, playlist])

  const handlePosted = useCallback(
    (comment: NeteaseSongComment) => {
      if (comment.localOnly) {
        setLocalComments((prev) => [comment, ...prev.filter((c) => c.id !== comment.id)])
        return
      }
      setItems((prev) => {
        const next = [comment, ...prev.filter((c) => c.id !== comment.id)]
        void persistComments(hot, next, total + 1, more)
        return next
      })
      setTotal((t) => t + 1)
    },
    [hot, more, persistComments, total],
  )

  const handleShareConfirm = useCallback(
    async (contacts: InviteableContact[]) => {
      if (!shareComment || !playlist?.id) return
      setShareSending(true)
      try {
        const result = await sendListenCommentShareToContacts(
          contacts.map((c) => c.characterId),
          {
            commentId: shareComment.id,
            commentText: shareComment.content,
            commentAuthor: shareComment.nickname,
            commentAuthorAvatar: shareComment.avatar,
            targetType: 'playlist',
            targetId: playlist.id,
            targetTitle: playlist.title,
            targetCover: playlist.cover,
          },
        )
        setToast(`已分享给 ${result.sent} 位好友，可在微信查看`)
        setShareDrawerOpen(false)
        setShareComment(null)
      } catch (e) {
        setToast(e instanceof Error ? e.message : '分享失败')
      } finally {
        setShareSending(false)
      }
    },
    [shareComment, playlist],
  )

  const loadMore = useCallback(async () => {
    if (!playlist?.id || !cookie || loadingMore || !more) return
    setLoadingMore(true)
    try {
      const page = await fetchPlaylistComments(cookie, playlist.id, COMMENT_PAGE_SIZE, items.length)
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
        void persistComments(hot, merged, page.total, page.more)
        return merged
      })
    } catch {
      /* 保留已加载 */
    } finally {
      setLoadingMore(false)
    }
  }, [playlist?.id, cookie, loadingMore, more, items.length, hot, persistComments])

  if (!playlist) return null

  const displayTotal = (total || playlist.commentCount || hot.length + items.length) + localComments.length

  const renderComment = (comment: NeteaseSongComment, key: string) => (
    <ListenCommentItem
      key={key}
      comment={comment}
      canInteract={false}
      onShare={() => {
        setShareComment(comment)
        setShareDrawerOpen(true)
      }}
    />
  )

  return (
    <>
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal
          aria-label={`${playlist.title} 的评论`}
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
                歌单评论
              </h1>
              <ListenTogetherHeaderRefreshButton
                variant="ghost"
                loading={refreshing || loading}
                onClick={() => void handleRefresh()}
              />
            </div>

            <div className="flex gap-4">
              <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-stone-100 shadow-sm ring-1 ring-stone-100">
                {playlist.cover ? (
                  <img src={playlist.cover} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <h2 className="line-clamp-2 text-[18px] font-semibold leading-snug text-stone-800">
                  <ListenNumericText text={playlist.title} />
                </h2>
                <p className="mt-2 flex items-center gap-1 text-[13px] text-stone-500">
                  <MessageCircle className="size-3.5 text-rose-400" strokeWidth={1.5} />
                  <ListenNum>{displayTotal.toLocaleString()}</ListenNum> 条评论
                </p>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                {hot.length === 0 && items.length === 0 && localComments.length === 0 ? (
                  <p className="py-20 text-center text-[14px] text-stone-400">暂无评论</p>
                ) : null}
                {localComments.map((c) => renderComment(c, `local-${c.id}`))}
                {hot.map((c) => renderComment(c, `hot-${c.id}`))}
                {items.map((c) => renderComment(c, String(c.id)))}
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

          <ListenCommentComposer
            targetType="playlist"
            targetId={playlist.id}
            cookie={cookie}
            author={author}
            onPosted={handlePosted}
            onToast={setToast}
            onRequireLogin={() => {
              setToast('请先登录网易云账号')
              onRequireLogin?.()
            }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
    <ShareCommentContactsDrawer
      open={shareDrawerOpen}
      onClose={() => {
        if (shareSending) return
        setShareDrawerOpen(false)
        setShareComment(null)
      }}
      onConfirm={handleShareConfirm}
      sending={shareSending}
    />
    <ListenTogetherActionToast message={toast} onClear={() => setToast(null)} />
    </>
  )
}
