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
  manuscriptStorageKey,
  type DrawerTab,
  type JBSChatMessage,
  type JBSClue,
  type JBSStep,
  type ScriptSection,
} from './jbsFlowTypes'
import { isYuyeGuilingScript } from './yuyeGuilingDmFlow'

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
  manuscript: string
  drawerOpen: boolean
  drawerTab: DrawerTab
  bgmMuted: boolean
  inspectingClueId: string | null
  media: JBSFlowMedia
}

type JBSFlowContextValue = JBSFlowEngineState & {
  locked: LockedRole
  playerDisplayName: string
  pushMessage: (msg: Omit<JBSChatMessage, 'id' | 'at'> & { id?: string }) => void
  sendPlayerMessage: (body: string) => void
  setDrawerOpen: (open: boolean) => void
  setDrawerTab: (tab: DrawerTab) => void
  setManuscript: (text: string) => void
  setBgmMuted: (muted: boolean) => void
  setInspectingClueId: (id: string | null) => void
  advanceStep: () => void
  setStep: (step: JBSStep) => void
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

function flowLabel(state: FlowAdvanceState): string {
  if (state.step === 7) return `第 7 阶段 · 循环 ${state.loopRound}/3`
  return `第 ${state.step} 阶段 / 8`
}

export type JBSFlowProviderProps = {
  locked: LockedRole
  playerDisplayName: string
  media?: JBSFlowMedia
  children: ReactNode
}

export function JBSFlowProvider({
  locked,
  playerDisplayName,
  media = {},
  children,
}: JBSFlowProviderProps) {
  const { script, card } = locked
  const sessionKey = manuscriptStorageKey(script.id, card.id)
  const useDmScript = isYuyeGuilingScript(script.id)

  const scriptSections = useMemo(
    () => buildRoleScriptSections(script.id, card.role.name, card.role.blurb),
    [script.id, card.role.name, card.role.blurb],
  )

  const clues = useMemo(() => buildScriptClues(script.id), [script.id])

  const [currentStep, setCurrentStep] = useState<JBSStep>(2)
  const [loopRound, setLoopRound] = useState(0)
  const [messages, setMessages] = useState<JBSChatMessage[]>([])
  const [manuscript, setManuscriptState] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('script')
  const [bgmMuted, setBgmMuted] = useState(false)
  const [inspectingClueId, setInspectingClueId] = useState<string | null>(null)
  const booted = useRef(false)

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

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(sessionKey)
      if (saved != null) setManuscriptState(saved)
    } catch {
      /* ignore */
    }
  }, [sessionKey])

  const setManuscript = useCallback(
    (text: string) => {
      setManuscriptState(text)
      try {
        sessionStorage.setItem(sessionKey, text)
      } catch {
        /* ignore */
      }
    },
    [sessionKey],
  )

  const pushMessage = useCallback(
    (msg: Omit<JBSChatMessage, 'id' | 'at'> & { id?: string }) => {
      const line: JBSChatMessage = {
        id: msg.id ?? uid(msg.kind),
        kind: msg.kind,
        body: msg.body,
        roleName: msg.roleName,
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

  useEffect(() => {
    if (booted.current) return
    booted.current = true

    const bootLines: JBSChatMessage[] = [
      systemMessage(`暗室已启。你以「${card.role.name}」之名入局。`),
    ]

    if (useDmScript) {
      // 主持开场已在 DmVoiceIntro 播读，进入聊天室不再重复 DM 气泡
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
      manuscript,
      drawerOpen,
      drawerTab,
      bgmMuted,
      inspectingClueId,
      media,
      pushMessage,
      sendPlayerMessage,
      setDrawerOpen,
      setDrawerTab,
      setManuscript,
      setBgmMuted,
      setInspectingClueId,
      advanceStep,
      setStep,
    }),
    [
      locked,
      playerDisplayName,
      currentStep,
      loopRound,
      messages,
      clues,
      scriptSections,
      manuscript,
      drawerOpen,
      drawerTab,
      bgmMuted,
      inspectingClueId,
      media,
      pushMessage,
      sendPlayerMessage,
      advanceStep,
      setStep,
    ],
  )

  return <JBSFlowContext.Provider value={value}>{children}</JBSFlowContext.Provider>
}

export function useJBSFlow(): JBSFlowContextValue {
  const ctx = useContext(JBSFlowContext)
  if (!ctx) throw new Error('useJBSFlow must be used within JBSFlowProvider')
  return ctx
}
