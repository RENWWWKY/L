import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  Loader2,
  MessageCircle,
  Music2,
  Pause,
  Play,
  User,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ListenTogetherSongCommentsPage } from './ListenTogetherSongCommentsPage'
import {
  ListenTogetherPlaylistDetailPage,
  type PlaylistDetailInfo,
} from './ListenTogetherPlaylistDetailPage'
import { ListenTogetherArtistNoteDetailPage } from './ListenTogetherArtistNoteDetailPage'
import { ListenTogetherHeaderRefreshButton } from './ListenTogetherHeaderRefreshButton'
import {
  ArtistNoteBody,
} from './artistNoteDisplay'
import { ListenNum } from './ListenNum'
import {
  getCachedArtistPage,
  saveCachedArtistPage,
  type CachedArtistPage,
} from './listenTogetherPageCache'
import { ListenTogetherPageBackground } from './listenTogetherPageBg'
import {
  fetchArtistAlbumsPage,
  fetchArtistDetail,
  fetchArtistNotes,
  fetchArtistPartners,
  fetchArtistSongsPage,
  fetchArtistTopSongs,
  type NeteaseAlbumItem,
  type NeteaseArtistDetail,
  type NeteaseArtistItem,
  type NeteaseArtistNote,
  type NeteaseSongItem,
} from './neteaseMusicApi'

export type ArtistDetailInfo = {
  id: number
  name: string
  avatar: string
}

type ArtistTab = 'home' | 'songs' | 'albums' | 'notes'

const ARTIST_TABS: { id: ArtistTab; label: string }[] = [
  { id: 'home', label: '主页' },
  { id: 'songs', label: '歌曲' },
  { id: 'albums', label: '专辑' },
  { id: 'notes', label: '笔记' },
]

const HOME_HOT_PREVIEW = 10

export type ListenTogetherArtistDetailPageProps = {
  artist: ArtistDetailInfo
  cookie: string
  sessionActive?: boolean
  onBack: () => void
  onRequireLogin?: () => void
  onOpenArtist?: (artist: NeteaseArtistItem) => void
  onPlaySong: (song: NeteaseSongItem, queueTracks: NeteaseSongItem[]) => void
  playingSongId?: number | null
  isPlaying?: boolean
  /** 为底部迷你播放器预留空间 */
  contentBottomInset?: string
  className?: string
}

type OpenNoteState = {
  note: NeteaseArtistNote
  scrollToComments: boolean
}

function formatAlbumDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function ArtistTabs({
  active,
  onChange,
}: {
  active: ArtistTab
  onChange: (tab: ArtistTab) => void
}) {
  return (
    <div className="flex items-center gap-5 overflow-x-auto px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {ARTIST_TABS.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative shrink-0 pb-1.5 text-[14px] font-medium transition-colors ${
              isActive ? 'text-stone-800' : 'text-stone-400'
            }`}
          >
            {tab.label}
            {isActive ? (
              <motion.span
                layoutId="artist-detail-tab"
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
      className={`flex w-full items-center gap-1 rounded-2xl pr-1 transition-colors duration-200 ${
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
          className={`flex h-6 w-6 shrink-0 items-center justify-center text-[12px] tabular-nums ${
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
            <img
              src={song.cover}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
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
            {song.name}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-stone-400">{song.artist}</p>
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

function PartnerChip({
  partner,
  onOpen,
}: {
  partner: NeteaseArtistItem
  onOpen?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 active:scale-[0.98]"
    >
      <div className="h-14 w-14 overflow-hidden rounded-full bg-stone-100 ring-2 ring-white shadow-sm">
        {partner.avatar ? (
          <img
            src={partner.avatar}
            alt={partner.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          <User className="m-auto size-6 text-stone-300" strokeWidth={1.5} aria-hidden />
        )}
      </div>
      <span className="line-clamp-2 w-full text-center text-[11px] text-stone-600">{partner.name}</span>
    </button>
  )
}

function AlbumCard({ album, onOpen }: { album: NeteaseAlbumItem; onOpen?: () => void }) {
  const inner = (
    <>
      <div className="aspect-square overflow-hidden bg-stone-100">
        {album.cover ? (
          <img
            src={album.cover}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <Music2 className="m-auto size-8 text-stone-300" strokeWidth={1.5} aria-hidden />
        )}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-[13px] font-medium text-stone-800">{album.name}</p>
        <p className="mt-1 text-[11px] text-stone-400">
          {formatAlbumDate(album.publishTime)}
          {album.trackCount > 0 ? (
            <>
              {' · '}
              <ListenNum>{album.trackCount}</ListenNum> 首
            </>
          ) : null}
        </p>
      </div>
    </>
  )

  if (!onOpen) {
    return <div className="overflow-hidden rounded-2xl bg-white/80 ring-1 ring-stone-100/90">{inner}</div>
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`打开专辑 ${album.name}`}
      className="group overflow-hidden rounded-2xl bg-white/80 text-left ring-1 ring-stone-100/90 transition-transform active:scale-[0.98]"
    >
      {inner}
    </button>
  )
}

function NoteCard({
  note,
  artistName,
  artistAvatar,
  onOpen,
  onOpenComments,
}: {
  note: NeteaseArtistNote
  artistName: string
  artistAvatar: string
  onOpen: () => void
  onOpenComments: () => void
}) {
  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-[0_4px_24px_-6px_rgba(120,113,108,0.08)] ring-1 ring-stone-100/80">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left transition-colors active:bg-stone-50/60"
      >
        <ArtistNoteBody
          note={note}
          artistName={artistName}
          artistAvatar={artistAvatar}
          showStats={false}
        />
      </button>

      <footer className="flex items-center gap-5 border-t border-stone-100/90 px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-stone-500">
          <Heart className="size-4 text-stone-400" strokeWidth={1.5} />
          <ListenNum>{note.likedCount}</ListenNum>
        </span>
        <button
          type="button"
          onClick={onOpenComments}
          className="inline-flex items-center gap-1.5 text-[12px] text-stone-500 transition-colors hover:text-rose-400"
        >
          <MessageCircle className="size-4 text-stone-400" strokeWidth={1.5} />
          <ListenNum>{note.commentCount}</ListenNum>
        </button>
      </footer>
    </article>
  )
}

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="mb-3 flex items-center justify-between px-0.5">
      <h3 className="text-[14px] font-medium text-stone-700">{title}</h3>
      {action && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-0.5 text-[12px] text-stone-400 transition-colors hover:text-rose-400"
        >
          {action}
          <ChevronRight className="size-3.5" strokeWidth={1.5} />
        </button>
      ) : null}
    </div>
  )
}

export function ListenTogetherArtistDetailPage({
  artist,
  cookie,
  sessionActive = false,
  onBack,
  onRequireLogin,
  onOpenArtist,
  onPlaySong,
  playingSongId = null,
  isPlaying = false,
  contentBottomInset,
  className = '',
}: ListenTogetherArtistDetailPageProps) {
  const [activeTab, setActiveTab] = useState<ArtistTab>('home')
  const [detail, setDetail] = useState<NeteaseArtistDetail | null>(null)
  const [hotSongs, setHotSongs] = useState<NeteaseSongItem[]>([])
  const [allSongs, setAllSongs] = useState<NeteaseSongItem[]>([])
  const [songsMore, setSongsMore] = useState(false)
  const [albums, setAlbums] = useState<NeteaseAlbumItem[]>([])
  const [albumsMore, setAlbumsMore] = useState(false)
  const [partners, setPartners] = useState<NeteaseArtistItem[]>([])
  const [notes, setNotes] = useState<NeteaseArtistNote[]>([])

  const [detailLoading, setDetailLoading] = useState(true)
  const [hotSongsLoading, setHotSongsLoading] = useState(true)
  const [songsLoading, setSongsLoading] = useState(false)
  const [albumsLoading, setAlbumsLoading] = useState(false)
  const [partnersLoading, setPartnersLoading] = useState(true)
  const [notesLoading, setNotesLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [descExpanded, setDescExpanded] = useState(false)
  const [commentsSong, setCommentsSong] = useState<NeteaseSongItem | null>(null)
  const [openAlbum, setOpenAlbum] = useState<PlaylistDetailInfo | null>(null)
  const [openNote, setOpenNote] = useState<OpenNoteState | null>(null)
  const [pageRefreshing, setPageRefreshing] = useState(false)

  const songsLoadedRef = useRef(false)
  const albumsLoadedRef = useRef(false)
  const notesLoadedRef = useRef(false)
  const onRequireLoginRef = useRef(onRequireLogin)
  onRequireLoginRef.current = onRequireLogin

  const persistArtistCache = useCallback(
    async (patch: Partial<Omit<CachedArtistPage, 'artistId' | 'updatedAt'>>) => {
      if (!artist.id) return
      await saveCachedArtistPage({
        artistId: artist.id,
        detail,
        hotSongs,
        partners,
        allSongs: allSongs.length > 0 ? allSongs : undefined,
        albums: albums.length > 0 ? albums : undefined,
        notes: notes.length > 0 ? notes : undefined,
        songsMore,
        albumsMore,
        ...patch,
      })
    },
    [artist.id, detail, hotSongs, partners, allSongs, albums, notes, songsMore, albumsMore],
  )

  const applyArtistCache = useCallback((cached: CachedArtistPage) => {
    setDetail(cached.detail)
    setHotSongs(cached.hotSongs)
    setPartners(cached.partners)
    if (cached.allSongs && cached.allSongs.length > 0) {
      setAllSongs(cached.allSongs)
      setSongsMore(cached.songsMore ?? false)
      songsLoadedRef.current = true
    }
    if (cached.albums && cached.albums.length > 0) {
      setAlbums(cached.albums)
      setAlbumsMore(cached.albumsMore ?? false)
      albumsLoadedRef.current = true
    }
    if (cached.notes) {
      setNotes(cached.notes)
      notesLoadedRef.current = true
    }
  }, [])

  const loadCoreData = useCallback(
    async (force = false) => {
      if (!sessionActive) {
        onRequireLoginRef.current?.()
        setError('请先登录或进入游客模式')
        setDetailLoading(false)
        setHotSongsLoading(false)
        setPartnersLoading(false)
        return
      }
      if (!artist.id) {
        setError('无效歌手')
        setDetailLoading(false)
        setHotSongsLoading(false)
        setPartnersLoading(false)
        return
      }

      if (!force) {
        const cached = await getCachedArtistPage(artist.id)
        if (cached) {
          applyArtistCache(cached)
          setError(null)
          setDetailLoading(false)
          setHotSongsLoading(false)
          setPartnersLoading(false)
          return
        }
      }

      setError(null)
      if (force) {
        setDetail(null)
        setHotSongs([])
        setPartners([])
      }
      setDetailLoading(true)
      setHotSongsLoading(true)
      setPartnersLoading(true)

      let nextDetail: NeteaseArtistDetail | null = null
      let nextHotSongs: NeteaseSongItem[] = []
      let nextPartners: NeteaseArtistItem[] = []

      const detailPromise = fetchArtistDetail(cookie, artist.id)
        .then((artistDetail) => {
          nextDetail = artistDetail
          setDetail(artistDetail)
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : '加载歌手资料失败')
        })
        .finally(() => setDetailLoading(false))

      const hotPromise = fetchArtistTopSongs(cookie, artist.id)
        .then((topSongs) => {
          nextHotSongs = topSongs
          setHotSongs(topSongs)
        })
        .catch((e) => {
          setHotSongs([])
          setError((prev) => prev ?? (e instanceof Error ? e.message : '加载热门歌曲失败'))
        })
        .finally(() => setHotSongsLoading(false))

      const partnersPromise = fetchArtistPartners(cookie, artist.id)
        .then((list) => {
          nextPartners = list
          setPartners(list)
        })
        .catch(() => setPartners([]))
        .finally(() => setPartnersLoading(false))

      await Promise.all([detailPromise, hotPromise, partnersPromise])
      await saveCachedArtistPage({
        artistId: artist.id,
        detail: nextDetail,
        hotSongs: nextHotSongs,
        partners: nextPartners,
      })
    },
    [sessionActive, artist.id, cookie, applyArtistCache],
  )

  useEffect(() => {
    songsLoadedRef.current = false
    albumsLoadedRef.current = false
    notesLoadedRef.current = false
    setAllSongs([])
    setAlbums([])
    setNotes([])
    setOpenAlbum(null)
    setActiveTab('home')
    void loadCoreData(false)
  }, [artist.id, cookie, sessionActive])

  const loadAllSongs = useCallback(
    async (append = false, force = false) => {
      if (!artist.id || !sessionActive) return
      if (!force && !append) {
        const cached = await getCachedArtistPage(artist.id)
        if (cached?.allSongs && cached.allSongs.length > 0) {
          setAllSongs(cached.allSongs)
          setSongsMore(cached.songsMore ?? false)
          songsLoadedRef.current = true
          return
        }
      }
      setSongsLoading(true)
      try {
        const offset = append ? allSongs.length : 0
        const { songs, more } = await fetchArtistSongsPage(cookie, artist.id, {
          offset,
          limit: 50,
        })
        const nextSongs = append ? [...allSongs, ...songs] : songs
        setAllSongs(nextSongs)
        setSongsMore(more)
        songsLoadedRef.current = true
        await persistArtistCache({ allSongs: nextSongs, songsMore: more })
      } catch (e) {
        if (!append) setAllSongs([])
        setError(e instanceof Error ? e.message : '加载歌曲失败')
      } finally {
        setSongsLoading(false)
      }
    },
    [allSongs, artist.id, cookie, sessionActive, persistArtistCache],
  )

  const loadAlbums = useCallback(
    async (append = false, force = false) => {
      if (!artist.id || !sessionActive) return
      if (!force && !append) {
        const cached = await getCachedArtistPage(artist.id)
        if (cached?.albums && cached.albums.length > 0) {
          setAlbums(cached.albums)
          setAlbumsMore(cached.albumsMore ?? false)
          albumsLoadedRef.current = true
          return
        }
      }
      setAlbumsLoading(true)
      try {
        const offset = append ? albums.length : 0
        const { albums: page, more } = await fetchArtistAlbumsPage(cookie, artist.id, {
          offset,
          limit: 30,
        })
        const nextAlbums = append ? [...albums, ...page] : page
        setAlbums(nextAlbums)
        setAlbumsMore(more)
        albumsLoadedRef.current = true
        await persistArtistCache({ albums: nextAlbums, albumsMore: more })
      } catch (e) {
        if (!append) setAlbums([])
        setError(e instanceof Error ? e.message : '加载专辑失败')
      } finally {
        setAlbumsLoading(false)
      }
    },
    [albums, artist.id, cookie, sessionActive, persistArtistCache],
  )

  const loadNotes = useCallback(async (force = false) => {
    const userId = detail?.accountUserId ?? 0
    if (!userId || !sessionActive) {
      notesLoadedRef.current = true
      setNotes([])
      return
    }
    if (!force) {
      const cached = await getCachedArtistPage(artist.id)
      if (cached?.notes) {
        setNotes(cached.notes)
        notesLoadedRef.current = true
        return
      }
    }
    setNotesLoading(true)
    try {
      const list = await fetchArtistNotes(cookie, userId)
      setNotes(list)
      notesLoadedRef.current = true
      await persistArtistCache({ notes: list })
    } catch {
      setNotes([])
      notesLoadedRef.current = true
    } finally {
      setNotesLoading(false)
    }
  }, [cookie, detail?.accountUserId, sessionActive, artist.id, persistArtistCache])

  useEffect(() => {
    if (activeTab === 'songs' && !songsLoadedRef.current && !songsLoading) {
      void loadAllSongs(false)
    }
    if (activeTab === 'albums' && !albumsLoadedRef.current && !albumsLoading) {
      void loadAlbums(false)
    }
    if (activeTab === 'notes' && !notesLoadedRef.current && !notesLoading && !detailLoading) {
      void loadNotes()
    }
  }, [
    activeTab,
    albumsLoading,
    detailLoading,
    loadAlbums,
    loadAllSongs,
    loadNotes,
    notesLoading,
    songsLoading,
  ])

  const handlePageRefresh = useCallback(async () => {
    setPageRefreshing(true)
    songsLoadedRef.current = false
    albumsLoadedRef.current = false
    notesLoadedRef.current = false
    try {
      await loadCoreData(true)
      if (activeTab === 'songs') await loadAllSongs(false, true)
      else if (activeTab === 'albums') await loadAlbums(false, true)
      else if (activeTab === 'notes') await loadNotes(true)
    } finally {
      setPageRefreshing(false)
    }
  }, [loadCoreData, activeTab, loadAllSongs, loadAlbums, loadNotes])

  const displayName = detail?.name ?? artist.name
  const displayAvatar = detail?.avatar || artist.avatar
  const displayCover = detail?.cover ?? ''
  const hasBanner = Boolean(displayCover)

  const playQueue =
    activeTab === 'songs' && allSongs.length > 0 ? allSongs : hotSongs.length > 0 ? hotSongs : allSongs

  const playAll = () => {
    if (playQueue[0]) onPlaySong(playQueue[0], playQueue)
  }

  const handleOpenAlbum = useCallback(
    (album: NeteaseAlbumItem) => {
      if (!sessionActive) {
        onRequireLogin?.()
        return
      }
      setOpenAlbum({
        id: album.id,
        title: album.name,
        cover: album.cover,
        count: album.trackCount,
        kind: 'album',
      })
    },
    [sessionActive, onRequireLogin],
  )

  const renderSongList = (list: NeteaseSongItem[], queue: NeteaseSongItem[]) => (
    <ul className="space-y-2">
      {list.map((song, index) => {
        const active = playingSongId === song.id
        return (
          <li key={song.id}>
            <SongRow
              index={index + 1}
              song={song}
              active={active}
              playing={active && isPlaying}
              onPlay={() => onPlaySong(song, queue)}
              onShowComments={() => setCommentsSong(song)}
            />
          </li>
        )
      })}
    </ul>
  )

  const renderHomeTab = () => (
    <div className="space-y-5">
      {detail?.briefDesc ? (
        <div className="rounded-2xl bg-white/90 px-3 py-3 ring-1 ring-stone-100/90">
          <p className="mb-1 text-[11px] font-medium text-stone-500">简介</p>
          <p
            className={`whitespace-pre-wrap text-[13px] leading-relaxed text-stone-600 ${
              descExpanded ? '' : 'line-clamp-4'
            }`}
          >
            {detail.briefDesc}
          </p>
          {detail.briefDesc.length > 96 ? (
            <button
              type="button"
              onClick={() => setDescExpanded((v) => !v)}
              className="mt-2 text-[12px] font-medium text-rose-500"
            >
              {descExpanded ? '收起简介' : '展开简介'}
            </button>
          ) : null}
        </div>
      ) : null}

      {partnersLoading ? (
        <p className="flex items-center gap-2 py-2 text-[12px] text-stone-400">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          加载合作伙伴…
        </p>
      ) : partners.length > 0 ? (
        <div>
          <SectionHeader title="合作伙伴" />
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {partners.map((partner) => (
              <PartnerChip
                key={partner.id}
                partner={partner}
                onOpen={onOpenArtist ? () => onOpenArtist(partner) : undefined}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <SectionHeader
          title="热门歌曲"
          action={hotSongs.length > HOME_HOT_PREVIEW ? '查看全部' : undefined}
          onAction={
            hotSongs.length > HOME_HOT_PREVIEW ? () => setActiveTab('songs') : undefined
          }
        />
        {hotSongsLoading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-[13px] text-stone-400">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            加载热门歌曲…
          </p>
        ) : hotSongs.length > 0 ? (
          renderSongList(hotSongs.slice(0, HOME_HOT_PREVIEW), hotSongs)
        ) : (
          <p className="py-8 text-center text-[13px] text-stone-400">暂无热门歌曲</p>
        )}
      </div>
    </div>
  )

  const renderSongsTab = () => (
    <div>
      {songsLoading && allSongs.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-16 text-[13px] text-stone-400">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          加载歌曲…
        </p>
      ) : allSongs.length > 0 ? (
        <>
          {renderSongList(allSongs, allSongs)}
          {songsMore ? (
            <button
              type="button"
              onClick={() => void loadAllSongs(true)}
              disabled={songsLoading}
              className="mt-4 w-full rounded-2xl bg-white/80 py-2.5 text-[13px] text-stone-500 ring-1 ring-stone-100/90 disabled:opacity-50"
            >
              {songsLoading ? '加载中…' : '加载更多'}
            </button>
          ) : null}
        </>
      ) : (
        <p className="py-12 text-center text-[13px] text-stone-400">暂无歌曲</p>
      )}
    </div>
  )

  const renderAlbumsTab = () => (
    <div>
      {albumsLoading && albums.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-16 text-[13px] text-stone-400">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          加载专辑…
        </p>
      ) : albums.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                onOpen={() => handleOpenAlbum(album)}
              />
            ))}
          </div>
          {albumsMore ? (
            <button
              type="button"
              onClick={() => void loadAlbums(true)}
              disabled={albumsLoading}
              className="mt-4 w-full rounded-2xl bg-white/80 py-2.5 text-[13px] text-stone-500 ring-1 ring-stone-100/90 disabled:opacity-50"
            >
              {albumsLoading ? '加载中…' : '加载更多'}
            </button>
          ) : null}
        </>
      ) : (
        <p className="py-12 text-center text-[13px] text-stone-400">暂无专辑</p>
      )}
    </div>
  )

  const renderNotesTab = () => {
    if (!detail?.accountUserId) {
      return (
        <p className="py-12 text-center text-[13px] text-stone-400">
          该歌手暂未绑定网易账号，暂无笔记
        </p>
      )
    }
    if (notesLoading) {
      return (
        <p className="flex items-center justify-center gap-2 py-16 text-[13px] text-stone-400">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          加载笔记…
        </p>
      )
    }
    if (notes.length === 0) {
      return <p className="py-12 text-center text-[13px] text-stone-400">暂无笔记</p>
    }
    return (
      <div className="space-y-4">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            artistName={displayName}
            artistAvatar={displayAvatar}
            onOpen={() => setOpenNote({ note, scrollToComments: false })}
            onOpenComments={() => setOpenNote({ note, scrollToComments: true })}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`relative flex h-full min-h-0 flex-col ${className}`}>
      <ListenTogetherPageBackground />
      <div
        className="relative z-[1] min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={contentBottomInset ? { paddingBottom: contentBottomInset } : undefined}
      >
        <div className="relative">
          <div className="relative h-[200px] overflow-hidden" aria-hidden>
            {hasBanner ? (
              <img
                src={displayCover}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-rose-200/80 via-rose-100/60 to-stone-100" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-white/25" />
          </div>

          <div className="absolute inset-x-0 top-0 z-20 px-4 pt-[max(10px,env(safe-area-inset-top))]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="返回"
                onClick={onBack}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition-colors hover:bg-black/40"
              >
                <ArrowLeft className="size-5" strokeWidth={1.5} />
              </button>
              <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-white drop-shadow-sm">
                歌手
              </h1>
              <ListenTogetherHeaderRefreshButton
                variant="dark"
                loading={pageRefreshing}
                onClick={() => void handlePageRefresh()}
              />
              <button
                type="button"
                onClick={playAll}
                disabled={playQueue.length === 0 || hotSongsLoading}
                className="shrink-0 rounded-full bg-white/92 px-3 py-1.5 text-[12px] font-medium text-rose-500 shadow-sm transition-colors hover:bg-white disabled:opacity-40"
              >
                播放热门
              </button>
            </div>
          </div>

          <div className="relative z-10 -mt-14 px-4">
            <div className="rounded-[24px] bg-white/95 px-4 pb-4 pt-14 shadow-[0_8px_32px_rgba(120,113,108,0.1)] ring-1 ring-stone-100/80 backdrop-blur-sm">
              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                <div className="h-[96px] w-[96px] overflow-hidden rounded-full bg-stone-100 shadow-[0_8px_24px_rgba(120,113,108,0.15)] ring-4 ring-white">
                  {displayAvatar ? (
                    <img
                      src={displayAvatar}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : detailLoading ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <Loader2 className="size-7 animate-spin text-rose-300" aria-hidden />
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-stone-200">
                      <User className="size-10 text-stone-400" strokeWidth={1.5} aria-hidden />
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center">
                <h2 className="line-clamp-2 text-[20px] font-semibold text-stone-800">{displayName}</h2>
                {detail && detail.alias.length > 0 ? (
                  <p className="mt-1 text-[12px] text-stone-500">
                    别名：{detail.alias.slice(0, 3).join(' / ')}
                  </p>
                ) : null}
                {detail ? (
                  <p className="mt-2 text-[12px] text-stone-400">
                    {detail.musicSize > 0 ? (
                      <>
                        <ListenNum>{detail.musicSize}</ListenNum> 首单曲
                      </>
                    ) : null}
                    {detail.albumSize > 0 ? (
                      <>
                        {detail.musicSize > 0 ? ' · ' : ''}
                        <ListenNum>{detail.albumSize}</ListenNum> 张专辑
                      </>
                    ) : null}
                    {detail.mvSize > 0 ? (
                      <>
                        {' · '}
                        <ListenNum>{detail.mvSize}</ListenNum> 支 MV
                      </>
                    ) : null}
                  </p>
                ) : detailLoading ? (
                  <p className="mt-2 text-[12px] text-stone-400">加载资料中…</p>
                ) : null}
              </div>

              {detail && !detailLoading ? (
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-stone-50/90 px-3 py-3 ring-1 ring-stone-100/90">
                  <div className="text-center">
                    <p className="text-[15px] font-semibold tabular-nums text-stone-800">
                      <ListenNum>{detail.following.toLocaleString()}</ListenNum>
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-400">关注</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[15px] font-semibold tabular-nums text-stone-800">
                      <ListenNum>{detail.followers.toLocaleString()}</ListenNum>
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-400">粉丝</p>
                  </div>
                </div>
              ) : null}

              {detail && detail.identities.length > 0 ? (
                <p className="mt-3 text-center text-[12px] leading-relaxed text-stone-400">
                  {detail.identities.join('、')}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-10 border-b border-white/30 bg-white/45 pb-2 pt-3 backdrop-blur-md">
          <ArtistTabs active={activeTab} onChange={setActiveTab} />
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="px-4 pb-6 pt-1"
        >
          {error && activeTab === 'songs' && allSongs.length === 0 && !songsLoading ? (
            <p className="mb-3 text-center text-[13px] text-rose-400">{error}</p>
          ) : null}

          {activeTab === 'home' ? renderHomeTab() : null}
          {activeTab === 'songs' ? renderSongsTab() : null}
          {activeTab === 'albums' ? renderAlbumsTab() : null}
          {activeTab === 'notes' ? renderNotesTab() : null}
        </motion.div>
      </div>

      <ListenTogetherSongCommentsPage
        open={commentsSong !== null}
        song={commentsSong}
        cookie={cookie}
        onBack={() => setCommentsSong(null)}
      />

      <ListenTogetherArtistNoteDetailPage
        open={openNote !== null}
        note={openNote?.note ?? null}
        artistName={displayName}
        artistAvatar={displayAvatar}
        cookie={cookie}
        scrollToComments={openNote?.scrollToComments ?? false}
        onBack={() => setOpenNote(null)}
      />

      {openAlbum ? (
        <div className="fixed inset-0 z-[30] overflow-hidden">
          <ListenTogetherPlaylistDetailPage
            playlist={openAlbum}
            cookie={cookie}
            onBack={() => setOpenAlbum(null)}
            onRequireLogin={onRequireLogin}
            onPlaySong={onPlaySong}
            playingSongId={playingSongId}
            isPlaying={isPlaying}
            contentBottomInset={contentBottomInset}
            className="h-full"
          />
        </div>
      ) : null}
    </div>
  )
}
