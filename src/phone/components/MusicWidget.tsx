import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable } from './Pressable'
import { useCustomization } from '../CustomizationContext'
import type { MusicPlayMode } from '../types'

// 全局单例音频：切换应用路由时组件卸载也不自动中断播放
const sharedAudio = new Audio()
let sharedNowPlaying: PlayingTrack | null = null

type SearchTrack = {
  id: number
  trackName: string
  artistName: string
  previewUrl: string
  artworkUrl?: string
}

type LibraryTrack = {
  id: string
  title: string
  artist: string
  audioUrl: string
  artworkUrl: string
  liked: boolean
  source: 'search' | 'custom'
}

type PlayingTrack = {
  id: string
  title: string
  artist: string
  audioUrl: string
  artworkUrl: string
  source: 'search' | 'library'
}

const DJ_KEYWORDS = ['dj', 'remix', '串烧', '舞曲', '电音', '车载', '慢摇', '嗨曲']
const LOVE_KEYWORDS = ['love', '恋', '爱', '情', 'heart', 'miss', '想你']
const SOFT_KEYWORDS = ['piano', 'acoustic', '钢琴', '抒情', '慢歌', '治愈', '轻音乐']

function audioElementMatchesUrl(audio: HTMLAudioElement, url: string): boolean {
  if (!url.trim()) return false
  const cur = audio.currentSrc || audio.src || ''
  if (cur === url) return true
  try {
    return cur === new URL(url, window.location.href).href
  } catch {
    return false
  }
}

export function MusicWidget() {
  const { state, setMusic } = useCustomization()
  const { music, theme } = state
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<'menu' | 'library' | 'search'>('menu')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<SearchTrack[]>([])
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playingTrack, setPlayingTrack] = useState<PlayingTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [customTitle, setCustomTitle] = useState('')
  const [customArtist, setCustomArtist] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [customArtwork, setCustomArtwork] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importMode, setImportMode] = useState<'url' | 'local' | null>(null)
  const playMode = music.playMode
  const [heartbeatPool, setHeartbeatPool] = useState<SearchTrack[]>([])
  /** 心动模式近期已播 id，降低连续重复 */
  const heartbeatRecentIdsRef = useRef<string[]>([])
  const library = useMemo(() => (music.library ?? []) as LibraryTrack[], [music.library])
  const audioRef = useRef<HTMLAudioElement>(sharedAudio)
  const customFileRef = useRef<HTMLInputElement | null>(null)
  const playModeRef = useRef(playMode)
  const resultsRef = useRef(results)
  const libraryRef = useRef(library)
  const playingTrackRef = useRef<PlayingTrack | null>(null)
  const playAfterEndedRef = useRef<(track: PlayingTrack) => Promise<void>>(async () => {})

  const hasKeyword = keyword.trim().length > 0
  const currentCover = playingTrack?.artworkUrl || music.currentArtworkUrl
  const emptyHint = useMemo(
    () => '你可以收藏搜索结果，也可以导入自定义链接/本地音乐。',
    [],
  )
  const playModes: Array<{ id: MusicPlayMode; label: string }> =
    useMemo(
      () => [
        { id: 'shuffle', label: '随机播放' },
        { id: 'list-loop', label: '列表循环' },
        { id: 'single-loop', label: '单曲循环' },
        { id: 'heartbeat', label: '心动模式' },
      ],
      [],
    )
  const playModeButtonRow = (
    <div className="flex flex-wrap items-center gap-1.5">
      {playModes.map((mode) => (
        <Pressable
          key={mode.id}
          onClick={() => setMusic({ playMode: mode.id })}
          className="rounded-[8px] border px-2 py-1 text-[10px]"
          style={{
            borderColor: theme.border,
            background: playMode === mode.id ? theme.text : theme.surfaceMuted,
            color: playMode === mode.id ? theme.surface : theme.text,
          }}
        >
          {mode.label}
        </Pressable>
      ))}
    </div>
  )

  function containsAny(text: string, words: string[]) {
    const lower = text.toLowerCase()
    return words.some((w) => lower.includes(w))
  }

  function styleTags(title: string, artist: string) {
    const text = `${title} ${artist}`.toLowerCase()
    return {
      isDj: containsAny(text, DJ_KEYWORDS),
      isLove: containsAny(text, LOVE_KEYWORDS),
      isSoft: containsAny(text, SOFT_KEYWORDS),
    }
  }

  function styleScore(base: { isDj: boolean; isLove: boolean; isSoft: boolean }, candidateTitle: string, candidateArtist: string) {
    const c = styleTags(candidateTitle, candidateArtist)
    let score = 0
    if (base.isDj === c.isDj) score += 3
    if (base.isLove === c.isLove) score += 2
    if (base.isSoft === c.isSoft) score += 2
    return score
  }

  /** 用于比较是否同一歌手（忽略 feat.、括号、大小写） */
  function canonicalArtistName(raw: string): string {
    return raw
      .toLowerCase()
      .replace(/[（(].*?[)）]/g, '')
      .split(/[,/&＆]|\bfeat\.?|\bft\.?|\bfeaturing\b/i)[0]
      ?.trim()
      .replace(/\s+/g, ' ') ?? ''
  }

  function isSamePrimaryArtist(a: string, b: string): boolean {
    const na = canonicalArtistName(a)
    const nb = canonicalArtistName(b)
    if (!na || !nb) return false
    return na === nb
  }

  /**
   * 心动推荐：用「风格 / 情绪」向 iTunes  discovery，避免用歌手名检索导致整页同歌手。
   */
  function heartbeatDiscoveryTerm(track: PlayingTrack): string {
    const tags = styleTags(track.title, track.artist)
    const hasCjk = /[\u4e00-\u9fff]/.test(`${track.title} ${track.artist}`)
    if (tags.isDj) return hasCjk ? '电音 舞曲 电子舞曲' : 'electronic dance edm remix'
    if (tags.isSoft) return hasCjk ? '抒情 治愈 轻音乐 钢琴' : 'acoustic piano ballad chill'
    if (tags.isLove) return hasCjk ? '情歌 浪漫 流行情歌' : 'love song romantic ballad pop'
    if (hasCjk) return '流行 华语 热门'
    return 'pop hits contemporary'
  }

  /** 心动选曲语种桶：中文 / 英文 / 其他（日韩泰越等） */
  type HeartbeatLangBucket = 'zh' | 'en' | 'other'

  function detectHeartbeatLangBucket(title: string, artist: string): HeartbeatLangBucket {
    const raw = `${title} ${artist}`
    if (/[\uac00-\ud7af]/.test(raw)) return 'other'
    if (/[\u0e00-\u0e7f]/.test(raw)) return 'other'
    if (/[\u3040-\u30ff]/.test(raw)) return 'other'
    if (
      /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụưừứửữựýỳỷỹỵđ]/i.test(
        raw,
      )
    ) {
      return 'other'
    }
    if (/[\u4e00-\u9fff]/.test(raw)) return 'zh'
    if (/[a-zA-Z]/.test(raw)) return 'en'
    return 'other'
  }

  /**
   * 当前曲为中文：约 70% 下一首仍为中文桶；英文同理。其他语种：约 70% 仍为 other，30% 从中英里选。
   */
  function pickHeartbeatWithLangBias(candidates: PlayingTrack[], base: PlayingTrack): PlayingTrack | null {
    if (!candidates.length) return null
    const baseB = detectHeartbeatLangBucket(base.title, base.artist)
    const bucketOf = (t: PlayingTrack) => detectHeartbeatLangBucket(t.title, t.artist)
    const match = candidates.filter((t) => bucketOf(t) === baseB)
    const rest = candidates.filter((t) => bucketOf(t) !== baseB)

    const roll = Math.random()
    if (roll < 0.7) {
      if (match.length > 0) return match[Math.floor(Math.random() * match.length)]
      if (rest.length > 0) return rest[Math.floor(Math.random() * rest.length)]
    } else {
      if (rest.length > 0) return rest[Math.floor(Math.random() * rest.length)]
      if (match.length > 0) return match[Math.floor(Math.random() * match.length)]
    }
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  useEffect(() => {
    playModeRef.current = playMode
  }, [playMode])
  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(''), 5000)
    return () => window.clearTimeout(timer)
  }, [error])
  useEffect(() => {
    resultsRef.current = results
  }, [results])
  useEffect(() => {
    libraryRef.current = library
  }, [library])
  useEffect(() => {
    playingTrackRef.current = playingTrack
  }, [playingTrack])

  const playbackHydratedRef = useRef(false)
  useEffect(() => {
    if (playbackHydratedRef.current) return
    playbackHydratedRef.current = true
    const m = music
    const id = typeof m.playingTrackId === 'string' ? m.playingTrackId.trim() : ''
    const persistedUrl = typeof m.playingAudioUrl === 'string' ? m.playingAudioUrl.trim() : ''
    if (!id || !persistedUrl) return

    const fromLib = library.find((x) => x.id === id)
    const url = (fromLib?.audioUrl || persistedUrl).trim()
    if (!url) return

    const source: PlayingTrack['source'] =
      m.playingSource === 'search' || m.playingSource === 'library' ? m.playingSource : 'library'

    const track: PlayingTrack = {
      id,
      title: fromLib?.title || m.trackTitle,
      artist: fromLib?.artist || m.artistName,
      audioUrl: url,
      artworkUrl: fromLib?.artworkUrl || m.currentArtworkUrl,
      source,
    }

    const audio = audioRef.current
    // 从其他应用返回桌面时组件会重新挂载：若全局播放器仍在同一轨上，不要 load()，否则会打断播放
    const sameOngoing =
      sharedNowPlaying != null &&
      sharedNowPlaying.id === id &&
      audioElementMatchesUrl(audio, url)

    if (sameOngoing) {
      sharedNowPlaying = track
      setPlayingTrack(track)
      setPlayingId(track.id)
      setCurrentTime(audio.currentTime || 0)
      setIsPlaying(!audio.paused)
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
      return
    }

    sharedNowPlaying = track
    setPlayingTrack(track)
    setPlayingId(track.id)
    audio.pause()
    audio.src = url
    audio.load()
    setCurrentTime(0)
    setIsPlaying(false)
  }, [music, library])

  function clearPersistedNowPlaying() {
    setMusic({
      playingTrackId: '',
      playingAudioUrl: '',
      playingSource: 'library',
    })
  }

  function wipePlaybackState() {
    const audio = audioRef.current
    audio.pause()
    try {
      audio.removeAttribute('src')
      audio.load()
    } catch {
      // ignore
    }
    sharedNowPlaying = null
    setPlayingId(null)
    setPlayingTrack(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    clearPersistedNowPlaying()
  }

  useEffect(() => {
    const audio = audioRef.current
    // 组件重新挂载时，沿用全局播放器当前状态
    if (sharedNowPlaying) {
      setPlayingTrack(sharedNowPlaying)
      setPlayingId(sharedNowPlaying.id)
    }
    const syncProgress = () => {
      setIsPlaying(!audio.paused)
      setCurrentTime(audio.currentTime || 0)
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onTime = () => setCurrentTime(audio.currentTime || 0)
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      const endedTrack = playingTrackRef.current ?? sharedNowPlaying
      if (endedTrack) {
        void playAfterEndedRef.current(endedTrack)
      } else {
        wipePlaybackState()
      }
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('ended', onEnded)
    syncProgress()

    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  async function searchTracks() {
    if (!hasKeyword) return
    setLoading(true)
    setError('')
    try {
      const term = encodeURIComponent(keyword.trim())
      const res = await fetch(
        `https://itunes.apple.com/search?term=${term}&entity=song&limit=20`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as {
        results?: Array<{
          trackId?: number
          trackName?: string
          artistName?: string
          previewUrl?: string
          artworkUrl100?: string
        }>
      }
      const list: SearchTrack[] = (data.results ?? [])
        .filter((x) => x.trackId && x.trackName && x.artistName && x.previewUrl)
        .map((x) => ({
          id: x.trackId as number,
          trackName: x.trackName as string,
          artistName: x.artistName as string,
          previewUrl: x.previewUrl as string,
          artworkUrl:
            typeof x.artworkUrl100 === 'string'
              ? x.artworkUrl100.replace(/\/\d+x\d+bb\./, '/600x600bb.')
              : undefined,
        }))
      setResults(list)
      if (!list.length) setError('未找到结果，请换关键词。')
    } catch {
      setError('搜索失败，请检查网络后重试。')
    } finally {
      setLoading(false)
    }
  }

  async function fetchHeartbeatPool(track: PlayingTrack) {
    try {
      const term = encodeURIComponent(heartbeatDiscoveryTerm(track))
      const res = await fetch(
        `https://itunes.apple.com/search?term=${term}&entity=song&limit=40`,
      )
      if (!res.ok) return
      const data = (await res.json()) as {
        results?: Array<{
          trackId?: number
          trackName?: string
          artistName?: string
          previewUrl?: string
          artworkUrl100?: string
        }>
      }
      const list: SearchTrack[] = (data.results ?? [])
        .filter((x) => x.trackId && x.trackName && x.artistName && x.previewUrl)
        .map((x) => ({
          id: x.trackId as number,
          trackName: x.trackName as string,
          artistName: x.artistName as string,
          previewUrl: x.previewUrl as string,
          artworkUrl:
            typeof x.artworkUrl100 === 'string'
              ? x.artworkUrl100.replace(/\/\d+x\d+bb\./, '/600x600bb.')
              : undefined,
        }))
      setHeartbeatPool(list)
    } catch {
      // silent
    }
  }

  /** 与 playAfterEnded 一致：根据当前曲目判断用搜索列表还是曲库作为「列表循环 / 随机」的队列 */
  function buildQueueForAnchor(anchor: PlayingTrack): PlayingTrack[] {
    if (anchor.source === 'search' && resultsRef.current.length > 0) {
      return resultsRef.current.map((x) => ({
        id: `search-${x.id}`,
        title: x.trackName,
        artist: x.artistName,
        audioUrl: x.previewUrl,
        artworkUrl: x.artworkUrl ?? '',
        source: 'search' as const,
      }))
    }
    return libraryRef.current.map((x) => ({
      id: x.id,
      title: x.title,
      artist: x.artist,
      audioUrl: x.audioUrl,
      artworkUrl: x.artworkUrl,
      source: 'library' as const,
    }))
  }

  /** 心动模式：在同风格候选中随机一首（与自然播放结束逻辑一致） */
  function pickHeartbeatSimilar(endedTrack: PlayingTrack): PlayingTrack | null {
    const fromHeartbeat = heartbeatPool.map((x) => ({
      id: `search-${x.id}`,
      title: x.trackName,
      artist: x.artistName,
      audioUrl: x.previewUrl,
      artworkUrl: x.artworkUrl ?? '',
      source: 'search' as const,
    }))
    const fromSearch = resultsRef.current.map((x) => ({
      id: `search-${x.id}`,
      title: x.trackName,
      artist: x.artistName,
      audioUrl: x.previewUrl,
      artworkUrl: x.artworkUrl ?? '',
      source: 'search' as const,
    }))
    const fromLibrary = libraryRef.current.map((x) => ({
      id: x.id,
      title: x.title,
      artist: x.artist,
      audioUrl: x.audioUrl,
      artworkUrl: x.artworkUrl,
      source: 'library' as const,
    }))

    const merged = [...fromHeartbeat, ...fromSearch, ...fromLibrary]
    const uniq = new Map<string, (typeof merged)[number]>()
    for (const item of merged) {
      if (!uniq.has(item.id)) uniq.set(item.id, item)
    }
    const candidates = Array.from(uniq.values()).filter((x) => x.id !== endedTrack.id)
    if (!candidates.length) return null

    const baseTags = styleTags(endedTrack.title, endedTrack.artist)
    const filtered = candidates.filter((x) => {
      const t = `${x.title} ${x.artist}`.toLowerCase()
      if (!baseTags.isDj && containsAny(t, DJ_KEYWORDS)) return false
      return true
    })
    const pool = filtered.length > 0 ? filtered : candidates

    const baseArtistKey = canonicalArtistName(endedTrack.artist)
    const scored = pool
      .map((x) => {
        let score = styleScore(baseTags, x.title, x.artist)
        if (baseArtistKey && isSamePrimaryArtist(endedTrack.artist, x.artist)) {
          score -= 6
        }
        return { track: x, score }
      })
      .sort((a, b) => b.score - a.score)
    const topStyle = scored.filter((x) => x.score >= 6).map((x) => x.track)
    const midStyle = scored.filter((x) => x.score >= 4).map((x) => x.track)
    let tier = topStyle.length > 0 ? topStyle : midStyle.length > 0 ? midStyle : pool

    if (baseArtistKey) {
      const otherArtists = tier.filter((x) => !isSamePrimaryArtist(endedTrack.artist, x.artist))
      if (otherArtists.length > 0) tier = otherArtists
    }

    const tierBeforeRecent = tier
    const recent = heartbeatRecentIdsRef.current
    const tierNoRepeat = tier.filter((x) => !recent.includes(x.id))
    const poolForLang = tierNoRepeat.length > 0 ? tierNoRepeat : tierBeforeRecent

    return pickHeartbeatWithLangBias(poolForLang, endedTrack)
  }

  async function playTrack(track: PlayingTrack) {
    try {
      const audio = audioRef.current
      audio.pause()
      audio.src = track.audioUrl
      await audio.play()
      setPlayingId(track.id)
      setPlayingTrack(track)
      sharedNowPlaying = track
      setIsPlaying(true)
      setCurrentTime(0)
      setMusic({
        trackTitle: track.title,
        artistName: track.artist,
        currentArtworkUrl: track.artworkUrl,
        playingTrackId: track.id,
        playingAudioUrl: track.audioUrl,
        playingSource: track.source,
      })
      if (playModeRef.current === 'heartbeat') {
        void fetchHeartbeatPool(track)
        const rid = heartbeatRecentIdsRef.current
        rid.unshift(track.id)
        const maxRecent = 28
        while (rid.length > maxRecent) rid.pop()
      }
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    } catch {
      setError('当前歌曲试听失败，可尝试选择其他结果。')
    }
  }

  async function playAfterEnded(endedTrack: PlayingTrack) {
    const mode = playModeRef.current
    if (mode === 'single-loop') {
      const audio = audioRef.current
      if (!audio) return
      audio.currentTime = 0
      await audio.play().catch(() => setError('单曲循环恢复播放失败。'))
      return
    }

    if (mode === 'heartbeat') {
      const picked = pickHeartbeatSimilar(endedTrack)
      if (!picked) {
        wipePlaybackState()
        return
      }
      await playTrack(picked)
      return
    }

    const queue: PlayingTrack[] = buildQueueForAnchor(endedTrack)
    if (!queue.length) {
      wipePlaybackState()
      return
    }
    const currentIndex = queue.findIndex((x) => x.id === endedTrack.id)
    let nextIndex = 0
    if (mode === 'shuffle') {
      nextIndex = Math.floor(Math.random() * queue.length)
      if (queue.length > 1 && nextIndex === currentIndex) {
        nextIndex = (nextIndex + 1) % queue.length
      }
    } else {
      nextIndex = ((currentIndex >= 0 ? currentIndex : 0) + 1) % queue.length
    }
    await playTrack(queue[nextIndex])
  }

  playAfterEndedRef.current = playAfterEnded

  function playPreview(track: SearchTrack) {
    void playTrack({
      id: `search-${track.id}`,
      title: track.trackName,
      artist: track.artistName,
      audioUrl: track.previewUrl,
      artworkUrl: track.artworkUrl ?? '',
      source: 'search',
    })
  }

  function playLibraryTrack(track: LibraryTrack) {
    void playTrack({
      id: track.id,
      title: track.title,
      artist: track.artist,
      audioUrl: track.audioUrl,
      artworkUrl: track.artworkUrl,
      source: 'library',
    })
  }

  function isSearchLiked(track: SearchTrack) {
    return library.some((x) => x.id === `search-${track.id}`)
  }

  function toggleLike(track: SearchTrack) {
    const id = `search-${track.id}`
    const exists = library.some((x) => x.id === id)
    if (exists) {
      setMusic({ library: library.filter((x) => x.id !== id) })
      return
    }
    const next: LibraryTrack = {
      id,
      title: track.trackName,
      artist: track.artistName,
      audioUrl: track.previewUrl,
      artworkUrl: track.artworkUrl ?? '',
      liked: true,
      source: 'search',
    }
    setMusic({ library: [next, ...library] })
  }

  function isCurrentTrackLiked() {
    if (!playingTrack) return false
    return library.some((x) => x.id === playingTrack.id)
  }

  function toggleCurrentTrackLike() {
    if (!playingTrack) return
    const exists = library.some((x) => x.id === playingTrack.id)
    if (exists) {
      // 仅取消收藏，不中断当前播放
      setMusic({ library: library.filter((x) => x.id !== playingTrack.id) })
      return
    }
    const next: LibraryTrack = {
      id: playingTrack.id,
      title: playingTrack.title,
      artist: playingTrack.artist,
      audioUrl: playingTrack.audioUrl,
      artworkUrl: playingTrack.artworkUrl,
      liked: true,
      source: playingTrack.id.startsWith('custom-') ? 'custom' : 'search',
    }
    setMusic({ library: [next, ...library] })
  }

  function addCustomTrack(track: Omit<LibraryTrack, 'id' | 'source' | 'liked'>) {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const next: LibraryTrack = { ...track, id, source: 'custom', liked: true }
    setMusic({ library: [next, ...library] })
  }

  function removeLibraryTrack(id: string) {
    setMusic({ library: library.filter((x) => x.id !== id) })
    if (playingId === id) {
      wipePlaybackState()
    }
  }

  function addCustomByUrl() {
    const url = customUrl.trim()
    if (!url) return
    const lower = url.toLowerCase()
    const isDirectAudio =
      lower.startsWith('data:audio/') ||
      /\.(mp3|m4a|aac|wav|flac|ogg)(\?|#|$)/.test(lower) ||
      lower.includes('/media/') ||
      lower.includes('/audio/')
    const looksLikeNeteaseShare =
      lower.includes('163cn.tv') ||
      lower.includes('music.163.com') ||
      lower.includes('网易云音乐')

    if (!isDirectAudio) {
      if (looksLikeNeteaseShare) {
        setError('你粘贴的是网易云分享页链接，不是音频直链，浏览器无法直接播放。请导入可直接访问的音频 URL（如 .mp3/.m4a）。')
      } else {
        setError('该链接看起来不是可直播音频地址，请使用可直接播放的音频 URL（如 .mp3/.m4a）或本地文件导入。')
      }
      return
    }

    addCustomTrack({
      title: customTitle.trim() || '自定义音频',
      artist: customArtist.trim() || '本地导入',
      audioUrl: url,
      artworkUrl: customArtwork.trim(),
    })
    setCustomTitle('')
    setCustomArtist('')
    setCustomUrl('')
    setCustomArtwork('')
    setPanel('library')
  }

  async function onPickLocalFile(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      addCustomTrack({
        title: customTitle.trim() || file.name.replace(/\.[^/.]+$/, ''),
        artist: customArtist.trim() || '本地文件',
        audioUrl: src,
        artworkUrl: customArtwork.trim(),
      })
      setCustomTitle('')
      setCustomArtist('')
      setCustomArtwork('')
      setPanel('library')
    }
    reader.readAsDataURL(file)
  }

  function togglePlayPause() {
    const audio = audioRef.current
    const track = playingTrack ?? sharedNowPlaying

    const startFallback = () => {
      if (library.length > 0) playLibraryTrack(library[0])
      else if (results.length > 0) playPreview(results[0])
      else setOpen(true)
    }

    if (!track?.audioUrl?.trim()) {
      startFallback()
      return
    }

    if (!audioElementMatchesUrl(audio, track.audioUrl)) {
      audio.pause()
      audio.src = track.audioUrl
      audio.load()
    }

    if (audio.paused) {
      void audio.play().catch(() => {
        setError('恢复播放失败，请重新选择歌曲。')
      })
    } else {
      audio.pause()
    }
  }

  function resolveCurrentForSkip(): PlayingTrack | null {
    const t = playingTrackRef.current ?? sharedNowPlaying
    if (t) return t
    const pid = playingId
    if (!pid) return null
    for (const x of libraryRef.current) {
      if (x.id === pid) {
        return {
          id: x.id,
          title: x.title,
          artist: x.artist,
          audioUrl: x.audioUrl,
          artworkUrl: x.artworkUrl,
          source: 'library',
        }
      }
    }
    for (const x of resultsRef.current) {
      if (`search-${x.id}` === pid) {
        return {
          id: `search-${x.id}`,
          title: x.trackName,
          artist: x.artistName,
          audioUrl: x.previewUrl,
          artworkUrl: x.artworkUrl ?? '',
          source: 'search',
        }
      }
    }
    return null
  }

  function buildFallbackSkipQueue(): PlayingTrack[] {
    if (libraryRef.current.length > 0) {
      return libraryRef.current.map((x) => ({
        id: x.id,
        title: x.title,
        artist: x.artist,
        audioUrl: x.audioUrl,
        artworkUrl: x.artworkUrl,
        source: 'library' as const,
      }))
    }
    return resultsRef.current.map((x) => ({
      id: `search-${x.id}`,
      title: x.trackName,
      artist: x.artistName,
      audioUrl: x.previewUrl,
      artworkUrl: x.artworkUrl ?? '',
      source: 'search' as const,
    }))
  }

  function playOffset(offset: -1 | 1) {
    void (async () => {
      const mode = playModeRef.current
      const current = resolveCurrentForSkip()

      if (!current) {
        const queue = buildFallbackSkipQueue()
        if (!queue.length) {
          setOpen(true)
          return
        }
        if (mode === 'heartbeat') {
          const picked = pickHeartbeatSimilar(queue[0])
          if (!picked) {
            setOpen(true)
            return
          }
          await playTrack(picked)
          return
        }
        if (mode === 'shuffle') {
          await playTrack(queue[Math.floor(Math.random() * queue.length)])
          return
        }
        const nextIdx = (offset + queue.length) % queue.length
        await playTrack(queue[nextIdx])
        return
      }

      const queue = buildQueueForAnchor(current)
      if (!queue.length) {
        setOpen(true)
        return
      }

      if (mode === 'heartbeat') {
        const picked = pickHeartbeatSimilar(current)
        if (!picked) {
          wipePlaybackState()
          return
        }
        await playTrack(picked)
        return
      }

      const idx = queue.findIndex((x) => x.id === current.id)
      const base = idx >= 0 ? idx : 0

      if (mode === 'shuffle') {
        let nextIndex = Math.floor(Math.random() * queue.length)
        if (queue.length > 1 && nextIndex === base) {
          nextIndex = (nextIndex + 1) % queue.length
        }
        await playTrack(queue[nextIndex])
        return
      }

      // 列表循环、单曲循环：手动切歌按队列顺序上一首 / 下一首（单曲循环仅在自然结束单曲重播）
      const nextIndex = (base + offset + queue.length) % queue.length
      await playTrack(queue[nextIndex])
    })()
  }

  return (
    <div
      className="flex h-full w-full min-h-0 flex-col overflow-hidden p-2.5 shadow-[var(--phone-shadow)]"
      style={{
        background: theme.surface,
        borderRadius: 'var(--phone-radius-md)',
        border: `1px solid ${theme.border}`,
      }}
    >
      <Pressable
        className="flex h-full w-full min-h-0 flex-col"
        onClick={() => {
          setPanel('menu')
          setOpen(true)
        }}
        aria-label="打开音乐搜索"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <div className="flex min-h-0 flex-1 items-center justify-center py-0.5">
            <div className="relative flex w-full items-center justify-center">
              {/* 唱片指针 */}
              <div
                className="pointer-events-none absolute -top-1 left-1/2 z-20 h-10 w-1.5 -translate-x-1/2 rounded-full"
                style={{
                  background: theme.textMuted,
                  transformOrigin: 'top center',
                  transform: `translateX(-50%) rotate(${isPlaying ? 16 : 0}deg)`,
                  transition: 'transform 260ms ease',
                }}
                aria-hidden
              >
                <span
                  className="absolute -left-1.5 -top-1.5 block h-4 w-4 rounded-full border"
                  style={{ borderColor: theme.border, background: theme.surface }}
                />
              </div>

              {/* 黑胶唱片：圆形 + 播放时顺时针旋转 */}
              <div
                className="relative aspect-square w-full max-w-[132px] shrink-0 overflow-hidden rounded-full border"
                style={{
                  borderColor: theme.border,
                  background: `linear-gradient(145deg, ${music.coverTint}, ${theme.surfaceMuted})`,
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    animation: 'phone-record-spin 8s linear infinite',
                    animationPlayState: isPlaying ? 'running' : 'paused',
                    transformOrigin: 'center center',
                    willChange: 'transform',
                  }}
                >
                  {currentCover ? (
                    <img
                      src={currentCover}
                      alt={`${playingTrack?.title ?? '当前歌曲'} 专辑封面`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  {/* 黑胶细纹：轻微同心圆 */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'repeating-radial-gradient(circle at center, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 3px)',
                      mixBlendMode: 'soft-light',
                      opacity: 0.45,
                    }}
                    aria-hidden
                  />
                  {/* 轻微高光扫过：提升唱片质感 */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'conic-gradient(from 220deg at 50% 50%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.18) 26deg, rgba(255,255,255,0) 64deg, rgba(255,255,255,0) 360deg)',
                      mixBlendMode: 'screen',
                      opacity: 0.42,
                    }}
                    aria-hidden
                  />
                </div>
                <div
                  className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                  style={{ borderColor: theme.border, background: `${theme.surface}dd` }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-center gap-5 px-0.5 pt-1.5">
          <Pressable
            aria-label="上一首"
            onClick={(e) => {
              e.stopPropagation()
              playOffset(-1)
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ color: theme.textMuted }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
              <path d="M5 5v14" />
              <path d="M19 5v14L9 12l10-7Z" />
            </svg>
          </Pressable>
          <Pressable
            aria-label="播放暂停"
            onClick={(e) => {
              e.stopPropagation()
              togglePlayPause()
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: theme.text, color: theme.surface }}
          >
            {isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7-11-7Z" />
              </svg>
            )}
          </Pressable>
          <Pressable
            aria-label="下一首"
            onClick={(e) => {
              e.stopPropagation()
              playOffset(1)
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ color: theme.textMuted }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
              <path d="M19 5v14" />
              <path d="M5 5v14l10-7L5 5Z" />
            </svg>
          </Pressable>
        </div>
      </Pressable>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[78vh] w-full max-w-[360px] flex-col rounded-[16px] border p-3"
            style={{ borderColor: theme.border, background: theme.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-medium" style={{ color: theme.text }}>
                音乐面板
              </p>
              <Pressable
                onClick={() => setOpen(false)}
                className="ml-auto rounded-[10px] border px-2 py-1 text-[11px]"
                style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.textMuted }}
              >
                关闭
              </Pressable>
            </div>

            {panel === 'menu' ? (
              <div className="mt-3">
                <div className="mb-2 flex items-start gap-2">
                  <span className="shrink-0 pt-0.5 text-[10px] opacity-70">播放模式</span>
                  {playModeButtonRow}
                </div>
                <div className="grid grid-cols-2 gap-2">
                <Pressable
                  onClick={() => setPanel('library')}
                  className="rounded-[12px] border px-3 py-4 text-center text-[12px] font-medium"
                  style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.text }}
                >
                  我的音乐
                </Pressable>
                <Pressable
                  onClick={() => setPanel('search')}
                  className="rounded-[12px] border px-3 py-4 text-center text-[12px] font-medium"
                  style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.text }}
                >
                  搜索音乐
                </Pressable>
                </div>
                <div
                  className="mt-2 flex items-center gap-2 rounded-full border px-1.5 py-1.5"
                  style={{ borderColor: theme.border, background: theme.surfaceMuted }}
                >
                  <div
                    className="h-11 w-11 shrink-0 overflow-hidden rounded-full border"
                    style={{ borderColor: theme.border, background: theme.surface }}
                  >
                    {currentCover ? (
                      <img src={currentCover} alt="当前播放封面" className="h-full w-full object-cover" loading="lazy" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[13px] font-medium" style={{ color: theme.text }}>
                      {playingTrack?.title || music.trackTitle || '静候播放'}
                    </p>
                    <p className="line-clamp-1 text-[11px]" style={{ color: theme.textMuted }}>
                      {playingTrack?.artist || music.artistName || '本地音乐'}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <div
                        className="h-1 w-full overflow-hidden rounded-full"
                        style={{ background: `${theme.textMuted}33` }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
                            background: theme.text,
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-[10px]" style={{ color: theme.textMuted }}>
                        {Math.max(0, Math.floor(currentTime / 60))}:{String(Math.max(0, Math.floor(currentTime) % 60)).padStart(2, '0')}
                        {' / '}
                        {Math.max(0, Math.floor(duration / 60))}:{String(Math.max(0, Math.floor(duration) % 60)).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                  <Pressable
                    aria-label="播放暂停"
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePlayPause()
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                    style={{ borderColor: theme.border, color: theme.text }}
                  >
                    {isPlaying ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7-11-7Z" />
                      </svg>
                    )}
                  </Pressable>
                  <Pressable
                    aria-label="喜欢"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleCurrentTrackLike()
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                    style={{
                      borderColor: theme.border,
                      color: isCurrentTrackLiked() ? '#ff4d4f' : '#9ca3af',
                    }}
                  >
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 21s-6.7-4.35-9.2-8.03C.64 9.6 2.07 5.5 5.8 4.6c2.2-.54 4.38.23 5.7 2.01 1.32-1.78 3.5-2.55 5.7-2.01 3.73.9 5.16 5 2.99 8.37C18.7 16.65 12 21 12 21z" />
                    </svg>
                  </Pressable>
                </div>
              </div>
            ) : null}

            {panel === 'search' ? (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    className="flex-1 rounded-[10px] border px-2 py-1.5 text-[12px] outline-none"
                    style={{
                      borderColor: theme.border,
                      background: theme.surfaceMuted,
                      color: theme.text,
                    }}
                    placeholder="搜索歌曲 / 歌手"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void searchTracks()
                    }}
                  />
                  <Pressable
                    onClick={() => void searchTracks()}
                    className="rounded-[10px] border px-2 py-1.5 text-[11px]"
                    style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
                  >
                    搜索
                  </Pressable>
                </div>
                <p className="mt-1 text-[10px] opacity-70">{emptyHint}</p>
              </>
            ) : null}

            {panel === 'library' ? (
              <div className="mt-2 rounded-[10px] border p-2" style={{ borderColor: theme.border, background: theme.surfaceMuted }}>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-medium" style={{ color: theme.text }}>
                    我的音乐导入
                  </p>
                  <Pressable
                    onClick={() => setShowImport((v) => !v)}
                    className="ml-auto rounded-[8px] border px-2 py-1 text-[10px]"
                    style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
                  >
                    {showImport ? '收起导入' : '+ 导入'}
                  </Pressable>
                </div>
                <input
                  ref={customFileRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    void onPickLocalFile(f)
                    e.currentTarget.value = ''
                  }}
                />
                {showImport ? (
                  <div className="mt-2 rounded-[8px] border p-2" style={{ borderColor: theme.border, background: theme.surface }}>
                    <div className="flex gap-2">
                      <Pressable
                        onClick={() => setImportMode('url')}
                        className="rounded-[8px] border px-2 py-1 text-[10px]"
                        style={{
                          borderColor: theme.border,
                          background: importMode === 'url' ? theme.text : theme.surfaceMuted,
                          color: importMode === 'url' ? theme.surface : theme.textMuted,
                        }}
                      >
                        URL导入
                      </Pressable>
                      <Pressable
                        onClick={() => {
                          setImportMode('local')
                          customFileRef.current?.click()
                        }}
                        className="rounded-[8px] border px-2 py-1 text-[10px]"
                        style={{
                          borderColor: theme.border,
                          background: importMode === 'local' ? theme.text : theme.surfaceMuted,
                          color: importMode === 'local' ? theme.surface : theme.textMuted,
                        }}
                      >
                        本地导入
                      </Pressable>
                    </div>

                    {importMode === 'url' ? (
                      <>
                        <input
                          className="mt-1 w-full rounded-[8px] border px-2 py-1 text-[11px] outline-none"
                          style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.text }}
                          placeholder="标题（可选）"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                        />
                        <input
                          className="mt-1 w-full rounded-[8px] border px-2 py-1 text-[11px] outline-none"
                          style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.text }}
                          placeholder="歌手（可选）"
                          value={customArtist}
                          onChange={(e) => setCustomArtist(e.target.value)}
                        />
                        <input
                          className="mt-1 w-full rounded-[8px] border px-2 py-1 text-[11px] outline-none"
                          style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.text }}
                          placeholder="音频链接 URL"
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                        />
                        <input
                          className="mt-1 w-full rounded-[8px] border px-2 py-1 text-[11px] outline-none"
                          style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.text }}
                          placeholder="封面 URL（可选）"
                          value={customArtwork}
                          onChange={(e) => setCustomArtwork(e.target.value)}
                        />
                        <Pressable
                          onClick={addCustomByUrl}
                          className="mt-2 rounded-[8px] border px-2 py-1.5 text-[11px]"
                          style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
                        >
                          确认导入
                        </Pressable>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {panel === 'library' ? (
              <div className="mt-1 flex items-start gap-2">
                <span className="shrink-0 pt-0.5 text-[10px] opacity-70">播放模式</span>
                {playModeButtonRow}
              </div>
            ) : null}

            {panel !== 'menu' ? (
              <div className="mt-1">
                <Pressable
                  onClick={() => setPanel('menu')}
                  className="rounded-[8px] border px-2 py-1 text-[10px]"
                  style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.textMuted }}
                >
                  返回选择
                </Pressable>
              </div>
            ) : null}

            {loading ? <p className="mt-2 text-[11px] opacity-70">搜索中...</p> : null}
            {error ? (
              <p className="mt-2 text-[11px]" style={{ color: '#d4380d' }}>
                {error}
              </p>
            ) : null}

            <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {(panel === 'menu' ? [] : panel === 'library' ? library : results).map((track) => (
                <Pressable
                  key={track.id}
                  onClick={() =>
                    panel === 'library'
                      ? playLibraryTrack(track as LibraryTrack)
                      : playPreview(track as SearchTrack)
                  }
                  className="w-full rounded-[10px] border px-2 py-1.5 text-left"
                  style={{
                    borderColor: theme.border,
                    background:
                      playingId ===
                      (panel === 'library'
                        ? (track as LibraryTrack).id
                        : `search-${(track as SearchTrack).id}`)
                        ? theme.surface
                        : theme.surfaceMuted,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-10 w-10 shrink-0 overflow-hidden rounded-[8px] border"
                      style={{ borderColor: theme.border, background: theme.surface }}
                    >
                      {(track as SearchTrack).artworkUrl || (track as LibraryTrack).artworkUrl ? (
                        <img
                          src={(track as SearchTrack).artworkUrl || (track as LibraryTrack).artworkUrl}
                          alt={`${panel === 'library' ? (track as LibraryTrack).title : (track as SearchTrack).trackName} 封面`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[12px]" style={{ color: theme.text }}>
                        {panel === 'library' ? (track as LibraryTrack).title : (track as SearchTrack).trackName}
                      </p>
                      <p className="line-clamp-1 text-[10px]" style={{ color: theme.textMuted }}>
                        {panel === 'library' ? (track as LibraryTrack).artist : (track as SearchTrack).artistName}
                        {playingId ===
                        (panel === 'library'
                          ? (track as LibraryTrack).id
                          : `search-${(track as SearchTrack).id}`)
                          ? ' · 正在播放'
                          : ' · 点击试听'}
                      </p>
                    </div>
                    {panel === 'search' ? (
                      <Pressable
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleLike(track as SearchTrack)
                        }}
                        className="ml-1 flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ color: isSearchLiked(track as SearchTrack) ? '#ff4d4f' : '#9ca3af' }}
                        aria-label="喜欢"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 21s-6.7-4.35-9.2-8.03C.64 9.6 2.07 5.5 5.8 4.6c2.2-.54 4.38.23 5.7 2.01 1.32-1.78 3.5-2.55 5.7-2.01 3.73.9 5.16 5 2.99 8.37C18.7 16.65 12 21 12 21z" />
                        </svg>
                      </Pressable>
                    ) : null}
                    {panel === 'library' ? (
                      <Pressable
                        onClick={(e) => {
                          e.stopPropagation()
                          removeLibraryTrack((track as LibraryTrack).id)
                        }}
                        className="ml-1 flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ color: '#9ca3af' }}
                        aria-label="删除"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </Pressable>
                    ) : null}
                  </div>
                </Pressable>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
