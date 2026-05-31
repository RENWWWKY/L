import { AnimatePresence, motion, useMotionValue } from 'framer-motion'
import {
  AlignLeft,
  HeartPulse,
  Lock,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Unlock,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { useMusicStore } from '../../stores/useMusicStore'
import type { ListenPlayMode } from './listenPlayMode'
import { activeLyricIndex } from './listenLyricParse'
import { listenTogetherPlayerEngine } from './listenTogetherPlayerEngine'

/** 固定宽度，避免换行时位置视觉漂移 */
const LYRIC_PANEL_W = 280
const LYRIC_DEFAULT_Y = 72
/** 与微信聊天气泡文字一致（--wx-font 优先，否则全局 --phone-font） */
const LYRIC_FONT_FAMILY = 'var(--wx-font, var(--phone-font))'
const LYRIC_COLOR = '#E8A0AE'
const LYRIC_SUB_COLOR = 'rgba(232, 160, 174, 0.55)'
const CONTROLS_IDLE_MS = 3000

function PlayModeIcon({ mode }: { mode: ListenPlayMode }) {
  const cls = 'size-3.5'
  switch (mode) {
    case 'repeatOne':
      return <Repeat1 className={cls} strokeWidth={1.75} />
    case 'repeatAll':
      return <Repeat className={cls} strokeWidth={1.75} />
    case 'shuffle':
      return <Shuffle className={cls} strokeWidth={1.75} />
    case 'heart':
      return (
        <span className="relative inline-flex size-3.5 items-center justify-center">
          <span
            className="absolute -right-0.5 -top-0.5 size-1 rounded-full bg-rose-400/80"
            aria-hidden
          />
          <HeartPulse className={cls} strokeWidth={1.75} />
        </span>
      )
    default:
      return <Repeat className={cls} strokeWidth={1.75} />
  }
}

export function DesktopLyricsWidget() {
  const open = useMusicStore((s) => s.isDesktopLyricOpen)
  const listenFullscreenOpen = useMusicStore((s) => s.isListenFullscreenOpen)
  const locked = useMusicStore((s) => s.desktopLyricLocked)
  const linesMode = useMusicStore((s) => s.desktopLyricLines)
  const savedPos = useMusicStore((s) => s.desktopLyricPos)
  const posReady = useMusicStore((s) => s.desktopLyricPosReady)
  const lyrics = useMusicStore((s) => s.lyrics)
  const currentTimeMs = useMusicStore((s) => s.currentTimeMs)
  const durationMs = useMusicStore((s) => s.durationMs)
  const isPlaying = useMusicStore((s) => s.isPlaying)
  const listenPlayMode = useMusicStore((s) => s.listenPlayMode)
  const canUseHeartMode = useMusicStore((s) => s.canUseHeartMode)
  const track = useMusicStore((s) => s.currentTrack)
  const setDesktopLyricOpen = useMusicStore((s) => s.setDesktopLyricOpen)
  const setDesktopLyricLocked = useMusicStore((s) => s.setDesktopLyricLocked)
  const toggleDesktopLyricLines = useMusicStore((s) => s.toggleDesktopLyricLines)
  const setDesktopLyricPos = useMusicStore((s) => s.setDesktopLyricPos)

  const containerRef = useRef<HTMLDivElement>(null)
  const idleTimerRef = useRef<number | null>(null)
  const x = useMotionValue(savedPos.x)
  const y = useMotionValue(savedPos.y)
  const [controlsVisible, setControlsVisible] = useState(false)
  const [unlockVisible, setUnlockVisible] = useState(false)

  const lyricIndex = useMemo(
    () => activeLyricIndex(lyrics, currentTimeMs, durationMs),
    [lyrics, currentTimeMs, durationMs],
  )

  const currentLine = lyrics[lyricIndex]?.text ?? track?.title ?? ''
  const nextLine = lyrics[lyricIndex + 1]?.text ?? ''

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const scheduleHideChrome = useCallback(
    (mode: 'controls' | 'unlock') => {
      clearIdleTimer()
      idleTimerRef.current = window.setTimeout(() => {
        if (mode === 'controls') setControlsVisible(false)
        else setUnlockVisible(false)
        idleTimerRef.current = null
      }, CONTROLS_IDLE_MS)
    },
    [clearIdleTimer],
  )

  const revealControls = useCallback(() => {
    setControlsVisible(true)
    scheduleHideChrome('controls')
  }, [scheduleHideChrome])

  const revealUnlock = useCallback(() => {
    setUnlockVisible(true)
    scheduleHideChrome('unlock')
  }, [scheduleHideChrome])

  const bumpControlsInteraction = useCallback(() => {
    revealControls()
  }, [revealControls])

  const bumpUnlockInteraction = useCallback(() => {
    revealUnlock()
  }, [revealUnlock])

  useLayoutEffect(() => {
    if (!open || !containerRef.current) return
    const bounds = containerRef.current.getBoundingClientRect()
    if (!posReady) {
      const centeredX = Math.max(8, (bounds.width - LYRIC_PANEL_W) / 2)
      const pos = { x: centeredX, y: LYRIC_DEFAULT_Y }
      x.set(pos.x)
      y.set(pos.y)
      setDesktopLyricPos(pos)
      return
    }
    x.set(savedPos.x)
    y.set(savedPos.y)
  }, [open, posReady, savedPos.x, savedPos.y, setDesktopLyricPos, x, y])

  useEffect(() => {
    if (posReady) {
      x.set(savedPos.x)
      y.set(savedPos.y)
    }
  }, [posReady, savedPos.x, savedPos.y, x, y])

  useEffect(() => {
    if (!open) {
      clearIdleTimer()
      setControlsVisible(false)
      setUnlockVisible(false)
      return
    }
    if (locked) {
      setControlsVisible(false)
      revealUnlock()
    } else {
      setUnlockVisible(false)
      revealControls()
    }
  }, [open, locked, clearIdleTimer, revealControls, revealUnlock])

  useEffect(() => () => clearIdleTimer(), [clearIdleTimer])

  const handleDragEnd = useCallback(() => {
    setDesktopLyricPos({ x: x.get(), y: y.get() })
    bumpControlsInteraction()
  }, [setDesktopLyricPos, x, y, bumpControlsInteraction])

  const handleLyricTap = useCallback(() => {
    if (locked) {
      if (!unlockVisible) revealUnlock()
      else bumpUnlockInteraction()
      return
    }
    bumpControlsInteraction()
  }, [locked, unlockVisible, revealUnlock, bumpUnlockInteraction, bumpControlsInteraction])

  if (!open || !track || listenFullscreenOpen) return null

  const showControls = !locked && controlsVisible
  const showUnlock = locked && unlockVisible

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-[9998] overflow-visible"
    >
      <motion.div
        drag={!locked}
        dragMomentum={false}
        dragElastic={0}
        style={{ x, y, width: LYRIC_PANEL_W, touchAction: locked ? 'auto' : 'none' }}
        onDragStart={() => {
          if (!locked) bumpControlsInteraction()
        }}
        onDragEnd={handleDragEnd}
        className={`absolute left-0 top-0 ${
          locked && !unlockVisible ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
      >
        {showUnlock ? (
          <button
            type="button"
            aria-label="解锁桌面歌词"
            onClick={(e) => {
              e.stopPropagation()
              setDesktopLyricLocked(false)
              setUnlockVisible(false)
              clearIdleTimer()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="pointer-events-auto absolute -right-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-stone-400/80 shadow-sm ring-1 ring-rose-100/60 backdrop-blur-sm transition-colors hover:text-rose-400"
          >
            <Unlock className="size-3" strokeWidth={1.75} />
          </button>
        ) : null}

        <div
          role={locked && !unlockVisible ? 'button' : undefined}
          tabIndex={locked && !unlockVisible ? 0 : undefined}
          aria-label={locked && !unlockVisible ? '单击显示解锁' : undefined}
          onClick={handleLyricTap}
          onKeyDown={(e) => {
            if (locked && !unlockVisible && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              handleLyricTap()
            }
          }}
          className={`relative w-full rounded-2xl px-4 py-3 transition-[border,background] duration-300 ${
            showControls
              ? 'border border-dashed border-rose-200/50 bg-white/10 backdrop-blur-sm'
              : 'border border-transparent bg-transparent'
          } ${locked && !unlockVisible ? 'pointer-events-auto cursor-default' : ''}`}
        >
          {linesMode === 1 ? (
            <p
              className="w-full text-center text-[15px] font-normal leading-[1.5]"
              style={{ fontFamily: LYRIC_FONT_FAMILY, color: LYRIC_COLOR }}
            >
              {currentLine || '…'}
            </p>
          ) : (
            <div className="w-full space-y-1.5 text-center">
              <p
                className="text-[15px] font-normal leading-[1.5]"
                style={{ fontFamily: LYRIC_FONT_FAMILY, color: LYRIC_COLOR }}
              >
                {currentLine || '…'}
              </p>
              {nextLine ? (
                <p
                  className="text-[13px] font-normal leading-[1.5]"
                  style={{ fontFamily: LYRIC_FONT_FAMILY, color: LYRIC_SUB_COLOR }}
                >
                  {nextLine}
                </p>
              ) : null}
            </div>
          )}

          <AnimatePresence>
            {showControls ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
                className="pointer-events-auto mt-3"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="grid w-full grid-cols-4 items-center">
                  <button
                    type="button"
                    aria-label={linesMode === 1 ? '切换双行歌词' : '切换单行歌词'}
                    onClick={() => {
                      toggleDesktopLyricLines()
                      bumpControlsInteraction()
                    }}
                    className="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-white/60 hover:text-rose-400"
                  >
                    <AlignLeft className="size-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    aria-label="切换播放模式"
                    title={
                      canUseHeartMode
                        ? undefined
                        : '心动模式仅在「我喜欢的音乐」歌单可用'
                    }
                    onClick={() => {
                      listenTogetherPlayerEngine.cyclePlayMode()
                      bumpControlsInteraction()
                    }}
                    className={`mx-auto flex h-8 w-8 items-center justify-center transition-colors ${
                      listenPlayMode === 'heart'
                        ? 'rounded-2xl bg-gradient-to-br from-rose-100 via-pink-50 to-white text-rose-500 shadow-sm ring-1 ring-rose-200/80'
                        : 'rounded-full text-stone-500 hover:bg-white/60 hover:text-rose-400'
                    }`}
                  >
                    <PlayModeIcon mode={listenPlayMode} />
                  </button>
                  <button
                    type="button"
                    aria-label="锁定歌词"
                    onClick={() => {
                      setDesktopLyricLocked(true)
                      setControlsVisible(false)
                      revealUnlock()
                    }}
                    className="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-white/60 hover:text-rose-400"
                  >
                    <Lock className="size-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    aria-label="关闭桌面歌词"
                    onClick={() => {
                      setDesktopLyricOpen(false)
                      clearIdleTimer()
                    }}
                    className="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-white/60 hover:text-rose-400"
                  >
                    <X className="size-3.5" strokeWidth={1.75} />
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    aria-label="上一首"
                    onClick={() => {
                      void listenTogetherPlayerEngine.playPrev()
                      bumpControlsInteraction()
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-white/50"
                  >
                    <SkipBack className="size-3.5 fill-current" strokeWidth={0} />
                  </button>
                  <button
                    type="button"
                    aria-label={isPlaying ? '暂停' : '播放'}
                    onClick={() => {
                      listenTogetherPlayerEngine.togglePlay()
                      bumpControlsInteraction()
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-rose-400 shadow-sm ring-1 ring-rose-100/70"
                  >
                    {isPlaying ? (
                      <Pause className="size-3.5 fill-current" strokeWidth={0} />
                    ) : (
                      <Play className="size-3.5 fill-current pl-0.5" strokeWidth={0} />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="下一首"
                    onClick={() => {
                      void listenTogetherPlayerEngine.playNext()
                      bumpControlsInteraction()
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-white/50"
                  >
                    <SkipForward className="size-3.5 fill-current" strokeWidth={0} />
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
