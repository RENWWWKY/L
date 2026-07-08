import { useCallback, useEffect, useRef, useState } from 'react'

import {
  compactDmNarrationLines,
  remapDmHighlightAfterLineCompact,
} from './chatRoom/dmBubbleText'
import type { DmTextHighlightRange } from './chatRoom/jbsFlowTypes'
import { createJbsDmVoicePlayer } from './jbsDmVoicePlayer'
import { createJbsSfxPlayer } from './jbsSfxPlayer'
import { useTypewriter } from './useTypewriter'

const TYPEWRITER_MS_PER_CHAR = 95
/** 救护车鸣笛与 DM 旁白叠播时的相对音量 */
const TRACK_SFX_VOLUME = 0.88

type SequencePhase = 'idle' | 'loading' | 'playing' | 'need-tap' | 'await-perform' | 'done'

export type DmVoiceBubbleLive = {
  body: string
  isTyping: boolean
  highlight?: DmTextHighlightRange
}

export type DmVoiceTrackFinalizeMeta = {
  highlight?: DmTextHighlightRange
}

export type UseDmVoiceBubbleSequenceOptions = {
  tracks: readonly string[]
  scripts: readonly string[]
  /** 与 tracks 同序；某轨开始时叠加播放的功能音效（可多条顺序播放） */
  sfxTracks?: readonly (readonly string[] | undefined)[]
  /** 与 tracks 同序；某轨无高亮可省略 */
  highlightRanges?: readonly (DmTextHighlightRange | undefined)[]
  enabled: boolean
  /** 变更时中止当前播放并从 initialCompletedTrackCount 重新起跑（DEV 阶段跳转等） */
  resetSignal?: number
  /** 续玩：已 finalize 的轨数，不再重播音频或重复推送气泡 */
  initialCompletedTrackCount?: number
  onFinalizeTrack: (body: string, meta: DmVoiceTrackFinalizeMeta | undefined, trackIndex: number) => void
  onComplete: () => void
  /** 每 finalize 一轨后回调（便于写入存档） */
  onTrackProgress?: (completedTrackCount: number) => void
  /** 播放该轨前需玩家点击「演绎」 */
  shouldAwaitPerformBeforeTrack?: (trackIndex: number) => boolean
}

export function useDmVoiceBubbleSequence({
  tracks,
  scripts,
  sfxTracks,
  highlightRanges,
  enabled,
  resetSignal = 0,
  initialCompletedTrackCount = 0,
  onFinalizeTrack,
  onComplete,
  onTrackProgress,
  shouldAwaitPerformBeforeTrack,
}: UseDmVoiceBubbleSequenceOptions) {
  const completedStart = Math.max(0, Math.min(initialCompletedTrackCount, tracks.length))
  const [trackIndex, setTrackIndex] = useState(completedStart)
  const [phase, setPhase] = useState<SequencePhase>('idle')
  const [typingActive, setTypingActive] = useState(false)
  const playerRef = useRef(createJbsDmVoicePlayer())
  const sfxPlayerRef = useRef(createJbsSfxPlayer())
  const startedRef = useRef(false)
  /** stop() 后可能误触 ended，跳过一次以免连跳两轨 */
  const ignoreNextEndedRef = useRef(false)
  const initialCompletedRef = useRef(initialCompletedTrackCount)
  initialCompletedRef.current = initialCompletedTrackCount
  const onCompleteRef = useRef(onComplete)
  const onFinalizeRef = useRef(onFinalizeTrack)
  const onTrackProgressRef = useRef(onTrackProgress)

  onCompleteRef.current = onComplete
  onFinalizeRef.current = onFinalizeTrack
  onTrackProgressRef.current = onTrackProgress

  const rawScript = scripts[trackIndex] ?? ''
  const currentScript = compactDmNarrationLines(rawScript)
  const rawHighlight = highlightRanges?.[trackIndex]
  const currentHighlight = rawHighlight
    ? remapDmHighlightAfterLineCompact(rawScript, rawHighlight)
    : undefined
  const { displayed, isTyping } = useTypewriter(currentScript, {
    msPerChar: TYPEWRITER_MS_PER_CHAR,
    pauseAfterParagraphMs: 620,
    active: typingActive && phase === 'playing',
  })

  const finishAll = useCallback(() => {
    setTypingActive(false)
    playerRef.current.stop()
    sfxPlayerRef.current.stop()
    setPhase('done')
    onCompleteRef.current()
  }, [])

  const finalizeCurrentTrack = useCallback(() => {
    const body = compactDmNarrationLines((scripts[trackIndex] ?? '').trim())
    if (body && body !== '……') {
      const highlight = highlightRanges?.[trackIndex]
      onFinalizeRef.current(body, highlight ? { highlight } : undefined, trackIndex)
    }
    onTrackProgressRef.current?.(trackIndex + 1)
  }, [highlightRanges, scripts, trackIndex])

  const enterTrack = useCallback(
    (index: number) => {
      setTrackIndex(index)
      if (shouldAwaitPerformBeforeTrack?.(index)) {
        setPhase('await-perform')
      } else {
        setPhase('loading')
      }
    },
    [shouldAwaitPerformBeforeTrack],
  )

  const advanceTrack = useCallback(() => {
    setTypingActive(false)
    playerRef.current.stop()
    sfxPlayerRef.current.stop()
    finalizeCurrentTrack()

    if (trackIndex < tracks.length - 1) {
      enterTrack(trackIndex + 1)
      return
    }
    finishAll()
  }, [enterTrack, finalizeCurrentTrack, finishAll, trackIndex, tracks.length])

  const playCurrent = useCallback(
    async (fromGesture = false): Promise<boolean> => {
      const src = tracks[trackIndex]?.trim() ?? ''
      if (!currentScript.trim()) {
        advanceTrack()
        return false
      }

      setPhase('loading')
      setTypingActive(false)
      ignoreNextEndedRef.current = false

      const sfx = sfxTracks?.[trackIndex]
      if (sfx?.length === 1) {
        sfxPlayerRef.current.play(sfx[0]!, TRACK_SFX_VOLUME)
      } else if (sfx && sfx.length > 1) {
        sfxPlayerRef.current.playSequence(sfx, TRACK_SFX_VOLUME)
      }

      if (!src) {
        setPhase('playing')
        setTypingActive(true)
        return true
      }

      try {
        await playerRef.current.play(src, 1, { fromGesture })
        setPhase('playing')
        setTypingActive(true)
        return true
      } catch {
        if (!fromGesture) {
          setPhase('need-tap')
          return false
        }
        setPhase('playing')
        setTypingActive(true)
        return true
      }
    },
    [advanceTrack, currentScript, finishAll, sfxTracks, trackIndex, tracks],
  )

  const playCurrentRef = useRef(playCurrent)
  playCurrentRef.current = playCurrent

  useEffect(() => {
    startedRef.current = false
    ignoreNextEndedRef.current = false
    playerRef.current.stop()
    sfxPlayerRef.current.stop()
    setTypingActive(false)
    const start = Math.max(
      0,
      Math.min(initialCompletedRef.current, tracks.length),
    )
    setTrackIndex(start)
    setPhase('idle')
  }, [resetSignal, tracks.length])

  useEffect(() => {
    if (enabled) return
    startedRef.current = false
    playerRef.current.stop()
    sfxPlayerRef.current.stop()
    setTypingActive(false)
    setPhase('idle')
  }, [enabled])

  const beginPlayback = useCallback(
    (fromGesture = false) => {
      if (!enabled || tracks.length === 0) {
        finishAll()
        return
      }
      startedRef.current = true
      if (shouldAwaitPerformBeforeTrack?.(trackIndex)) {
        setPhase('await-perform')
        return
      }
      void playCurrentRef.current(fromGesture)
    },
    [enabled, finishAll, shouldAwaitPerformBeforeTrack, trackIndex, tracks.length],
  )

  useEffect(() => {
    if (!enabled) return
    if (tracks.length === 0) {
      finishAll()
      return
    }
    if (startedRef.current) return

    startedRef.current = true

    if (completedStart >= tracks.length) {
      finishAll()
      return
    }

    if (completedStart > 0) {
      if (shouldAwaitPerformBeforeTrack?.(completedStart)) {
        setTrackIndex(completedStart)
        setPhase('await-perform')
      } else {
        enterTrack(completedStart)
      }
      return
    }

    beginPlayback(false)
  }, [
    beginPlayback,
    completedStart,
    enabled,
    enterTrack,
    finishAll,
    resetSignal,
    shouldAwaitPerformBeforeTrack,
    tracks.length,
  ])

  useEffect(() => {
    if (!startedRef.current) return
    if (phase === 'loading') {
      void playCurrentRef.current()
    }
  }, [trackIndex, phase])

  useEffect(() => {
    return playerRef.current.onEnded(() => {
      if (ignoreNextEndedRef.current) {
        ignoreNextEndedRef.current = false
        return
      }
      advanceTrack()
    })
  }, [advanceTrack])

  /** 无音频轨：打字机结束后自动进入下一轨 */
  useEffect(() => {
    if (phase !== 'playing') return
    if ((tracks[trackIndex]?.trim() ?? '').length > 0) return
    if (isTyping) return
    const t = window.setTimeout(() => advanceTrack(), 480)
    return () => window.clearTimeout(t)
  }, [advanceTrack, isTyping, phase, trackIndex, tracks])

  useEffect(() => {
    return () => {
      playerRef.current.stop()
      sfxPlayerRef.current.stop()
    }
  }, [])

  const liveBubble: DmVoiceBubbleLive | null =
    phase === 'playing' || phase === 'loading'
      ? {
          body: phase === 'loading' ? '…' : displayed,
          isTyping: phase === 'loading' || isTyping,
          highlight: currentHighlight,
        }
      : phase === 'need-tap'
        ? { body: currentScript.slice(0, 1) || '…', isTyping: true, highlight: currentHighlight }
        : null

  const isActive =
    enabled && phase !== 'done' && phase !== 'idle' && phase !== 'await-perform'

  const resumeFromGesture = useCallback(() => {
    if (phase !== 'need-tap') return
    void playCurrentRef.current(true)
  }, [phase])

  const resumePerform = useCallback(() => {
    if (phase !== 'await-perform') return
    setPhase('loading')
  }, [phase])

  const skipCurrentTrack = useCallback(() => {
    ignoreNextEndedRef.current = true
    advanceTrack()
  }, [advanceTrack])

  const canSkipCurrentTrack = phase === 'playing' && !isTyping

  return {
    liveBubble,
    isActive,
    phase,
    trackIndex,
    trackCount: tracks.length,
    resumeFromGesture,
    resumePerform,
    skipCurrentTrack,
    canSkipCurrentTrack,
    skipAll: finishAll,
  }
}
