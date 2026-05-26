import '../jubensha.css'
import './jbs-game-flow.css'

import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { JubenshaScript } from '../types'

import { ContinueOrRestartPanel } from './ContinueOrRestartPanel'
import { GameFlowToast } from './GameFlowToast'
import { getChatRoomVideoUrl } from '../jbsChatRoomMedia'
import { getDmVoiceIntroUrls } from '../jbsDmVoiceAssets'
import type { FlowState } from './gameFlowTypes'
import { primeJbsRoomAudio } from './jbsAudioUnlock'
import { JBSChatRoomShell, type JBSChatRoomShellState } from './JBSChatRoomShell'
import {
  clearJbsProgress,
  hasJbsProgress,
  loadJbsProgress,
  saveJbsProgress,
  type JbsEngineSnapshot,
  type JbsScriptProgress,
} from './jbsProgressStore'
import { MatchSelect } from './MatchSelect'
import { SearchingOverlay } from './SearchingOverlay'

export type JBSGameFlowProps = {
  script: JubenshaScript
  playerDisplayName: string
  onExit: () => void
}

type ResumeGate = 'prompt' | 'playing'

function resolveInitialFlow(restored: JbsScriptProgress | null): FlowState {
  if (!restored) return 'match-select'
  if (restored.gameFlow === 'chat-room') return 'chat-room'
  if (restored.gameFlow === 'searching') return 'chat-room'
  return restored.gameFlow
}

export function JBSGameFlow({ script, playerDisplayName, onExit }: JBSGameFlowProps) {
  const savedOnMount = useMemo(() => loadJbsProgress(script.id), [script.id])
  const shouldPrompt = useMemo(() => hasJbsProgress(script.id), [script.id])

  const [resumeGate, setResumeGate] = useState<ResumeGate>(() => (shouldPrompt ? 'prompt' : 'playing'))
  const [restoredProgress, setRestoredProgress] = useState<JbsScriptProgress | null>(null)
  const [flow, setFlow] = useState<FlowState>(() =>
    shouldPrompt ? 'match-select' : resolveInitialFlow(savedOnMount),
  )
  const [toast, setToast] = useState<string | null>(null)
  const [burning, setBurning] = useState(false)

  const shellStateRef = useRef<JBSChatRoomShellState | null>(null)
  const engineSnapshotRef = useRef<JbsEngineSnapshot | null>(
    savedOnMount?.engine ?? null,
  )
  const dmIntroCompletedTrackCountRef = useRef(
    savedOnMount?.dmIntroCompletedTrackCount ?? 0,
  )

  const dmVoiceTracks = useMemo(() => getDmVoiceIntroUrls(script.id), [script.id])
  const chatRoomVideoUrl = useMemo(() => getChatRoomVideoUrl(script.id), [script.id])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const persistProgress = useCallback(() => {
    const shell = shellStateRef.current
    const engine = engineSnapshotRef.current
    const progress: JbsScriptProgress = {
      version: 1,
      scriptId: script.id,
      savedAt: Date.now(),
      playerDisplayName,
      gameFlow: flow,
      dmVoiceCompleted: shell?.dmVoiceCompleted ?? restoredProgress?.dmVoiceCompleted ?? false,
      chatRoomPhase: shell?.chatRoomPhase ?? restoredProgress?.chatRoomPhase ?? null,
      activeCardId: shell?.activeCardId ?? restoredProgress?.activeCardId ?? null,
      lockedCardId: shell?.lockedCardId ?? restoredProgress?.lockedCardId ?? null,
      lockedRoleName: shell?.lockedRoleName ?? restoredProgress?.lockedRoleName ?? null,
      dmIntroCompletedTrackCount: dmIntroCompletedTrackCountRef.current,
      engine: engine ?? restoredProgress?.engine ?? null,
    }
    saveJbsProgress(progress)
  }, [flow, playerDisplayName, restoredProgress, script.id])

  useEffect(() => {
    if (resumeGate !== 'playing') return
    persistProgress()
  }, [resumeGate, flow, persistProgress])

  useEffect(() => {
    if (resumeGate !== 'playing') return
    const onVis = () => {
      if (document.visibilityState === 'hidden') persistProgress()
    }
    const onPageHide = () => persistProgress()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [resumeGate, persistProgress])

  const handleContinue = useCallback(() => {
    const p = loadJbsProgress(script.id)
    if (!p) {
      setResumeGate('playing')
      return
    }
    setRestoredProgress(p)
    engineSnapshotRef.current = p.engine
    dmIntroCompletedTrackCountRef.current = p.dmIntroCompletedTrackCount
    setFlow(resolveInitialFlow(p))
    setResumeGate('playing')
  }, [script.id])

  const handleRestart = useCallback(() => {
    clearJbsProgress(script.id)
    setRestoredProgress(null)
    engineSnapshotRef.current = null
    dmIntroCompletedTrackCountRef.current = 0
    shellStateRef.current = null
    setFlow('match-select')
    setResumeGate('playing')
  }, [script.id])

  const handleInviteLocked = useCallback(() => {
    showToast('邀约旧识尚未开启，请先以命运盲抽入局。')
  }, [showToast])

  const handleBlindMatch = useCallback(() => {
    primeJbsRoomAudio()
    setFlow('searching')
  }, [])

  const handleSearchDone = useCallback(() => {
    setFlow('chat-room')
  }, [])

  const handleLockInBurn = useCallback(() => {
    setBurning(true)
    window.setTimeout(() => setBurning(false), 720)
  }, [])

  const handleDmIntroTrackProgress = useCallback((count: number) => {
    dmIntroCompletedTrackCountRef.current = count
    persistProgress()
  }, [persistProgress])

  const handleShellStateChange = useCallback((state: JBSChatRoomShellState) => {
    shellStateRef.current = state
    persistProgress()
  }, [persistProgress])

  const handleEngineSnapshotChange = useCallback((snapshot: JbsEngineSnapshot) => {
    engineSnapshotRef.current = snapshot
    persistProgress()
  }, [persistProgress])

  if (resumeGate === 'prompt' && savedOnMount) {
    return (
      <ContinueOrRestartPanel
        script={script}
        progress={savedOnMount}
        onContinue={handleContinue}
        onRestart={handleRestart}
        onExit={onExit}
      />
    )
  }

  return (
    <LayoutGroup id="jbs-game-flow">
      <motion.div
        className="jbs-gf-root jbs-gf-obsidian-bg absolute inset-0 z-[60] flex min-h-0 flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
      >
        <AnimatePresence mode="wait">
          {flow === 'match-select' ? (
            <MatchSelect
              key="match"
              scriptTitle={script.title}
              onBlindMatch={handleBlindMatch}
              onInviteLocked={handleInviteLocked}
            />
          ) : flow === 'searching' ? (
            <SearchingOverlay key="search" onComplete={handleSearchDone} />
          ) : flow === 'chat-room' ? (
            <JBSChatRoomShell
              key="chat-room"
              script={script}
              playerDisplayName={playerDisplayName}
              dmVoiceTracks={dmVoiceTracks}
              videoUrl={chatRoomVideoUrl}
              onExit={onExit}
              onLockInBurn={handleLockInBurn}
              restoredProgress={restoredProgress}
              initialEngineSnapshot={engineSnapshotRef.current}
              initialDmIntroCompletedTrackCount={dmIntroCompletedTrackCountRef.current}
              onShellStateChange={handleShellStateChange}
              onEngineSnapshotChange={handleEngineSnapshotChange}
              onDmIntroTrackProgress={handleDmIntroTrackProgress}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {burning ? (
            <motion.div
              key="burn"
              className="pointer-events-none fixed inset-0 z-[70] bg-[#f4f1ea]"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.95, 1], filter: ['blur(0px)', 'blur(8px)', 'blur(16px)'] }}
              transition={{ duration: 0.72, ease: 'easeIn' }}
            />
          ) : null}
        </AnimatePresence>

        <GameFlowToast message={toast} />
      </motion.div>
    </LayoutGroup>
  )
}
