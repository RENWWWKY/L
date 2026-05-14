/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import type {
  EncounterNPC,
  EncounterSwapMeta,
  LumiMeetPersistedState,
  MeetChatMessage,
  MeetPublicProfile,
  RadarFilters,
  SquarePost,
} from './meetTypes'
import { migrateLumiMeetPersisted } from './meetMigrate'
import { DEFAULT_MEET_STATE, LUMI_MEET_KV_KEY, MEET_RADAR_SEARCH_MIN_UI_MS } from './constants'

/** 匹配 UI：存于 Provider 内存；搜寻结束后先入队 `pendingReveal`，星轨揭幕后再写入 `pendingCard` */
export type LumiMeetRadarSession = {
  searchInProgress: boolean
  sparkInProgress: boolean
  /** 星轨揭幕前的本轮结果（尚未弹出底部档案卡） */
  pendingReveal: { npc: EncounterNPC; isReunionEcho: boolean } | null
  pendingCard: EncounterNPC | null
  isReunionEcho: boolean
}

type Ctx = {
  state: LumiMeetPersistedState
  hydrated: boolean
  patch: (recipe: (draft: LumiMeetPersistedState) => LumiMeetPersistedState) => void
  upsertNpc: (npc: EncounterNPC) => void
  setMeetProfile: (p: Partial<MeetPublicProfile>) => void
  setRadarFilters: (p: Partial<RadarFilters>) => void
  appendSquarePosts: (posts: Omit<SquarePost, 'id' | 'createdAt'>[]) => void
  pushChatMessage: (
    npcId: string,
    msg: {
      role: 'user' | 'npc'
      content: string
      kind?: MeetChatMessage['kind']
      swapCard?: MeetChatMessage['swapCard']
    },
  ) => void
  /** 从临时会话移除一条消息（如长按撤回己方气泡） */
  removeChatMessage: (npcId: string, messageId: string) => void
  bumpIntimacy: (npcId: string, delta: number) => void
  /** 临时会话：按模型判定增减好感（0–100），并在首次达到 100 时解锁互换申请 */
  applyAffectionDelta: (npcId: string, delta: number) => void
  /** 开发者 / 调试：直接设定好感 0–100；跨 100 时与 `applyAffectionDelta` 一致地解锁或收回 `available` */
  setEncounterIntimacy: (npcId: string, value: number) => void
  patchEncounterSwap: (npcId: string, partial: Partial<EncounterSwapMeta>) => void
  markNpcWechatAdded: (npcId: string) => void
  /** 擦肩而过回溯：missed → matched，消耗 1 次机会；成功返回 true */
  rewindMissedToMatched: (npcId: string) => boolean
  radarSession: LumiMeetRadarSession
  /** 异步单次搜寻：进行中或本轮仍为 orbiting 时忽略；不 await，切页也会跑完 */
  requestRadarSearch: (
    executor: () => Promise<{ npc: EncounterNPC; isReunionEcho: boolean } | null>,
  ) => void
  /** 星轨动画结束后挂起本轮到底部 Match Card */
  flushRadarRevealToCard: () => void
  dismissRadarPending: () => void
  setRadarSparkInProgress: (v: boolean) => void
  setRadarPendingCard: (npc: EncounterNPC | null, isReunionEcho?: boolean) => void
  /** 供异步搜寻内读取最新 npcs / 筛选等（避免闭包陈旧） */
  getPersistedSnapshot: () => LumiMeetPersistedState
}

const MeetCtx = createContext<Ctx | null>(null)

function cloneDefault(): LumiMeetPersistedState {
  return JSON.parse(JSON.stringify(DEFAULT_MEET_STATE)) as LumiMeetPersistedState
}

export function LumiMeetProvider({
  children,
  phoneProfileHint,
}: {
  children: ReactNode
  /** 来自手机名片的初始昵称（仅首次填空） */
  phoneProfileHint?: { displayName?: string; avatarHint?: string }
}) {
  const [state, setState] = useState<LumiMeetPersistedState>(() => cloneDefault())
  const [hydrated, setHydrated] = useState(false)
  const saveTimer = useRef<number | undefined>(undefined)
  const providerMountedRef = useRef(true)
  useEffect(() => {
    providerMountedRef.current = true
    return () => {
      providerMountedRef.current = false
    }
  }, [])
  const persistedRef = useRef(state)
  persistedRef.current = state

  const [radarSession, setRadarSession] = useState<LumiMeetRadarSession>({
    searchInProgress: false,
    sparkInProgress: false,
    pendingReveal: null,
    pendingCard: null,
    isReunionEcho: false,
  })
  const radarRef = useRef(radarSession)
  useLayoutEffect(() => {
    radarRef.current = radarSession
  }, [radarSession])
  /** 同步互斥：防止同一时刻重复发起搜寻 */
  const radarSearchLockRef = useRef(false)

  const getPersistedSnapshot = useCallback(() => persistedRef.current, [])

  useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        const raw = await personaDb.getPhoneKv(LUMI_MEET_KV_KEY)
        if (canceled) return
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const merged = migrateLumiMeetPersisted(raw)
          setState(merged)
          const v = (raw as { version?: unknown }).version
          if (v !== 4) {
            void personaDb.setPhoneKv(LUMI_MEET_KV_KEY, merged).catch(() => {})
          }
        }
      } catch {
        // ignore
      } finally {
        if (!canceled) setHydrated(true)
      }
    })()
    return () => {
      canceled = true
    }
  }, [])

  /** 首次 hydrate 后把遇见昵称与手机名片对齐（若用户未写过） */
  useEffect(() => {
    if (!hydrated) return
    const dn = phoneProfileHint?.displayName?.trim()
    if (!dn) return
    setState((s) => {
      if (s.meetProfile.displayName.trim()) return s
      const next = {
        ...s,
        meetProfile: { ...s.meetProfile, displayName: dn },
      }
      void personaDb.setPhoneKv(LUMI_MEET_KV_KEY, next).catch(() => {})
      return next
    })
  }, [hydrated, phoneProfileHint?.displayName])

  const persist = useCallback((next: LumiMeetPersistedState) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void personaDb.setPhoneKv(LUMI_MEET_KV_KEY, next).catch(() => {})
    }, 280)
  }, [])

  const patch = useCallback(
    (recipe: (draft: LumiMeetPersistedState) => LumiMeetPersistedState) => {
      setState((s) => {
        const next = recipe(s)
        persist(next)
        return next
      })
    },
    [persist],
  )

  const upsertNpc = useCallback(
    (npc: EncounterNPC) => {
      patch((s) => {
        const rest = s.npcs.filter((x) => x.id !== npc.id)
        return { ...s, npcs: [...rest, npc] }
      })
    },
    [patch],
  )

  const setMeetProfile = useCallback(
    (p: Partial<MeetPublicProfile>) => {
      patch((s) => ({ ...s, meetProfile: { ...s.meetProfile, ...p } }))
    },
    [patch],
  )

  const setRadarFilters = useCallback(
    (p: Partial<RadarFilters>) => {
      patch((s) => ({ ...s, radarFilters: { ...s.radarFilters, ...p } }))
    },
    [patch],
  )

  const appendSquarePosts = useCallback(
    (posts: Omit<SquarePost, 'id' | 'createdAt'>[]) => {
      const now = Date.now()
      patch((s) => ({
        ...s,
        squarePosts: [
          ...posts.map((p, i) => ({
            ...p,
            id: `sq-${now}-${i}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: now,
          })),
          ...s.squarePosts,
        ].slice(0, 120),
      }))
    },
    [patch],
  )

  const pushChatMessage = useCallback(
    (
      npcId: string,
      msg: {
        role: 'user' | 'npc'
        content: string
        kind?: MeetChatMessage['kind']
        swapCard?: MeetChatMessage['swapCard']
      },
    ) => {
      const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      patch((s) => {
        const prev = s.chatThreads[npcId] ?? []
        const row: MeetChatMessage = {
          id,
          role: msg.role,
          content: msg.content,
          ts: Date.now(),
          ...(msg.kind ? { kind: msg.kind } : {}),
          ...(msg.swapCard ? { swapCard: msg.swapCard } : {}),
        }
        return {
          ...s,
          chatThreads: {
            ...s.chatThreads,
            [npcId]: [...prev, row],
          },
        }
      })
    },
    [patch],
  )

  const removeChatMessage = useCallback(
    (npcId: string, messageId: string) => {
      patch((s) => {
        const prev = s.chatThreads[npcId] ?? []
        const next = prev.filter((m) => m.id !== messageId)
        if (next.length === prev.length) return s
        return {
          ...s,
          chatThreads: {
            ...s.chatThreads,
            [npcId]: next,
          },
        }
      })
    },
    [patch],
  )

  const bumpIntimacy = useCallback(
    (npcId: string, delta: number) => {
      patch((s) => {
        const prev = s.intimacyByNpcId[npcId] ?? 18
        const next = Math.max(0, Math.min(100, prev + delta))
        return { ...s, intimacyByNpcId: { ...s.intimacyByNpcId, [npcId]: next } }
      })
    },
    [patch],
  )

  const applyAffectionDelta = useCallback(
    (npcId: string, delta: number) => {
      patch((s) => {
        const prev = s.intimacyByNpcId[npcId] ?? 18
        const next = Math.max(0, Math.min(100, prev + delta))
        const swapPrev = s.encounterSwapByNpcId[npcId] ?? { wechatSwapStatus: 'none' as const, userWechatId: '' }
        let swapNext: EncounterSwapMeta = { ...swapPrev }
        if (prev < 100 && next >= 100 && swapNext.wechatSwapStatus === 'none') {
          swapNext = { ...swapNext, wechatSwapStatus: 'available' }
        }
        return {
          ...s,
          intimacyByNpcId: { ...s.intimacyByNpcId, [npcId]: next },
          encounterSwapByNpcId: { ...s.encounterSwapByNpcId, [npcId]: swapNext },
        }
      })
    },
    [patch],
  )

  const setEncounterIntimacy = useCallback(
    (npcId: string, value: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(Number(value))))
      patch((s) => {
        const prev = s.intimacyByNpcId[npcId] ?? 18
        const swapPrev = s.encounterSwapByNpcId[npcId] ?? { wechatSwapStatus: 'none' as const, userWechatId: '' }
        let swapNext: EncounterSwapMeta = { ...swapPrev }
        if (clamped >= 100 && prev < 100 && swapNext.wechatSwapStatus === 'none') {
          swapNext = { ...swapNext, wechatSwapStatus: 'available' }
        } else if (clamped < 100 && swapNext.wechatSwapStatus === 'available') {
          swapNext = { ...swapNext, wechatSwapStatus: 'none' }
        }
        return {
          ...s,
          intimacyByNpcId: { ...s.intimacyByNpcId, [npcId]: clamped },
          encounterSwapByNpcId: { ...s.encounterSwapByNpcId, [npcId]: swapNext },
        }
      })
    },
    [patch],
  )

  const patchEncounterSwap = useCallback(
    (npcId: string, partial: Partial<EncounterSwapMeta>) => {
      patch((s) => {
        const prev = s.encounterSwapByNpcId[npcId] ?? { wechatSwapStatus: 'none' as const, userWechatId: '' }
        return {
          ...s,
          encounterSwapByNpcId: {
            ...s.encounterSwapByNpcId,
            [npcId]: { ...prev, ...partial },
          },
        }
      })
    },
    [patch],
  )

  const markNpcWechatAdded = useCallback(
    (npcId: string) => {
      patch((s) => ({
        ...s,
        npcs: s.npcs.map((n) =>
          n.id === npcId ? { ...n, status: 'wechat_added' as const, lastEncounterTime: Date.now() } : n,
        ),
      }))
    },
    [patch],
  )

  const requestRadarSearch = useCallback(
    (executor: () => Promise<{ npc: EncounterNPC; isReunionEcho: boolean } | null>) => {
      if (radarSearchLockRef.current) return
      const r = radarRef.current
      if (r.pendingCard?.status === 'orbiting') return
      if (r.pendingReveal) return
      if (r.sparkInProgress) return

      radarSearchLockRef.current = true
      setRadarSession((prev) => ({
        ...prev,
        searchInProgress: true,
        pendingReveal: null,
        pendingCard: prev.pendingCard?.status === 'orbiting' ? prev.pendingCard : null,
        isReunionEcho: prev.pendingCard?.status === 'orbiting' ? prev.isReunionEcho : false,
      }))

      void (async () => {
        try {
          const started = Date.now()
          const out = await executor()
          const waitMore = MEET_RADAR_SEARCH_MIN_UI_MS - (Date.now() - started)
          if (waitMore > 0 && providerMountedRef.current) {
            await new Promise<void>((r) => window.setTimeout(r, waitMore))
          }
          if (!providerMountedRef.current) return
          if (out) {
            setRadarSession((prev) => ({
              ...prev,
              pendingReveal: { npc: out.npc, isReunionEcho: out.isReunionEcho },
            }))
          }
        } finally {
          radarSearchLockRef.current = false
          if (providerMountedRef.current) {
            setRadarSession((prev) => ({ ...prev, searchInProgress: false }))
          }
        }
      })()
    },
    [],
  )

  const flushRadarRevealToCard = useCallback(() => {
    setRadarSession((prev) => {
      if (!prev.pendingReveal) return prev
      return {
        ...prev,
        pendingCard: prev.pendingReveal.npc,
        isReunionEcho: prev.pendingReveal.isReunionEcho,
        pendingReveal: null,
      }
    })
  }, [])

  const dismissRadarPending = useCallback(() => {
    setRadarSession((prev) => ({
      ...prev,
      pendingReveal: null,
      pendingCard: null,
      isReunionEcho: false,
    }))
  }, [])

  const setRadarSparkInProgress = useCallback((v: boolean) => {
    setRadarSession((prev) => ({ ...prev, sparkInProgress: v }))
  }, [])

  const setRadarPendingCard = useCallback((npc: EncounterNPC | null, isReunionEcho?: boolean) => {
    setRadarSession((prev) => ({
      ...prev,
      pendingCard: npc,
      isReunionEcho: isReunionEcho ?? prev.isReunionEcho,
    }))
  }, [])

  const rewindMissedToMatched = useCallback(
    (npcId: string): boolean => {
      let ok = false
      patch((s) => {
        if (s.rewindChargesRemaining <= 0) return s
        const npc = s.npcs.find((n) => n.id === npcId && n.status === 'missed')
        if (!npc) return s
        ok = true
        const now = Date.now()
        return {
          ...s,
          rewindChargesRemaining: s.rewindChargesRemaining - 1,
          npcs: s.npcs.map((n) =>
            n.id === npcId ? { ...n, status: 'matched' as const, lastEncounterTime: now } : n,
          ),
        }
      })
      return ok
    },
    [patch],
  )

  const value = useMemo(
    () =>
      ({
        state,
        hydrated,
        patch,
        upsertNpc,
        setMeetProfile,
        setRadarFilters,
        appendSquarePosts,
        pushChatMessage,
        removeChatMessage,
        bumpIntimacy,
        applyAffectionDelta,
        setEncounterIntimacy,
        patchEncounterSwap,
        markNpcWechatAdded,
        rewindMissedToMatched,
        radarSession,
        requestRadarSearch,
        flushRadarRevealToCard,
        dismissRadarPending,
        setRadarSparkInProgress,
        setRadarPendingCard,
        getPersistedSnapshot,
      }) satisfies Ctx,
    [
      state,
      hydrated,
      patch,
      upsertNpc,
      setMeetProfile,
      setRadarFilters,
      appendSquarePosts,
      pushChatMessage,
      removeChatMessage,
      bumpIntimacy,
      applyAffectionDelta,
      setEncounterIntimacy,
      patchEncounterSwap,
      markNpcWechatAdded,
      rewindMissedToMatched,
      radarSession,
      requestRadarSearch,
      flushRadarRevealToCard,
      dismissRadarPending,
      setRadarSparkInProgress,
      setRadarPendingCard,
      getPersistedSnapshot,
    ],
  )

  return <MeetCtx.Provider value={value}>{children}</MeetCtx.Provider>
}

export function useLumiMeetStore(): Ctx {
  const ctx = useContext(MeetCtx)
  if (!ctx) throw new Error('useLumiMeetStore must be used within LumiMeetProvider')
  return ctx
}

/** 与策划文档一致的别名：宿命池 / IndexedDB 持久化 */
export function useEncounterStore(): Ctx {
  return useLumiMeetStore()
}
