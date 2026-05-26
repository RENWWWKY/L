import '../jubensha.css'
import './jbs-game-flow.css'
import './jbs-gf-chat-room.css'

import { motion } from 'framer-motion'
import { ArrowLeft, Send, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { getStoryBackgroundVoiceUrls } from '../jbsDmVoiceAssets'
import { getStoryBackgroundTracks } from '../jbsDmVoiceScripts'
import { resolveJbsRolePortrait } from './jbsRolePortraits'
import { getYuyeAct1PublicPlotTracks } from './chatRoom/yuyeAct1PublicPlotVoice'
import { getStoryBackgroundPremiseClueIds } from './chatRoom/jbsClueData'
import { RolePortraitMsgBubble } from './chatRoom/RolePortraitMsgBubble'
import type { LockedRole } from './gameFlowTypes'
import { HallRoomBackdrop } from './HallRoomBackdrop'
import { useDmVoiceBubbleSequence } from './useDmVoiceBubbleSequence'
import { JBS_STEP_LABELS } from './chatRoom/jbsFlowTypes'
import { ClueCollectorLayer } from './chatRoom/ClueCollectorLayer'
import { DMMsgBubble } from './chatRoom/DMMsgBubble'
import { JBSBookmarkButton } from './chatRoom/JBSBookmarkButton'
import { JBSControlDrawer } from './chatRoom/JBSControlDrawer'
import { JBSFlowProvider, useJBSFlow, type JBSFlowMedia } from './chatRoom/JBSFlowEngine'
import type { JbsEngineSnapshot } from './jbsProgressStore'
import { canMarkScriptReadingFinished } from './chatRoom/scriptReader/buildScriptPages'
import { ScriptBookWidget } from './chatRoom/scriptReader/ScriptBookWidget'
import { ScriptInteractiveReader } from './chatRoom/scriptReader/ScriptInteractiveReader'

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
  initialEngineSnapshot?: JbsEngineSnapshot | null
  onEngineSnapshotChange?: (snapshot: JbsEngineSnapshot) => void
}

function ChatRoomActive({ onExit, hideShell = false }: { onExit: () => void; hideShell?: boolean }) {
  const {
    locked,
    messages,
    sendPlayerMessage,
    pushMessage,
    setDrawerOpen,
    currentStep,
    loopRound,
    bgmMuted,
    setBgmMuted,
    media,
    advanceStep,
    activeDispersalClueId,
    drawerAbsorbPulse,
    clueBadgeCount,
    triggerClueDispersal,
    collectedClueIds,
    readingSession,
    scriptSections,
    openScriptBook,
    minimizeScriptBook,
    restoreScriptBook,
    setScriptReaderPage,
    applyScriptPages,
    finishScriptReading,
    voicePlayback,
    patchVoicePlayback,
  } = useJBSFlow()

  const bookmarkRef = useRef<HTMLButtonElement>(null)
  const premiseTriggeredRef = useRef(false)
  const voicePlaybackInferredRef = useRef(false)
  const act1VoicePlaybackInferredRef = useRef(false)
  /** 本阶段已点过「进入下一阶段」后隐藏按钮，直至 step/loop 变化 */
  const [stageAdvanceHidden, setStageAdvanceHidden] = useState(false)

  const scriptId = locked.script.id
  const playerRoleName = locked.card.role.name

  const rolePortraitUrl = useCallback(
    (roleName: string) => resolveJbsRolePortrait(scriptId, roleName),
    [scriptId],
  )
  const storyPremiseIds = useMemo(() => getStoryBackgroundPremiseClueIds(scriptId), [scriptId])
  const storyBgMeta = useMemo(() => getStoryBackgroundTracks(scriptId) ?? [], [scriptId])
  const storyBgTracks = useMemo(() => getStoryBackgroundVoiceUrls(scriptId) ?? [], [scriptId])
  const storyBgScripts = useMemo(() => storyBgMeta.map((t) => t.plain), [storyBgMeta])
  const storyBgHighlights = useMemo(() => storyBgMeta.map((t) => t.highlight), [storyBgMeta])
  const storyBgEnabled = currentStep === 2 && storyBgTracks.length > 0 && storyBgScripts.length > 0

  const inferredStoryBgCompletedCount = useMemo(() => {
    if (voicePlayback.storyBgCompletedTrackCount > 0) return voicePlayback.storyBgCompletedTrackCount
    let count = 0
    for (const script of storyBgScripts) {
      const plain = script.trim()
      if (!plain) continue
      if (messages.some((m) => m.kind === 'dm' && m.body.trim() === plain)) count++
      else break
    }
    return count
  }, [messages, storyBgScripts, voicePlayback.storyBgCompletedTrackCount])

  const storyBgDone =
    voicePlayback.storyBgDone ||
    !storyBgEnabled ||
    inferredStoryBgCompletedCount >= storyBgScripts.length

  const handleStoryBgFinalize = useCallback(
    (
      body: string,
      meta?: { highlight?: { start: number; end: number } },
      _trackIndex?: number,
    ) => {
      pushMessage({ kind: 'dm', body, dmHighlight: meta?.highlight })
    },
    [pushMessage],
  )

  const act1PublicPlotMeta = useMemo(
    () => (scriptId === 'yuye-guiling' ? getYuyeAct1PublicPlotTracks() : []),
    [scriptId],
  )
  const act1PublicPlotTracks = useMemo(
    () => act1PublicPlotMeta.map((t) => t.url),
    [act1PublicPlotMeta],
  )
  const act1PublicPlotScripts = useMemo(
    () => act1PublicPlotMeta.map((t) => t.script),
    [act1PublicPlotMeta],
  )
  const act1PublicPlotEnabled =
    currentStep === 4 && act1PublicPlotTracks.length > 0 && act1PublicPlotScripts.length > 0

  const inferredAct1PublicPlotCompletedCount = useMemo(() => {
    if (voicePlayback.act1PublicPlotCompletedTrackCount > 0) {
      return voicePlayback.act1PublicPlotCompletedTrackCount
    }
    let count = 0
    for (const track of act1PublicPlotMeta) {
      const plain = track.script.trim()
      if (!plain) continue
      const found = messages.some((m) => {
        if (track.speaker === 'dm') {
          return m.kind === 'dm' && m.body.trim() === plain
        }
        return (
          m.kind === 'player' &&
          m.roleName === track.speaker.role &&
          m.body.trim() === plain
        )
      })
      if (found) count++
      else break
    }
    return count
  }, [act1PublicPlotMeta, messages, voicePlayback.act1PublicPlotCompletedTrackCount])

  const act1PublicPlotDone =
    voicePlayback.act1PublicPlotDone ||
    !act1PublicPlotEnabled ||
    inferredAct1PublicPlotCompletedCount >= act1PublicPlotScripts.length

  const isAct1SelfPerformTrack = useCallback(
    (trackIndex: number) => {
      const track = act1PublicPlotMeta[trackIndex]
      return (
        !!track &&
        track.speaker !== 'dm' &&
        track.speaker.role === playerRoleName
      )
    },
    [act1PublicPlotMeta, playerRoleName],
  )

  const handleAct1PublicPlotFinalize = useCallback(
    (body: string, _meta: { highlight?: { start: number; end: number } } | undefined, trackIndex: number) => {
      const track = act1PublicPlotMeta[trackIndex]
      if (!track) return
      if (track.speaker === 'dm') {
        pushMessage({ kind: 'dm', body })
        return
      }
      pushMessage({
        kind: 'player',
        roleName: track.speaker.role,
        body,
      })
    },
    [act1PublicPlotMeta, pushMessage],
  )

  const handleAct1PublicPlotTrackProgress = useCallback(
    (completedTrackCount: number) => {
      patchVoicePlayback({ act1PublicPlotCompletedTrackCount: completedTrackCount })
    },
    [patchVoicePlayback],
  )

  const handleAct1PublicPlotComplete = useCallback(() => {
    patchVoicePlayback({
      act1PublicPlotDone: true,
      act1PublicPlotCompletedTrackCount: act1PublicPlotTracks.length,
    })
  }, [act1PublicPlotTracks.length, patchVoicePlayback])

  const act1PublicPlotVoice = useDmVoiceBubbleSequence({
    tracks: act1PublicPlotTracks,
    scripts: act1PublicPlotScripts,
    enabled: act1PublicPlotEnabled && !act1PublicPlotDone,
    initialCompletedTrackCount: inferredAct1PublicPlotCompletedCount,
    onFinalizeTrack: handleAct1PublicPlotFinalize,
    onTrackProgress: handleAct1PublicPlotTrackProgress,
    onComplete: handleAct1PublicPlotComplete,
    shouldAwaitPerformBeforeTrack: isAct1SelfPerformTrack,
  })

  const act1PlotInProgress =
    act1PublicPlotEnabled &&
    act1PublicPlotVoice.phase !== 'done' &&
    act1PublicPlotVoice.phase !== 'idle'

  const showAct1PerformButton = act1PublicPlotVoice.phase === 'await-perform'

  const handleStoryBgTrackProgress = useCallback(
    (completedTrackCount: number) => {
      patchVoicePlayback({ storyBgCompletedTrackCount: completedTrackCount })
    },
    [patchVoicePlayback],
  )

  const handleStoryBgComplete = useCallback(() => {
    patchVoicePlayback({
      storyBgDone: true,
      storyBgCompletedTrackCount: storyBgTracks.length,
    })
    if (storyPremiseIds.length > 0) {
      premiseTriggeredRef.current = true
      for (const id of storyPremiseIds) {
        triggerClueDispersal(id)
      }
    }
  }, [patchVoicePlayback, storyBgTracks.length, storyPremiseIds, triggerClueDispersal])

  const storyBg = useDmVoiceBubbleSequence({
    tracks: storyBgTracks,
    scripts: storyBgScripts,
    highlightRanges: storyBgHighlights,
    enabled: storyBgEnabled && !storyBgDone,
    initialCompletedTrackCount: inferredStoryBgCompletedCount,
    onFinalizeTrack: handleStoryBgFinalize,
    onTrackProgress: handleStoryBgTrackProgress,
    onComplete: handleStoryBgComplete,
  })

  /** 将反推进度写回存档（兼容旧存档） */
  useEffect(() => {
    if (voicePlaybackInferredRef.current) return
    if (voicePlayback.storyBgCompletedTrackCount > 0 || voicePlayback.storyBgDone) {
      voicePlaybackInferredRef.current = true
      return
    }
    if (inferredStoryBgCompletedCount === 0) {
      voicePlaybackInferredRef.current = true
      return
    }
    voicePlaybackInferredRef.current = true
    patchVoicePlayback({
      storyBgCompletedTrackCount: inferredStoryBgCompletedCount,
      storyBgDone: inferredStoryBgCompletedCount >= storyBgScripts.length,
    })
  }, [
    inferredStoryBgCompletedCount,
    patchVoicePlayback,
    storyBgScripts.length,
    voicePlayback.storyBgCompletedTrackCount,
    voicePlayback.storyBgDone,
  ])

  useEffect(() => {
    if (act1VoicePlaybackInferredRef.current) return
    if (
      voicePlayback.act1PublicPlotCompletedTrackCount > 0 ||
      voicePlayback.act1PublicPlotDone
    ) {
      act1VoicePlaybackInferredRef.current = true
      return
    }
    if (inferredAct1PublicPlotCompletedCount === 0) {
      act1VoicePlaybackInferredRef.current = true
      return
    }
    act1VoicePlaybackInferredRef.current = true
    patchVoicePlayback({
      act1PublicPlotCompletedTrackCount: inferredAct1PublicPlotCompletedCount,
      act1PublicPlotDone:
        inferredAct1PublicPlotCompletedCount >= act1PublicPlotScripts.length,
    })
  }, [
    act1PublicPlotScripts.length,
    inferredAct1PublicPlotCompletedCount,
    patchVoicePlayback,
    voicePlayback.act1PublicPlotCompletedTrackCount,
    voicePlayback.act1PublicPlotDone,
  ])

  /** 续玩：故事背景已播完但公共前提线索尚未收纳时，补触发飞牌 */
  useEffect(() => {
    if (!voicePlayback.storyBgDone || premiseTriggeredRef.current) return
    if (storyPremiseIds.length === 0) return
    premiseTriggeredRef.current = true
    for (const id of storyPremiseIds) {
      if (!collectedClueIds.includes(id)) triggerClueDispersal(id)
    }
  }, [
    collectedClueIds,
    storyPremiseIds,
    triggerClueDispersal,
    voicePlayback.storyBgDone,
  ])

  const inputLocked =
    storyBg.isActive ||
    act1PlotInProgress ||
    activeDispersalClueId != null ||
    (readingSession.isOpen && !readingSession.isMinimized)

  const inputLockedPlaceholder = storyBg.isActive
    ? '主持人宣读背景中…'
    : act1PlotInProgress
      ? '公共剧情演绎中…'
      : '在此落笔…'

  const stageContentReady = useMemo(() => {
    if (currentStep >= 8) return false
    if (storyBg.isActive || act1PlotInProgress || activeDispersalClueId != null) {
      return false
    }
    if (readingSession.isOpen && !readingSession.isMinimized) return false
    if (currentStep === 2) {
      if (!storyBgDone) return false
      if (
        storyPremiseIds.length > 0 &&
        !storyPremiseIds.every((id) => collectedClueIds.includes(id))
      ) {
        return false
      }
      return true
    }
    if (currentStep === 3) {
      return readingSession.hasFinishedPhase
    }
    if (currentStep === 4) {
      return act1PublicPlotDone
    }
    return true
  }, [
    act1PublicPlotDone,
    act1PlotInProgress,
    activeDispersalClueId,
    collectedClueIds,
    currentStep,
    readingSession.hasFinishedPhase,
    readingSession.isMinimized,
    readingSession.isOpen,
    storyBg.isActive,
    storyBgDone,
    storyPremiseIds,
  ])

  const showStageAdvanceButton = stageContentReady && !stageAdvanceHidden

  useEffect(() => {
    setStageAdvanceHidden(false)
  }, [currentStep, loopRound])

  const handleStageAdvance = useCallback(() => {
    setStageAdvanceHidden(true)
    advanceStep()
  }, [advanceStep])

  const showScriptBookWidget =
    currentStep >= 3 &&
    readingSession.bookDelivered &&
    !readingSession.hasFinishedPhase &&
    !readingSession.isOpen &&
    !readingSession.isMinimized

  const showScriptFinishButton = useMemo(
    () => canMarkScriptReadingFinished(readingSession),
    [readingSession],
  )

  const stepCaption =
    currentStep === 7
      ? `${locked.card.role.name} · 第 7 阶段 (${loopRound}/3)`
      : `${locked.card.role.name} · 第 ${currentStep} 阶段`

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior })
    })
  }, [])

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
    scrollChatToBottom()
  }, [
    messages.length,
    storyBg.liveBubble?.body,
    act1PublicPlotVoice.liveBubble?.body,
    scrollChatToBottom,
  ])

  useLayoutEffect(() => {
    if (showScriptBookWidget || readingSession.bookDelivered) {
      scrollChatToBottom(readingSession.bookDelivered ? 'auto' : 'smooth')
    }
  }, [showScriptBookWidget, readingSession.bookDelivered, scrollChatToBottom])

  useEffect(() => {
    if (storyBg.phase !== 'need-tap') return
    const unlock = () => storyBg.resumeFromGesture()
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [storyBg.phase, storyBg.resumeFromGesture])

  useEffect(() => {
    if (act1PublicPlotVoice.phase !== 'need-tap') return
    const unlock = () => act1PublicPlotVoice.resumeFromGesture()
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [act1PublicPlotVoice.phase, act1PublicPlotVoice.resumeFromGesture])

  const act1LiveTrack =
    act1PublicPlotVoice.phase === 'playing' ||
    act1PublicPlotVoice.phase === 'loading' ||
    act1PublicPlotVoice.phase === 'need-tap'
      ? act1PublicPlotMeta[act1PublicPlotVoice.trackIndex]
      : null

  const act1AwaitPerformTrack =
    act1PublicPlotVoice.phase === 'await-perform'
      ? act1PublicPlotMeta[act1PublicPlotVoice.trackIndex]
      : null

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
          <JBSBookmarkButton
            ref={bookmarkRef}
            absorbPulseKey={drawerAbsorbPulse}
            badgeCount={clueBadgeCount}
            onClick={() => setDrawerOpen(true)}
          />
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
            return (
              <DMMsgBubble key={line.id} body={line.body} highlight={line.dmHighlight} />
            )
          }
          const roleName = line.roleName ?? playerRoleName
          return (
            <RolePortraitMsgBubble
              key={line.id}
              body={line.body}
              roleName={roleName}
              isSelf={roleName === playerRoleName}
              portraitUrl={rolePortraitUrl(roleName)}
            />
          )
        })}
        {storyBg.liveBubble ? (
          <DMMsgBubble
            body={storyBg.liveBubble.body}
            isTyping={storyBg.liveBubble.isTyping}
            highlight={storyBg.liveBubble.highlight}
          />
        ) : null}
        {act1AwaitPerformTrack?.speaker !== 'dm' && act1AwaitPerformTrack ? (
          <RolePortraitMsgBubble
            body={act1AwaitPerformTrack.script}
            roleName={act1AwaitPerformTrack.speaker.role}
            isSelf
            portraitUrl={rolePortraitUrl(act1AwaitPerformTrack.speaker.role)}
          />
        ) : null}
        {act1PublicPlotVoice.liveBubble ? (
          act1LiveTrack?.speaker === 'dm' || !act1LiveTrack ? (
            <DMMsgBubble
              body={act1PublicPlotVoice.liveBubble.body}
              isTyping={act1PublicPlotVoice.liveBubble.isTyping}
            />
          ) : (
            <RolePortraitMsgBubble
              body={act1PublicPlotVoice.liveBubble.body}
              roleName={act1LiveTrack.speaker.role}
              isSelf={act1LiveTrack.speaker.role === playerRoleName}
              portraitUrl={rolePortraitUrl(act1LiveTrack.speaker.role)}
              isTyping={act1PublicPlotVoice.liveBubble.isTyping}
            />
          )
        ) : null}
        {storyBg.phase === 'need-tap' || act1PublicPlotVoice.phase === 'need-tap' ? (
          <p className="jbs-gf-chat-system-line jbs-font-serif mb-3 text-center text-[9px] tracking-[0.12em]">
            轻触屏幕以继续播放主持语音
          </p>
        ) : null}
        {showScriptBookWidget ? (
          <ScriptBookWidget
            roleName={locked.card.role.name}
            onOpen={openScriptBook}
          />
        ) : null}
      </div>

      <div className="jbs-gf-chat-input-bar shrink-0 px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {showStageAdvanceButton ? (
          <button
            type="button"
            onClick={handleStageAdvance}
            className="jbs-gf-chat-stage-advance-btn jbs-font-serif mb-2.5 w-full rounded-lg py-3 text-[12px] tracking-[0.14em]"
          >
            进入下一阶段
          </button>
        ) : null}
        {showScriptFinishButton ? (
          <button
            type="button"
            onClick={finishScriptReading}
            className="jbs-gf-chat-script-finish-btn jbs-font-serif mb-2.5 w-full rounded-lg py-3 text-[12px] tracking-[0.14em]"
          >
            阅读完成
          </button>
        ) : null}
        {showAct1PerformButton && act1AwaitPerformTrack?.speaker !== 'dm' ? (
          <>
            <p className="jbs-gf-chat-perform-hint jbs-font-serif mb-2 text-center text-[10px] tracking-[0.2em]">
              轮到你上演 · 轻触开始演绎本句台词
            </p>
            <button
              type="button"
              onClick={() => act1PublicPlotVoice.resumePerform()}
              className="jbs-gf-chat-perform-btn jbs-font-serif mb-2.5 w-full rounded-lg py-3.5 text-[13px] tracking-[0.22em]"
            >
              演绎
            </button>
          </>
        ) : null}
        {!showAct1PerformButton ? (
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !inputLocked && send()}
              placeholder={inputLocked ? inputLockedPlaceholder : '在此落笔…'}
              disabled={inputLocked}
              className="jbs-gf-chat-input jbs-font-serif min-w-0 flex-1 rounded-lg px-3 py-2.5 text-[14px] disabled:opacity-45"
            />
            <button
              type="button"
              onClick={send}
              disabled={inputLocked || !draft.trim()}
              className="jbs-gf-chat-send-btn flex size-11 shrink-0 items-center justify-center rounded-lg disabled:opacity-35"
              aria-label="发送"
            >
              <Send className="size-4" strokeWidth={1.25} />
            </button>
          </div>
        ) : null}
      </div>

      <JBSControlDrawer />
      <ClueCollectorLayer collectTargetRef={bookmarkRef} />
      <ScriptInteractiveReader
        session={readingSession}
        roleName={locked.card.role.name}
        scriptId={locked.script.id}
        roleId={locked.card.id}
        scriptSections={scriptSections}
        currentStep={currentStep}
        loopRound={loopRound}
        onPagesBuilt={applyScriptPages}
        onCollapse={minimizeScriptBook}
        onRestore={restoreScriptBook}
        onPageChange={setScriptReaderPage}
      />
    </div>
  )
}

export function JBSChatRoomActive({
  locked,
  playerDisplayName,
  media,
  onExit,
  hideShell = false,
  initialEngineSnapshot = null,
  onEngineSnapshotChange,
}: ChatRoomActiveProps) {
  return (
    <JBSFlowProvider
      locked={locked}
      playerDisplayName={playerDisplayName}
      media={media}
      initialEngineSnapshot={initialEngineSnapshot}
      onEngineSnapshotChange={onEngineSnapshotChange}
    >
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
