import { AnimatePresence, motion } from 'framer-motion'
import { BookMarked } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { useCustomization } from '../../CustomizationContext'
import { Pressable } from '../../components/Pressable'
import { WeChatMessageBubbleRow } from '../wechat/WeChatMessageBubbleRow'
import { aiMeetChatReply, aiMeetEncounterEpilogueLore } from './lumiMeetAi'
import { MeetWorldbookShelfModal } from './MeetWorldbookShelfModal'
import {
  syncMeetDossierToWorldbookLore,
  syncMeetEpilogueImpressionToWorldbookLore,
} from './meetPersonaWorldbookSync'
import { upsertMeetNpcAsCharacter } from './syncMeetNpcToWechat'
import type { EncounterNPC } from './meetTypes'
import { useLumiMeetStore } from './LumiMeetStore'
import { computeMeetNpcStaggerDelayMs, sleep, yieldToPaint } from './lumiMeetChatReveal'
import { AffectionMeter } from './AffectionMeter'
import { EncounterWeChatSwapCard } from './EncounterWeChatSwapCard'
import type { MeetReplyEvaluation } from './meetEvaluationParse'

/** 与微信私聊输入栏一致：短窗口内第二次回车 = 带对方回复；超时单次回车 = 仅发己方气泡 */
const ENTER_DOUBLE_TAP_MS = 220
const ENTER_SINGLE_COMMIT_DELAY_MS = 80

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
  const [loreToast, setLoreToast] = useState<string | null>(null)
  const loreToastTimerRef = useRef<number | null>(null)

  const enterDebounceTimerRef = useRef<number | null>(null)
  const lastEnterDownRef = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

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
      try {
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

        const lore = await aiMeetEncounterEpilogueLore({
          apiConfig,
          npc,
          userProfile: profile,
          transcript: transcriptForLore,
        })
        syncMeetEpilogueImpressionToWorldbookLore({
          characterId: npc.id,
          playerDisplayName: profile.displayName,
          content: lore,
        })

        let toastMsg = 'Lore updated: 尾声延展档案已生成。'
        if (npc.comprehensivePersona) toastMsg += ' 核心人设档案已同步。'
        showLoreToast(toastMsg)
      } catch (e) {
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
      const { replies, evaluation } = await aiMeetChatReply({
        apiConfig,
        npc,
        userProfile: profile,
        transcript,
        encounterSwapStatus,
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
    try {
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
        showLoreToast('核心人设档案已写入世界书法则。')
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : '同步失败')
    }
  }, [markNpcWechatAdded, npc, replaceWeChatPersonaContacts, resolvedWx, showLoreToast, upsertNpc])

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

      setDraft('')
      pushChatMessage(npc.id, { role: 'user', content: text })

      if (!triggerAi) {
        refocusComposer()
        return
      }

      setLoading(true)
      try {
        const base = messages.map((m) => ({ role: m.role, content: m.content }))
        const nextTranscript = [...base, { role: 'user' as const, content: text }]
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
        <div className="w-10 shrink-0" aria-hidden />
      </header>

      <div
        className="shrink-0 border-b px-3 py-2"
        style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}
      >
        <AffectionMeter value={intimacy} flashKey={resonanceFlashKey} />
        <p className="mt-2 text-[10px] leading-snug text-gray-500">
          临时会话：好感仅由对方回复中的判定增减；达到阈值后可发起联络互换仪式。
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
          单击回车仅发己方气泡；双击回车或点纸飞机后请求对方回复。若已发过话且输入框为空，点纸飞机或按一次回车可催对方回复。对方多条回复按句逐条露出（与微信私聊节奏一致）。Shift+Enter 换行。
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
