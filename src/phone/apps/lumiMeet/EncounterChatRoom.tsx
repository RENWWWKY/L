import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, ImagePlus, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { useWeChatCurrentTime } from '../wechat/time/useWeChatCurrentTime'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { useCustomization } from '../../CustomizationContext'
import { Pressable } from '../../components/Pressable'
import { copyTextToClipboard } from '../../utils/copyToClipboard'
import { WeChatChatCameraScreen } from '../wechat/WeChatChatCameraScreen'
import { WeChatChatImageBubbleRow } from '../wechat/WeChatChatImageBubbleRow'
import { WeChatMessageBubbleRow } from '../wechat/WeChatMessageBubbleRow'
import type { MeetImageMime } from './meetTypes'
import { resolveMeetImagePayloadFromUrl } from './meetImageVision'
import {
  WeChatMessageActionPanel,
  type PanelAnchor,
  type WeChatMessageActionId,
} from '../wechat/WeChatMessageActionPanel'
import {
  aiMeetChatReply,
  aiMeetContractCovenantReply,
  MeetEncounterGenerationError,
  scrubMeetNpcWechatLeaks,
} from './lumiMeetAi'
import { ConnectCovenantModalPortal } from './ConnectCovenantModal'
import { MeetChatTutorialModalPortal } from './MeetChatTutorialModal'
import { MeetEncounterChatCoachPortal } from './MeetEncounterChatCoach'
import { MeetLinkedWechatRevealModalPortal } from './MeetLinkedWechatRevealModal'
import { pickWechatFromNpcPlainText, stripMeetContractResponseBlock } from './meetContractResponseParse'
import { meetApplyCharAddUserCovenant } from './meetContractCharFriendRequest'
import { inferCharFriendRequestFromTurn, isMeetEncounterWeChatLinked } from './meetInferCharFriendRequest'
import {
  isMeetContactWechatIdPlausible,
  resolveMeetUserContactWechatId,
} from './meetContactSettings'
import { resolveMeetWeChatPlayerIdentityId } from './meetResolveWeChatPlayerIdentityId'
import { ensureMeetNpcWechatSearchable, resolveCharWechatIdForCovenant } from './meetCovenantFinalize'
import { hasUnresolvedMeetCharContractRequest } from './meetCovenantResonance'
import {
  findUnresolvedMeetTruthMirrorCharRequest,
  hasUnresolvedMeetTruthMirrorCharRequest,
} from './meetTruthMirrorResonance'
import { prepareMeetNpcReplyForParsing, type MeetReplyEvaluation } from './meetEvaluationParse'
import {
  MEET_ENCOUNTER_BUBBLE_TEXT,
  MEET_ENCOUNTER_BUBBLE_THEME,
  resolveMeetEncounterChatBackgroundUrl,
} from './constants'
import { syncMeetEpilogueAfterContactsAdded } from './meetEpilogueAfterContactsSync'
import { appendMeetTruthMirrorToCharacterWorldbook } from './meetTruthMirrorWorldbook'
import { resolveMeetDualPersonaDirective } from './meetMaskTruthPrompt'
import { resolveMeetPublicDisplayName, resolveMeetSelfAvatarUrl } from './meetPublicProfileDisplay'
import { upsertMeetNpcAsCharacter } from './syncMeetNpcToWechat'
import { resolveMeetNpcCharRealNameForLore, resolveMeetNpcPeerRealName, type EncounterNPC, type MeetChatMessage } from './meetTypes'
import { useLumiMeetStore } from './LumiMeetStore'
import { computeMeetNpcStaggerDelayMs, computeMeetRichFollowUpDelayMs, sleep, yieldToPaint } from './lumiMeetChatReveal'
import { parseMeetNpcReplyBubbles } from './lumiMeetReplyParse'
import { AffectionMeter } from './AffectionMeter'
import { EncounterWeChatSwapCard } from './EncounterWeChatSwapCard'
import { EncounterActionBar } from './EncounterActionBar'
import { MeetWorldbookShelfModal } from './MeetWorldbookShelfModal'
import { TruthMirrorCeremonyPortal } from './TruthMirrorCeremony'
import { TruthMirrorCharInvitePortal } from './TruthMirrorCharInvitePortal'
import { meetMessagesToAiTranscript } from './meetEncounterTranscript'
import { applyMeetTruthMirrorTurnPolicy } from './meetTruthMirrorTurnPolicy'
import { finalizeMeetCharacterMemoryRoundAfterAiReply } from './meetMemoryRoundFinalize'
import {
  MeetEchoRevealCards,
  MeetMusicShareCard,
  MeetSystemCenterLine,
  MeetTruthMirrorCharRequestCard,
  MeetTruthMirrorRecordCard,
  MeetTruthMirrorUserResponseCard,
} from './MeetEncounterRichMessages'
import {
  buildMeetQuoteParticipantLabels,
  buildMeetReplyToMetaFromQuoteTarget,
  isMeetQuoteOnlyBubbleMessage,
  meetOutboundBubbleDisplayText,
  resolveMeetMessageDisplay,
} from './meetMessageQuote'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import { planMeetNpcOutboundBubbles } from './meetNpcQuoteParse'
import {
  MeetContractCharRequestCard,
  MeetContractNpcResponseCard,
  MeetContractUserRequestCard,
  MeetContractUserResponseCard,
} from './MeetCovenantCards'
import { useMeetKeyboardInset } from './useMeetKeyboardInset'
import { buildMeetChatTimelineRows } from './meetChatTimeline'
import { meetEncounterBubbleSurfaceStyle, meetEncounterQuoteInsetStyle } from './meetEncounterBubbleSurface'
import { MeetChatTimestampRow } from './MeetChatTimestampRow'

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

export function EncounterChatRoom({ npc, onBack }: { npc: EncounterNPC; onBack: () => void }) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const {
    replaceWeChatPersonaContacts,
    themeStyle,
    wechatThemeStyle,
    state: phoneUi,
  } = useCustomization()
  const globalBubble = phoneUi.wechatTheme.bubbleGlobal
  const bubbleTheme = useMemo(
    (): typeof MEET_ENCOUNTER_BUBBLE_THEME => ({
      ...MEET_ENCOUNTER_BUBBLE_THEME,
      showAvatar: globalBubble.showAvatar,
      showBubbleTail: globalBubble.showBubbleTail,
      mergeConsecutiveAvatarGroup: globalBubble.mergeConsecutiveAvatarGroup,
      avatarRadiusPx: globalBubble.avatarRadiusPx,
    }),
    [globalBubble],
  )
  const meetChatThemeStyle = useMemo((): CSSProperties => {
    const base = { ...wechatThemeStyle } as Record<string, string>
    base['--wx-self-bubble-bg'] = bubbleTheme.selfBubbleBg
    base['--wx-other-bubble-bg'] = bubbleTheme.otherBubbleBg
    base['--wx-self-bubble-text'] = MEET_ENCOUNTER_BUBBLE_TEXT.self
    base['--wx-other-bubble-text'] = MEET_ENCOUNTER_BUBBLE_TEXT.other
    base['--wx-self-bubble-radius'] = `${bubbleTheme.selfBubbleRadiusPx}px`
    base['--wx-other-bubble-radius'] = `${bubbleTheme.otherBubbleRadiusPx}px`
    return base as CSSProperties
  }, [bubbleTheme, wechatThemeStyle])
  const showMeetTimestamp = phoneUi.wechatTheme.timestampStyle !== 'hidden'
  const { currentTimeMs } = useWeChatCurrentTime({ characterId: npc.id })

  const {
    state: meetPersist,
    pushChatMessage,
    applyAffectionDelta,
    patchEncounterSwap,
    upsertNpc,
    markNpcWechatAdded,
    getPersistedSnapshot,
    removeChatMessage,
    markMeetInboxThreadRead,
    resolveMeetContractCharRequest,
    resolveMeetTruthMirrorCharRequest,
    markEncounterChatCoachCompleted,
    hydrated,
  } = useLumiMeetStore()
  const profile = meetPersist.meetProfile
  const meetDisplayName = resolveMeetPublicDisplayName(profile)
  const messages = useMemo(
    () => meetPersist.chatThreads[npc.id] ?? [],
    [npc.id, meetPersist.chatThreads],
  )
  const timelineRows = useMemo(
    () => buildMeetChatTimelineRows(messages, currentTimeMs),
    [messages, currentTimeMs],
  )

  /** 会话内人设可能被契约流程写入微信号等字段，列表须读存档避免头像/微信号仍是入口快照 */
  const liveNpc = useMemo(() => meetPersist.npcs.find((x) => x.id === npc.id) ?? npc, [meetPersist.npcs, npc])
  const quoteLabels = useMemo(
    () => buildMeetQuoteParticipantLabels(profile, liveNpc),
    [meetDisplayName, liveNpc.nickname, profile],
  )

  const resolvedNpcWechatId = useMemo(() => {
    const fromNpc = liveNpc.wechatId?.trim()
    if (fromNpc) return fromNpc
    for (let i = messages.length - 1; i >= 0; i--) {
      const row = messages[i]
      if (!row) continue
      if (row.kind === 'meet_contract_npc_status' && row.meetContractStatus?.charWechatId?.trim()) {
        return row.meetContractStatus.charWechatId.trim()
      }
      if (row.kind === 'wechat_swap_card' && row.swapCard?.charWechatId?.trim()) {
        return row.swapCard.charWechatId.trim()
      }
    }
    return ''
  }, [liveNpc.wechatId, messages])

  useEffect(() => {
    markMeetInboxThreadRead(npc.id)
  }, [npc.id, messages, markMeetInboxThreadRead])
  const intimacy = meetPersist.intimacyByNpcId[npc.id] ?? 18
  const swapMeta = meetPersist.encounterSwapByNpcId[npc.id] ?? {
    wechatSwapStatus: 'none' as const,
    userWechatId: '',
  }

  const [resonanceFlashKey, setResonanceFlashKey] = useState(0)

  const [draft, setDraft] = useState('')
  const draftRef = useRef(draft)
  draftRef.current = draft
  const [loading, setLoading] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [worldbookOpen, setWorldbookOpen] = useState(false)
  const [worldbookRefreshKey, setWorldbookRefreshKey] = useState(0)
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
  const [quoteTarget, setQuoteTarget] = useState<{
    role: 'user' | 'npc'
    text: string
    messageId: string
  } | null>(null)
  const [dualDirective, setDualDirective] = useState('')
  const [loreToast, setLoreToast] = useState<string | null>(null)
  const loreToastTimerRef = useRef<number | null>(null)

  const [truthMirrorOpen, setTruthMirrorOpen] = useState(false)
  const [truthMirrorAutoPick, setTruthMirrorAutoPick] = useState(false)
  const [truthMirrorInviteOpen, setTruthMirrorInviteOpen] = useState(false)
  const [truthMirrorInviteMinimized, setTruthMirrorInviteMinimized] = useState(false)
  const truthMirrorOpenRef = useRef(false)
  const truthMirrorInviteMessageIdRef = useRef<string | null>(null)

  useEffect(() => {
    truthMirrorOpenRef.current = truthMirrorOpen
  }, [truthMirrorOpen])
  const [covenantModalOpen, setCovenantModalOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const imageFileInputRef = useRef<HTMLInputElement>(null)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStepIndex, setCoachStepIndex] = useState(0)
  const [linkedWechatPeekOpen, setLinkedWechatPeekOpen] = useState(false)

  const enterDebounceTimerRef = useRef<number | null>(null)
  const lastEnterDownRef = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const keyboardInsetPx = useMeetKeyboardInset()
  const composerInsetPx = Math.max(0, keyboardInsetPx)

  useEffect(() => {
    const profileWx = profile.contactWechatId?.trim()
    if (!profileWx || swapMeta.userWechatId?.trim()) return
    patchEncounterSwap(npc.id, { userWechatId: profileWx })
  }, [npc.id, patchEncounterSwap, profile.contactWechatId, swapMeta.userWechatId])

  useEffect(() => {
    let alive = true
    void resolveMeetDualPersonaDirective(profile).then((d) => {
      if (alive) setDualDirective(d)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅随假面/锚定字段刷新，避免 profile 引用抖动
  }, [
    profile.baseWeChatIdentityId,
    profile.contactWechatId,
    profile.bio,
    profile.displayName,
    profile.intent,
    profile.meetIntentionsPublic,
    profile.orientation,
  ])

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
      if (
        m.kind === 'meet_echo_reveal' ||
        m.kind === 'meet_truth_mirror_record' ||
        m.kind === 'meet_truth_mirror_char_request' ||
        m.kind === 'meet_truth_mirror_user_response' ||
        m.kind === 'meet_contract_user_request' ||
        m.kind === 'meet_contract_npc_status' ||
        m.kind === 'meet_contract_char_request' ||
        m.kind === 'meet_contract_user_response' ||
        m.kind === 'meet_music_share' ||
        m.kind === 'meet_system'
      )
        return
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
          const src = messages.find((m) => m.id === t.id)
          const copyText = src?.images?.[0]?.base64?.trim()
            ? '[图片]'
            : src
              ? resolveMeetMessageDisplay(src).text
              : t.text
          const ok = await copyTextToClipboard(copyText)
          showLoreToast(ok ? '已复制' : '复制失败')
          closeMeetActionPanel()
        })()
        return
      }
      if (id === 'quote') {
        const src = messages.find((m) => m.id === t.id)
        const excerpt = src ? resolveMeetMessageDisplay(src).text : t.text
        setQuoteTarget({
          role: t.isSelf ? 'user' : 'npc',
          text: excerpt,
          messageId: t.id,
        })
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
    [closeMeetActionPanel, meetActionCanRecall, meetActionTarget, messages, npc.id, removeChatMessage, showLoreToast],
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
      const id = pickWechatFromNpcPlainText(m.content)
      if (id) return id
    }
    return null
  }, [messages])

  const resolvedWx = npc.wechatId || wxFromChat

  /** 评估里仅即时生效的元数据（好感、附言）；富交互卡须等口语气泡逐条露出后再入队 */
  const applyEvaluationImmediate = useCallback(
    (evaluation: MeetReplyEvaluation | null) => {
      if (!evaluation) return
      applyAffectionDelta(npc.id, evaluation.affectionChange)
      if (evaluation.affectionChange !== 0) setResonanceFlashKey((k) => k + 1)
      if (evaluation.swapInstruction?.trim()) {
        patchEncounterSwap(npc.id, { pendingSwapNote: evaluation.swapInstruction.trim() })
      }
    },
    [applyAffectionDelta, npc.id, patchEncounterSwap],
  )

  const enqueueDeferredProactiveRichMessages = useCallback(
    async (evaluation: MeetReplyEvaluation, lastBubbleText: string | undefined) => {
      await sleep(computeMeetRichFollowUpDelayMs(lastBubbleText))
      await yieldToPaint()

      if (evaluation.proactiveSwap) {
        const snap = getPersistedSnapshot()
        const cur = snap.encounterSwapByNpcId[npc.id]?.wechatSwapStatus ?? 'none'
        if (!snap.encounterSwapByNpcId[npc.id]?.covenantAgreed && cur !== 'swapped' && cur !== 'user_requested') {
          const thread = snap.chatThreads[npc.id] ?? []
          if (!hasUnresolvedMeetCharContractRequest(thread)) {
            if (cur !== 'char_requested') {
              patchEncounterSwap(npc.id, { wechatSwapStatus: 'char_requested' })
            }
            pushChatMessage(npc.id, {
              role: 'npc',
              content: '\u200b',
              kind: 'meet_contract_char_request',
              meetContractCharRequest: { resolved: false },
            })
            await yieldToPaint()
          }
        }
      }

      if (evaluation.proactiveTruthMirror) {
        if (evaluation.proactiveSwap) {
          await sleep(computeMeetNpcStaggerDelayMs('好。'))
        }
        const thread = getPersistedSnapshot().chatThreads[npc.id] ?? []
        if (!hasUnresolvedMeetTruthMirrorCharRequest(thread) && !truthMirrorOpenRef.current) {
          const messageId = pushChatMessage(npc.id, {
            role: 'npc',
            content: '\u200b',
            kind: 'meet_truth_mirror_char_request',
            meetTruthMirrorCharRequest: { resolved: false },
          })
          truthMirrorInviteMessageIdRef.current = messageId
          setTruthMirrorInviteMinimized(false)
          setCoachOpen(false)
          await yieldToPaint()
          setTruthMirrorInviteOpen(true)
        }
      }
    },
    [getPersistedSnapshot, npc.id, patchEncounterSwap, pushChatMessage],
  )

  const tryApplyCharFriendRequestAfterTurn = useCallback(
    async (params: {
      evaluationFlag: boolean
      lastUserContent: string
      outbound: { text: string }[]
    }) => {
      const snap = getPersistedSnapshot()
      const swap = snap.encounterSwapByNpcId[npc.id]
      if (!isMeetEncounterWeChatLinked(swap)) return

      const outboundTexts = params.outbound.map((p) => p.text)
      if (
        !inferCharFriendRequestFromTurn({
          evaluationFlag: params.evaluationFlag,
          lastUserContent: params.lastUserContent,
          outboundTexts,
        })
      ) {
        return
      }

      try {
        const resolvedPid = await resolveMeetWeChatPlayerIdentityId(profile.baseWeChatIdentityId)
        if (!resolvedPid) {
          showLoreToast('请先在「我的」→ 03 CONTACT 选择添加好友用的微信身份')
          return
        }
        const pending = await personaDb.listFriendRequests({
          playerIdentityId: resolvedPid,
          pendingOnly: true,
        })
        if (pending.some((r) => r.characterId === npc.id && r.status === 'pending')) {
          showLoreToast('「新的朋友」里已有对方待验证，请去微信查看')
          return
        }
        const snapNpc = snap.npcs.find((x) => x.id === npc.id) ?? npc
        await meetApplyCharAddUserCovenant({
          apiConfig,
          npc: snapNpc,
          userProfile: profile,
          playerIdentityId: profile.baseWeChatIdentityId,
          deps: { upsertNpc },
        })
        showLoreToast('对方已在微信「新的朋友」发来验证')
      } catch {
        showLoreToast('好友验证写入失败，可稍后到微信搜索对方微信号')
      }
    },
    [apiConfig, getPersistedSnapshot, npc, profile, showLoreToast, upsertNpc],
  )

  const covenantFinalizeDeps = useMemo(
    () => ({
      getPersistedSnapshot,
      upsertNpc,
      upsertMeetNpcAsCharacter: async (snap: EncounterNPC, wxId: string) => {
        await upsertMeetNpcAsCharacter(snap, wxId, {
          bindPlayerIdentityId: profile.baseWeChatIdentityId,
        })
      },
    }),
    [getPersistedSnapshot, profile.baseWeChatIdentityId, upsertNpc],
  )

  const applyCovenantAccepted = useCallback(
    async (params: {
      explicitWechatId?: string
      bodyForBubbles?: string
      scrubbedLines?: string[]
      actionType: 'char_add_user' | 'user_add_char' | 'none'
    }) => {
      const charWechatId = await resolveCharWechatIdForCovenant({
        npc,
        explicitWechatId: params.explicitWechatId,
        bodyForBubbles: params.bodyForBubbles ?? '',
        scrubbedLines: params.scrubbedLines ?? [],
        actionType: params.actionType,
        deps: covenantFinalizeDeps,
      })
      pushChatMessage(npc.id, {
        role: 'npc',
        content: '\u200b',
        kind: 'meet_contract_npc_status',
        meetContractStatus: {
          outcome: 'accepted',
          actionType: params.actionType,
          charWechatId,
        },
      })
      patchEncounterSwap(npc.id, { covenantAgreed: true, wechatSwapStatus: 'none' })

      if (params.actionType === 'char_add_user') {
        const snapNpc =
          getPersistedSnapshot().npcs.find((x) => x.id === npc.id) ?? { ...npc, wechatId: charWechatId }
        try {
          await meetApplyCharAddUserCovenant({
            apiConfig,
            npc: { ...snapNpc, wechatId: charWechatId ?? snapNpc.wechatId },
            userProfile: profile,
            playerIdentityId: profile.baseWeChatIdentityId,
            deps: { upsertNpc },
          })
          showLoreToast('对方已在微信「新的朋友」发来验证')
        } catch {
          showLoreToast('微信号已互换；好友验证写入失败，可稍后复制微信号自行添加')
        }
      }

      return charWechatId
    },
    [
      covenantFinalizeDeps,
      getPersistedSnapshot,
      npc,
      patchEncounterSwap,
      apiConfig,
      profile,
      profile.baseWeChatIdentityId,
      pushChatMessage,
      showLoreToast,
      upsertNpc,
    ],
  )

  const finalizeSwapCeremony = useCallback(
    async (npcReplyLines: string[]) => {
      const snap0 = getPersistedSnapshot()
      if (snap0.encounterSwapByNpcId[npc.id]?.wechatSwapStatus === 'swapped') return

      const wxChar = (npc.wechatId || resolvedWx || '').trim()
      const wxUser = resolveMeetUserContactWechatId(
        profile,
        snap0.encounterSwapByNpcId[npc.id],
      )
      if (!wxChar || !wxUser || npc.status === 'wechat_added') return
      if (!snap0.encounterSwapByNpcId[npc.id]?.userWechatId?.trim()) {
        patchEncounterSwap(npc.id, { userWechatId: wxUser })
      }

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

      const transcriptForLore = meetMessagesToAiTranscript(
        (getPersistedSnapshot().chatThreads[npc.id] ?? []).filter((m) => m.kind !== 'wechat_swap_card'),
      )

      setSyncError(null)
      setContactSyncOverlay({ phase: 'contacts' })
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

        setContactSyncOverlay({ phase: 'epilogue' })
        await syncMeetEpilogueAfterContactsAdded({
          apiConfig,
          npc: { ...npc, wechatId: wxChar },
          userProfile: profile,
          transcript: transcriptForLore,
          meetThread: getPersistedSnapshot().chatThreads[npc.id] ?? [],
          playerIdentityId: profile.baseWeChatIdentityId,
          verificationEpochMs: Date.now(),
          suppressVol10Notice: true,
        })

        setContactSyncOverlay(null)
        setEpilogueContactsNoticeOpen(true)
        showLoreToast('已同步至微信人设与通讯录。')
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
      upsertMeetNpcAsCharacter,
      upsertNpc,
    ],
  )

  const dispatchNpcTurn = useCallback(
    async (
      thread: MeetChatMessage[],
      swapStatusBefore: string,
      transcriptVirtualUserLine?: string,
    ) => {
      const encounterSwapStatus =
        getPersistedSnapshot().encounterSwapByNpcId[npc.id]?.wechatSwapStatus ?? 'none'
      const resonanceScore = getPersistedSnapshot().intimacyByNpcId[npc.id] ?? 18
      const transcript = meetMessagesToAiTranscript(thread)
      const lastUserMsg = [...thread].reverse().find((m) => m.role === 'user')
      const lastUserContent = lastUserMsg?.content ?? ''
      const pendingUserImage = lastUserMsg?.images?.[0]?.base64?.trim()
        ? { base64: lastUserMsg.images[0].base64, type: lastUserMsg.images[0].type }
        : null

      const selfAvatarUrl = resolveMeetSelfAvatarUrl(profile)
      const swapSnap = getPersistedSnapshot().encounterSwapByNpcId[npc.id]
      const injectAvatar =
        !!selfAvatarUrl && (swapSnap?.userAvatarVisionSeenUrl?.trim() ?? '') !== selfAvatarUrl.trim()
      const avatarPayload =
        injectAvatar && selfAvatarUrl ? await resolveMeetImagePayloadFromUrl(selfAvatarUrl) : null

      let rawReplies: string[]
      let rawEvaluation: MeetReplyEvaluation | null
      try {
        const aiOut = await aiMeetChatReply({
          apiConfig,
          npc,
          userProfile: profile,
          transcript,
          encounterSwapStatus,
          resonanceScore,
          dualPersonaDirective: dualDirective,
          transcriptVirtualUserLine,
          recentThread: thread,
          truthMirrorCeremonyOpen: truthMirrorOpenRef.current,
          pendingUserImage,
          injectUserProfileAvatarVision: injectAvatar && !!avatarPayload,
          userProfileAvatarImage: avatarPayload
            ? { base64: avatarPayload.base64, type: avatarPayload.mime }
            : null,
        })
        rawReplies = aiOut.replies
        rawEvaluation = aiOut.evaluation
        if (injectAvatar && avatarPayload && aiOut.replies.length) {
          patchEncounterSwap(npc.id, { userAvatarVisionSeenUrl: selfAvatarUrl.trim() })
        }
      } catch (e) {
        const msg =
          e instanceof MeetEncounterGenerationError
            ? e.message
            : e instanceof Error
              ? e.message
              : '回复失败，请重试'
        showLoreToast(msg)
        return
      }

      const { replies, evaluation } = applyMeetTruthMirrorTurnPolicy(rawEvaluation, rawReplies)
      if (!replies.length) {
        showLoreToast('模型未返回有效回复，请重试')
        return
      }

      const scrubbedReplies = scrubMeetNpcWechatLeaks(replies, encounterSwapStatus, npc.wechatId)
      const outbound = planMeetNpcOutboundBubbles(scrubbedReplies, thread, quoteLabels)

      if (evaluation != null) {
        applyEvaluationImmediate(evaluation)
      }

      for (let i = 0; i < outbound.length; i++) {
        const plan = outbound[i]!
        if (i > 0) await sleep(computeMeetNpcStaggerDelayMs(outbound[i - 1]!.text))
        else if (outbound.length > 1) await sleep(260)
        pushChatMessage(npc.id, {
          role: 'npc',
          content: plan.text,
          ...(plan.replyTo ? { replyTo: plan.replyTo } : {}),
        })
        await yieldToPaint()
      }

      if (evaluation != null && outbound.length > 0) {
        if (evaluation.proactiveSwap || evaluation.proactiveTruthMirror) {
          await enqueueDeferredProactiveRichMessages(evaluation, outbound[outbound.length - 1]?.text)
        }
      }

      const shouldCharFriendRequest = inferCharFriendRequestFromTurn({
        evaluationFlag: evaluation?.charFriendRequest ?? false,
        lastUserContent,
        outboundTexts: outbound.map((p) => p.text),
      })
      if (shouldCharFriendRequest && outbound.length > 0) {
        await sleep(computeMeetRichFollowUpDelayMs(outbound[outbound.length - 1]?.text))
        await tryApplyCharFriendRequestAfterTurn({
          evaluationFlag: evaluation?.charFriendRequest ?? false,
          lastUserContent,
          outbound,
        })
      }

      if (swapStatusBefore === 'user_requested' && outbound.length > 0) {
        await finalizeSwapCeremony(outbound.map((p) => p.text))
      }

      if (outbound.length > 0) {
        void finalizeMeetCharacterMemoryRoundAfterAiReply({
          apiConfig,
          characterId: npc.id,
          characterRealName: resolveMeetNpcPeerRealName(liveNpc),
          sessionPlayerIdentityId: profile.baseWeChatIdentityId,
          meetContactWechatId: profile.contactWechatId,
        })
      }
    },
    [
      apiConfig,
      applyEvaluationImmediate,
      dualDirective,
      enqueueDeferredProactiveRichMessages,
      tryApplyCharFriendRequestAfterTurn,
      finalizeSwapCeremony,
      getPersistedSnapshot,
      liveNpc,
      npc.id,
      patchEncounterSwap,
      profile,
      pushChatMessage,
      quoteLabels,
      showLoreToast,
    ],
  )

  /** 仅根据当前会话拉取 NPC 回复，不追加新的用户气泡（用于已发过话、草稿为空时点纸飞机 / 回车催更） */
  const requestNpcReplyOnly = useCallback(async () => {
    if (loading) return
    const swapStatusBefore = getPersistedSnapshot().encounterSwapByNpcId[npc.id]?.wechatSwapStatus ?? 'none'
    const last = messages[messages.length - 1]
    if (!last) return
    if (
      last.role !== 'user' &&
      !last.images?.[0]?.base64?.trim() &&
      swapStatusBefore !== 'user_requested'
    ) {
      return
    }

    if (enterDebounceTimerRef.current != null) {
      window.clearTimeout(enterDebounceTimerRef.current)
      enterDebounceTimerRef.current = null
    }
    lastEnterDownRef.current = 0

    setLoading(true)
    try {
      await dispatchNpcTurn(messages, swapStatusBefore)
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

  const canRequestReplyWithoutDraft =
    !loading &&
    messages.length > 0 &&
    (messages[messages.length - 1]?.role === 'user' ||
      !!messages[messages.length - 1]?.images?.[0]?.base64?.trim() ||
      swapMeta.wechatSwapStatus === 'user_requested')

  const commitSendImage = useCallback(
    async (base64: string, triggerAi: boolean, mime: MeetImageMime = 'image/jpeg', caption = '') => {
      let clipped = base64.trim().replace(/^data:image\/(?:jpeg|png|gif|webp);base64,/i, '').trim()
      if (!clipped || clipped.length < 64) {
        showLoreToast('图片处理失败，请重试')
        return
      }
      if (loading) return

      if (enterDebounceTimerRef.current != null) {
        window.clearTimeout(enterDebounceTimerRef.current)
        enterDebounceTimerRef.current = null
      }
      lastEnterDownRef.current = 0

      const swapStatusBefore =
        getPersistedSnapshot().encounterSwapByNpcId[npc.id]?.wechatSwapStatus ?? 'none'
      const replyTo = quoteTarget ? buildMeetReplyToMetaFromQuoteTarget(quoteTarget, quoteLabels) : undefined
      if (quoteTarget) setQuoteTarget(null)

      setDraft('')
      const newMsgId = pushChatMessage(npc.id, {
        role: 'user',
        content: caption.trim(),
        images: [{ base64: clipped, type: mime }],
        ...(replyTo ? { replyTo } : {}),
      })

      if (!triggerAi) {
        refocusComposer()
        return
      }

      setLoading(true)
      try {
        const threadForAi: MeetChatMessage[] = [
          ...messages,
          {
            id: newMsgId,
            role: 'user',
            content: caption.trim(),
            ts: Date.now(),
            images: [{ base64: clipped, type: mime }],
            ...(replyTo ? { replyTo } : {}),
          },
        ]
        await dispatchNpcTurn(threadForAi, swapStatusBefore)
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
      quoteLabels,
      quoteTarget,
      refocusComposer,
      showLoreToast,
    ],
  )

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

      const replyTo = quoteTarget ? buildMeetReplyToMetaFromQuoteTarget(quoteTarget, quoteLabels) : undefined
      if (quoteTarget) setQuoteTarget(null)

      setDraft('')
      const newMsgId = pushChatMessage(npc.id, {
        role: 'user',
        content: text,
        ...(replyTo ? { replyTo } : {}),
      })

      if (!triggerAi) {
        refocusComposer()
        return
      }

      setLoading(true)
      try {
        const threadForAi: MeetChatMessage[] = [
          ...messages,
          {
            id: newMsgId,
            role: 'user',
            content: text,
            ts: Date.now(),
            ...(replyTo ? { replyTo } : {}),
          },
        ]
        await dispatchNpcTurn(threadForAi, swapStatusBefore)
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
      quoteLabels,
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
  }, [messages, loading, composerInsetPx])

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
  const meetBg = resolveMeetEncounterChatBackgroundUrl(profile.chatBackground)
  const meetSelfAvatar = resolveMeetSelfAvatarUrl(profile)

  const onToolbarProfile = useCallback(() => {
    if (!npc.comprehensivePersona) {
      showLoreToast('未配置九维档案')
      return
    }
    setWorldbookOpen(true)
  }, [npc.comprehensivePersona, showLoreToast])

  const connectToolbarDisabled = loading
  const connectToolbarLinked = swapMeta.wechatSwapStatus === 'swapped' || !!swapMeta.covenantAgreed
  const connectPendingWechatSync =
    !!swapMeta.covenantAgreed &&
    liveNpc.status !== 'wechat_added' &&
    swapMeta.wechatSwapStatus !== 'swapped'

  const registerWechatForSearch = useCallback(
    async (wx: string) => {
      const id = wx.trim()
      if (!id) return
      try {
        await ensureMeetNpcWechatSearchable({ npc: liveNpc, wechatId: id, deps: covenantFinalizeDeps })
      } catch {
        /* 复制/查看仍可用，搜索失败时再提示 */
      }
    },
    [covenantFinalizeDeps, liveNpc],
  )

  const copyNpcWechatId = useCallback(
    (wx: string) => {
      const id = wx.trim()
      if (!id) {
        showLoreToast('暂无可复制的微信号')
        return
      }
      // 须在用户手势内立即复制；先 await 人设同步会导致 clipboard 权限被拒
      void copyTextToClipboard(id).then((ok) => {
        showLoreToast(ok ? '已复制，可在微信「添加朋友」中搜索' : '复制失败，请长按手动复制')
      })
      void registerWechatForSearch(id)
    },
    [registerWechatForSearch, showLoreToast],
  )

  const ensureMeetContactBindingReady = useCallback(async (): Promise<boolean> => {
    const userWx = profile.contactWechatId?.trim() ?? ''
    if (!userWx || !isMeetContactWechatIdPlausible(userWx)) {
      showLoreToast('请先在「我的」→ 03 CONTACT 填写你的微信号')
      return false
    }
    const pid = profile.baseWeChatIdentityId?.trim()
    if (!pid || pid === '__none__') {
      showLoreToast('请先在「我的」→ 03 CONTACT 选择要绑定的微信身份')
      return false
    }
    patchEncounterSwap(npc.id, { userWechatId: userWx })
    return true
  }, [npc.id, patchEncounterSwap, profile.baseWeChatIdentityId, profile.contactWechatId, showLoreToast])

  const onToolbarConnect = useCallback(() => {
    if (loading) return
    if (connectToolbarLinked) {
      const id = resolvedNpcWechatId.trim()
      if (!id) {
        showLoreToast('暂未留存对方微信号')
        return
      }
      void registerWechatForSearch(id)
      setLinkedWechatPeekOpen(true)
      return
    }
    void ensureMeetContactBindingReady().then((ok) => {
      if (ok) setCovenantModalOpen(true)
    })
  }, [connectToolbarLinked, ensureMeetContactBindingReady, loading, registerWechatForSearch, resolvedNpcWechatId, showLoreToast])

  const onCovenantConfirmSend = useCallback(async () => {
    if (loading) return
    if (!(await ensureMeetContactBindingReady())) return
    setCovenantModalOpen(false)
    pushChatMessage(npc.id, { role: 'user', content: '\u200b', kind: 'meet_contract_user_request' })
    setLoading(true)
    try {
      const transcript = meetMessagesToAiTranscript(getPersistedSnapshot().chatThreads[npc.id] ?? [])
      const rawModel = await aiMeetContractCovenantReply({
        apiConfig,
        npc,
        userProfile: profile,
        transcript,
        resonanceScore: getPersistedSnapshot().intimacyByNpcId[npc.id] ?? 18,
        dualPersonaDirective: dualDirective,
      })
      const { parsed, bodyForBubbles } = stripMeetContractResponseBlock(rawModel)
      const prep = prepareMeetNpcReplyForParsing(bodyForBubbles)
      const rawBubbles = parseMeetNpcReplyBubbles(prep.bodyForBubbles)
      const encounterSwapStatus = getPersistedSnapshot().encounterSwapByNpcId[npc.id]?.wechatSwapStatus ?? 'none'
      const scrubbed = rawBubbles
        .map((line) => scrubMeetNpcWechatLeaks([line], encounterSwapStatus, npc.wechatId)[0] ?? line)
        .map((s) => s.trim())
        .filter(Boolean)

      const decision = parsed?.decision === 'agree' ? 'agree' : 'reject'
      const actionType: 'char_add_user' | 'user_add_char' | 'none' =
        decision === 'agree' && (parsed?.actionType === 'char_add_user' || parsed?.actionType === 'user_add_char')
          ? parsed.actionType
          : 'none'
      const outcome: 'accepted' | 'rejected' = decision === 'agree' ? 'accepted' : 'rejected'

      if (outcome === 'accepted') {
        await applyCovenantAccepted({
          explicitWechatId: parsed?.explicitWechatId,
          bodyForBubbles,
          scrubbedLines: scrubbed,
          actionType,
        })
      } else {
        pushChatMessage(npc.id, {
          role: 'npc',
          content: '\u200b',
          kind: 'meet_contract_npc_status',
          meetContractStatus: { outcome: 'rejected', actionType: 'none' },
        })
      }

      const covenantThread = getPersistedSnapshot().chatThreads[npc.id] ?? []
      const covenantOutbound = planMeetNpcOutboundBubbles(scrubbed, covenantThread, quoteLabels)
      for (let i = 0; i < covenantOutbound.length; i++) {
        const plan = covenantOutbound[i]!
        if (i > 0) await sleep(computeMeetNpcStaggerDelayMs(covenantOutbound[i - 1]!.text))
        else if (covenantOutbound.length > 1) await sleep(260)
        pushChatMessage(npc.id, {
          role: 'npc',
          content: plan.text,
          ...(plan.replyTo ? { replyTo: plan.replyTo } : {}),
        })
        await yieldToPaint()
      }

      if (covenantOutbound.length > 0) {
        void finalizeMeetCharacterMemoryRoundAfterAiReply({
          apiConfig,
          characterId: npc.id,
          characterRealName: resolveMeetNpcPeerRealName(liveNpc),
          sessionPlayerIdentityId: profile.baseWeChatIdentityId,
          meetContactWechatId: profile.contactWechatId,
        })
      }
    } catch {
      showLoreToast('契约响应失败')
    } finally {
      setLoading(false)
      refocusComposer()
    }
  }, [
    apiConfig,
    applyCovenantAccepted,
    dualDirective,
    getPersistedSnapshot,
    liveNpc,
    loading,
    npc,
    profile,
    pushChatMessage,
    quoteLabels,
    refocusComposer,
    ensureMeetContactBindingReady,
    showLoreToast,
  ])

  const onCharContractAccept = useCallback(
    async (messageId: string) => {
      if (loading) return
      setLoading(true)
      try {
        resolveMeetContractCharRequest(npc.id, messageId)
        pushChatMessage(npc.id, {
          role: 'user',
          content: '\u200b',
          kind: 'meet_contract_user_response',
          meetContractStatus: { outcome: 'accepted', actionType: 'none' },
        })
        await applyCovenantAccepted({ actionType: 'user_add_char' })
      } catch {
        showLoreToast('缔结失败')
      } finally {
        setLoading(false)
        refocusComposer()
      }
    },
    [
      applyCovenantAccepted,
      loading,
      npc.id,
      pushChatMessage,
      refocusComposer,
      resolveMeetContractCharRequest,
      showLoreToast,
    ],
  )

  const startLiveCoach = useCallback(() => {
    setCoachStepIndex(0)
    setCoachOpen(true)
  }, [])

  const finishCoach = useCallback(
    (opts?: { openTutorial?: boolean }) => {
      markEncounterChatCoachCompleted()
      setCoachOpen(false)
      setCoachStepIndex(0)
      if (opts?.openTutorial) setTutorialOpen(true)
    },
    [markEncounterChatCoachCompleted],
  )

  useEffect(() => {
    if (!hydrated) return
    if (meetPersist.encounterChatCoachCompleted) return
    const id = window.setTimeout(() => startLiveCoach(), 560)
    return () => window.clearTimeout(id)
  }, [hydrated, meetPersist.encounterChatCoachCompleted, startLiveCoach])

  const onCharContractDecline = useCallback(
    (messageId: string) => {
      if (loading) return
      resolveMeetContractCharRequest(npc.id, messageId)
      pushChatMessage(npc.id, {
        role: 'user',
        content: '\u200b',
        kind: 'meet_contract_user_response',
        meetContractStatus: { outcome: 'rejected', actionType: 'none' },
      })
      /** 用户婉拒不封锁角色日后再次发起 */
      patchEncounterSwap(npc.id, { wechatSwapStatus: 'none' })
    },
    [loading, npc.id, patchEncounterSwap, pushChatMessage, resolveMeetContractCharRequest],
  )

  const onTruthMirrorCharAccept = useCallback(
    (messageId: string) => {
      if (truthMirrorOpen) return
      resolveMeetTruthMirrorCharRequest(npc.id, messageId)
      pushChatMessage(npc.id, {
        role: 'user',
        content: '\u200b',
        kind: 'meet_truth_mirror_user_response',
        meetTruthMirrorUserResponse: { outcome: 'accepted' },
      })
      truthMirrorInviteMessageIdRef.current = null
      setTruthMirrorInviteOpen(false)
      setTruthMirrorInviteMinimized(false)
      setTruthMirrorAutoPick(true)
      setTruthMirrorOpen(true)
    },
    [npc.id, pushChatMessage, resolveMeetTruthMirrorCharRequest, truthMirrorOpen],
  )

  const onTruthMirrorCharDecline = useCallback(
    (messageId: string) => {
      if (loading) return
      resolveMeetTruthMirrorCharRequest(npc.id, messageId)
      pushChatMessage(npc.id, {
        role: 'user',
        content: '\u200b',
        kind: 'meet_truth_mirror_user_response',
        meetTruthMirrorUserResponse: { outcome: 'declined' },
      })
      truthMirrorInviteMessageIdRef.current = null
      setTruthMirrorInviteOpen(false)
      setTruthMirrorInviteMinimized(false)
    },
    [loading, npc.id, pushChatMessage, resolveMeetTruthMirrorCharRequest],
  )

  const resolveTruthMirrorInviteMessageId = useCallback(() => {
    const pinned = truthMirrorInviteMessageIdRef.current
    if (pinned) {
      const thread = getPersistedSnapshot().chatThreads[npc.id] ?? messages
      const hit = thread.find((m) => m.id === pinned)
      if (hit?.kind === 'meet_truth_mirror_char_request' && !hit.meetTruthMirrorCharRequest?.resolved) {
        return pinned
      }
    }
    return findUnresolvedMeetTruthMirrorCharRequest(getPersistedSnapshot().chatThreads[npc.id] ?? messages)?.id
  }, [getPersistedSnapshot, messages, npc.id])

  const onTruthMirrorInviteAccept = useCallback(() => {
    const messageId = resolveTruthMirrorInviteMessageId()
    if (!messageId) {
      setTruthMirrorInviteOpen(false)
      setTruthMirrorInviteMinimized(false)
      return
    }
    onTruthMirrorCharAccept(messageId)
  }, [onTruthMirrorCharAccept, resolveTruthMirrorInviteMessageId])

  const onTruthMirrorInviteDecline = useCallback(() => {
    const messageId = resolveTruthMirrorInviteMessageId()
    if (!messageId) {
      setTruthMirrorInviteOpen(false)
      setTruthMirrorInviteMinimized(false)
      return
    }
    onTruthMirrorCharDecline(messageId)
  }, [onTruthMirrorCharDecline, resolveTruthMirrorInviteMessageId])

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{
        ...meetChatThemeStyle,
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
            {liveNpc.nickname}
          </h1>
        </div>
        <div className="flex w-10 shrink-0 items-center justify-end" data-meet-coach="tutorial">
          <Pressable
            onClick={() => setTutorialOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: 'var(--wx-text-muted)' }}
            aria-label="聊天说明"
            title="聊天说明"
          >
            <BookOpen className="size-[17px] text-[#b8973a]" strokeWidth={1.5} aria-hidden />
          </Pressable>
        </div>
      </header>

      <div
        className="shrink-0 border-b px-3 py-2"
        style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}
        data-meet-coach="affection"
      >
        <AffectionMeter value={intimacy} flashKey={resonanceFlashKey} />
        {syncError ? <p className="mt-2 text-[11px] text-red-600/90">{syncError}</p> : null}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <EncounterActionBar
          onProfile={onToolbarProfile}
          onConnect={onToolbarConnect}
          connectDisabled={connectToolbarDisabled}
          connectLinked={connectToolbarLinked}
          connectPendingWechatSync={connectPendingWechatSync}
          onTruthMirror={() => {
            setTruthMirrorAutoPick(false)
            setTruthMirrorOpen(true)
          }}
          anyLoading={loading}
        />
        {meetBg ? (
          <>
            <div
              className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${meetBg})` }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 z-[1]"
              style={{ background: 'color-mix(in oklab, white 58%, transparent)' }}
              aria-hidden
            />
          </>
        ) : null}
        <div
          ref={scrollRef}
          className="meet-scrollbar relative z-[2] flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden py-4 pl-0 pr-0 [-webkit-overflow-scrolling:touch]"
          style={{
            ...(meetBg ? { background: 'transparent' } : {}),
            paddingBottom: `calc(1rem + ${composerInsetPx}px)`,
          }}
        >
        {timelineRows.map((row) => {
          if (row.kind === 'time') {
            if (!showMeetTimestamp) return null
            return <MeetChatTimestampRow key={row.id} text={row.text} />
          }
          const m = row.message
          const i = row.index
          if (m.kind === 'meet_contract_user_request') {
            return (
              <MeetContractUserRequestCard
                key={m.id}
                selfAvatarUrl={meetSelfAvatar}
                showAvatar={bubbleTheme.showAvatar}
                avatarRadiusPx={bubbleTheme.avatarRadiusPx}
              />
            )
          }
          if (m.kind === 'meet_contract_npc_status' && m.meetContractStatus) {
            return (
              <MeetContractNpcResponseCard
                key={m.id}
                payload={m.meetContractStatus}
                otherAvatarUrl={liveNpc.avatarUrl}
                showAvatar={bubbleTheme.showAvatar}
                avatarRadiusPx={bubbleTheme.avatarRadiusPx}
                onCopyWechat={copyNpcWechatId}
              />
            )
          }
          if (m.kind === 'meet_contract_char_request') {
            return (
              <MeetContractCharRequestCard
                key={m.id}
                resolved={!!m.meetContractCharRequest?.resolved}
                otherAvatarUrl={liveNpc.avatarUrl}
                showAvatar={bubbleTheme.showAvatar}
                avatarRadiusPx={bubbleTheme.avatarRadiusPx}
                disabled={loading}
                onAccept={() => void onCharContractAccept(m.id)}
                onDecline={() => onCharContractDecline(m.id)}
              />
            )
          }
          if (m.kind === 'meet_contract_user_response' && m.meetContractStatus) {
            return (
              <MeetContractUserResponseCard
                key={m.id}
                outcome={m.meetContractStatus.outcome}
                selfAvatarUrl={meetSelfAvatar}
                showAvatar={bubbleTheme.showAvatar}
                avatarRadiusPx={bubbleTheme.avatarRadiusPx}
              />
            )
          }
          if (m.kind === 'wechat_swap_card' && m.swapCard) {
            return <EncounterWeChatSwapCard key={m.id} payload={m.swapCard} />
          }
          if (m.kind === 'meet_system') {
            return <MeetSystemCenterLine key={m.id} text={m.content} />
          }
          if (m.kind === 'meet_music_share' && m.musicShare) {
            return <MeetMusicShareCard key={m.id} payload={m.musicShare} />
          }
          if (m.kind === 'meet_echo_reveal' && m.echoReveal) {
            return <MeetEchoRevealCards key={m.id} payload={m.echoReveal} />
          }
          if (m.kind === 'meet_truth_mirror_char_request') {
            const reqIdx = messages.findIndex((x) => x.id === m.id)
            const userResp = messages
              .slice(reqIdx + 1)
              .find((x) => x.kind === 'meet_truth_mirror_user_response' && x.meetTruthMirrorUserResponse)
            return (
              <MeetTruthMirrorCharRequestCard
                key={m.id}
                resolved={!!m.meetTruthMirrorCharRequest?.resolved}
                outcome={userResp?.meetTruthMirrorUserResponse?.outcome}
                otherAvatarUrl={liveNpc.avatarUrl}
                showAvatar={bubbleTheme.showAvatar}
                avatarRadiusPx={bubbleTheme.avatarRadiusPx}
                disabled={truthMirrorOpen}
                onAccept={() => onTruthMirrorCharAccept(m.id)}
                onDecline={() => onTruthMirrorCharDecline(m.id)}
              />
            )
          }
          if (m.kind === 'meet_truth_mirror_user_response' && m.meetTruthMirrorUserResponse) {
            return (
              <MeetTruthMirrorUserResponseCard
                key={m.id}
                outcome={m.meetTruthMirrorUserResponse.outcome}
                selfAvatarUrl={meetSelfAvatar}
                showAvatar={bubbleTheme.showAvatar}
                avatarRadiusPx={bubbleTheme.avatarRadiusPx}
              />
            )
          }
          if (m.kind === 'meet_truth_mirror_record' && m.truthMirrorRecord) {
            return <MeetTruthMirrorRecordCard key={m.id} payload={m.truthMirrorRecord} npcGender={liveNpc.gender} />
          }
          const prev = i > 0 ? messages[i - 1] : undefined
          const merge = bubbleTheme.mergeConsecutiveAvatarGroup
          const sameRun = prev && prev.role === m.role
          const showAvatarColumn = !merge || !sameRun
          const image = m.images?.[0]
          const imgB64 = image?.base64?.trim()
          if (imgB64) {
            const isSelfImg = m.role === 'user'
            const src = `data:${image?.type ?? 'image/jpeg'};base64,${imgB64}`
            return (
              <motion.div key={m.id} id={`meet-msg-${m.id}`} className="w-full max-w-full shrink-0">
                <WeChatChatImageBubbleRow
                  id={m.id}
                  isSelf={isSelfImg}
                  src={src}
                  bubble={bubbleTheme}
                  showAvatar={bubbleTheme.showAvatar}
                  showAvatarColumn={showAvatarColumn}
                  chatSelfAvatarUrl={meetSelfAvatar}
                  chatOtherAvatarUrl={liveNpc.avatarUrl}
                  selected={meetActionPanelOpen && meetActionTarget?.id === m.id}
                  onLongPress={(rect) => openMeetActionPanelFor(m, rect)}
                />
              </motion.div>
            )
          }
          const display = resolveMeetMessageDisplay(m, quoteLabels)
          const bubbleText = meetOutboundBubbleDisplayText(display)
          const quoteOnly = isMeetQuoteOnlyBubbleMessage(m)
          const isSelf = m.role === 'user'
          if (quoteOnly) return null
          return (
            <motion.div key={m.id} id={`meet-msg-${m.id}`} className="w-full max-w-full shrink-0">
              <WeChatMessageBubbleRow
                messageText={bubbleText}
                isSelf={isSelf}
                bubble={bubbleTheme}
                showAvatar={bubbleTheme.showAvatar}
                showBubbleTail={bubbleTheme.showBubbleTail}
                variant="chat"
                showAvatarColumn={showAvatarColumn}
                chatSelfAvatarUrl={meetSelfAvatar}
                chatOtherAvatarUrl={liveNpc.avatarUrl}
                bubbleSelected={meetActionPanelOpen && meetActionTarget?.id === m.id}
                onBubbleLongPress={(rect) => openMeetActionPanelFor(m, rect)}
                chatBubbleSurfaceStyle={meetEncounterBubbleSurfaceStyle(isSelf)}
                replyPreviewInsetStyle={meetEncounterQuoteInsetStyle(isSelf)}
                replyPreview={
                  display.replyTo
                    ? {
                        senderName: display.replyTo.senderName,
                        content: display.replyTo.content,
                        onClick: display.replyTo.messageId
                          ? () => {
                              const el = document.getElementById(`meet-msg-${display.replyTo!.messageId}`)
                              el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            }
                          : undefined,
                      }
                    : undefined
                }
              />
            </motion.div>
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
                liveNpc.avatarUrl?.trim() ? (
                  <img
                    src={liveNpc.avatarUrl}
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
                ) : (
                  <div
                    className="h-10 w-10 shrink-0"
                    style={{
                      borderRadius: `${bubbleTheme.avatarRadiusPx}px`,
                      background: 'rgba(0,0,0,0.06)',
                      border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
                    }}
                    aria-hidden
                  />
                )
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
      </div>

      {/* 与 ChatRoom 底栏一致：上内边距 + 底部安全区 */}
      <div
        className="relative z-10 w-full max-w-full shrink-0 border-t"
        data-meet-coach="composer"
        style={{
          backgroundColor: 'var(--wx-input-bg)',
          borderTopColor: 'var(--wx-border)',
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 12,
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
          transform: composerInsetPx > 0 ? `translate3d(0, -${composerInsetPx}px, 0)` : undefined,
          transition: 'transform 220ms ease-out',
          willChange: composerInsetPx > 0 ? 'transform' : undefined,
        }}
      >
        {quoteTarget ? (
          <div className="mb-2 flex items-start gap-2 rounded-[12px] border border-[#D4AF37]/25 bg-white/95 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] tracking-[0.12em] text-[#b8973a]">引用</p>
              <p className="mt-0.5 line-clamp-3 text-[12px] leading-snug text-[#4a463f]">
                {quoteTarget.role === 'npc' ? quoteLabels.npcNickname : quoteLabels.userNickname}：{quoteTarget.text}
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
          <input
            ref={imageFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f || !f.type.startsWith('image/')) return
              const r = new FileReader()
              r.onload = () => {
                const url = typeof r.result === 'string' ? r.result : ''
                if (!url) return
                const mime = (
                  f.type === 'image/png' ||
                  f.type === 'image/gif' ||
                  f.type === 'image/webp'
                    ? f.type
                    : 'image/jpeg'
                ) as MeetImageMime
                const b64 = url.replace(/^data:image\/\w+;base64,/, '')
                void commitSendImage(b64, false, mime)
              }
              r.readAsDataURL(f)
            }}
          />
          <Pressable
            type="button"
            disabled={loading}
            onClick={() => imageFileInputRef.current?.click()}
            className="mb-[2px] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e8e4dc] bg-white text-[#6e6860] disabled:opacity-40"
            aria-label="从相册选择图片"
          >
            <ImagePlus className="size-5" strokeWidth={1.5} aria-hidden />
          </Pressable>
          <Pressable
            type="button"
            disabled={loading}
            onClick={() => setCameraOpen(true)}
            className="mb-[2px] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e8e4dc] bg-white text-[#6e6860] disabled:opacity-40"
            aria-label="拍摄图片"
          >
            <span className="text-[11px] font-medium tracking-[0.04em]">拍</span>
          </Pressable>
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
            onFocus={() => {
              requestAnimationFrame(() => {
                textareaRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
              })
            }}
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
          intimacyScore={intimacy}
          worldbookRefreshKey={worldbookRefreshKey}
        />
      ) : null}

      <ConnectCovenantModalPortal
        open={covenantModalOpen}
        onClose={() => setCovenantModalOpen(false)}
        onConfirmSend={() => void onCovenantConfirmSend()}
      />

      <AnimatePresence>
        {cameraOpen ? (
          <WeChatChatCameraScreen
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onToast={showLoreToast}
            onSend={({ base64, mime }) => {
              setCameraOpen(false)
              void commitSendImage(base64, false, mime)
            }}
          />
        ) : null}
      </AnimatePresence>

      <MeetChatTutorialModalPortal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onStartLiveCoach={startLiveCoach}
      />

      <MeetEncounterChatCoachPortal
        open={coachOpen}
        stepIndex={coachStepIndex}
        onStepChange={setCoachStepIndex}
        onSkip={() => finishCoach()}
        onComplete={(opts) => finishCoach(opts)}
      />

      <MeetLinkedWechatRevealModalPortal
        open={linkedWechatPeekOpen}
        peerRealName={resolveMeetNpcPeerRealName(liveNpc)}
        wechatId={resolvedNpcWechatId.trim()}
        onClose={() => setLinkedWechatPeekOpen(false)}
        onCopy={() => copyNpcWechatId(resolvedNpcWechatId)}
      />

      <TruthMirrorCharInvitePortal
        open={truthMirrorInviteOpen}
        minimized={truthMirrorInviteMinimized}
        nickname={liveNpc.nickname}
        npcGender={liveNpc.gender}
        onMinimize={() => setTruthMirrorInviteMinimized(true)}
        onExpand={() => setTruthMirrorInviteMinimized(false)}
        onAccept={onTruthMirrorInviteAccept}
        onDecline={onTruthMirrorInviteDecline}
      />

      <TruthMirrorCeremonyPortal
        open={truthMirrorOpen}
        onClose={() => {
          setTruthMirrorOpen(false)
          setTruthMirrorAutoPick(false)
        }}
        autoPickCard={truthMirrorAutoPick}
        npc={liveNpc}
        userProfile={profile}
        apiConfig={apiConfig}
        dualPersonaDirective={dualDirective}
        encounterSwapStatus={swapMeta.wechatSwapStatus}
        getThreadMessages={() => getPersistedSnapshot().chatThreads[npc.id] ?? []}
        setParentLoading={setLoading}
        onPersist={(payload) => {
          pushChatMessage(npc.id, {
            role: 'npc',
            content: '\u200b',
            kind: 'meet_truth_mirror_record',
            truthMirrorRecord: payload,
          })
          void appendMeetTruthMirrorToCharacterWorldbook({
            characterId: npc.id,
            charNickname: liveNpc.nickname,
            charRealName: resolveMeetNpcCharRealNameForLore(liveNpc),
            playerDisplayName: meetDisplayName,
            record: payload,
          }).then(() => setWorldbookRefreshKey((k) => k + 1))
          refocusComposer()
        }}
      />

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
              <p className="mt-3 text-[11px] leading-relaxed text-[#7a736b]">
                {contactSyncOverlay.phase === 'epilogue'
                  ? '正在根据邂逅聊天记录撰写结业初印象（约百字，写入 vol10）…'
                  : '正在写入人设库并加入微信通讯录，请稍候。'}
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
                  className="text-[10px] tracking-[0.2em] text-[#9a9590]"
                >
                  遇见
                </p>
                <p className="mt-2 text-[17px] font-medium tracking-[0.06em] text-[#2c2a26]">已添加至通讯录</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[13px] leading-relaxed text-[#5c574f]">
                  「{npc.nickname}」已同步至你的微信通讯录；并根据邂逅记录写入了 vol10「对 TA 的当前态度」结业初印象。
                </p>
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
