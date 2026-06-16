import { create } from 'zustand'

import { LISTEN_TOGETHER_TOAST_MS } from '../components/discoverListen/ListenTogetherActionToast'
import type { ParsedLyricLine } from '../components/discoverListen/listenLyricParse'
import type { ListenPlayMode } from '../components/discoverListen/listenPlayMode'

export type MusicPlayMode = 'sequence' | 'loop' | 'random'

export type MusicTrack = {
  id: number
  title: string
  artist: string
  cover: string
  /** 主唱歌手 id（有则全屏页可跳转歌手主页） */
  artistId?: number
}

export type SyncListeningProfile = {
  name: string
  avatar: string
}

export type SyncListeningState = {
  companion: SyncListeningProfile
  user: SyncListeningProfile
}

export type DesktopLyricLines = 1 | 2

export function listenModeToUiMode(mode: ListenPlayMode): MusicPlayMode {
  if (mode === 'repeatOne') return 'loop'
  if (mode === 'shuffle') return 'random'
  return 'sequence'
}

type EngineSyncPayload = {
  currentTrack: MusicTrack | null
  isPlaying: boolean
  listenPlayMode: ListenPlayMode
  progress: number
  currentTimeMs: number
  durationMs: number
  playError: string | null
  canUseHeartMode: boolean
  lyrics: ParsedLyricLine[]
}

type MusicStoreState = {
  currentTrack: MusicTrack | null
  isPlaying: boolean
  playMode: MusicPlayMode
  listenPlayMode: ListenPlayMode
  /** 悬浮球是否可见（离开听一听且有曲目时） */
  isFloatingOrbVisible: boolean
  isInsideListenTogether: boolean
  progress: number
  currentTimeMs: number
  durationMs: number
  playError: string | null
  canUseHeartMode: boolean
  lyrics: ParsedLyricLine[]
  popoverOpen: boolean
  orbEdgeHidden: boolean
  playModeToast: string | null
  isDesktopLyricOpen: boolean
  desktopLyricLocked: boolean
  desktopLyricLines: DesktopLyricLines
  desktopLyricPos: { x: number; y: number }
  /** 是否已计算/保存过位置（避免重复居中导致跳动） */
  desktopLyricPosReady: boolean
  syncListening: SyncListeningState | null
  /** 全局全屏歌词/播放页（悬浮球等直接唤起，不经发现页） */
  isListenFullscreenOpen: boolean

  setInsideListenTogether: (inside: boolean) => void
  setPopoverOpen: (open: boolean) => void
  setOrbEdgeHidden: (hidden: boolean) => void
  setSyncListening: (state: SyncListeningState | null) => void
  setDesktopLyricOpen: (open: boolean) => void
  openDesktopLyricsKeepOrb: () => void
  setDesktopLyricLocked: (locked: boolean) => void
  toggleDesktopLyricLines: () => void
  setDesktopLyricPos: (pos: { x: number; y: number }) => void
  setListenFullscreenOpen: (open: boolean) => void
  openListenFullscreen: () => void
  clearPlayError: () => void
  showPlayModeToast: (label: string) => void
  _syncEngineState: (payload: EngineSyncPayload) => void
  _recomputeFloatingVisible: () => void
}

let playModeToastTimer: number | null = null

function hasActiveTrack(track: MusicTrack | null): track is MusicTrack {
  return Boolean(track && track.id > 0 && track.title !== '暂无播放')
}

export const useMusicStore = create<MusicStoreState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  playMode: 'sequence',
  listenPlayMode: 'repeatAll',
  isFloatingOrbVisible: false,
  isInsideListenTogether: false,
  progress: 0,
  currentTimeMs: 0,
  durationMs: 0,
  playError: null,
  canUseHeartMode: false,
  lyrics: [],
  popoverOpen: false,
  orbEdgeHidden: false,
  playModeToast: null,
  isDesktopLyricOpen: false,
  desktopLyricLocked: false,
  desktopLyricLines: 1,
  desktopLyricPos: { x: 0, y: 72 },
  desktopLyricPosReady: false,
  syncListening: null,
  isListenFullscreenOpen: false,

  setInsideListenTogether: (inside) => {
    const prev = get()
    if (prev.isInsideListenTogether === inside) return
    set({
      isInsideListenTogether: inside,
      popoverOpen: inside ? false : prev.popoverOpen,
    })
    get()._recomputeFloatingVisible()
  },

  setPopoverOpen: (open) => set({ popoverOpen: open }),

  setOrbEdgeHidden: (hidden) => set({ orbEdgeHidden: hidden }),

  setSyncListening: (state) => set({ syncListening: state }),

  setDesktopLyricOpen: (open) => set({ isDesktopLyricOpen: open }),

  openDesktopLyricsKeepOrb: () =>
    set({
      isDesktopLyricOpen: true,
      popoverOpen: false,
    }),

  setDesktopLyricLocked: (locked) => set({ desktopLyricLocked: locked }),

  toggleDesktopLyricLines: () =>
    set((s) => ({ desktopLyricLines: s.desktopLyricLines === 1 ? 2 : 1 })),

  setDesktopLyricPos: (pos) => set({ desktopLyricPos: pos, desktopLyricPosReady: true }),

  setListenFullscreenOpen: (open) => {
    set({ isListenFullscreenOpen: open })
    if (open) {
      set({ popoverOpen: false })
    }
    get()._recomputeFloatingVisible()
  },

  openListenFullscreen: () => {
    get().setListenFullscreenOpen(true)
  },

  clearPlayError: () => set({ playError: null }),

  showPlayModeToast: (label) => {
    if (playModeToastTimer !== null) {
      window.clearTimeout(playModeToastTimer)
    }
    set({ playModeToast: label })
    playModeToastTimer = window.setTimeout(() => {
      set({ playModeToast: null })
      playModeToastTimer = null
    }, LISTEN_TOGETHER_TOAST_MS)
  },

  _syncEngineState: (payload) => {
    set({
      currentTrack: payload.currentTrack,
      isPlaying: payload.isPlaying,
      listenPlayMode: payload.listenPlayMode,
      playMode: listenModeToUiMode(payload.listenPlayMode),
      progress: payload.progress,
      currentTimeMs: payload.currentTimeMs,
      durationMs: payload.durationMs,
      playError: payload.playError,
      canUseHeartMode: payload.canUseHeartMode,
      lyrics: payload.lyrics,
    })
    get()._recomputeFloatingVisible()
  },

  _recomputeFloatingVisible: () => {
    const { currentTrack, isInsideListenTogether, isListenFullscreenOpen } = get()
    set({
      isFloatingOrbVisible:
        hasActiveTrack(currentTrack) && !isInsideListenTogether && !isListenFullscreenOpen,
    })
  },
}))

/** @deprecated 使用 isFloatingOrbVisible */
export const useIsFloatingPlayerVisible = () => useMusicStore((s) => s.isFloatingOrbVisible)
