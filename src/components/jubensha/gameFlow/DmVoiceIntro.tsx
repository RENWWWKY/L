import { motion } from 'framer-motion'
import { SkipForward, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createJbsDmVoicePlayer } from './jbsDmVoicePlayer'
import { useRoomAmbientOptional } from './RoomAmbientContext'
import { useTypewriter } from './useTypewriter'

/** 打字机节奏（约 95ms/字，与原语速语音对齐） */
const TYPEWRITER_MS_PER_CHAR = 95

type PlayPhase = 'need-tap' | 'loading' | 'playing' | 'error'

export type DmVoiceIntroProps = {
  tracks: readonly string[]
  /** 与 tracks 下标对应的 DM 台词（打字机呈现） */
  typewriterScripts?: readonly string[]
  onComplete: () => void
  embedded?: boolean
  /** 续玩：已播完轨数，跳过已播放段落 */
  initialCompletedTrackCount?: number
  onTrackProgress?: (completedTrackCount: number) => void
}

export function DmVoiceIntro({
  tracks,
  typewriterScripts,
  onComplete,
  embedded = false,
  initialCompletedTrackCount = 0,
  onTrackProgress,
}: DmVoiceIntroProps) {
  const completedStart = Math.max(0, Math.min(initialCompletedTrackCount, tracks.length))
  const [trackIndex, setTrackIndex] = useState(completedStart)
  const [phase, setPhase] = useState<PlayPhase>('loading')
  const [errorHint, setErrorHint] = useState<string | null>(null)
  const [typingActive, setTypingActive] = useState(false)
  const dmPlayerRef = useRef(createJbsDmVoicePlayer())
  const startedRef = useRef(false)
  const skipTrackEffectOnceRef = useRef(true)
  const awaitingGestureRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const ambient = useRoomAmbientOptional()

  const currentScript = typewriterScripts?.[trackIndex] ?? ''
  const msPerChar = TYPEWRITER_MS_PER_CHAR

  const { displayed, isTyping } = useTypewriter(currentScript, {
    msPerChar,
    pauseAfterParagraphMs: 620,
    active: typingActive && phase === 'playing',
  })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [displayed])

  const finish = useCallback(() => {
    setTypingActive(false)
    dmPlayerRef.current.stop()
    onComplete()
  }, [onComplete])

  const advanceTrack = useCallback(() => {
    setTypingActive(false)
    onTrackProgress?.(trackIndex + 1)
    if (trackIndex < tracks.length - 1) {
      setTrackIndex((i) => i + 1)
      setPhase('loading')
      return
    }
    finish()
  }, [finish, onTrackProgress, trackIndex, tracks.length])

  const playCurrent = useCallback(
    async (opts?: { fromGesture?: boolean }): Promise<boolean> => {
      const src = tracks[trackIndex]
      if (!src) {
        setPhase('error')
        setErrorHint('语音资源缺失')
        return false
      }

      setPhase('loading')
      setErrorHint(null)
      setTypingActive(false)

      try {
        await dmPlayerRef.current.play(src, 1, opts)
        setPhase('playing')
        setTypingActive(true)
        awaitingGestureRef.current = false
        return true
      } catch {
        if (!opts?.fromGesture) {
          awaitingGestureRef.current = true
          setPhase('need-tap')
          setErrorHint(null)
          return false
        }
        setPhase('error')
        setErrorHint('无法播放语音，请确认 dm语音开场白1/2.wav 存在后重试')
        return false
      }
    },
    [trackIndex, tracks],
  )

  const playCurrentRef = useRef(playCurrent)
  playCurrentRef.current = playCurrent

  const beginDualPlayback = useCallback(
    async (fromGesture = false) => {
      startedRef.current = true
      setPhase('loading')
      void (ambient?.ensureAmbiancePlaying() ?? Promise.resolve())
      await playCurrentRef.current({ fromGesture })
    },
    [ambient],
  )

  const beginDualPlaybackRef = useRef(beginDualPlayback)
  beginDualPlaybackRef.current = beginDualPlayback

  const unlockFromGesture = useCallback(() => {
    if (!awaitingGestureRef.current) return
    void beginDualPlaybackRef.current(true)
  }, [])

  /** 进入开场页自动播双轨；被策略拦截时等任意点击续播 */
  useEffect(() => {
    if (completedStart >= tracks.length) {
      finish()
      return
    }
    if (completedStart > 0) {
      startedRef.current = true
      void beginDualPlaybackRef.current(false)
      return
    }
    void beginDualPlaybackRef.current(false)
  }, [completedStart, finish, tracks.length])

  useEffect(() => {
    const onGesture = () => unlockFromGesture()
    window.addEventListener('pointerdown', onGesture, { passive: true })
    window.addEventListener('keydown', onGesture)
    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [unlockFromGesture])

  useEffect(() => {
    if (!startedRef.current) return
    if (skipTrackEffectOnceRef.current) {
      skipTrackEffectOnceRef.current = false
      return
    }
    void playCurrentRef.current()
  }, [trackIndex])

  useEffect(() => {
    return dmPlayerRef.current.onEnded(advanceTrack)
  }, [advanceTrack])

  useEffect(() => {
    return () => dmPlayerRef.current.stop()
  }, [])

  const showTypewriter = phase === 'playing' || phase === 'loading' || phase === 'need-tap'
  const phaseHint = useMemo(() => {
    if (phase === 'need-tap') return '浏览器需一次点击以开始播放（氛围 + 主持）'
    if (phase === 'loading') return '主持人入席中…'
    return null
  }, [phase])

  const panel = (
    <>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-4">
        <motion.div
          className="jbs-gf-dm-intro-panel flex w-full max-w-[min(100%,380px)] min-h-[min(52vh,420px)] flex-col px-5 py-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="shrink-0 text-center">
            <span className="jbs-gf-dm-intro-tag inline-block">
              𓋫 DM | 主持人
            </span>
            <p className="jbs-gf-dm-intro-meta mt-3">
              开场白 {trackIndex + 1} / {tracks.length}
            </p>
          </div>

          {phase === 'need-tap' ? (
            <div className="mt-4 flex flex-col items-center text-center">
              <p className="jbs-gf-dm-intro-hint">{phaseHint}</p>
              <button
                type="button"
                onClick={() => void beginDualPlayback(true)}
                className="jbs-gf-chat-voice-btn jbs-font-serif mt-4 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[11px]"
              >
                <Volume2 className="size-3.5" strokeWidth={1.25} />
                点击继续
              </button>
            </div>
          ) : null}

          {showTypewriter && currentScript ? (
            <div
              ref={scrollRef}
              className="jbs-gf-chat-typewriter-scroll mt-4 min-h-0 flex-1 overflow-y-auto jbs-hide-scrollbar px-1"
            >
              <p className="jbs-font-kai jbs-gf-dm-intro-script whitespace-pre-wrap">
                {displayed}
                {isTyping ? (
                  <span className="jbs-gf-dm-intro-cursor ml-0.5 inline-block w-[2px] align-middle" />
                ) : null}
              </p>
            </div>
          ) : phase === 'loading' ? (
            <p className="jbs-gf-dm-intro-hint mt-8 text-center tracking-wider">
              {phaseHint}
            </p>
          ) : null}

          {phase === 'error' && errorHint ? (
            <div className="mt-4 text-center">
              <p className="jbs-gf-dm-intro-hint">{errorHint}</p>
              <button
                type="button"
                onClick={() => void beginDualPlayback(true)}
                className="jbs-gf-chat-voice-btn jbs-font-serif mt-4 rounded-lg px-4 py-2 text-[10px]"
              >
                重试播放
              </button>
            </div>
          ) : null}

          <div className="mt-4 flex shrink-0 justify-center gap-1">
            {tracks.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === trackIndex
                    ? 'w-8 bg-[#8b6914]/55'
                    : i < trackIndex
                      ? 'w-3 bg-[#5c3d2e]/35'
                      : 'w-3 bg-[#5c3d2e]/12'
                }`}
              />
            ))}
          </div>
        </motion.div>
      </div>

      <div className="jbs-gf-chat-input-bar shrink-0 px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={advanceTrack}
            className="jbs-gf-chat-voice-btn flex items-center gap-1.5 rounded-lg px-4 py-2.5 font-sans text-[11px] font-extralight tracking-wider"
          >
            <SkipForward className="size-3.5" strokeWidth={1.25} />
            {trackIndex < tracks.length - 1 ? '下一段' : '跳过并完成'}
          </button>
          {trackIndex < tracks.length - 1 ? (
            <button
              type="button"
              onClick={finish}
              className="jbs-gf-chat-voice-skip rounded-lg px-3 py-2.5 text-[10px]"
            >
              全部跳过
            </button>
          ) : null}
        </div>
      </div>
    </>
  )

  if (embedded) {
    return (
      <motion.div
        className="absolute inset-0 flex min-h-0 flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {panel}
      </motion.div>
    )
  }

  return (
    <motion.div
      className="jbs-gf-chat-root absolute inset-0 z-10 flex min-h-0 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="jbs-gf-chat-fallback-bg absolute inset-0 -z-10" aria-hidden />
      {panel}
    </motion.div>
  )
}
