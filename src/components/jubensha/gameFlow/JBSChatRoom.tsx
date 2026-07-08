import '../jubensha.css'
import './jbs-game-flow.css'
import './jbs-gf-chat-room.css'

import { motion } from 'framer-motion'
import { ArrowLeft, Gamepad2, Send, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { useComposerKeyboardInset } from '../../../phone/hooks/useComposerKeyboardInset'
import { GameLobbySheet } from '../../../phone/apps/wechat/miniGame/GameLobbySheet'
import { getGameLabel, isGameAvailable } from '../../../phone/apps/wechat/miniGame/gameCatalog'
import type { MiniGameType } from '../../../phone/apps/wechat/miniGame/types'

import { getStoryBackgroundVoiceUrls } from '../jbsDmVoiceAssets'
import { getStoryBackgroundTracks } from '../jbsDmVoiceScripts'
import { resolveJbsRolePortrait } from './jbsRolePortraits'
import {
  getAct1PublicPlotDmRunFullText,
  getYuyeAct1PublicPlotTracks,
} from './chatRoom/yuyeAct1PublicPlotVoice'
import {
  DISCUSS1_OPENING_SYSTEM_BRIEF,
  DISCUSS1_OPENING_SYSTEM_READY,
  getYuyeDiscuss1OpeningTracks,
} from './chatRoom/yuyeDiscuss1OpeningVoice'
import { getStoryBackgroundPremiseClueIds } from './chatRoom/jbsClueData'
import { JBSDiscussActionPicker } from './chatRoom/JBSDiscussActionPicker'
import { getEvidenceClueBatches } from './chatRoom/jbsDevFlowNodes'
import { resolvePublicDiscussPhase } from './chatRoom/jbsPublicDiscuss'
import { useJbsNpcDiscuss } from './chatRoom/useJbsNpcDiscuss'
import {
  getYuyeGuilingSystemHint,
  isYuyeGuilingScript,
} from './chatRoom/yuyeGuilingDmFlow'
import { NarrationPlotPanel } from './chatRoom/Act1PlotPanels'
import { compactDmNarrationLines } from './chatRoom/dmBubbleText'
import { RolePortraitMsgBubble } from './chatRoom/RolePortraitMsgBubble'
import type { LockedRole } from './gameFlowTypes'
import { HallRoomBackdrop } from './HallRoomBackdrop'
import { GameFlowToast } from './GameFlowToast'
import { useDmVoiceBubbleSequence } from './useDmVoiceBubbleSequence'
import { useTypewriter } from './useTypewriter'
import { JBS_STEP_LABELS } from './chatRoom/jbsFlowTypes'
import { ClueCollectorLayer } from './chatRoom/ClueCollectorLayer'
import { DMMsgBubble } from './chatRoom/DMMsgBubble'
import { DiscussThinkingIndicator } from './chatRoom/DiscussThinkingIndicator'
import { DmVoiceTrackSkipButton } from './chatRoom/DmVoiceTrackSkipButton'
import { JBSBookmarkButton } from './chatRoom/JBSBookmarkButton'
import { useJBSDevJumpBridge } from './chatRoom/JBSDevJumpBridge'
import { JBSDevStageJump } from './chatRoom/JBSDevStageJump'
import { JBSControlDrawer } from './chatRoom/JBSControlDrawer'
import { JBSFlowProvider, useJBSFlow, type JBSFlowMedia } from './chatRoom/JBSFlowEngine'
import type { JbsEngineSnapshot, JbsFlowEngineSnapshot } from './jbsProgressStore'
import { MiniBookAnchor } from './chatRoom/scriptReader/MiniBookAnchor'
import { ScriptBookWidget } from './chatRoom/scriptReader/ScriptBookWidget'
import { ScriptInteractiveReader } from './chatRoom/scriptReader/ScriptInteractiveReader'
import { TaskAcceptModal } from './chatRoom/taskCommission/TaskAcceptModal'
import { TaskFloatingBall } from './chatRoom/taskCommission/TaskFloatingBall'
import { buildActCommission } from './chatRoom/taskCommission/buildActCommission'
import {
  TaskCommissionProvider,
  useTaskStore,
} from './chatRoom/taskCommission/useTaskStore'
import type { SerializableActiveCommission } from './chatRoom/taskCommission/taskCommissionTypes'

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
  bgmMuted?: boolean
  onBgmMutedChange?: (muted: boolean) => void
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
    deliverScriptBook,
    openScriptBook,
    openScriptBookToSection,
    minimizeScriptBook,
    setScriptReaderPage,
    applyScriptPages,
    voicePlayback,
    patchVoicePlayback,
    devStageEpoch,
    debugJumpToFlowNode,
  } = useJBSFlow()

  const devJumpBridge = useJBSDevJumpBridge()

  const {
    commission,
    modalOpen,
    beginAcceptRitual,
    restoreCommission,
    clearCommission,
  } = useTaskStore()

  const bookmarkRef = useRef<HTMLButtonElement>(null)
  const premiseTriggeredRef = useRef(false)
  const step2ScriptAutoDeliveredRef = useRef(false)
  const introUnlockHintPushedRef = useRef(false)
  const act1UnlockHintPushedRef = useRef(false)
  const discuss1BriefPushedRef = useRef(false)
  const voicePlaybackInferredRef = useRef(false)
  const act1VoicePlaybackInferredRef = useRef(false)
  const devStageEpochSeenRef = useRef(0)
  /** 连续旁白轨 finalize 时暂存，遇对白或旁白段结束再合并推送一条 dm 消息 */
  const act1DmRunPendingRef = useRef<string[]>([])

  useEffect(() => {
    if (!devJumpBridge) return
    devJumpBridge.registerEngineJump(debugJumpToFlowNode)
    return () => devJumpBridge.registerEngineJump(null)
  }, [debugJumpToFlowNode, devJumpBridge])
  /** 本阶段已点过「进入下一阶段」后隐藏按钮，直至 step/loop 变化 */
  const [stageAdvanceHidden, setStageAdvanceHidden] = useState(false)
  const [gameLobbyOpen, setGameLobbyOpen] = useState(false)
  const [flowToast, setFlowToast] = useState<string | null>(null)
  const flowToastTimerRef = useRef<number | null>(null)

  const showFlowToast = useCallback((msg: string) => {
    if (flowToastTimerRef.current != null) window.clearTimeout(flowToastTimerRef.current)
    setFlowToast(msg)
    flowToastTimerRef.current = window.setTimeout(() => {
      setFlowToast(null)
      flowToastTimerRef.current = null
    }, 2200)
  }, [])

  useEffect(() => {
    return () => {
      if (flowToastTimerRef.current != null) window.clearTimeout(flowToastTimerRef.current)
    }
  }, [])

  const handleSendGameInvite = useCallback(
    (gameType: MiniGameType) => {
      if (!isGameAvailable(gameType)) {
        showFlowToast(`「${getGameLabel(gameType)}」尚在开发中`)
        return
      }
      showFlowToast('剧本杀暗室暂不支持发起小游戏邀请')
    },
    [showFlowToast],
  )

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
  const act1PublicPlotSfx = useMemo(
    () => act1PublicPlotMeta.map((t) => t.sfxUrls),
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
    (act1PublicPlotEnabled &&
      inferredAct1PublicPlotCompletedCount >= act1PublicPlotScripts.length)

  const scriptUnlockFlags = useMemo(
    () => ({ act1PublicPlotDone }),
    [act1PublicPlotDone],
  )

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
        const compact = compactDmNarrationLines(body)
        if (!compact) return
        act1DmRunPendingRef.current.push(compact)
        const nextTrack = act1PublicPlotMeta[trackIndex + 1]
        if (nextTrack?.speaker === 'dm') return
        const merged = act1DmRunPendingRef.current.join('\n\n')
        act1DmRunPendingRef.current = []
        pushMessage({ kind: 'dm', body: merged })
        return
      }
      if (act1DmRunPendingRef.current.length > 0) {
        pushMessage({ kind: 'dm', body: act1DmRunPendingRef.current.join('\n\n') })
        act1DmRunPendingRef.current = []
      }
      const line = compactDmNarrationLines(body)
      if (!line) return
      pushMessage({
        kind: 'player',
        roleName: track.speaker.role,
        body: line,
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
    if (scriptId === 'yuye-guiling') {
      const hint = getYuyeGuilingSystemHint(5, loopRound)
      if (hint?.trim() && !act1UnlockHintPushedRef.current) {
        if (!messages.some((m) => m.kind === 'system' && m.body === hint)) {
          pushMessage({ kind: 'system', body: hint })
        }
        act1UnlockHintPushedRef.current = true
      }
    }
  }, [
    act1PublicPlotTracks.length,
    loopRound,
    messages,
    patchVoicePlayback,
    pushMessage,
    scriptId,
  ])

  useEffect(() => {
    if (devStageEpochSeenRef.current === devStageEpoch) return
    devStageEpochSeenRef.current = devStageEpoch
    if (devStageEpoch === 0) return

    voicePlaybackInferredRef.current = false
    act1VoicePlaybackInferredRef.current = false
    premiseTriggeredRef.current = false
    step2ScriptAutoDeliveredRef.current = false
    introUnlockHintPushedRef.current = false
    act1UnlockHintPushedRef.current = false
    discuss1BriefPushedRef.current = false
    act1DmRunPendingRef.current = []
    setStageAdvanceHidden(false)
    if (!voicePlayback.act1TasksAccepted) {
      clearCommission()
    }
  }, [clearCommission, devStageEpoch, voicePlayback.act1TasksAccepted])

  const act1PublicPlotVoice = useDmVoiceBubbleSequence({
    tracks: act1PublicPlotTracks,
    scripts: act1PublicPlotScripts,
    sfxTracks: act1PublicPlotSfx,
    enabled: act1PublicPlotEnabled && !act1PublicPlotDone,
    resetSignal: devStageEpoch,
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

  const batch1ClueIds = useMemo(
    () => (isYuyeGuilingScript(scriptId) ? getEvidenceClueBatches(scriptId).batch1 : []),
    [scriptId],
  )
  const batch1CluesCollected =
    batch1ClueIds.length > 0 && batch1ClueIds.every((id) => collectedClueIds.includes(id))

  const discuss1OpeningMeta = useMemo(
    () => (isYuyeGuilingScript(scriptId) ? getYuyeDiscuss1OpeningTracks(playerRoleName) : []),
    [playerRoleName, scriptId],
  )
  const discuss1OpeningTracks = useMemo(
    () => discuss1OpeningMeta.map((t) => t.url),
    [discuss1OpeningMeta],
  )
  const discuss1OpeningScripts = useMemo(
    () => discuss1OpeningMeta.map((t) => t.script),
    [discuss1OpeningMeta],
  )

  const inferredDiscuss1OpeningCompletedCount = useMemo(() => {
    if (voicePlayback.discuss1OpeningCompletedTrackCount > 0) {
      return voicePlayback.discuss1OpeningCompletedTrackCount
    }
    let count = 0
    for (const track of discuss1OpeningMeta) {
      const plain = track.script.trim()
      if (!plain) continue
      const found = messages.some(
        (m) =>
          m.kind === 'player' &&
          m.roleName === track.speaker.role &&
          m.body.trim() === plain,
      )
      if (found) count++
      else break
    }
    return count
  }, [discuss1OpeningMeta, messages, voicePlayback.discuss1OpeningCompletedTrackCount])

  const discuss1OpeningDone =
    voicePlayback.discuss1OpeningDone ||
    (discuss1OpeningMeta.length > 0 &&
      inferredDiscuss1OpeningCompletedCount >= discuss1OpeningMeta.length)

  const discuss1OpeningEnabled =
    isYuyeGuilingScript(scriptId) &&
    currentStep === 6 &&
    loopRound === 0 &&
    batch1CluesCollected &&
    activeDispersalClueId == null &&
    !discuss1OpeningDone

  const handleDiscuss1OpeningFinalize = useCallback(
    (body: string, _meta: { highlight?: { start: number; end: number } } | undefined, trackIndex: number) => {
      const track = discuss1OpeningMeta[trackIndex]
      if (!track) return
      const line = compactDmNarrationLines(body)
      if (!line) return
      pushMessage({
        kind: 'player',
        roleName: track.speaker.role,
        body: line,
      })
    },
    [discuss1OpeningMeta, pushMessage],
  )

  const handleDiscuss1OpeningTrackProgress = useCallback(
    (completedTrackCount: number) => {
      patchVoicePlayback({ discuss1OpeningCompletedTrackCount: completedTrackCount })
    },
    [patchVoicePlayback],
  )

  const handleDiscuss1OpeningComplete = useCallback(() => {
    patchVoicePlayback({
      discuss1OpeningDone: true,
      discuss1OpeningCompletedTrackCount: discuss1OpeningMeta.length,
    })
    if (
      !messages.some((m) => m.kind === 'system' && m.body === DISCUSS1_OPENING_SYSTEM_READY)
    ) {
      pushMessage({ kind: 'system', body: DISCUSS1_OPENING_SYSTEM_READY })
    }
  }, [discuss1OpeningMeta.length, messages, patchVoicePlayback, pushMessage])

  const discuss1OpeningVoice = useDmVoiceBubbleSequence({
    tracks: discuss1OpeningTracks,
    scripts: discuss1OpeningScripts,
    enabled: discuss1OpeningEnabled,
    resetSignal: devStageEpoch,
    initialCompletedTrackCount: inferredDiscuss1OpeningCompletedCount,
    onFinalizeTrack: handleDiscuss1OpeningFinalize,
    onTrackProgress: handleDiscuss1OpeningTrackProgress,
    onComplete: handleDiscuss1OpeningComplete,
  })

  const discuss1OpeningInProgress =
    discuss1OpeningEnabled &&
    discuss1OpeningVoice.phase !== 'done' &&
    discuss1OpeningVoice.phase !== 'idle'

  useEffect(() => {
    if (!discuss1OpeningEnabled) return
    if (discuss1BriefPushedRef.current) return
    if (messages.some((m) => m.kind === 'system' && m.body === DISCUSS1_OPENING_SYSTEM_BRIEF)) {
      discuss1BriefPushedRef.current = true
      return
    }
    discuss1BriefPushedRef.current = true
    pushMessage({ kind: 'system', body: DISCUSS1_OPENING_SYSTEM_BRIEF })
  }, [discuss1OpeningEnabled, messages, pushMessage])

  const discussOpeningContext = useMemo(() => {
    if (discuss1OpeningMeta.length === 0) return undefined
    return discuss1OpeningMeta.map((t) => `${t.speaker.role}：${t.script}`).join('\n')
  }, [discuss1OpeningMeta])

  const publicDiscussPhase = useMemo(
    () =>
      resolvePublicDiscussPhase({
        scriptId,
        currentStep,
        loopRound,
        collectedClueIds,
        discuss1OpeningDone,
        activeDispersalClueId,
      }),
    [
      activeDispersalClueId,
      collectedClueIds,
      currentStep,
      discuss1OpeningDone,
      loopRound,
      scriptId,
    ],
  )

  const {
    discussAiBusy,
    discussAiGenerating,
    discussGenerationFailed,
    awaitingNpcReply,
    pendingAction,
    appendPendingAction,
    clearPendingAction,
    postDiscussPlayerLine,
    triggerDiscussNpcReplies,
    retryDiscussNpcReplies,
  } = useJbsNpcDiscuss({
    locked,
    discussPhase: publicDiscussPhase,
    messages,
    collectedClueIds,
    playerRoleName,
    pushMessage,
    openingContext: publicDiscussPhase?.round === 1 ? discussOpeningContext : undefined,
  })

  const inPublicDiscuss = !!publicDiscussPhase?.discussReady

  const showAct1PerformButton = act1PublicPlotVoice.phase === 'await-perform'

  /** 第一幕公共剧情：旁白用 NarrationPlotPanel，对白仍用群聊行（昵称在头像旁） */
  const useAct1NarrationPanels =
    scriptId === 'yuye-guiling' &&
    (currentStep === 4 || act1PlotInProgress || act1PublicPlotDone)

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
    resetSignal: devStageEpoch,
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

  const storyPremiseCollected =
    storyPremiseIds.length === 0 ||
    storyPremiseIds.every((id) => collectedClueIds.includes(id))

  const step2ScriptGateReady =
    currentStep === 2 && storyBgDone && storyPremiseCollected && activeDispersalClueId == null

  /** 故事背景 + 公共前提线索收齐后，在聊天室投递个人剧本小册（不自动打开正文） */
  useEffect(() => {
    if (!step2ScriptGateReady) return
    if (readingSession.bookDelivered) {
      step2ScriptAutoDeliveredRef.current = true
      return
    }
    if (step2ScriptAutoDeliveredRef.current) return
    step2ScriptAutoDeliveredRef.current = true
    deliverScriptBook()
  }, [deliverScriptBook, readingSession.bookDelivered, step2ScriptGateReady])

  /** 公共前提线索收齐后立刻提示自我介绍已解封，无需先点「进入下一阶段」 */
  useEffect(() => {
    if (!step2ScriptGateReady || !isYuyeGuilingScript(scriptId)) return
    const hint = getYuyeGuilingSystemHint(3, loopRound)
    if (!hint?.trim()) return
    if (introUnlockHintPushedRef.current) return
    if (messages.some((m) => m.kind === 'system' && m.body === hint)) {
      introUnlockHintPushedRef.current = true
      return
    }
    introUnlockHintPushedRef.current = true
    pushMessage({ kind: 'system', body: hint })
  }, [loopRound, messages, pushMessage, scriptId, step2ScriptGateReady])

  /** 续玩：公共剧情①已播完时补发第一幕解封提示 */
  useEffect(() => {
    if (!act1PublicPlotDone || !isYuyeGuilingScript(scriptId)) return
    const hint = getYuyeGuilingSystemHint(5, loopRound)
    if (!hint?.trim() || act1UnlockHintPushedRef.current) return
    if (messages.some((m) => m.kind === 'system' && m.body === hint)) {
      act1UnlockHintPushedRef.current = true
      return
    }
    act1UnlockHintPushedRef.current = true
    pushMessage({ kind: 'system', body: hint })
  }, [act1PublicPlotDone, loopRound, messages, pushMessage, scriptId])

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
    discuss1OpeningInProgress ||
    discussAiBusy ||
    activeDispersalClueId != null ||
    (readingSession.isOpen && !readingSession.isMinimized)

  const inputLockedPlaceholder = storyBg.isActive
    ? '主持人宣读背景中…'
    : act1PlotInProgress
      ? '公共剧情演绎中…'
      : discuss1OpeningInProgress
        ? '讨论开场白播放中…'
        : discussAiGenerating
          ? '众人正在思考…'
          : discussAiBusy
            ? '众人正在接话…'
            : inPublicDiscuss
              ? '回车发消息 · 发送键等待众人回应'
              : '在此落笔…'

  const stageContentReady = useMemo(() => {
    if (currentStep >= 8) return false
    if (storyBg.isActive || act1PlotInProgress || discuss1OpeningInProgress || activeDispersalClueId != null) {
      return false
    }
    if (currentStep === 2) {
      if (!storyBgDone) return false
      if (!storyPremiseCollected) return false
      return true
    }
    if (currentStep === 3) {
      return readingSession.bookDelivered
    }
    if (currentStep === 4) {
      return act1PublicPlotDone
    }
    return true
  }, [
    act1PublicPlotDone,
    act1PlotInProgress,
    discuss1OpeningInProgress,
    activeDispersalClueId,
    collectedClueIds,
    currentStep,
    readingSession.bookDelivered,
    storyBg.isActive,
    storyBgDone,
    storyPremiseCollected,
    storyPremiseIds,
  ])

  const act1AwaitingTaskAccept =
    currentStep === 4 && act1PublicPlotDone && !voicePlayback.act1TasksAccepted

  const showStageAdvanceButton =
    stageContentReady && !stageAdvanceHidden && !act1AwaitingTaskAccept && !inPublicDiscuss

  const showDiscussEndButton =
    stageContentReady &&
    !stageAdvanceHidden &&
    !act1AwaitingTaskAccept &&
    inPublicDiscuss &&
    !discussAiBusy

  const showAct1TaskAcceptButton = stageContentReady && !stageAdvanceHidden && act1AwaitingTaskAccept && !modalOpen

  const readerFullscreenOpen = readingSession.isOpen && !readingSession.isMinimized

  useEffect(() => {
    setStageAdvanceHidden(false)
  }, [currentStep, loopRound])

  const handleStageAdvance = useCallback(() => {
    setStageAdvanceHidden(true)
    advanceStep()
  }, [advanceStep])

  const handleAcceptAct1Tasks = useCallback(() => {
    beginAcceptRitual(scriptId, locked.card.role.name, 'act1')
  }, [beginAcceptRitual, locked.card.role.name, scriptId])

  /** 密函仪式完成后同步流程闸门 */
  useEffect(() => {
    if (commission?.status !== 'accepted') return
    if (voicePlayback.act1TasksAccepted) return
    patchVoicePlayback({ act1TasksAccepted: true })
  }, [commission?.status, patchVoicePlayback, voicePlayback.act1TasksAccepted])

  /** 续玩：已接取但无存档密函时重建悬浮球 */
  useEffect(() => {
    if (!voicePlayback.act1TasksAccepted) return
    if (commission?.status === 'accepted') return
    const built = buildActCommission(scriptId, locked.card.role.name, 'act1')
    restoreCommission({ ...built, status: 'accepted' })
  }, [
    commission?.status,
    locked.card.role.name,
    restoreCommission,
    scriptId,
    voicePlayback.act1TasksAccepted,
  ])

  /** 公共前提线索收齐后：聊天流内投递一次「个人介绍」剧本卡片 */
  const introScriptGateReady =
    storyBgDone &&
    storyPremiseCollected &&
    activeDispersalClueId == null &&
    currentStep >= 2

  const showIntroScriptWidget =
    isYuyeGuilingScript(scriptId) &&
    introScriptGateReady &&
    !voicePlayback.introReadingPromptDismissed &&
    !readerFullscreenOpen

  /** 公共剧情①全部播完后：聊天流内投递一次「第一幕」剧本卡片 */
  const showAct1ScriptWidget =
    isYuyeGuilingScript(scriptId) &&
    currentStep >= 4 &&
    act1PublicPlotDone &&
    !voicePlayback.act1ReadingPromptDismissed &&
    !readerFullscreenOpen

  const handleOpenIntroScript = useCallback(() => {
    patchVoicePlayback({ introReadingPromptDismissed: true })
    openScriptBookToSection('intro')
  }, [openScriptBookToSection, patchVoicePlayback])

  const handleOpenAct1Script = useCallback(() => {
    patchVoicePlayback({ act1ReadingPromptDismissed: true })
    openScriptBookToSection('act1')
  }, [openScriptBookToSection, patchVoicePlayback])

  /** 右下角剧本按钮：点过任一张聊天卡片或打开过阅读器后常驻 */
  const showScriptAccessButton =
    readingSession.bookDelivered &&
    !readerFullscreenOpen &&
    (readingSession.bookOpenedOnce ||
      voicePlayback.introReadingPromptDismissed ||
      voicePlayback.act1ReadingPromptDismissed)

  const stepCaption =
    currentStep === 7
      ? `${locked.card.role.name} · 第 7 阶段 (${loopRound}/3)`
      : `${locked.card.role.name} · 第 ${currentStep} 阶段`

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputBarRef = useRef<HTMLDivElement>(null)
  const keyboardInsetFillRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  useComposerKeyboardInset(scrollRef, inputBarRef, keyboardInsetFillRef, {
    scrollPaddingAnchor: '5.5rem + env(safe-area-inset-bottom, 0px)',
  })

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior })
    })
  }, [])

  const act1LiveTrack =
    act1PublicPlotVoice.phase === 'playing' ||
    act1PublicPlotVoice.phase === 'loading' ||
    act1PublicPlotVoice.phase === 'need-tap'
      ? act1PublicPlotMeta[act1PublicPlotVoice.trackIndex]
      : null

  const discuss1LiveTrack =
    discuss1OpeningVoice.phase === 'playing' ||
    discuss1OpeningVoice.phase === 'loading' ||
    discuss1OpeningVoice.phase === 'need-tap'
      ? discuss1OpeningMeta[discuss1OpeningVoice.trackIndex]
      : null

  /** 连续旁白段：合并全文，打字机跨多轨连续输出（不随分段音频重置） */
  const act1DmRunFullText = useMemo(() => {
    if (!useAct1NarrationPanels || act1LiveTrack?.speaker !== 'dm') return ''
    return getAct1PublicPlotDmRunFullText(act1PublicPlotMeta, act1PublicPlotVoice.trackIndex)
  }, [
    act1LiveTrack?.speaker,
    act1PublicPlotMeta,
    act1PublicPlotVoice.trackIndex,
    useAct1NarrationPanels,
  ])

  const act1DmRunTypewriterActive =
    useAct1NarrationPanels &&
    act1LiveTrack?.speaker === 'dm' &&
    (act1PublicPlotVoice.phase === 'playing' || act1PublicPlotVoice.phase === 'loading')

  const { displayed: act1DmRunDisplayed, isTyping: act1DmRunIsTyping } = useTypewriter(
    act1DmRunFullText,
    {
      msPerChar: 95,
      pauseAfterParagraphMs: 620,
      active: act1DmRunTypewriterActive,
    },
  )

  const act1LiveNarrationPanelBody = useMemo(() => {
    if (!useAct1NarrationPanels || act1LiveTrack?.speaker !== 'dm') return null
    if (act1PublicPlotVoice.phase === 'need-tap') {
      return act1DmRunFullText.slice(0, 1) || '…'
    }
    if (act1DmRunTypewriterActive) {
      return act1DmRunDisplayed || '…'
    }
    return act1PublicPlotVoice.liveBubble?.body ?? null
  }, [
    act1DmRunDisplayed,
    act1DmRunFullText,
    act1DmRunTypewriterActive,
    act1LiveTrack?.speaker,
    act1PublicPlotVoice.liveBubble?.body,
    act1PublicPlotVoice.phase,
    useAct1NarrationPanels,
  ])

  const act1LiveNarrationPanelTyping = useMemo(() => {
    if (!useAct1NarrationPanels || act1LiveTrack?.speaker !== 'dm') {
      return act1PublicPlotVoice.liveBubble?.isTyping ?? false
    }
    if (act1PublicPlotVoice.phase === 'need-tap') return true
    if (act1DmRunTypewriterActive) {
      return act1DmRunIsTyping || act1PublicPlotVoice.phase === 'loading'
    }
    return act1PublicPlotVoice.liveBubble?.isTyping ?? false
  }, [
    act1DmRunIsTyping,
    act1DmRunTypewriterActive,
    act1LiveTrack?.speaker,
    act1PublicPlotVoice.liveBubble?.isTyping,
    act1PublicPlotVoice.phase,
    useAct1NarrationPanels,
  ])

  const act1CanSkipCurrentTrack = useMemo(() => {
    if (!act1PublicPlotVoice.canSkipCurrentTrack) return false
    if (useAct1NarrationPanels && act1LiveTrack?.speaker === 'dm') {
      return act1PublicPlotVoice.phase === 'playing' && !act1DmRunIsTyping
    }
    return true
  }, [
    act1DmRunIsTyping,
    act1LiveTrack?.speaker,
    act1PublicPlotVoice.canSkipCurrentTrack,
    act1PublicPlotVoice.phase,
    useAct1NarrationPanels,
  ])

  useEffect(() => {
    scrollChatToBottom()
  }, [
    messages.length,
    storyBg.liveBubble?.body,
    act1PublicPlotVoice.liveBubble?.body,
    act1LiveNarrationPanelBody,
    discuss1OpeningVoice.liveBubble?.body,
    discussAiGenerating,
    scrollChatToBottom,
  ])

  useLayoutEffect(() => {
    if (showIntroScriptWidget || showAct1ScriptWidget || readingSession.bookDelivered) {
      scrollChatToBottom(readingSession.bookDelivered ? 'auto' : 'smooth')
    }
  }, [
    showIntroScriptWidget,
    showAct1ScriptWidget,
    readingSession.bookDelivered,
    scrollChatToBottom,
  ])

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

  useEffect(() => {
    if (discuss1OpeningVoice.phase !== 'need-tap') return
    const unlock = () => discuss1OpeningVoice.resumeFromGesture()
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [discuss1OpeningVoice.phase, discuss1OpeningVoice.resumeFromGesture])

  const act1AwaitPerformTrack =
    act1PublicPlotVoice.phase === 'await-perform'
      ? act1PublicPlotMeta[act1PublicPlotVoice.trackIndex]
      : null

  const postDiscussDraftLine = useCallback(() => {
    if (!postDiscussPlayerLine({ body: draft })) return false
    setDraft('')
    return true
  }, [draft, postDiscussPlayerLine])

  const send = useCallback(() => {
    sendPlayerMessage(draft)
    setDraft('')
  }, [draft, sendPlayerMessage])

  const handleDiscussSendKey = useCallback(() => {
    void triggerDiscussNpcReplies({ body: draft })
    setDraft('')
  }, [draft, triggerDiscussNpcReplies])

  const handleComposerEnter = useCallback(() => {
    if (inPublicDiscuss) {
      postDiscussDraftLine()
      return
    }
    send()
  }, [inPublicDiscuss, postDiscussDraftLine, send])

  const handleComposerSendClick = useCallback(() => {
    if (inPublicDiscuss) {
      handleDiscussSendKey()
      return
    }
    send()
  }, [handleDiscussSendKey, inPublicDiscuss, send])

  const discussSendDisabled =
    discussAiBusy || (!awaitingNpcReply && !draft.trim() && !pendingAction)

  const toggleBgm = useCallback(() => {
    setBgmMuted(!bgmMuted)
  }, [bgmMuted, setBgmMuted])

  const syncChatScrollForKeyboard = useCallback(() => {
    scrollChatToBottom('auto')
    window.setTimeout(() => scrollChatToBottom('auto'), 120)
  }, [scrollChatToBottom])

  useEffect(() => {
    const bar = inputBarRef.current
    const input = chatInputRef.current
    if (!bar || !input) return

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Node)) return
      if (target !== input && !input.contains(target)) return
      if (document.activeElement === input) return
      e.preventDefault()
      input.focus({ preventScroll: true })
      syncChatScrollForKeyboard()
    }

    const onFocus = () => syncChatScrollForKeyboard()

    bar.addEventListener('pointerdown', onPointerDown, { capture: true })
    input.addEventListener('focus', onFocus)
    return () => {
      bar.removeEventListener('pointerdown', onPointerDown, { capture: true })
      input.removeEventListener('focus', onFocus)
    }
  }, [syncChatScrollForKeyboard, showAct1PerformButton])

  return (
    <div className={`relative flex min-h-0 flex-col ${hideShell ? 'absolute inset-0 z-10' : 'absolute inset-0'}`}>
      {!hideShell ? <HallRoomBackdrop media={media} /> : null}

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
          <div className="flex shrink-0 items-center gap-1.5">
            <JBSDevStageJump />
            <button
              type="button"
              onClick={() => setGameLobbyOpen(true)}
              className="jbs-gf-chat-icon-btn flex size-9 shrink-0 items-center justify-center rounded-full"
              aria-label="小游戏"
            >
              <Gamepad2 className="size-4" strokeWidth={1.35} />
            </button>
            <JBSBookmarkButton
              ref={bookmarkRef}
              absorbPulseKey={drawerAbsorbPulse}
              badgeCount={clueBadgeCount}
              onClick={() => setDrawerOpen(true)}
            />
          </div>
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
        className="jbs-gf-chat-messages-scroll min-h-0 flex-1 overflow-y-auto jbs-hide-scrollbar px-3 py-4"
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
            if (useAct1NarrationPanels) {
              if (!compactDmNarrationLines(line.body)) return null
              return (
                <NarrationPlotPanel
                  key={line.id}
                  body={line.body}
                  highlight={line.dmHighlight}
                />
              )
            }
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
              actionLine={line.actionLine}
              bubbleContinued={line.bubbleContinued}
            />
          )
        })}
        {storyBg.liveBubble ? (
          <>
            <DMMsgBubble
              body={storyBg.liveBubble.body}
              isTyping={storyBg.liveBubble.isTyping}
              highlight={storyBg.liveBubble.highlight}
            />
            {storyBg.canSkipCurrentTrack ? (
              <DmVoiceTrackSkipButton
                onSkip={storyBg.skipCurrentTrack}
                isLastTrack={storyBg.trackIndex >= storyBg.trackCount - 1}
              />
            ) : null}
          </>
        ) : null}
        {act1PublicPlotVoice.liveBubble ? (
          <>
            {useAct1NarrationPanels ? (
              act1LiveTrack?.speaker === 'dm' || !act1LiveTrack ? (
                <NarrationPlotPanel
                  body={act1LiveNarrationPanelBody ?? act1PublicPlotVoice.liveBubble.body}
                  isTyping={act1LiveNarrationPanelTyping}
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
            ) : act1LiveTrack?.speaker === 'dm' || !act1LiveTrack ? (
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
            )}
            {act1CanSkipCurrentTrack ? (
              <DmVoiceTrackSkipButton
                onSkip={act1PublicPlotVoice.skipCurrentTrack}
                isLastTrack={
                  act1PublicPlotVoice.trackIndex >= act1PublicPlotVoice.trackCount - 1
                }
              />
            ) : null}
          </>
        ) : null}
        {discuss1OpeningVoice.liveBubble && discuss1LiveTrack ? (
          <>
            <RolePortraitMsgBubble
              body={discuss1OpeningVoice.liveBubble.body}
              roleName={discuss1LiveTrack.speaker.role}
              isSelf={discuss1LiveTrack.speaker.role === playerRoleName}
              portraitUrl={rolePortraitUrl(discuss1LiveTrack.speaker.role)}
              isTyping={discuss1OpeningVoice.liveBubble.isTyping}
            />
            {discuss1OpeningVoice.canSkipCurrentTrack ? (
              <DmVoiceTrackSkipButton
                onSkip={discuss1OpeningVoice.skipCurrentTrack}
                isLastTrack={
                  discuss1OpeningVoice.trackIndex >= discuss1OpeningVoice.trackCount - 1
                }
              />
            ) : null}
          </>
        ) : null}
        {storyBg.phase === 'need-tap' ||
        act1PublicPlotVoice.phase === 'need-tap' ||
        discuss1OpeningVoice.phase === 'need-tap' ? (
          <p className="jbs-gf-chat-system-line jbs-font-serif mb-3 text-center text-[9px] tracking-[0.12em]">
            轻触屏幕以继续播放主持语音
          </p>
        ) : null}
        {showIntroScriptWidget && !showAct1ScriptWidget ? (
          <ScriptBookWidget
            roleName={locked.card.role.name}
            variant="intro"
            onOpen={handleOpenIntroScript}
          />
        ) : null}
        {showAct1ScriptWidget ? (
          <ScriptBookWidget
            roleName={locked.card.role.name}
            variant="act1"
            onOpen={handleOpenAct1Script}
          />
        ) : null}
        {discussAiGenerating && inPublicDiscuss ? <DiscussThinkingIndicator /> : null}
      </div>

      <ScriptInteractiveReader
        session={readingSession}
        roleName={locked.card.role.name}
        scriptId={locked.script.id}
        roleId={locked.card.id}
        scriptSections={scriptSections}
        currentStep={currentStep}
        loopRound={loopRound}
        scriptUnlockFlags={scriptUnlockFlags}
        onPagesBuilt={applyScriptPages}
        onCollapse={minimizeScriptBook}
        onPageChange={setScriptReaderPage}
      />

      {showScriptAccessButton ? (
        <MiniBookAnchor onRestore={openScriptBook} />
      ) : null}

      <TaskAcceptModal />
      <TaskFloatingBall />

      <div
        ref={keyboardInsetFillRef}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[8]"
        aria-hidden
      />

      <div
        ref={inputBarRef}
        className={`jbs-gf-chat-input-bar shrink-0 transform-gpu px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))]${readerFullscreenOpen ? ' jbs-gf-chat-input-bar--over-reader' : ''}`}
      >
        {showAct1TaskAcceptButton ? (
          <button
            type="button"
            onClick={handleAcceptAct1Tasks}
            className="jbs-gf-chat-stage-advance-btn jbs-font-serif mb-2.5 w-full rounded-lg py-3 text-[12px] tracking-[0.14em]"
          >
            接取本幕任务
          </button>
        ) : null}
        {showDiscussEndButton ? (
          <button
            type="button"
            onClick={handleStageAdvance}
            className="jbs-gf-chat-discuss-end-btn jbs-font-serif mb-2.5 w-full rounded-lg py-3 text-[12px] tracking-[0.14em]"
          >
            讨论结束 · 进入下一阶段
          </button>
        ) : null}
        {showStageAdvanceButton ? (
          <button
            type="button"
            onClick={handleStageAdvance}
            className="jbs-gf-chat-stage-advance-btn jbs-font-serif mb-2.5 w-full rounded-lg py-3 text-[12px] tracking-[0.14em]"
          >
            进入下一阶段
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
          <>
            {inPublicDiscuss && discussGenerationFailed && !discussAiBusy ? (
              <div className="jbs-gf-discuss-retry-row mb-2 flex items-center gap-2">
                <p className="jbs-gf-discuss-retry-hint jbs-font-serif min-w-0 flex-1 text-[10px] leading-relaxed tracking-[0.06em]">
                  众人回应生成失败
                </p>
                <button
                  type="button"
                  onClick={() => void retryDiscussNpcReplies()}
                  className="jbs-gf-discuss-retry-btn jbs-font-serif shrink-0 rounded-lg px-3 py-2 text-[11px] tracking-[0.12em]"
                >
                  重新生成
                </button>
              </div>
            ) : null}
            {inPublicDiscuss && pendingAction ? (
              <p className="jbs-gf-discuss-pending-action jbs-font-serif mb-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed">
                待发动作：{pendingAction}
              </p>
            ) : null}
            <div className="flex gap-2">
              {inPublicDiscuss ? (
                <JBSDiscussActionPicker
                  playerRoleName={playerRoleName}
                  pendingAction={pendingAction}
                  disabled={inputLocked}
                  onPickAction={appendPendingAction}
                  onClearAction={clearPendingAction}
                />
              ) : null}
              <input
                ref={chatInputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !inputLocked) handleComposerEnter()
                }}
                placeholder={inputLockedPlaceholder}
                disabled={inputLocked}
                className="jbs-gf-chat-input jbs-font-serif min-w-0 flex-1 rounded-lg px-3 py-2.5 text-[14px] disabled:opacity-45"
              />
              <button
                type="button"
                onClick={handleComposerSendClick}
                disabled={inputLocked || (inPublicDiscuss ? discussSendDisabled : !draft.trim())}
                className="jbs-gf-chat-send-btn flex size-11 shrink-0 items-center justify-center rounded-lg disabled:opacity-35"
                aria-label={inPublicDiscuss ? '等待众人回应' : '发送'}
              >
                <Send className="size-4" strokeWidth={1.25} />
              </button>
            </div>
          </>
        ) : null}
      </div>

      <JBSControlDrawer />
      <ClueCollectorLayer collectTargetRef={bookmarkRef} />
      <GameLobbySheet
        open={gameLobbyOpen}
        onClose={() => setGameLobbyOpen(false)}
        onSendInvite={handleSendGameInvite}
      />
      <GameFlowToast message={flowToast} />
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
  bgmMuted,
  onBgmMutedChange,
}: ChatRoomActiveProps) {
  const [activeCommission, setActiveCommission] = useState<SerializableActiveCommission | null>(
    () => initialEngineSnapshot?.activeCommission ?? null,
  )
  const activeCommissionRef = useRef(activeCommission)
  const latestFlowSnapshotRef = useRef<JbsFlowEngineSnapshot | null>(initialEngineSnapshot)

  useEffect(() => {
    activeCommissionRef.current = activeCommission
  }, [activeCommission])

  const handleFlowSnapshotChange = useCallback(
    (snapshot: JbsFlowEngineSnapshot) => {
      latestFlowSnapshotRef.current = snapshot
      onEngineSnapshotChange?.({
        ...snapshot,
        activeCommission: activeCommissionRef.current,
      })
    },
    [onEngineSnapshotChange],
  )

  const handleCommissionChange = useCallback(
    (next: SerializableActiveCommission | null) => {
      setActiveCommission(next)
      activeCommissionRef.current = next
      if (latestFlowSnapshotRef.current) {
        onEngineSnapshotChange?.({
          ...latestFlowSnapshotRef.current,
          activeCommission: next,
        })
      }
    },
    [onEngineSnapshotChange],
  )

  return (
    <JBSFlowProvider
      locked={locked}
      playerDisplayName={playerDisplayName}
      media={media}
      initialEngineSnapshot={initialEngineSnapshot}
      onEngineSnapshotChange={handleFlowSnapshotChange}
      bgmMuted={bgmMuted}
      onBgmMutedChange={onBgmMutedChange}
    >
      <TaskCommissionProvider
        initialCommission={activeCommission}
        onCommissionChange={handleCommissionChange}
      >
        <ChatRoomActive onExit={onExit} hideShell={hideShell} />
      </TaskCommissionProvider>
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
