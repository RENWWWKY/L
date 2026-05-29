import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Home,
  Music2,
  Pause,
  Play,
  QrCode,
  Search,
  StickyNote,
  User,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { activeLyricIndex } from './listenLyricParse'
import {
  formatProgressTimes,
  ListenTogetherFullscreenPlayer,
} from './ListenTogetherFullscreenPlayer'
import { ListenTogetherNotesFeedPage } from './ListenTogetherNotesFeedPage'
import {
  ListenTogetherPlaylistDetailPage,
  type PlaylistDetailInfo,
} from './ListenTogetherPlaylistDetailPage'
import { ListenTogetherSongCommentsPage } from './ListenTogetherSongCommentsPage'
import { ListenTogetherProfilePage } from './ListenTogetherProfilePage'
import { NeteaseQrLoginModal } from './NeteaseQrLoginModal'
import { ListenTogetherSearchExplorePage } from './ListenTogetherSearchExplorePage'
import { hydrateNeteaseLoginCookie, loadNeteaseCookie } from './neteaseApiClient'
import {
  clearListenTogetherSyncCaches,
  getCachedRecentSongs,
  saveCachedRecentSongs,
} from './listenTogetherPersistence'
import { ListenTogetherPageBackground } from './listenTogetherPageBg'
import { useListenTogetherPlayer } from './useListenTogetherPlayer'
import { useNeteaseLikedSongs } from './useNeteaseLikedSongs'
import { useNeteaseProfile } from './useNeteaseProfile'
import { ListenNum } from './ListenNum'
import { fetchUserRecentSongs, type NeteaseSongItem } from './neteaseMusicApi'
import type { NeteasePlaylistItem } from './neteaseProfileApi'

const TAB_BAR_H = 56
const MINI_PLAYER_H = 68
const BOTTOM_STACK = TAB_BAR_H + MINI_PLAYER_H

type DiscoverListenTogetherAppProps = {
  onBack?: () => void
  className?: string
}

function NeteaseBadgeIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" className="fill-rose-100 stroke-rose-200" strokeWidth="0.5" />
      <path
        d="M8 15V9l4 2.2L16 9v6"
        className="stroke-rose-400"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SpinningCover({ src, playing }: { src?: string; playing: boolean }) {
  return (
    <div className="relative h-11 w-11 shrink-0">
      <div
        className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-stone-200 shadow-sm ring-1 ring-stone-200/80 ${
          playing ? 'animate-[spin_8s_linear_infinite]' : ''
        }`}
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <Music2 className="size-5 text-stone-400" strokeWidth={1.5} aria-hidden />
        )}
      </div>
      <div className="pointer-events-none absolute -right-0.5 top-1/2 h-5 w-1.5 -translate-y-1/2 rounded-sm bg-stone-300/90 shadow-sm" aria-hidden />
    </div>
  )
}

export function DiscoverListenTogetherApp({
  onBack,
  className = '',
}: DiscoverListenTogetherAppProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'notes' | 'me'>('home')
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [recentSongs, setRecentSongs] = useState<NeteaseSongItem[]>([])
  const {
    nowPlaying: song,
    isPlaying,
    progress,
    currentTimeMs,
    durationMs,
    lyrics,
    playError,
    playSong,
    playAttachedMusic,
    togglePlay,
    playMode,
    canUseHeartMode,
    playNext,
    playPrev,
    cyclePlayMode,
    seekTo,
    seekToTimeMs,
    clearPlayError,
  } = useListenTogetherPlayer()
  const [neteaseCookie, setNeteaseCookie] = useState(() => loadNeteaseCookie())
  const [cookieReady, setCookieReady] = useState(false)
  const [qrLoginOpen, setQrLoginOpen] = useState(false)
  const [openPlaylist, setOpenPlaylist] = useState<PlaylistDetailInfo | null>(null)
  const [commentsSong, setCommentsSong] = useState<NeteaseSongItem | null>(null)
  const [syncingNetease, setSyncingNetease] = useState(false)
  const [dataSyncVersion, setDataSyncVersion] = useState(0)
  const neteaseBound = Boolean(neteaseCookie)
  const {
    data: neteaseProfile,
    loading: profileLoading,
    error: profileError,
    fromCache: profileFromCache,
    refetch: refetchProfile,
  } = useNeteaseProfile(neteaseCookie, cookieReady)

  const {
    isLiked: isNeteaseSongLiked,
    toggleLike: toggleNeteaseSongLike,
    togglingId: likingSongId,
    reloadLikedIds,
  } = useNeteaseLikedSongs(
    neteaseCookie,
    neteaseProfile?.user.userId,
    neteaseProfile?.likedSongs.id,
  )

  const currentSongLiked = song.songId ? isNeteaseSongLiked(song.songId) : false

  useEffect(() => {
    void hydrateNeteaseLoginCookie().then((cookie) => {
      setNeteaseCookie(cookie)
      setCookieReady(true)
    })
  }, [])

  const headerUser = neteaseProfile?.user ?? null

  useEffect(() => {
    const uid = neteaseProfile?.user.userId
    if (!neteaseCookie || !uid) {
      setRecentSongs([])
      return
    }
    let cancelled = false
    void (async () => {
      const cached = await getCachedRecentSongs(uid)
      if (!cancelled && cached?.songs?.length) {
        setRecentSongs(cached.songs)
        return
      }
      try {
        const songs = await fetchUserRecentSongs(neteaseCookie, uid, 8)
        if (!cancelled) {
          setRecentSongs(songs)
          await saveCachedRecentSongs(uid, songs)
        }
      } catch {
        if (!cancelled) setRecentSongs([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [neteaseCookie, neteaseProfile?.user.userId, dataSyncVersion])

  const handleSyncNetease = useCallback(async () => {
    if (!neteaseCookie || syncingNetease) return
    setSyncingNetease(true)
    setOpenPlaylist(null)
    try {
      await clearListenTogetherSyncCaches()
      setDataSyncVersion((v) => v + 1)
      await refetchProfile({ force: true })
      await reloadLikedIds()
    } finally {
      setSyncingNetease(false)
    }
  }, [neteaseCookie, syncingNetease, refetchProfile, reloadLikedIds])

  const likedPlaylistId = neteaseProfile?.likedSongs.id ?? 0

  const playSongWithContext = useCallback(
    (item: NeteaseSongItem, queue: NeteaseSongItem[], playlistId = 0) => {
      const list = queue.length > 0 ? queue : [item]
      void playSong(item, {
        queue: list,
        index: Math.max(0, list.findIndex((t) => t.id === item.id)),
        playlistId,
        isLikedPlaylist: likedPlaylistId > 0 && playlistId === likedPlaylistId,
      })
    },
    [playSong, likedPlaylistId],
  )

  const openPlaylistDetail = useCallback(
    (info: PlaylistDetailInfo) => {
      if (!neteaseCookie) {
        setQrLoginOpen(true)
        return
      }
      setOpenPlaylist(info)
    },
    [neteaseCookie],
  )

  const playingSongId = song.songId ?? null

  const lyricIndex = useMemo(
    () => activeLyricIndex(lyrics, currentTimeMs, durationMs),
    [lyrics, currentTimeMs, durationMs],
  )

  const fullscreenProgress = useMemo(
    () =>
      isFullScreen
        ? formatProgressTimes(progress, Math.max(1, Math.round(durationMs / 1000)))
        : { current: '0:00', total: '0:00', percentage: 0 },
    [isFullScreen, progress, durationMs],
  )

  const openFullScreen = useCallback(() => {
    setIsFullScreen(true)
  }, [])

  const closeFullScreen = useCallback(() => {
    setIsFullScreen(false)
  }, [])

  const openCommentsForNowPlaying = useCallback(() => {
    if (!song.songId || song.title === '暂无播放') return
    setCommentsSong({
      id: song.songId,
      name: song.title,
      artist: song.artist,
      cover: song.cover ?? '',
    })
  }, [song.songId, song.title, song.artist, song.cover])

  const closeComments = useCallback(() => {
    setCommentsSong(null)
  }, [])

  const bottomPad = `calc(${BOTTOM_STACK}px + env(safe-area-inset-bottom, 0px) + 12px)`
  const hideTabBar = Boolean(openPlaylist)
  const miniPlayerBottom = hideTabBar
    ? 'env(safe-area-inset-bottom, 0px)'
    : `calc(${TAB_BAR_H}px + env(safe-area-inset-bottom, 0px))`
  const overlayBottomInset = `calc(${MINI_PLAYER_H}px + env(safe-area-inset-bottom, 0px))`
  const isHome = activeTab === 'home'
  const isMe = activeTab === 'me'
  const isNotes = activeTab === 'notes'
  const isSearch = activeTab === 'search'
  const usePageImageBg = isHome || isNotes || isSearch

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col overflow-hidden text-stone-800 ${
        usePageImageBg ? '' : 'bg-stone-50'
      } ${className}`}
    >
      {usePageImageBg ? <ListenTogetherPageBackground /> : null}
      {/* —— Scroll area —— */}
      <div
        className="relative z-[1] min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingBottom: isHome ? bottomPad : undefined }}
      >
        {isMe ? (
          <ListenTogetherProfilePage
            onBack={onBack}
            neteaseBound={neteaseBound}
            onRequestLogin={() => setQrLoginOpen(true)}
            neteaseProfile={neteaseProfile}
            profileLoading={neteaseBound && profileLoading}
            profileError={neteaseBound ? profileError : null}
            onOpenPlaylist={openPlaylistDetail}
            profileFromCache={profileFromCache}
            onSyncNetease={() => void handleSyncNetease()}
            syncingNetease={syncingNetease}
          />
        ) : null}

        {isNotes ? (
          <ListenTogetherNotesFeedPage onPlayAttachedMusic={playAttachedMusic} />
        ) : null}

        {isSearch ? (
          <ListenTogetherSearchExplorePage
            neteaseCookie={neteaseCookie}
            onRequireLogin={() => setQrLoginOpen(true)}
            onPlaySong={(s) => void playSongWithContext(s, [s], 0)}
          />
        ) : null}

        {isHome ? (
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-4 pb-3 pt-[max(10px,env(safe-area-inset-top))] bg-white/45 backdrop-blur-md"
        >
          <div className="flex min-w-0 items-center gap-2">
            {onBack ? (
              <button
                type="button"
                aria-label="返回发现页"
                onClick={onBack}
                className="mr-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-white/60"
              >
                <ArrowLeft className="size-5" strokeWidth={1.5} />
              </button>
            ) : null}
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-200/80 ring-2 ring-white shadow-sm">
              {headerUser?.avatar ? (
                <img
                  src={headerUser.avatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="size-4 text-stone-400" strokeWidth={1.5} aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-stone-800">
                {headerUser?.nickname ??
                  (neteaseBound && profileLoading ? '同步中…' : '未登录')}
              </p>
              <div className="flex items-center gap-1">
                <NeteaseBadgeIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[10px] tracking-wide text-stone-400">
                  {neteaseBound ? '已连接网易云' : '点击右侧扫码连接'}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="扫码登录或切换账号"
            onClick={() => setQrLoginOpen(true)}
            className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm transition-colors ${
              neteaseBound
                ? 'border-rose-100 bg-rose-50/80 text-rose-400'
                : 'border-white/80 bg-white/50 text-stone-500 hover:bg-white/80'
            }`}
          >
            <QrCode className="size-[18px]" strokeWidth={1.5} />
          </button>
        </header>
        ) : null}

        {isHome ? (
        <main className="px-4 pb-2">
          <section className="mb-7">
            <h2 className="mb-3 text-[15px] font-semibold tracking-tight text-stone-700">我的音乐库</h2>
            {neteaseBound && neteaseProfile ? (
              <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() =>
                    openPlaylistDetail({
                      id: neteaseProfile.likedSongs.id,
                      title: neteaseProfile.likedSongs.title,
                      cover: neteaseProfile.likedSongs.cover,
                      count: neteaseProfile.likedSongs.count,
                    })
                  }
                  className="group relative h-[108px] w-[148px] shrink-0 overflow-hidden rounded-2xl bg-stone-200 text-left shadow-sm transition-transform active:scale-[0.98]"
                >
                  {neteaseProfile.likedSongs.cover ? (
                    <img
                      src={neteaseProfile.likedSongs.cover}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="text-[14px] font-medium leading-snug text-white">
                      {neteaseProfile.likedSongs.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/70">
                      <ListenNum className="text-white/70">
                        {neteaseProfile.likedSongs.count}
                      </ListenNum>{' '}
                      首
                    </p>
                  </div>
                </button>
                {recentSongs.map((item) => (
                  <button
                    key={`recent-${item.id}`}
                    type="button"
                    onClick={() => void playSongWithContext(item, [item], 0)}
                    className="group relative h-[108px] w-[148px] shrink-0 overflow-hidden rounded-2xl bg-stone-200 text-left shadow-sm transition-transform active:scale-[0.98]"
                  >
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="text-[14px] font-medium leading-snug text-white">{item.name}</p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-white/70">{item.artist}</p>
                    </div>
                  </button>
                ))}
                {neteaseProfile.createdPlaylists.slice(0, 4).map((item: NeteasePlaylistItem) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      openPlaylistDetail({
                        id: item.id,
                        title: item.title,
                        cover: item.cover,
                        count: item.count,
                      })
                    }
                    className="group relative h-[108px] w-[148px] shrink-0 overflow-hidden rounded-2xl bg-stone-200 text-left shadow-sm transition-transform active:scale-[0.98]"
                  >
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="text-[14px] font-medium leading-snug text-white">{item.title}</p>
                      <p className="mt-0.5 text-[11px] text-white/70">
                        <ListenNum className="text-white/70">{item.count}</ListenNum> 首
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setQrLoginOpen(true)}
                className="flex w-full items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white/50 py-10 text-[13px] text-stone-400"
              >
                {neteaseBound && profileLoading ? '正在同步音乐库…' : '登录网易云后查看我的音乐库'}
              </button>
            )}
          </section>

          {neteaseBound && neteaseProfile && neteaseProfile.savedPlaylists.length > 0 ? (
            <section>
              <h2 className="mb-3 text-[15px] font-semibold tracking-tight text-stone-700">
                收藏的歌单
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {neteaseProfile.savedPlaylists.slice(0, 4).map((pl: NeteasePlaylistItem) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() =>
                      openPlaylistDetail({
                        id: pl.id,
                        title: pl.title,
                        cover: pl.cover,
                        count: pl.count,
                      })
                    }
                    className="overflow-hidden rounded-2xl bg-white/50 text-left shadow-sm ring-1 ring-white transition-transform active:scale-[0.98]"
                  >
                    <div className="relative aspect-square overflow-hidden bg-stone-100">
                      {pl.cover ? (
                        <img src={pl.cover} alt="" className="h-full w-full object-cover" />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-80" />
                    </div>
                    <p className="line-clamp-2 px-2.5 py-2 text-[12px] leading-snug text-stone-700">
                      {pl.title}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </main>
        ) : null}

      </div>

      <AnimatePresence>
        {openPlaylist ? (
          <motion.div
            key="playlist-detail"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[28] mx-auto max-w-[560px] bg-stone-50"
            style={{
              paddingBottom: overlayBottomInset,
            }}
          >
            <ListenTogetherPlaylistDetailPage
              playlist={openPlaylist}
              cookie={neteaseCookie ?? ''}
              onBack={() => setOpenPlaylist(null)}
              onPlaySong={(s, queueTracks) =>
                void playSongWithContext(s, queueTracks, openPlaylist.id)
              }
              playingSongId={playingSongId}
              isPlaying={isPlaying}
              className="h-full"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {playError ? (
        <div
          className="fixed left-0 right-0 z-[35] mx-auto max-w-[560px] px-4"
          style={{
            bottom: hideTabBar
              ? `calc(${MINI_PLAYER_H}px + env(safe-area-inset-bottom, 0px) + 8px)`
              : `calc(${BOTTOM_STACK}px + env(safe-area-inset-bottom, 0px) + 8px)`,
          }}
        >
          <button
            type="button"
            onClick={clearPlayError}
            className="w-full rounded-xl bg-rose-50 px-3 py-2 text-center text-[12px] text-rose-500 ring-1 ring-rose-100"
          >
            {playError}
          </button>
        </div>
      ) : null}

      {/* —— Mini player (above tab bar) —— */}
      <div
        role="button"
        tabIndex={0}
        onClick={openFullScreen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openFullScreen()
          }
        }}
        className="fixed left-0 right-0 z-30 mx-auto max-w-[560px] cursor-pointer border-t border-stone-100/50 bg-white/80 shadow-lg backdrop-blur-md"
        style={{
          bottom: miniPlayerBottom,
          height: MINI_PLAYER_H,
        }}
        aria-label="打开全屏播放器"
      >
        <div
          className="absolute inset-x-0 top-0 h-0.5 bg-stone-100"
          aria-hidden
        >
          <div
            className="h-full bg-rose-300 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex h-full items-center gap-3 px-4 pt-0.5">
          <SpinningCover src={song.cover || undefined} playing={isPlaying} />
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-[14px] font-medium text-stone-800">{song.title}</p>
            <p className="truncate text-[12px] text-stone-400">{song.artist}</p>
          </div>
          <button
            type="button"
            aria-label={isPlaying ? '暂停' : '播放'}
            onClick={(e) => {
              e.stopPropagation()
              togglePlay()
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rose-400 transition-colors hover:bg-rose-50/80"
          >
            {isPlaying ? (
              <Pause className="size-5 fill-current" strokeWidth={0} />
            ) : (
              <Play className="size-5 fill-current" strokeWidth={0} />
            )}
          </button>
        </div>
      </div>

      {/* —— Bottom tab bar（歌单详情页隐藏，仅保留迷你播放器）—— */}
      <AnimatePresence>
        {!hideTabBar ? (
          <motion.nav
            key="listen-tab-bar"
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-[560px] border-t border-stone-100 bg-white shadow-[0_-1px_0_rgba(0,0,0,0.03)]"
            style={{
              height: `calc(${TAB_BAR_H}px + env(safe-area-inset-bottom, 0px))`,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
            aria-label="主导航"
          >
            <div className="flex h-[56px] items-center justify-around px-2">
              {(
                [
                  { id: 'home' as const, label: '首页', Icon: Home },
                  { id: 'search' as const, label: '搜索', Icon: Search },
                  { id: 'notes' as const, label: '笔记', Icon: StickyNote },
                  { id: 'me' as const, label: '我的', Icon: User },
                ]
              ).map(({ id, label, Icon }) => {
                const active = activeTab === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors ${
                      active ? 'text-rose-400' : 'text-stone-400'
                    }`}
                  >
                    <Icon className="size-[22px]" strokeWidth={active ? 2 : 1.5} />
                    <span className="text-[10px] font-medium">{label}</span>
                  </button>
                )
              })}
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>

      {/* —— Full screen player（关闭时卸载，减轻手机 WebView 内存压力）—— */}
      {isFullScreen ? (
      <ListenTogetherFullscreenPlayer
        open
        onClose={closeFullScreen}
        song={{
          title: song.title,
          artist: song.artist,
          cover: song.cover,
        }}
        lyricLines={lyrics}
        activeLyricIndex={lyricIndex}
        durationMs={durationMs}
        progress={fullscreenProgress}
        isPlaying={isPlaying}
        liked={currentSongLiked}
        likeBusy={Boolean(song.songId && likingSongId === song.songId)}
        onTogglePlay={togglePlay}
        onToggleLike={
          neteaseBound && song.songId && song.title !== '暂无播放'
            ? () => {
                void toggleNeteaseSongLike(song.songId!)
              }
            : undefined
        }
        onOpenComments={
          song.songId && song.title !== '暂无播放' ? openCommentsForNowPlaying : undefined
        }
        playMode={playMode}
        canUseHeartMode={canUseHeartMode}
        onCyclePlayMode={cyclePlayMode}
        onPrev={() => void playPrev()}
        onNext={() => void playNext()}
        onSeek={seekTo}
        onSeekToTimeMs={seekToTimeMs}
      />
      ) : null}

      <ListenTogetherSongCommentsPage
        open={commentsSong !== null}
        song={commentsSong}
        cookie={neteaseCookie}
        onBack={closeComments}
      />

      <NeteaseQrLoginModal
        open={qrLoginOpen}
        onClose={() => setQrLoginOpen(false)}
        onSuccess={() => {
          void hydrateNeteaseLoginCookie().then((cookie) => {
            setNeteaseCookie(cookie)
            setQrLoginOpen(false)
            void refetchProfile({ force: true })
            void reloadLikedIds()
          })
        }}
      />
    </div>
  )
}
