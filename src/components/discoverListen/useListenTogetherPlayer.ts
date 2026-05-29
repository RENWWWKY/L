import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getNextPlayMode,
  normalizePlayMode,
  pickRandomQueueIndex,
  type ListenPlayMode,
  type PlayQueueMeta,
  type PlaySongContext,
} from './listenPlayMode'
import { loadNeteaseCookie } from './neteaseApiClient'
import {
  fetchHeartModeNextSongs,
  fetchNeteaseSongDetails,
  resolveSongPlayback,
  songToAttached,
  type NeteaseSongItem,
} from './neteaseMusicApi'
import { formatPlaybackError } from './playbackError'
import type { ParsedLyricLine } from './listenLyricParse'
import { clearSongPlaybackCache } from './listenTogetherPersistence'
import type { ListenAttachedMusic } from './listenTogetherNotesMock'

const EMPTY_TRACK: ListenAttachedMusic = {
  title: '暂无播放',
  artist: '登录后搜索或点歌单播放',
  cover: '',
}

const DEFAULT_QUEUE_META: PlayQueueMeta = {
  playlistId: 0,
  isLikedPlaylist: false,
}

/** 限制进度条刷新频率，避免 timeupdate 拖垮整页 React 渲染 */
const PROGRESS_THROTTLE_MS = 280
const AUDIO_LOAD_TIMEOUT_MS = 18_000

function waitForAudioCanPlay(audio: HTMLAudioElement): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('音频加载超时'))
    }, AUDIO_LOAD_TIMEOUT_MS)
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onErr = () => {
      cleanup()
      reject(new Error('failed to load'))
    }
    const cleanup = () => {
      window.clearTimeout(timer)
      audio.removeEventListener('canplay', onReady)
      audio.removeEventListener('error', onErr)
    }
    audio.addEventListener('canplay', onReady, { once: true })
    audio.addEventListener('error', onErr, { once: true })
  })
}

async function loadAndPlayUrl(audio: HTMLAudioElement, url: string): Promise<void> {
  audio.pause()
  audio.src = url
  audio.load()
  await waitForAudioCanPlay(audio)
  await audio.play()
}

export function useListenTogetherPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queueRef = useRef<NeteaseSongItem[]>([])
  const queueIndexRef = useRef(0)
  const queueMetaRef = useRef<PlayQueueMeta>({ ...DEFAULT_QUEUE_META })
  const playModeRef = useRef<ListenPlayMode>('repeatAll')
  const playSongInternalRef = useRef<
    (song: NeteaseSongItem, opts?: { advanceQueueIndex?: number }) => Promise<boolean>
  >(async () => false)

  const [nowPlaying, setNowPlaying] = useState<ListenAttachedMusic>(EMPTY_TRACK)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [lyrics, setLyrics] = useState<ParsedLyricLine[]>([])
  const [playError, setPlayError] = useState<string | null>(null)
  const [playMode, setPlayMode] = useState<ListenPlayMode>('repeatAll')
  const [canUseHeartMode, setCanUseHeartMode] = useState(false)

  useEffect(() => {
    playModeRef.current = playMode
  }, [playMode])

  const playSongInternal = useCallback(
    async (song: NeteaseSongItem, opts?: { advanceQueueIndex?: number }) => {
      const cookie = loadNeteaseCookie()
      if (!cookie) {
        setPlayError('请先登录网易云')
        return false
      }
      if (opts?.advanceQueueIndex !== undefined) {
        queueIndexRef.current = opts.advanceQueueIndex
      }
      setPlayError(null)

      let track = song
      if (track.name === '未知歌曲' || track.artist === '未知歌手') {
        try {
          const enriched = await fetchNeteaseSongDetails(cookie, [track.id])
          if (enriched[0]) track = enriched[0]
        } catch {
          /* 保留原 track，避免阻断播放 */
        }
      }
      setNowPlaying(songToAttached(track))

      try {
        let { playUrl: url, lyrics: lyricLines } = await resolveSongPlayback(cookie, track.id)
        if (!url) {
          setPlayError('无法获取播放地址（可能无版权或需会员）')
          setIsPlaying(false)
          return false
        }
        setLyrics(lyricLines.length > 0 ? lyricLines : [{ timeMs: 0, text: '暂无歌词' }])
        setCurrentTimeMs(0)
        setDurationMs(0)
        setProgress(0)
        const audio = audioRef.current
        if (!audio) return false

        const tryPlay = async (playUrl: string) => loadAndPlayUrl(audio, playUrl)

        try {
          await tryPlay(url)
        } catch {
          await clearSongPlaybackCache(track.id)
          const fresh = await resolveSongPlayback(cookie, track.id)
          url = fresh.playUrl
          if (lyricLines.length === 0 && fresh.lyrics.length > 0) {
            setLyrics(fresh.lyrics)
          }
          if (!url) throw new Error('no url')
          await tryPlay(url)
        }
        return true
      } catch (e) {
        setPlayError(formatPlaybackError(e))
        setIsPlaying(false)
        return false
      }
    },
    [],
  )

  playSongInternalRef.current = playSongInternal

  const applyPlayContext = useCallback((song: NeteaseSongItem, context?: PlaySongContext) => {
    if (context?.queue?.length) {
      queueRef.current = context.queue
      const idx =
        context.index !== undefined
          ? context.index
          : context.queue.findIndex((t) => t.id === song.id)
      queueIndexRef.current = idx >= 0 ? idx : 0
      queueMetaRef.current = {
        playlistId: context.playlistId ?? 0,
        isLikedPlaylist: Boolean(context.isLikedPlaylist),
      }
    } else {
      queueRef.current = [song]
      queueIndexRef.current = 0
      queueMetaRef.current = { ...DEFAULT_QUEUE_META }
    }

    const heart = Boolean(context?.isLikedPlaylist)
    setCanUseHeartMode(heart)
    setPlayMode((prev) => normalizePlayMode(prev, heart))
  }, [])

  const resolveNextSong = useCallback(async (): Promise<NeteaseSongItem | null> => {
    const queue = queueRef.current
    if (queue.length === 0) return null

    const mode = playModeRef.current
    const meta = queueMetaRef.current
    const currentIdx = queueIndexRef.current

    if (mode === 'repeatOne') {
      return queue[currentIdx] ?? queue[0] ?? null
    }

    if (mode === 'heart' && meta.isLikedPlaylist && meta.playlistId > 0) {
      const current = queue[currentIdx] ?? queue[0]
      if (!current) return null
      const cookie = loadNeteaseCookie()
      if (!cookie) return null
      try {
        const recommended = await fetchHeartModeNextSongs(
          cookie,
          current.id,
          meta.playlistId,
          1,
        )
        if (recommended[0]) {
          const next = recommended[0]
          const existingIdx = queue.findIndex((s) => s.id === next.id)
          if (existingIdx >= 0) {
            return queue[existingIdx]
          }
          queueRef.current = [...queue, next]
          return next
        }
      } catch {
        /* 心动接口失败时回退列表下一首 */
      }
    }

    if (mode === 'shuffle') {
      const nextIdx = pickRandomQueueIndex(queue.length, currentIdx)
      return queue[nextIdx] ?? null
    }

    const nextIdx = (currentIdx + 1) % queue.length
    return queue[nextIdx] ?? null
  }, [])

  const playNext = useCallback(async () => {
    const queue = queueRef.current
    if (queue.length === 0) return
    const next = await resolveNextSong()
    if (!next) return
    const nextIdx = queueRef.current.findIndex((s) => s.id === next.id)
    await playSongInternalRef.current(next, {
      advanceQueueIndex: nextIdx >= 0 ? nextIdx : 0,
    })
  }, [resolveNextSong])

  const playPrev = useCallback(async () => {
    const queue = queueRef.current
    if (queue.length === 0) return
    const mode = playModeRef.current
    let prevIdx: number
    if (mode === 'shuffle') {
      prevIdx = pickRandomQueueIndex(queue.length, queueIndexRef.current)
    } else {
      prevIdx = queueIndexRef.current - 1
      if (prevIdx < 0) prevIdx = queue.length - 1
    }
    const prev = queue[prevIdx]
    if (!prev) return
    await playSongInternalRef.current(prev, { advanceQueueIndex: prevIdx })
  }, [])

  const handleTrackEnded = useCallback(() => {
    void playNext()
  }, [playNext])

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    audio.setAttribute('playsinline', 'true')
    audio.setAttribute('webkit-playsinline', 'true')
    audioRef.current = audio

    let lastProgressEmit = 0
    let lastProgressValue = -1

    const syncProgressFromAudio = (force = false) => {
      const d = audio.duration
      if (!Number.isFinite(d) || d <= 0) return
      const next = Math.min(100, (audio.currentTime / d) * 100)
      const now = performance.now()
      const nearEnd = next >= 99.5
      if (
        !force &&
        !nearEnd &&
        now - lastProgressEmit < PROGRESS_THROTTLE_MS &&
        Math.abs(next - lastProgressValue) < 0.35
      ) {
        return
      }
      lastProgressEmit = now
      lastProgressValue = next
      setProgress(next)
      setCurrentTimeMs(Math.round(audio.currentTime * 1000))
      setDurationMs(Math.round(d * 1000))
    }

    const onTime = () => syncProgressFromAudio(false)
    const onDurationChange = () => syncProgressFromAudio(true)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      setIsPlaying(false)
      setProgress(0)
      setCurrentTimeMs(0)
      handleTrackEnded()
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('loadedmetadata', onDurationChange)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('loadedmetadata', onDurationChange)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audioRef.current = null
    }
  }, [handleTrackEnded])

  const playSong = useCallback(
    async (song: NeteaseSongItem, context?: PlaySongContext) => {
      applyPlayContext(song, context)
      return playSongInternal(song)
    },
    [applyPlayContext, playSongInternal],
  )

  const playAttachedMusic = useCallback(
    async (music: ListenAttachedMusic) => {
      if (music.songId) {
        await playSong({
          id: music.songId,
          name: music.title,
          artist: music.artist,
          cover: music.cover,
        })
        return
      }
      setNowPlaying(music)
      setLyrics([{ timeMs: 0, text: '暂无歌词' }])
      setPlayError('该条目无歌曲 ID，无法从网易云播放')
    },
    [playSong],
  )

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio?.src) return
    if (audio.paused) {
      void audio.play().catch((e) => setPlayError(formatPlaybackError(e)))
    } else {
      audio.pause()
    }
  }, [])

  const cyclePlayMode = useCallback(() => {
    setPlayMode((prev) => getNextPlayMode(prev, queueMetaRef.current.isLikedPlaylist))
  }, [])

  const seekTo = useCallback((percentage: number) => {
    const audio = audioRef.current
    if (!audio) return
    const d = audio.duration
    if (!Number.isFinite(d) || d <= 0) return
    const pct = Math.max(0, Math.min(100, percentage))
    audio.currentTime = (pct / 100) * d
    const next = pct
    setProgress(next)
    setCurrentTimeMs(Math.round(audio.currentTime * 1000))
    setDurationMs(Math.round(d * 1000))
  }, [])

  const seekToTimeMs = useCallback(
    (timeMs: number) => {
      const audio = audioRef.current
      if (!audio) return
      const d = audio.duration
      if (!Number.isFinite(d) || d <= 0) {
        seekTo(0)
        return
      }
      const clamped = Math.max(0, Math.min(timeMs, Math.round(d * 1000)))
      audio.currentTime = clamped / 1000
      const pct = (clamped / (d * 1000)) * 100
      setProgress(pct)
      setCurrentTimeMs(clamped)
      setDurationMs(Math.round(d * 1000))
    },
    [seekTo],
  )

  return {
    nowPlaying,
    isPlaying,
    progress,
    currentTimeMs,
    durationMs,
    lyrics,
    playError,
    playMode,
    canUseHeartMode,
    playSong,
    playAttachedMusic,
    togglePlay,
    playNext,
    playPrev,
    cyclePlayMode,
    seekTo,
    seekToTimeMs,
    clearPlayError: () => setPlayError(null),
  }
}
