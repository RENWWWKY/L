import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Home,
  Search,
  Smartphone,
  StickyNote,
  User,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { MusicDiscoveryPage } from './MusicDiscoveryPage'
import { buildMusicDiscoveryModel } from './musicDiscoveryModel'
import { ListenTogetherNotesFeedPage } from './ListenTogetherNotesFeedPage'
import {
  ListenTogetherPlaylistDetailPage,
  type PlaylistDetailInfo,
} from './ListenTogetherPlaylistDetailPage'
import {
  ListenTogetherArtistDetailPage,
  type ArtistDetailInfo,
} from './ListenTogetherArtistDetailPage'
import { ListenTogetherUserProfilePage } from './ListenTogetherUserProfilePage'
import type { UserDetailInfo } from './listenTogetherProfileTypes'
import { ListenTogetherSongCommentsPage } from './ListenTogetherSongCommentsPage'
import type { ListenCommentAuthor } from './ListenCommentComposer'
import { ListenTogetherProfilePage } from './ListenTogetherProfilePage'
import { NeteaseQrLoginModal } from './NeteaseQrLoginModal'
import { MusicSearchPage } from './MusicSearchPage'
import { hydrateNeteaseLoginCookie, loadNeteaseCookie } from './neteaseApiClient'
import {
  applyNeteaseAccountLogin,
  clearNeteaseListenSession,
  enterGuestListenMode,
  hydrateNeteaseListenSession,
} from './neteaseListenSession'
import {
  clearListenTogetherSyncCaches,
  hydrateListenTogetherDataCaches,
} from './listenTogetherPersistence'
import { hydrateListenTogetherPageCaches } from './listenTogetherPageCache'
import { ListenTogetherPageBackground } from './listenTogetherPageBg'
import { ListenTogetherHeaderRefreshButton } from './ListenTogetherHeaderRefreshButton'
import { useListenTogetherPlayer } from './useListenTogetherPlayer'
import { useMusicStore } from '../../stores/useMusicStore'
import { useNeteaseHomeFeed } from './useNeteaseHomeFeed'
import { useNeteaseToplists } from './useNeteaseToplists'
import { toplistChartAsPlaylist, type NeteaseToplistChart } from './neteaseToplistApi'
import { useNeteaseLikedSongs } from './useNeteaseLikedSongs'
import { useNeteaseProfile } from './useNeteaseProfile'
import type { NeteaseArtistItem, NeteaseSongItem } from './neteaseMusicApi'

import { ListenTogetherMiniPlayerBar, LISTEN_MINI_PLAYER_H, LISTEN_TAB_BAR_H, listenOverlayBottomInset } from './ListenTogetherMiniPlayerBar'

const BOTTOM_STACK = LISTEN_TAB_BAR_H + LISTEN_MINI_PLAYER_H

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

export function DiscoverListenTogetherApp({
  onBack,
  className = '',
}: DiscoverListenTogetherAppProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'notes' | 'me'>('home')
  const openListenFullscreen = useMusicStore((s) => s.openListenFullscreen)
  const {
    nowPlaying: song,
    isPlaying,
    progress,
    playError,
    playSong,
    playAttachedMusic,
    togglePlay,
    startHeartModePlayback,
    clearPlayError,
  } = useListenTogetherPlayer()
  const [neteaseCookie, setNeteaseCookie] = useState(() => loadNeteaseCookie())
  const [isGuestMode, setIsGuestMode] = useState(false)
  const [cookieReady, setCookieReady] = useState(false)
  const [qrLoginOpen, setQrLoginOpen] = useState(false)
  const [openPlaylist, setOpenPlaylist] = useState<PlaylistDetailInfo | null>(null)
  const [openArtist, setOpenArtist] = useState<ArtistDetailInfo | null>(null)
  const [openUser, setOpenUser] = useState<UserDetailInfo | null>(null)
  const [commentsSong, setCommentsSong] = useState<NeteaseSongItem | null>(null)
  const [syncingNetease, setSyncingNetease] = useState(false)
  const [dataSyncVersion, setDataSyncVersion] = useState(0)
  const [homeRefreshing, setHomeRefreshing] = useState(false)
  const [notesFeedKey, setNotesFeedKey] = useState(0)
  const setInsideListenTogether = useMusicStore((s) => s.setInsideListenTogether)
  const neteaseLoggedIn = Boolean(neteaseCookie)
  const listenSessionActive = neteaseLoggedIn || isGuestMode
  const {
    data: neteaseProfile,
    loading: profileLoading,
    error: profileError,
    fromCache: profileFromCache,
    refetch: refetchProfile,
  } = useNeteaseProfile(neteaseCookie, cookieReady && neteaseLoggedIn)

  const commentAuthor = useMemo((): ListenCommentAuthor | undefined => {
    const user = neteaseProfile?.user
    if (!user?.nickname) return undefined
    return {
      nickname: user.nickname,
      avatar: user.avatar,
      userId: user.userId,
    }
  }, [neteaseProfile?.user])

  const { reloadLikedIds } = useNeteaseLikedSongs(
    neteaseCookie,
    neteaseProfile?.user.userId,
    neteaseProfile?.likedSongs.id,
  )

  const {
    data: homeFeed,
    loading: homeFeedLoading,
    error: homeFeedError,
    refetch: refetchHomeFeed,
  } = useNeteaseHomeFeed(neteaseCookie, dataSyncVersion)

  const {
    charts: toplistCharts,
    loading: toplistLoading,
    error: toplistError,
    refetch: refetchToplists,
  } = useNeteaseToplists(neteaseCookie, dataSyncVersion)

  useEffect(() => {
    void Promise.all([hydrateListenTogetherDataCaches(), hydrateListenTogetherPageCaches()])
  }, [])

  useEffect(() => {
    void hydrateNeteaseListenSession().then((session) => {
      setNeteaseCookie(session.cookie)
      setIsGuestMode(session.isGuest)
      setCookieReady(true)
    })
  }, [])

  useEffect(() => {
    setInsideListenTogether(true)
    return () => setInsideListenTogether(false)
  }, [setInsideListenTogether])

  const handleEnterGuestMode = useCallback(async () => {
    const session = await enterGuestListenMode()
    setNeteaseCookie(session.cookie)
    setIsGuestMode(session.isGuest)
    setQrLoginOpen(false)
    setDataSyncVersion((v) => v + 1)
  }, [])

  const handleLeaveGuestMode = useCallback(async () => {
    const session = await clearNeteaseListenSession()
    setNeteaseCookie(session.cookie)
    setIsGuestMode(session.isGuest)
    setDataSyncVersion((v) => v + 1)
  }, [])

  const headerUser = neteaseProfile?.user ?? null

  const handleSyncNetease = useCallback(async () => {
    if (!neteaseCookie || syncingNetease) return
    setSyncingNetease(true)
    setOpenPlaylist(null)
    try {
      await clearListenTogetherSyncCaches()
      setDataSyncVersion((v) => v + 1)
      await Promise.all([
        refetchProfile({ force: true }),
        reloadLikedIds(),
        refetchHomeFeed(true),
        refetchToplists(true),
      ])
    } finally {
      setSyncingNetease(false)
    }
  }, [neteaseCookie, syncingNetease, refetchProfile, reloadLikedIds, refetchHomeFeed, refetchToplists])

  const handleHomeRefresh = useCallback(async () => {
    if (!listenSessionActive || homeRefreshing) return
    setHomeRefreshing(true)
    try {
      await Promise.all([
        refetchHomeFeed(true),
        refetchToplists(true),
        neteaseLoggedIn ? refetchProfile({ force: true }) : Promise.resolve(),
      ])
    } finally {
      setHomeRefreshing(false)
    }
  }, [
    listenSessionActive,
    homeRefreshing,
    refetchHomeFeed,
    refetchToplists,
    neteaseLoggedIn,
    refetchProfile,
  ])

  const likedPlaylistId = neteaseProfile?.likedSongs.id ?? 0

  const discoveryModel = useMemo(
    () => buildMusicDiscoveryModel(homeFeed, neteaseProfile),
    [homeFeed, neteaseProfile],
  )

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
      if (!listenSessionActive) {
        setQrLoginOpen(true)
        return
      }
      setOpenArtist(null)
      setOpenUser(null)
      setOpenPlaylist(info)
    },
    [listenSessionActive],
  )

  const openArtistDetail = useCallback(
    (artist: NeteaseArtistItem) => {
      if (!listenSessionActive) {
        setQrLoginOpen(true)
        return
      }
      setOpenPlaylist(null)
      setOpenUser(null)
      setOpenArtist({
        id: artist.id,
        name: artist.name,
        avatar: artist.avatar,
      })
    },
    [listenSessionActive],
  )

  const openUserProfile = useCallback(
    (user: UserDetailInfo) => {
      if (!listenSessionActive) {
        setQrLoginOpen(true)
        return
      }
      setOpenPlaylist(null)
      setOpenUser({
        userId: user.userId,
        nickname: user.nickname,
        avatar: user.avatar,
      })
    },
    [listenSessionActive],
  )

  const handleHeartModePlay = useCallback(() => {
    if (!listenSessionActive) {
      setQrLoginOpen(true)
      return
    }
    const seed =
      discoveryModel.daily.songs[0] ??
      discoveryModel.lovedSongs[0] ??
      toplistCharts[0]?.songs[0]
    if (!seed) return
    if (neteaseLoggedIn && likedPlaylistId) {
      void startHeartModePlayback(seed, likedPlaylistId)
    } else {
      const queue =
        discoveryModel.daily.songs.length > 0 ? discoveryModel.daily.songs : [seed]
      void playSongWithContext(seed, queue, 0)
    }
  }, [
    listenSessionActive,
    discoveryModel,
    neteaseLoggedIn,
    likedPlaylistId,
    startHeartModePlayback,
    playSongWithContext,
    toplistCharts,
  ])

  const handleOpenDaily = useCallback(() => {
    if (!listenSessionActive) {
      setQrLoginOpen(true)
      return
    }
    const songs = discoveryModel.daily.songs
    if (songs.length > 0) {
      void playSongWithContext(songs[0], songs, 0)
      return
    }
    if (neteaseProfile?.likedSongs.id) {
      openPlaylistDetail({
        id: neteaseProfile.likedSongs.id,
        title: neteaseProfile.likedSongs.title,
        cover: neteaseProfile.likedSongs.cover,
        count: neteaseProfile.likedSongs.count,
      })
    }
  }, [listenSessionActive, discoveryModel, playSongWithContext, neteaseProfile, openPlaylistDetail])

  const handleOpenRadar = useCallback(() => {
    if (!listenSessionActive) {
      setQrLoginOpen(true)
      return
    }
    const pl = discoveryModel.radar.playlist
    if (pl) {
      openPlaylistDetail({
        id: pl.id,
        title: pl.title,
        cover: pl.cover,
        count: pl.count,
      })
      return
    }
    const songs = discoveryModel.radar.songs
    if (songs[0]) void playSongWithContext(songs[0], songs, 0)
  }, [listenSessionActive, discoveryModel, openPlaylistDetail, playSongWithContext])

  const handleOpenToplistChart = useCallback(
    (chart: NeteaseToplistChart) => {
      if (!listenSessionActive) {
        setQrLoginOpen(true)
        return
      }
      const pl = toplistChartAsPlaylist(chart)
      openPlaylistDetail({
        id: pl.id,
        title: pl.title,
        cover: pl.cover,
        count: pl.count || chart.songs.length,
      })
    },
    [listenSessionActive, openPlaylistDetail],
  )

  const playingSongId = song.songId ?? null

  const openFullScreen = useCallback(() => {
    openListenFullscreen()
  }, [openListenFullscreen])

  const closeComments = useCallback(() => {
    setCommentsSong(null)
  }, [])

  const handleRequireLogin = useCallback(() => {
    setQrLoginOpen(true)
  }, [])

  const bottomPad = `calc(${BOTTOM_STACK}px + env(safe-area-inset-bottom, 0px) + 12px)`
  const hideTabBar = Boolean(openPlaylist || openArtist || openUser)
  const miniPlayerBottom = hideTabBar
    ? 'env(safe-area-inset-bottom, 0px)'
    : `calc(${LISTEN_TAB_BAR_H}px + env(safe-area-inset-bottom, 0px))`
  const overlayBottomInset = listenOverlayBottomInset()
  const isHome = activeTab === 'home'
  const isMe = activeTab === 'me'
  const isNotes = activeTab === 'notes'
  const isSearch = activeTab === 'search'
  const usePageImageBg = !isMe
  const hideUnderlyingPages = Boolean(openPlaylist || openArtist)

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col overflow-hidden ${
        isMe ? 'bg-stone-50 text-stone-800' : 'text-[#2D2422]'
      } ${className}`}
    >
      {usePageImageBg ? <ListenTogetherPageBackground /> : null}
      {/* —— Scroll area —— */}
      <div
        className={`relative z-[1] min-h-0 flex-1 overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
          hideUnderlyingPages ? 'hidden' : 'overflow-y-auto'
        }`}
        style={{ paddingBottom: isHome || isSearch ? bottomPad : undefined }}
        aria-hidden={hideUnderlyingPages}
      >
        {isMe ? (
          <ListenTogetherProfilePage
            onBack={onBack}
            neteaseBound={neteaseLoggedIn}
            isGuestMode={isGuestMode}
            onRequestLogin={handleRequireLogin}
            onLeaveGuest={() => void handleLeaveGuestMode()}
            neteaseProfile={neteaseProfile}
            profileLoading={neteaseLoggedIn && profileLoading}
            profileError={neteaseLoggedIn ? profileError : null}
            onOpenPlaylist={openPlaylistDetail}
            onPlayAttachedMusic={playAttachedMusic}
            profileFromCache={profileFromCache}
            onSyncNetease={() => void handleSyncNetease()}
            syncingNetease={syncingNetease}
            cookie={neteaseCookie ?? ''}
            onOpenArtist={openArtistDetail}
            onOpenUser={openUserProfile}
          />
        ) : null}

        {isNotes ? (
          <ListenTogetherNotesFeedPage
            key={notesFeedKey}
            onPlayAttachedMusic={playAttachedMusic}
            onRefresh={() => setNotesFeedKey((k) => k + 1)}
          />
        ) : null}

        {isSearch ? (
          <MusicSearchPage
            neteaseCookie={neteaseCookie}
            sessionActive={listenSessionActive}
            onRequireLogin={handleRequireLogin}
            onPlaySong={(s, queue) => void playSongWithContext(s, queue, 0)}
            onOpenPlaylist={(pl) =>
              openPlaylistDetail({
                id: pl.id,
                title: pl.title,
                cover: pl.cover,
                count: pl.count,
              })
            }
            onOpenArtist={openArtistDetail}
            onOpenToplistChart={handleOpenToplistChart}
            toplistCharts={toplistCharts}
            toplistLoading={toplistLoading}
            onRefreshToplists={() => refetchToplists(true)}
          />
        ) : null}

        {isHome ? (
        <header
          className="sticky top-0 z-10 flex items-center justify-between border-b border-white/40 bg-white/45 px-4 pb-3 pt-[max(10px,env(safe-area-inset-top))] backdrop-blur-md"
        >
          <div className="flex min-w-0 items-center gap-2">
            {onBack ? (
              <button
                type="button"
                aria-label="返回发现页"
                onClick={onBack}
                className="mr-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#2D2422]/70 transition-colors hover:bg-white/60"
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
              <p className="truncate text-[14px] font-medium text-[#2D2422]">
                {headerUser?.nickname ??
                  (isGuestMode
                    ? '游客'
                    : neteaseLoggedIn && profileLoading
                      ? '同步中…'
                      : '未登录')}
              </p>
              <div className="flex items-center gap-1">
                <NeteaseBadgeIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[10px] tracking-wide text-rose-300">
                  {neteaseLoggedIn
                    ? '已连接网易云'
                    : isGuestMode
                      ? '游客模式 · 可搜索播放'
                      : '登录或游客进入'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {listenSessionActive ? (
              <ListenTogetherHeaderRefreshButton
                variant="rose"
                loading={homeRefreshing || homeFeedLoading || toplistLoading}
                onClick={() => void handleHomeRefresh()}
              />
            ) : null}
            <button
              type="button"
              aria-label="登录或切换账号"
              onClick={() => setQrLoginOpen(true)}
              className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm transition-colors ${
                neteaseLoggedIn
                  ? 'border-rose-100 bg-rose-50/80 text-rose-400'
                  : isGuestMode
                    ? 'border-stone-200 bg-white/70 text-stone-500'
                    : 'border-white/80 bg-white/50 text-stone-500 hover:bg-white/80'
              }`}
            >
              <Smartphone className="size-[18px]" strokeWidth={1.5} />
            </button>
          </div>
        </header>
        ) : null}

        {isHome ? (
        <main className="px-4 pb-2">
          {!listenSessionActive ? (
            <section className="mb-6 px-1 py-6 text-center">
              <p className="font-serif text-[18px] font-medium text-[#2D2422]">开始听一听</p>
              <p className="mt-2 text-[12px] leading-relaxed text-rose-300/90">
                没有网易云账号也可以游客进入，搜索与播放公开歌曲
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleEnterGuestMode()}
                  className="rounded-full bg-[#2D2422] px-6 py-2.5 text-[13px] font-medium text-[#FFF5F7] shadow-[0_10px_30px_rgba(225,29,72,0.08)]"
                >
                  游客进入
                </button>
                <button
                  type="button"
                  onClick={() => setQrLoginOpen(true)}
                  className="rounded-full px-6 py-2.5 text-[13px] text-[#2D2422]/80 ring-1 ring-rose-200/60"
                >
                  登录网易云
                </button>
              </div>
            </section>
          ) : null}

          <MusicDiscoveryPage
            feed={homeFeed}
            profile={neteaseProfile}
            loading={homeFeedLoading}
            error={homeFeedError}
            onHeartModePlay={handleHeartModePlay}
            onOpenDaily={handleOpenDaily}
            onOpenRadar={handleOpenRadar}
            onPlaySong={(s, queue) => void playSongWithContext(s, queue, 0)}
            onOpenPlaylist={(pl) =>
              openPlaylistDetail({
                id: pl.id,
                title: pl.title,
                cover: pl.cover,
                count: pl.count,
              })
            }
            toplistCharts={toplistCharts}
            toplistLoading={toplistLoading}
            toplistError={toplistError}
            onOpenToplistChart={handleOpenToplistChart}
          />
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
            className="fixed inset-0 z-[28] mx-auto max-w-[560px] overflow-hidden"
          >
            <ListenTogetherPlaylistDetailPage
              playlist={openPlaylist}
              cookie={neteaseCookie ?? ''}
              neteaseUserId={neteaseProfile?.user.userId}
              commentAuthor={commentAuthor}
              onRequireLogin={handleRequireLogin}
              onPlaylistSubscribeChange={() => void refetchProfile({ force: true })}
              onBack={() => setOpenPlaylist(null)}
              onPlaySong={(s, queueTracks) =>
                void playSongWithContext(s, queueTracks, openPlaylist.id)
              }
              playingSongId={playingSongId}
              isPlaying={isPlaying}
              contentBottomInset={overlayBottomInset}
              className="h-full"
            />
          </motion.div>
        ) : null}
        {openArtist ? (
          <motion.div
            key="artist-detail"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[28] mx-auto max-w-[560px] overflow-hidden"
          >
            <ListenTogetherArtistDetailPage
              artist={openArtist}
              cookie={neteaseCookie ?? ''}
              sessionActive={listenSessionActive}
              commentAuthor={commentAuthor}
              onRequireLogin={handleRequireLogin}
              onBack={() => setOpenArtist(null)}
              onOpenArtist={openArtistDetail}
              onOpenUser={openUserProfile}
              onPlaySong={(s, queueTracks) => void playSongWithContext(s, queueTracks, 0)}
              playingSongId={playingSongId}
              isPlaying={isPlaying}
              contentBottomInset={overlayBottomInset}
              className="h-full"
            />
          </motion.div>
        ) : null}
        {openUser ? (
          <motion.div
            key={`user-profile-${openUser.userId}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[115] mx-auto max-w-[560px] overflow-hidden bg-stone-50"
          >
            <ListenTogetherUserProfilePage
              user={openUser}
              cookie={neteaseCookie ?? ''}
              sessionActive={listenSessionActive}
              onBack={() => setOpenUser(null)}
              onRequireLogin={handleRequireLogin}
              onOpenPlaylist={openPlaylistDetail}
              onOpenArtist={openArtistDetail}
              onOpenUser={openUserProfile}
              contentBottomInset={overlayBottomInset}
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
              ? `calc(${LISTEN_MINI_PLAYER_H}px + env(safe-area-inset-bottom, 0px) + 8px)`
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

      <ListenTogetherMiniPlayerBar
        title={song.title}
        artist={song.artist}
        cover={song.cover || undefined}
        progress={progress}
        isPlaying={isPlaying}
        bottom={miniPlayerBottom}
        onOpenFullscreen={openFullScreen}
        onTogglePlay={togglePlay}
      />

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
              height: `calc(${LISTEN_TAB_BAR_H}px + env(safe-area-inset-bottom, 0px))`,
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

      <ListenTogetherSongCommentsPage
        open={commentsSong !== null}
        song={commentsSong}
        cookie={neteaseCookie}
        author={commentAuthor}
        onBack={closeComments}
        onRequireLogin={handleRequireLogin}
      />

      <NeteaseQrLoginModal
        open={qrLoginOpen}
        onClose={() => setQrLoginOpen(false)}
        isGuestMode={isGuestMode}
        onGuestEnter={() => void handleEnterGuestMode()}
        onSuccess={() => {
          void (async () => {
            const cookie =
              loadNeteaseCookie().trim() || (await hydrateNeteaseLoginCookie()).trim()
            if (!cookie) return
            const session = await applyNeteaseAccountLogin(cookie)
            setNeteaseCookie(session.cookie)
            setIsGuestMode(session.isGuest)
            setQrLoginOpen(false)
            setDataSyncVersion((v) => v + 1)
            void refetchProfile({ force: true })
            void reloadLikedIds()
          })()
        }}
      />
    </div>
  )
}
