import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { Loader2, Search, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import {
  SEARCH_EXPLORE_MOCK,
  type FrequencyTicket,
  type VibeCategory,
} from './listenTogetherSearchMock'
import { ListenTogetherHeaderRefreshButton } from './ListenTogetherHeaderRefreshButton'
import { ListenNum, ListenNumericText } from './ListenNum'
import {
  getCachedSearchResult,
  saveCachedSearchResult,
  type SearchResultTab as CachedSearchTab,
} from './listenTogetherPageCache'
import {
  searchNeteaseAll,
  searchNeteaseArtists,
  searchNeteasePlaylists,
  searchNeteaseSongs,
  type NeteaseArtistItem,
  type NeteasePlaylistItem,
  type NeteaseSearchBundle,
  type NeteaseSongItem,
} from './neteaseMusicApi'
import type { NeteaseToplistChart } from './neteaseToplistApi'
import { useFeaturedArtists } from './useFeaturedArtists'

const EMPTY_SEARCH: NeteaseSearchBundle = { songs: [], artists: [], playlists: [] }

type SearchResultTab = 'all' | 'songs' | 'playlists' | 'artists'

const SEARCH_RESULT_TABS: { id: SearchResultTab; label: string }[] = [
  { id: 'all', label: '综合' },
  { id: 'songs', label: '单曲' },
  { id: 'playlists', label: '歌单' },
  { id: 'artists', label: '歌手' },
]

const COVER_SHADOW = 'shadow-[0_10px_30px_rgba(225,29,72,0.08)]'
const ARTIST_SHADOW = 'shadow-[0_8px_20px_rgba(225,29,72,0.06)]'
const H_SCROLL =
  'flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'

const pageVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const riseVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

export type MusicSearchPageProps = {
  className?: string
  neteaseCookie?: string
  sessionActive?: boolean
  onRequireLogin?: () => void
  onPlaySong?: (song: NeteaseSongItem, queue: NeteaseSongItem[]) => void
  onOpenPlaylist?: (playlist: { id: number; title: string; cover: string; count: number }) => void
  onOpenArtist?: (artist: NeteaseArtistItem) => void
  onOpenToplistChart?: (chart: NeteaseToplistChart) => void
  toplistCharts?: NeteaseToplistChart[]
  toplistLoading?: boolean
  onRefreshToplists?: () => void | Promise<void>
}

function SectionHeader({
  title,
  subtitle,
  en,
}: {
  title: string
  subtitle?: string
  en?: string
}) {
  return (
    <div className="mb-4 px-0.5">
      {en ? (
        <p className="text-[9px] font-medium uppercase tracking-[0.32em] text-rose-300/90">{en}</p>
      ) : null}
      <h2 className="font-serif text-[17px] font-medium tracking-tight text-[#2D2422]">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-[12px] italic leading-relaxed text-rose-300/90">{subtitle}</p>
      ) : null}
    </div>
  )
}

function SearchResultTabs({
  active,
  onChange,
}: {
  active: SearchResultTab
  onChange: (tab: SearchResultTab) => void
}) {
  return (
    <div className="mb-4 flex items-center gap-5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {SEARCH_RESULT_TABS.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative shrink-0 pb-1.5 text-[14px] font-medium transition-colors ${
              isActive ? 'text-[#2D2422]' : 'text-rose-300/90'
            }`}
          >
            {tab.label}
            {isActive ? (
              <motion.span
                layoutId="search-result-tab"
                className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full bg-rose-300"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function SearchResultRow({
  song,
  onPlay,
}: {
  song: NeteaseSongItem
  onPlay: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className={`flex w-full items-center gap-3 rounded-[20px] p-2.5 text-left ${COVER_SHADOW} active:scale-[0.99]`}
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-rose-50/80">
        {song.cover ? (
          <img
            src={song.cover}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-[#2D2422]">{song.name}</p>
        <p className="truncate text-[12px] text-rose-300/90">{song.artist}</p>
      </div>
    </button>
  )
}

function PlaylistResultRow({
  playlist,
  onOpen,
}: {
  playlist: NeteasePlaylistItem
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 rounded-[20px] p-2.5 text-left ${COVER_SHADOW} active:scale-[0.99]`}
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-rose-50/80">
        {playlist.cover ? (
          <img
            src={playlist.cover}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-[#2D2422]">{playlist.name}</p>
        <p className="truncate text-[12px] text-rose-300/90">
          {playlist.creator} · <ListenNum>{playlist.trackCount}</ListenNum> 首
        </p>
      </div>
    </button>
  )
}

function ArtistResultRow({
  artist,
  onTap,
}: {
  artist: NeteaseArtistItem
  onTap: () => void
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`flex w-full items-center gap-3 rounded-[20px] p-2.5 text-left ${COVER_SHADOW} active:scale-[0.99]`}
    >
      <div
        className={`h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-white/80 ${ARTIST_SHADOW}`}
      >
        {artist.avatar ? (
          <img
            src={artist.avatar}
            alt={artist.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-100 to-[#F5E6E8] font-serif text-[16px] text-rose-300/80">
            {artist.name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-[#2D2422]">{artist.name}</p>
        <p className="truncate text-[12px] text-rose-300/90">歌手</p>
      </div>
    </button>
  )
}

function CompactSectionHeader({
  title,
  onMore,
}: {
  title: string
  onMore?: () => void
}) {
  return (
    <div className="mb-2 flex items-center justify-between px-0.5">
      <p className="text-[13px] font-medium text-[#2D2422]/80">{title}</p>
      {onMore ? (
        <button type="button" onClick={onMore} className="text-[11px] text-rose-300/90">
          更多
        </button>
      ) : null}
    </div>
  )
}

export function MusicSearchPage({
  className = '',
  neteaseCookie = '',
  sessionActive = false,
  onRequireLogin,
  onPlaySong,
  onOpenPlaylist,
  onOpenArtist,
  onOpenToplistChart,
  toplistCharts = [],
  toplistLoading = false,
  onRefreshToplists,
}: MusicSearchPageProps) {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NeteaseSearchBundle>(EMPTY_SEARCH)
  const [searchTab, setSearchTab] = useState<SearchResultTab>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [tuningLabel, setTuningLabel] = useState<string | null>(null)
  const [pageRefreshing, setPageRefreshing] = useState(false)
  const {
    artists: featuredArtists,
    loading: artistsLoading,
    refetch: refetchFeaturedArtists,
  } = useFeaturedArtists(neteaseCookie)

  const hasSearchResults = useMemo(
    () =>
      searchResults.songs.length > 0 ||
      searchResults.artists.length > 0 ||
      searchResults.playlists.length > 0,
    [searchResults],
  )

  const runSearch = useCallback(
    async (text: string, force = false) => {
      const q = text.trim()
      if (!q) return
      if (!sessionActive) {
        onRequireLogin?.()
        return
      }
      setLoading(true)
      setError(null)
      setSearched(true)
      setSearchTab('all')
      try {
        if (!force) {
          const cached = await getCachedSearchResult(q, 'all')
          if (cached) {
            setSearchResults(cached)
            if (
              cached.songs.length === 0 &&
              cached.artists.length === 0 &&
              cached.playlists.length === 0
            ) {
              setError('未找到相关内容')
            }
            return
          }
        }
        const bundle = await searchNeteaseAll(neteaseCookie, q, 24)
        setSearchResults(bundle)
        if (
          bundle.songs.length === 0 &&
          bundle.artists.length === 0 &&
          bundle.playlists.length === 0
        ) {
          setError('未找到相关内容')
        } else {
          await saveCachedSearchResult(q, 'all', bundle)
        }
      } catch (e) {
        setSearchResults(EMPTY_SEARCH)
        setError(e instanceof Error ? e.message : '搜索失败')
      } finally {
        setLoading(false)
      }
    },
    [neteaseCookie, sessionActive, onRequireLogin],
  )

  const loadSearchTab = useCallback(
    async (tab: CachedSearchTab, keywords: string, force = false) => {
      const q = keywords.trim()
      if (!q || !sessionActive) return
      setLoading(true)
      setError(null)
      try {
        if (!force) {
          const cached = await getCachedSearchResult(q, tab)
          if (cached) {
            setSearchResults((prev) => ({
              songs: tab === 'songs' ? cached.songs : prev.songs,
              artists: tab === 'artists' ? cached.artists : prev.artists,
              playlists: tab === 'playlists' ? cached.playlists : prev.playlists,
            }))
            const empty =
              (tab === 'songs' && cached.songs.length === 0) ||
              (tab === 'playlists' && cached.playlists.length === 0) ||
              (tab === 'artists' && cached.artists.length === 0)
            if (empty) {
              setError(
                tab === 'songs'
                  ? '未找到相关单曲'
                  : tab === 'playlists'
                    ? '未找到相关歌单'
                    : '未找到相关歌手',
              )
            }
            return
          }
        }
        if (tab === 'songs') {
          const songs = await searchNeteaseSongs(neteaseCookie, q, 30)
          setSearchResults((prev) => {
            const next = { ...prev, songs }
            void saveCachedSearchResult(q, tab, next)
            return next
          })
          if (songs.length === 0) setError('未找到相关单曲')
        } else if (tab === 'playlists') {
          const playlists = await searchNeteasePlaylists(neteaseCookie, q, 30)
          setSearchResults((prev) => {
            const next = { ...prev, playlists }
            void saveCachedSearchResult(q, tab, next)
            return next
          })
          if (playlists.length === 0) setError('未找到相关歌单')
        } else if (tab === 'artists') {
          const artists = await searchNeteaseArtists(neteaseCookie, q, 30)
          setSearchResults((prev) => {
            const next = { ...prev, artists }
            void saveCachedSearchResult(q, tab, next)
            return next
          })
          if (artists.length === 0) setError('未找到相关歌手')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        setLoading(false)
      }
    },
    [neteaseCookie, sessionActive],
  )

  const handleSearchTabChange = useCallback(
    (tab: SearchResultTab) => {
      setSearchTab(tab)
      setError(null)
      if (tab !== 'all') {
        void loadSearchTab(tab, query)
      }
    },
    [loadSearchTab, query],
  )

  const submitSearch = useCallback(() => {
    void runSearch(query)
  }, [query, runSearch])

  const handlePageRefresh = useCallback(async () => {
    if (!sessionActive) {
      onRequireLogin?.()
      return
    }
    setPageRefreshing(true)
    try {
      if (searched && query.trim()) {
        if (searchTab === 'all') {
          await runSearch(query, true)
        } else {
          await loadSearchTab(searchTab, query, true)
        }
      } else {
        await Promise.all([refetchFeaturedArtists(true), onRefreshToplists?.()])
      }
    } finally {
      setPageRefreshing(false)
    }
  }, [
    sessionActive,
    onRequireLogin,
    searched,
    query,
    searchTab,
    runSearch,
    loadSearchTab,
    refetchFeaturedArtists,
    onRefreshToplists,
  ])

  const handleRandomPlay = useCallback(
    async (ticket: FrequencyTicket) => {
      if (!sessionActive) {
        onRequireLogin?.()
        return
      }
      setTuningLabel(ticket.label)
      window.setTimeout(() => setTuningLabel(null), 1600)
      setLoading(true)
      setError(null)
      try {
        const songs = await searchNeteaseSongs(neteaseCookie, ticket.searchQuery, 30)
        if (songs.length === 0) {
          setError('该频段暂无可用曲目')
          return
        }
        const pick = songs[Math.floor(Math.random() * Math.min(songs.length, 12))]
        onPlaySong?.(pick, songs)
      } catch (e) {
        setError(e instanceof Error ? e.message : '调频失败')
      } finally {
        setLoading(false)
      }
    },
    [sessionActive, onRequireLogin, neteaseCookie, onPlaySong],
  )

  const onArtistTap = useCallback(
    (artist: NeteaseArtistItem) => {
      if (onOpenArtist) {
        onOpenArtist(artist)
        return
      }
      setQuery(artist.name)
      void runSearch(artist.name)
    },
    [onOpenArtist, runSearch],
  )

  const onGenreTap = useCallback(
    (cat: VibeCategory) => {
      void handleRandomPlay({
        id: cat.id,
        emoji: '✦',
        label: cat.title,
        searchQuery: cat.title.replace(/\s+/g, ' '),
      })
    },
    [handleRandomPlay],
  )

  const openPlaylist = useCallback(
    (playlist: NeteasePlaylistItem) => {
      onOpenPlaylist?.({
        id: playlist.id,
        title: playlist.name,
        cover: playlist.cover,
        count: playlist.trackCount,
      })
    },
    [onOpenPlaylist],
  )

  const renderSearchResults = () => {
    const { songs, artists, playlists } = searchResults

    if (searchTab === 'songs') {
      if (songs.length === 0) {
        return <p className="py-6 text-center text-[13px] text-stone-400">未找到相关单曲</p>
      }
      return (
        <div className="space-y-2">
          {songs.map((song) => (
            <SearchResultRow
              key={song.id}
              song={song}
              onPlay={() => onPlaySong?.(song, songs)}
            />
          ))}
        </div>
      )
    }

    if (searchTab === 'playlists') {
      if (playlists.length === 0) {
        return <p className="py-6 text-center text-[13px] text-stone-400">未找到相关歌单</p>
      }
      return (
        <div className="space-y-2">
          {playlists.map((playlist) => (
            <PlaylistResultRow
              key={playlist.id}
              playlist={playlist}
              onOpen={() => openPlaylist(playlist)}
            />
          ))}
        </div>
      )
    }

    if (searchTab === 'artists') {
      if (artists.length === 0) {
        return <p className="py-6 text-center text-[13px] text-stone-400">未找到相关歌手</p>
      }
      return (
        <div className="space-y-2">
          {artists.map((artist) => (
            <ArtistResultRow key={artist.id} artist={artist} onTap={() => onArtistTap(artist)} />
          ))}
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {songs.length > 0 ? (
          <div>
            <CompactSectionHeader title="单曲" onMore={() => handleSearchTabChange('songs')} />
            <div className="space-y-2">
              {songs.slice(0, 5).map((song) => (
                <SearchResultRow
                  key={song.id}
                  song={song}
                  onPlay={() => onPlaySong?.(song, songs)}
                />
              ))}
            </div>
          </div>
        ) : null}
        {artists.length > 0 ? (
          <div>
            <CompactSectionHeader title="歌手" onMore={() => handleSearchTabChange('artists')} />
            <div className="space-y-2">
              {artists.slice(0, 4).map((artist) => (
                <ArtistResultRow
                  key={artist.id}
                  artist={artist}
                  onTap={() => onArtistTap(artist)}
                />
              ))}
            </div>
          </div>
        ) : null}
        {playlists.length > 0 ? (
          <div>
            <CompactSectionHeader title="歌单" onMore={() => handleSearchTabChange('playlists')} />
            <div className="space-y-2">
              {playlists.slice(0, 4).map((playlist) => (
                <PlaylistResultRow
                  key={playlist.id}
                  playlist={playlist}
                  onOpen={() => openPlaylist(playlist)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  const showCurated = !searched

  return (
    <div className={`relative min-h-full text-[#2D2422] ${className}`}>
      {/* 调频闪字 */}
      <AnimatePresence>
        {tuningLabel ? (
          <motion.div
            key={tuningLabel}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="pointer-events-none fixed inset-x-0 top-[38%] z-50 flex justify-center px-6"
          >
            <p className="text-center font-serif text-[15px] italic text-[#2D2422]/85">
              Tuning to {tuningLabel} frequency…
              <br />
              <span className="text-[13px] text-rose-300">正在调频至「{tuningLabel}」</span>
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 搜索中枢 */}
      <div className="sticky top-0 z-20 border-b border-white/40 bg-white/45 px-4 pb-4 pt-[max(10px,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="mb-3 flex items-center justify-end">
          <ListenTogetherHeaderRefreshButton
            variant="rose"
            loading={pageRefreshing || loading}
            onClick={() => void handlePageRefresh()}
          />
        </div>
        <label className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-4 size-[17px] text-rose-300"
            strokeWidth={1.35}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              const next = e.target.value
              setQuery(next)
              if (!next.trim()) {
                setSearched(false)
                setSearchResults(EMPTY_SEARCH)
                setError(null)
                setSearchTab('all')
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitSearch()
            }}
            placeholder="搜索歌手、歌曲或沉浸情绪..."
            className="h-12 w-full rounded-[20px] border-0 bg-gray-50/50 pl-11 pr-11 text-[14px] text-[#2D2422] shadow-[inset_0_1px_4px_rgba(45,36,34,0.04)] outline-none ring-0 placeholder:italic placeholder:text-rose-300/70 focus:shadow-[inset_0_1px_4px_rgba(225,29,72,0.06),0_8px_24px_rgba(225,29,72,0.06)]"
            aria-label="搜索音乐"
          />
          {query ? (
            <button
              type="button"
              aria-label="清空搜索"
              onClick={() => {
                setQuery('')
                setSearched(false)
                setSearchResults(EMPTY_SEARCH)
                setError(null)
                setSearchTab('all')
              }}
              className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-full text-rose-300/80 transition-colors hover:bg-rose-50 hover:text-rose-400"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          ) : null}
        </label>
      </div>

      <motion.div
        className="px-4 pb-44 pt-2"
        variants={pageVariants}
        initial="hidden"
        animate="show"
      >
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-6 text-[13px] text-rose-300">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            检索中…
          </p>
        ) : null}

        {error ? <p className="py-3 text-center text-[13px] text-rose-400/90">{error}</p> : null}

        {searched ? (
          <motion.section variants={riseVariants} className="mb-8" aria-label="搜索结果">
            <SectionHeader title="检索结果" en="Search Results" />
            <SearchResultTabs active={searchTab} onChange={handleSearchTabChange} />
            {!loading && !hasSearchResults && !error ? (
              <p className="py-6 text-center text-[13px] text-stone-400">未找到相关内容</p>
            ) : (
              renderSearchResults()
            )}
          </motion.section>
        ) : null}

        {showCurated ? (
          <>
            {/* Block A — 歌手档案 */}
            <motion.section variants={riseVariants} className="mb-10" aria-label="歌手档案">
              <SectionHeader title="歌手档案" en="Featured Artists" subtitle="人物呼吸，声线入梦" />
              {artistsLoading && featuredArtists.length === 0 ? (
                <p className="flex items-center gap-2 py-4 text-[13px] text-rose-300">
                  <Loader2 className="size-4 animate-spin" />
                  加载歌手…
                </p>
              ) : (
                <div className={H_SCROLL}>
                  {featuredArtists.map((artist) => (
                    <button
                      key={artist.id}
                      type="button"
                      onClick={() => onArtistTap(artist)}
                      className="flex w-[88px] shrink-0 snap-center flex-col items-center gap-2.5"
                    >
                      <div
                        className={`h-20 w-20 overflow-hidden rounded-full ring-2 ring-white/80 ${ARTIST_SHADOW}`}
                      >
                        {artist.avatar ? (
                          <img
                            src={artist.avatar}
                            alt={artist.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-100 to-[#F5E6E8] font-serif text-[18px] text-rose-300/80">
                            {artist.name.slice(0, 1)}
                          </div>
                        )}
                      </div>
                      <span className="max-w-[88px] truncate font-serif text-[12px] tracking-[0.12em] text-[#2D2422]/90">
                        {artist.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </motion.section>

            {/* Block B — 留声排行榜 */}
            <motion.section variants={riseVariants} className="mb-10" aria-label="留声排行榜">
              <SectionHeader title="留声排行榜" en="Top Charts" subtitle="官方榜单，杂志排版" />
              {toplistLoading && toplistCharts.length === 0 ? (
                <p className="flex items-center gap-2 py-4 text-[13px] text-rose-300">
                  <Loader2 className="size-4 animate-spin" />
                  加载排行榜…
                </p>
              ) : (
                <div className="space-y-4">
                  {toplistCharts.map((chart, index) => {
                    const rank = String(index + 1).padStart(2, '0')
                    return (
                      <button
                        key={chart.id}
                        type="button"
                        onClick={() => onOpenToplistChart?.(chart)}
                        className="relative flex w-full items-center gap-3 py-1 text-left"
                      >
                        <ListenNum
                          className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-[56px] leading-none text-rose-900/5 select-none"
                          aria-hidden
                        >
                          {rank}
                        </ListenNum>
                        <div
                          className={`relative z-[1] ml-5 h-[64px] w-[64px] shrink-0 overflow-hidden rounded-[16px] ${COVER_SHADOW}`}
                        >
                          {chart.cover ? (
                            <img
                              src={chart.cover}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-rose-100 to-[#F5E6E8]" />
                          )}
                        </div>
                        <div className="relative z-[1] min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-[#2D2422]">
                            {chart.name}
                          </p>
                          <div className="mt-1 space-y-0.5">
                            {chart.songs.slice(0, 3).map((s, i) => (
                              <p
                                key={`${chart.id}-top-${s.id}`}
                                className="truncate text-[10px] font-extralight text-[#2D2422]/45"
                              >
                                <ListenNumericText text={`${i + 1}. ${s.name} — ${s.artist}`} />
                              </p>
                            ))}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </motion.section>

            {/* Block C — 曲风与情绪 */}
            <motion.section variants={riseVariants} className="mb-10" aria-label="曲风与情绪">
              <SectionHeader title="曲风与情绪" en="Genre & Mood" />
              <div className="grid grid-cols-2 gap-3 auto-rows-[minmax(140px,auto)]">
                {SEARCH_EXPLORE_MOCK.categories.map((cat, i) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onGenreTap(cat)}
                    className={`group relative overflow-hidden rounded-[22px] text-left ${COVER_SHADOW} ${
                      i % 3 === 0 ? 'col-span-2 aspect-[2.2/1]' : 'aspect-[4/5]'
                    }`}
                  >
                    <img
                      src={cat.cover}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-active:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#2D2422]/80 via-[#2D2422]/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3.5">
                      <p className="text-[9px] font-medium uppercase tracking-[0.28em] text-white/55">
                        {cat.subtitle}
                      </p>
                      <p className="mt-1 font-serif text-[16px] text-white/95">{cat.title}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.section>

            {/* Block D — 频段漫游 */}
            <motion.section variants={riseVariants} aria-label="频段漫游">
              <SectionHeader title="频段漫游" en="Frequency Wandering" />
              <div className={H_SCROLL}>
                {SEARCH_EXPLORE_MOCK.frequencyTickets.map((ticket) => (
                  <motion.button
                    key={ticket.id}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => void handleRandomPlay(ticket)}
                    className={`relative flex w-[168px] shrink-0 snap-start items-center gap-3 rounded-[18px] bg-white/90 py-3.5 pl-4 pr-3 text-left ${COVER_SHADOW}`}
                  >
                    <span
                      className="absolute bottom-2 left-0 top-2 w-px border-l border-dashed border-rose-200/80"
                      aria-hidden
                    />
                    <span className="pl-2 text-[20px]" aria-hidden>
                      {ticket.emoji}
                    </span>
                    <span className="text-[13px] font-medium tracking-wide text-[#2D2422]/85">
                      {ticket.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.section>
          </>
        ) : null}
      </motion.div>
    </div>
  )
}
