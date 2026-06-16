import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  Heart,
  ListMusic,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  HeartPulse,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { KtvLyricLine, type KtvLyricVisualMode } from './KtvLyricLine'
import { ListenNum } from './ListenNum'
import {
  formatLyricTime,
  lineEndTimeMs,
  lyricIndexAtScrollCenter,
} from './listenLyricParse'
import { ListenFullscreenErrorBoundary } from './ListenFullscreenErrorBoundary'
import {
  isCoarsePointerDevice,
  shouldUseLiteFullscreenEffects,
} from './listenDeviceProfile'
import { PLAY_MODE_LABELS, type ListenPlayMode } from './listenPlayMode'
import {
  LISTEN_FULLSCREEN_VINYL_DECORATION_URL,
  LISTEN_PROGRESS_THUMB_PAUSED_URL,
  LISTEN_PROGRESS_THUMB_PAUSED_SIZE_PX,
  LISTEN_PROGRESS_THUMB_PLAYING_URL,
  LISTEN_PROGRESS_THUMB_PLAYING_SIZE_PX,
  ListenTogetherPageBackground,
} from './listenTogetherPageBg'

const LITE_FULLSCREEN = shouldUseLiteFullscreenEffects()
const MOBILE_UI = isCoarsePointerDevice()

export type ListenLyricLine = {
  text: string
  active?: boolean
}

export type ListenCompanionInfo = {
  name: string
  avatar: string
  message: string
}

export type ListenFullscreenProgress = {
  current: string
  total: string
  percentage: number
}

export type ListenFullscreenSong = {
  title: string
  artist: string
  cover: string
}

export type ListenTogetherFullscreenPlayerProps = {
  open: boolean
  onClose: () => void
  song: ListenFullscreenSong
  lyrics?: ListenLyricLine[]
  progress: ListenFullscreenProgress
  isPlaying?: boolean
  liked?: boolean
  likeBusy?: boolean
  companion?: ListenCompanionInfo | null
  onTogglePlay?: () => void
  onToggleLike?: () => void
  onSeek?: (percentage: number) => void
  onMore?: () => void
  onOpenComments?: () => void
  /** 点击歌手名跳转歌手页 */
  onOpenArtist?: () => void
  artistLinkBusy?: boolean
  playMode?: ListenPlayMode
  canUseHeartMode?: boolean
  onCyclePlayMode?: () => void
  onPrev?: () => void
  onNext?: () => void
  /** 当前高亮歌词行（仅行号变化时滚动，避免随播放进度卡死） */
  activeLyricIndex?: number
  /** 带时间轴的歌词（用于拖拽定位播放） */
  lyricLines?: Array<{ text: string; timeMs: number }>
  durationMs?: number
  onSeekToTimeMs?: (timeMs: number) => void
}

type ParticleSpec = {
  id: number
  angle: number
  radiusRem: number
  sizePx: number
  delay: number
  duration: number
}

function SoftAudioParticles({ playing }: { playing: boolean }) {
  const particles = useMemo<ParticleSpec[]>(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        angle: (i / 18) * 360 + (i % 5) * 4,
        radiusRem: 9.5 + (i % 4) * 1.8,
        sizePx: 3 + (i % 4),
        delay: (i % 9) * 0.22,
        duration: 2.4 + (i % 6) * 0.35,
      })),
    [],
  )

  if (LITE_FULLSCREEN) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      aria-hidden
    >
      {[0, 1, 2, 3].map((ring) => (
        <motion.div
          key={`ring-${ring}`}
          className="absolute rounded-full border border-pink-300/45 bg-gradient-to-br from-pink-200/35 via-pink-100/20 to-transparent"
          style={{
            width: `${14 + ring * 3.5}rem`,
            height: `${14 + ring * 3.5}rem`,
          }}
          animate={
            playing
              ? {
                  scale: [1, 1.05 + ring * 0.012, 1],
                  opacity: [0.35, 0.62 - ring * 0.08, 0.35],
                }
              : { scale: 1, opacity: 0.22 }
          }
          transition={{
            duration: 3.8 + ring * 0.9,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: ring * 0.35,
          }}
        />
      ))}

      <motion.div
        className="absolute h-60 w-60 rounded-full bg-pink-300/45 blur-3xl"
        animate={
          playing
            ? { scale: [1, 1.18, 1], opacity: [0.45, 0.72, 0.45] }
            : { scale: 1, opacity: 0.28 }
        }
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-pink-400/90 shadow-[0_0_16px_rgba(244,114,182,0.85)]"
          style={{
            width: p.sizePx,
            height: p.sizePx,
            left: '50%',
            top: '50%',
            transform: `rotate(${p.angle}deg) translateY(-${p.radiusRem}rem)`,
            transformOrigin: '0 0',
            marginLeft: -p.sizePx / 2,
            marginTop: -p.sizePx / 2,
          }}
          animate={
            playing
              ? {
                  opacity: [0.35, 1, 0.4],
                  scale: [0.75, 1.45, 0.9],
                }
              : { opacity: 0.2, scale: 0.8 }
          }
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: p.delay,
          }}
        />
      ))}
    </div>
  )
}

type CenterView = 'vinyl' | 'lyrics'

const LYRIC_SCRUB_HIDE_MS = 2800

type LyricSeekLine = {
  text: string
  timeMs: number
}

/** 非播放行：不订阅时间，避免播放时整表重绘 */
const StaticLyricRow = memo(
  function StaticLyricRow({
    line,
    mode,
    lineEndMs,
    lineClass,
    lineRef,
  }: {
    line: LyricSeekLine
    mode: KtvLyricVisualMode
    lineEndMs: number
    lineClass: string
    lineRef: (el: HTMLParagraphElement | null) => void
  }) {
    return (
      <p ref={lineRef} className={lineClass}>
        <KtvLyricLine
          text={line.text}
          lineStartMs={line.timeMs}
          lineEndMs={lineEndMs}
          mode={mode}
        />
      </p>
    )
  },
  (prev, next) =>
    prev.mode === next.mode &&
    prev.line.text === next.line.text &&
    prev.line.timeMs === next.line.timeMs &&
    prev.lineClass === next.lineClass,
)

const LyricSeekScrollViewMemo = memo(function LyricSeekScrollView({
  lines,
  currentPlayIndex,
  durationMs,
  onSeekToTimeMs,
  onBackToVinyl,
}: {
  lines: LyricSeekLine[]
  currentPlayIndex: number
  durationMs: number
  onSeekToTimeMs?: (timeMs: number) => void
  onBackToVinyl: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<Array<HTMLParagraphElement | null>>([])
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrolledLyricIndex, setScrolledLyricIndex] = useState(0)
  const hideTimerRef = useRef<number | null>(null)
  const programmaticScrollRef = useRef(false)
  const userInteractingRef = useRef(false)

  const safePlayIndex = Math.min(
    Math.max(0, currentPlayIndex),
    Math.max(0, lines.length - 1),
  )
  const safeScrollIndex = Math.min(
    Math.max(0, scrolledLyricIndex),
    Math.max(0, lines.length - 1),
  )

  const measureCenterIndex = useCallback(() => {
    const container = scrollRef.current
    if (!container) return safePlayIndex
    return lyricIndexAtScrollCenter(container, lineRefs.current)
  }, [safePlayIndex])

  const refreshScrolledIndex = useCallback(() => {
    setScrolledLyricIndex(measureCenterIndex())
  }, [measureCenterIndex])

  const showSeekCursor = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    userInteractingRef.current = true
    setIsScrubbing(true)
    refreshScrolledIndex()
  }, [refreshScrolledIndex])

  const scheduleHideSeekCursor = useCallback(() => {
    if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => {
      setIsScrubbing(false)
      userInteractingRef.current = false
      hideTimerRef.current = null
    }, LYRIC_SCRUB_HIDE_MS)
  }, [])

  const scrollLineToCenter = useCallback((index: number) => {
    const container = scrollRef.current
    const line = lineRefs.current[index]
    if (!container || !line) return
    const targetTop =
      line.offsetTop - container.clientHeight / 2 + line.offsetHeight / 2
    programmaticScrollRef.current = true
    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: MOBILE_UI ? 'auto' : 'smooth',
    })
    window.setTimeout(() => {
      programmaticScrollRef.current = false
    }, MOBILE_UI ? 50 : 700)
  }, [])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onScroll = () => {
      if (programmaticScrollRef.current) return
      showSeekCursor()
      refreshScrolledIndex()
      scheduleHideSeekCursor()
    }

    const onUserIntent = () => {
      showSeekCursor()
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('touchstart', onUserIntent, { passive: true })
    el.addEventListener('pointerdown', onUserIntent, { passive: true })
    el.addEventListener('wheel', onUserIntent, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('touchstart', onUserIntent)
      el.removeEventListener('pointerdown', onUserIntent)
      el.removeEventListener('wheel', onUserIntent)
    }
  }, [showSeekCursor, refreshScrolledIndex, scheduleHideSeekCursor])

  const lastAutoScrollIndexRef = useRef(-1)
  useEffect(() => {
    if (isScrubbing || userInteractingRef.current) return
    if (MOBILE_UI && safePlayIndex === lastAutoScrollIndexRef.current) return
    lastAutoScrollIndexRef.current = safePlayIndex
    scrollLineToCenter(safePlayIndex)
  }, [safePlayIndex, isScrubbing, scrollLineToCenter])

  useEffect(() => {
    if (!isScrubbing) setScrolledLyricIndex(safePlayIndex)
  }, [safePlayIndex, isScrubbing])

  const handleSeekPlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    const target = lines[safeScrollIndex]
    if (!target || !onSeekToTimeMs) return

    const label = formatLyricTime(target.timeMs)
    console.log(`跳转到时间: ${label}`)

    onSeekToTimeMs(target.timeMs)
    setIsScrubbing(false)
    userInteractingRef.current = false
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const cursorTimeLabel =
    lines.length > 0 ? formatLyricTime(lines[safeScrollIndex]?.timeMs ?? 0) : '00:00'

  return (
    <div className="relative z-20 flex h-full w-full max-w-md flex-col text-center">
      <button
        type="button"
        onClick={onBackToVinyl}
        className="mb-2 shrink-0 text-[11px] tracking-wide text-stone-400/90 transition-colors hover:text-stone-600"
      >
        点击返回唱片
      </button>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="h-full touch-pan-y overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          aria-label="歌词滚动区，滑动可定位播放"
        >
          <div className="relative z-0 flex flex-col items-center px-2">
            <div className="h-[42vh] shrink-0" aria-hidden />
            {lines.map((line, index) => {
              const isPlayingLine = !isScrubbing && index === safePlayIndex
              const isCursorLine = isScrubbing && index === safeScrollIndex

              let ktvMode: KtvLyricVisualMode = 'idle'
              if (isCursorLine) ktvMode = 'cursor'
              else if (isPlayingLine) ktvMode = 'playing'
              else if (index < safePlayIndex) ktvMode = 'past'

              let lineClass =
                'max-w-full py-3 text-center text-base font-light transition-colors duration-200'
              if (isCursorLine) {
                lineClass += ' text-lg font-medium'
              } else if (isPlayingLine) {
                lineClass += ' text-xl font-medium'
              }

              const lineEnd = lineEndTimeMs(lines, index, durationMs)
              const lineRef = (el: HTMLParagraphElement | null) => {
                lineRefs.current[index] = el
              }

              return (
                <StaticLyricRow
                  key={`${index}-${line.timeMs}-${line.text}`}
                  line={line}
                  mode={ktvMode}
                  lineEndMs={lineEnd}
                  lineClass={lineClass}
                  lineRef={lineRef}
                />
              )
            })}
            <div className="h-[42vh] shrink-0" aria-hidden />
          </div>
        </div>

        {/* 固定播放光标：叠在歌词之上，避免被滚动内容遮挡 */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-1/2 z-30 flex w-full -translate-y-1/2 items-center justify-between px-6 transition-opacity duration-300 ease-out ${
            isScrubbing ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-hidden={!isScrubbing}
        >
          <ListenNum className="min-w-[2.75rem] shrink-0 text-left text-xs font-medium text-rose-400/90">
            {cursorTimeLabel}
          </ListenNum>
          <div className="mx-3 h-px flex-1 border-b border-dashed border-rose-300/70" />
          <button
            type="button"
            aria-label={`从 ${cursorTimeLabel} 开始播放`}
            disabled={!onSeekToTimeMs}
            onClick={handleSeekPlay}
            className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-rose-500 shadow-md shadow-rose-200/80 ring-1 ring-rose-100 transition-transform active:scale-90 disabled:opacity-40"
          >
            <Play className="size-4 fill-rose-500 text-rose-500" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {!isScrubbing ? (
        <p className="mt-2 shrink-0 text-[10px] text-stone-400/70">上下滑动歌词可定位播放</p>
      ) : null}
    </div>
  )
})

function SpinningVinyl({
  cover,
  playing,
  onClick,
}: {
  cover: string
  playing: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label="查看歌词"
      onClick={onClick}
      className="relative z-20 flex h-[17.5rem] w-[17.5rem] cursor-pointer items-center justify-center rounded-full transition-transform duration-300 active:scale-[0.98] sm:h-80 sm:w-80"
    >
      <div
        className="relative flex h-full w-full animate-[spin_20s_linear_infinite] items-center justify-center rounded-full bg-stone-800 shadow-2xl shadow-stone-400/30"
        style={{ animationPlayState: playing ? 'running' : 'paused' }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-full opacity-90"
          style={{
            background:
              'repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px)',
          }}
        />
        <div className="absolute inset-3 rounded-full border border-white/[0.06]" />
        <div className="absolute inset-7 rounded-full border border-white/[0.05]" />
        <div className="absolute inset-12 rounded-full border border-white/[0.04]" />
        <div className="absolute inset-[18%] rounded-full border border-stone-600/40" />

        <div className="relative h-[58%] w-[58%] overflow-hidden rounded-full bg-stone-700 ring-2 ring-stone-600/50 shadow-inner">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-stone-700">
              <Music2 className="size-10 text-stone-500" strokeWidth={1.25} />
            </div>
          )}
        </div>

        <div className="absolute z-10 h-3.5 w-3.5 rounded-full bg-stone-950/95 ring-1 ring-white/15 shadow-sm" />
      </div>
      <img
        src={LISTEN_FULLSCREEN_VINYL_DECORATION_URL}
        alt=""
        className="pointer-events-none absolute -bottom-1 -right-1 z-30 h-[4.5rem] w-[4.5rem] object-contain drop-shadow-[0_4px_12px_rgba(120,113,108,0.25)] sm:-bottom-2 sm:-right-2 sm:h-20 sm:w-20"
        draggable={false}
      />
    </button>
  )
}

function PlayModeIcon({ mode }: { mode: ListenPlayMode }) {
  const cls = 'size-5'
  switch (mode) {
    case 'repeatOne':
      return <Repeat1 className={cls} strokeWidth={1.5} />
    case 'repeatAll':
      return <Repeat className={cls} strokeWidth={1.5} />
    case 'shuffle':
      return <Shuffle className={cls} strokeWidth={1.5} />
    case 'heart':
      return (
        <span className="relative inline-flex size-5 items-center justify-center">
          <span
            className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-rose-400/80"
            aria-hidden
          />
          <HeartPulse className={cls} strokeWidth={1.75} />
        </span>
      )
    default:
      return <Repeat className={cls} strokeWidth={1.5} />
  }
}

function CapsuleProgressBar({
  progress,
  current,
  total,
  onSeek,
  isPlaying = false,
}: {
  progress: ListenFullscreenProgress
  current: string
  total: string
  onSeek?: (percentage: number) => void
  isPlaying?: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [dragPct, setDragPct] = useState<number | null>(null)

  const displayPct = dragPct ?? progress.percentage
  const thumbSrc = isPlaying ? LISTEN_PROGRESS_THUMB_PLAYING_URL : LISTEN_PROGRESS_THUMB_PAUSED_URL
  const thumbSizePx = isPlaying
    ? LISTEN_PROGRESS_THUMB_PLAYING_SIZE_PX
    : LISTEN_PROGRESS_THUMB_PAUSED_SIZE_PX
  const thumbHalf = thumbSizePx / 2

  const pctFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return 0
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
  }, [])

  useEffect(() => {
    if (!dragging) return

    const onMove = (e: PointerEvent) => {
      const pct = pctFromClientX(e.clientX)
      setDragPct(pct)
      onSeek?.(pct)
    }
    const onUp = () => {
      setDragging(false)
      setDragPct(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, onSeek, pctFromClientX])

  return (
    <div className="w-full">
      <div className="mb-3 flex justify-between text-xs font-medium text-stone-400">
        <ListenNum>{current}</ListenNum>
        <ListenNum>{total}</ListenNum>
      </div>
      <div
        ref={trackRef}
        role="slider"
        aria-label="播放进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(displayPct)}
        tabIndex={onSeek ? 0 : undefined}
        onPointerDown={(e) => {
          if (!onSeek) return
          e.currentTarget.setPointerCapture(e.pointerId)
          setDragging(true)
          const pct = pctFromClientX(e.clientX)
          setDragPct(pct)
          onSeek(pct)
        }}
        onKeyDown={(e) => {
          if (!onSeek) return
          if (e.key === 'ArrowRight') onSeek(Math.min(100, displayPct + 5))
          if (e.key === 'ArrowLeft') onSeek(Math.max(0, displayPct - 5))
        }}
        className={`relative flex h-6 w-full touch-none items-center ${
          onSeek ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200/60">
          <div
            className="h-full rounded-full bg-rose-400 transition-[width] duration-150"
            style={{ width: `${displayPct}%` }}
          />
        </div>
        {onSeek ? (
          <img
            src={thumbSrc}
            alt=""
            draggable={false}
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 object-contain drop-shadow-[0_2px_8px_rgba(120,113,108,0.2)] transition-transform ${
              dragging ? 'scale-110' : 'scale-100'
            }`}
            style={{
              width: thumbSizePx,
              height: thumbSizePx,
              left: `calc(${displayPct}% - ${thumbHalf}px)`,
            }}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  )
}

function CompanionBubble({ companion }: { companion: ListenCompanionInfo }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="mb-8 flex w-full items-center gap-3 rounded-2xl bg-white/80 p-3 shadow-lg shadow-stone-200/50 backdrop-blur-md"
    >
      <img
        src={companion.avatar}
        alt={companion.name}
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-stone-400">{companion.name}</p>
        <p className="mt-0.5 text-sm leading-snug text-stone-700">{companion.message}</p>
      </div>
    </motion.div>
  )
}

export function ListenTogetherFullscreenPlayer({
  open,
  onClose,
  song,
  lyrics = [],
  progress,
  isPlaying = false,
  liked = false,
  likeBusy = false,
  companion = null,
  onTogglePlay,
  onToggleLike,
  onSeek,
  onMore,
  onOpenComments,
  onOpenArtist,
  artistLinkBusy = false,
  playMode = 'repeatAll',
  canUseHeartMode = false,
  onCyclePlayMode,
  onPrev,
  onNext,
  activeLyricIndex = 0,
  lyricLines,
  durationMs = 0,
  onSeekToTimeMs,
}: ListenTogetherFullscreenPlayerProps) {
  const coverSrc = song.cover?.trim() || ''
  const [centerView, setCenterView] = useState<CenterView>('vinyl')
  const backToVinyl = useCallback(() => setCenterView('vinyl'), [])

  const seekLyricLines = useMemo((): LyricSeekLine[] => {
    if (lyricLines && lyricLines.length > 0) {
      return lyricLines.map((l) => ({
        text: l.text,
        timeMs: l.timeMs,
      }))
    }
    if (lyrics.length > 0) {
      const step =
        durationMs > 0 && lyrics.length > 1 ? durationMs / (lyrics.length - 1) : 0
      return lyrics.map((line, i) => ({
        text: line.text,
        timeMs: Math.round(i * step),
      }))
    }
    return [{ text: '暂无歌词', timeMs: 0 }]
  }, [lyricLines, lyrics, durationMs])

  useEffect(() => {
    if (!open) setCenterView('vinyl')
  }, [open])

  useEffect(() => {
    setCenterView('vinyl')
  }, [song.title, song.artist])

  if (!open) return null

  return (
    <ListenFullscreenErrorBoundary onClose={onClose}>
      <motion.div
          className="fixed inset-0 z-[10010] flex h-screen w-full flex-col overflow-hidden"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 34, stiffness: 320 }}
          role="dialog"
          aria-label="全屏播放"
        >
          {/* 1. 页面背景图 */}
          <ListenTogetherPageBackground overlayClassName="bg-white/8" />

          {/* 2. 顶部导航 — 纯净歌名 */}
          <header className="relative z-30 shrink-0 px-6 pb-4 pt-[max(3rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="收起播放页"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-600 transition-colors duration-300 hover:bg-white/60 hover:text-stone-800"
              >
                <ChevronDown className="size-6" strokeWidth={1.5} />
              </button>

              <div className="min-w-0 flex-1 px-1 text-center">
                <h1 className="truncate text-xl font-semibold tracking-wide text-stone-800">
                  {song.title}
                </h1>
                {onOpenArtist ? (
                  <button
                    type="button"
                    disabled={artistLinkBusy}
                    onClick={onOpenArtist}
                    className="mt-1 max-w-full truncate text-sm font-light text-stone-500 underline decoration-stone-300/70 underline-offset-2 transition-colors hover:text-rose-500 hover:decoration-rose-300 disabled:opacity-60"
                    aria-label={`查看歌手 ${song.artist}`}
                  >
                    {artistLinkBusy ? '正在打开歌手…' : song.artist}
                  </button>
                ) : (
                  <p className="mt-1 truncate text-sm font-light text-stone-500">{song.artist}</p>
                )}
              </div>

              <button
                type="button"
                aria-label="更多操作"
                onClick={onMore}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-600 transition-colors duration-300 hover:bg-white/60 hover:text-stone-800"
              >
                <MoreHorizontal className="size-6" strokeWidth={1.5} />
              </button>
            </div>
          </header>

          {/* 3. 黑胶 / 歌词切换 */}
          <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-6">
            <AnimatePresence mode="wait">
              {centerView === 'vinyl' ? (
                <motion.div
                  key="vinyl"
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.3 }}
                >
                  <SoftAudioParticles playing={isPlaying} />
                  <SpinningVinyl
                    cover={coverSrc}
                    playing={isPlaying}
                    onClick={() => setCenterView('lyrics')}
                  />
                  <p className="pointer-events-none absolute bottom-2 text-[11px] text-stone-400/80">
                    点击唱片查看歌词
                  </p>
                </motion.div>
              ) : (
                <div
                  key="lyrics"
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <LyricSeekScrollViewMemo
                    lines={seekLyricLines}
                    currentPlayIndex={activeLyricIndex}
                    durationMs={durationMs}
                    onSeekToTimeMs={onSeekToTimeMs}
                    onBackToVinyl={backToVinyl}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* 4. 底部控制区 */}
          <footer className="relative z-30 w-full bg-gradient-to-t from-white/85 via-white/55 to-transparent px-8 pb-[max(3rem,env(safe-area-inset-bottom))] pt-8">
            {companion ? <CompanionBubble companion={companion} /> : null}

            <div className="mb-3 flex items-center justify-between">
              {onToggleLike ? (
                <button
                  type="button"
                  aria-label={liked ? '取消喜欢' : '添加到喜欢的音乐'}
                  disabled={likeBusy}
                  onClick={onToggleLike}
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-stone-100/80 backdrop-blur-sm transition-all active:scale-95 disabled:opacity-50 ${
                    liked
                      ? 'text-rose-400'
                      : 'text-stone-500 hover:text-rose-400'
                  }`}
                >
                  <Heart
                    className={`size-[18px] ${liked ? 'fill-current' : ''}`}
                    strokeWidth={liked ? 0 : 1.5}
                  />
                </button>
              ) : (
                <span className="w-10" aria-hidden />
              )}
              {onOpenComments ? (
                <button
                  type="button"
                  aria-label="查看评论"
                  onClick={onOpenComments}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-stone-600 shadow-sm ring-1 ring-stone-100/80 backdrop-blur-sm transition-all hover:text-rose-500 active:scale-95"
                >
                  <MessageCircle className="size-[18px]" strokeWidth={1.5} />
                </button>
              ) : (
                <span className="w-10" aria-hidden />
              )}
            </div>

            <CapsuleProgressBar
              progress={progress}
              current={progress.current}
              total={progress.total}
              onSeek={onSeek}
              isPlaying={isPlaying}
            />

            <div className="mt-8 flex items-center justify-between px-1">
              {onCyclePlayMode ? (
                <button
                  type="button"
                  aria-label={`播放模式：${PLAY_MODE_LABELS[playMode]}，点击切换`}
                  title={
                    canUseHeartMode
                      ? PLAY_MODE_LABELS[playMode]
                      : `${PLAY_MODE_LABELS[playMode]}（心动模式仅在「我喜欢的音乐」歌单可用）`
                  }
                  onClick={onCyclePlayMode}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center transition-all duration-300 active:scale-95 ${
                    playMode === 'heart'
                      ? 'rounded-2xl bg-gradient-to-br from-rose-100 via-pink-50 to-white text-rose-500 shadow-md shadow-rose-200/40 ring-1 ring-rose-200/80'
                      : 'rounded-full text-stone-600 hover:bg-white/80 hover:text-stone-800'
                  }`}
                >
                  <PlayModeIcon mode={playMode} />
                </button>
              ) : (
                <span className="w-11 shrink-0" aria-hidden />
              )}

              <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                aria-label="上一首"
                onClick={onPrev}
                className="flex h-11 w-11 items-center justify-center text-stone-600 transition-colors duration-300 hover:text-stone-800"
              >
                <SkipBack className="size-6" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                aria-label={isPlaying ? '暂停' : '播放'}
                onClick={onTogglePlay}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-stone-800 shadow-lg shadow-stone-200 transition-transform duration-300 active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="size-7 fill-current" strokeWidth={0} />
                ) : (
                  <Play className="size-7 fill-current pl-0.5" strokeWidth={0} />
                )}
              </button>
              <button
                type="button"
                aria-label="下一首"
                onClick={onNext}
                className="flex h-11 w-11 items-center justify-center text-stone-600 transition-colors duration-300 hover:text-stone-800"
              >
                <SkipForward className="size-6" strokeWidth={1.5} />
              </button>
              </div>

              <button
                type="button"
                aria-label="播放列表"
                className="flex h-11 w-11 shrink-0 items-center justify-center text-stone-600 transition-colors duration-300 hover:text-stone-800"
              >
                <ListMusic className="size-5" strokeWidth={1.5} />
              </button>
            </div>
          </footer>
        </motion.div>
    </ListenFullscreenErrorBoundary>
  )
}

/** 将进度百分比格式化为 mm:ss（totalSeconds 来自 audio.duration） */
export function formatProgressTimes(
  percentage: number,
  totalSeconds = 0,
): { current: string; total: string; percentage: number } {
  const safeTotal = totalSeconds > 0 ? totalSeconds : 0
  const currentSec = safeTotal > 0 ? Math.floor((percentage / 100) * safeTotal) : 0
  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return {
    current: fmt(currentSec),
    total: safeTotal > 0 ? fmt(safeTotal) : '--:--',
    percentage: Math.max(0, Math.min(100, percentage)),
  }
}
