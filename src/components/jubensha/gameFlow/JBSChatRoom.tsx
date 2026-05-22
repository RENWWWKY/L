import '../jubensha.css'
import './jbs-game-flow.css'
import './jbs-gf-chat-room.css'

import { motion } from 'framer-motion'
import { ArrowLeft, Bookmark, Send, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { LockedRole } from './gameFlowTypes'
import { HallRoomBackdrop } from './HallRoomBackdrop'
import { JBS_STEP_LABELS } from './chatRoom/jbsFlowTypes'
import { DMMsgBubble } from './chatRoom/DMMsgBubble'
import { JBSControlDrawer } from './chatRoom/JBSControlDrawer'
import { JBSFlowProvider, useJBSFlow, type JBSFlowMedia } from './chatRoom/JBSFlowEngine'
import { PlayerMsgBubble } from './chatRoom/PlayerMsgBubble'

export type JBSChatRoomProps = {
  locked: LockedRole
  playerDisplayName: string
  onExit: () => void
  videoUrl?: string
  bgmUrl?: string
}

type ChatRoomActiveProps = {
  locked: LockedRole
  playerDisplayName: string
  media: JBSFlowMedia
  onExit: () => void
  hideShell?: boolean
}

function ChatRoomActive({ onExit, hideShell = false }: { onExit: () => void; hideShell?: boolean }) {
  const {
    locked,
    messages,
    sendPlayerMessage,
    setDrawerOpen,
    currentStep,
    loopRound,
    bgmMuted,
    setBgmMuted,
    media,
    advanceStep,
  } = useJBSFlow()

  const stepCaption =
    currentStep === 7
      ? `${locked.card.role.name} · 第 7 阶段 (${loopRound}/3)`
      : `${locked.card.role.name} · 第 ${currentStep} 阶段`

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !media.bgmUrl) return
    audio.volume = bgmMuted ? 0 : 0.35
    if (!bgmMuted) {
      void audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [bgmMuted, media.bgmUrl])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const send = useCallback(() => {
    sendPlayerMessage(draft)
    setDraft('')
  }, [draft, sendPlayerMessage])

  const toggleBgm = useCallback(() => {
    setBgmMuted(!bgmMuted)
  }, [bgmMuted, setBgmMuted])

  return (
    <div className={`flex min-h-0 flex-col ${hideShell ? 'absolute inset-0 z-10' : 'absolute inset-0'}`}>
      {!hideShell ? <HallRoomBackdrop media={media} /> : null}

      {media.bgmUrl ? (
        <audio ref={audioRef} id="jbs-bgm" loop src={media.bgmUrl} preload="auto" />
      ) : null}

      <header className="jbs-gf-chat-header jbs-safe-header shrink-0 px-4 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExit}
            className="jbs-gf-chat-icon-btn flex size-9 shrink-0 items-center justify-center rounded-full"
            aria-label="退出暗室"
          >
            <ArrowLeft className="size-5" strokeWidth={1.5} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="jbs-font-handwriting truncate text-[17px]">
              {locked.script.title}
            </p>
            <p className="jbs-gf-chat-step-pill jbs-font-serif mt-0.5 text-[10px] tracking-[0.14em]">
              {stepCaption} · {JBS_STEP_LABELS[currentStep]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="jbs-gf-chat-bookmark-btn flex size-9 shrink-0 items-center justify-center rounded-full"
            aria-label="打开手札"
          >
            <Bookmark className="size-4" strokeWidth={1.25} />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <div className="jbs-gf-chat-progress-track h-0.5 flex-1 overflow-hidden rounded-full">
            <motion.div
              className="jbs-gf-chat-progress-fill h-full"
              initial={false}
              animate={{ width: `${(currentStep / 8) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          {media.bgmUrl ? (
            <button
              type="button"
              onClick={toggleBgm}
              className="flex size-7 items-center justify-center text-white/65"
              aria-label={bgmMuted ? '开启背景音乐' : '静音'}
            >
              {bgmMuted ? (
                <VolumeX className="size-3.5" strokeWidth={1.25} />
              ) : (
                <Volume2 className="size-3.5" strokeWidth={1.25} />
              )}
            </button>
          ) : (
            <span className="size-7 shrink-0" aria-hidden />
          )}
          <button
            type="button"
            onClick={advanceStep}
            className="jbs-gf-chat-step-pill shrink-0 rounded border border-[#5c3d2e]/22 bg-[#fffef9]/80 px-2 py-0.5 text-[8px]"
            title="主持进程推进（原型）"
          >
            推进
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto jbs-hide-scrollbar px-3 py-4"
      >
        {messages.map((line) => {
          if (line.kind === 'system') {
            return (
              <p
                key={line.id}
                className="jbs-gf-chat-system-line jbs-font-serif mb-3 text-center text-[9px] leading-relaxed tracking-[0.18em]"
              >
                {line.body}
              </p>
            )
          }
          if (line.kind === 'dm') {
            return <DMMsgBubble key={line.id} body={line.body} />
          }
          return (
            <PlayerMsgBubble
              key={line.id}
              body={line.body}
              roleName={line.roleName ?? locked.card.role.name}
              isSelf
            />
          )
        })}
      </div>

      <div className="jbs-gf-chat-input-bar shrink-0 px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="在此落笔…"
            className="jbs-gf-chat-input jbs-font-serif min-w-0 flex-1 rounded-lg px-3 py-2.5 text-[14px]"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim()}
            className="jbs-gf-chat-send-btn flex size-11 shrink-0 items-center justify-center rounded-lg disabled:opacity-35"
            aria-label="发送"
          >
            <Send className="size-4" strokeWidth={1.25} />
          </button>
        </div>
      </div>

      <JBSControlDrawer />
    </div>
  )
}

export function JBSChatRoomActive({
  locked,
  playerDisplayName,
  media,
  onExit,
  hideShell = false,
}: ChatRoomActiveProps) {
  return (
    <JBSFlowProvider locked={locked} playerDisplayName={playerDisplayName} media={media}>
      <ChatRoomActive onExit={onExit} hideShell={hideShell} />
    </JBSFlowProvider>
  )
}

export function JBSChatRoom({
  locked,
  playerDisplayName,
  onExit,
  videoUrl,
  bgmUrl,
}: JBSChatRoomProps) {
  const media: JBSFlowMedia = { videoUrl, bgmUrl }

  return (
    <motion.div
      className={`jbs-gf-chat-root jbs-gf-root absolute inset-0 z-10 flex min-h-0 flex-col${media.videoUrl ? ' jbs-gf-chat-root--video' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.65 }}
    >
      <JBSChatRoomActive
        locked={locked}
        playerDisplayName={playerDisplayName}
        media={media}
        onExit={onExit}
      />
    </motion.div>
  )
}
