import { motion } from 'framer-motion'
import { ArrowLeft, Bookmark, Loader2, MessageCircle, Music2, Pause, Play, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ListenTogetherPlaylistCommentsPage } from './ListenTogetherPlaylistCommentsPage'
import { ListenTogetherSongCommentsPage } from './ListenTogetherSongCommentsPage'
import type { ListenCommentAuthor } from './ListenCommentComposer'
import { ListenTogetherHeaderRefreshButton } from './ListenTogetherHeaderRefreshButton'
import { ListenNum, ListenNumericText } from './ListenNum'
import {
  fetchAlbumDetail,
  fetchAllPlaylistTracks,
  fetchPlaylistMeta,
  fetchPlaylistTracks,
  filterPlaylistTracks,
  PLAYLIST_TRACKS_PAGE_SIZE,
  subscribeNeteasePlaylist,
  type NeteaseSongItem,
  type PlaylistMeta,
} from './neteaseMusicApi'
import { getCachedPlaylist, savePlaylistCache } from './playlistTracksCache'
import { ListenTogetherPageBackground } from './listenTogetherPageBg'

function formatPlaylistDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type PlaylistDetailInfo = {
  id: number
  title: string
  cover: string
  count: number
  kind?: 'playlist' | 'album'
}

export type ListenTogetherPlaylistDetailPageProps = {
  playlist: PlaylistDetailInfo
  cookie: string
  onBack: () => void
  onPlaySong: (song: NeteaseSongItem, queueTracks: NeteaseSongItem[]) => void
  playingSongId?: number | null
  isPlaying?: boolean
  neteaseUserId?: number
  commentAuthor?: ListenCommentAuthor
  onRequireLogin?: () => void
  onPlaylistSubscribeChange?: () => void
  /** 为底部迷你播放器预留空间 */
  contentBottomInset?: string
  className?: string
}

function SongRow({
  index,
  song,
  active,
  playing,
  onPlay,
  onShowComments,
}: {
  index: number
  song: NeteaseSongItem
  active: boolean
  playing: boolean
  onPlay: () => void
  onShowComments: () => void
}) {
  return (
    <div
      className={`flex w-full items-center gap-1 rounded-2xl pr-1 transition-all duration-300 ${
        active
          ? 'bg-white shadow-[0_8px_24px_rgba(120,113,108,0.1)] ring-1 ring-rose-100/80'
          : 'bg-white/60 hover:bg-white/90'
      }`}
    >
    <button
      type="button"
      onClick={onPlay}
      className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-left active:scale-[0.99]"
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center text-[12px] ${
          active ? 'font-medium text-rose-400' : 'text-stone-400'
        }`}
      >
        {playing ? (
          <span className="flex h-3 items-end gap-0.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-0.5 rounded-full bg-rose-400"
                animate={{ height: [4, 10, 6, 12, 4] }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  delay: i * 0.12,
                  ease: 'easeInOut',
                }}
                style={{ height: 6 }}
              />
            ))}
          </span>
        ) : (
          <ListenNum>{index}</ListenNum>
        )}
      </span>
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-100">
        {song.cover ? (
          <img src={song.cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <Music2 className="m-auto size-5 text-stone-300" strokeWidth={1.5} aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-[15px] ${
            active ? 'font-medium text-stone-800' : 'text-stone-700'
          }`}
        >
          <ListenNumericText text={song.name} />
        </p>
        <p className="mt-0.5 truncate text-[12px] text-stone-400">
          <ListenNumericText text={song.artist} />
        </p>
      </div>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
          active ? 'bg-rose-50 text-rose-400' : 'bg-stone-50 text-stone-500'
        }`}
      >
        {playing ? (
          <Pause className="size-4 fill-current" strokeWidth={0} />
        ) : (
          <Play className="size-4 fill-current pl-0.5" strokeWidth={0} />
        )}
      </span>
    </button>
    <button
      type="button"
      aria-label={`查看 ${song.name} 的评论`}
      onClick={onShowComments}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-400"
    >
      <MessageCircle className="size-4" strokeWidth={1.5} />
    </button>
    </div>
  )
}

export function ListenTogetherPlaylistDetailPage({
  playlist,
  cookie,
  onBack,
  onPlaySong,
  playingSongId = null,
  isPlaying = false,
  neteaseUserId = 0,
  commentAuthor,
  onRequireLogin,
  onPlaylistSubscribeChange,
  contentBottomInset,
  className = '',
}: ListenTogetherPlaylistDetailPageProps) {
  const [meta, setMeta] = useState<PlaylistMeta | null>(null)
  const [title, setTitle] = useState(playlist.title)
  const [cover, setCover] = useState(playlist.cover)
  const [count, setCount] = useState(playlist.count)
  const [tracks, setTracks] = useState<NeteaseSongItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingAll, setLoadingAll] = useState(false)
  const [pageRefreshing, setPageRefreshing] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [subscribeError, setSubscribeError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [commentsSong, setCommentsSong] = useState<NeteaseSongItem | null>(null)
  const [showPlaylistComments, setShowPlaylistComments] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

  const isAlbum = playlist.kind === 'album'
  const isOwnPlaylist = !isAlbum && neteaseUserId > 0 && meta?.creator.id === neteaseUserId
  const subscribed = meta?.subscribed ?? false

  const hasMore = tracks.length < count
  const remaining = Math.max(0, count - tracks.length)

  const filteredTracks = useMemo(
    () => filterPlaylistTracks(tracks, searchQuery),
    [tracks, searchQuery],
  )

  const searching = searchQuery.trim().length > 0

  const trackIndexById = useMemo(() => {
    const map = new Map<number, number>()
    tracks.forEach((s, i) => map.set(s.id, i + 1))
    return map
  }, [tracks])

  const persistCache = useCallback(
    async (
      nextTracks: NeteaseSongItem[],
      nextCount: number,
      fullyLoaded?: boolean,
      nextMeta?: PlaylistMeta | null,
    ) => {
      if (!playlist.id || nextTracks.length === 0) return
      await savePlaylistCache({
        playlistId: playlist.id,
        title,
        cover,
        count: nextCount,
        tracks: nextTracks,
        fullyLoaded: fullyLoaded ?? nextTracks.length >= nextCount,
        meta: nextMeta ?? meta ?? undefined,
      })
    },
    [playlist.id, title, cover, meta],
  )

  const applyPlaylistCache = useCallback(
    (cached: NonNullable<Awaited<ReturnType<typeof getCachedPlaylist>>>) => {
      setTitle(cached.title || playlist.title)
      setCover(cached.cover || playlist.cover)
      setCount(cached.count || playlist.count)
      setTracks(cached.tracks)
      if (cached.meta) setMeta(cached.meta)
      setFromCache(true)
      setLoading(false)
    },
    [playlist.title, playlist.cover, playlist.count],
  )

  const load = useCallback(async (force = false) => {
    if (!cookie || !playlist.id) {
      setError('请先登录网易云')
      setLoading(false)
      return
    }

    setError(null)
    setSubscribeError(null)
    setSearchQuery('')

    const cached = force ? null : await getCachedPlaylist(playlist.id)
    const hasCachedTracks = Boolean(cached?.tracks.length)

    if (hasCachedTracks) {
      applyPlaylistCache(cached!)
      if (cached!.fullyLoaded && !force) {
        return
      }
    } else {
      setFromCache(false)
      setLoading(true)
      setTracks([])
    }

    try {
      if (isAlbum) {
        const { meta: albumMeta, songs } = await fetchAlbumDetail(cookie, playlist.id)
        setMeta(albumMeta)
        setTitle(albumMeta.title)
        setCover(albumMeta.cover)
        const total = albumMeta.count || songs.length
        setCount(total)
        setTracks(songs)
        await persistCache(songs, total, true, albumMeta)
        setFromCache(false)
        if (songs.length === 0) setError('专辑暂无歌曲')
        return
      }

      const metaPromise = fetchPlaylistMeta(cookie, playlist.id)
      if (!hasCachedTracks) {
        const [metaResult, list] = await Promise.all([
          metaPromise,
          fetchPlaylistTracks(cookie, playlist.id, PLAYLIST_TRACKS_PAGE_SIZE, 0),
        ])
        setMeta(metaResult)
        setTitle(metaResult.title)
        setCover(metaResult.cover)
        const total = metaResult.count || list.length
        setCount(total)
        setTracks(list)
        await persistCache(list, total, list.length >= total, metaResult)
        setFromCache(false)
        if (list.length === 0) setError('歌单暂无歌曲')
      } else {
        const metaResult = await metaPromise
        setMeta(metaResult)
        setTitle(metaResult.title || cached!.title || playlist.title)
        setCover(metaResult.cover || cached!.cover || playlist.cover)
        setCount(metaResult.count || cached!.count || playlist.count)
        if (force) {
          const list = await fetchPlaylistTracks(cookie, playlist.id, PLAYLIST_TRACKS_PAGE_SIZE, 0)
          const total = metaResult.count || list.length
          setTracks(list)
          setCount(total)
          await persistCache(list, total, list.length >= total, metaResult)
          setFromCache(false)
          if (list.length === 0) setError('歌单暂无歌曲')
        } else {
          await persistCache(cached!.tracks, metaResult.count || cached!.count, cached!.fullyLoaded, metaResult)
        }
      }
    } catch (e) {
      if (!hasCachedTracks) {
        setTracks([])
        setError(e instanceof Error ? e.message : '加载歌单失败')
      }
    } finally {
      setLoading(false)
    }
  }, [cookie, isAlbum, playlist.id, playlist.title, playlist.cover, playlist.count, persistCache, applyPlaylistCache])

  const handlePageRefresh = useCallback(async () => {
    setPageRefreshing(true)
    try {
      await load(true)
    } finally {
      setPageRefreshing(false)
    }
  }, [load])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (loading || tracks.length === 0) return
    const timer = window.setTimeout(() => {
      void persistCache(tracks, count, tracks.length >= count, meta)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [tracks, count, loading, persistCache, meta])

  const loadMore = useCallback(async () => {
    if (isAlbum || !cookie || !playlist.id || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const batch = await fetchPlaylistTracks(
        cookie,
        playlist.id,
        PLAYLIST_TRACKS_PAGE_SIZE,
        tracks.length,
      )
      if (batch.length === 0) {
        setCount(tracks.length)
        return
      }
      setTracks((prev) => {
        const seen = new Set(prev.map((s) => s.id))
        const merged = [...prev]
        for (const song of batch) {
          if (!seen.has(song.id)) {
            seen.add(song.id)
            merged.push(song)
          }
        }
        void persistCache(merged, count, merged.length >= count, meta)
        return merged
      })
      setFromCache(false)
    } catch {
      /* 保留已加载列表 */
    } finally {
      setLoadingMore(false)
    }
  }, [isAlbum, cookie, playlist.id, loadingMore, hasMore, tracks.length, persistCache, count, meta])

  const loadAll = useCallback(async () => {
    if (isAlbum || !cookie || !playlist.id || loadingAll || !hasMore) return
    setLoadingAll(true)
    try {
      const all = await fetchAllPlaylistTracks(cookie, playlist.id, count, tracks, setTracks)
      setTracks(all)
      setCount(all.length)
      await persistCache(all, all.length, true, meta)
      setFromCache(false)
    } catch {
      /* ignore */
    } finally {
      setLoadingAll(false)
    }
  }, [isAlbum, cookie, playlist.id, loadingAll, hasMore, count, tracks, persistCache, meta])

  const playAll = useCallback(() => {
    const list = searching ? filteredTracks : tracks
    if (list[0]) onPlaySong(list[0], list)
  }, [tracks, filteredTracks, searching, onPlaySong])

  const handleSubscribeToggle = useCallback(async () => {
    if (!cookie) {
      onRequireLogin?.()
      return
    }
    if (!playlist.id || isOwnPlaylist || subscribing) return
    setSubscribing(true)
    setSubscribeError(null)
    const next = !subscribed
    try {
      await subscribeNeteasePlaylist(cookie, playlist.id, next)
      setMeta((prev) => (prev ? { ...prev, subscribed: next } : prev))
      onPlaylistSubscribeChange?.()
    } catch (e) {
      setSubscribeError(e instanceof Error ? e.message : '操作失败')
    } finally {
      setSubscribing(false)
    }
  }, [
    cookie,
    playlist.id,
    isOwnPlaylist,
    subscribing,
    subscribed,
    onRequireLogin,
    onPlaylistSubscribeChange,
  ])

  const playlistCommentsTarget = useMemo(
    () =>
      meta
        ? {
            id: meta.id,
            title: meta.title,
            cover: meta.cover,
            commentCount: meta.commentCount,
          }
        : {
            id: playlist.id,
            title,
            cover,
            commentCount: 0,
          },
    [meta, playlist.id, title, cover],
  )

  const listBusy = loadingMore || loadingAll

  return (
    <div className={`relative flex h-full min-h-0 flex-col ${className}`}>
      <ListenTogetherPageBackground />
      <header className="relative z-[1] shrink-0 border-b border-white/40 bg-white/45 px-4 pb-4 pt-[max(10px,env(safe-area-inset-top))] backdrop-blur-md">
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
            {isAlbum ? '专辑' : '歌单'}
          </h1>
          <ListenTogetherHeaderRefreshButton
            variant="ghost"
            loading={pageRefreshing || loading}
            onClick={() => void handlePageRefresh()}
          />
          <button
            type="button"
            onClick={() => void playAll()}
            disabled={(searching ? filteredTracks : tracks).length === 0}
            className="shrink-0 rounded-full bg-rose-50 px-3 py-1.5 text-[12px] font-medium text-rose-500 transition-colors hover:bg-rose-100 disabled:opacity-40"
          >
            播放全部
          </button>
        </div>

        <div className="flex gap-4">
          <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl bg-stone-100 shadow-sm ring-1 ring-stone-100">
            {cover ? (
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Music2 className="size-8 text-stone-300" strokeWidth={1.5} />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <h2 className="line-clamp-2 text-[18px] font-semibold leading-snug text-stone-800">
              <ListenNumericText text={title} />
            </h2>
            {meta ? (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-100">
                  {meta.creator.avatar ? (
                    <img
                      src={meta.creator.avatar}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                </div>
                <p className="truncate text-[13px] text-stone-500">
                  <ListenNumericText text={meta.creator.nickname} />
                </p>
              </div>
            ) : null}
            <p className="mt-1.5 text-[13px] text-stone-400">
              <ListenNum>{count.toLocaleString()}</ListenNum> 首
              {meta && meta.playCount > 0 ? (
                <>
                  {' '}
                  · 播放 <ListenNum>{meta.playCount.toLocaleString()}</ListenNum> 次
                </>
              ) : null}
              {meta && meta.commentCount > 0 ? (
                <>
                  {' '}
                  · <ListenNum>{meta.commentCount.toLocaleString()}</ListenNum> 评论
                </>
              ) : null}
              {tracks.length > 0 && tracks.length < count ? (
                <span className="text-stone-300">
                  {' '}
                  · 已加载 <ListenNum>{tracks.length}</ListenNum>
                </span>
              ) : null}
              {fromCache && tracks.length > 0 ? (
                <span className="text-stone-300"> · 已缓存（本地库）</span>
              ) : null}
            </p>
            {meta?.createTime ? (
              <p className="mt-1 text-[11px] text-stone-400">
                创建于 <ListenNumericText text={formatPlaylistDate(meta.createTime)} />
              </p>
            ) : null}
            {meta && meta.tags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {meta.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-rose-50/80 px-2 py-0.5 text-[10px] text-rose-400/90"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {meta?.description ? (
              <div className="mt-2">
                <p
                  className={`text-[12px] leading-relaxed text-stone-500 ${
                    descExpanded ? '' : 'line-clamp-2'
                  }`}
                >
                  <ListenNumericText text={meta.description} />
                </p>
                {meta.description.length > 48 ? (
                  <button
                    type="button"
                    onClick={() => setDescExpanded((v) => !v)}
                    className="mt-0.5 text-[11px] text-rose-400"
                  >
                    {descExpanded ? '收起' : '展开简介'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {!loading && !error && !isAlbum ? (
          <div className="mt-3 flex gap-2">
            {isOwnPlaylist ? (
              <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-stone-100 px-3 py-2 text-[12px] text-stone-500">
                我的歌单
              </span>
            ) : (
              <button
                type="button"
                disabled={subscribing}
                onClick={() => void handleSubscribeToggle()}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium transition-colors disabled:opacity-60 ${
                  subscribed
                    ? 'bg-rose-50 text-rose-500 ring-1 ring-rose-100'
                    : 'bg-white text-stone-600 shadow-sm ring-1 ring-stone-100 hover:bg-rose-50 hover:text-rose-500'
                }`}
              >
                {subscribing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Bookmark className={`size-3.5 ${subscribed ? 'fill-current' : ''}`} strokeWidth={1.75} />
                )}
                {subscribed ? '已收藏' : '收藏歌单'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPlaylistComments(true)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-[12px] font-medium text-stone-600 shadow-sm ring-1 ring-stone-100 transition-colors hover:bg-rose-50 hover:text-rose-500"
            >
              <MessageCircle className="size-3.5" strokeWidth={1.75} />
              歌单评论
            </button>
          </div>
        ) : null}

        {subscribeError ? (
          <p className="mt-2 text-center text-[11px] text-rose-400">{subscribeError}</p>
        ) : null}

        {!loading && !error ? (
          <label className="relative mt-4 flex items-center">
            <Search
              className="pointer-events-none absolute left-3.5 size-[17px] text-stone-400"
              strokeWidth={1.5}
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAlbum ? '搜索专辑内歌曲…' : '搜索歌单内歌曲…'}
              className="h-10 w-full rounded-full border-0 bg-white py-2 pl-10 pr-9 text-[14px] text-stone-800 shadow-sm outline-none placeholder:text-stone-400 focus:shadow-[0_4px_20px_rgba(251,207,232,0.2)]"
              aria-label={isAlbum ? '搜索专辑内歌曲' : '搜索歌单内歌曲'}
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label="清除搜索"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            ) : null}
          </label>
        ) : null}
      </header>

      <div
        className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={contentBottomInset ? { paddingBottom: contentBottomInset } : undefined}
      >
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-16 text-[13px] text-stone-400">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            加载歌曲中…
          </p>
        ) : null}

        {error && !loading ? (
          <div className="py-12 text-center">
            <p className="text-[13px] text-rose-400">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 text-[12px] text-stone-500 underline"
            >
              重试
            </button>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            {searching ? (
              <p className="mb-3 text-[12px] text-stone-400">
                {filteredTracks.length > 0 ? (
                  <>
                    在已加载的 <ListenNum>{tracks.length}</ListenNum> 首中找到{' '}
                    <ListenNum>{filteredTracks.length}</ListenNum> 首
                  </>
                ) : (
                  <>未找到匹配歌曲</>
                )}
                {hasMore ? (
                  <span className="text-stone-300">
                    {' '}
                    · 还有 <ListenNum>{remaining}</ListenNum> 首未加载
                  </span>
                ) : null}
              </p>
            ) : null}

            {searching && filteredTracks.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[13px] text-stone-500">
                  歌单内没有「{searchQuery.trim()}」
                </p>
                {hasMore ? (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <button
                      type="button"
                      disabled={listBusy}
                      onClick={() => void loadMore()}
                      className="rounded-full bg-white px-4 py-2 text-[13px] text-stone-600 shadow-sm ring-1 ring-stone-100 disabled:opacity-50"
                    >
                      {loadingMore ? (
                        '加载中…'
                      ) : (
                        <>
                          加载更多（还剩 <ListenNum>{remaining}</ListenNum> 首）
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={listBusy}
                      onClick={() => void loadAll()}
                      className="text-[12px] text-rose-400 underline disabled:opacity-50"
                    >
                      {loadingAll ? '正在加载全部…' : '加载全部后再搜'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <ul className="space-y-2 pb-2">
                {filteredTracks.map((song) => {
                  const active = playingSongId === song.id
                  const index = trackIndexById.get(song.id) ?? 0
                  return (
                    <li key={song.id}>
                      <SongRow
                        index={index}
                        song={song}
                        active={active}
                        playing={active && isPlaying}
                        onPlay={() => onPlaySong(song, tracks)}
                        onShowComments={() => setCommentsSong(song)}
                      />
                    </li>
                  )
                })}
              </ul>
            )}

            {!searching && hasMore ? (
              <div className="flex flex-col items-center gap-2 pb-4 pt-2">
                <button
                  type="button"
                  disabled={listBusy}
                  onClick={() => void loadMore()}
                  className="flex min-w-[200px] items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-stone-600 shadow-sm ring-1 ring-stone-100 transition-colors hover:bg-stone-50 disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      加载中…
                    </>
                  ) : (
                    <>
                      加载更多
                      <span className="font-normal text-stone-400">
                        （还剩 <ListenNum>{remaining}</ListenNum> 首）
                      </span>
                    </>
                  )}
                </button>
                {remaining > PLAYLIST_TRACKS_PAGE_SIZE ? (
                  <button
                    type="button"
                    disabled={listBusy}
                    onClick={() => void loadAll()}
                    className="text-[12px] text-stone-400 underline transition-colors hover:text-rose-400 disabled:opacity-50"
                  >
                    {loadingAll ? '正在加载全部歌曲…' : '一次性加载全部'}
                  </button>
                ) : null}
              </div>
            ) : null}

            {searching && hasMore && filteredTracks.length > 0 ? (
              <div className="flex flex-col items-center gap-2 border-t border-stone-100/80 pb-4 pt-4">
                <p className="text-[11px] text-stone-400">
                  搜索范围：已加载的 <ListenNum>{tracks.length.toLocaleString()}</ListenNum> /{' '}
                  <ListenNum>{count.toLocaleString()}</ListenNum> 首
                </p>
                <button
                  type="button"
                  disabled={listBusy}
                  onClick={() => void loadMore()}
                  className="rounded-full bg-white px-4 py-2 text-[12px] text-stone-600 shadow-sm ring-1 ring-stone-100 disabled:opacity-50"
                >
                  {loadingMore ? '加载中…' : `加载更多以扩大搜索`}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <ListenTogetherSongCommentsPage
        open={commentsSong !== null}
        song={commentsSong}
        cookie={cookie}
        author={commentAuthor}
        onBack={() => setCommentsSong(null)}
        onRequireLogin={onRequireLogin}
      />

      <ListenTogetherPlaylistCommentsPage
        open={showPlaylistComments}
        playlist={playlistCommentsTarget}
        cookie={cookie}
        author={commentAuthor}
        onBack={() => setShowPlaylistComments(false)}
        onRequireLogin={onRequireLogin}
      />
    </div>
  )
}
