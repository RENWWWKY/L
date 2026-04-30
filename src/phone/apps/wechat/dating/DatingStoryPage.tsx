import { ArrowLeft, ChevronDown, FilePenLine, Heart, Layers, MoreHorizontal, Sparkles } from 'lucide-react'
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character, PlayerIdentity } from '../newFriendsPersona/types'
import { formatWorldBackgroundForPrompt } from '../newFriendsPersona/worldBackgroundFormat'
import { loadOfflineDatingPlotsPromptBlock } from './loadOfflineDatingPlotsForWechatPrompt'
import { requestWeChatHeartWhisper, type ChatTranscriptTurn } from '../wechatChatAi'
import { HeartWhisperModal } from '../HeartWhisperModal'
import { useDating } from './DatingContext'
import { splitDatingAssistantOutput } from './plotCoT'
import { PlotRichParagraph } from './plotRichText'
import { StoryFeed } from './StoryFeed'
import { StyleSettingsDrawer } from './StyleSettingsDrawer'
import { loadDatingStyleTuning, type DatingStyleTuning } from './styleTuningStorage'
import { DATING_AI_LENGTH_TARGET_MAX, DATING_AI_LENGTH_TARGET_MIN } from './types'
import type { BranchOption, DatingCardStyle, NarrativePerspective } from './types'
import type { HeartWhisper } from '../newFriendsPersona/types'

type Props = {
  onBackToSelect: () => void
}

const DATING_HEART_WHISPER_KV_PREFIX = 'wechat-dating-heart-whisper-v1:'

function datingHeartWhisperKvKey(characterId: string) {
  return `${DATING_HEART_WHISPER_KV_PREFIX}${String(characterId || '').trim()}`
}

function parseIdentityTag(tag: string): { text: string; isPainPoint: boolean } {
  const raw = String(tag || '').trim()
  if (!raw) return { text: '', isPainPoint: false }
  if (/^雷点[·:：]/.test(raw)) {
    return { text: raw.replace(/^雷点[·:：]\s*/, '').trim(), isPainPoint: true }
  }
  return { text: raw, isPainPoint: false }
}

/** 仅计汉字、字母、数字；标点、空白、符号、Markdown 标记等均不计入 */
function countPlotCharsExcludePunctuation(text: string): number {
  let n = 0
  for (const ch of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(ch)) n += 1
    else if (/[A-Za-z0-9]/.test(ch)) n += 1
  }
  return n
}

function BranchList({
  options,
  onPick,
  vn,
  loading,
}: {
  options: BranchOption[]
  onPick: (x: BranchOption) => void
  vn?: boolean
  loading?: boolean
}) {
  if (loading) {
    const sk = vn ? 'flex-1' : 'w-full'
    return (
      <div className={vn ? 'mt-3 flex gap-2' : 'mt-4 space-y-2'}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`animate-pulse rounded-xl border border-stone-100 bg-stone-100/80 px-4 py-3 ${sk}`}
          >
            <div className="h-3 w-16 rounded bg-stone-200/90" />
            <div className="mt-2 h-3 w-full rounded bg-stone-200/70" />
            <div className="mt-1.5 h-3 w-[82%] rounded bg-stone-200/50" />
          </div>
        ))}
      </div>
    )
  }
  if (!options.length) return null
  if (vn) {
    return (
      <div className="mt-3 flex gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o)}
            className="flex-1 rounded-xl border border-stone-200 bg-white/70 px-3 py-2 text-left text-[14px] text-[#262626] transition-all duration-200 ease-out hover:border-stone-400 hover:bg-white"
          >
            {o.styleLabel ? (
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-400">{o.styleLabel}</span>
            ) : null}
            <span className="leading-snug">{o.content}</span>
          </button>
        ))}
      </div>
    )
  }
  return (
    <div className="mt-4 space-y-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onPick(o)}
          className="w-full rounded-xl bg-white px-4 py-3 text-left shadow-sm transition-all duration-200 ease-out hover:bg-stone-50"
        >
          {o.styleLabel ? (
            <span className="mb-1 block text-[11px] font-medium text-stone-400">{o.styleLabel}</span>
          ) : null}
          <span className="text-[15px] leading-relaxed text-[#262626]">{o.content}</span>
        </button>
      ))}
    </div>
  )
}

export function DatingStoryPage({ onBackToSelect }: Props) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const {
    currentCharacter,
    currentArchive,
    characters,
    loading,
    setCurrentCharacterId,
    updateCharacter,
    setMode,
    setBranchEnabled,
    setGodPerspective,
    sendPlayerInput,
    stageBranchChoice,
    branchesLoading,
    generateInitialPlot,
    resetCurrentArchive,
    rollbackBranchNode,
    regeneratingPlotId,
    updatePlotItem,
    setPlotVersionIndex,
    deletePlotItem,
    regenerateAiPlot,
  } = useDating()
  const [input, setInput] = useState('')
  const [keyboardPad, setKeyboardPad] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [perspectiveOpen, setPerspectiveOpen] = useState(false)
  const [perspective, setPerspective] = useState<NarrativePerspective>('second')
  const [lengthOpen, setLengthOpen] = useState(false)
  const [lengthTargetChars, setLengthTargetChars] = useState('180')
  const [autoUserOpen, setAutoUserOpen] = useState(false)
  const [autoUserReaction, setAutoUserReaction] = useState(false)
  const [initialBiasOpen, setInitialBiasOpen] = useState(false)
  const [initialBiasText, setInitialBiasText] = useState('')
  const [initialBiasDismissedFor, setInitialBiasDismissedFor] = useState<string | null>(null)
  const [retryBiasOpen, setRetryBiasOpen] = useState(false)
  const [retryBiasText, setRetryBiasText] = useState('')
  const [retryTargetPlotId, setRetryTargetPlotId] = useState<string | null>(null)
  const [styleDrawerOpen, setStyleDrawerOpen] = useState(false)
  const [styleTuning, setStyleTuning] = useState<DatingStyleTuning>(() => ({ stylePrompt: '', referenceSnippet: '' }))

  const [heartWhisperOpen, setHeartWhisperOpen] = useState(false)
  const [heartWhisperLoading, setHeartWhisperLoading] = useState(false)
  const [heartWhisperData, setHeartWhisperData] = useState<HeartWhisper | null>(null)

  const PLOT_TAIL_LS = (id: string) => `wechat-dating-plot-tail:${id.trim()}`
  const PLOT_TAIL_DEFAULT = 24
  const [plotTailVisible, setPlotTailVisible] = useState(PLOT_TAIL_DEFAULT)
  const [floorsPanelOpen, setFloorsPanelOpen] = useState(false)
  const floorsPanelRef = useRef<HTMLDivElement | null>(null)
  const floorsMax = Math.min(80, Math.max(3, currentArchive.plots.length || 3))
  const floorsDisplay = Math.min(Math.max(3, plotTailVisible), floorsMax)
  const [floorsDraft, setFloorsDraft] = useState(String(PLOT_TAIL_DEFAULT))

  useEffect(() => {
    if (!floorsPanelOpen) return
    const onDown = (e: PointerEvent) => {
      const el = floorsPanelRef.current
      if (el && !el.contains(e.target as Node)) setFloorsPanelOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [floorsPanelOpen])

  useEffect(() => {
    setFloorsDraft(String(floorsDisplay))
  }, [floorsDisplay])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PLOT_TAIL_LS(currentCharacter.id))
      if (raw == null) {
        setPlotTailVisible(PLOT_TAIL_DEFAULT)
        return
      }
      const n = Number(raw)
      if (Number.isFinite(n)) setPlotTailVisible(Math.max(3, Math.min(80, Math.round(n))))
    } catch {
      setPlotTailVisible(PLOT_TAIL_DEFAULT)
    }
  }, [currentCharacter.id])

  const persistPlotTail = useCallback(
    (n: number) => {
      const v = Math.max(3, Math.min(80, Math.round(n)))
      setPlotTailVisible(v)
      try {
        localStorage.setItem(PLOT_TAIL_LS(currentCharacter.id), String(v))
      } catch {
        /* ignore */
      }
    },
    [currentCharacter.id],
  )

  const applyFloorsDraft = useCallback(() => {
    const n = parseInt(floorsDraft.trim(), 10)
    if (!Number.isFinite(n)) {
      setFloorsDraft(String(floorsDisplay))
      return
    }
    persistPlotTail(n)
  }, [floorsDraft, floorsDisplay, persistPlotTail])

  const buildTranscriptFromDatingPlots = useCallback((): ChatTranscriptTurn[] => {
    const out: ChatTranscriptTurn[] = []
    for (const p of currentArchive.plots.slice(-24)) {
      const raw = String(p.content || '').trim()
      if (!raw) continue
      const text = p.type === 'ai' ? splitDatingAssistantOutput(raw).content.trim() : raw
      if (!text) continue
      out.push({
        id: p.id,
        from: p.type === 'player' ? ('self' as const) : ('other' as const),
        text,
      })
    }
    return out
  }, [currentArchive.plots])

  const generateHeartWhisper = useCallback(async () => {
    if (heartWhisperLoading) return
    const cid = currentCharacter.id.trim()
    if (!cid) return
    setHeartWhisperLoading(true)
    try {
      const character = (await personaDb.getCharacter(cid)) as Character | null
      const playerIdentityId = character?.playerIdentityId?.trim() || '__none__'
      const playerIdentity =
        playerIdentityId && playerIdentityId !== '__none__'
          ? ((await personaDb.getPlayerIdentity(playerIdentityId)) as PlayerIdentity | null)
          : null
      const memoryNotes = (await personaDb.formatCharacterMemoriesForPrompt(cid)).trim() || undefined
      let worldBackgroundPrompt: string | undefined
      if (character?.worldBackgroundEnabled !== false && character?.worldBackgroundId?.trim()) {
        const wbg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
        const block = formatWorldBackgroundForPrompt(wbg)
        if (block.trim()) worldBackgroundPrompt = block
      }
      const offlineDatingPlotsContext =
        character ? await loadOfflineDatingPlotsPromptBlock(cid, character?.name ?? null) : ''
      // 线下剧情模式心语：严格基于当前剧情流生成，优先参考最新一轮 AI 剧情回复。
      const transcript = buildTranscriptFromDatingPlots()
      const whisper = await requestWeChatHeartWhisper({
        apiConfig,
        character,
        playerIdentity,
        playerDisplayName: playerIdentity?.wechatNickname?.trim() || '朋友',
        transcript,
        promptMode: 'persona',
        nowMs: Date.now(),
        longTermMemoryNotes: memoryNotes,
        worldBackgroundPrompt,
        offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
      })
      // 线下剧情心语独立存储，避免与聊天室心语串数据。
      await personaDb.setPhoneKv(datingHeartWhisperKvKey(cid), {
        data: whisper,
        updatedAt: Date.now(),
      })
      setHeartWhisperData(whisper)
    } finally {
      setHeartWhisperLoading(false)
    }
  }, [apiConfig, buildTranscriptFromDatingPlots, currentCharacter.id, heartWhisperLoading])

  useEffect(() => {
    if (!heartWhisperOpen) return
    let cancelled = false
    void (async () => {
      const raw = await personaDb.getPhoneKv(datingHeartWhisperKvKey(currentCharacter.id))
      const row =
        raw && typeof raw === 'object' && typeof (raw as any).data === 'object'
          ? ((raw as any).data as HeartWhisper)
          : null
      if (cancelled) return
      setHeartWhisperData(row ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [currentCharacter.id, heartWhisperOpen])

  useEffect(() => {
    setStyleTuning(loadDatingStyleTuning(currentCharacter.id))
  }, [currentCharacter.id])
  const defaultCardStyle: DatingCardStyle = useMemo(
    () => ({
      showContent: true,
      textColor: '#262626',
      bgMode: 'solid',
      solidColor: '#ffffff',
      gradientFrom: '#ffffff',
      gradientTo: '#f5f5f4',
      gradientAngle: 135,
      imageUrl: '',
      glass: false,
      glassBlur: 18,
      bgOpacity: 1,
      tagBgMode: 'solid',
      tagSolidColor: '#111827',
      tagGradientFrom: '#111827',
      tagGradientTo: '#0f172a',
      tagGradientAngle: 135,
      tagImageUrl: '',
      tagBgOpacity: 1,
      tagTextColor: '#ffffff',
      tagRadius: 999,
    }),
    [],
  )
  const effectiveCardStyle = useMemo(() => {
    return { ...defaultCardStyle, ...(currentCharacter.cardStyle ?? {}) }
  }, [currentCharacter.cardStyle, defaultCardStyle])

  const [editDraft, setEditDraft] = useState(() => ({
    avatarUrl: '',
    cardStyle: defaultCardStyle,
  }))

  useEffect(() => {
    if (!editOpen) return
    setEditDraft({
      avatarUrl: currentCharacter.avatarUrl ?? '',
      cardStyle: { ...defaultCardStyle, ...(currentCharacter.cardStyle ?? {}) },
    })
  }, [currentCharacter, editOpen])

  const onPickCardImageFile = async (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, bgMode: 'image', imageUrl: src } }))
    }
    reader.readAsDataURL(file)
  }

  const onPickTagImageFile = async (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, tagBgMode: 'image', tagImageUrl: src } }))
    }
    reader.readAsDataURL(file)
  }

  const cardTextColor = effectiveCardStyle.textColor || '#262626'
  const tagBgStyle = useMemo((): React.CSSProperties => {
    const cs = effectiveCardStyle
    const opacity = Math.max(0, Math.min(1, cs.tagBgOpacity ?? 1))
    const st: React.CSSProperties = {
      opacity,
    }
    if (cs.tagBgMode === 'solid') {
      st.backgroundColor = cs.tagSolidColor
    } else if (cs.tagBgMode === 'gradient') {
      const ang = Number.isFinite(cs.tagGradientAngle) ? cs.tagGradientAngle : 135
      st.backgroundImage = `linear-gradient(${ang}deg, ${cs.tagGradientFrom}, ${cs.tagGradientTo})`
    } else if (cs.tagBgMode === 'image') {
      st.backgroundImage = cs.tagImageUrl ? `url(${cs.tagImageUrl})` : 'none'
      st.backgroundSize = 'cover'
      st.backgroundPosition = 'center'
    }
    return st
  }, [effectiveCardStyle])
  const cardBgLayerStyle: React.CSSProperties = useMemo(() => {
    const cs = effectiveCardStyle
    const opacity = Math.max(0, Math.min(1, cs.bgOpacity ?? 1))
    const base: React.CSSProperties = {
      opacity,
      borderRadius: 16,
    }
    if (cs.bgMode === 'solid') {
      base.backgroundColor = cs.solidColor
    } else if (cs.bgMode === 'gradient') {
      const ang = Number.isFinite(cs.gradientAngle) ? cs.gradientAngle : 135
      base.backgroundImage = `linear-gradient(${ang}deg, ${cs.gradientFrom}, ${cs.gradientTo})`
    } else if (cs.bgMode === 'image') {
      base.backgroundImage = cs.imageUrl ? `url(${cs.imageUrl})` : 'none'
      base.backgroundSize = 'cover'
      base.backgroundPosition = 'center'
    }
    return base
  }, [effectiveCardStyle])

  const cardGlassLayerStyle: React.CSSProperties = useMemo(() => {
    const cs = effectiveCardStyle
    if (!cs.glass) return { display: 'none' }
    const blurPx = Math.max(0, Math.min(40, Number.isFinite(cs.glassBlur) ? cs.glassBlur : 18))
    return {
      borderRadius: 16,
      background: 'rgba(255,255,255,0.42)',
      border: '1px solid rgba(231,229,228,0.75)',
      backdropFilter: `blur(${blurPx}px)`,
      WebkitBackdropFilter: `blur(${blurPx}px)`,
    }
  }, [effectiveCardStyle])
  const [vnShownText, setVnShownText] = useState('')
  const [vnTyping, setVnTyping] = useState(false)
  const [vnFabPos, setVnFabPos] = useState({ x: 0, y: 80 })
  const normalScrollRef = useRef<HTMLDivElement | null>(null)
  const vnRootRef = useRef<HTMLDivElement | null>(null)
  const vnTimerRef = useRef<number | null>(null)
  const vnDragRef = useRef<{ pointerId: number; startX: number; startY: number; moved: boolean } | null>(null)
  const VN_FAB_SIZE = 44
  const VN_EDGE = 8
  const VN_MENU_W = 176
  const VN_MENU_H = 176

  const isVn = currentArchive.modePreference === 'vn'
  const didAutoScrollBottomRef = useRef<string>('')

  const lengthLabel = `${lengthTargetChars || '180'}字`
  const godLocksNoInterrupt = currentArchive.godPerspective
  const autoUserLabel = godLocksNoInterrupt ? '不抢话' : autoUserReaction ? '抢话' : '不抢话'

  useEffect(() => {
    if (isVn) {
      setKeyboardPad(0)
      return
    }
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardPad(Math.round(overlap))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [isVn])

  // 进入线下剧情页时默认滚到底部（与聊天室一致：展示最新进度，而不是顶部）
  useEffect(() => {
    if (isVn) return
    const key = `${currentCharacter.id}:${currentArchive.modePreference}`
    if (didAutoScrollBottomRef.current === key) return
    didAutoScrollBottomRef.current = key
    const el = normalScrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const node = normalScrollRef.current
        if (!node) return
        node.scrollTo({ top: node.scrollHeight, behavior: 'auto' })
      })
    })
  }, [currentArchive.modePreference, currentCharacter.id, isVn])

  useEffect(() => {
    if (isVn || keyboardPad <= 0) return
    if (document.activeElement !== inputRef.current) return
    const scroll = normalScrollRef.current
    if (!scroll) return
    requestAnimationFrame(() => {
      scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'smooth' })
    })
  }, [keyboardPad, isVn])

  const scrollComposerIntoView = useCallback(() => {
    const scroll = normalScrollRef.current
    const block = composerRef.current
    if (!scroll || !block) return
    requestAnimationFrame(() => {
      block.scrollIntoView({ block: 'end', behavior: 'smooth', inline: 'nearest' })
    })
    window.setTimeout(() => {
      scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'smooth' })
    }, 280)
  }, [])

  const latestAi = useMemo(() => {
    return [...currentArchive.plots].reverse().find((x) => x.type === 'ai') ?? null
  }, [currentArchive.plots])

  const vnCountSource = useMemo(() => {
    if (!isVn || loading) return ''
    const raw = (vnShownText || latestAi?.content || '').trim()
    return splitDatingAssistantOutput(raw).content
  }, [isVn, loading, vnShownText, latestAi?.content])

  const vnThinkingText = useMemo(() => {
    if (!latestAi?.content) return ''
    const stored = latestAi.logicPass?.trim() || ''
    const sp = splitDatingAssistantOutput(latestAi.content)
    return (stored || sp.logicPass || latestAi.planSummary?.trim() || sp.planSummary || '').trim()
  }, [latestAi?.id, latestAi?.content, latestAi?.logicPass, latestAi?.planSummary])

  const vnBodyChars = useMemo(() => countPlotCharsExcludePunctuation(vnCountSource), [vnCountSource])

  useEffect(() => {
    if (vnTimerRef.current) {
      window.clearInterval(vnTimerRef.current)
      vnTimerRef.current = null
    }
    if (!isVn) return
    const full = latestAi?.content ?? ''
    if (!full) {
      setVnShownText('')
      setVnTyping(false)
      return
    }
    setVnShownText('')
    setVnTyping(true)
    let i = 0
    vnTimerRef.current = window.setInterval(() => {
      i += 1
      if (i >= full.length) {
        setVnShownText(full)
        setVnTyping(false)
        if (vnTimerRef.current) {
          window.clearInterval(vnTimerRef.current)
          vnTimerRef.current = null
        }
        return
      }
      setVnShownText(full.slice(0, i))
    }, 22)
    return () => {
      if (vnTimerRef.current) {
        window.clearInterval(vnTimerRef.current)
        vnTimerRef.current = null
      }
    }
  }, [isVn, latestAi?.id, latestAi?.content])

  const skipVnTyping = () => {
    if (!vnTyping) return
    if (vnTimerRef.current) {
      window.clearInterval(vnTimerRef.current)
      vnTimerRef.current = null
    }
    setVnShownText(latestAi?.content ?? '')
    setVnTyping(false)
  }

  useEffect(() => {
    if (!isVn) return
    const root = vnRootRef.current
    if (!root) return
    const rect = root.getBoundingClientRect()
    const nextX = Math.max(VN_EDGE, rect.width - VN_FAB_SIZE - 16)
    const nextY = Math.max(VN_EDGE, 80)
    setVnFabPos((p) => (p.x === 0 ? { x: nextX, y: nextY } : p))
  }, [isVn])

  const onVnFabPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    vnDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    }
  }

  const onVnFabPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const st = vnDragRef.current
    if (!st || st.pointerId !== e.pointerId) return
    const dx = e.clientX - st.startX
    const dy = e.clientY - st.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) st.moved = true
    st.startX = e.clientX
    st.startY = e.clientY
    const rect = vnRootRef.current?.getBoundingClientRect()
    if (!rect) return
    setVnFabPos((p) => {
      const x = Math.max(VN_EDGE, Math.min(rect.width - VN_FAB_SIZE - VN_EDGE, p.x + dx))
      const y = Math.max(VN_EDGE, Math.min(rect.height - VN_FAB_SIZE - VN_EDGE, p.y + dy))
      return { x, y }
    })
  }

  const onVnFabPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const st = vnDragRef.current
    if (st && st.pointerId === e.pointerId && !st.moved) {
      setMenuOpen((v) => !v)
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    vnDragRef.current = null
  }

  const showBranchPanel =
    currentArchive.branchEnabled &&
    (currentArchive.pendingBranches.length > 0 || branchesLoading)
  const branchListLoading = branchesLoading && currentArchive.pendingBranches.length === 0
  const handleBranchPick = (x: BranchOption) => {
    stageBranchChoice(x)
    setInput(x.content)
  }
  const vnMenuPos = useMemo(() => {
    const rect = vnRootRef.current?.getBoundingClientRect()
    const vw = rect?.width ?? 360
    const vh = rect?.height ?? 640
    let left = vnFabPos.x + VN_FAB_SIZE - VN_MENU_W
    left = Math.max(VN_EDGE, Math.min(vw - VN_MENU_W - VN_EDGE, left))
    let top = vnFabPos.y + VN_FAB_SIZE + 8
    if (top + VN_MENU_H > vh - VN_EDGE) {
      top = vnFabPos.y - VN_MENU_H - 8
    }
    top = Math.max(VN_EDGE, Math.min(vh - VN_MENU_H - VN_EDGE, top))
    return { left, top }
  }, [vnFabPos.x, vnFabPos.y])

  const insertQuotePair = (open: string, close: string) => {
    const el = inputRef.current
    const v = input
    const start = el?.selectionStart ?? v.length
    const end = el?.selectionEnd ?? v.length
    const selected = v.slice(start, end)
    const next = v.slice(0, start) + open + selected + close + v.slice(end)
    setInput(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const pos = selected.length > 0 ? start + open.length + selected.length + close.length : start + open.length
      el.setSelectionRange(pos, pos)
    })
  }

  const perspectiveLabel = perspective === 'first' ? '第一人称' : perspective === 'second' ? '第二人称' : '第三人称'
  const lengthTargetNum = (() => {
    const n = Number(lengthTargetChars)
    if (!Number.isFinite(n)) return 180
    return Math.max(DATING_AI_LENGTH_TARGET_MIN, Math.min(DATING_AI_LENGTH_TARGET_MAX, Math.round(n)))
  })()

  const narrativeGenOptions = useMemo(
    () => ({
      lengthTargetChars: lengthTargetNum,
      autoUserReaction: godLocksNoInterrupt ? false : autoUserReaction,
      ...(styleTuning.stylePrompt.trim() ? { stylePrompt: styleTuning.stylePrompt.trim() } : {}),
      ...(styleTuning.referenceSnippet.trim() ? { referenceSnippet: styleTuning.referenceSnippet.trim() } : {}),
    }),
    [lengthTargetNum, autoUserReaction, godLocksNoInterrupt, styleTuning.stylePrompt, styleTuning.referenceSnippet],
  )

  const openRetryBiasPanel = useCallback((plotId: string) => {
    setRetryTargetPlotId(plotId)
    setRetryBiasOpen(true)
  }, [])

  const confirmRetryWithBias = useCallback(() => {
    const plotId = retryTargetPlotId?.trim()
    if (!plotId) {
      setRetryBiasOpen(false)
      return
    }
    const bias = retryBiasText
    setRetryBiasOpen(false)
    setRetryBiasText('')
    setRetryTargetPlotId(null)
    void regenerateAiPlot(plotId, perspective, narrativeGenOptions, bias)
  }, [narrativeGenOptions, perspective, regenerateAiPlot, retryBiasText, retryTargetPlotId])

  useEffect(() => {
    if (!currentArchive.godPerspective) return
    setAutoUserReaction(false)
    setAutoUserOpen(false)
  }, [currentArchive.godPerspective])

  useEffect(() => {
    if (currentArchive.plots.length > 0) {
      if (initialBiasDismissedFor) setInitialBiasDismissedFor(null)
      return
    }
    if (loading) return
    if (initialBiasDismissedFor === currentCharacter.id) return
    if (currentArchive.plots.length === 0) setInitialBiasOpen(true)
  }, [currentArchive.plots.length, loading, initialBiasDismissedFor, currentCharacter.id])

  return (
    <div
      className="relative h-full min-h-0 overflow-hidden bg-transparent"
    >
      {!isVn ? (
        <div className="flex h-full min-h-0 flex-col">
          <header className="sticky top-0 z-20 shrink-0 bg-transparent px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
            <div
              className="relative rounded-2xl border border-stone-200/80 p-4 shadow-sm"
              style={{ color: cardTextColor }}
            >
              {/* 背景层（纯色/渐变/图片） */}
              <div className="absolute inset-0 rounded-2xl" style={cardBgLayerStyle} />
              {/* 毛玻璃层：必须盖在背景层上，backdrop-blur 才能模糊到图片/渐变 */}
              {effectiveCardStyle.glass ? (
                <div className="absolute inset-0 rounded-2xl" style={cardGlassLayerStyle} />
              ) : null}
              <button
                type="button"
                onClick={onBackToSelect}
                className="absolute left-3 top-3 transition-all duration-200 ease-out hover:opacity-80"
              >
                <ArrowLeft className="size-5" />
              </button>
              <div ref={floorsPanelRef} className="absolute right-3 top-3 z-10">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    title="隐藏历史楼层（仅视图）"
                    onClick={() => setFloorsPanelOpen((v) => !v)}
                    className={`rounded-lg p-1 transition-all duration-200 ease-out hover:bg-black/[0.04] ${
                      floorsPanelOpen ? 'bg-black/[0.06] text-stone-800' : 'hover:opacity-80'
                    }`}
                  >
                    <Layers className="size-5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen((v) => !v)
                      setFloorsPanelOpen(false)
                    }}
                    className="rounded-lg p-1 transition-all duration-200 ease-out hover:opacity-80"
                  >
                    <MoreHorizontal className="size-5" />
                  </button>
                </div>
              {floorsPanelOpen ? (
                <div className="absolute right-0 top-12 z-30 w-[232px] rounded-xl border border-stone-200/90 bg-white/90 p-3 shadow-lg backdrop-blur-xl">
                  <p className="text-[11px] font-medium text-stone-500">从尾部展示条数</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-stone-400">
                    仅影响列表展示，不删除存档；范围 3～{floorsMax}。点列表顶「已隐藏…展开」可一次显示全部。
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={3}
                      max={floorsMax}
                      value={floorsDraft}
                      onChange={(e) => setFloorsDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyFloorsDraft()
                      }}
                      onBlur={applyFloorsDraft}
                      className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[13px] tabular-nums text-stone-800 outline-none focus:border-stone-400"
                    />
                    <button
                      type="button"
                      onClick={applyFloorsDraft}
                      className="shrink-0 rounded-lg bg-stone-900 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-stone-800"
                    >
                      应用
                    </button>
                  </div>
                </div>
              ) : null}
              </div>
              {effectiveCardStyle.showContent ? (
                <div className="relative ml-8 mr-8 flex items-start gap-4">
                  <img
                    src={currentCharacter.avatarUrl}
                    alt={currentCharacter.realName}
                    className="h-[90px] w-[90px] rounded-full border-2 border-stone-200 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[28px] font-bold leading-tight">{currentCharacter.realName}</h2>
                    <div className="mt-2 grid grid-cols-2 text-[12px] leading-6 opacity-70">
                      <p className="whitespace-nowrap">
                        AGE <span className="ml-1 opacity-95">{currentCharacter.age}</span>
                      </p>
                      <p className="whitespace-nowrap">
                        HEIGHT <span className="ml-1 opacity-95">{currentCharacter.heightCm}</span>
                      </p>
                      <p className="whitespace-nowrap">
                        WEIGHT <span className="ml-1 opacity-95">{currentCharacter.weightKg}</span>
                      </p>
                      <p className="whitespace-nowrap text-[11px] tracking-[0.08em]">
                        ZODIAC <span className="ml-1 opacity-95">{currentCharacter.zodiac}</span>
                      </p>
                      <p className="whitespace-nowrap text-[11px] tracking-[0.08em]">
                        BIRTHDAY <span className="ml-1 opacity-95">{currentCharacter.birthdayMD}</span>
                      </p>
                    </div>
                    <p className="mt-2 text-[12px] leading-snug opacity-60">{currentCharacter.motto}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {currentCharacter.identityTags.map((t) => {
                        const parsed = parseIdentityTag(t)
                        if (!parsed.text) return null
                        if (parsed.isPainPoint) {
                          return (
                            <span
                              key={t}
                              className="px-3 py-1 text-[12px] font-medium"
                              style={{
                                background: '#fee2e2',
                                border: '1px solid #fecaca',
                                color: '#b91c1c',
                                borderRadius: effectiveCardStyle.tagRadius,
                              }}
                            >
                              {parsed.text}
                            </span>
                          )
                        }
                        return (
                          <span
                            key={t}
                            className="px-3 py-1 text-[12px] font-medium"
                            style={{
                              ...tagBgStyle,
                              color: effectiveCardStyle.tagTextColor,
                              borderRadius: effectiveCardStyle.tagRadius,
                            }}
                          >
                            {parsed.text}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative ml-8 mr-8 h-[44px]" />
              )}
              {menuOpen ? (
                <div className="absolute right-3 top-10 z-30 w-52 rounded-xl border border-stone-200 bg-white p-1 shadow-md">
                  <button className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#262626] hover:bg-stone-50" onClick={() => setMode(isVn ? 'normal' : 'vn')}>
                    模式切换：{isVn ? '切到普通模式' : '切到VN模式'}
                  </button>
                  <button className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#262626] hover:bg-stone-50" onClick={() => setBranchEnabled(!currentArchive.branchEnabled)}>
                    剧情分支开关：{currentArchive.branchEnabled ? '已开启' : '已关闭'}
                  </button>
                  <button
                    className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#262626] hover:bg-stone-50"
                    onClick={() => {
                      setEditOpen(true)
                      setMenuOpen(false)
                      setSwitchOpen(false)
                    }}
                  >
                    编辑当前角色卡片信息
                  </button>
                  <button className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#262626] hover:bg-stone-50" onClick={resetCurrentArchive}>
                    重置当前角色进度
                  </button>
                  <button className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#262626] hover:bg-stone-50" onClick={rollbackBranchNode}>
                    回退到上一分支节点
                  </button>
                  <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] text-[#262626] hover:bg-stone-50" onClick={() => setSwitchOpen((v) => !v)}>
                    切换其他AI角色 <ChevronDown className="size-4" />
                  </button>
                  {switchOpen ? (
                    <div className="mt-1 rounded-lg border border-stone-200 bg-stone-50 p-1">
                      {characters.map((x) => (
                        <button
                          key={x.id}
                          className="w-full rounded-md px-2 py-1.5 text-left text-[12px] text-[#262626] hover:bg-white"
                          onClick={() => {
                            setCurrentCharacterId(x.id)
                            setMenuOpen(false)
                            setSwitchOpen(false)
                          }}
                        >
                          {x.realName}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </header>

          <div
            ref={normalScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={
              keyboardPad > 0
                ? { paddingBottom: `calc(${keyboardPad}px + max(1rem, env(safe-area-inset-bottom, 0px)))` }
                : undefined
            }
          >
            <div className="rounded-2xl border border-stone-100 bg-white p-8 shadow-sm">
              {currentArchive.plots.length ? (
                <StoryFeed
                  plots={currentArchive.plots}
                  tailVisibleCount={plotTailVisible}
                  onTailVisibleCountChange={persistPlotTail}
                  regeneratingPlotId={regeneratingPlotId}
                  interactionLocked={loading}
                  onUpdatePlot={(id, patch) => updatePlotItem(id, patch)}
                  onRegeneratePlot={openRetryBiasPanel}
                  onSetPlotVersionIndex={(id, idx) => setPlotVersionIndex(id, idx)}
                  onDeletePlot={(id) => deletePlotItem(id)}
                  branchEnabled={currentArchive.branchEnabled}
                  pendingBranches={currentArchive.pendingBranches}
                  branchesLoading={branchesLoading}
                  onBranchPick={handleBranchPick}
                />
              ) : (
                <div className="flex min-h-[120px] flex-col justify-between">
                  <p className="text-[14px] leading-relaxed text-[#8e8e8e]">暂无线下剧情内容，填写偏向后可生成首段剧情。</p>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setInitialBiasOpen(true)}
                      className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[12px] font-medium text-[#262626] transition-all duration-200 hover:bg-stone-50 disabled:opacity-60"
                    >
                      AI生成内容
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div
              ref={composerRef}
              className="mt-4 scroll-mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#262626]">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-stone-200 accent-neutral-800"
                    checked={currentArchive.godPerspective}
                    onChange={(e) => setGodPerspective(e.target.checked)}
                  />
                  上帝视角
                </label>
                <span className="text-[12px] leading-snug text-[#8e8e8e]">
                  旁白推进，不与玩家直接对话互动；开启时固定「不抢话」，避免代写玩家与视角冲突
                </span>
              </div>
              <p className="mb-2 text-[12px] leading-snug text-[#8e8e8e]">
                旁白直接写；弯引号 / 英文引号为对白；** 为内心 OS；旁白上的轻吐槽勿用 ** 包裹，保持普通旁白即可
              </p>
              <div className="mb-3 flex flex-wrap items-start gap-2">
                <button
                  type="button"
                  onClick={() => insertQuotePair('\u201C', '\u201D')}
                  className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[13px] text-[#262626] transition-all duration-200 hover:border-stone-400"
                  title="对白（弯引号）"
                >
                  “”
                </button>
                <button
                  type="button"
                  onClick={() => insertQuotePair('**', '**')}
                  className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 font-mono text-[13px] text-[#262626] transition-all duration-200 hover:border-stone-400"
                  title="内心 OS"
                >
                  <span className="font-mono">**</span>
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPerspectiveOpen((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[13px] text-[#262626] transition-all duration-200 hover:border-stone-400"
                    title="选择下一次剧情人称"
                  >
                    {perspectiveLabel}
                    <ChevronDown className="size-3.5" />
                  </button>
                  {perspectiveOpen ? (
                    <div className="absolute left-0 top-full z-20 mt-1 w-[140px] rounded-xl border border-stone-200 bg-white p-1 shadow-md">
                      {(
                        [
                          { id: 'first' as const, label: '第一人称' },
                          { id: 'second' as const, label: '第二人称' },
                          { id: 'third' as const, label: '第三人称' },
                        ] as const
                      ).map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => {
                            setPerspective(it.id)
                            setPerspectiveOpen(false)
                          }}
                          className={`w-full rounded-lg px-2.5 py-2 text-left text-[12px] transition-all ${
                            perspective === it.id ? 'bg-stone-100 text-[#262626]' : 'text-[#525252] hover:bg-stone-50'
                          }`}
                        >
                          {it.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setLengthOpen((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[13px] text-[#262626] transition-all duration-200 hover:border-stone-400"
                    title="选择字数"
                  >
                    {lengthLabel}
                    <ChevronDown className="size-3.5" />
                  </button>
                  {lengthOpen ? (
                    <div className="absolute left-0 top-full z-20 mt-1 w-[170px] rounded-xl border border-stone-200 bg-white p-2 shadow-md">
                      <p className="px-1 text-[11px] text-[#8e8e8e]">目标字数（正文汉字，约 88%～118% 区间）</p>
                      <input
                        type="number"
                        min={DATING_AI_LENGTH_TARGET_MIN}
                        max={DATING_AI_LENGTH_TARGET_MAX}
                        step={10}
                        value={lengthTargetChars}
                        onChange={(e) => setLengthTargetChars(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[12px] text-[#262626] outline-none focus:border-stone-400"
                        placeholder="如 180"
                      />
                      <p className="mt-1 px-1 text-[10px] leading-snug text-[#9a9a9a]">不含思维链；模型会尽量落在区间内，仍受模型与 API 影响</p>
                    </div>
                  ) : null}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    disabled={godLocksNoInterrupt}
                    onClick={() => {
                      if (godLocksNoInterrupt) return
                      setAutoUserOpen((v) => !v)
                    }}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[13px] transition-all duration-200 ${
                      godLocksNoInterrupt
                        ? 'cursor-not-allowed border-stone-100 bg-stone-100 text-[#a3a3a3]'
                        : 'border-stone-200 bg-stone-50 text-[#262626] hover:border-stone-400'
                    }`}
                    title={
                      godLocksNoInterrupt
                        ? '上帝视角下固定不抢话，避免旁白代写玩家导致冲突'
                        : '选择抢话与否'
                    }
                  >
                    {autoUserLabel}
                    <ChevronDown className="size-3.5" />
                  </button>
                  {autoUserOpen && !godLocksNoInterrupt ? (
                    <div className="absolute left-0 top-full z-20 mt-1 w-[126px] rounded-xl border border-stone-200 bg-white p-1 shadow-md">
                      {(
                        [
                          { id: 'off', label: '不抢话', v: false },
                          { id: 'on', label: '抢话', v: true },
                        ] as const
                      ).map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => {
                            setAutoUserReaction(it.v)
                            setAutoUserOpen(false)
                          }}
                          className={`w-full rounded-lg px-2.5 py-2 text-left text-[12px] transition-all ${
                            autoUserReaction === it.v ? 'bg-stone-100 text-[#262626]' : 'text-[#525252] hover:bg-stone-50'
                          }`}
                        >
                          {it.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setHeartWhisperOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[13px] text-[#262626] transition-all duration-200 hover:border-stone-400"
                  title="心语"
                >
                  <Heart className="size-4" strokeWidth={1.75} />
                  心语
                </button>
                <div className="ml-auto flex shrink-0 items-center pl-1">
                  <button
                    type="button"
                    onClick={() => setStyleDrawerOpen(true)}
                    title="文风设定"
                    className="rounded-lg border border-stone-200/90 bg-stone-50/80 p-2 text-stone-400 transition-all duration-200 hover:border-stone-300 hover:bg-white hover:text-stone-800"
                  >
                    <FilePenLine className="size-4" strokeWidth={1.65} />
                  </button>
                </div>
              </div>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => scrollComposerIntoView()}
                placeholder="输入你想说的话/剧情指令，推进约会剧情..."
                rows={4}
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                className="min-h-[7.5rem] w-full scroll-mb-32 resize-y rounded-xl border border-stone-200 bg-white px-4 py-3 text-[16px] leading-relaxed text-[#262626] outline-none transition-all duration-200 focus:border-stone-400 focus:ring-2 focus:ring-stone-300/50"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    const ok = await sendPlayerInput(input, perspective, narrativeGenOptions)
                    if (ok) setInput('')
                  }}
                  className="rounded-xl bg-neutral-900 px-6 py-2.5 text-[15px] font-medium text-white transition-all duration-200 ease-out hover:bg-neutral-800 disabled:opacity-60"
                >
                  {loading ? '生成中...' : '发送'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div ref={vnRootRef} className="relative h-full">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(250,250,249,0.5), rgba(245,245,244,0.88)), url(https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80)',
            }}
          />
          <div
            className="absolute z-30"
            style={{ left: vnFabPos.x, top: vnFabPos.y }}
          >
            <button
              type="button"
              className="rounded-full border border-stone-200 bg-white/88 p-2.5 text-[#262626] shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl"
              onPointerDown={onVnFabPointerDown}
              onPointerMove={onVnFabPointerMove}
              onPointerUp={onVnFabPointerUp}
              onPointerCancel={onVnFabPointerUp}
            >
              <MoreHorizontal className="size-5" />
            </button>
          </div>
          {menuOpen ? (
            <div
              className="absolute z-30 w-44 rounded-xl border border-stone-200 bg-white/92 p-1 shadow-[0_10px_28px_rgba(0,0,0,0.1)] backdrop-blur-xl"
              style={{ left: vnMenuPos.left, top: vnMenuPos.top }}
            >
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#262626] hover:bg-stone-50"
                onClick={() => {
                  onBackToSelect()
                  setMenuOpen(false)
                }}
              >
                返回约会列表
              </button>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#262626] hover:bg-stone-50"
                onClick={() => {
                  setMode('normal')
                  setMenuOpen(false)
                }}
              >
                切回普通模式
              </button>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#262626] hover:bg-stone-50"
                onClick={() => {
                  setEditOpen(true)
                  setMenuOpen(false)
                }}
              >
                编辑当前角色卡片信息
              </button>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#262626] hover:bg-stone-50"
                onClick={() => {
                  rollbackBranchNode()
                  setMenuOpen(false)
                }}
              >
                回退上一分支
              </button>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#262626] hover:bg-stone-50"
                onClick={() => {
                  setBranchEnabled(!currentArchive.branchEnabled)
                  setMenuOpen(false)
                }}
              >
                剧情分支开关：{currentArchive.branchEnabled ? '已开启' : '已关闭'}
              </button>
            </div>
          ) : null}

          <div className="absolute bottom-[220px] left-1/2 -translate-x-1/2">
            <img
              src={currentCharacter.avatarUrl}
              alt={currentCharacter.realName}
              className="h-60 w-60 rounded-3xl object-cover shadow-[0_12px_28px_rgba(0,0,0,0.1)]"
              style={{ opacity: loading ? 0.7 : 1 }}
            />
          </div>

          <div className="absolute bottom-5 left-4 right-4 rounded-xl border border-stone-200/60 bg-white/85 p-4 shadow-sm backdrop-blur-xl">
            <p className="text-[16px] font-semibold text-[#262626]">{currentCharacter.realName}</p>
            {!loading && vnThinkingText ? (
              <details className="mt-1 rounded-md border border-stone-200 bg-stone-50/80 px-2 py-1">
                <summary className="cursor-pointer select-none list-none text-[11px] text-[#6b7280] [&::-webkit-details-marker]:hidden">
                  Lumi思维链（点击展开/收起）
                </summary>
                <pre className="mt-1 max-h-[min(32vh,220px)] overflow-y-auto whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-[#4b5563]">
                  {vnThinkingText}
                </pre>
              </details>
            ) : null}
            <button
              type="button"
              onClick={skipVnTyping}
              className="mt-1 w-full text-left text-[16px] leading-[1.5] text-[#262626]"
            >
              {loading ? (
                '剧情准备中...'
              ) : vnShownText ? (
                <PlotRichParagraph content={vnShownText} />
              ) : latestAi ? (
                <PlotRichParagraph content={latestAi.content} />
              ) : (
                '剧情准备中...'
              )}
            </button>
            {showBranchPanel ? (
              <details className="mt-1 rounded-md border border-stone-200 bg-stone-50/80 px-2 py-1">
                <summary className="cursor-pointer select-none list-none text-[11px] text-[#6b7280] [&::-webkit-details-marker]:hidden">
                  剧情分支（点击展开/收起）
                </summary>
                <div className="mt-1 max-h-[min(40vh,260px)] overflow-y-auto">
                  <BranchList
                    options={currentArchive.pendingBranches}
                    loading={branchListLoading}
                    onPick={handleBranchPick}
                    vn
                  />
                </div>
              </details>
            ) : null}
            {vnBodyChars > 0 ? (
              <p className="mt-0.5 text-right text-[10px] tabular-nums leading-none text-stone-400/75">
                约 {vnBodyChars} 字（不含标点）
              </p>
            ) : null}
            {currentArchive.branchEnabled ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="选分支后文案会出现在这里，可改完再发…"
                  rows={3}
                  enterKeyHint="send"
                  autoComplete="off"
                  className="w-full resize-y rounded-lg border border-stone-200/90 bg-white/90 px-3 py-2 text-[14px] leading-relaxed text-[#262626] outline-none focus:border-stone-400"
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={loading || !input.trim()}
                    onClick={async () => {
                      const ok = await sendPlayerInput(input, perspective, narrativeGenOptions)
                      if (ok) setInput('')
                    }}
                    className="rounded-lg bg-neutral-900 px-4 py-1.5 text-[13px] font-medium text-white transition-all hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {loading ? '发送中…' : '发送'}
                  </button>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() =>
                void sendPlayerInput('继续推进剧情', perspective, narrativeGenOptions)
              }
              disabled={loading}
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white/80 px-3 py-1.5 text-[13px] text-[#262626]"
            >
              <Sparkles className="size-4 text-stone-500" />
              {loading ? '推进中...' : '自动推进'}
            </button>
          </div>
        </div>
      )}

      {editOpen ? (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/35 p-4">
          <div className="w-full max-w-[520px] rounded-2xl border border-stone-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <p className="text-[14px] font-semibold text-stone-900">编辑角色卡片</p>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-[13px] text-stone-500 hover:bg-stone-50 hover:text-stone-700"
                onClick={() => setEditOpen(false)}
              >
                关闭
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-stone-700">头像</p>
                <div className="grid grid-cols-1 gap-2">
                  <input
                    value={editDraft.avatarUrl}
                    onChange={(e) => setEditDraft((s) => ({ ...s, avatarUrl: e.target.value }))}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-[14px] text-stone-900 outline-none focus:border-stone-400"
                    placeholder="头像 URL（https://...）"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-medium text-stone-700">身份卡外观</p>
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-stone-600">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-stone-200 accent-neutral-900"
                      checked={editDraft.cardStyle.showContent}
                      onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, showContent: e.target.checked } }))}
                    />
                    显示内容（不影响返回/菜单）
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <p className="text-[12px] text-stone-500">字体颜色</p>
                    <input
                      type="color"
                      value={editDraft.cardStyle.textColor}
                      onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, textColor: e.target.value } }))}
                      className="h-10 w-full rounded-xl border border-stone-200 bg-white px-2 py-1"
                    />
                  </label>
                  <label className="space-y-1">
                    <p className="text-[12px] text-stone-500">背景透明度</p>
                    <input
                      type="range"
                      min={0.15}
                      max={1}
                      step={0.05}
                      value={editDraft.cardStyle.bgOpacity}
                      onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, bgOpacity: Number(e.target.value) } }))}
                      className="w-full accent-neutral-900"
                    />
                  </label>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-stone-600">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-stone-200 accent-neutral-900"
                    checked={editDraft.cardStyle.glass}
                    onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, glass: e.target.checked } }))}
                  />
                  毛玻璃效果
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] text-stone-500">毛玻璃强度</p>
                      <span className="text-[12px] tabular-nums text-stone-600">{Math.round(editDraft.cardStyle.glassBlur)}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={32}
                      step={1}
                      value={editDraft.cardStyle.glassBlur}
                      onChange={(e) =>
                        setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, glassBlur: Number(e.target.value) } }))
                      }
                      className="w-full accent-neutral-900"
                      disabled={!editDraft.cardStyle.glass}
                    />
                  </label>
                  <div />
                </div>

                <div className="space-y-2">
                  <p className="text-[12px] text-stone-500">背景类型</p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'solid' as const, label: '纯色' },
                        { id: 'gradient' as const, label: '渐变' },
                        { id: 'image' as const, label: '图片' },
                      ] as const
                    ).map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, bgMode: x.id } }))}
                        className={`rounded-xl border px-3 py-2 text-[12px] transition-all ${
                          editDraft.cardStyle.bgMode === x.id ? 'border-stone-300 bg-stone-100 text-stone-900' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        {x.label}
                      </button>
                    ))}
                  </div>

                  {editDraft.cardStyle.bgMode === 'solid' ? (
                    <label className="mt-2 block space-y-1">
                      <p className="text-[12px] text-stone-500">纯色</p>
                      <input
                        type="color"
                        value={editDraft.cardStyle.solidColor}
                        onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, solidColor: e.target.value } }))}
                        className="h-10 w-full rounded-xl border border-stone-200 bg-white px-2 py-1"
                      />
                    </label>
                  ) : null}

                  {editDraft.cardStyle.bgMode === 'gradient' ? (
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      <label className="space-y-1">
                        <p className="text-[12px] text-stone-500">起</p>
                        <input
                          type="color"
                          value={editDraft.cardStyle.gradientFrom}
                          onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, gradientFrom: e.target.value } }))}
                          className="h-10 w-full rounded-xl border border-stone-200 bg-white px-2 py-1"
                        />
                      </label>
                      <label className="space-y-1">
                        <p className="text-[12px] text-stone-500">止</p>
                        <input
                          type="color"
                          value={editDraft.cardStyle.gradientTo}
                          onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, gradientTo: e.target.value } }))}
                          className="h-10 w-full rounded-xl border border-stone-200 bg-white px-2 py-1"
                        />
                      </label>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] text-stone-500">角度</p>
                          <span className="text-[12px] tabular-nums text-stone-600">{Math.round(editDraft.cardStyle.gradientAngle)}°</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          step={1}
                          value={editDraft.cardStyle.gradientAngle}
                          onChange={(e) =>
                            setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, gradientAngle: Number(e.target.value) } }))
                          }
                          className="h-10 w-full accent-neutral-900"
                        />
                      </div>
                    </div>
                  ) : null}

                  {editDraft.cardStyle.bgMode === 'image' ? (
                    <div className="mt-2 space-y-2">
                      <label className="block space-y-1">
                        <p className="text-[12px] text-stone-500">图片 URL</p>
                        <input
                          value={editDraft.cardStyle.imageUrl}
                          onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, imageUrl: e.target.value } }))}
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-[14px] text-stone-900 outline-none focus:border-stone-400"
                          placeholder="https://... 或 data:image/..."
                        />
                      </label>
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => void onPickCardImageFile(e.target.files?.[0] ?? null)}
                          className="block w-full text-[12px] text-stone-600 file:mr-3 file:rounded-lg file:border file:border-stone-200 file:bg-white file:px-3 file:py-2 file:text-[12px] file:text-stone-700 hover:file:bg-stone-50"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>

                <div className="mt-2 rounded-2xl border border-stone-200 bg-stone-50 p-3">
                  <p className="mb-2 text-[12px] text-stone-500">预览</p>
                  <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-4" style={{ color: editDraft.cardStyle.textColor }}>
                    <div
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        opacity: editDraft.cardStyle.bgOpacity,
                        backgroundColor: editDraft.cardStyle.bgMode === 'solid' ? editDraft.cardStyle.solidColor : undefined,
                        backgroundImage:
                          editDraft.cardStyle.bgMode === 'gradient'
                            ? `linear-gradient(${editDraft.cardStyle.gradientAngle}deg, ${editDraft.cardStyle.gradientFrom}, ${editDraft.cardStyle.gradientTo})`
                            : editDraft.cardStyle.bgMode === 'image' && editDraft.cardStyle.imageUrl
                              ? `url(${editDraft.cardStyle.imageUrl})`
                              : undefined,
                        backgroundSize: editDraft.cardStyle.bgMode === 'image' ? 'cover' : undefined,
                        backgroundPosition: editDraft.cardStyle.bgMode === 'image' ? 'center' : undefined,
                      }}
                    />
                    {editDraft.cardStyle.glass ? (
                      <div
                        className="absolute inset-0 rounded-2xl"
                        style={{
                          background: 'rgba(255,255,255,0.42)',
                          border: '1px solid rgba(231,229,228,0.75)',
                          backdropFilter: `blur(${Math.max(0, Math.min(40, editDraft.cardStyle.glassBlur))}px)`,
                          WebkitBackdropFilter: `blur(${Math.max(0, Math.min(40, editDraft.cardStyle.glassBlur))}px)`,
                        }}
                      />
                    ) : null}
                    <div className="relative">
                      <p className="text-[14px] font-semibold">{currentCharacter.realName}</p>
                      <p className="mt-1 text-[12px] opacity-70">{currentCharacter.motto}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white p-3">
                <p className="mb-2 text-[12px] font-medium text-stone-700">标签调试（最末尾）</p>
                <div className="space-y-2">
                  <p className="text-[12px] text-stone-500">标签背景类型</p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'solid' as const, label: '纯色' },
                        { id: 'gradient' as const, label: '渐变' },
                        { id: 'image' as const, label: '图片' },
                      ] as const
                    ).map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, tagBgMode: x.id } }))}
                        className={`rounded-xl border px-3 py-2 text-[12px] transition-all ${
                          editDraft.cardStyle.tagBgMode === x.id
                            ? 'border-stone-300 bg-stone-100 text-stone-900'
                            : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        {x.label}
                      </button>
                    ))}
                  </div>

                  {editDraft.cardStyle.tagBgMode === 'solid' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <p className="text-[12px] text-stone-500">背景色</p>
                        <input
                          type="color"
                          value={editDraft.cardStyle.tagSolidColor}
                          onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, tagSolidColor: e.target.value } }))}
                          className="h-10 w-full rounded-xl border border-stone-200 bg-white px-2 py-1"
                        />
                      </label>
                      <label className="space-y-1">
                        <p className="text-[12px] text-stone-500">文字色</p>
                        <input
                          type="color"
                          value={editDraft.cardStyle.tagTextColor}
                          onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, tagTextColor: e.target.value } }))}
                          className="h-10 w-full rounded-xl border border-stone-200 bg-white px-2 py-1"
                        />
                      </label>
                    </div>
                  ) : null}

                  {editDraft.cardStyle.tagBgMode === 'gradient' ? (
                    <div className="grid grid-cols-3 gap-3">
                      <label className="space-y-1">
                        <p className="text-[12px] text-stone-500">起</p>
                        <input
                          type="color"
                          value={editDraft.cardStyle.tagGradientFrom}
                          onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, tagGradientFrom: e.target.value } }))}
                          className="h-10 w-full rounded-xl border border-stone-200 bg-white px-2 py-1"
                        />
                      </label>
                      <label className="space-y-1">
                        <p className="text-[12px] text-stone-500">止</p>
                        <input
                          type="color"
                          value={editDraft.cardStyle.tagGradientTo}
                          onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, tagGradientTo: e.target.value } }))}
                          className="h-10 w-full rounded-xl border border-stone-200 bg-white px-2 py-1"
                        />
                      </label>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] text-stone-500">角度</p>
                          <span className="text-[12px] tabular-nums text-stone-600">{Math.round(editDraft.cardStyle.tagGradientAngle)}°</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          step={1}
                          value={editDraft.cardStyle.tagGradientAngle}
                          onChange={(e) =>
                            setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, tagGradientAngle: Number(e.target.value) } }))
                          }
                          className="w-full accent-neutral-900"
                        />
                      </div>
                    </div>
                  ) : null}

                  {editDraft.cardStyle.tagBgMode === 'image' ? (
                    <div className="space-y-2">
                      <label className="block space-y-1">
                        <p className="text-[12px] text-stone-500">图片 URL</p>
                        <input
                          value={editDraft.cardStyle.tagImageUrl}
                          onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, tagImageUrl: e.target.value } }))}
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-[14px] text-stone-900 outline-none focus:border-stone-400"
                          placeholder="https://... 或 data:image/..."
                        />
                      </label>
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => void onPickTagImageFile(e.target.files?.[0] ?? null)}
                          className="block w-full text-[12px] text-stone-600 file:mr-3 file:rounded-lg file:border file:border-stone-200 file:bg-white file:px-3 file:py-2 file:text-[12px] file:text-stone-700 hover:file:bg-stone-50"
                        />
                      </label>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <p className="text-[12px] text-stone-500">文字色</p>
                      <input
                        type="color"
                        value={editDraft.cardStyle.tagTextColor}
                        onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, tagTextColor: e.target.value } }))}
                        className="h-10 w-full rounded-xl border border-stone-200 bg-white px-2 py-1"
                      />
                    </label>
                    <label className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] text-stone-500">背景透明度</p>
                        <span className="text-[12px] tabular-nums text-stone-600">{Math.round(editDraft.cardStyle.tagBgOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={1}
                        step={0.05}
                        value={editDraft.cardStyle.tagBgOpacity}
                        onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, tagBgOpacity: Number(e.target.value) } }))}
                        className="w-full accent-neutral-900"
                      />
                    </label>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] text-stone-500">圆角</p>
                    <span className="text-[12px] tabular-nums text-stone-600">
                      {editDraft.cardStyle.tagRadius >= 999 ? '胶囊' : `${Math.round(editDraft.cardStyle.tagRadius)}px`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={15}
                    step={1}
                    value={Math.min(15, editDraft.cardStyle.tagRadius)}
                    onChange={(e) => setEditDraft((s) => ({ ...s, cardStyle: { ...s.cardStyle, tagRadius: Number(e.target.value) } }))}
                    className="w-full accent-neutral-900"
                  />
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] text-stone-600">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-stone-200 accent-neutral-900"
                      checked={editDraft.cardStyle.tagRadius >= 999}
                      onChange={(e) =>
                        setEditDraft((s) => ({
                          ...s,
                          cardStyle: { ...s.cardStyle, tagRadius: e.target.checked ? 999 : Math.min(10, s.cardStyle.tagRadius) },
                        }))
                      }
                    />
                    胶囊
                  </label>
                </div>
                <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 p-3">
                  <p className="mb-2 text-[12px] text-stone-500">标签预览</p>
                  <div className="flex flex-wrap gap-2">
                    {currentCharacter.identityTags.slice(0, 5).map((t) => {
                      const parsed = parseIdentityTag(t)
                      if (!parsed.text) return null
                      if (parsed.isPainPoint) {
                        return (
                          <span
                            key={t}
                            className="px-2.5 py-1 text-[11px] font-medium"
                            style={{
                              background: '#fee2e2',
                              border: '1px solid #fecaca',
                              color: '#b91c1c',
                              borderRadius: editDraft.cardStyle.tagRadius,
                            }}
                          >
                            {parsed.text}
                          </span>
                        )
                      }
                      return (
                        <span
                          key={t}
                          className="px-2.5 py-1 text-[11px] font-medium"
                          style={{
                            opacity: editDraft.cardStyle.tagBgOpacity,
                            backgroundColor: editDraft.cardStyle.tagBgMode === 'solid' ? editDraft.cardStyle.tagSolidColor : undefined,
                            backgroundImage:
                              editDraft.cardStyle.tagBgMode === 'gradient'
                                ? `linear-gradient(${editDraft.cardStyle.tagGradientAngle}deg, ${editDraft.cardStyle.tagGradientFrom}, ${editDraft.cardStyle.tagGradientTo})`
                                : editDraft.cardStyle.tagBgMode === 'image' && editDraft.cardStyle.tagImageUrl
                                  ? `url(${editDraft.cardStyle.tagImageUrl})`
                                  : undefined,
                            backgroundSize: editDraft.cardStyle.tagBgMode === 'image' ? 'cover' : undefined,
                            backgroundPosition: editDraft.cardStyle.tagBgMode === 'image' ? 'center' : undefined,
                            color: editDraft.cardStyle.tagTextColor,
                            borderRadius: editDraft.cardStyle.tagRadius,
                          }}
                        >
                          {parsed.text}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-stone-100 px-4 py-3">
              <button
                type="button"
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-[14px] text-stone-700 hover:bg-stone-50"
                onClick={() => setEditOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-xl bg-neutral-900 px-4 py-2 text-[14px] font-medium text-white hover:bg-neutral-800"
                onClick={() => {
                  updateCharacter(currentCharacter.id, {
                    avatarUrl: editDraft.avatarUrl.trim() || currentCharacter.avatarUrl,
                    cardStyle: editDraft.cardStyle,
                  })
                  setEditOpen(false)
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {initialBiasOpen ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-[520px] rounded-2xl border border-stone-200 bg-white p-4 shadow-lg">
            <p className="text-center text-[16px] font-semibold text-[#262626]">首段剧情生成偏向</p>
            <p className="mt-2 text-center text-[12px] leading-relaxed text-[#8e8e8e]">
              请输入你希望的开场方向（语气、节奏、关系状态、场景等），用于生成第一段线下剧情。
            </p>
            <textarea
              value={initialBiasText}
              onChange={(e) => setInitialBiasText(e.target.value)}
              rows={5}
              maxLength={320}
              placeholder="例：校园晚自习后，克制慢热，不要暧昧过头，先从细节互动开始。"
              className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-[13px] leading-relaxed text-[#262626] outline-none transition-all duration-200 focus:border-stone-400"
            />
            <p className="mt-1 text-right text-[11px] text-[#8e8e8e]">{initialBiasText.length}/320</p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-[13px] text-[#262626] hover:bg-stone-50"
                onClick={() => {
                  setInitialBiasOpen(false)
                  setInitialBiasDismissedFor(currentCharacter.id)
                }}
              >
                稍后再说
              </button>
              <button
                type="button"
                className="rounded-xl bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-neutral-800"
                onClick={() => {
                  setInitialBiasOpen(false)
                  void generateInitialPlot({
                    bias: initialBiasText,
                    perspective,
                    genOptions: narrativeGenOptions,
                  })
                }}
              >
                生成首段剧情
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {retryBiasOpen ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-[520px] rounded-2xl border border-stone-200 bg-white p-4 shadow-lg">
            <p className="text-center text-[16px] font-semibold text-[#262626]">重新回复偏向</p>
            <p className="mt-2 text-center text-[12px] leading-relaxed text-[#8e8e8e]">
              填写你希望本轮剧情偏向的方向（选填），将撤销该轮并重生一版回复。
            </p>
            <textarea
              value={retryBiasText}
              onChange={(e) => setRetryBiasText(e.target.value.slice(0, 320))}
              rows={5}
              maxLength={320}
              placeholder="例：对白更直接一点，减少环境描写，先把冲突点说开。"
              className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-[13px] leading-relaxed text-[#262626] outline-none transition-all duration-200 focus:border-stone-400"
            />
            <p className="mt-1 text-right text-[11px] text-[#8e8e8e]">{retryBiasText.length}/320</p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-[13px] text-[#262626] hover:bg-stone-50"
                onClick={() => {
                  setRetryBiasOpen(false)
                  setRetryBiasText('')
                  setRetryTargetPlotId(null)
                }}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-xl bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-neutral-800"
                onClick={confirmRetryWithBias}
              >
                确认重试
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <StyleSettingsDrawer
        open={styleDrawerOpen}
        characterId={currentCharacter.id}
        onClose={() => setStyleDrawerOpen(false)}
        onSaved={(v) => setStyleTuning(v)}
      />

      <HeartWhisperModal
        open={heartWhisperOpen}
        loading={heartWhisperLoading}
        data={heartWhisperData}
        onClose={() => setHeartWhisperOpen(false)}
        onGenerate={() => {
          void generateHeartWhisper()
        }}
      />
    </div>
  )
}

