import {
  getNextPlayMode,
  normalizePlayMode,
  pickRandomQueueIndex,
  PLAY_MODE_LABELS,
  type ListenPlayMode,
  type PlayQueueMeta,
  type PlaySongContext,
} from './listenPlayMode'
import { loadNeteaseCookie } from './neteaseApiClient'
import { getNeteaseListenSessionSync } from './neteaseListenSession'
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
import { useMusicStore, type MusicTrack } from '../../stores/useMusicStore'

const EMPTY_TRACK: ListenAttachedMusic = {
  title: '暂无播放',
  artist: '搜索或点歌单开始播放',
  cover: '',
}

const DEFAULT_QUEUE_META: PlayQueueMeta = {
  playlistId: 0,
  isLikedPlaylist: false,
}

const PROGRESS_THROTTLE_MS = 280
const AUDIO_LOAD_TIMEOUT_MS = 18_000

let audioRef: HTMLAudioElement | null = null
let queueRef: NeteaseSongItem[] = []
let queueIndexRef = 0
let queueMetaRef: PlayQueueMeta = { ...DEFAULT_QUEUE_META }
let playModeRef: ListenPlayMode = 'repeatAll'

let nowPlaying: ListenAttachedMusic = EMPTY_TRACK
let isPlaying = false
let progress = 0
let currentTimeMs = 0
let durationMs = 0
let lyrics: ParsedLyricLine[] = []
let playError: string | null = null
let playMode: ListenPlayMode = 'repeatAll'
let canUseHeartMode = false

let engineReady = false
const engineListeners = new Set<() => void>()

export function subscribeListenTogetherPlayer(listener: () => void): () => void {
  engineListeners.add(listener)
  return () => engineListeners.delete(listener)
}

export type EngineSnapshot = {
  nowPlaying: ListenAttachedMusic
  isPlaying: boolean
  progress: number
  currentTimeMs: number
  durationMs: number
  lyrics: ParsedLyricLine[]
  playError: string | null
  playMode: ListenPlayMode
  canUseHeartMode: boolean
}

let engineSnapshot: EngineSnapshot = {
  nowPlaying: EMPTY_TRACK,
  isPlaying: false,
  progress: 0,
  currentTimeMs: 0,
  durationMs: 0,
  lyrics: [],
  playError: null,
  playMode: 'repeatAll',
  canUseHeartMode: false,
}

function refreshEngineSnapshot() {
  engineSnapshot = {
    nowPlaying,
    isPlaying,
    progress,
    currentTimeMs,
    durationMs,
    lyrics,
    playError,
    playMode,
    canUseHeartMode,
  }
}

function engineStateChanged(): boolean {
  return (
    engineSnapshot.nowPlaying !== nowPlaying ||
    engineSnapshot.isPlaying !== isPlaying ||
    engineSnapshot.progress !== progress ||
    engineSnapshot.currentTimeMs !== currentTimeMs ||
    engineSnapshot.durationMs !== durationMs ||
    engineSnapshot.lyrics !== lyrics ||
    engineSnapshot.playError !== playError ||
    engineSnapshot.playMode !== playMode ||
    engineSnapshot.canUseHeartMode !== canUseHeartMode
  )
}

function notifyEngineListeners() {
  if (!engineStateChanged()) return
  refreshEngineSnapshot()
  engineListeners.forEach((listener) => listener())
}

function attachedToTrack(music: ListenAttachedMusic): MusicTrack | null {
  if (!music.songId || music.title === '暂无播放') return null
  return {
    id: music.songId,
    title: music.title,
    artist: music.artist,
    cover: music.cover,
  }
}

function pushStateToStore() {
  const track = attachedToTrack(nowPlaying)
  const store = useMusicStore.getState()
  const nextFloatingVisible = Boolean(track && track.id > 0 && track.title !== '暂无播放' && !store.isInsideListenTogether)
  const unchanged =
    store.currentTrack?.id === track?.id &&
    store.currentTrack?.title === track?.title &&
    store.isPlaying === isPlaying &&
    store.listenPlayMode === playMode &&
    store.progress === progress &&
    store.currentTimeMs === currentTimeMs &&
    store.durationMs === durationMs &&
    store.playError === playError &&
    store.canUseHeartMode === canUseHeartMode &&
    store.lyrics === lyrics &&
    store.isFloatingOrbVisible === nextFloatingVisible

  if (!unchanged) {
    useMusicStore.getState()._syncEngineState({
      currentTrack: track,
      isPlaying,
      listenPlayMode: playMode,
      progress,
      currentTimeMs,
      durationMs,
      playError,
      canUseHeartMode,
      lyrics,
    })
  }
  notifyEngineListeners()
}

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

async function resolveNextSong(): Promise<NeteaseSongItem | null> {
  const queue = queueRef
  if (queue.length === 0) return null

  const mode = playModeRef
  const meta = queueMetaRef
  const currentIdx = queueIndexRef

  if (mode === 'repeatOne') {
    return queue[currentIdx] ?? queue[0] ?? null
  }

  if (mode === 'heart' && meta.isLikedPlaylist && meta.playlistId > 0) {
    const current = queue[currentIdx] ?? queue[0]
    if (!current) return null
    const cookie = loadNeteaseCookie()
    if (!cookie) return null
    try {
      const recommended = await fetchHeartModeNextSongs(cookie, current.id, meta.playlistId, 1)
      if (recommended[0]) {
        const next = recommended[0]
        const existingIdx = queue.findIndex((s) => s.id === next.id)
        if (existingIdx >= 0) return queue[existingIdx]
        queueRef = [...queue, next]
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
}

async function playNextInternal() {
  const queue = queueRef
  if (queue.length === 0) return
  const next = await resolveNextSong()
  if (!next) return
  const nextIdx = queueRef.findIndex((s) => s.id === next.id)
  await playSongInternal(next, { advanceQueueIndex: nextIdx >= 0 ? nextIdx : 0 })
}

async function playSongInternal(
  song: NeteaseSongItem,
  opts?: { advanceQueueIndex?: number },
): Promise<boolean> {
  const session = getNeteaseListenSessionSync()
  if (!session.isActive) {
    playError = '请先登录网易云或选择游客进入'
    pushStateToStore()
    return false
  }
  const cookie = session.cookie
  if (opts?.advanceQueueIndex !== undefined) {
    queueIndexRef = opts.advanceQueueIndex
  }
  playError = null

  let track = song
  if (track.name === '未知歌曲' || track.artist === '未知歌手') {
    try {
      const enriched = await fetchNeteaseSongDetails(cookie, [track.id])
      if (enriched[0]) track = enriched[0]
    } catch {
      /* 保留原 track */
    }
  }
  nowPlaying = songToAttached(track)
  pushStateToStore()

  try {
    let { playUrl: url, lyrics: lyricLines } = await resolveSongPlayback(cookie, track.id)
    if (!url) {
      playError = '无法获取播放地址（可能无版权或需会员）'
      isPlaying = false
      pushStateToStore()
      return false
    }
    lyrics = lyricLines.length > 0 ? lyricLines : [{ timeMs: 0, text: '暂无歌词' }]
    currentTimeMs = 0
    durationMs = 0
    progress = 0
    const audio = audioRef
    if (!audio) return false

    const tryPlay = async (playUrl: string) => loadAndPlayUrl(audio, playUrl)

    try {
      await tryPlay(url)
    } catch {
      await clearSongPlaybackCache(track.id)
      const fresh = await resolveSongPlayback(cookie, track.id)
      url = fresh.playUrl
      if (lyricLines.length === 0 && fresh.lyrics.length > 0) {
        lyrics = fresh.lyrics
      }
      if (!url) throw new Error('no url')
      await tryPlay(url)
    }
    return true
  } catch (e) {
    playError = formatPlaybackError(e)
    isPlaying = false
    pushStateToStore()
    return false
  }
}

function applyPlayContext(song: NeteaseSongItem, context?: PlaySongContext) {
  if (context?.queue?.length) {
    queueRef = context.queue
    const idx =
      context.index !== undefined ? context.index : context.queue.findIndex((t) => t.id === song.id)
    queueIndexRef = idx >= 0 ? idx : 0
    queueMetaRef = {
      playlistId: context.playlistId ?? 0,
      isLikedPlaylist: Boolean(context.isLikedPlaylist),
    }
  } else {
    queueRef = [song]
    queueIndexRef = 0
    queueMetaRef = { ...DEFAULT_QUEUE_META }
  }

  const heart = Boolean(context?.isLikedPlaylist)
  canUseHeartMode = heart
  playMode = normalizePlayMode(playMode, heart)
  playModeRef = playMode
}

export function ensureListenTogetherPlayerEngine(): void {
  if (engineReady) return
  engineReady = true

  const audio = new Audio()
  audio.preload = 'auto'
  audio.setAttribute('playsinline', 'true')
  audio.setAttribute('webkit-playsinline', 'true')
  audioRef = audio

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
    progress = next
    currentTimeMs = Math.round(audio.currentTime * 1000)
    durationMs = Math.round(d * 1000)
    pushStateToStore()
  }

  const onTime = () => syncProgressFromAudio(false)
  const onDurationChange = () => syncProgressFromAudio(true)
  const onPlay = () => {
    isPlaying = true
    pushStateToStore()
  }
  const onPause = () => {
    isPlaying = false
    pushStateToStore()
  }
  const onEnded = () => {
    isPlaying = false
    progress = 0
    currentTimeMs = 0
    pushStateToStore()
    void playNextInternal()
  }

  audio.addEventListener('timeupdate', onTime)
  audio.addEventListener('durationchange', onDurationChange)
  audio.addEventListener('loadedmetadata', onDurationChange)
  audio.addEventListener('play', onPlay)
  audio.addEventListener('pause', onPause)
  audio.addEventListener('ended', onEnded)

  pushStateToStore()
}

export function getListenTogetherPlayerSnapshot(): EngineSnapshot {
  ensureListenTogetherPlayerEngine()
  return engineSnapshot
}

export const listenTogetherPlayerEngine = {
  getSnapshot(): EngineSnapshot {
    return engineSnapshot
  },

  async playSong(song: NeteaseSongItem, context?: PlaySongContext) {
    ensureListenTogetherPlayerEngine()
    applyPlayContext(song, context)
    return playSongInternal(song)
  },

  async playAttachedMusic(music: ListenAttachedMusic) {
    ensureListenTogetherPlayerEngine()
    if (music.songId) {
      await listenTogetherPlayerEngine.playSong({
        id: music.songId,
        name: music.title,
        artist: music.artist,
        cover: music.cover,
      })
      return
    }
    nowPlaying = music
    lyrics = [{ timeMs: 0, text: '暂无歌词' }]
    playError = '该条目无歌曲 ID，无法从网易云播放'
    pushStateToStore()
  },

  togglePlay() {
    const audio = audioRef
    if (!audio?.src) return
    if (audio.paused) {
      void audio.play().catch((e) => {
        playError = formatPlaybackError(e)
        pushStateToStore()
      })
    } else {
      audio.pause()
    }
  },

  async playNext() {
    await playNextInternal()
  },

  async playPrev() {
    const queue = queueRef
    if (queue.length === 0) return
    const mode = playModeRef
    let prevIdx: number
    if (mode === 'shuffle') {
      prevIdx = pickRandomQueueIndex(queue.length, queueIndexRef)
    } else {
      prevIdx = queueIndexRef - 1
      if (prevIdx < 0) prevIdx = queue.length - 1
    }
    const prev = queue[prevIdx]
    if (!prev) return
    await playSongInternal(prev, { advanceQueueIndex: prevIdx })
  },

  cyclePlayMode() {
    playMode = getNextPlayMode(playMode, queueMetaRef.isLikedPlaylist)
    playModeRef = playMode
    pushStateToStore()
    useMusicStore.getState().showPlayModeToast(PLAY_MODE_LABELS[playMode])
  },

  async startHeartModePlayback(seed: NeteaseSongItem, likedPlaylistId: number) {
    if (!seed?.id) return false
    const ctx = likedPlaylistId
      ? {
          queue: [seed],
          index: 0,
          playlistId: likedPlaylistId,
          isLikedPlaylist: true as const,
        }
      : { queue: [seed], index: 0 }
    const ok = await listenTogetherPlayerEngine.playSong(seed, ctx)
    if (ok && likedPlaylistId) {
      playModeRef = 'heart'
      playMode = 'heart'
      canUseHeartMode = true
      pushStateToStore()
    }
    return ok
  },

  seekTo(percentage: number) {
    const audio = audioRef
    if (!audio) return
    const d = audio.duration
    if (!Number.isFinite(d) || d <= 0) return
    const pct = Math.max(0, Math.min(100, percentage))
    audio.currentTime = (pct / 100) * d
    progress = pct
    currentTimeMs = Math.round(audio.currentTime * 1000)
    durationMs = Math.round(d * 1000)
    pushStateToStore()
  },

  seekToTimeMs(timeMs: number) {
    const audio = audioRef
    if (!audio) return
    const d = audio.duration
    if (!Number.isFinite(d) || d <= 0) {
      listenTogetherPlayerEngine.seekTo(0)
      return
    }
    const clamped = Math.max(0, Math.min(timeMs, Math.round(d * 1000)))
    audio.currentTime = clamped / 1000
    const pct = (clamped / (d * 1000)) * 100
    progress = pct
    currentTimeMs = clamped
    durationMs = Math.round(d * 1000)
    pushStateToStore()
  },

  clearPlayError() {
    playError = null
    pushStateToStore()
  },
}
