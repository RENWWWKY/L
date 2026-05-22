import '../jubensha.css'
import './jbs-game-flow.css'

import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'

import type { JubenshaScript } from '../types'

import { GameFlowToast } from './GameFlowToast'
import { getChatRoomVideoUrl } from '../jbsChatRoomMedia'
import { getDmVoiceIntroUrls } from '../jbsDmVoiceAssets'
import type { FlowState } from './gameFlowTypes'
import { primeJbsRoomAudio } from './jbsAudioUnlock'
import { JBSChatRoomShell } from './JBSChatRoomShell'
import { MatchSelect } from './MatchSelect'
import { SearchingOverlay } from './SearchingOverlay'

export type JBSGameFlowProps = {
  script: JubenshaScript
  playerDisplayName: string
  onExit: () => void
}

export function JBSGameFlow({ script, playerDisplayName, onExit }: JBSGameFlowProps) {
  const [flow, setFlow] = useState<FlowState>('match-select')
  const [toast, setToast] = useState<string | null>(null)
  const [burning, setBurning] = useState(false)

  const dmVoiceTracks = useMemo(() => getDmVoiceIntroUrls(script.id), [script.id])
  const chatRoomVideoUrl = useMemo(() => getChatRoomVideoUrl(script.id), [script.id])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

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
