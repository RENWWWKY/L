import { useEffect, useMemo, useRef, useState } from 'react'

type VisualTone = 'default' | 'cancel' | 'toText'

const BAR_COUNT = 24

function toneToColor(tone: VisualTone): string {
  if (tone === 'cancel') return '#d08a8a'
  if (tone === 'toText') return '#D4AF37'
  return '#4a4a4a'
}

export function AudioVisualizer({ active, tone }: { active: boolean; tone: VisualTone }) {
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: BAR_COUNT }, () => 0.25))
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const fallbackTickRef = useRef(0)

  const color = useMemo(() => toneToColor(tone), [tone])

  useEffect(() => {
    if (!active) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      return
    }

    let cancelled = false
    const fallbackAnimate = () => {
      fallbackTickRef.current += 1
      const now = Date.now() / 350
      const next = Array.from({ length: BAR_COUNT }, (_, i) => {
        const wave = Math.sin(now + i * 0.45) * 0.2
        const pulse = Math.sin(now * 0.7 + i * 0.2 + fallbackTickRef.current * 0.01) * 0.15
        return Math.max(0.12, Math.min(1, 0.45 + wave + pulse))
      })
      setLevels(next)
      rafRef.current = requestAnimationFrame(fallbackAnimate)
    }

    const startAnalyser = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const audioCtx = new window.AudioContext()
        audioCtxRef.current = audioCtx
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.78
        source.connect(analyser)
        analyserRef.current = analyser
        const data = new Uint8Array(analyser.frequencyBinCount)
        const frame = () => {
          analyser.getByteFrequencyData(data)
          const seg = Math.max(1, Math.floor(data.length / BAR_COUNT))
          const next = Array.from({ length: BAR_COUNT }, (_, i) => {
            const start = i * seg
            const end = Math.min(data.length, start + seg)
            let sum = 0
            for (let j = start; j < end; j += 1) sum += data[j] || 0
            const avg = end > start ? sum / (end - start) : 0
            return Math.max(0.1, Math.min(1, avg / 180))
          })
          setLevels(next)
          rafRef.current = requestAnimationFrame(frame)
        }
        frame()
      } catch {
        fallbackAnimate()
      }
    }

    void startAnalyser()

    return () => {
      cancelled = true
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      analyserRef.current = null
      if (audioCtxRef.current) {
        void audioCtxRef.current.close()
        audioCtxRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [active])

  return (
    <div className="flex h-20 items-end justify-center gap-1 px-2">
      {levels.map((level, index) => (
        <span
          key={index}
          className="w-[4px] rounded-full transition-[height,background-color] duration-100"
          style={{
            height: `${Math.round(14 + level * 52)}px`,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  )
}
