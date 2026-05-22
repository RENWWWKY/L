import '../jubensha.css'
import './jbs-game-flow.css'
import './jbs-gf-chat-room.css'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import type { JubenshaScript } from '../types'

import { buildRoleDeck } from './buildRoleDeck'
import type { JBSFlowMedia } from './chatRoom/JBSFlowEngine'
import { CHAT_ROOM_PHASE_LABELS, type ChatRoomPhase } from './chatRoom/chatRoomPhase'
import { getDmVoiceTypewriterScripts } from '../jbsDmVoiceScripts'
import { DmVoiceIntro } from './DmVoiceIntro'
import type { DeckRoleCard, LockedRole } from './gameFlowTypes'
import { HallRoomBackdrop } from './HallRoomBackdrop'
import { RoomAmbientProvider } from './RoomAmbientContext'
import { JBSChatRoomActive } from './JBSChatRoom'
import { RoleDeck } from './RoleDeck'
import { RoleScriptDetail } from './RoleScriptDetail'

export type JBSChatRoomShellProps = {
  script: JubenshaScript
  playerDisplayName: string
  dmVoiceTracks: readonly string[] | null
  onExit: () => void
  onLockInBurn?: () => void
  videoUrl?: string
  bgmUrl?: string
}

export function JBSChatRoomShell({
  script,
  playerDisplayName,
  dmVoiceTracks,
  onExit,
  onLockInBurn,
  videoUrl,
  bgmUrl,
}: JBSChatRoomShellProps) {
  const deck = useMemo(() => buildRoleDeck(script), [script])
  const media: JBSFlowMedia = useMemo(() => ({ videoUrl, bgmUrl }), [videoUrl, bgmUrl])
  const dmVoiceScripts = useMemo(() => getDmVoiceTypewriterScripts(script.id), [script.id])

  const [phase, setPhase] = useState<ChatRoomPhase>(() =>
    dmVoiceTracks && dmVoiceTracks.length > 0 ? 'dm-voice' : 'role-select',
  )
  const [activeCard, setActiveCard] = useState<DeckRoleCard | null>(null)
  const [locked, setLocked] = useState<LockedRole | null>(null)

  const handleVoiceDone = useCallback(() => {
    setPhase('role-select')
    setActiveCard(null)
  }, [])

  const handleOpenCard = useCallback((card: DeckRoleCard) => {
    setActiveCard(card)
    setPhase('reading-script')
  }, [])

  const handleReturnDeck = useCallback(() => {
    setActiveCard(null)
    setPhase('role-select')
  }, [])

  const handleLockIn = useCallback(() => {
    if (!activeCard) return
    onLockInBurn?.()
    window.setTimeout(() => {
      setLocked({ script, card: activeCard })
      setPhase('playing')
    }, 720)
  }, [activeCard, onLockInBurn, script])

  const subtitle = useMemo(() => {
    if (phase === 'playing' && locked) {
      return `${locked.card.role.name} · ${CHAT_ROOM_PHASE_LABELS.playing}`
    }
    return `《${script.title}》· ${CHAT_ROOM_PHASE_LABELS[phase]}`
  }, [locked, phase, script.title])

  return (
    <motion.div
      className={`jbs-gf-chat-root jbs-gf-root absolute inset-0 z-10 flex min-h-0 flex-col${videoUrl ? ' jbs-gf-chat-root--video' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.65 }}
    >
      <RoomAmbientProvider videoUrl={videoUrl}>
        <HallRoomBackdrop media={media} />

      {phase === 'playing' && locked ? (
        <JBSChatRoomActive
          locked={locked}
          playerDisplayName={playerDisplayName}
          media={media}
          onExit={onExit}
          hideShell
        />
      ) : (
        <>
          <header className="jbs-gf-chat-header jbs-safe-header relative z-20 shrink-0 px-4 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onExit}
                className="jbs-gf-chat-icon-btn flex size-9 shrink-0 items-center justify-center rounded-full"
                aria-label="退出"
              >
                <ArrowLeft className="size-5" strokeWidth={1.5} />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="jbs-font-handwriting truncate text-[17px]">
                  {script.title}
                </p>
                <p className="jbs-gf-chat-step-pill jbs-font-serif mt-0.5 text-[10px] tracking-[0.16em]">
                  {subtitle}
                </p>
              </div>
              <div className="size-9 shrink-0" aria-hidden />
            </div>
          </header>

          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <AnimatePresence mode="wait">
              {phase === 'dm-voice' && dmVoiceTracks ? (
                <DmVoiceIntro
                  key="voice"
                  embedded
                  tracks={dmVoiceTracks}
                  typewriterScripts={dmVoiceScripts ?? undefined}
                  onComplete={handleVoiceDone}
                />
              ) : phase === 'role-select' ? (
                <RoleDeck key="deck" scriptId={script.id} cards={deck} onOpenCard={handleOpenCard} />
              ) : phase === 'reading-script' && activeCard ? (
                <RoleScriptDetail
                  key={`read-${activeCard.id}`}
                  script={script}
                  card={activeCard}
                  onReturn={handleReturnDeck}
                  onLockIn={handleLockIn}
                />
              ) : null}
            </AnimatePresence>
          </div>
        </>
      )}
      </RoomAmbientProvider>
    </motion.div>
  )
}
