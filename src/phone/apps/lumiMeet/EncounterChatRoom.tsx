import { AnimatePresence, motion } from 'framer-motion'
import { BookMarked, Code2, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { useCustomization } from '../../CustomizationContext'
import { Pressable } from '../../components/Pressable'
import { WeChatMessageBubbleRow } from '../wechat/WeChatMessageBubbleRow'
import {
  WeChatMessageActionPanel,
  type PanelAnchor,
  type WeChatMessageActionId,
} from '../wechat/WeChatMessageActionPanel'
import { aiMeetChatReply } from './lumiMeetAi'
import { MeetWorldbookShelfModal } from './MeetWorldbookShelfModal'
import { syncMeetEpilogueAfterContactsAdded } from './meetEpilogueAfterContactsSync'
import { syncMeetDossierToWorldbookLore } from './meetPersonaWorldbookSync'
import { upsertMeetNpcAsCharacter } from './syncMeetNpcToWechat'
import type { EncounterNPC, MeetChatMessage, WechatSwapStatus } from './meetTypes'
import { useLumiMeetStore } from './LumiMeetStore'
import { computeMeetNpcStaggerDelayMs, sleep, yieldToPaint } from './lumiMeetChatReveal'
import { AffectionMeter } from './AffectionMeter'
import { EncounterWeChatSwapCard } from './EncounterWeChatSwapCard'
import type { MeetReplyEvaluation } from './meetEvaluationParse'

/** 与微信私聊输入栏一致：短窗口内第二次回车 = 带对方回复；超时单次回车 = 仅发己方气泡 */
const ENTER_DOUBLE_TAP_MS = 220
const ENTER_SINGLE_COMMIT_DELAY_MS = 80

const SWAP_DEV_OPTIONS: { value: WechatSwapStatus; zh: string }[] = [
  { value: 'none', zh: '无（未解锁互换）' },
  { value: 'available', zh: '可发起申请（好感达阈）' },
  { value: 'char_requested', zh: '对方已提议交换' },
  { value: 'user_requested', zh: '用户已发起（催更可跑结业）' },
  { value: 'swapped', zh: '已互换（仅状态，不触发同步）' },
]

function SendPlaneIcon({ color }: { color: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}

function extractWechatId(text: string): string | null {
  const m = /(?:微信号|微信|加我)[：:\s]*([A-Za-z][A-Za-z0-9_]{3,19})/.exec(text)
  const id = (m?.[1] ?? '').trim()
  return /^[A-Za-z0-9_]{4,20}$/.test(id) ? id : null
}

export function EncounterChatRoom({ npc, onBack }: { npc: EncounterNPC; onBack: () => void }) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const {
    replaceWeChatPersonaContacts,
    themeStyle,
    wechatThemeStyle,
    state: phoneUi,
  } = useCustomization()
  const bubbleTheme = phoneUi.wechatTheme.bubbleGlobal
  const playerAvatarUrl = phoneUi.profile.avatarImageUrl?.trim() ?? ''

  const {
    state: meetPersist,
    pushChatMessage,
    applyAffectionDelta,
    patchEncounterSwap,
    upsertNpc,
    markNpcWechatAdded,
    getPersistedSnapshot,
    setEncounterIntimacy,
    removeChatMessage,
  } = useLumiMeetStore()
  const profile = meetPersist.meetProfile
  const messages = useMemo(
    () => meetPersist.chatThreads[npc.id] ?? [],
    [npc.id, meetPersist.chatThreads],
  )
  const intimacy = meetPersist.intimacyByNpcId[npc.id] ?? 18
  const swapMeta = meetPersist.encounterSwapByNpcId[npc.id] ?? {
    wechatSwapStatus: 'none' as const,
    userWechatId: '',
  }

  const [userWxDraft, setUserWxDraft] = useState(swapMeta.userWechatId)
  const [resonanceFlashKey, setResonanceFlashKey] = useState(0)

  const [draft, setDraft] = useState('')
  const draftRef = useRef(draft)
  draftRef.current = draft
  const [loading, setLoading] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [worldbookOpen, setWorldbookOpen] = useState(false)
  const [devPanelOpen, setDevPanelOpen] = useState(false)
  const [devIntDraft, setDevIntDraft] = useState(18)
  const [meetActionPanelOpen, setMeetActionPanelOpen] = useState(false)
  const [meetActionAnchor, setMeetActionAnchor] = useState<PanelAnchor | null>(null)
  const [meetActionTarget, setMeetActionTarget] = useState<{
    id: string
    isSelf: boolean
    text: string
  } | null>(null)
  const [meetActionCanRecall, setMeetActionCanRecall] = useState(false)
  const [epilogueContactsNoticeOpen, setEpilogueContactsNoticeOpen] = useState(false)
  const [contactSyncOverlay, setContactSyncOverlay] = useState<null | { phase: 'epilogue' | 'contacts' }>(null)
  const [quoteTarget, setQuoteTarget] = useState<{ role: 'user' | 'npc'; text: string } | null>(null)
  const [loreToast, setLoreToast] = useState<string | null>(null)
  const loreToastTimerRef = useRef<number | null>(null)

  const enterDebounceTimerRef = useRef<number | null>(null)
  const lastEnterDownRef = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!devPanelOpen) return
    setDevIntDraft(intimacy)
  }, [devPanelOpen, intimacy])

  useEffect(() => {
    setUserWxDraft(swapMeta.userWechatId)
  }, [swapMeta.userWechatId])

  useEffect(() => {
    return () => {
      if (loreToastTimerRef.current != null) window.clearTimeout(loreToastTimerRef.current)
    }
  }, [])

  const showLoreToast = useCallback((msg: string) => {
    if (loreToastTimerRef.current != null) window.clearTimeout(loreToastTimerRef.current)
    setLoreToast(msg)
    loreToastTimerRef.current = window.setTimeout(() => {
      loreToastTimerRef.current = null
      setLoreToast(null)
    }, 3600)
  }, [])

  const closeMeetActionPanel = useCallback(() => {
    setMeetActionPanelOpen(false)
    setMeetActionAnchor(null)
    setMeetActionTarget(null)
    setMeetActionCanRecall(false)
  }, [])

  const openMeetActionPanelFor = useCallback(
    (m: MeetChatMessage, anchorRect: DOMRect) => {
      const raw = m.content.replace(/\u200b/g, '').trim()
      if (!raw) return
      const isSelf = m.role === 'user'
      const last = messages[messages.length - 1]
      const canRecall = !!(isSelf && last?.id === m.id && last.role === 'user')
      setMeetActionTarget({ id: m.id, isSelf, text: m.content })
      setMeetActionCanRecall(canRecall)
      setMeetActionAnchor({ rect: anchorRect, preferBelow: anchorRect.top < 100 })
      setMeetActionPanelOpen(true)
    },
    [messages],
  )

  const meetPanelActionIds = useMemo((): WeChatMessageActionId[] => {
    const ids: WeChatMessageActionId[] = ['quote', 'copy']
    if (meetActionTarget?.isSelf && meetActionCanRecall) ids.push('recall')
    return ids
  }, [meetActionTarget?.isSelf, meetActionCanRecall])

  const onMeetPanelAction = useCallback(
    (id: WeChatMessageActionId) => {
      const t = meetActionTarget
      if (!t) {
        closeMeetActionPanel()
        return
      }
      if (id === 'copy') {
        void (async () => {
          try {
            await navigator.clipboard.writeText(t.text)
            showLoreToast('已复制')
          } catch {
            showLoreToast('复制失败')
          } finally {
            closeMeetActionPanel()
          }
        })()
        return
      }
      if (id === 'quote') {
        setQuoteTarget({ role: t.isSelf ? 'user' : 'npc', text: t.text })
        closeMeetActionPanel()
        return
      }
      if (id === 'recall') {
        if (meetActionCanRecall && t.isSelf) {
          removeChatMessage(npc.id, t.id)
          showLoreToast('已撤回')
        }
        closeMeetActionPanel()
        return
      }
      closeMeetActionPanel()
    },
    [closeMeetActionPanel, meetActionCanRecall, meetActionTarget, npc.id, removeChatMessage, showLoreToast],
  )

  const refocusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus({ preventScroll: true })
      const len = ta.value.length
      try {
        ta.setSelectionRange(len, len)
      } catch {
        /* ignore */
      }
    })
  }, [])

  const wxFromChat = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m?.role !== 'npc') continue
      const id = extractWechatId(m.content)
      if (id) return id
    }
    return null
  }, [messages])

  const resolvedWx = npc.wechatId || wxFromChat

  const mergeEvaluationIntoSwap = useCallback(
    (evaluation: MeetReplyEvaluation | null) => {
      if (!evaluation) return
      if (evaluation.swapInstruction?.trim()) {
        patchEncounterSwap(npc.id, { pendingSwapNote: evaluation.swapInstruction.trim() })
      }
      if (evaluation.proactiveSwap) {
        const cur = getPersistedSnapshot().encounterSwapByNpcId[npc.id]?.wechatSwapStatus ?? 'none'
        if (cur !== 'swapped' && cur !== 'user_requested') {
          patchEncounterSwap(npc.id, { wechatSwapStatus: 'char_requested' })
        }
      }
    },
    [getPersistedSnapshot, npc.id, patchEncounterSwap],
  )

  const finalizeSwapCeremony = useCallback(
    async (npcReplyLines: string[]) => {
      const snap0 = getPersistedSnapshot()
      if (snap0.encounterSwapByNpcId[npc.id]?.wechatSwapStatus === 'swapped') return

      const wxChar = (npc.wechatId || resolvedWx || '').trim()
      const wxUser = snap0.encounterSwapByNpcId[npc.id]?.userWechatId?.trim() ?? ''
      if (!wxChar || !wxUser || npc.status === 'wechat_added') return

      const swapNote =
        snap0.encounterSwapByNpcId[npc.id]?.pendingSwapNote?.trim() ||
        npcReplyLines.filter(Boolean).slice(-1)[0]?.trim() ||
        '来微信找我。'

      pushChatMessage(npc.id, {
        role: 'npc',
        content: '\u200b',
        kind: 'wechat_swap_card',
        swapCard: {
          charWechatId: wxChar,
          userWechatId: wxUser,
          note: swapNote.slice(0, 280),
        },
      })

      patchEncounterSwap(npc.id, { wechatSwapStatus: 'swapped' })

      const transcriptForLore = (getPersistedSnapshot().chatThreads[npc.id] ?? [])
        .filter((m) => m.kind !== 'wechat_swap_card')
        .map((m) => ({ role: m.role, content: m.content }))

      setSyncError(null)
      setContactSyncOverlay({ phase: 'epilogue' })
      try {
        await syncMeetEpilogueAfterContactsAdded({
          apiConfig,
          npc: { ...npc, wechatId: wxChar },
          userProfile: profile,
          transcript: transcriptForLore,
        })

        setContactSyncOverlay({ phase: 'contacts' })
        await upsertMeetNpcAsCharacter({ ...npc, wechatId: wxChar }, wxChar)
        replaceWeChatPersonaContacts([npc.id], [
          {
            id: `persona-${npc.id}`,
            characterId: npc.id,
            remarkName: npc.nickname,
            avatarUrl: npc.avatarUrl,
          },
        ])
        markNpcWechatAdded(npc.id)
        upsertNpc({ ...npc, status: 'wechat_added', wechatId: wxChar })

        if (npc.comprehensivePersona) {
          syncMeetDossierToWorldbookLore(npc.id, npc.nickname, npc.comprehensivePersona)
        }

        setContactSyncOverlay(null)
        setEpilogueContactsNoticeOpen(true)
        if (npc.comprehensivePersona) {
          showLoreToast('核心人设档案已同步。')
        }
      } catch (e) {
        setContactSyncOverlay(null)
        setSyncError(e instanceof Error ? e.message : '同步失败')
      }
    },
    [
      apiConfig,
      getPersistedSnapshot,
      markNpcWechatAdded,
      npc,
      patchEncounterSwap,
      profile,
      pushChatMessage,
      replaceWeChatPersonaContacts,
      resolvedWx,
      showLoreToast,
      upsertNpc,
    ],
  )

  const dispatchNpcTurn = useCallback(
    async (
      transcript: Array<{ role: 'user' | 'npc'; content: string }>,
      swapStatusBefore: string,
    ) => {
      const encounterSwapStatus =
        getPersistedSnapshot().encounterSwapByNpcId[npc.id]?.wechatSwapStatus ?? 'none'
      const resonanceScore = getPersistedSnapshot().intimacyByNpcId[npc.id] ?? 18
      const { replies, evaluation } = await aiMeetChatReply({
        apiConfig,
        npc,
        userProfile: profile,
        transcript,
        encounterSwapStatus,
        resonanceScore,
      })

      if (evaluation != null) {
        applyAffectionDelta(npc.id, evaluation.affectionChange)
        if (evaluation.affectionChange !== 0) setResonanceFlashKey((k) => k + 1)
        mergeEvaluationIntoSwap(evaluation)
      }

      for (let i = 0; i < replies.length; i++) {
        if (i > 0) await sleep(computeMeetNpcStaggerDelayMs(replies[i - 1]!))
        else if (replies.length > 1) await sleep(260)
        pushChatMessage(npc.id, { role: 'npc', content: replies[i]! })
        await yieldToPaint()
      }

      if (swapStatusBefore === 'user_requested' && replies.length > 0) {
        await finalizeSwapCeremony(replies)
      }
    },
    [
      apiConfig,
      applyAffectionDelta,
      finalizeSwapCeremony,
      getPersistedSnapshot,
      mergeEvaluationIntoSwap,
      npc.id,
      profile,
      pushChatMessage,
    ],
  )

  const injectWechat = useCallback(async () => {
    const wx = resolvedWx?.trim()
    if (!wx || npc.status === 'wechat_added') return
    setSyncError(null)
    const transcriptForLore = (getPersistedSnapshot().chatThreads[npc.id] ?? [])
      .filter((m) => m.kind !== 'wechat_swap_card')
      .map((m) => ({ role: m.role, content: m.content }))

    setContactSyncOverlay({ phase: 'epilogue' })
    try {
      await syncMeetEpilogueAfterContactsAdded({
        apiConfig,
        npc: { ...npc, wechatId: wx },
        userProfile: profile,
        transcript: transcriptForLore,
      })

      setContactSyncOverlay({ phase: 'contacts' })
      await upsertMeetNpcAsCharacter({ ...npc, wechatId: wx }, wx)
      replaceWeChatPersonaContacts([npc.id], [
        {
          id: `persona-${npc.id}`,
          characterId: npc.id,
          remarkName: npc.nickname,
          avatarUrl: npc.avatarUrl,
        },
      ])
      markNpcWechatAdded(npc.id)
      upsertNpc({ ...npc, status: 'wechat_added', wechatId: wx })
      if (npc.comprehensivePersona) {
        syncMeetDossierToWorldbookLore(npc.id, npc.nickname, npc.comprehensivePersona)
      }

      setContactSyncOverlay(null)
      setEpilogueContactsNoticeOpen(true)
      if (npc.comprehensivePersona) {
        showLoreToast('核心人设档案已写入世界书法则。')
      }
    } catch (e) {
      setContactSyncOverlay(null)
      setSyncError(e instanceof Error ? e.message : '同步失败')
    }
  }, [
    apiConfig,
    getPersistedSnapshot,
    markNpcWechatAdded,
    npc,
    profile,
    replaceWeChatPersonaContacts,
    resolvedWx,
    showLoreToast,
    upsertNpc,
  ])

  const canTrySync =
    npc.status !== 'wechat_added' &&
    !!resolvedWx &&
    (intimacy >= 48 || !!wxFromChat) &&
    swapMeta.wechatSwapStatus !== 'swapped'

  /** 仅根据当前会话拉取 NPC 回复，不追加新的用户气泡（用于已发过话、草稿为空时点纸飞机 / 回车催更） */
  const requestNpcReplyOnly = useCallback(async () => {
    if (loading) return
    const swapStatusBefore = getPersistedSnapshot().encounterSwapByNpcId[npc.id]?.wechatSwapStatus ?? 'none'
    const last = messages[messages.length - 1]
    if (!last) return
    if (last.role !== 'user' && swapStatusBefore !== 'user_requested') return

    if (enterDebounceTimerRef.current != null) {
      window.clearTimeout(enterDebounceTimerRef.current)
      enterDebounceTimerRef.current = null
    }
    lastEnterDownRef.current = 0

    setLoading(true)
    try {
      const transcript = messages.map((m) => ({ role: m.role, content: m.content }))
      await dispatchNpcTurn(transcript, swapStatusBefore)
    } finally {
      setLoading(false)
      refocusComposer()
    }
  }, [
    dispatchNpcTurn,
    getPersistedSnapshot,
    loading,
    messages,
    npc.id,
    refocusComposer,
  ])

  const onSwapCeremonyRequest = useCallback(() => {
    const wx = userWxDraft.trim()
    if (wx.length < 4) {
      setSyncError('请先填写有效微信号')
      return
    }
    setSyncError(null)
    patchEncounterSwap(npc.id, { userWechatId: wx, wechatSwapStatus: 'user_requested' })
    window.setTimeout(() => {
      void requestNpcReplyOnly()
    }, 0)
  }, [npc.id, patchEncounterSwap, requestNpcReplyOnly, userWxDraft])

  const canRequestReplyWithoutDraft =
    !loading &&
    messages.length > 0 &&
    (messages[messages.length - 1]?.role === 'user' ||
      swapMeta.wechatSwapStatus === 'user_requested')

  const commitSend = useCallback(
    async (raw: string, triggerAi: boolean) => {
      const text = raw.trim()
      if (!text || loading) return

      if (enterDebounceTimerRef.current != null) {
        window.clearTimeout(enterDebounceTimerRef.current)
        enterDebounceTimerRef.current = null
      }
      lastEnterDownRef.current = 0

      const swapStatusBefore =
        getPersistedSnapshot().encounterSwapByNpcId[npc.id]?.wechatSwapStatus ?? 'none'

      let body = text
      if (quoteTarget) {
        const flat = quoteTarget.text.replace(/\s+/g, ' ').trim()
        const excerpt = flat.slice(0, 300)
        const ell = flat.length > 300 ? '…' : ''
        body = `【引用${quoteTarget.role === 'npc' ? '对方' : '自己'}】${excerpt}${ell}\n\n${text}`
        setQuoteTarget(null)
      }

      setDraft('')
      pushChatMessage(npc.id, { role: 'user', content: body })

      if (!triggerAi) {
        refocusComposer()
        return
      }

      setLoading(true)
      try {
        const base = messages.map((m) => ({ role: m.role, content: m.content }))
        const nextTranscript = [...base, { role: 'user' as const, content: body }]
        await dispatchNpcTurn(nextTranscript, swapStatusBefore)
      } finally {
        setLoading(false)
        refocusComposer()
      }
    },
    [
      dispatchNpcTurn,
      getPersistedSnapshot,
      loading,
      messages,
      npc.id,
      pushChatMessage,
      quoteTarget,
      refocusComposer,
    ],
  )

  const onComposerKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== 'Enter' || e.shiftKey) return
      const ne = e.nativeEvent
      if (ne.isComposing) return
      e.preventDefault()
      if (loading) return
      const text = draftRef.current.trim()
      if (!text) {
        if (canRequestReplyWithoutDraft) {
          void requestNpcReplyOnly()
        }
        return
      }

      const now = Date.now()
      if (now - lastEnterDownRef.current <= ENTER_DOUBLE_TAP_MS) {
        if (enterDebounceTimerRef.current != null) {
          window.clearTimeout(enterDebounceTimerRef.current)
          enterDebounceTimerRef.current = null
        }
        lastEnterDownRef.current = 0
        void commitSend(text, true)
        return
      }

      lastEnterDownRef.current = now
      if (enterDebounceTimerRef.current != null) window.clearTimeout(enterDebounceTimerRef.current)
      enterDebounceTimerRef.current = window.setTimeout(() => {
        enterDebounceTimerRef.current = null
        lastEnterDownRef.current = 0
        const t = draftRef.current.trim()
        if (t && !loading) void commitSend(t, false)
      }, ENTER_SINGLE_COMMIT_DELAY_MS)
    },
    [canRequestReplyWithoutDraft, commitSend, loading, requestNpcReplyOnly],
  )

  useLayoutEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = '0px'
    const next = Math.min(120, Math.max(44, ta.scrollHeight))
    ta.style.height = `${next}px`
  }, [draft])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, loading])

  const onSendButtonClick = useCallback(() => {
    if (loading) return
    if (enterDebounceTimerRef.current != null) {
      window.clearTimeout(enterDebounceTimerRef.current)
      enterDebounceTimerRef.current = null
    }
    lastEnterDownRef.current = 0
    const t = draft.trim()
    if (t) {
      void commitSend(t, true)
      return
    }
    if (canRequestReplyWithoutDraft) {
      void requestNpcReplyOnly()
    }
  }, [canRequestReplyWithoutDraft, commitSend, draft, loading, requestNpcReplyOnly])

  const planeEnabled = !loading && (!!draft.trim() || canRequestReplyWithoutDraft)
  const planeColor = planeEnabled ? 'var(--wx-primary)' : 'var(--wx-text-muted)'

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{
        ...wechatThemeStyle,
        ...themeStyle,
        fontFamily: 'var(--phone-font)',
        fontSize: 'var(--wx-font-size)',
        color: 'var(--wx-text)',
        background: 'var(--wx-bg)',
      }}
    >
      {/* 与 WeChatApp Header 一致：安全区 + 底栏分隔 */}
      <header
        className="flex shrink-0 items-center justify-between gap-2 border-b px-3 pb-2"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
          borderColor: 'var(--wx-border)',
          background: 'var(--wx-surface)',
        }}
      >
        <div className="flex w-10 shrink-0 items-center justify-start">
          <Pressable
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: 'var(--wx-text)' }}
            aria-label="返回"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Pressable>
        </div>
        <div className="min-w-0 flex-1 px-1">
          <h1
            className="truncate text-center text-[16px] font-medium leading-tight"
            style={{ color: 'var(--wx-text)' }}
          >
            {npc.nickname}
          </h1>
        </div>
        <div className="flex w-10 shrink-0 items-center justify-end">
          <Pressable
            onClick={() => setDevPanelOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: 'var(--wx-text-muted)' }}
            aria-label="开发者调试"
            title="开发者"
          >
            <Code2 className="size-[18px]" strokeWidth={1.75} aria-hidden />
          </Pressable>
        </div>
      </header>

      <div
        className="shrink-0 border-b px-3 py-2"
        style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}
      >
        <AffectionMeter value={intimacy} flashKey={resonanceFlashKey} />
        <p className="mt-2 text-[10px] leading-snug text-gray-500">
          临时会话：模型会参考当前<span className="text-gray-600">情感共鸣刻度（0–100）</span>
          与最近对话调节语气；刻度仍主要由对方回复中的判定增减；达阈后可发起联络互换仪式。
        </p>
        {canTrySync ? (
          <Pressable
            onClick={() => void injectWechat()}
            className="mt-2 w-full rounded-[10px] border border-gray-200 py-2 text-[12px] text-[#3d3a34]"
            style={{
              background: 'color-mix(in oklab, white 92%, transparent)',
            }}
          >
            手动同步到微信通讯录 · {resolvedWx}
          </Pressable>
        ) : null}
        {npc.comprehensivePersona ? (
          <Pressable
            onClick={() => setWorldbookOpen(true)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-[10px] border border-[#D4AF37]/35 py-2 text-[12px] text-[#3d3a34]"
            style={{
              background: 'color-mix(in oklab, var(--wx-surface) 95%, transparent)',
            }}
          >
            <BookMarked className="size-3.5 opacity-70" strokeWidth={1.25} />
            世界书 · 分册与条目
          </Pressable>
        ) : null}
        {syncError ? <p className="mt-1 text-[11px] text-red-600/90">{syncError}</p> : null}
      </div>

      <div
        ref={scrollRef}
        className="meet-scrollbar relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden py-4 pl-0 pr-0 [-webkit-overflow-scrolling:touch]"
      >
        {messages.map((m, i) => {
          if (m.kind === 'wechat_swap_card' && m.swapCard) {
            return <EncounterWeChatSwapCard key={m.id} payload={m.swapCard} />
          }
          const prev = i > 0 ? messages[i - 1] : undefined
          const merge = bubbleTheme.mergeConsecutiveAvatarGroup
          const sameRun = prev && prev.role === m.role
          const showAvatarColumn = !merge || !sameRun
          return (
            <WeChatMessageBubbleRow
              key={m.id}
              messageText={m.content}
              isSelf={m.role === 'user'}
              bubble={bubbleTheme}
              showAvatar={bubbleTheme.showAvatar}
              showBubbleTail={bubbleTheme.showBubbleTail}
              variant="chat"
              showAvatarColumn={showAvatarColumn}
              chatSelfAvatarUrl={playerAvatarUrl}
              chatOtherAvatarUrl={npc.avatarUrl}
              bubbleSelected={meetActionPanelOpen && meetActionTarget?.id === m.id}
              onBubbleLongPress={(rect) => openMeetActionPanelFor(m, rect)}
            />
          )
        })}
        {loading ? (
          <div
            className="mt-1 flex w-full max-w-full shrink-0 justify-start overflow-x-hidden pl-[24px] pr-[24px]"
            aria-live="polite"
            aria-label="对方正在输入"
          >
            <div className="flex max-w-full flex-row items-end gap-3">
              {bubbleTheme.showAvatar ? (
                <img
                  src={npc.avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 object-cover"
                  style={{
                    borderRadius: `${bubbleTheme.avatarRadiusPx}px`,
                    border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
                  }}
                  aria-hidden
                />
              ) : null}
              <div
                className="inline-flex items-center gap-[3px] rounded-lg bg-[#ededed] px-3 py-2"
                style={{ minHeight: 40 }}
                aria-hidden
              >
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="inline-block h-1.5 w-1.5 rounded-full bg-[#8e8e8e]"
                    style={{
                      animation: 'meetTypingDot 1.05s ease-in-out infinite',
                      animationDelay: `${dot * 0.18}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
        <style>{`@keyframes meetTypingDot { 0%, 80%, 100% { transform: translateY(0); opacity: 0.35; } 40% { transform: translateY(-4px); opacity: 1; } }`}</style>
      </div>

      {/* 与 ChatRoom 底栏一致：上内边距 + 底部安全区 */}
      <div
        className="relative z-10 w-full max-w-full shrink-0 border-t"
        style={{
          backgroundColor: 'var(--wx-input-bg)',
          borderTopColor: 'var(--wx-border)',
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 12,
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {((intimacy >= 100 && swapMeta.wechatSwapStatus === 'available') ||
          swapMeta.wechatSwapStatus === 'char_requested') &&
        npc.status !== 'wechat_added' ? (
          <div className="mb-3 rounded-full border border-[#D4AF37]/30 bg-white/90 px-3 py-2 shadow-[0_8px_32px_rgba(28,24,18,0.05)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-[10px] leading-snug text-gray-500">
                [ System ]{' '}
                {swapMeta.wechatSwapStatus === 'char_requested'
                  ? '对方提议交换联络方式，可确认你的微信号并衔接回复。'
                  : '情感共鸣已达阈值，可申请交换联络方式。'}
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => onSwapCeremonyRequest()}
                className="shrink-0 rounded-full border border-[#D4AF37]/50 px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-[#6b6459] disabled:opacity-40"
                style={{ background: 'color-mix(in oklab, white 96%, transparent)' }}
              >
                发起申请 · Request
              </button>
            </div>
            <input
              type="text"
              value={userWxDraft}
              onChange={(e) => {
                const v = e.target.value.trimStart()
                setUserWxDraft(v)
                patchEncounterSwap(npc.id, { userWechatId: v })
              }}
              placeholder="Your WeChat ID"
              disabled={loading}
              className="mt-2 w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 font-mono text-[11px] text-[#3d3a34] outline-none placeholder:text-gray-400 disabled:opacity-50"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
        ) : null}
        {quoteTarget ? (
          <div className="mb-2 flex items-start gap-2 rounded-[12px] border border-[#D4AF37]/25 bg-white/95 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#b8973a]">Quote · 引用</p>
              <p className="mt-0.5 line-clamp-3 text-[12px] leading-snug text-[#4a463f]">
                {quoteTarget.role === 'npc' ? '对方' : '自己'}：{quoteTarget.text}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQuoteTarget(null)}
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
              aria-label="取消引用"
            >
              <X className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        ) : null}
        <div className="flex w-full max-w-full items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="输入消息..."
            rows={1}
            disabled={loading}
            className="min-h-[44px] min-w-0 flex-1 resize-none bg-white text-[16px] leading-snug outline-none disabled:opacity-60"
            style={{
              borderRadius: 'var(--wx-radius)',
              border: '1px solid var(--wx-input-border)',
              padding: '10px 16px',
              color: 'var(--wx-text)',
              maxHeight: 120,
            }}
            onKeyDown={onComposerKeyDown}
            aria-label="输入消息"
          />
          <Pressable
            onClick={onSendButtonClick}
            disabled={!planeEnabled}
            className="mb-[2px] flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
            aria-label={
              draft.trim()
                ? '发送并请求回复'
                : canRequestReplyWithoutDraft
                  ? '请求对方回复'
                  : '发送'
            }
          >
            <SendPlaneIcon color={planeColor} />
          </Pressable>
        </div>
        <p
          className="mt-2 px-0.5 text-[11px] leading-tight"
          style={{ color: 'var(--wx-text-muted)' }}
        >
          单击回车仅发己方气泡；双击回车或点纸飞机后请求对方回复。若已发过话且输入框为空，点纸飞机或按一次回车可催对方回复。对方多条回复按句逐条露出（与微信私聊节奏一致）。
          <span className="text-gray-600">长按气泡</span>
          可引用、复制；己方最后一条可撤回。Shift+Enter 换行。
        </p>
      </div>

      {npc.comprehensivePersona ? (
        <MeetWorldbookShelfModal
          open={worldbookOpen}
          onClose={() => setWorldbookOpen(false)}
          npcId={npc.id}
          nickname={npc.nickname}
          avatarUrl={npc.avatarUrl}
          dossier={npc.comprehensivePersona}
          meetProfile={profile}
        />
      ) : null}

      <AnimatePresence>
        {contactSyncOverlay ? (
          <motion.div
            key="meet-contact-sync-overlay"
            className="fixed inset-0 z-[565] flex items-center justify-center bg-black/48 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="alertdialog"
            aria-modal="true"
            aria-busy="true"
            aria-labelledby="meet-sync-overlay-title"
            aria-live="polite"
          >
            <div className="w-full max-w-[min(320px,88vw)] rounded-[18px] border border-[#e8e4dc] bg-[#faf8f5] px-6 py-8 text-center shadow-[0_24px_80px_rgba(22,18,14,0.18)]">
              <div
                className="mx-auto mb-5 size-10 animate-spin rounded-full border-2 border-[#D4AF37]/25 border-t-[#b8973a]"
                aria-hidden
              />
              <p id="meet-sync-overlay-title" className="text-[16px] font-medium tracking-[0.04em] text-[#2c2a26]">
                {contactSyncOverlay.phase === 'epilogue' ? '正在写入尾声延展条目…' : '正在同步至通讯录与人设…'}
              </p>
              <p className="meet-caption-en mt-3 text-[11px] leading-relaxed text-[#7a736b]">
                {contactSyncOverlay.phase === 'epilogue'
                  ? '正在根据临时会话生成收束稿，并写入档案法则。'
                  : '正在写入人设库、遇见同步世界书分册（含尾声延展）与镜像微信通讯录，请稍候。'}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {epilogueContactsNoticeOpen ? (
          <motion.div
            key="meet-epilogue-notice"
            className="fixed inset-0 z-[560] flex items-center justify-center bg-black/45 px-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="presentation"
            onClick={() => setEpilogueContactsNoticeOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="meet-epilogue-notice-title"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="w-full max-w-[min(360px,92vw)] overflow-hidden rounded-[18px] border border-[#e8e4dc] bg-[#faf8f5] shadow-[0_24px_80px_rgba(22,18,14,0.2)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-[#ebe7e0] px-5 pb-3 pt-5 text-center">
                <p
                  id="meet-epilogue-notice-title"
                  className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#9a9590]"
                >
                  Lumi Meet
                </p>
                <p className="mt-2 text-[17px] font-medium tracking-[0.06em] text-[#2c2a26]">已添加至通讯录</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[13px] leading-relaxed text-[#5c574f]">「{npc.nickname}」已同步至镜像微信通讯录。</p>
              </div>
              <div className="border-t border-[#ebe7e0] px-5 pb-[max(14px,env(safe-area-inset-bottom,0px))] pt-3">
                <Pressable
                  type="button"
                  onClick={() => setEpilogueContactsNoticeOpen(false)}
                  className="meet-btn-primary w-full py-3 text-[14px]"
                >
                  知道了
                </Pressable>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {meetActionPanelOpen ? (
        <div
          role="presentation"
          className="fixed inset-0 z-[1185]"
          aria-hidden
          onPointerDown={() => closeMeetActionPanel()}
        />
      ) : null}
      <WeChatMessageActionPanel
        open={meetActionPanelOpen}
        anchor={meetActionAnchor}
        onAction={onMeetPanelAction}
        actionIds={meetPanelActionIds}
      />

      <AnimatePresence>
        {devPanelOpen ? (
          <motion.div
            key="meet-dev-overlay"
            role="presentation"
            className="fixed inset-0 z-[540] flex items-end justify-center bg-black/45 px-3 pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-10 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setDevPanelOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="meet-dev-panel-title"
              layout
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="meet-scrollbar pointer-events-auto max-h-[min(78vh,560px)] w-full max-w-md overflow-y-auto rounded-t-[20px] border border-[#e8e4dc] bg-[#faf8f5] shadow-[0_-20px_80px_rgba(22,18,14,0.22)] sm:rounded-[20px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-[1] flex items-start justify-between gap-2 border-b border-[#ebe7e0] bg-[#faf8f5]/95 px-4 py-3 backdrop-blur-sm">
                <div className="min-w-0">
                  <p id="meet-dev-panel-title" className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#9a9590]">
                    Dev Tools
                  </p>
                  <p className="mt-0.5 text-[15px] font-medium text-[#2c2a26]">开发者调试</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#8a8478]">
                    调整好感与互换状态后，用正常发消息 / 催更走模型；「已互换」仅改标记，不会自动执行通讯录同步。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDevPanelOpen(false)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#e5e0d8] bg-white/90 text-[#6a6560] hover:border-[#d4c8b8]"
                  aria-label="关闭"
                >
                  <X className="size-4" strokeWidth={1.5} aria-hidden />
                </button>
              </div>

              <div className="space-y-5 px-4 py-4">
                <section>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9a9590]">Resonance · 好感</p>
                  <p className="mt-1 text-[12px] text-[#5c574f]">
                    当前存档：<span className="font-mono text-[#2c2a26]">{intimacy}</span> / 100
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={devIntDraft}
                      onChange={(e) => setDevIntDraft(Number(e.target.value))}
                      className="min-w-0 flex-1 accent-[#b8973a]"
                      aria-valuetext={`${devIntDraft}`}
                    />
                    <span className="w-9 shrink-0 text-right font-mono text-[13px] text-[#2c2a26]">{devIntDraft}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {([-10, -5, 5, 10] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDevIntDraft((v) => Math.max(0, Math.min(100, v + d)))}
                        className="rounded-full border border-[#e5e0d8] bg-white px-3 py-1.5 font-mono text-[11px] text-[#5c574f] active:scale-[0.98]"
                      >
                        {d > 0 ? `+${d}` : `${d}`}
                      </button>
                    ))}
                    {([0, 18, 50, 99, 100] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDevIntDraft(v)}
                        className="rounded-full border border-[#e5e0d8] bg-[#fffcf9] px-3 py-1.5 font-mono text-[11px] text-[#5c574f] active:scale-[0.98]"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEncounterIntimacy(npc.id, devIntDraft)
                      setResonanceFlashKey((k) => k + 1)
                    }}
                    className="meet-btn-primary mt-3 w-full py-2.5 text-[13px]"
                  >
                    应用好感
                  </button>
                </section>

                <section className="border-t border-[#ebe7e0] pt-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9a9590]">WeChat swap · 互换</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#7a736b]">
                    选「用户已发起」后，发一条消息或点纸飞机催更，可触发结业与（若配置 API）尾声档案写入。
                  </p>
                  <label className="mt-2 block text-[10px] text-[#9a9590]">状态</label>
                  <select
                    value={swapMeta.wechatSwapStatus}
                    onChange={(e) => {
                      const v = e.target.value as WechatSwapStatus
                      patchEncounterSwap(npc.id, { wechatSwapStatus: v })
                    }}
                    className="mt-1 w-full rounded-[12px] border border-[#e5e0d8] bg-white px-3 py-2.5 text-[13px] text-[#2c2a26] outline-none"
                  >
                    {SWAP_DEV_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.zh}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-[10px] text-[#a39e96]">
                    当前界面：<span className="font-mono">{swapMeta.wechatSwapStatus}</span>
                    {npc.status === 'wechat_added' ? ' · 已写入通讯录' : ''}
                  </p>
                </section>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {loreToast ? (
          <motion.div
            key="lore-toast"
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="pointer-events-none fixed left-1/2 z-[320] max-w-[min(92vw,360px)] -translate-x-1/2 rounded-[12px] bg-white/95 px-4 py-3 text-center shadow-[0_12px_48px_rgba(30,26,20,0.14)] backdrop-blur-md"
            style={{
              bottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
              border: '1px solid rgba(212, 175, 55, 0.45)',
            }}
          >
            <p className="meet-caption-en text-[9px] uppercase tracking-[0.32em] text-[#b8a994]">
              Lore updated
            </p>
            <p className="mt-1 text-[12px] font-light leading-snug text-[#3d3a34]">{loreToast}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
