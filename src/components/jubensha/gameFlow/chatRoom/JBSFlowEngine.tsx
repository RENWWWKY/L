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
} from './jbsFlowTypes'
import {
  createManuscriptMemo,
  loadManuscriptStore,
  saveManuscriptStore,
  type ManuscriptMemo,
} from './manuscriptStore'
import {
  charOffsetBeforePage,
  findPageIndexForCharOffset,
} from './scriptReader/scriptPagePaginator'
import type { ReadingSession, ScriptPage } from './scriptReader/scriptReaderTypes'
import { isYuyeGuilingScript } from './yuyeGuilingDmFlow'
import type { JbsEngineSnapshot, JbsVoicePlaybackState } from '../jbsProgressStore'
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
  openScriptBook: () => void
  minimizeScriptBook: () => void
  restoreScriptBook: () => void
  setScriptReaderPage: (page: number) => void
  applyScriptPages: (pages: ScriptPage[]) => void
  finishScriptReading: () => void
  patchVoicePlayback: (patch: Partial<JbsVoicePlaybackState>) => void
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
  onEngineSnapshotChange?: (snapshot: JbsEngineSnapshot) => void
  children: ReactNode
}

export function JBSFlowProvider({
  locked,
  playerDisplayName,
  media = {},
  initialEngineSnapshot = null,
  onEngineSnapshotChange,
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
  const [bgmMuted, setBgmMuted] = useState(initialEngineSnapshot?.bgmMuted ?? false)
  const [inspectingClueId, setInspectingClueId] = useState<string | null>(null)
  const [collectedClueIds, setCollectedClueIds] = useState<string[]>(
    initialEngineSnapshot?.collectedClueIds ?? [],
  )
  const [dispersalQueue, setDispersalQueue] = useState<string[]>([])
  const [activeDispersalClueId, setActiveDispersalClueId] = useState<string | null>(null)
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
  const booted = useRef(restoring)

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

  const openScriptBook = useCallback(() => {
    setReadingSession((prev) => ({
      ...prev,
      isOpen: true,
      isMinimized: false,
    }))
  }, [])

  const minimizeScriptBook = useCallback(() => {
    setReadingSession((prev) => ({
      ...prev,
      isOpen: false,
      isMinimized: true,
    }))
  }, [])

  const restoreScriptBook = useCallback(() => {
    setReadingSession((prev) => ({
      ...prev,
      isOpen: true,
      isMinimized: false,
    }))
  }, [])

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
        id: msg.id ?? uid(msg.kind),
        kind: msg.kind,
        body: msg.body,
        roleName: msg.roleName,
        dmHighlight: msg.dmHighlight,
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
    setDispersalQueue((prev) => (prev.includes(clueId) ? prev : [...prev, clueId]))
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
      openScriptBook,
      minimizeScriptBook,
      restoreScriptBook,
      setScriptReaderPage,
      applyScriptPages,
      finishScriptReading,
      patchVoicePlayback,
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
      pushMessage,
      sendPlayerMessage,
      advanceStep,
      setStep,
      triggerClueDispersal,
      completeClueDispersal,
      createManuscript,
      updateManuscript,
      deleteManuscript,
      setActiveManuscriptId,
      openScriptBook,
      minimizeScriptBook,
      restoreScriptBook,
      setScriptReaderPage,
      applyScriptPages,
      finishScriptReading,
      patchVoicePlayback,
    ],
  )

  return <JBSFlowContext.Provider value={value}>{children}</JBSFlowContext.Provider>
}

export function useJBSFlow(): JBSFlowContextValue {
  const ctx = useContext(JBSFlowContext)
  if (!ctx) throw new Error('useJBSFlow must be used within JBSFlowProvider')
  return ctx
}
