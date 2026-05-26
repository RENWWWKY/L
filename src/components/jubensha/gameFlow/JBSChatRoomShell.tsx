import '../jubensha.css'
import './jbs-game-flow.css'
import './jbs-gf-chat-room.css'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { JubenshaScript } from '../types'

import { buildRoleDeck } from './buildRoleDeck'
import type { JBSFlowMedia } from './chatRoom/JBSFlowEngine'
import { CHAT_ROOM_PHASE_LABELS, type ChatRoomPhase } from './chatRoom/chatRoomPhase'
import { getDmVoiceTypewriterScripts } from '../jbsDmVoiceScripts'
import { DmVoiceIntro } from './DmVoiceIntro'
import type { DeckRoleCard, LockedRole } from './gameFlowTypes'
import type { JbsEngineSnapshot, JbsScriptProgress } from './jbsProgressStore'
import { HallRoomBackdrop } from './HallRoomBackdrop'
import { RoomAmbientProvider } from './RoomAmbientContext'
import { JBSChatRoomActive } from './JBSChatRoom'
import { RoleDeck } from './RoleDeck'
import { RoleScriptDetail } from './RoleScriptDetail'

export type JBSChatRoomShellState = {
  chatRoomPhase: ChatRoomPhase
  activeCardId: string | null
  lockedCardId: string | null
  lockedRoleName: string | null
  dmVoiceCompleted: boolean
}

export type JBSChatRoomShellProps = {
  script: JubenshaScript
  playerDisplayName: string
  dmVoiceTracks: readonly string[] | null
  onExit: () => void
  onLockInBurn?: () => void
  videoUrl?: string
  bgmUrl?: string
  restoredProgress?: JbsScriptProgress | null
  initialEngineSnapshot?: JbsEngineSnapshot | null
  initialDmIntroCompletedTrackCount?: number
  onShellStateChange?: (state: JBSChatRoomShellState) => void
  onEngineSnapshotChange?: (snapshot: JbsEngineSnapshot) => void
  onDmIntroTrackProgress?: (completedTrackCount: number) => void
}

function resolveInitialPhase(
  restored: JbsScriptProgress | null | undefined,
  hasVoiceTracks: boolean,
  voiceTrackCount: number,
): ChatRoomPhase {
  if (!restored) return hasVoiceTracks ? 'dm-voice' : 'role-select'
  if (restored.chatRoomPhase === 'playing' && restored.lockedCardId) return 'playing'
  if (restored.chatRoomPhase === 'reading-script' && restored.activeCardId) return 'reading-script'
  const introDone =
    restored.dmVoiceCompleted ||
    (voiceTrackCount > 0 && restored.dmIntroCompletedTrackCount >= voiceTrackCount)
  if (introDone || restored.chatRoomPhase === 'role-select') return 'role-select'
  if (restored.chatRoomPhase === 'dm-voice' && hasVoiceTracks && !introDone) {
    return 'dm-voice'
  }
  return hasVoiceTracks ? 'dm-voice' : 'role-select'
}

function findCardById(deck: DeckRoleCard[], id: string | null | undefined): DeckRoleCard | null {
  if (!id) return null
  return deck.find((c) => c.id === id) ?? null
}

export function JBSChatRoomShell({
  script,
  playerDisplayName,
  dmVoiceTracks,
  onExit,
  onLockInBurn,
  videoUrl,
  bgmUrl,
  restoredProgress = null,
  initialEngineSnapshot = null,
  initialDmIntroCompletedTrackCount = 0,
  onShellStateChange,
  onEngineSnapshotChange,
  onDmIntroTrackProgress,
}: JBSChatRoomShellProps) {
  const deck = useMemo(() => buildRoleDeck(script), [script])
  const media: JBSFlowMedia = useMemo(() => ({ videoUrl, bgmUrl }), [videoUrl, bgmUrl])
  const dmVoiceScripts = useMemo(() => getDmVoiceTypewriterScripts(script.id), [script.id])
  const hasVoiceTracks = !!(dmVoiceTracks && dmVoiceTracks.length > 0)
  const voiceTrackCount = dmVoiceTracks?.length ?? 0

  const [phase, setPhase] = useState<ChatRoomPhase>(() =>
    resolveInitialPhase(restoredProgress, hasVoiceTracks, voiceTrackCount),
  )
  const [activeCard, setActiveCard] = useState<DeckRoleCard | null>(() =>
    findCardById(deck, restoredProgress?.activeCardId),
  )
  const [locked, setLocked] = useState<LockedRole | null>(() => {
    const card = findCardById(deck, restoredProgress?.lockedCardId)
    return card ? { script, card } : null
  })
  const [dmVoiceCompleted, setDmVoiceCompleted] = useState(
    () =>
      restoredProgress?.dmVoiceCompleted ||
      (voiceTrackCount > 0 && initialDmIntroCompletedTrackCount >= voiceTrackCount),
  )
  const [dmIntroCompletedCount, setDmIntroCompletedCount] = useState(initialDmIntroCompletedTrackCount)

  const emitShellState = useCallback(
    (next: {
      phase: ChatRoomPhase
      activeCard: DeckRoleCard | null
      locked: LockedRole | null
      dmVoiceCompleted: boolean
    }) => {
      onShellStateChange?.({
        chatRoomPhase: next.phase,
        activeCardId: next.activeCard?.id ?? null,
        lockedCardId: next.locked?.card.id ?? null,
        lockedRoleName: next.locked?.card.role.name ?? null,
        dmVoiceCompleted: next.dmVoiceCompleted,
      })
    },
    [onShellStateChange],
  )

  useEffect(() => {
    emitShellState({ phase, activeCard, locked, dmVoiceCompleted })
  }, [phase, activeCard, locked, dmVoiceCompleted, emitShellState])

  const handleVoiceDone = useCallback(() => {
    setDmVoiceCompleted(true)
    setDmIntroCompletedCount(voiceTrackCount)
    onDmIntroTrackProgress?.(voiceTrackCount)
    setPhase('role-select')
    setActiveCard(null)
  }, [onDmIntroTrackProgress, voiceTrackCount])

  const handleDmIntroTrackProgress = useCallback(
    (count: number) => {
      setDmIntroCompletedCount(count)
      onDmIntroTrackProgress?.(count)
    },
    [onDmIntroTrackProgress],
  )

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
          initialEngineSnapshot={initialEngineSnapshot}
          onEngineSnapshotChange={onEngineSnapshotChange}
        />
      ) : (
        <>
          <header className="jbs-gf-chat-header jbs-safe-header relative z-20 shrink-0 px-4 pb-3">
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                type="button"
                onClick={onExit}
                className="jbs-gf-chat-icon-btn flex size-9 shrink-0 items-center justify-center rounded-full"
                aria-label="退出"
              >
                <ArrowLeft className="size-5" strokeWidth={1.5} />
              </button>
              <motion.div
                className="min-w-0 flex-1 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.06, duration: 0.35 }}
              >
                <p className="jbs-font-handwriting truncate text-[17px]">
                  {script.title}
                </p>
                <p className="jbs-gf-chat-step-pill jbs-font-serif mt-0.5 text-[10px] tracking-[0.16em]">
                  {subtitle}
                </p>
              </motion.div>
              <motion.div className="size-9 shrink-0" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
            </motion.div>
          </header>

          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <AnimatePresence mode="wait">
              {phase === 'dm-voice' && dmVoiceTracks ? (
                <DmVoiceIntro
                  key="voice"
                  embedded
                  tracks={dmVoiceTracks}
                  typewriterScripts={dmVoiceScripts ?? undefined}
                  initialCompletedTrackCount={dmIntroCompletedCount}
                  onTrackProgress={handleDmIntroTrackProgress}
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
