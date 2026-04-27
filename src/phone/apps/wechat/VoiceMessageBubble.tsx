import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play, ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'

export type VoiceMessageBubbleProps = {
  isUser: boolean
  duration: number
  audioUrl: string
  transcriptText: string
  onTranscriptToggle?: (expanded: boolean) => void
}

const SPRING = { type: 'spring', stiffness: 300, damping: 30 } as const

function buildWaveHeights(seed: number) {
  const count = 26
  return Array.from({ length: count }, (_, i) => {
    const n = Math.sin((i + 1) * 0.93 + seed * 0.37) * 0.5 + 0.5
    return 8 + Math.round(n * 17)
  })
}

export function VoiceMessageBubble({
  isUser,
  duration,
  audioUrl,
  transcriptText,
  onTranscriptToggle,
}: VoiceMessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fallbackTimerRef = useRef<number | null>(null)

  const waveBars = useMemo(() => buildWaveHeights(duration || 1), [duration])

  useEffect(() => {
    if (typeof window === 'undefined' || !audioUrl.trim()) {
      audioRef.current = null
      return
    }
    const audio = new Audio(audioUrl)
    audio.preload = 'metadata'
    audioRef.current = audio
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
    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audioRef.current = null
    }
  }, [audioUrl])

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current != null) {
        window.clearInterval(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
    }
  }, [])

  const togglePlay = () => {
    const fallbackMode = !audioUrl.trim()
    const audio = audioRef.current
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
    void audio.play()
    setIsPlaying(true)
  }

  const toggleTranscript = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setIsTranscribing((v) => {
      const next = !v
      onTranscriptToggle?.(next)
      return next
    })
  }

  const bubbleClass = isUser
    ? 'bg-[#FAF8F5] border-[#e7e2d9]'
    : 'bg-white border-[#ececec] shadow-[0_2px_8px_rgba(0,0,0,0.04)]'

  const baseWaveColor = '#b6b6b6'
  const activeWaveColor = isUser ? '#D4AF37' : '#8d8d8d'
  const firstChar = transcriptText.trim().charAt(0)
  const restText = transcriptText.trim().slice(1)

  return (
    <div className={`w-[206px] ${isUser ? 'ml-auto' : ''}`}>
      <motion.button
        type="button"
        onClick={togglePlay}
        whileTap={{ scale: 0.985 }}
        transition={SPRING}
        className={`w-full rounded-[18px] border px-2.5 pt-3 text-left ${bubbleClass}`}
        style={{ borderWidth: 0.5 }}
      >
        <div className="flex items-center gap-2">
          <motion.span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#dfdfdf] bg-white text-[#3f3f3f]"
            animate={isPlaying ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={isPlaying ? { repeat: Infinity, duration: 1.1, ease: 'easeInOut' } : SPRING}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-[1px]" />}
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

          <span className="shrink-0 pl-1 font-mono text-[13px] text-[#555]">{Math.max(1, Math.round(duration))}"</span>
        </div>

        <div className={`relative mt-2 flex items-center pb-2 ${isUser ? 'justify-start' : 'justify-end'}`}>
          <motion.button
            type="button"
            onClick={toggleTranscript}
            whileTap={{ scale: 0.95 }}
            transition={SPRING}
            className="inline-flex items-center gap-1 rounded-full border border-[#e5e5e5] bg-white/70 px-2 py-0.5 text-[11px] text-[#8a8a8a]"
          >
            <span className="font-medium">Transcript</span>
            <ChevronDown size={12} className={`transition-transform duration-200 ${isTranscribing ? 'rotate-180' : ''}`} />
          </motion.button>
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {isTranscribing ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING}
            className="overflow-hidden rounded-b-[16px] border border-t-0 border-[#ececec] bg-gray-50/50"
            style={{ borderWidth: 0.5 }}
          >
            <div className="border-t border-dashed border-gray-200 px-3 py-2.5 text-[13px] leading-[1.7] text-[#333]">
              {firstChar ? <span className="mr-[1px] text-[17px] leading-none text-[#2b2b2b]">{firstChar}</span> : null}
              <span>{restText}</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
