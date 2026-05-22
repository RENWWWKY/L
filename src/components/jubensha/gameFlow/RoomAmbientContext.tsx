import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

/** 氛围轨音量（对应原视频背景声，与 DM 语音分轨） */
export const ROOM_AMBIENT_VIDEO_VOLUME = 0.42

type RoomAmbientContextValue = {
  /** 注册仅作画面的 <video>（始终 muted） */
  registerAmbientVideo: (el: HTMLVideoElement | null) => void
  /** 播放氛围轨（独立 Audio，对齐 VN 的 BGM 轨） */
  ensureAmbiancePlaying: () => Promise<void>
  /** @deprecated 别名 */
  ensureAmbientVideoPlaying: () => Promise<void>
}

const RoomAmbientContext = createContext<RoomAmbientContextValue | null>(null)

export type RoomAmbientProviderProps = {
  videoUrl?: string
  children: ReactNode
}

export function RoomAmbientProvider({ videoUrl, children }: RoomAmbientProviderProps) {
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const ambianceAudioRef = useRef<HTMLAudioElement | null>(null)
  const ambianceUrlRef = useRef<string | undefined>(undefined)
  const ambianceAwaitingGestureRef = useRef(false)
  const ambianceRequestTokenRef = useRef(0)

  const registerAmbientVideo = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el
    if (!el) return
    el.muted = true
    el.loop = true
    el.playsInline = true
    el.setAttribute('playsinline', 'true')
    // 仅画面：静音视频可自动播，不占用「有声」手势配额
    void el.play().catch(() => {})
  }, [])

  const ensureAmbiancePlaying = useCallback(async () => {
    if (!videoUrl) return

    const token = ++ambianceRequestTokenRef.current
    let audio = ambianceAudioRef.current

    if (!audio || ambianceUrlRef.current !== videoUrl) {
      if (audio) {
        audio.pause()
        audio.src = ''
      }
      audio = new Audio(videoUrl)
      audio.preload = 'auto'
      audio.loop = true
      audio.volume = ROOM_AMBIENT_VIDEO_VOLUME
      ambianceAudioRef.current = audio
      ambianceUrlRef.current = videoUrl
    } else {
      audio.volume = ROOM_AMBIENT_VIDEO_VOLUME
      audio.loop = true
    }

    try {
      await audio.play()
      if (ambianceRequestTokenRef.current === token) {
        ambianceAwaitingGestureRef.current = false
      }
    } catch {
      if (ambianceRequestTokenRef.current === token) {
        ambianceAwaitingGestureRef.current = true
      }
    }
  }, [videoUrl])

  /** 进入聊天室即尝试自动播氛围轨 */
  useEffect(() => {
    if (!videoUrl) return
    void ensureAmbiancePlaying()
  }, [ensureAmbiancePlaying, videoUrl])

  useEffect(() => {
    const onGesture = () => {
      if (!ambianceAwaitingGestureRef.current || !videoUrl) return
      void ensureAmbiancePlaying()
    }
    window.addEventListener('pointerdown', onGesture, { passive: true })
    window.addEventListener('keydown', onGesture)
    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [ensureAmbiancePlaying, videoUrl])

  useEffect(() => {
    return () => {
      const v = videoElRef.current
      if (v) {
        v.pause()
      }
      const a = ambianceAudioRef.current
      if (a) {
        a.pause()
        a.src = ''
      }
      ambianceAudioRef.current = null
      ambianceUrlRef.current = undefined
    }
  }, [])

  const value = useMemo<RoomAmbientContextValue>(
    () => ({
      registerAmbientVideo,
      ensureAmbiancePlaying,
      ensureAmbientVideoPlaying: ensureAmbiancePlaying,
    }),
    [registerAmbientVideo, ensureAmbiancePlaying],
  )

  return <RoomAmbientContext.Provider value={value}>{children}</RoomAmbientContext.Provider>
}

export function useRoomAmbient(): RoomAmbientContextValue {
  const ctx = useContext(RoomAmbientContext)
  if (!ctx) {
    throw new Error('useRoomAmbient must be used within RoomAmbientProvider')
  }
  return ctx
}

export function useRoomAmbientOptional(): RoomAmbientContextValue | null {
  return useContext(RoomAmbientContext)
}
