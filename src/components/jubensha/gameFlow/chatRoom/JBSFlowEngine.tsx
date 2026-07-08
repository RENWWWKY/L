/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import type { LockedRole } from '../gameFlowTypes'
import { playJbsPageFlipSfx } from '../jbsPageFlipSfx'

import { buildScriptClues } from './jbsClueData'
import { buildRoleScriptSections } from './jbsScriptContent'
import {
  computeNextFlowState,
  getAdvanceDmBodies,
  getAdvanceSystemHint,
  type FlowAdvanceState,
} from './jbsDmDispatch'
import {
  isClueUnlocked,
  jbsStepAnnouncement,
  type DrawerTab,
  type JBSChatMessage,
  type JBSClue,
  type JBSStep,
  type ScriptSection,
  type ScriptSectionId,
} from './jbsFlowTypes'
import {
  createManuscriptMemo,
  loadManuscriptStore,
  saveManuscriptStore,
  type ManuscriptMemo,
} from './manuscriptStore'
import { findFirstPageIndexForSection } from './scriptReader/buildScriptPages'
import {
  charOffsetBeforePage,
  findPageIndexForCharOffset,
} from './scriptReader/scriptPagePaginator'
import type { ReadingSession, ScriptPage } from './scriptReader/scriptReaderTypes'
import { isYuyeGuilingScript } from './yuyeGuilingDmFlow'
import {
  buildDevJumpCollectedClueIds,
  getDevFlowNodeDef,
  resolveDevFlowJumpTarget,
  type DevFlowNodeId,
} from './jbsDevFlowNodes'
import { getStoryBackgroundPremiseClueIds } from './jbsClueData'
import type { JbsEngineSnapshot, JbsFlowEngineSnapshot, JbsVoicePlaybackState } from '../jbsProgressStore'
import { EMPTY_VOICE_PLAYBACK } from '../jbsProgressStore'

export type JBSFlowMedia = {
  videoUrl?: string
  bgmUrl?: string
}

export type JBSFlowEngineState = {
  currentStep: JBSStep
  loopRound: number
  messages: JBSChatMessage[]
  clues: JBSClue[]
  scriptSections: ScriptSection[]
  manuscriptMemos: ManuscriptMemo[]
  activeManuscriptId: string | null
  drawerOpen: boolean
  drawerTab: DrawerTab
  bgmMuted: boolean
  inspectingClueId: string | null
  media: JBSFlowMedia
  /** 已通过飞牌收纳进手札的线索 ID */
  collectedClueIds: string[]
  /** 当前正在展示的飞牌线索（队列头） */
  activeDispersalClueId: string | null
  /** 手札按钮吸收脉冲计数（驱动 scale 动画） */
  drawerAbsorbPulse: number
  /** 未读收纳线索数（打开「公共线索」页签后清零） */
  clueBadgeCount: number
  readingSession: ReadingSession
  voicePlayback: JbsVoicePlaybackState
  /** DEV：每次阶段跳转 +1，用于重置旁白/语音序列 */
  devStageEpoch: number
  devFlowNodeId: DevFlowNodeId | null
}

type JBSFlowContextValue = JBSFlowEngineState & {
  locked: LockedRole
  playerDisplayName: string
  pushMessage: (msg: Omit<JBSChatMessage, 'id' | 'at'> & { id?: string }) => void
  sendPlayerMessage: (body: string) => void
  setDrawerOpen: (open: boolean) => void
  setDrawerTab: (tab: DrawerTab) => void
  createManuscript: (title?: string) => string
  updateManuscript: (
    id: string,
    patch: Partial<Pick<ManuscriptMemo, 'title' | 'body'>>,
  ) => void
  deleteManuscript: (id: string) => void
  setActiveManuscriptId: (id: string | null) => void
  setBgmMuted: (muted: boolean) => void
  setInspectingClueId: (id: string | null) => void
  advanceStep: () => void
  setStep: (step: JBSStep) => void
  /** 向聊天流推送一张待收纳线索卡（进入队列） */
  triggerClueDispersal: (clueId: string) => void
  /** 飞牌收纳完成（由 ClueCollector 调用） */
  completeClueDispersal: (clueId: string) => void
  /** 当前批次是否应先展示「发现新线索」弹窗（每批仅一次） */
  pendingDiscoveryToast: boolean
  /** 本批待收纳线索数量（含当前展示的一张） */
  dispersalBatchSize: number
  acknowledgeDiscoveryToast: () => void
  /** 送达个人剧本至聊天室小册；`autoOpen` 为 true 时才直接打开阅读器正文 */
  deliverScriptBook: (opts?: { autoOpen?: boolean }) => void
  openScriptBook: () => void
  /** 打开阅读器并跳转到指定分幕首页 */
  openScriptBookToSection: (sectionId: ScriptSectionId) => void
  minimizeScriptBook: () => void
  restoreScriptBook: () => void
  setScriptReaderPage: (page: number) => void
  applyScriptPages: (pages: ScriptPage[]) => void
  finishScriptReading: () => void
  patchVoicePlayback: (patch: Partial<JbsVoicePlaybackState>) => void
  /** 仅 DEV：按「阶段流程」节点跳转（从节点起点重来） */
  debugJumpToFlowNode: (nodeId: DevFlowNodeId) => void
  devFlowNodeId: DevFlowNodeId | null
}

const JBSFlowContext = createContext<JBSFlowContextValue | null>(null)

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function dmMessage(body: string): JBSChatMessage {
  return { id: uid('dm'), kind: 'dm', body, at: Date.now() }
}

function systemMessage(body: string): JBSChatMessage {
  return { id: uid('sys'), kind: 'system', body, at: Date.now() }
}

function emptyReadingSession(): ReadingSession {
  return {
    pages: [],
    totalPageCount: 0,
    allowedMaxPage: 0,
    currentPage: 0,
    isOpen: false,
    isMinimized: false,
    hasFinishedPhase: false,
    bookDelivered: false,
    bookOpenedOnce: false,
  }
}

function flowLabel(state: FlowAdvanceState): string {
  if (state.step === 7) return `第 7 阶段 · 循环 ${state.loopRound}/3`
  return `第 ${state.step} 阶段 / 8`
}

export type JBSFlowProviderProps = {
  locked: LockedRole
  playerDisplayName: string
  media?: JBSFlowMedia
  initialEngineSnapshot?: JbsEngineSnapshot | null
  onEngineSnapshotChange?: (snapshot: JbsFlowEngineSnapshot) => void
  /** 与 Shell 层 `GameplayBgmPlayer` 同步静音（避免重复 Audio 实例） */
  bgmMuted?: boolean
  onBgmMutedChange?: (muted: boolean) => void
  children: ReactNode
}

export function JBSFlowProvider({
  locked,
  playerDisplayName,
  media = {},
  initialEngineSnapshot = null,
  onEngineSnapshotChange,
  bgmMuted: bgmMutedProp,
  onBgmMutedChange,
  children,
}: JBSFlowProviderProps) {
  const { script, card } = locked
  const useDmScript = isYuyeGuilingScript(script.id)
  const restoring = !!initialEngineSnapshot

  const scriptSections = useMemo(
    () => buildRoleScriptSections(script.id, card.role.name, card.role.blurb),
    [script.id, card.role.name, card.role.blurb],
  )

  const clues = useMemo(() => buildScriptClues(script.id), [script.id])

  const [currentStep, setCurrentStep] = useState<JBSStep>(initialEngineSnapshot?.currentStep ?? 2)
  const [loopRound, setLoopRound] = useState(initialEngineSnapshot?.loopRound ?? 0)
  const [messages, setMessages] = useState<JBSChatMessage[]>(initialEngineSnapshot?.messages ?? [])
  const [manuscriptMemos, setManuscriptMemos] = useState<ManuscriptMemo[]>([])
  const [activeManuscriptId, setActiveManuscriptIdState] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(initialEngineSnapshot?.drawerOpen ?? false)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>(initialEngineSnapshot?.drawerTab ?? 'script')
  const [bgmMutedInternal, setBgmMutedInternal] = useState(initialEngineSnapshot?.bgmMuted ?? false)
  const bgmMuted = bgmMutedProp ?? bgmMutedInternal
  const setBgmMuted = useCallback(
    (muted: boolean) => {
      if (onBgmMutedChange) onBgmMutedChange(muted)
      else setBgmMutedInternal(muted)
    },
    [onBgmMutedChange],
  )
  const [inspectingClueId, setInspectingClueId] = useState<string | null>(null)
  const [collectedClueIds, setCollectedClueIds] = useState<string[]>(
    initialEngineSnapshot?.collectedClueIds ?? [],
  )
  const [dispersalQueue, setDispersalQueue] = useState<string[]>([])
  const [activeDispersalClueId, setActiveDispersalClueId] = useState<string | null>(null)
  const [pendingDiscoveryToast, setPendingDiscoveryToast] = useState(false)
  const activeDispersalRef = useRef<string | null>(null)
  const [drawerAbsorbPulse, setDrawerAbsorbPulse] = useState(0)
  const [clueBadgeCount, setClueBadgeCount] = useState(initialEngineSnapshot?.clueBadgeCount ?? 0)
  const [voicePlayback, setVoicePlayback] = useState<JbsVoicePlaybackState>(
    () => initialEngineSnapshot?.voicePlayback ?? { ...EMPTY_VOICE_PLAYBACK },
  )
  const [readingSession, setReadingSession] = useState<ReadingSession>(() => {
    const base = emptyReadingSession()
    if (!initialEngineSnapshot?.readingSession) return base
    return { ...base, ...initialEngineSnapshot.readingSession }
  })
  const dispersalTriggeredRef = useRef<Set<string>>(
    new Set(initialEngineSnapshot?.dispersalTriggeredIds ?? []),
  )
  const prevStepRef = useRef<JBSStep>(initialEngineSnapshot?.currentStep ?? 2)
  const pendingScriptSectionRef = useRef<ScriptSectionId | null>(null)
  const booted = useRef(restoring)
  const [devStageEpoch, setDevStageEpoch] = useState(0)
  const [devFlowNodeId, setDevFlowNodeId] = useState<DevFlowNodeId | null>(null)

  useEffect(() => {
    activeDispersalRef.current = activeDispersalClueId
  }, [activeDispersalClueId])

  const dispersalBatchSize =
    (activeDispersalClueId ? 1 : 0) + dispersalQueue.length

  const acknowledgeDiscoveryToast = useCallback(() => {
    setPendingDiscoveryToast(false)
  }, [])

  const pushDmScriptBodies = useCallback(
    (bodies: string[], systemHint: string | null) => {
      setMessages((prev) => {
        const next = [...prev]
        for (const body of bodies) {
          if (body.trim()) next.push(dmMessage(body))
        }
        if (systemHint?.trim()) next.push(systemMessage(systemHint))
        return next
      })
    },
    [],
  )

  const applyScriptPages = useCallback((pages: ScriptPage[]) => {
    setReadingSession((prev) => {
      const pending = pendingScriptSectionRef.current
      if (pending) {
        const idx = findFirstPageIndexForSection(pages, pending)
        if (idx >= 0) {
          pendingScriptSectionRef.current = null
          const allowedMaxPage = Math.max(0, pages.length - 1)
          return {
            ...prev,
            pages,
            totalPageCount: pages.length,
            allowedMaxPage,
            currentPage: Math.min(idx, allowedMaxPage),
          }
        }
      }
      const charOffset = charOffsetBeforePage(prev.pages, prev.currentPage)
      const newPage = findPageIndexForCharOffset(pages, charOffset)
      return {
        ...prev,
        pages,
        totalPageCount: pages.length,
        allowedMaxPage: Math.max(0, pages.length - 1),
        currentPage: newPage,
      }
    })
  }, [])

  useEffect(() => {
    if (currentStep < 3) return
    if (prevStepRef.current === currentStep) return
    prevStepRef.current = currentStep
    setReadingSession((prev) => ({
      ...prev,
      bookDelivered: true,
      hasFinishedPhase: false,
      isOpen: false,
      isMinimized: false,
      currentPage: 0,
    }))
  }, [currentStep])

  const deliverScriptBook = useCallback((opts?: { autoOpen?: boolean }) => {
    const autoOpen = opts?.autoOpen === true
    if (autoOpen) playJbsPageFlipSfx(script.id)
    setReadingSession((prev) => {
      if (prev.bookDelivered && !autoOpen) return prev
      return {
        ...prev,
        bookDelivered: true,
        isOpen: autoOpen ? true : prev.isOpen,
        isMinimized: autoOpen ? false : prev.isMinimized,
        bookOpenedOnce: autoOpen ? true : prev.bookOpenedOnce,
      }
    })
  }, [script.id])

  const openScriptBook = useCallback(() => {
    playJbsPageFlipSfx(script.id)
    setReadingSession((prev) => ({
      ...prev,
      bookDelivered: true,
      bookOpenedOnce: true,
      isOpen: true,
      isMinimized: false,
    }))
  }, [script.id])

  const openScriptBookToSection = useCallback((sectionId: ScriptSectionId) => {
    playJbsPageFlipSfx(script.id)
    pendingScriptSectionRef.current = sectionId
    setReadingSession((prev) => {
      const pageIdx = findFirstPageIndexForSection(prev.pages, sectionId)
      if (pageIdx >= 0) pendingScriptSectionRef.current = null
      const targetPage =
        pageIdx >= 0 ? Math.min(pageIdx, prev.allowedMaxPage) : prev.currentPage
      return {
        ...prev,
        bookDelivered: true,
        bookOpenedOnce: true,
        isOpen: true,
        isMinimized: false,
        currentPage: targetPage,
      }
    })
  }, [script.id])

  const minimizeScriptBook = useCallback(() => {
    setReadingSession((prev) => ({
      ...prev,
      isOpen: false,
      isMinimized: true,
    }))
  }, [])

  const restoreScriptBook = useCallback(() => {
    playJbsPageFlipSfx(script.id)
    setReadingSession((prev) => ({
      ...prev,
      isOpen: true,
      isMinimized: false,
    }))
  }, [script.id])

  const setScriptReaderPage = useCallback((page: number) => {
    setReadingSession((prev) => {
      const max = prev.allowedMaxPage
      const next = Math.max(0, Math.min(page, max))
      return { ...prev, currentPage: next }
    })
  }, [])

  const finishScriptReading = useCallback(() => {
    setReadingSession((prev) => ({
      ...prev,
      hasFinishedPhase: true,
      isOpen: false,
      isMinimized: false,
    }))
    setMessages((prev) => [
      ...prev,
      systemMessage(`${card.role.name} 已读完当前幕剧本`),
    ])
  }, [card.role.name])

  const patchVoicePlayback = useCallback((patch: Partial<JbsVoicePlaybackState>) => {
    setVoicePlayback((prev) => ({ ...prev, ...patch }))
  }, [])

  useEffect(() => {
    const store = loadManuscriptStore(script.id, card.id)
    setManuscriptMemos(store.memos)
    setActiveManuscriptIdState(store.activeMemoId)
  }, [script.id, card.id])

  const persistManuscripts = useCallback(
    (memos: ManuscriptMemo[], activeId: string | null) => {
      saveManuscriptStore(script.id, card.id, { memos, activeMemoId: activeId })
    },
    [script.id, card.id],
  )

  const setActiveManuscriptId = useCallback(
    (id: string | null) => {
      setActiveManuscriptIdState(id)
      setManuscriptMemos((memos) => {
        persistManuscripts(memos, id)
        return memos
      })
    },
    [persistManuscripts],
  )

  const createManuscript = useCallback(
    (title?: string) => {
      const index = manuscriptMemos.length + 1
      const memo = createManuscriptMemo(title?.trim() || `手稿 ${index}`)
      setManuscriptMemos((prev) => {
        const next = [memo, ...prev]
        persistManuscripts(next, memo.id)
        return next
      })
      setActiveManuscriptIdState(memo.id)
      return memo.id
    },
    [manuscriptMemos.length, persistManuscripts],
  )

  const updateManuscript = useCallback(
    (id: string, patch: Partial<Pick<ManuscriptMemo, 'title' | 'body'>>) => {
      setManuscriptMemos((prev) => {
        const next = prev.map((m) =>
          m.id === id
            ? {
                ...m,
                ...patch,
                updatedAt: Date.now(),
              }
            : m,
        )
        persistManuscripts(next, activeManuscriptId)
        return next
      })
    },
    [activeManuscriptId, persistManuscripts],
  )

  const deleteManuscript = useCallback(
    (id: string) => {
      setManuscriptMemos((prev) => {
        const next = prev.filter((m) => m.id !== id)
        const nextActive =
          activeManuscriptId === id ? (next[0]?.id ?? null) : activeManuscriptId
        setActiveManuscriptIdState(nextActive)
        persistManuscripts(next, nextActive)
        return next
      })
    },
    [activeManuscriptId, persistManuscripts],
  )

  const pushMessage = useCallback(
    (msg: Omit<JBSChatMessage, 'id' | 'at'> & { id?: string }) => {
      const line: JBSChatMessage = {
        ...msg,
        id: msg.id ?? uid(msg.kind),
        at: Date.now(),
      }
      setMessages((prev) => [...prev, line])
    },
    [],
  )

  const applyFlowState = useCallback(
    (next: FlowAdvanceState) => {
      setCurrentStep(next.step)
      setLoopRound(next.loopRound)
      if (!useDmScript) return
      const bodies = getAdvanceDmBodies(script.id, next)
      const hint = getAdvanceSystemHint(script.id, next)
      pushDmScriptBodies(bodies, hint)
      setMessages((prev) => [...prev, systemMessage(`进程 · ${flowLabel(next)}`)])
    },
    [pushDmScriptBodies, script.id, useDmScript],
  )

  const setStep = useCallback(
    (step: JBSStep) => {
      const next: FlowAdvanceState = { step, loopRound: step === 7 ? Math.max(loopRound, 1) : loopRound }
      applyFlowState(next)
    },
    [applyFlowState, loopRound],
  )

  const debugJumpToFlowNode = useCallback(
    (nodeId: DevFlowNodeId) => {
      if (!import.meta.env.DEV) return
      const target = resolveDevFlowJumpTarget(nodeId, script.id)
      if (target.shellOpening) return

      const flowState: FlowAdvanceState = { step: target.step, loopRound: target.loopRound }
      const premiseIds = getStoryBackgroundPremiseClueIds(script.id)
      const collected = buildDevJumpCollectedClueIds(script.id, target)

      prevStepRef.current = target.step
      setDevFlowNodeId(nodeId)
      setCurrentStep(target.step)
      setLoopRound(target.loopRound)
      setVoicePlayback(target.voice)
      setDevStageEpoch((n) => n + 1)
      setInspectingClueId(null)
      setActiveDispersalClueId(null)
      setDispersalQueue([])
      setPendingDiscoveryToast(false)

      if (target.premiseDispersalTriggered) {
        for (const id of premiseIds) dispersalTriggeredRef.current.add(id)
      } else {
        for (const id of premiseIds) dispersalTriggeredRef.current.delete(id)
      }
      setCollectedClueIds(collected)
      setReadingSession((prev) => ({
        ...prev,
        isOpen: false,
        isMinimized: false,
        currentPage: 0,
        ...target.readingSession,
        pages: prev.pages,
        totalPageCount: prev.totalPageCount,
        allowedMaxPage: prev.allowedMaxPage,
      }))
      if (target.step >= 3 || target.readingSession.bookDelivered) {
        deliverScriptBook()
      }

      const nodeDef = getDevFlowNodeDef(nodeId)
      const bootLines: JBSChatMessage[] = [
        systemMessage(`暗室已启。你以「${card.role.name}」之名入局。`),
      ]
      if (useDmScript) {
        bootLines.push(systemMessage(jbsStepAnnouncement(target.step)))
        bootLines.push(systemMessage(`进程 · ${flowLabel(flowState)}`))
      }
      bootLines.push(
        systemMessage(`[DEV] 跳转 · ${nodeDef.index}. ${nodeDef.label}`),
      )
      setMessages(bootLines)
    },
    [card.role.name, deliverScriptBook, script.id, useDmScript],
  )

  const advanceStep = useCallback(() => {
    const current: FlowAdvanceState = { step: currentStep, loopRound }
    const next = computeNextFlowState(current)
    if (next.step === current.step && next.loopRound === current.loopRound) return
    applyFlowState(next)
  }, [applyFlowState, currentStep, loopRound])

  const sendPlayerMessage = useCallback(
    (body: string) => {
      const text = body.trim()
      if (!text) return
      pushMessage({
        kind: 'player',
        body: text,
        roleName: card.role.name,
      })
    },
    [card.role.name, pushMessage],
  )

  const triggerClueDispersal = useCallback((clueId: string) => {
    setDispersalQueue((prev) => {
      if (prev.includes(clueId)) return prev
      const isNewBatch =
        activeDispersalRef.current == null && prev.length === 0
      if (isNewBatch) {
        setPendingDiscoveryToast(true)
      }
      return [...prev, clueId]
    })
  }, [])

  const completeClueDispersal = useCallback((clueId: string) => {
    setCollectedClueIds((prev) => (prev.includes(clueId) ? prev : [...prev, clueId]))
    setActiveDispersalClueId(null)
    setDrawerAbsorbPulse((n) => n + 1)
    setClueBadgeCount((n) => n + 1)
    setMessages((prev) => [
      ...prev,
      systemMessage(`线索已收纳 · ${clues.find((c) => c.id === clueId)?.title ?? '物证'}`),
    ])
  }, [clues])

  useEffect(() => {
    if (activeDispersalClueId != null || dispersalQueue.length === 0) return
    const [next, ...rest] = dispersalQueue
    setDispersalQueue(rest)
    setActiveDispersalClueId(next)
  }, [activeDispersalClueId, dispersalQueue])

  useEffect(() => {
    for (const clue of clues) {
      if (clue.autoDisperseOnUnlock === false) continue
      if (!isClueUnlocked(clue, currentStep, loopRound)) continue
      if (collectedClueIds.includes(clue.id)) continue
      if (dispersalTriggeredRef.current.has(clue.id)) continue
      dispersalTriggeredRef.current.add(clue.id)
      triggerClueDispersal(clue.id)
    }
  }, [clues, collectedClueIds, currentStep, loopRound, triggerClueDispersal])

  useEffect(() => {
    if (drawerOpen && drawerTab === 'clues') {
      setClueBadgeCount(0)
    }
  }, [drawerOpen, drawerTab])

  useEffect(() => {
    if (!onEngineSnapshotChange) return
    const timer = window.setTimeout(() => {
      onEngineSnapshotChange({
        currentStep,
        loopRound,
        messages,
        collectedClueIds,
        dispersalTriggeredIds: [...dispersalTriggeredRef.current],
        readingSession: {
          currentPage: readingSession.currentPage,
          isOpen: readingSession.isOpen,
          isMinimized: readingSession.isMinimized,
          hasFinishedPhase: readingSession.hasFinishedPhase,
          bookDelivered: readingSession.bookDelivered,
          bookOpenedOnce: readingSession.bookOpenedOnce,
        },
        drawerOpen,
        drawerTab,
        bgmMuted,
        clueBadgeCount,
        voicePlayback,
      })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [
    onEngineSnapshotChange,
    currentStep,
    loopRound,
    messages,
    collectedClueIds,
    readingSession,
    drawerOpen,
    drawerTab,
    bgmMuted,
    clueBadgeCount,
    voicePlayback,
  ])

  useEffect(() => {
    if (booted.current) return
    booted.current = true

    const bootLines: JBSChatMessage[] = [
      systemMessage(`暗室已启。你以「${card.role.name}」之名入局。`),
    ]

    if (useDmScript) {
      bootLines.push(systemMessage(jbsStepAnnouncement(2)))
      bootLines.push(systemMessage('进程 · 第 2 阶段 / 8'))
    }

    setMessages(bootLines)
  }, [card.role.name, script.id, useDmScript])

  const value = useMemo<JBSFlowContextValue>(
    () => ({
      locked,
      playerDisplayName,
      currentStep,
      loopRound,
      messages,
      clues,
      scriptSections,
      manuscriptMemos,
      activeManuscriptId,
      drawerOpen,
      drawerTab,
      bgmMuted,
      inspectingClueId,
      media,
      collectedClueIds,
      activeDispersalClueId,
      drawerAbsorbPulse,
      clueBadgeCount,
      readingSession,
      voicePlayback,
      devStageEpoch,
      pushMessage,
      sendPlayerMessage,
      setDrawerOpen,
      setDrawerTab,
      createManuscript,
      updateManuscript,
      deleteManuscript,
      setActiveManuscriptId,
      setBgmMuted,
      setInspectingClueId,
      advanceStep,
      setStep,
      triggerClueDispersal,
      completeClueDispersal,
      pendingDiscoveryToast,
      dispersalBatchSize,
      acknowledgeDiscoveryToast,
      deliverScriptBook,
      openScriptBook,
      openScriptBookToSection,
      minimizeScriptBook,
      restoreScriptBook,
      setScriptReaderPage,
      applyScriptPages,
      finishScriptReading,
      patchVoicePlayback,
      debugJumpToFlowNode,
      devFlowNodeId,
    }),
    [
      locked,
      playerDisplayName,
      currentStep,
      loopRound,
      messages,
      clues,
      scriptSections,
      manuscriptMemos,
      activeManuscriptId,
      drawerOpen,
      drawerTab,
      bgmMuted,
      inspectingClueId,
      media,
      collectedClueIds,
      activeDispersalClueId,
      drawerAbsorbPulse,
      clueBadgeCount,
      readingSession,
      voicePlayback,
      devStageEpoch,
      pushMessage,
      sendPlayerMessage,
      advanceStep,
      setStep,
      triggerClueDispersal,
      completeClueDispersal,
      pendingDiscoveryToast,
      dispersalBatchSize,
      acknowledgeDiscoveryToast,
      createManuscript,
      updateManuscript,
      deleteManuscript,
      setActiveManuscriptId,
      deliverScriptBook,
      openScriptBook,
      openScriptBookToSection,
      minimizeScriptBook,
      restoreScriptBook,
      setScriptReaderPage,
      applyScriptPages,
      finishScriptReading,
      patchVoicePlayback,
      debugJumpToFlowNode,
      devFlowNodeId,
    ],
  )

  return <JBSFlowContext.Provider value={value}>{children}</JBSFlowContext.Provider>
}

export function useJBSFlow(): JBSFlowContextValue {
  const ctx = useContext(JBSFlowContext)
  if (!ctx) throw new Error('useJBSFlow must be used within JBSFlowProvider')
  return ctx
}

export function useJBSFlowOptional(): JBSFlowContextValue | null {
  return useContext(JBSFlowContext)
}
