import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { ConversationLog } from './terminalChic/ConversationLog'
import { HybridInput } from './terminalChic/HybridInput'
import type { VoiceLogMessage } from './terminalChic/types'
import defaultCallBgUrl from '../../../../../image/通话页面默认壁纸.png'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function fmtDuration(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${pad2(mm)}:${pad2(ss)}`
}

function fallbackBgStyle(backgroundImage?: string): React.CSSProperties {
  const url = (backgroundImage ?? '').trim() || defaultCallBgUrl
  if (url) {
    return {
      backgroundImage: `url(${url})`,
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
    }
  }
  // 默认：浅色质感背景（不依赖资产）
  return {
    backgroundImage:
      'radial-gradient(1200px 700px at 20% 10%, rgba(255,255,255,0.95) 0%, rgba(245,245,247,0.82) 46%, rgba(240,240,242,0.88) 100%)',
  }
}

type VoiceCallPanelProps = {
  open: boolean
  peerAvatarUrl?: string
  peerRemarkName: string
  backgroundImage?: string
  /** 角色发起来电时，接通后默认展示的第一句话 */
  initialAiText?: string
  onClose: () => void
  onHangup?: (durationSec: number) => void
  /** 接入真实模型：输入文本 → 返回回复文本 */
  onRequestAiReply: (text: string, opts?: { fromVoice?: boolean; voiceEmotion?: string }) => Promise<string> | string
  /** 语音识别：长按麦克风录音完成后调用 */
  onTranscribeAudio?: (audioBlob: Blob) => Promise<{ text: string; emotion?: string }>
}

function sanitizeVoiceDisplayText(raw: string): string {
  const s = String(raw ?? '')
  // 过滤聊天协议内部标记，避免在通话 UI 里透出。
  const noInternalMarker = s
    .replace(/^\s*\[(?:消息ID|引用)[:：][^\]]+\]\s*$/gim, '')
    .replace(/\s*\[(?:消息ID|引用)[:：][^\]]+\]\s*/gim, ' ')
  return noInternalMarker
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 语音通话全屏面板。
 * - 背景图由 props.backgroundImage 注入（后续可从“我的-设置-通话背景”读取并传入）
 * - 内容区：用户/AI 均用打字机效果逐字展示（队列播放）
 * - 底部：单输入框 + 麦克风按钮；点击麦克风后输入区变为“点击说话”
 */
export function VoiceCallPanel({
  open,
  peerAvatarUrl,
  peerRemarkName,
  backgroundImage,
  initialAiText,
  onClose,
  onHangup,
  onRequestAiReply,
  onTranscribeAudio,
}: VoiceCallPanelProps) {
  const [elapsedSec, setElapsedSec] = useState(0)
  const [status, setStatus] = useState('正在通话中…')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<VoiceLogMessage[]>([])
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null)
  const inflightRef = useRef(false)
  const messagesRef = useRef<VoiceLogMessage[]>([])
  const audioObjectUrlsRef = useRef<string[]>([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (!open) {
      for (const u of audioObjectUrlsRef.current) {
        try {
          URL.revokeObjectURL(u)
        } catch {
          // ignore
        }
      }
      audioObjectUrlsRef.current = []
      setElapsedSec(0)
      setStatus('正在通话中…')
      setDraft('')
      setMessages([])
      setTypingMessageId(null)
      inflightRef.current = false
      return
    }
    const seed = sanitizeVoiceDisplayText(String(initialAiText ?? ''))
    const peer = (peerRemarkName.trim() || 'CHAR').slice(0, 16)
    if (seed) {
      const id = `vc-${Date.now()}-seed`
      const msg: VoiceLogMessage = { id, role: 'character', prefix: peer, text: seed, createdAt: Date.now() }
      setMessages([msg])
      setTypingMessageId(id)
    } else {
      setMessages([])
      setTypingMessageId(null)
    }
    setElapsedSec(0)
    const id = window.setInterval(() => {
      setElapsedSec((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [initialAiText, open, peerRemarkName])

  const peerName = useMemo(() => peerRemarkName.trim() || '对方', [peerRemarkName])
  const bgStyle = useMemo(() => fallbackBgStyle(backgroundImage), [backgroundImage])

  const appendUserText = useCallback((textRaw: string, opts?: { voiceEmotion?: string }) => {
    const text = textRaw.trim()
    if (!text) return false
    setStatus('你正在说话…')
    const now = Date.now()
    const userMsg: VoiceLogMessage = {
      id: `vc-${now}-u`,
      role: 'user',
      prefix: 'YOU',
      text,
      voiceEmotion: opts?.voiceEmotion,
      createdAt: now,
    }
    setMessages((prev) => [...prev, userMsg])
    setTypingMessageId(null)
    window.setTimeout(() => setStatus('正在通话中…'), 260)
    return true
  }, [])

  const appendUserVoice = useCallback((audioBlob: Blob, asr: { text: string; emotion?: string }) => {
    const asrText = String(asr.text ?? '').trim()
    if (!asrText) return false
    setStatus('你正在说话…')
    const now = Date.now()
    const audioUrl = URL.createObjectURL(audioBlob)
    audioObjectUrlsRef.current.push(audioUrl)
    const userMsg: VoiceLogMessage = {
      id: `vc-${now}-u-a`,
      role: 'user',
      prefix: 'YOU',
      text: '语音消息',
      audioUrl,
      audioMime: audioBlob.type || undefined,
      asrText,
      voiceEmotion: asr.emotion,
      createdAt: now,
    }
    setMessages((prev) => [...prev, userMsg])
    setTypingMessageId(null)
    window.setTimeout(() => setStatus('正在通话中…'), 260)
    return true
  }, [])

  const triggerReply = useCallback(async () => {
    if (inflightRef.current) return
    const last = messagesRef.current[messagesRef.current.length - 1]
    if (!last || last.role !== 'user') return
    const promptText = String(last.asrText ?? last.text ?? '').trim()
    if (!promptText) return
    inflightRef.current = true
    setStatus('对方正在说话…')
    try {
      const got = await Promise.resolve(
        onRequestAiReply(promptText, { fromVoice: !!last.voiceEmotion || !!last.audioUrl, voiceEmotion: last.voiceEmotion }),
      )
      const reply = sanitizeVoiceDisplayText(String(got ?? '')) || '…'
      const peer = (peerRemarkName.trim() || 'CHAR').slice(0, 16)
      const t = Date.now()
      const aiMsg: VoiceLogMessage = { id: `vc-${t}-a`, role: 'character', prefix: peer, text: reply, createdAt: t }
      setMessages((prev) => [...prev, aiMsg])
      setTypingMessageId(aiMsg.id)
    } finally {
      window.setTimeout(() => setStatus('正在通话中…'), 350)
      inflightRef.current = false
    }
  }, [onRequestAiReply, peerRemarkName])

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        key="voice-call-panel"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[280] flex h-full w-full flex-col"
        style={{
          background: '#fff',
          fontFamily: 'var(--wx-font)',
        }}
      >
        <div className="absolute inset-0" aria-hidden style={bgStyle} />
        <div className="absolute inset-0" aria-hidden style={{ background: 'rgba(255,255,255,0.22)' }} />

        <header className="relative z-[2] shrink-0 px-4" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}>
          <div className="mx-auto flex w-full max-w-[720px] items-center justify-between">
            <div className="flex items-center gap-3">
              {peerAvatarUrl?.trim() ? (
                <img src={peerAvatarUrl.trim()} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-black/40">?</div>
              )}
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-black">{peerName}</div>
                <div className="text-[12px] text-black/50">
                  {status} · {fmtDuration(elapsedSec)}
                </div>
              </div>
            </div>

            <Pressable
              type="button"
              aria-label="挂断"
              onClick={() => {
                onHangup?.(elapsedSec)
                onClose()
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff3b30] text-white shadow-sm active:scale-[0.97]"
            >
              <X className="size-5" strokeWidth={2} />
            </Pressable>
          </div>
        </header>

        <main className="relative z-[1] flex min-h-0 flex-1 flex-col px-4 py-4">
          {/* 核心对话区：入场轻微上浮 + 淡入，与背景拉开层次 */}
          <motion.div
            className="mx-auto flex w-full max-w-[760px] min-h-0 flex-1 flex-col rounded-[26px] border border-white/45 bg-white/36 shadow-[0_18px_55px_rgba(0,0,0,0.14)]"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          >
            <ConversationLog
              messages={messages}
              typingMessageId={typingMessageId}
              peerAvatarUrl={peerAvatarUrl}
              onTypingComplete={(id) => {
                if (typingMessageId === id) setTypingMessageId(null)
              }}
            />
          </motion.div>
        </main>

        <div className="relative z-[2]">
          <HybridInput
            draft={draft}
            setDraft={setDraft}
            onSubmitText={() => {
              const t = draft.trim()
              if (!t) return
              const ok = appendUserText(t)
              if (!ok) return
              setDraft('')
            }}
            onTriggerReply={() => {
              void triggerReply()
            }}
            onVoiceRecognize={
              onTranscribeAudio
                ? async (blob) => {
                    const res = await onTranscribeAudio(blob)
                    appendUserVoice(blob, res)
                    setDraft('')
                    return res
                  }
                : undefined
            }
            onVoiceRecognizeError={(msg) => {
              setStatus(msg)
              if (/未配置语音识别/i.test(msg)) {
                window.alert('未配置语音识别api，无法使用')
              }
              window.setTimeout(() => setStatus('正在通话中…'), 1200)
            }}
          />
        </div>
      </motion.div>
      <style>{`
        @keyframes vc-blink { 0%, 45% { opacity: 1; } 50%, 100% { opacity: 0; } }
        @keyframes vc-pulse {
          0% { box-shadow: 0 0 0 0 rgba(0,0,0,0.10); opacity: 1; }
          100% { box-shadow: 0 0 0 14px rgba(0,0,0,0.00); opacity: 0; }
        }
      `}</style>
    </AnimatePresence>
  )
}

