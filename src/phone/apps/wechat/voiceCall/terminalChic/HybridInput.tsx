import { Mic, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Pressable } from '../../../../components/Pressable'

/**
 * 底部混合输入区
 * - 默认：文本输入 + 右侧麦克风
 * - 有内容：右侧平滑切换为发送按钮
 * - 按住麦克风：进入 LISTENING... 脉冲态；松手后 mock 识别回填
 */
export function HybridInput({
  draft,
  setDraft,
  onSubmitText,
  onTriggerReply,
  onVoiceRecognize,
  onVoiceRecognizeError,
}: {
  draft: string
  setDraft: (v: string) => void
  /** 提交文本消息（不触发模型） */
  onSubmitText: () => void
  /** 触发模型回复（如点纸飞机、空输入回车） */
  onTriggerReply: () => void
  /** 长按录音结束后调用语音识别 */
  onVoiceRecognize?: (audioBlob: Blob) => Promise<{ text: string; emotion?: string }>
  onVoiceRecognizeError?: (message: string) => void
}) {
  const [listening, setListening] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const [waveBars, setWaveBars] = useState<number[]>(Array.from({ length: 24 }, () => 0.08))
  const holdRef = useRef(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)

  const stopWaveSampling = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    try {
      sourceNodeRef.current?.disconnect()
    } catch {
      // ignore
    }
    sourceNodeRef.current = null
    analyserRef.current = null
    if (audioCtxRef.current) {
      void audioCtxRef.current.close()
    }
    audioCtxRef.current = null
    setWaveBars(Array.from({ length: 24 }, () => 0.08))
  }

  const startWaveSampling = (stream: MediaStream) => {
    stopWaveSampling()
    const AudioCtxCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtxCtor) return
    const ctx = new AudioCtxCtor()
    audioCtxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    sourceNodeRef.current = source
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.82
    source.connect(analyser)
    analyserRef.current = analyser
    const data = new Uint8Array(analyser.frequencyBinCount)
    const barCount = 24
    const min = 0.08

    const tick = () => {
      const a = analyserRef.current
      if (!a) return
      a.getByteFrequencyData(data)
      const step = Math.max(1, Math.floor(data.length / barCount))
      const next = Array.from({ length: barCount }, (_, idx) => {
        const start = idx * step
        const end = Math.min(data.length, start + step)
        let sum = 0
        for (let i = start; i < end; i += 1) sum += data[i] ?? 0
        const avg = sum / Math.max(1, end - start)
        return Math.max(min, Math.min(1, avg / 255))
      })
      setWaveBars(next)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  const getActiveStream = async (): Promise<MediaStream> => {
    const existing = mediaStreamRef.current
    if (existing && existing.getTracks().some((t) => t.readyState === 'live')) {
      return existing
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaStreamRef.current = stream
    return stream
  }

  useEffect(() => {
    if (!listening) return
    const onUp = () => {
      if (!holdRef.current) return
      holdRef.current = false
      setListening(false)
      stopWaveSampling()
      const recorder = mediaRecorderRef.current
      if (!recorder) return
      try {
        recorder.stop()
      } catch {
        // ignore
      }
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [listening])

  useEffect(() => {
    return () => {
      stopWaveSampling()
      const stream = mediaStreamRef.current
      if (stream) stream.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
      mediaRecorderRef.current = null
      chunksRef.current = []
    }
  }, [])

  return (
    <div
      className="shrink-0 border-t border-black/5 bg-white px-4 pb-[max(14px,env(safe-area-inset-bottom,0px))] pt-3"
      style={{ boxShadow: '0 -10px 30px rgba(0,0,0,0.03)' }}
    >
      <div
        className="mx-auto flex w-full max-w-[720px] items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2"
        style={{
          boxShadow: listening ? '0 0 0 6px rgba(0,0,0,0.04)' : 'none',
          transition: 'box-shadow 180ms ease-out, border-color 180ms ease-out',
        }}
      >
        <div className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2">
          {listening ? (
            <div className="flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-black/12 bg-white/80 px-2.5">
              <span className="mr-2 shrink-0 text-[11px] tracking-wide text-black/45">LISTENING</span>
              <div className="flex h-6 min-w-0 flex-1 items-end gap-[2px]">
                {waveBars.map((v, idx) => (
                  <span
                    key={idx}
                    className="block flex-1 rounded-[2px] bg-black/60 transition-[height] duration-75 ease-out"
                    style={{ height: `${Math.max(16, Math.round(v * 100))}%` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="输入消息..."
              className="h-9 min-w-0 flex-1 rounded-lg border border-black/12 bg-white/80 px-2.5 text-[14px] outline-none placeholder:text-black/30 focus-visible:border-black/25 focus-visible:ring-1 focus-visible:ring-black/10"
              style={{ fontFamily: 'var(--wx-font)' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (draft.trim()) onSubmitText()
                  else onTriggerReply()
                }
              }}
            />
          )}

          <div className="relative h-9 w-9 shrink-0">
            <Pressable
              type="button"
              aria-label="按住说话"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-black active:scale-[0.97]"
              onPointerDown={(e) => {
                e.preventDefault()
                inputRef.current?.blur()
                const active = document.activeElement
                if (active instanceof HTMLElement) active.blur()
                if (recognizing) return
                holdRef.current = true
                setListening(true)
                void (async () => {
                  try {
                    const stream = await getActiveStream()
                    startWaveSampling(stream)
                    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                      ? 'audio/webm;codecs=opus'
                      : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
                        ? 'audio/ogg;codecs=opus'
                        : ''
                    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
                    mediaRecorderRef.current = recorder
                    chunksRef.current = []
                    recorder.ondataavailable = (evt: BlobEvent) => {
                      if (evt.data && evt.data.size > 0) chunksRef.current.push(evt.data)
                    }
                    recorder.onstop = () => {
                      const parts = chunksRef.current
                      chunksRef.current = []
                      if (!parts.length || !onVoiceRecognize) return
                      const blob = new Blob(parts, { type: recorder.mimeType || 'audio/webm' })
                      setRecognizing(true)
                      void onVoiceRecognize(blob)
                        .then(() => {
                          // 语音识别结果由上层直接写入通话内容区，不再回填输入框。
                        })
                        .catch((err: unknown) => {
                          const msg = err instanceof Error ? err.message : '语音识别失败'
                          onVoiceRecognizeError?.(msg)
                        })
                        .finally(() => setRecognizing(false))
                    }
                    recorder.start()
                  } catch {
                    holdRef.current = false
                    setListening(false)
                    stopWaveSampling()
                    onVoiceRecognizeError?.('无法启用麦克风，请检查设备权限')
                  }
                })()
              }}
              onTouchStart={(e) => {
                e.preventDefault()
              }}
              onMouseDown={(e) => {
                e.preventDefault()
              }}
              onContextMenu={(e) => {
                e.preventDefault()
              }}
              onFocus={(e) => {
                e.currentTarget.blur()
              }}
              style={{
                transition: 'transform 120ms ease-out, opacity 160ms ease-out',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
              }}
            >
              <Mic className="size-5" />
            </Pressable>

            {listening ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{
                  boxShadow: '0 0 0 0 rgba(0,0,0,0.08)',
                  animation: 'vc-pulse 1.1s ease-out infinite',
                }}
              />
            ) : null}
          </div>

          <Pressable
            type="button"
            aria-label="触发回复"
            onClick={onTriggerReply}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white text-black active:scale-[0.97] disabled:opacity-50"
            disabled={recognizing}
          >
            <Send className="size-4" />
          </Pressable>
        </div>
      </div>
    </div>
  )
}

