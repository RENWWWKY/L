import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play, ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

import type { WeChatBubbleTheme } from '../../types'
import {
  ImessageVoiceBubbleFace,
  TalkmakerVoiceBubbleFace,
  MessengerVoiceBubbleShell,
  TelegramVoiceBubbleFace,
  isAltMessengerBubbleStyle,
  type MessengerBubbleStyle,
} from './wechatMessengerSpecialBubbles'
import { formatTelegramBubbleTime } from './wechatBubbleTelegramUi'
import {
  WechatBubbleTail,
  WechatVoiceWaveIcon,
  WECHAT_CLASSIC,
  WECHAT_CHAT_BUBBLE_MAX_CLASS,
  wechatVoiceBubbleWidthPx,
} from './wechatBubbleWechatUi'
import { formatTalkmakerExternalTime, TalkmakerExternalTimestamp } from './wechatBubbleTalkmakerUi'

export type VoiceMessageBubbleProps = {
  isUser: boolean
  duration: number
  audioUrl: string
  transcriptText: string
  onTranscriptToggle?: (expanded: boolean) => void
  onRequestAudio?: () => Promise<string>
  onLongPress?: (anchorRect: DOMRect) => void
  messengerStyle?: MessengerBubbleStyle
  bubble?: WeChatBubbleTheme
  showBubbleTail?: boolean
  bubbleTailMaskColor?: string
  messageTimestampMs?: number
  telegramShowReadChecks?: boolean
  replyPreview?: { senderName: string; content: string; onClick?: () => void }
  /** 微信：是否已播放（仅对方语音显示未读红点） */
  voicePlayed?: boolean
  onVoicePlayed?: () => void
}

const SPRING = { type: 'spring', stiffness: 300, damping: 30 } as const

function buildWaveHeights(seed: number) {
  const count = 26
  return Array.from({ length: count }, (_, i) => {
    const n = Math.sin((i + 1) * 0.93 + seed * 0.37) * 0.5 + 0.5
    return 8 + Math.round(n * 17)
  })
}

function messengerTranscriptUi(messengerStyle: MessengerBubbleStyle, isSelf: boolean) {
  if (messengerStyle === 'imessage') {
    return isSelf
      ? {
          toggle: 'border-white/30 bg-white/15 text-white/90',
          panel: 'border-white/20 bg-[#0070e0] text-white',
          panelDivider: 'border-white/20',
          firstChar: 'text-white',
        }
      : {
          toggle: 'border-black/10 bg-white/70 text-gray-600',
          panel: 'border-black/10 bg-[#d1d1d6] text-gray-900',
          panelDivider: 'border-black/10',
          firstChar: 'text-gray-900',
        }
  }
  if (messengerStyle === 'telegram') {
    return isSelf
      ? {
          toggle: 'border-white/25 bg-white/10 text-white/90',
          panel: 'border-[#c5e6a1]/80 bg-[#6ab547] text-white',
          panelDivider: 'border-white/20',
          firstChar: 'text-white',
        }
      : {
          toggle: 'border-black/10 bg-white/70 text-gray-600',
          panel: 'border-black/10 bg-[#eef2f5] text-gray-900',
          panelDivider: 'border-black/10',
          firstChar: 'text-gray-900',
        }
  }
  return isSelf
    ? {
        toggle: 'border-black/10 bg-black/5 text-gray-800',
        panel: 'border-black/10 bg-[#f0da00] text-gray-900',
        panelDivider: 'border-black/10',
        firstChar: 'text-gray-900',
      }
    : {
        toggle: 'border-gray-200 bg-gray-50 text-gray-600',
        panel: 'border-gray-200 bg-[#f7f7f7] text-gray-900',
        panelDivider: 'border-gray-200',
        firstChar: 'text-gray-900',
      }
}

function VoiceTranscriptToggleButton({
  isTranscribing,
  onToggle,
  alignSelf,
  className,
}: {
  isTranscribing: boolean
  onToggle: (e: MouseEvent<HTMLButtonElement>) => void
  alignSelf: 'start' | 'end'
  className: string
}) {
  return (
    <div className={`relative mt-2 flex items-center pb-0.5 ${alignSelf === 'end' ? 'justify-end' : 'justify-start'}`}>
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={{ scale: 0.95 }}
        transition={SPRING}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${className}`}
      >
        <span className="font-medium">Transcript</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${isTranscribing ? 'rotate-180' : ''}`} />
      </motion.button>
    </div>
  )
}

function VoiceTranscriptExpandedPanel({
  open,
  firstChar,
  restText,
  panelClassName,
  dividerClassName,
  firstCharClassName,
  bottomRadiusPx,
  fitContent = false,
}: {
  open: boolean
  firstChar: string
  restText: string
  panelClassName: string
  dividerClassName: string
  firstCharClassName: string
  bottomRadiusPx: number
  /** 微信：按转写内容收缩宽度，而非撑满父容器 */
  fitContent?: boolean
}) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={SPRING}
          className={`overflow-hidden border border-t-0 ${fitContent ? 'w-fit max-w-full' : 'w-full'} ${panelClassName}`}
          style={{
            borderWidth: 0.5,
            borderBottomLeftRadius: bottomRadiusPx,
            borderBottomRightRadius: bottomRadiusPx,
          }}
        >
          <div
            className={`border-t border-dashed px-3 py-2.5 text-[13px] leading-[1.7] break-words ${dividerClassName}`}
          >
            {firstChar ? (
              <span className={`mr-[1px] text-[17px] leading-none ${firstCharClassName}`}>{firstChar}</span>
            ) : null}
            <span>{restText}</span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function VoiceMessageBubble({
  isUser,
  duration,
  audioUrl,
  transcriptText,
  onTranscriptToggle,
  onRequestAudio,
  onLongPress,
  messengerStyle = 'lumi',
  bubble,
  showBubbleTail = false,
  bubbleTailMaskColor = 'var(--wx-chat-room-bg, #EDEDED)',
  messageTimestampMs,
  telegramShowReadChecks = true,
  replyPreview,
  voicePlayed = false,
  onVoicePlayed,
}: VoiceMessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [played, setPlayed] = useState(voicePlayed)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [progress, setProgress] = useState(0)
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState(audioUrl.trim())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const boundAudioUrlRef = useRef('')
  const fallbackTimerRef = useRef<number | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)
  const pressStartRef = useRef<{ x: number; y: number } | null>(null)

  const waveBars = useMemo(() => buildWaveHeights(duration || 1), [duration])

  const bindAudio = (url: string) => {
    const audio = new Audio(url)
    audio.preload = 'metadata'
    const onTimeUpdate = () => {
      if (!audio.duration || !Number.isFinite(audio.duration)) {
        setProgress(0)
        return
      }
      setProgress(Math.max(0, Math.min(1, audio.currentTime / audio.duration)))
    }
    const onEnded = () => {
      setIsPlaying(false)
      setProgress(0)
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audioRef.current = audio
    boundAudioUrlRef.current = url
    return {
      audio,
      dispose: () => {
        audio.pause()
        audio.removeEventListener('timeupdate', onTimeUpdate)
        audio.removeEventListener('ended', onEnded)
        if (audioRef.current === audio) {
          audioRef.current = null
        }
      },
    }
  }

  useEffect(() => {
    setResolvedAudioUrl(audioUrl.trim())
  }, [audioUrl])

  useEffect(() => {
    if (voicePlayed) setPlayed(true)
  }, [voicePlayed])

  const markVoicePlayed = useCallback(() => {
    if (isUser) return
    setPlayed(true)
    onVoicePlayed?.()
  }, [isUser, onVoicePlayed])

  useEffect(() => {
    if (typeof window === 'undefined' || !resolvedAudioUrl) {
      audioRef.current = null
      boundAudioUrlRef.current = ''
      return
    }
    if (audioRef.current && boundAudioUrlRef.current === resolvedAudioUrl) {
      return
    }
    const { dispose } = bindAudio(resolvedAudioUrl)
    return () => {
      dispose()
    }
  }, [resolvedAudioUrl])

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current != null) {
        window.clearInterval(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
      if (longPressTimerRef.current != null) {
        window.clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }
  }, [])

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const onBubblePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!onLongPress) return
    clearLongPressTimer()
    longPressTriggeredRef.current = false
    pressStartRef.current = { x: e.clientX, y: e.clientY }
    const el = e.currentTarget
    const pid = e.pointerId
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true
      onLongPress(el.getBoundingClientRect())
      try {
        if (el.hasPointerCapture(pid)) el.releasePointerCapture(pid)
      } catch {
        /* ignore */
      }
    }, 420)
  }

  const onBubblePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const start = pressStartRef.current
    if (!start) return
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
    if (moved > 10) clearLongPressTimer()
  }

  const onBubblePointerEnd = () => {
    pressStartRef.current = null
    clearLongPressTimer()
  }

  const togglePlay = async () => {
    if (isGeneratingAudio) return
    if (!isUser && !played) markVoicePlayed()
    const audio = audioRef.current
    if (!resolvedAudioUrl) {
      if (!onRequestAudio) return
      try {
        setIsGeneratingAudio(true)
        const nextUrl = (await onRequestAudio()).trim()
        if (!nextUrl) return
        setResolvedAudioUrl(nextUrl)
        const existing = audioRef.current
        existing?.pause()
        const { audio: nextAudio } = bindAudio(nextUrl)
        await nextAudio.play()
        setIsPlaying(true)
      } finally {
        setIsGeneratingAudio(false)
      }
      return
    }
    const fallbackMode = !resolvedAudioUrl.trim()
    if (fallbackMode) {
      if (isPlaying) {
        if (fallbackTimerRef.current != null) {
          window.clearInterval(fallbackTimerRef.current)
          fallbackTimerRef.current = null
        }
        setIsPlaying(false)
        return
      }
      const totalMs = Math.max(1, Math.round(duration || 1)) * 1000
      const started = Date.now()
      setIsPlaying(true)
      setProgress(0)
      fallbackTimerRef.current = window.setInterval(() => {
        const p = Math.min(1, (Date.now() - started) / totalMs)
        setProgress(p)
        if (p >= 1) {
          if (fallbackTimerRef.current != null) {
            window.clearInterval(fallbackTimerRef.current)
            fallbackTimerRef.current = null
          }
          setIsPlaying(false)
          setProgress(0)
        }
      }, 50)
      return
    }
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }
    await audio.play()
    setIsPlaying(true)
  }

  const toggleTranscript = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setIsTranscribing((v) => {
      const next = !v
      if (next && !isUser) markVoicePlayed()
      onTranscriptToggle?.(next)
      return next
    })
  }

  const firstChar = transcriptText.trim().charAt(0)
  const restText = transcriptText.trim().slice(1)

  const bubbleClass = isUser
    ? 'bg-[var(--wx-self-bubble-bg,#95EC69)] text-[#191919]'
    : 'bg-[var(--wx-other-bubble-bg,#FFFFFF)] text-[#191919]'

  const wechatVoiceWidth = wechatVoiceBubbleWidthPx(duration)
  const wechatRadius = bubble?.selfBubbleRadiusPx ?? WECHAT_CLASSIC.bubbleRadiusPx

  if (messengerStyle === 'wechat') {
    const showUnreadDot = !isUser && !played
    const hasTranscript =
      transcriptText.trim().length > 0 && transcriptText.trim() !== '（暂未生成转写文本）'
    const tailColor = isUser
      ? 'var(--wx-self-bubble-bg,#95EC69)'
      : 'var(--wx-other-bubble-bg,#FFFFFF)'
    const voiceTopRadius = isTranscribing ? `${wechatRadius}px ${wechatRadius}px 0 0` : `${wechatRadius}px`

    const voiceShell = (
      <div className={`inline-flex ${WECHAT_CHAT_BUBBLE_MAX_CLASS} ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-start gap-1.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`flex min-w-0 flex-col ${isUser ? 'items-end' : 'items-start'}`}>
            <motion.button
              type="button"
              onClick={() => {
                if (longPressTriggeredRef.current) {
                  longPressTriggeredRef.current = false
                  return
                }
                void togglePlay()
              }}
              onPointerDown={onBubblePointerDown}
              onPointerMove={onBubblePointerMove}
              onPointerUp={onBubblePointerEnd}
              onPointerCancel={onBubblePointerEnd}
              whileTap={{ scale: 0.985 }}
              transition={SPRING}
              className={`relative flex h-10 shrink-0 items-center px-3 shadow-sm ${bubbleClass}`}
              style={{ width: wechatVoiceWidth, borderRadius: voiceTopRadius }}
            >
              {showBubbleTail ? <WechatBubbleTail isSelf={isUser} bubbleColor={tailColor} /> : null}
              <div className="flex w-full items-center gap-2.5">
                {isUser ? (
                  <>
                    <span className="shrink-0 text-[15px] font-normal tabular-nums leading-none">
                      {Math.max(1, Math.round(duration))}"
                    </span>
                    <WechatVoiceWaveIcon isSelf />
                  </>
                ) : (
                  <>
                    <WechatVoiceWaveIcon isSelf={false} />
                    <span className="shrink-0 text-[15px] font-normal tabular-nums leading-none">
                      {Math.max(1, Math.round(duration))}"
                    </span>
                  </>
                )}
              </div>
            </motion.button>
            <VoiceTranscriptExpandedPanel
              open={isTranscribing}
              firstChar={firstChar}
              restText={restText}
              fitContent
              panelClassName={
                isUser
                  ? 'border-[#7ed957] bg-[var(--wx-self-bubble-bg,#95EC69)] text-[#191919]'
                  : 'border-[#ececec] bg-[var(--wx-other-bubble-bg,#ffffff)] text-[#191919]'
              }
              dividerClassName="border-black/10"
              firstCharClassName="text-[#191919]"
              bottomRadiusPx={wechatRadius}
            />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 self-center">
            {showUnreadDot ? (
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#FA5151]" aria-label="未播放" />
            ) : null}
            {hasTranscript ? (
              <button
                type="button"
                onClick={(e) => toggleTranscript(e)}
                className="shrink-0 rounded bg-[#E5E5E5] px-2 py-0.5 text-[12px] text-gray-600 active:opacity-70"
              >
                转文字
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )

    return voiceShell
  }

  const legacyBubbleStyle: CSSProperties = {
    borderWidth: 0.5,
    backgroundColor: isUser
      ? 'var(--wx-special-voice-bg-self, #FAF8F5)'
      : 'var(--wx-special-voice-bg-other, #ffffff)',
    borderColor: isUser
      ? 'var(--wx-special-voice-border-self, #e7e2d9)'
      : 'var(--wx-special-voice-border-other, #ececec)',
    boxShadow: isUser ? undefined : '0 2px 8px rgba(0,0,0,0.04)',
  }

  const baseWaveColor = 'var(--wx-special-voice-wave-idle, #b6b6b6)'
  const activeWaveColor = isUser
    ? 'var(--wx-special-voice-wave-active-self, #D4AF37)'
    : 'var(--wx-special-voice-wave-active-other, #8d8d8d)'

  const talkmakerTimeLabel =
    messengerStyle === 'talkmaker' && typeof messageTimestampMs === 'number'
      ? formatTalkmakerExternalTime(messageTimestampMs)
      : null

  const messengerRadiusPx =
    bubble && isAltMessengerBubbleStyle(messengerStyle)
      ? isUser
        ? bubble.selfBubbleRadiusPx
        : bubble.otherBubbleRadiusPx
      : 18

  if (isAltMessengerBubbleStyle(messengerStyle) && bubble) {
    const transcriptUi = messengerTranscriptUi(messengerStyle, isUser)
    const voiceBlock = (
      <div
        className={`relative min-w-0 max-w-[min(280px,calc(100vw-120px))] ${
          isUser ? 'mr-3' : 'ml-3'
        }`}
      >
        <motion.button
          type="button"
          onClick={() => {
            if (longPressTriggeredRef.current) {
              longPressTriggeredRef.current = false
              return
            }
            void togglePlay()
          }}
          onPointerDown={onBubblePointerDown}
          onPointerMove={onBubblePointerMove}
          onPointerUp={onBubblePointerEnd}
          onPointerCancel={onBubblePointerEnd}
          whileTap={{ scale: 0.985 }}
          transition={SPRING}
          className="block w-full bg-transparent p-0 text-left"
        >
          <MessengerVoiceBubbleShell
            embedded
            isSelf={isUser}
            messengerStyle={messengerStyle}
            bubble={bubble}
            showTail={showBubbleTail}
            bubbleTailMaskColor={bubbleTailMaskColor}
            replyPreview={replyPreview}
            transcriptExpanded={isTranscribing}
          >
            {messengerStyle === 'imessage' ? (
              <ImessageVoiceBubbleFace
                isSelf={isUser}
                duration={duration}
                isPlaying={isPlaying}
                progress={progress}
                waveSeed={duration || 1}
              />
            ) : messengerStyle === 'talkmaker' ? (
              <TalkmakerVoiceBubbleFace duration={duration} isPlaying={isPlaying} />
            ) : (
              <TelegramVoiceBubbleFace
                isSelf={isUser}
                duration={duration}
                isPlaying={isPlaying}
                progress={progress}
                waveSeed={duration || 1}
                timeLabel={
                  typeof messageTimestampMs === 'number'
                    ? formatTelegramBubbleTime(messageTimestampMs)
                    : undefined
                }
                showReadChecks={telegramShowReadChecks}
              />
            )}
            <VoiceTranscriptToggleButton
              isTranscribing={isTranscribing}
              onToggle={toggleTranscript}
              alignSelf={isUser ? 'start' : 'end'}
              className={transcriptUi.toggle}
            />
          </MessengerVoiceBubbleShell>
        </motion.button>
        <VoiceTranscriptExpandedPanel
          open={isTranscribing}
          firstChar={firstChar}
          restText={restText}
          panelClassName={transcriptUi.panel}
          dividerClassName={transcriptUi.panelDivider}
          firstCharClassName={transcriptUi.firstChar}
          bottomRadiusPx={messengerRadiusPx}
        />
      </div>
    )

    return (
      <div className={`${isUser ? 'ml-auto' : ''}`}>
        {talkmakerTimeLabel ? (
          <div className={`flex max-w-full items-end gap-1 ${isUser ? 'justify-end' : ''}`}>
            {isUser ? <TalkmakerExternalTimestamp timeLabel={talkmakerTimeLabel} /> : null}
            {voiceBlock}
            {!isUser ? <TalkmakerExternalTimestamp timeLabel={talkmakerTimeLabel} /> : null}
          </div>
        ) : (
          voiceBlock
        )}
      </div>
    )
  }

  return (
    <div data-wx-msg-kind="voice" className={`w-[206px] ${isUser ? 'ml-auto' : ''}`}>
      <motion.button
        type="button"
        onClick={() => {
          if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false
            return
          }
          void togglePlay()
        }}
        onPointerDown={onBubblePointerDown}
        onPointerMove={onBubblePointerMove}
        onPointerUp={onBubblePointerEnd}
        onPointerCancel={onBubblePointerEnd}
        whileTap={{ scale: 0.985 }}
        transition={SPRING}
        className="w-full rounded-[18px] border px-2.5 pt-3 text-left"
        style={legacyBubbleStyle}
      >
        <div className="flex items-center gap-2">
          <motion.span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[#3f3f3f]"
            style={{
              borderColor: '#dfdfdf',
              backgroundColor: 'var(--wx-special-voice-play-bg, #ffffff)',
            }}
            animate={isPlaying ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={isPlaying ? { repeat: Infinity, duration: 1.1, ease: 'easeInOut' } : SPRING}
          >
            {isGeneratingAudio ? (
              <span className="text-[10px] font-medium tracking-[0.08em] text-[#8c7a37]">...</span>
            ) : isPlaying ? (
              <Pause size={15} />
            ) : (
              <Play size={15} className="ml-[1px]" />
            )}
          </motion.span>

          <div className="flex w-[94px] shrink-0 items-end gap-[2px]">
            {waveBars.map((h, idx) => {
              const passed = idx / waveBars.length <= progress
              return (
                <motion.span
                  key={idx}
                  className="w-[2px] rounded-full"
                  animate={{
                    height: isPlaying ? [h, Math.max(7, h - 4), h] : h,
                    backgroundColor: passed ? activeWaveColor : baseWaveColor,
                    opacity: passed ? 1 : 0.72,
                  }}
                  transition={{
                    duration: isPlaying ? 0.9 : 0.2,
                    repeat: isPlaying ? Infinity : 0,
                    delay: isPlaying ? idx * 0.02 : 0,
                    ease: 'easeInOut',
                  }}
                />
              )
            })}
          </div>

          <span
            className="shrink-0 pl-1 font-mono text-[13px]"
            style={{ color: 'var(--wx-special-voice-duration, #555)' }}
          >
            {Math.max(1, Math.round(duration))}"
          </span>
        </div>

        <VoiceTranscriptToggleButton
          isTranscribing={isTranscribing}
          onToggle={toggleTranscript}
          alignSelf={isUser ? 'start' : 'end'}
          className="border-[#e5e5e5] bg-white/70 text-[#8a8a8a]"
        />
      </motion.button>

      <VoiceTranscriptExpandedPanel
        open={isTranscribing}
        firstChar={firstChar}
        restText={restText}
        panelClassName={
          isUser
            ? 'border-[#e7e2d9] bg-[var(--wx-self-bubble-bg,#FAF8F5)] text-[#333]'
            : 'border-[#ececec] bg-[var(--wx-other-bubble-bg,#ffffff)] text-[#333]'
        }
        dividerClassName="border-gray-200"
        firstCharClassName="text-[#2b2b2b]"
        bottomRadiusPx={16}
      />
    </div>
  )
}

export function VoiceMessageBubbleMock() {
  return (
    <div className="space-y-4 p-4">
      <VoiceMessageBubble
        isUser
        duration={12}
        audioUrl="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
        transcriptText="（低声）今晚风有点冷，但我真的很想见你。"
      />
      <VoiceMessageBubble
        isUser={false}
        duration={8}
        audioUrl="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
        transcriptText="收到，我在老地方等你。路上慢一点。"
      />
    </div>
  )
}
