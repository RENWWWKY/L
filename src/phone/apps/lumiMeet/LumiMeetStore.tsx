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
  DestinyArchiveCharMeta,
  EncounterMemory,
  EncounterNPC,
  EncounterSwapMeta,
  LumiMeetPersistedState,
  MeetChatMessage,
  MeetPublicProfile,
  RadarFilters,
  SquarePost,
} from './meetTypes'
import { migrateLumiMeetPersisted } from './meetMigrate'
import {
  clearMeetEncounterDataKeepingWechatAdded,
  purgeAllMeetEntriesFromLoreArchive,
  type ClearMeetEncounterDataResult,
} from './meetClearEncounterData'
import {
  buildDestinyArchiveCharMetaOnOutcome,
  deriveMatchTypeFromNpc,
  mergeNpcIntoDestinyArchive,
  normalizeDestinyArchiveCharMeta,
} from './meetDestinyArchive'
import { DEFAULT_MEET_STATE, LUMI_MEET_KV_KEY, MEET_RADAR_SEARCH_MIN_UI_MS } from './constants'
import { WECHAT_ACCOUNT_DEEP_ERASED_EVENT } from '../wechat/wechatAccountDeepErase'

/** 匹配 UI：存于 Provider 内存；搜寻结束后先入队 `pendingReveal`，丝缕动效揭幕后再写入 `pendingCard` */
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
  /**
   * 「我的档案」进入时：按离线整点小时为 secretAdmirers 累加 3–5，并推进 lastCheckTime 水位（未满 1 小时不加水位）。
   * 返回动画用快照与副本文案用的小时数。
   */
  tickMeetSecretAdmirers: () => { before: number; after: number; hoursElapsed: number }
  setRadarFilters: (p: Partial<RadarFilters>) => void
  appendSquarePosts: (posts: Omit<SquarePost, 'id' | 'createdAt'>[]) => void
  pushChatMessage: (
    npcId: string,
    msg: {
      role: 'user' | 'npc'
      content: string
      kind?: MeetChatMessage['kind']
      swapCard?: MeetChatMessage['swapCard']
      replyTo?: MeetChatMessage['replyTo']
      meetTruthMirrorCharRequest?: MeetChatMessage['meetTruthMirrorCharRequest']
      meetTruthMirrorUserResponse?: MeetChatMessage['meetTruthMirrorUserResponse']
      truthMirrorRecord?: MeetChatMessage['truthMirrorRecord']
    },
  ) => string
  /** 从临时会话移除一条消息（如长按撤回己方气泡） */
  removeChatMessage: (npcId: string, messageId: string) => void
  /** 将临时会话标为已读到当前最新消息（进入会话或新消息展示时调用） */
  markMeetInboxThreadRead: (npcId: string) => void
  bumpIntimacy: (npcId: string, delta: number) => void
  /** 临时会话：按模型判定增减好感（0–100） */
  applyAffectionDelta: (npcId: string, delta: number) => void
  /** 开发者 / 调试：直接设定好感 0–100 */
  setEncounterIntimacy: (npcId: string, value: number) => void
  /** 角色主动交换申请卡片：标记为已回应（不影响对方日后再次发起） */
  resolveMeetContractCharRequest: (npcId: string, messageId: string) => void
  /** 角色主动真心话邀约卡片：标记为已回应 */
  resolveMeetTruthMirrorCharRequest: (npcId: string, messageId: string) => void
  /** 临时会话界面高亮引导：标记为已完成 */
  markEncounterChatCoachCompleted: () => void
  /** 灵魂侧写界面高亮引导：标记为已完成 */
  markWorldbookShelfCoachCompleted: () => void
  /** 遇见 App 主界面新手引导：标记为已完成 */
  markMeetAppCoachCompleted: () => void
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
  /**
   * 重置遇见邂逅数据（等同重新打开寻觅），含已总结的 `[遇见]` 长期记忆；
   * 不删除微信通讯录人设、私聊记录与非遇见向记忆。
   */
  clearMeetEncounterDataKeepingWechatAdded: () => Promise<ClearMeetEncounterDataResult>
  /** 记录一次交汇结果（错过 / 一击即中 / 重逢），供邂逅记忆手札使用 */
  noteDestinyEncounterOutcome: (
    charId: string,
    outcome: 'miss' | 'resonated' | 'reconnected',
    opts?: { reunion?: boolean },
  ) => void
  upsertDestinyMemory: (memory: EncounterMemory) => void
  /** 将当前 NPC 列表同步进邂逅记忆存档 */
  syncDestinyArchiveFromNpcs: () => void
}

const MeetCtx = createContext<Ctx | null>(null)

function cloneDefault(): LumiMeetPersistedState {
  return JSON.parse(JSON.stringify(DEFAULT_MEET_STATE)) as LumiMeetPersistedState
}

export function LumiMeetProvider({ children }: { children: ReactNode }) {
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
  /** 防止 React StrictMode 或快速重挂载导致暗恋者被动增长双扣 */
  const lastAdmirerTickRef = useRef(0)

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
          if (v !== 5) {
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

  useEffect(() => {
    const onErased = () => {
      setState(DEFAULT_MEET_STATE)
      setRadarSession({
        searchInProgress: false,
        sparkInProgress: false,
        pendingReveal: null,
        pendingCard: null,
        isReunionEcho: false,
      })
      persistedRef.current = DEFAULT_MEET_STATE
    }
    window.addEventListener(WECHAT_ACCOUNT_DEEP_ERASED_EVENT, onErased)
    return () => window.removeEventListener(WECHAT_ACCOUNT_DEEP_ERASED_EVENT, onErased)
  }, [])

  /** 遇见人设只存角色 worldBooks；启动时清掉档案室里的遗留遇见条目 */
  useEffect(() => {
    if (!hydrated) return
    purgeAllMeetEntriesFromLoreArchive()
  }, [hydrated])

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

  const tickMeetSecretAdmirers = useCallback(() => {
    const nowMs = Date.now()
    if (nowMs - lastAdmirerTickRef.current < 520) {
      const mp = persistedRef.current.meetProfile
      const v = Math.max(0, Math.floor(Number(mp.secretAdmirers) || 0))
      return { before: v, after: v, hoursElapsed: 0 }
    }
    lastAdmirerTickRef.current = nowMs
    const snapshot = { before: 0, after: 0, hoursElapsed: 0 }
    patch((s) => {
      const mp = s.meetProfile
      const before = Math.max(0, Math.floor(Number(mp.secretAdmirers) || 0))
      const now = Date.now()
      const last =
        typeof mp.lastCheckTime === 'number' && Number.isFinite(mp.lastCheckTime) && mp.lastCheckTime > 0
          ? mp.lastCheckTime
          : now
      const hoursElapsed = Math.max(0, Math.floor((now - last) / 3600000))
      let add = 0
      for (let i = 0; i < hoursElapsed; i++) {
        add += 3 + Math.floor(Math.random() * 3)
      }
      const after = before + add
      const newLast = last + hoursElapsed * 3600000
      snapshot.before = before
      snapshot.after = after
      snapshot.hoursElapsed = hoursElapsed
      return { ...s, meetProfile: { ...mp, secretAdmirers: after, lastCheckTime: newLast } }
    })
    return snapshot
  }, [patch])

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
        musicShare?: MeetChatMessage['musicShare']
        echoReveal?: MeetChatMessage['echoReveal']
        truthMirrorRecord?: MeetChatMessage['truthMirrorRecord']
        meetContractStatus?: MeetChatMessage['meetContractStatus']
        meetContractCharRequest?: MeetChatMessage['meetContractCharRequest']
        meetTruthMirrorCharRequest?: MeetChatMessage['meetTruthMirrorCharRequest']
        meetTruthMirrorUserResponse?: MeetChatMessage['meetTruthMirrorUserResponse']
        replyTo?: MeetChatMessage['replyTo']
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
          ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
          ...(msg.kind ? { kind: msg.kind } : {}),
          ...(msg.swapCard ? { swapCard: msg.swapCard } : {}),
          ...(msg.musicShare ? { musicShare: msg.musicShare } : {}),
          ...(msg.echoReveal ? { echoReveal: msg.echoReveal } : {}),
          ...(msg.truthMirrorRecord ? { truthMirrorRecord: msg.truthMirrorRecord } : {}),
          ...(msg.meetContractStatus ? { meetContractStatus: msg.meetContractStatus } : {}),
          ...(msg.meetContractCharRequest ? { meetContractCharRequest: msg.meetContractCharRequest } : {}),
          ...(msg.meetTruthMirrorCharRequest
            ? { meetTruthMirrorCharRequest: msg.meetTruthMirrorCharRequest }
            : {}),
          ...(msg.meetTruthMirrorUserResponse
            ? { meetTruthMirrorUserResponse: msg.meetTruthMirrorUserResponse }
            : {}),
        }
        return {
          ...s,
          chatThreads: {
            ...s.chatThreads,
            [npcId]: [...prev, row],
          },
        }
      })
      return id
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

  const markMeetInboxThreadRead = useCallback(
    (npcId: string) => {
      patch((s) => {
        const thread = s.chatThreads[npcId] ?? []
        const prevRead = s.meetInboxLastReadTsByNpcId[npcId] ?? 0
        if (thread.length === 0) {
          if (prevRead > 0) return s
          const now = Date.now()
          return { ...s, meetInboxLastReadTsByNpcId: { ...s.meetInboxLastReadTsByNpcId, [npcId]: now } }
        }
        const maxMsgTs = Math.max(...thread.map((m) => m.ts))
        if (maxMsgTs <= prevRead) return s
        return {
          ...s,
          meetInboxLastReadTsByNpcId: { ...s.meetInboxLastReadTsByNpcId, [npcId]: maxMsgTs },
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
        return {
          ...s,
          intimacyByNpcId: { ...s.intimacyByNpcId, [npcId]: next },
        }
      })
    },
    [patch],
  )

  const resolveMeetContractCharRequest = useCallback(
    (npcId: string, messageId: string) => {
      patch((s) => {
        const prev = s.chatThreads[npcId] ?? []
        const next = prev.map((m) =>
          m.id === messageId && m.kind === 'meet_contract_char_request'
            ? { ...m, meetContractCharRequest: { ...m.meetContractCharRequest, resolved: true } }
            : m,
        )
        if (next === prev) return s
        return { ...s, chatThreads: { ...s.chatThreads, [npcId]: next } }
      })
    },
    [patch],
  )

  const resolveMeetTruthMirrorCharRequest = useCallback(
    (npcId: string, messageId: string) => {
      patch((s) => {
        const prev = s.chatThreads[npcId] ?? []
        const next = prev.map((m) =>
          m.id === messageId && m.kind === 'meet_truth_mirror_char_request'
            ? { ...m, meetTruthMirrorCharRequest: { ...m.meetTruthMirrorCharRequest, resolved: true } }
            : m,
        )
        if (next === prev) return s
        return { ...s, chatThreads: { ...s.chatThreads, [npcId]: next } }
      })
    },
    [patch],
  )

  const markEncounterChatCoachCompleted = useCallback(() => {
    patch((s) => ({ ...s, encounterChatCoachCompleted: true }))
  }, [patch])

  const markWorldbookShelfCoachCompleted = useCallback(() => {
    patch((s) => ({ ...s, worldbookShelfCoachCompleted: true }))
  }, [patch])

  const markMeetAppCoachCompleted = useCallback(() => {
    patch((s) => ({ ...s, meetAppCoachCompleted: true }))
  }, [patch])

  const setEncounterIntimacy = useCallback(
    (npcId: string, value: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(Number(value))))
      patch((s) => {
        const swapPrev = s.encounterSwapByNpcId[npcId] ?? { wechatSwapStatus: 'none' as const, userWechatId: '' }
        const swapNext: EncounterSwapMeta = { ...swapPrev }
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

  const noteDestinyEncounterOutcome = useCallback(
    (charId: string, outcome: 'miss' | 'resonated' | 'reconnected', opts?: { reunion?: boolean }) => {
      const cid = charId.trim()
      if (!cid) return
      patch((s) => {
        const npc = s.npcs.find((n) => n.id === cid)
        const prevMeta = s.destinyArchiveMetaByCharId?.[cid]
        const nextMeta = buildDestinyArchiveCharMetaOnOutcome(prevMeta, outcome, opts)
        const metaMap = { ...(s.destinyArchiveMetaByCharId ?? {}), [cid]: nextMeta }
        let archive = [...(s.destinyArchive ?? [])]
        if (npc) {
          const mergedRows = mergeNpcIntoDestinyArchive(archive, metaMap, [npc])
          const row = mergedRows[0]
          if (row) {
            const matchType = deriveMatchTypeFromNpc(npc.status, nextMeta)
            const idx = archive.findIndex((a) => a.charId === cid)
            const nextRow: EncounterMemory = {
              ...row,
              matchType,
              timestamp: Math.max(npc.lastEncounterTime, row.timestamp),
              customMemo: idx >= 0 ? archive[idx]?.customMemo : row.customMemo,
              aiSummary: idx >= 0 ? archive[idx]?.aiSummary ?? row.aiSummary : row.aiSummary,
            }
            if (idx >= 0) archive[idx] = nextRow
            else archive = [nextRow, ...archive]
          }
        }
        return {
          ...s,
          version: 5,
          destinyArchiveMetaByCharId: metaMap,
          destinyArchive: archive,
        }
      })
    },
    [patch],
  )

  const upsertDestinyMemory = useCallback(
    (memory: EncounterMemory) => {
      const id = memory.id.trim()
      if (!id) return
      patch((s) => {
        const rest = (s.destinyArchive ?? []).filter((m) => m.id !== id && m.charId !== memory.charId)
        return {
          ...s,
          version: 5,
          destinyArchive: [{ ...memory, id }, ...rest].sort((a, b) => b.timestamp - a.timestamp),
        }
      })
    },
    [patch],
  )

  const syncDestinyArchiveFromNpcs = useCallback(() => {
    patch((s) => {
      const rawMeta = s.destinyArchiveMetaByCharId ?? {}
      const metaMap: Record<string, DestinyArchiveCharMeta> = {}
      for (const [cid, meta] of Object.entries(rawMeta)) {
        const norm = normalizeDestinyArchiveCharMeta(meta)
        if (norm) metaMap[cid] = norm
      }
      return {
        ...s,
        version: 5,
        destinyArchiveMetaByCharId: metaMap,
        destinyArchive: mergeNpcIntoDestinyArchive(s.destinyArchive ?? [], metaMap, s.npcs),
      }
    })
  }, [patch])

  const clearMeetEncounterDataKeepingWechatAddedFn = useCallback(async (): Promise<ClearMeetEncounterDataResult> => {
    const { next, result } = await clearMeetEncounterDataKeepingWechatAdded(persistedRef.current)
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    setState(next)
    void personaDb.setPhoneKv(LUMI_MEET_KV_KEY, next).catch(() => {})
    radarSearchLockRef.current = false
    setRadarSession({
      searchInProgress: false,
      sparkInProgress: false,
      pendingReveal: null,
      pendingCard: null,
      isReunionEcho: false,
    })
    return result
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
        const nextMeta = buildDestinyArchiveCharMetaOnOutcome(
          s.destinyArchiveMetaByCharId?.[npcId],
          'reconnected',
          { reunion: true },
        )
        const metaMap = { ...(s.destinyArchiveMetaByCharId ?? {}), [npcId]: nextMeta }
        const updatedNpc = { ...npc, status: 'matched' as const, lastEncounterTime: now }
        const archive = mergeNpcIntoDestinyArchive(s.destinyArchive ?? [], metaMap, [updatedNpc])
        return {
          ...s,
          version: 5,
          rewindChargesRemaining: s.rewindChargesRemaining - 1,
          npcs: s.npcs.map((n) => (n.id === npcId ? updatedNpc : n)),
          destinyArchiveMetaByCharId: metaMap,
          destinyArchive: archive,
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
        tickMeetSecretAdmirers,
        setRadarFilters,
        appendSquarePosts,
        pushChatMessage,
        removeChatMessage,
        markMeetInboxThreadRead,
        bumpIntimacy,
        applyAffectionDelta,
        setEncounterIntimacy,
        resolveMeetContractCharRequest,
        resolveMeetTruthMirrorCharRequest,
        markEncounterChatCoachCompleted,
        markWorldbookShelfCoachCompleted,
        markMeetAppCoachCompleted,
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
        clearMeetEncounterDataKeepingWechatAdded: clearMeetEncounterDataKeepingWechatAddedFn,
        noteDestinyEncounterOutcome,
        upsertDestinyMemory,
        syncDestinyArchiveFromNpcs,
      }) satisfies Ctx,
    [
      state,
      hydrated,
      patch,
      upsertNpc,
      setMeetProfile,
      tickMeetSecretAdmirers,
      setRadarFilters,
      appendSquarePosts,
      pushChatMessage,
      removeChatMessage,
      markMeetInboxThreadRead,
      bumpIntimacy,
      applyAffectionDelta,
      setEncounterIntimacy,
      resolveMeetContractCharRequest,
      resolveMeetTruthMirrorCharRequest,
      markEncounterChatCoachCompleted,
      markWorldbookShelfCoachCompleted,
      markMeetAppCoachCompleted,
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
      clearMeetEncounterDataKeepingWechatAddedFn,
      noteDestinyEncounterOutcome,
      upsertDestinyMemory,
      syncDestinyArchiveFromNpcs,
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

/** 策划文档别名：与 `useLumiMeetStore` 同源 */
export const useMeetStore = useLumiMeetStore
