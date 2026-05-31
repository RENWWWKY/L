import { useCallback, useSyncExternalStore } from 'react'

import type { PlaySongContext } from './listenPlayMode'
import {
  getListenTogetherPlayerSnapshot,
  listenTogetherPlayerEngine,
  subscribeListenTogetherPlayer,
} from './listenTogetherPlayerEngine'
import type { NeteaseSongItem } from './neteaseMusicApi'
import type { ListenAttachedMusic } from './listenTogetherNotesMock'

function getEngineSnapshot() {
  return getListenTogetherPlayerSnapshot()
}

export function useListenTogetherPlayer() {
  const snapshot = useSyncExternalStore(
    subscribeListenTogetherPlayer,
    getEngineSnapshot,
    getEngineSnapshot,
  )

  const playSong = useCallback(
    (song: NeteaseSongItem, context?: PlaySongContext) =>
      listenTogetherPlayerEngine.playSong(song, context),
    [],
  )

  const playAttachedMusic = useCallback(
    (music: ListenAttachedMusic) => listenTogetherPlayerEngine.playAttachedMusic(music),
    [],
  )

  const togglePlay = useCallback(() => listenTogetherPlayerEngine.togglePlay(), [])
  const playNext = useCallback(() => listenTogetherPlayerEngine.playNext(), [])
  const playPrev = useCallback(() => listenTogetherPlayerEngine.playPrev(), [])
  const cyclePlayMode = useCallback(() => listenTogetherPlayerEngine.cyclePlayMode(), [])
  const startHeartModePlayback = useCallback(
    (seed: NeteaseSongItem, likedPlaylistId: number) =>
      listenTogetherPlayerEngine.startHeartModePlayback(seed, likedPlaylistId),
    [],
  )
  const seekTo = useCallback((percentage: number) => listenTogetherPlayerEngine.seekTo(percentage), [])
  const seekToTimeMs = useCallback(
    (timeMs: number) => listenTogetherPlayerEngine.seekToTimeMs(timeMs),
    [],
  )
  const clearPlayError = useCallback(() => listenTogetherPlayerEngine.clearPlayError(), [])

  return {
    nowPlaying: snapshot.nowPlaying,
    isPlaying: snapshot.isPlaying,
    progress: snapshot.progress,
    currentTimeMs: snapshot.currentTimeMs,
    durationMs: snapshot.durationMs,
    lyrics: snapshot.lyrics,
    playError: snapshot.playError,
    playMode: snapshot.playMode,
    canUseHeartMode: snapshot.canUseHeartMode,
    playSong,
    playAttachedMusic,
    togglePlay,
    playNext,
    playPrev,
    cyclePlayMode,
    startHeartModePlayback,
    seekTo,
    seekToTimeMs,
    clearPlayError,
  }
}
