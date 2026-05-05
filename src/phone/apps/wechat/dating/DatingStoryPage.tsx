import {
  ArrowLeft,
  ChevronDown,
  FilePenLine,
  Heart,
  Layers,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Undo2,
} from 'lucide-react'
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character, PlayerIdentity } from '../newFriendsPersona/types'
import { formatWorldBackgroundForPrompt } from '../newFriendsPersona/worldBackgroundFormat'
import { loadOfflineDatingPlotsPromptBlock } from './loadOfflineDatingPlotsForWechatPrompt'
import { requestWeChatHeartWhisper, type ChatTranscriptTurn } from '../wechatChatAi'
import { buildMemoryRelevanceHaystack } from '../wechatMemoryPromptBlocks'
import { HeartWhisperModal } from '../HeartWhisperModal'
import { useDating, vnRollbackJumpStorageKey } from './DatingContext'
import { splitDatingAssistantOutput } from './plotCoT'
import { StoryFeed } from './StoryFeed'
import { StyleSettingsDrawer } from './StyleSettingsDrawer'
import { loadDatingStyleTuning, type DatingStyleTuning } from './styleTuningStorage'
import { DATING_AI_LENGTH_TARGET_MAX, DATING_AI_LENGTH_TARGET_MIN } from './types'
import type { BranchOption, DatingCardStyle, NarrativePerspective } from './types'
import type { HeartWhisper } from '../newFriendsPersona/types'
import { VNDialogBox } from './VNDialogBox'
import { VNBottomControls } from './VNBottomControls'
import { VNStoreProvider, useActiveSprite, useVNStore } from './useVNStore'
import { SpriteEditorPage } from './SpriteEditorPage'
import { ChromaKeyRenderer } from './ChromaKeyRenderer'
import { extractVnBackgroundCue, resolveVnBackgroundByName, VN_BACKGROUND_ASSETS } from './vnBackgroundCatalog'
import {
  extractVnBgmCueName,
  resolveVnBgmByName,
  vnBgmAssetDiversityKey,
  VN_BGM_DIVERSITY_WINDOW,
} from './vnBgmCatalog'
import { createMiniMaxT2ASyncAudioBlob } from '../../voiceprint/services/minimaxApi'

type Props = {
  onBackToSelect: () => void
}

const DATING_HEART_WHISPER_KV_PREFIX = 'wechat-dating-heart-whisper-v1:'
const VN_LINE_VOICE_CACHE_KV_PREFIX = 'wechat-dating-vn-line-voice-cache-v1:'
const VN_LINE_TTS_REQ_KV_PREFIX = 'wechat-dating-vn-line-tts-req-v1:'

function datingHeartWhisperKvKey(characterId: string) {
  return `${DATING_HEART_WHISPER_KV_PREFIX}${String(characterId || '').trim()}`
}

function vnLineVoiceCacheKvKey(characterId: string) {
  return `${VN_LINE_VOICE_CACHE_KV_PREFIX}${String(characterId || '').trim()}`
}

function vnLineTtsReqKvKey(characterId: string) {
  return `${VN_LINE_TTS_REQ_KV_PREFIX}${String(characterId || '').trim()}`
}

function isLikelyVnVoiceParamsArtifactLine(rawLine: string): boolean {
  const line = String(rawLine || '').trim()
  if (!line) return false
  if (/【\s*VN语音参数(?:结束)?\s*】/u.test(line)) return true
  if (/(?:^|[{"\s,])idx(?:\s*["'}\],]|:)|emotion\s*:|tone\s*:/i.test(line)) {
    // 仅当行整体看起来像 JSON/参数碎片时才剔除，避免误伤正常剧情。
    const reduced = line.replace(/[\u4e00-\u9fa5]/g, '').trim()
    if (/^[\[\]\{\}",:a-z0-9_\-\s.]+$/i.test(reduced)) return true
  }
  return false
}

function extractVnVoiceParamsBlock(raw: string): { cleanedText: string; items: Array<{ idx: number; emotion: string; tone: string }> } {
  const source = String(raw || '')
  const startMatch = /【\s*VN语音参数\s*】/u.exec(source)
  if (!startMatch || startMatch.index < 0) {
    const cleanedText = source
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter((x) => x && !isLikelyVnVoiceParamsArtifactLine(x))
      .join('\n')
      .trim()
    return { cleanedText, items: [] }
  }
  const start = startMatch.index
  const endRegex = /【\s*VN语音参数结束\s*】/gu
  endRegex.lastIndex = start + startMatch[0].length
  const endMatch = endRegex.exec(source)
  const end = endMatch ? endMatch.index : -1
  const block = end >= 0 ? source.slice(start, end + endMatch![0].length) : source.slice(start)
  const cleanedTextRaw = source.slice(0, start) + (end >= 0 ? source.slice(end + endMatch![0].length) : '')
  const cleanedText = cleanedTextRaw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x && !isLikelyVnVoiceParamsArtifactLine(x))
    .join('\n')
    .trim()
  const jsonText = block.match(/\[[\s\S]*?\]/)?.[0] || '[]'
  try {
    const arr = JSON.parse(jsonText) as Array<{ idx?: unknown; emotion?: unknown; tone?: unknown }>
    const items = (Array.isArray(arr) ? arr : [])
      .map((x) => ({
        idx: Number((x as any)?.idx),
        emotion: String((x as any)?.emotion ?? '').trim(),
        tone: String((x as any)?.tone ?? '').trim(),
      }))
      .filter((x) => Number.isFinite(x.idx) && x.idx >= 0 && !!x.emotion && !!x.tone)
    return { cleanedText, items }
  } catch {
    return { cleanedText, items: [] }
  }
}

function parseIdentityTag(tag: string): { text: string; isPainPoint: boolean } {
  const raw = String(tag || '').trim()
  if (!raw) return { text: '', isPainPoint: false }
  if (/^雷点[·:：]/.test(raw)) {
    return { text: raw.replace(/^雷点[·:：]\s*/, '').trim(), isPainPoint: true }
  }
  return { text: raw, isPainPoint: false }
}

function stripSpeechQuotes(text: string): string {
  return text.replace(/[“”"「」『』]/g, '')
}

function parseVnBubble(raw: string, defaultSpeaker: string): { text: string; speaker: string | null } {
  const firstLine = String(raw || '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .find((x) => x.length > 0) || ''
  if (!firstLine) return { text: '', speaker: null }

  const noQuotes = stripSpeechQuotes(firstLine).replace(/^[-*•\d.)\s]+/, '').trim()
  const speakerMatch = noQuotes.match(/^([^：:]{1,24}(?:（\s*你\s*）|\(\s*你\s*\))?)[：:]\s*(.+)$/su)
  if (speakerMatch) {
    let speaker = speakerMatch[1]!.trim()
    let content = speakerMatch[2]!.trim()
    if (!content) return { text: '', speaker: null }
    // 模型误把两行压成一行，例如「纪旌：祁昀澈（你）：雨小了」——界面只认第一个冒号，会把玩家对白挂到 NPC 气泡。若冒号后仍以「某某（你）：」开头，则以内层说话人为准。
    const innerYou = content.match(
      /^([^：\n]{1,24}(?:（\s*你\s*）|\(\s*你\s*\)))[：:]\s*([\s\S]+)$/u,
    )
    if (
      innerYou &&
      innerYou[1] &&
      innerYou[2] &&
      /（\s*你\s*）|\(\s*你\s*\)/u.test(innerYou[1]) &&
      innerYou[1].trim() !== speaker
    ) {
      speaker = innerYou[1].trim()
      content = innerYou[2].trim()
    }
    if (/^(旁白|叙述|系统|narrator)$/i.test(speaker)) {
      return { text: content, speaker: null }
    }
    return { text: content, speaker: speaker || defaultSpeaker }
  }

  // 未命中「姓名：内容」时一律按旁白处理，避免误显示姓名框。
  const text = noQuotes
  return { text, speaker: null }
}

function sanitizeDanglingThoughtMarker(text: string): string {
  let t = String(text || '').trim()
  if (!t) return ''
  // 避免换行拆条后出现孤立单个 *（例如句尾只剩一个 *）。
  if (t.endsWith('*') && !t.endsWith('**')) t = t.slice(0, -1).trimEnd()
  if (t.startsWith('*') && !t.startsWith('**')) t = t.slice(1).trimStart()
  return t
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 「（你）」仅用于玩家行首标签；NPC/旁白正文中误写的「玩家名（你）」去掉后缀，避免穿帮 */
function stripMisplacedYouInDialogueBody(text: string, userDisplayName: string, speaker: string | null): string {
  const u = String(userDisplayName || '').trim()
  if (!u) return text
  const sp = String(speaker || '').trim()
  const norm = (x: string) => x.replace(/\s+/g, '')
  const isPlayerSpeaker =
    !!sp &&
    (/（\s*你\s*）|\(\s*你\s*\)/u.test(sp) || norm(sp) === norm(u) || norm(sp) === norm(`${u}（你）`))
  if (isPlayerSpeaker) return text
  try {
    const re = new RegExp(`${escapeRegExp(u)}（\\s*你\\s*）`, 'g')
    return String(text || '').replace(re, u)
  } catch {
    return text
  }
}

function extractVnFlashbackCue(rawLine: string): { kind: 'start' | 'end' | null; rest: string } {
  const t = String(rawLine || '').trim()
  if (!t) return { kind: null, rest: '' }
  const startMatch = t.match(/^【\s*(?:插叙|闪回|回忆|插叙闪回)(?:\s*开始)?\s*】\s*(.*)$/u)
  if (startMatch) return { kind: 'start', rest: String(startMatch[1] || '').trim() }
  const endMatch = t.match(/^【\s*(?:插叙|闪回|回忆|插叙闪回)\s*结束\s*】\s*(.*)$/u)
  if (endMatch) return { kind: 'end', rest: String(endMatch[1] || '').trim() }
  const normalMatch = t.match(/^【\s*(?:正常剧情|主线剧情|现实线)\s*】\s*(.*)$/u)
  if (normalMatch) return { kind: 'end', rest: String(normalMatch[1] || '').trim() }
  return { kind: null, rest: t }
}

function extractVnBackgroundCueName(rawLine: string): { backgroundName: string | null; rest: string } {
  const t = String(rawLine || '').trim()
  if (!t) return { backgroundName: null, rest: '' }
  const m1 = t.match(/^【\s*背景\s*】\s*(.+)$/u)
  if (m1?.[1]) return { backgroundName: String(m1[1] || '').trim(), rest: '' }
  const m2 = t.match(/^背景[：:]\s*(.+)$/u)
  if (m2?.[1]) return { backgroundName: String(m2[1] || '').trim(), rest: '' }
  const viaParser = extractVnBackgroundCue(t)
  if (viaParser.backgroundName) {
    return { backgroundName: viaParser.backgroundName, rest: String(viaParser.cleanedText || '').trim() }
  }
  return { backgroundName: null, rest: t }
}

function stripInnerThoughtDecorators(text: string): string {
  let t = String(text || '').trim()
  if (!t) return ''
  t = t.replace(/^(?:\(|（|\[|【)?\s*(?:内心|心声|OS|os)\s*(?:\)|）|\]|】)?[：:]\s*/u, '')
  const wrapMatch = t.match(/^\*{1,2}([\s\S]+)\*{1,2}$/u)
  if (wrapMatch?.[1]) t = wrapMatch[1].trim()
  return t
}

type SplitTaggedVnLineResult =
  | { mode: 'tagged-narration'; body: string }
  | { mode: 'tagged-inner'; body: string; innerSpeaker: string | null }
  | { mode: 'tagged-dialogue'; body: string }
  | { mode: 'legacy'; body: string }

/**
 * 行首标签为唯一气泡类型来源（与提示词一致）；不做正文语义推断。
 * 无标签行：若符合「姓名：」语法则视为**兼容旧稿的对白**，否则整行视为旁白。
 * 【内心｜姓名】先于 【内心】 匹配，用于姓名条与剧情日志展示「谁的内心」。
 */
function splitTaggedVnLine(raw: string): SplitTaggedVnLineResult {
  const t = String(raw || '').trim()
  if (!t) return { mode: 'legacy', body: '' }
  const nar = t.match(/^【\s*旁白\s*】\s*(.*)$/su)
  if (nar) return { mode: 'tagged-narration', body: String(nar[1] || '').trim() }
  const innNamed = t.match(/^【\s*(?:内心|心声|OS|os)\s*[｜|]\s*([^】]+?)\s*】\s*(.*)$/su)
  if (innNamed) {
    const innerSpeaker = String(innNamed[1] || '').trim()
    return {
      mode: 'tagged-inner',
      body: String(innNamed[2] || '').trim(),
      innerSpeaker: innerSpeaker.length ? innerSpeaker : null,
    }
  }
  const inn = t.match(/^【\s*(?:内心|心声|OS|os)\s*】\s*(.*)$/su)
  if (inn) return { mode: 'tagged-inner', body: String(inn[1] || '').trim(), innerSpeaker: null }
  const dia = t.match(/^【\s*对白\s*】\s*(.+)$/su)
  if (dia) return { mode: 'tagged-dialogue', body: String(dia[1] || '').trim() }
  return { mode: 'legacy', body: t }
}

/** 一行即一个气泡；不在此按字数/标点切段，边界完全由模型正文换行决定（见 DatingContext VN 格式说明）。 */
function splitVnContentToBubbles(
  raw: string,
  defaultSpeaker: string,
  userDisplayName?: string,
): Array<{
  text: string
  speaker: string | null
  isInnerThought: boolean
  bgmCueName: string | null
  backgroundCueName: string | null
  isFlashback: boolean
}> {
  const source = String(raw || '').trim()
  if (!source) return []
  const lines = source
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
  const blocks = lines.length ? lines : [source]
  const out: Array<{
    text: string
    speaker: string | null
    isInnerThought: boolean
    bgmCueName: string | null
    backgroundCueName: string | null
    isFlashback: boolean
  }> = []
  let pendingBgmCue: string | null = null
  let pendingBgCue: string | null = null
  let flashbackMode = false
  for (const block of blocks) {
    const flashbackCue = extractVnFlashbackCue(block)
    if (flashbackCue.kind === 'start') {
      flashbackMode = true
    }
    if (flashbackCue.kind === 'end') {
      flashbackMode = false
    }
    const coreLine = flashbackCue.rest
    if (!coreLine) continue
    const bgmCueName = extractVnBgmCueName(coreLine)
    if (bgmCueName) {
      pendingBgmCue = bgmCueName
      continue
    }
    const bgCue = extractVnBackgroundCueName(coreLine)
    if (bgCue.backgroundName) pendingBgCue = bgCue.backgroundName
    const lineForBubble = String(bgCue.rest || '').trim()
    if (!lineForBubble) continue
    const tagged = splitTaggedVnLine(lineForBubble)
    let speaker: string | null = null
    let isInnerThoughtLine = false
    let clean = ''
    if (tagged.mode === 'tagged-narration') {
      clean = sanitizeDanglingThoughtMarker(String(tagged.body || '').replace(/\*\*/g, ''))
      if (userDisplayName?.trim()) {
        clean = stripMisplacedYouInDialogueBody(clean, userDisplayName.trim(), null)
      }
    } else if (tagged.mode === 'tagged-inner') {
      isInnerThoughtLine = true
      speaker = tagged.innerSpeaker?.trim() ? tagged.innerSpeaker.trim() : null
      const stripped = stripInnerThoughtDecorators(tagged.body)
      clean = sanitizeDanglingThoughtMarker(String(stripped || '').replace(/\*\*/g, ''))
      if (userDisplayName?.trim()) {
        clean = stripMisplacedYouInDialogueBody(clean, userDisplayName.trim(), speaker)
      }
    } else if (tagged.mode === 'tagged-dialogue') {
      const parsed = parseVnBubble(tagged.body, defaultSpeaker)
      if (!parsed.text) continue
      speaker = String(parsed.speaker || '').trim() || null
      clean = sanitizeDanglingThoughtMarker(String(parsed.text || '').replace(/\*\*/g, ''))
      if (userDisplayName?.trim()) {
        clean = stripMisplacedYouInDialogueBody(clean, userDisplayName.trim(), speaker)
      }
    } else {
      const parsed = parseVnBubble(lineForBubble, defaultSpeaker)
      if (parsed.speaker && parsed.text) {
        speaker = String(parsed.speaker || '').trim() || null
        clean = sanitizeDanglingThoughtMarker(String(parsed.text || '').replace(/\*\*/g, ''))
        if (userDisplayName?.trim()) {
          clean = stripMisplacedYouInDialogueBody(clean, userDisplayName.trim(), speaker)
        }
      } else {
        clean = sanitizeDanglingThoughtMarker(String(parsed.text || lineForBubble || '').replace(/\*\*/g, ''))
        if (userDisplayName?.trim()) {
          clean = stripMisplacedYouInDialogueBody(clean, userDisplayName.trim(), null)
        }
      }
    }
    if (!clean) continue
    out.push({
      text: clean,
      speaker,
      isInnerThought: isInnerThoughtLine,
      bgmCueName: pendingBgmCue,
      backgroundCueName: pendingBgCue,
      isFlashback: flashbackMode,
    })
    pendingBgmCue = null
    pendingBgCue = null
  }
  return out
}

function vnProgressLsKey(characterId: string): string {
  return `wechat-dating-vn-progress:${String(characterId || '').trim()}`
}
const VN_PROGRESS_GLOBAL_KEY = 'wechat-dating-vn-progress:global'

function buildVnAiProgressSignature(rawAiContent: string): string {
  return splitDatingAssistantOutput(String(rawAiContent || '')).content.trim().slice(0, 140)
}

type VnLogEntryKind = 'dialogue' | 'narration' | 'innerThought'
type VnLogEntry = {
  id: string
  kind: VnLogEntryKind
  name: string | null
  text: string
  isUser?: boolean
  speakerId?: string | null
  voiceCacheKey?: string
  order?: number
}

function VnLogItemRenderer({
  item,
  canPlayVoice = false,
  playing = false,
  generating = false,
  onPlayVoice,
}: {
  item: VnLogEntry
  canPlayVoice?: boolean
  playing?: boolean
  generating?: boolean
  onPlayVoice?: () => void
}) {
  if (item.kind === 'narration') {
    return (
      <div className="px-8 py-1.5 text-center text-[13px] font-light leading-relaxed text-gray-500">
        {item.text}
      </div>
    )
  }
  if (item.kind === 'innerThought') {
    return (
      <div className="rounded-xl border border-[#E8DDC8]/65 bg-white/70 px-4 py-3">
        <p className="mb-1 text-[11px] tracking-[0.12em] text-[#8B7B62]/80">
          [{item.name || '未署名'}] 的内心
        </p>
        <p className="font-serif text-[15px] italic leading-relaxed text-[#C5A880]">“{item.text}”</p>
      </div>
    )
  }
  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={
        item.isUser
          ? {
              borderColor: '#B9C9E6',
              background: '#EDF4FF',
            }
          : {
              borderColor: '#E7EAEE',
              background: '#FFFFFF',
            }
      }
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p
          className="text-xs font-semibold tracking-[0.04em]"
          style={{ color: item.isUser ? '#2F5F9A' : '#1C1C1E' }}
        >
          {item.name || '未署名'}
        </p>
        {canPlayVoice ? (
          <button
            type="button"
            onClick={onPlayVoice}
            className="inline-flex items-center justify-center rounded-full border border-[#E2E8F0] bg-white p-1 text-[#4B5563] transition hover:bg-[#F8FAFC]"
            title="播放对白语音"
            aria-label="播放对白语音"
          >
            {generating ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={1.8} />
            ) : playing ? (
              <Pause className="size-3.5" strokeWidth={1.8} />
            ) : (
              <Play className="size-3.5" strokeWidth={1.8} />
            )}
          </button>
        ) : null}
      </div>
      <p className="text-[15px] leading-relaxed text-[#2B313B]">{item.text}</p>
    </div>
  )
}

export function DatingStoryPage(props: Props) {
  return (
    <VNStoreProvider>
      <DatingStoryPageInner {...props} />
    </VNStoreProvider>
  )
}

export default DatingStoryPage
function DatingStoryPageInner({ onBackToSelect }: Props) {
  const VN_BG_FALLBACK =
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80'
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
    setVnVoiceDisabled,
    setVnCustomInputParaphrase,
    sendPlayerInput,
    stageBranchChoice,
    branchesLoading,
    generateInitialPlot,
    resetCurrentArchive,
    regeneratingPlotId,
    updatePlotItem,
    setPlotVersionIndex,
    deletePlotItem,
    regenerateAiPlot,
    vnRollbackLastRound,
  } = useDating()
  const [input, setInput] = useState('')
  const [keyboardPad, setKeyboardPad] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [portraitSetupOpen, setPortraitSetupOpen] = useState(false)
  const [bgmConfigOpen, setBgmConfigOpen] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [perspectiveOpen, setPerspectiveOpen] = useState(false)
  const [perspective, setPerspective] = useState<NarrativePerspective>('second')
  const [lengthOpen, setLengthOpen] = useState(false)
  const [lengthTargetChars, setLengthTargetChars] = useState('500')
  const [autoUserOpen, setAutoUserOpen] = useState(false)
  const [autoUserReaction, setAutoUserReaction] = useState(false)
  const [initialBiasOpen, setInitialBiasOpen] = useState(false)
  const [initialBiasText, setInitialBiasText] = useState('')
  const [initialBiasDismissedFor, setInitialBiasDismissedFor] = useState<string | null>(null)
  const [retryBiasOpen, setRetryBiasOpen] = useState(false)
  const [retryBiasText, setRetryBiasText] = useState('')
  const [retryTargetPlotId, setRetryTargetPlotId] = useState<string | null>(null)
  const [vnRollbackConfirmOpen, setVnRollbackConfirmOpen] = useState(false)
  const [vnRegenerateConfirmOpen, setVnRegenerateConfirmOpen] = useState(false)
  const [styleDrawerOpen, setStyleDrawerOpen] = useState(false)
  const [styleTuning, setStyleTuning] = useState<DatingStyleTuning>(() => ({ stylePrompt: '', referenceSnippet: '' }))

  const [heartWhisperOpen, setHeartWhisperOpen] = useState(false)
  const [heartWhisperLoading, setHeartWhisperLoading] = useState(false)
  const [heartWhisperData, setHeartWhisperData] = useState<HeartWhisper | null>(null)
  const [vnCustomInput, setVnCustomInput] = useState('')
  const [vnCustomInputModalOpen, setVnCustomInputModalOpen] = useState(false)
  const [vnUserDisplayName, setVnUserDisplayName] = useState('用户')
  const [vnDanmakuModelOn, setVnDanmakuModelOn] = useState(false)
  const VN_BGM_BASE_VOLUME = 0.45
  const VN_BGM_VOLUME_SCALE_LS_KEY = 'wechat-dating-vn-bgm-volume-scale'
  const VN_BGM_BALANCE_MIN = -100
  const VN_BGM_BALANCE_MAX = 100
  const toVnBgmVolumeScale = (balance: number) => 1 + balance / 100
  const toVnBgmBalance = (scale: number) => (scale - 1) * 100
  const clampVnBgmBalance = (balance: number) => Math.max(VN_BGM_BALANCE_MIN, Math.min(VN_BGM_BALANCE_MAX, balance))
  const [vnBgmVolumeScale, setVnBgmVolumeScale] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(VN_BGM_VOLUME_SCALE_LS_KEY)
      // Number('')===0 会把「未存过」误判成静音；未配置时必须默认 1（持平）
      if (stored == null || String(stored).trim() === '') return 1
      const raw = Number(stored)
      if (!Number.isFinite(raw)) return 1
      return Math.max(0, Math.min(2, raw))
    } catch {
      return 1
    }
  })
  const vnBgmVolumeBalance = clampVnBgmBalance(toVnBgmBalance(vnBgmVolumeScale))
  const vnBgmVolume = Math.max(0, Math.min(1, VN_BGM_BASE_VOLUME * vnBgmVolumeScale))

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
      const text = p.type === 'ai' ? extractVnVoiceParamsBlock(splitDatingAssistantOutput(raw).content).cleanedText.trim() : raw
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
      const transcript = buildTranscriptFromDatingPlots()
      const hay = buildMemoryRelevanceHaystack(transcript.map((t) => t.text))
      const memoryNotes = (
        await personaDb.formatCharacterMemoriesForPromptByRelevance(cid, hay, {
          apiConfig: apiConfig?.apiUrl?.trim() && apiConfig?.apiKey?.trim() ? apiConfig : null,
        })
      ).trim() || undefined
      let worldBackgroundPrompt: string | undefined
      if (character?.worldBackgroundEnabled !== false && character?.worldBackgroundId?.trim()) {
        const wbg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
        const block = formatWorldBackgroundForPrompt(wbg)
        if (block.trim()) worldBackgroundPrompt = block
      }
      const offlineDatingPlotsContext =
        character ? await loadOfflineDatingPlotsPromptBlock(cid, character?.name ?? null) : ''
      // 线下剧情模式心语：严格基于当前剧情流生成，优先参考最新一轮 AI 剧情回复。
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
  useEffect(() => {
    let cancelled = false
    vnVoiceStyleCacheRef.current.clear()
    void (async () => {
      const cid = String(currentCharacter.id || '').trim()
      if (!cid) {
        if (!cancelled) setVnUserDisplayName('用户')
        return
      }
      try {
        const character = await personaDb.getCharacter(cid)
        const pid = character?.playerIdentityId?.trim()
        if (!pid) {
          if (!cancelled) setVnUserDisplayName('用户')
          return
        }
        const identity = await personaDb.getPlayerIdentity(pid)
        if (!cancelled) {
          setVnUserDisplayName(identity?.name?.trim() || identity?.wechatNickname?.trim() || '用户')
        }
      } catch {
        if (!cancelled) setVnUserDisplayName('用户')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentCharacter.id])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const raw = await personaDb.getPhoneKv(vnLineTtsReqKvKey(currentCharacter.id))
        if (cancelled) return
        if (!raw || typeof raw !== 'object') {
          vnLineTtsReqCacheRef.current = new Map()
          return
        }
        const entries = Object.entries(raw as Record<string, unknown>)
          .map(([k, v]) => [String(k || ''), v] as const)
          .filter(([k, v]) => !!k && !!v && typeof v === 'object')
          .map(([k, v]) => {
            const rec = v as Record<string, unknown>
            return [
              k,
              {
                voiceId: String(rec.voiceId || '').trim(),
                model: String(rec.model || '').trim(),
                emotion: normalizeVnEmotion(String(rec.emotion || 'calm')),
                tone: normalizeVnToneToken(String(rec.tone || 'breath')),
                ttsText: String(rec.ttsText || '').trim(),
              },
            ] as const
          })
          .filter(([, v]) => !!v.voiceId && !!v.ttsText)
        vnLineTtsReqCacheRef.current = new Map(entries)
      } catch {
        if (!cancelled) vnLineTtsReqCacheRef.current = new Map()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentCharacter.id])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const cid = String(currentCharacter.id || '').trim()
      if (!cid) {
        if (!cancelled) setVnDanmakuModelOn(false)
        return
      }
      try {
        const row = await personaDb.getCharacterDanmakuSettings(cid)
        if (!cancelled) setVnDanmakuModelOn(!!row?.useMemory)
      } catch {
        if (!cancelled) setVnDanmakuModelOn(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentCharacter.id])
  const toggleVnDanmakuModel = useCallback(async () => {
    const cid = String(currentCharacter.id || '').trim()
    if (!cid) return
    const next = !vnDanmakuModelOn
    setVnDanmakuModelOn(next)
    try {
      await personaDb.putCharacterDanmakuSettings({ characterId: cid, useMemory: next })
    } catch {
      setVnDanmakuModelOn(!next)
    }
  }, [currentCharacter.id, vnDanmakuModelOn])
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
  const [vnSubmitting, setVnSubmitting] = useState(false)
  const [vnBubbleIndex, setVnBubbleIndex] = useState(0)
  const [vnFabPos, setVnFabPos] = useState({ x: 0, y: 80 })
  const normalScrollRef = useRef<HTMLDivElement | null>(null)
  const vnRootRef = useRef<HTMLDivElement | null>(null)
  const vnLogScrollRef = useRef<HTMLDivElement | null>(null)
  const vnProgressRestoreReadyRef = useRef(false)
  const vnPendingRestoreIndexRef = useRef<number | null>(null)
  const vnLatestAiIdRef = useRef('')
  const vnLatestAiSigRef = useRef('')
  const vnCurrentCharIdRef = useRef('')
  const vnRafRef = useRef<number | null>(null)
  const vnAutoTimerRef = useRef<number | null>(null)
  const vnDragRef = useRef<{ pointerId: number; startX: number; startY: number; moved: boolean } | null>(null)
  const vnAutoAdvanceRef = useRef<() => void>(() => {})
  const {
    isAutoPlay,
    playSpeed,
    logOpen,
    toggleAutoPlay,
    cyclePlaySpeed,
    openLog,
    closeLog,
  } = useVNStore()
  const [spriteActors, setSpriteActors] = useState<Array<{ id: string; name: string; avatarUrl?: string }>>([
    { id: '__user__', name: '你' },
  ])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const rootId = String(currentCharacter.id || '').trim()
      if (!rootId) {
        if (!cancelled) setSpriteActors([{ id: '__user__', name: '你' }])
        return
      }
      try {
        const [rootRow, npcRows] = await Promise.all([personaDb.getCharacter(rootId), personaDb.listNpcsFor(rootId)])
        if (cancelled) return
        const mainActor = {
          id: rootId,
          name: rootRow?.name?.trim() || currentCharacter.realName,
          avatarUrl: rootRow?.avatarUrl?.trim() || currentCharacter.avatarUrl,
        }
        const npcActors = (npcRows || [])
          .map((n) => ({
            id: n.id,
            name: String(n.name || '').trim() || '未命名NPC',
            avatarUrl: String(n.avatarUrl || '').trim(),
          }))
          .filter((n) => n.id && n.id !== rootId)
        const dedup = new Map<string, { id: string; name: string; avatarUrl?: string }>()
        dedup.set('__user__', { id: '__user__', name: '你' })
        dedup.set(mainActor.id, mainActor)
        for (const n of npcActors) dedup.set(n.id, n)
        setSpriteActors(Array.from(dedup.values()))
      } catch {
        if (cancelled) return
        setSpriteActors([
          { id: '__user__', name: '你' },
          { id: rootId, name: currentCharacter.realName, avatarUrl: currentCharacter.avatarUrl },
        ])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentCharacter.avatarUrl, currentCharacter.id, currentCharacter.realName])
  const VN_FAB_SIZE = 44
  const VN_EDGE = 8
  const VN_MENU_W = 220
  const VN_MENU_H = 320

  const isVn = currentArchive.modePreference === 'vn'
  const [vnBgCurrentUrl, setVnBgCurrentUrl] = useState<string>(VN_BACKGROUND_ASSETS[0]?.url || VN_BG_FALLBACK)
  const [vnBgPrevUrl, setVnBgPrevUrl] = useState<string | null>(null)
  const [vnBgFlashOn, setVnBgFlashOn] = useState(false)
  const [vnBgmCurrentName, setVnBgmCurrentName] = useState('')
  const [vnBgmAwaitingGesture, setVnBgmAwaitingGesture] = useState(false)
  const [vnLineVoicePlaying, setVnLineVoicePlaying] = useState(false)
  const [vnLineVoiceGenerating, setVnLineVoiceGenerating] = useState(false)
  const [vnAutoVoicePlay, setVnAutoVoicePlay] = useState(false)
  const [vnToast, setVnToast] = useState<string | null>(null)
  const vnToastTimerRef = useRef<number | null>(null)
  const [vnLogPlayingId, setVnLogPlayingId] = useState<string | null>(null)
  const [vnLogGeneratingId, setVnLogGeneratingId] = useState<string | null>(null)
  const vnBgFadeTimerRef = useRef<number | null>(null)
  const vnBgFlashTimerRef = useRef<number | null>(null)
  const vnBgmAudioRef = useRef<HTMLAudioElement | null>(null)
  const vnBgmCurrentUrlRef = useRef('')
  const vnBgmPendingUrlRef = useRef('')
  const vnBgmPendingNameRef = useRef('')
  const vnBgmPendingDiversityKeyRef = useRef('')
  const vnBgmRequestedUrlRef = useRef('')
  const vnBgmRequestTokenRef = useRef(0)
  /** 最近成功切换的曲目键（用于「5 次内同一文件最多 3 次」） */
  const vnBgmRecentKeysRef = useRef<string[]>([])
  const didAutoScrollBottomRef = useRef<string>('')
  const vnLineAudioRef = useRef<HTMLAudioElement | null>(null)
  const vnLineSpeechRef = useRef<SpeechSynthesisUtterance | null>(null)
  const vnLineVoiceCacheRef = useRef(new Map<string, string>())
  const vnLastAutoVoiceKeyRef = useRef('')
  const vnVoicePlayTokenRef = useRef(0)
  const vnCurrentVoiceKeyRef = useRef('')
  const vnVoiceDoneKeyRef = useRef('')
  const vnVoiceDoneAtRef = useRef(0)
  const vnVoiceStyleCacheRef = useRef(new Map<string, { emotion: 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'calm' | 'fluent' | 'whisper'; tone: string }>())
  const vnLineTtsReqCacheRef = useRef(
    new Map<
      string,
      {
        voiceId: string
        model: string
        emotion: 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'calm' | 'fluent' | 'whisper'
        tone: string
        ttsText: string
      }
    >(),
  )

  const lengthLabel = `${lengthTargetChars || '500'}字`
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

  const stopVnLineVoice = useCallback((opts?: { invalidatePending?: boolean }) => {
    const invalidatePending = opts?.invalidatePending !== false
    const audio = vnLineAudioRef.current
    if (audio) {
      audio.pause()
      audio.onended = null
      audio.onerror = null
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      vnLineSpeechRef.current = null
    }
    // 默认使历史异步合成请求失效；但同一次播放链路内部切换音频时可选择不失效。
    if (invalidatePending) vnVoicePlayTokenRef.current += 1
    setVnLineVoicePlaying(false)
    setVnLogPlayingId(null)
  }, [])
  useEffect(() => {
    let cancelled = false
    vnVoiceStyleCacheRef.current.clear()
    void (async () => {
      try {
        const raw = await personaDb.getPhoneKv(vnLineVoiceCacheKvKey(currentCharacter.id))
        if (cancelled) return
        if (!raw || typeof raw !== 'object') {
          vnLineVoiceCacheRef.current = new Map()
          return
        }
        const entries = Object.entries(raw as Record<string, unknown>)
          .map(([k, v]) => [String(k || ''), String(v || '').trim()] as const)
          .filter(([k, v]) => !!k && !!v)
        vnLineVoiceCacheRef.current = new Map(entries)
      } catch {
        if (!cancelled) vnLineVoiceCacheRef.current = new Map()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentCharacter.id])

  const decorateVnTtsText = useCallback((text: string, tone: string) => {
    const base = String(text || '').trim().replace(/\s+/g, ' ')
    if (!base) return ''
    return `(${tone}) ${base}`
      .replace(/(\.\.\.|…+)/g, `<#0.45#>$1<#0.45#>`)
      .replace(/([，,])/g, `$1<#0.28#>`)
      .replace(/([。；;])/g, `$1<#0.42#>`)
      .replace(/([！？!?])/g, `$1<#0.52#>`)
      .replace(/\s+/g, ' ')
      .trim()
  }, [])
  const normalizeVnToneToken = useCallback((raw: string) => {
    const t = String(raw || '').trim().toLowerCase()
    const allow = new Set([
      'clear-throat', 'laughs', 'chuckle', 'coughs', 'groans', 'breath', 'pant', 'inhale', 'exhale', 'gasps',
      'sniffs', 'sighs', 'snorts', 'burps', 'lip-smacking', 'humming', 'hissing', 'emm', 'sneezes',
    ])
    return allow.has(t) ? t : 'breath'
  }, [])
  const normalizeVnEmotion = useCallback((raw: string) => {
    const t = String(raw || '').trim().toLowerCase()
    const allow = new Set(['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'whisper'])
    return (allow.has(t) ? t : 'calm') as 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'calm' | 'fluent' | 'whisper'
  }, [])
  const blobToDataUrl = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : '')
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
  }, [])
  const persistVnVoiceCache = useCallback(
    async (key: string, value: string) => {
      const map = vnLineVoiceCacheRef.current
      map.set(key, value)
      // 控制缓存体量，避免 kv 无限增长
      const entries = Array.from(map.entries())
      const sliced = entries.slice(Math.max(0, entries.length - 220))
      vnLineVoiceCacheRef.current = new Map(sliced)
      try {
        await personaDb.setPhoneKv(vnLineVoiceCacheKvKey(currentCharacter.id), Object.fromEntries(sliced))
      } catch {
        // ignore cache persistence failure
      }
    },
    [currentCharacter.id],
  )
  const persistVnLineTtsReq = useCallback(
    async (
      key: string,
      value: {
        voiceId: string
        model: string
        emotion: 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'calm' | 'fluent' | 'whisper'
        tone: string
        ttsText: string
      },
    ) => {
      const map = vnLineTtsReqCacheRef.current
      map.set(key, value)
      const entries = Array.from(map.entries())
      const sliced = entries.slice(Math.max(0, entries.length - 260))
      vnLineTtsReqCacheRef.current = new Map(sliced)
      try {
        await personaDb.setPhoneKv(vnLineTtsReqKvKey(currentCharacter.id), Object.fromEntries(sliced))
      } catch {
        // ignore cache persistence failure
      }
    },
    [currentCharacter.id],
  )
  const stopVnBgm = useCallback(() => {
    const current = vnBgmAudioRef.current
    if (current) {
      current.pause()
      current.src = ''
      vnBgmAudioRef.current = null
    }
    vnBgmCurrentUrlRef.current = ''
    vnBgmPendingUrlRef.current = ''
    vnBgmPendingNameRef.current = ''
    vnBgmPendingDiversityKeyRef.current = ''
    vnBgmRequestedUrlRef.current = ''
    vnBgmRequestTokenRef.current += 1
    setVnBgmCurrentName('')
    setVnBgmAwaitingGesture(false)
  }, [])

  useEffect(() => {
    vnBgmRecentKeysRef.current = []
  }, [currentCharacter.id])
  const updateVnBgmVolumeScale = useCallback((nextRaw: number) => {
    const next = Math.max(0, Math.min(2, nextRaw))
    setVnBgmVolumeScale(next)
    try {
      localStorage.setItem(VN_BGM_VOLUME_SCALE_LS_KEY, String(next))
    } catch {
      // ignore persistence failure
    }
  }, [])

  /** 音量滑杆须同步到「当前正在用的」Audio；仅靠在 update 里写 ref 会在 play() 尚未 resolve 时写到旧节点。 */
  useEffect(() => {
    const el = vnBgmAudioRef.current
    if (!el) return
    el.volume = vnBgmVolume
  }, [vnBgmVolume])

  const switchVnBgmByName = useCallback(
    (rawName: string | null | undefined) => {
      const name = String(rawName || '').trim()
      if (!name) return
      const hit = resolveVnBgmByName(name, { recentResolvedKeys: vnBgmRecentKeysRef.current })
      if (!hit?.url) return
      if (vnBgmCurrentUrlRef.current === hit.url) return
      if (vnBgmRequestedUrlRef.current === hit.url) return
      vnBgmRequestedUrlRef.current = hit.url
      const token = ++vnBgmRequestTokenRef.current

      const prev = vnBgmAudioRef.current
      if (prev) {
        prev.pause()
        prev.src = ''
      }
      const next = new Audio(hit.url)
      next.preload = 'auto'
      next.loop = true
      next.volume = vnBgmVolume
      vnBgmAudioRef.current = next
      const applyStart = () => {
        if (vnBgmRequestTokenRef.current !== token) {
          next.pause()
          next.src = ''
          return
        }
        vnBgmAudioRef.current = next
        vnBgmCurrentUrlRef.current = hit.url
        vnBgmPendingUrlRef.current = ''
        vnBgmPendingNameRef.current = ''
        vnBgmPendingDiversityKeyRef.current = ''
        vnBgmRequestedUrlRef.current = ''
        const dk = vnBgmAssetDiversityKey(hit)
        if (dk) {
          vnBgmRecentKeysRef.current = [...vnBgmRecentKeysRef.current, dk].slice(-VN_BGM_DIVERSITY_WINDOW)
        }
        setVnBgmCurrentName(hit.name)
        setVnBgmAwaitingGesture(false)
      }

      void next
        .play()
        .then(() => {
          applyStart()
        })
        .catch(() => {
          if (vnBgmRequestTokenRef.current !== token) {
            next.pause()
            next.src = ''
            return
          }
          // 移动端常见：未发生用户手势时被自动播放策略拦截，等待下一次点击重试。
          vnBgmPendingUrlRef.current = hit.url
          vnBgmPendingNameRef.current = hit.name
          vnBgmPendingDiversityKeyRef.current = vnBgmAssetDiversityKey(hit)
          setVnBgmAwaitingGesture(true)
        })
    },
    [vnBgmVolume],
  )

  useEffect(() => {
    if (!isVn || !vnBgmAwaitingGesture) return
    const onFirstGesture = () => {
      const url = vnBgmPendingUrlRef.current
      const name = vnBgmPendingNameRef.current
      if (!url || !name) return
      const next = new Audio(url)
      next.preload = 'auto'
      next.loop = true
      next.volume = vnBgmVolume
      void next
        .play()
        .then(() => {
          if (vnBgmRequestTokenRef.current === 0) return
          const prev = vnBgmAudioRef.current
          if (prev && prev !== next) {
            prev.pause()
            prev.src = ''
          }
          vnBgmAudioRef.current = next
          vnBgmCurrentUrlRef.current = url
          const dk = vnBgmPendingDiversityKeyRef.current
          vnBgmPendingUrlRef.current = ''
          vnBgmPendingNameRef.current = ''
          vnBgmPendingDiversityKeyRef.current = ''
          vnBgmRequestedUrlRef.current = ''
          if (dk) {
            vnBgmRecentKeysRef.current = [...vnBgmRecentKeysRef.current, dk].slice(-VN_BGM_DIVERSITY_WINDOW)
          }
          setVnBgmCurrentName(name)
          setVnBgmAwaitingGesture(false)
        })
        .catch(() => {})
    }
    window.addEventListener('pointerdown', onFirstGesture, { passive: true })
    window.addEventListener('keydown', onFirstGesture)
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture)
      window.removeEventListener('keydown', onFirstGesture)
    }
  }, [isVn, vnBgmAwaitingGesture, vnBgmVolume])

  const latestAi = useMemo(() => {
    return [...currentArchive.plots].reverse().find((x) => x.type === 'ai') ?? null
  }, [currentArchive.plots])
  const latestPlayer = useMemo(() => {
    return [...currentArchive.plots].reverse().find((x) => x.type === 'player') ?? null
  }, [currentArchive.plots])

  const vnRawContent = useMemo(() => splitDatingAssistantOutput(latestAi?.content || '').content.trim(), [latestAi?.content])
  const vnVoiceParamsCue = useMemo(() => {
    const extracted = extractVnVoiceParamsBlock(vnRawContent)
    // 禁用语音时仍须剥离隐藏参数块再拆气泡，否则 JSON/参数行会混入正文、气泡数量错乱，浮层「自定义输入」永远不出现。
    if (currentArchive.vnVoiceDisabled) {
      return { cleanedText: extracted.cleanedText, items: [] as Array<{ idx: number; emotion: string; tone: string }> }
    }
    return extracted
  }, [currentArchive.vnVoiceDisabled, vnRawContent])
  const vnBgCue = useMemo(() => extractVnBackgroundCue(vnVoiceParamsCue.cleanedText), [vnVoiceParamsCue.cleanedText])
  const vnBubbles = useMemo(() => {
    return splitVnContentToBubbles(vnBgCue.cleanedText, currentCharacter.realName, vnUserDisplayName)
  }, [currentCharacter.realName, vnBgCue.cleanedText, vnUserDisplayName])
  const vnCurrentBubble = useMemo(
    () => vnBubbles[Math.max(0, Math.min(vnBubbles.length - 1, vnBubbleIndex))] ?? null,
    [vnBubbles, vnBubbleIndex],
  )
  const vnTargetText = useMemo(
    () => vnCurrentBubble?.text || '',
    [vnCurrentBubble],
  )
  const vnBubbleSpeaker = useMemo(() => {
    return vnCurrentBubble?.speaker ?? null
  }, [vnCurrentBubble])
  const vnBubbleIsInnerThought = useMemo(() => !!vnCurrentBubble?.isInnerThought, [vnCurrentBubble])
  const vnFlashbackOn = useMemo(() => !!vnCurrentBubble?.isFlashback, [vnCurrentBubble])
  const vnEffectiveBackgroundCueName = useMemo(() => {
    // 背景指令应“持续生效”直到下一条背景指令出现，避免闪回中途回弹到旧背景。
    const base = String(vnBgCue.backgroundName || '').trim()
    if (!vnBubbles.length) return base
    const cap = Math.max(0, Math.min(vnBubbles.length - 1, vnBubbleIndex))
    let active = base
    for (let i = 0; i <= cap; i += 1) {
      const cue = String(vnBubbles[i]?.backgroundCueName || '').trim()
      if (cue) active = cue
    }
    return active
  }, [vnBgCue.backgroundName, vnBubbles, vnBubbleIndex])
  const vnBubbleText = useMemo(() => (vnShownText || vnTargetText).trim(), [vnShownText, vnTargetText])
  const showVnToast = useCallback((msg: string) => {
    setVnToast(msg)
    if (vnToastTimerRef.current != null) window.clearTimeout(vnToastTimerRef.current)
    vnToastTimerRef.current = window.setTimeout(() => setVnToast(null), 1400)
  }, [])
  const vnBubble = useMemo(
    () => ({ text: vnBubbleText, speaker: vnBubbleSpeaker }),
    [vnBubbleSpeaker, vnBubbleText],
  )
  const getCharacterVoiceMap = useCallback((): Record<string, unknown> => {
    try {
      const raw = localStorage.getItem('minimax:characterVoiceMap') || '{}'
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }, [])
  const hasBoundVoiceForSpeaker = useCallback(
    (speakerIdRaw: string | null | undefined): boolean => {
      const speakerId = String(speakerIdRaw || '').trim()
      if (!speakerId || speakerId === '__user__') return false
      const map = getCharacterVoiceMap()
      return !!String(map?.[speakerId] ?? '').trim()
    },
    [getCharacterVoiceMap],
  )
  const normalizeVnSpeaker = useCallback((v: string) => {
    return String(v || '')
      .replace(/[“”"「」『』]/g, '')
      .replace(/[（]/g, '(')
      .replace(/[）]/g, ')')
      .replace(/\s+/g, '')
      .trim()
  }, [])
  const resolveVnSpeakerId = useCallback(
    (speakerRaw: string | null | undefined) => {
      const speaker = String(speakerRaw || '').replace(/[“”"「」『』]/g, '').trim()
      if (!speaker) return null
      const normalized = normalizeVnSpeaker(speaker)
      if (/^(旁白|叙述|系统|narrator)$/i.test(normalized)) return null
      const userNameNorm = String(vnUserDisplayName || '').trim().replace(/\s+/g, '')
      const normalizedCompact = normalized
        .replace(/[（]/g, '(')
        .replace(/[）]/g, ')')
        .replace(/\s+/g, '')
      if (/^(我|你|用户|玩家|自己)$/.test(normalizedCompact)) return '__user__'
      if (/\(\s*你\s*\)$/.test(normalizedCompact)) return '__user__'
      if (/(^|\W)(玩家|用户)($|\W)/.test(normalizedCompact)) return '__user__'
      if (
        userNameNorm &&
        (normalizedCompact === userNameNorm ||
          normalizedCompact === `${userNameNorm}(你)` ||
          normalizedCompact === `${userNameNorm}（你）`)
      ) {
        return '__user__'
      }
      const byActor = spriteActors.find((x) => normalizeVnSpeaker(x.name) === normalized)
      if (byActor) return byActor.id
      if (speaker === currentCharacter.realName) return currentCharacter.id
      // 未知说话人不回落到主角色，避免旁白/脏文本误触发语音合成。
      return null
    },
    [currentCharacter.id, currentCharacter.realName, normalizeVnSpeaker, spriteActors, vnUserDisplayName],
  )

  useEffect(() => {
    if (!isVn) return
    if (!vnBubbles.length) return
    const current = vnBubbles[Math.max(0, Math.min(vnBubbles.length - 1, vnBubbleIndex))]
    const cueName = String(current?.bgmCueName || '').trim()
    if (cueName) switchVnBgmByName(cueName)
  }, [isVn, switchVnBgmByName, vnBubbleIndex, vnBubbles])
  useEffect(() => {
    vnLatestAiIdRef.current = String(latestAi?.id || '').trim()
    vnLatestAiSigRef.current = buildVnAiProgressSignature(String(latestAi?.content || ''))
    vnCurrentCharIdRef.current = String(currentCharacter.id || '').trim()
  }, [latestAi?.content, latestAi?.id, currentCharacter.id])
  useEffect(() => {
    if (!isVn) return
    const aiId = String(latestAi?.id || '').trim()
    if (!aiId) return
    const items = vnVoiceParamsCue.items
    if (!items.length) return

    const speechModel = String(localStorage.getItem('minimax:speechModel') || 'speech-2.8-hd').trim() || 'speech-2.8-hd'
    const rawMap = localStorage.getItem('minimax:characterVoiceMap') || '{}'
    const voiceMap = JSON.parse(rawMap) as Record<string, unknown>

    let cancelled = false
    void (async () => {
      // 将模型同一次输出的隐藏参数块写入缓存（不展示在 UI）
      const styleByIdx = new Map<number, { emotion: ReturnType<typeof normalizeVnEmotion>; tone: string }>()
      for (const r of items) {
        styleByIdx.set(Number(r.idx), { emotion: normalizeVnEmotion(r.emotion), tone: normalizeVnToneToken(r.tone) })
      }
      for (const [idx, b] of vnBubbles.entries()) {
        if (cancelled) return
        const speaker = String(b.speaker || '').trim()
        const text = String(b.text || '').trim()
        if (!speaker || !text) continue
        if (b.isInnerThought) continue
        const sid = String(resolveVnSpeakerId(speaker) || '').trim()
        if (!sid || sid === '__user__') continue
        const voiceId = String(voiceMap?.[sid] ?? '').trim()
        if (!voiceId) continue
        const style = styleByIdx.get(idx)
        if (!style) continue
        const ttsText = decorateVnTtsText(text, style.tone)
        if (!ttsText) continue
        const cacheKey = `${sid}::${aiId}::${idx}::${text}`
        if (vnLineTtsReqCacheRef.current.has(cacheKey)) continue
        await persistVnLineTtsReq(cacheKey, {
          voiceId,
          model: speechModel,
          emotion: style.emotion,
          tone: style.tone,
          ttsText,
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [decorateVnTtsText, isVn, latestAi?.id, normalizeVnEmotion, normalizeVnToneToken, persistVnLineTtsReq, resolveVnSpeakerId, vnBubbles, vnVoiceParamsCue.items])
  const vnLogEntries = useMemo(() => {
    const out: VnLogEntry[] = []
    for (const p of currentArchive.plots) {
      if (p.type === 'player') {
        const msg = String(p.content || '').trim()
        if (!msg) continue
        out.push({
          id: `${p.id}-player`,
          kind: 'dialogue',
          name: `${vnUserDisplayName}（你）`,
          text: msg,
          isUser: true,
          speakerId: '__user__',
          order: out.length,
        })
        continue
      }
      const aiRaw = splitDatingAssistantOutput(p.content).content.trim()
      const voiceStripped = extractVnVoiceParamsBlock(aiRaw).cleanedText
      const cleaned = extractVnBackgroundCue(voiceStripped).cleanedText
      if (!cleaned) continue
      const bubbles = splitVnContentToBubbles(cleaned, currentCharacter.realName, vnUserDisplayName)
      if (!bubbles.length) continue
      const isCurrentAi = latestAi?.id === p.id
      let shown = bubbles
      if (isCurrentAi) {
        const cap = Math.max(0, Math.min(bubbles.length - 1, vnBubbleIndex))
        shown = bubbles.slice(0, cap + 1)
        if (vnTyping && shown.length) {
          const partial = String(vnShownText || '').trim()
          if (!partial) {
            shown = shown.slice(0, -1)
          } else {
            shown = [...shown]
            shown[shown.length - 1] = { ...shown[shown.length - 1]!, text: partial }
          }
        }
      }
      for (let i = 0; i < shown.length; i += 1) {
        const b = shown[i]!
        const text = String(b.text || '').trim()
        if (!text) continue
        const kind: VnLogEntryKind = b.isInnerThought ? 'innerThought' : b.speaker ? 'dialogue' : 'narration'
        out.push({
          id: `${p.id}-ai-${i}`,
          kind,
          name: kind === 'narration' ? '旁白' : b.speaker?.trim() || currentCharacter.realName,
          text,
          isUser: (() => {
            const n = String(b.speaker || '').replace(/\s+/g, '')
            const userNorm = String(vnUserDisplayName || '').replace(/\s+/g, '')
            return /^(我|你|用户|自己)$/u.test(n) || /（你）$|\(你\)$/u.test(n) || (!!userNorm && n === userNorm)
          })(),
          speakerId: resolveVnSpeakerId(b.speaker),
          voiceCacheKey: `${String(resolveVnSpeakerId(b.speaker) || '')}::${String(p.id || '')}::${i}::${text}`,
          order: out.length,
        })
      }
    }
    return out
  }, [currentArchive.plots, currentCharacter.realName, latestAi?.id, resolveVnSpeakerId, vnBubbleIndex, vnShownText, vnTyping, vnUserDisplayName])
  const activeSpeakerId = useMemo(() => {
    return resolveVnSpeakerId(vnBubble.speaker)
  }, [resolveVnSpeakerId, vnBubble.speaker])
  const vnDialogName = useMemo(() => {
    const speaker = String(vnBubbleSpeaker || '').trim()
    if (!speaker) {
      return vnBubbleIsInnerThought ? `${currentCharacter.realName}·内心` : currentCharacter.realName
    }
    const normalized = speaker.replace(/\s+/g, '')
    const userNameNorm = String(vnUserDisplayName || '').trim().replace(/\s+/g, '')
    if (
      /^(我|你|用户|自己)$/.test(normalized) ||
      /（你）$|\(你\)$/.test(normalized) ||
      (userNameNorm && (normalized === userNameNorm || normalized === `${userNameNorm}（你）` || normalized === `${userNameNorm}(你)`))
    ) {
      return vnBubbleIsInnerThought ? `${vnUserDisplayName}（你）·内心` : `${vnUserDisplayName}（你）`
    }
    return vnBubbleIsInnerThought ? `${speaker}·内心` : speaker
  }, [currentCharacter.realName, vnBubbleIsInnerThought, vnBubbleSpeaker, vnUserDisplayName])
  const vnCanPlayBubbleVoice = useMemo(() => {
    if (!isVn) return false
    if (!vnBubbleSpeaker) return false
    if (vnBubbleIsInnerThought) return false
    const sid = String(activeSpeakerId || '').trim()
    if (!sid || sid === '__user__') return false
    // 允许「主角色 + NPC」对白语音；玩家/旁白/未知 speaker 一律禁播。
    if (!hasBoundVoiceForSpeaker(sid)) return false
    return !!String(vnBubbleText || '').trim()
  }, [activeSpeakerId, hasBoundVoiceForSpeaker, isVn, vnBubbleIsInnerThought, vnBubbleSpeaker, vnBubbleText])
  const vnVoiceCacheKey = useMemo(() => {
    const sid = String(activeSpeakerId || '').trim()
    const aiId = String(latestAi?.id || '')
    const text = String(vnBubbleText || '').trim()
    return `${sid}::${aiId}::${vnBubbleIndex}::${text}`
  }, [activeSpeakerId, latestAi?.id, vnBubbleIndex, vnBubbleText])
  useEffect(() => {
    vnCurrentVoiceKeyRef.current = String(vnVoiceCacheKey || '').trim()
    // 切到新气泡后清空“已完成语音”标记，等待本句语音完成再允许自动推进。
    vnVoiceDoneKeyRef.current = ''
    vnVoiceDoneAtRef.current = 0
  }, [vnVoiceCacheKey])
  const vnAutoPlayOnceKey = useMemo(() => {
    // 自动播放只跟“第几个气泡”有关，不能把文本拼进 key（逐字更新会导致循环触发）。
    const sid = String(activeSpeakerId || '').trim()
    const aiId = String(latestAi?.id || '')
    return `${sid}::${aiId}::${vnBubbleIndex}`
  }, [activeSpeakerId, latestAi?.id, vnBubbleIndex])
  const VnCapsuleSwitch = useCallback(
    ({ checked, onToggle, disabled = false }: { checked: boolean; onToggle: () => void; disabled?: boolean }) => (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-black' : 'bg-stone-200'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full border border-stone-300 bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    ),
    [],
  )
  const synthVnVoiceForLine = useCallback(
    async (params: { speakerId: string; text: string; cacheKey: string; contextTexts: string[] }) => {
      const cacheKey = String(params.cacheKey || '').trim()
      if (!cacheKey) return ''
      const cached = String(vnLineVoiceCacheRef.current.get(cacheKey) || '').trim()
      if (cached) return cached

      const text = String(params.text || '').trim()
      if (!text) return ''
      const speakerId = String(params.speakerId || '').trim()
      if (!speakerId || speakerId === '__user__') return ''

      const apiKey = String(localStorage.getItem('minimax:apiKey') || '').trim()
      const groupId = String(localStorage.getItem('minimax:groupId') || '').trim()
      const speechModel = String(localStorage.getItem('minimax:speechModel') || 'speech-2.8-hd').trim() || 'speech-2.8-hd'
      const map = getCharacterVoiceMap()
      const voiceId = String(map?.[speakerId] ?? '').trim()
      if (!apiKey || !voiceId) return ''

      const cachedReq = vnLineTtsReqCacheRef.current.get(cacheKey)
      const req =
        cachedReq && cachedReq.voiceId === voiceId && cachedReq.ttsText
          ? cachedReq
          : (() => {
              return null
            })()
      let emotion: 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'calm' | 'fluent' | 'whisper'
      let tone: string
      let ttsText: string
      if (req) {
        emotion = req.emotion
        tone = req.tone
        ttsText = req.ttsText
      } else {
        // 没有同段隐藏参数块缓存时，降级为默认风格（避免额外再调用模型，确保“VN只调用一次模型生成内容”）
        emotion = 'calm'
        tone = 'breath'
        ttsText = decorateVnTtsText(text, tone)
        if (ttsText) await persistVnLineTtsReq(cacheKey, { voiceId, model: speechModel, emotion, tone, ttsText })
      }
      if (!ttsText) return ''

      const blob = await createMiniMaxT2ASyncAudioBlob(
        { apiKey, groupId },
        { voice_id: voiceId, text: ttsText, model: speechModel, emotion },
      )
      const src = await blobToDataUrl(blob)
      if (!src) return ''
      await persistVnVoiceCache(cacheKey, src)
      return src
    },
    [blobToDataUrl, decorateVnTtsText, getCharacterVoiceMap, persistVnLineTtsReq, persistVnVoiceCache],
  )
  const playVnBubbleVoice = useCallback(async (): Promise<boolean> => {
    if (currentArchive.vnVoiceDisabled) {
      showVnToast('已禁用语音合成，可在 VN 菜单关闭后恢复')
      return false
    }
    if (!vnCanPlayBubbleVoice || vnLineVoiceGenerating) return false
    if (vnLineVoicePlaying) {
      stopVnLineVoice()
      return false
    }
    const text = String(vnBubbleText || '').trim()
    if (!text) return false
    const sid = String(activeSpeakerId || '').trim()
    if (!sid || sid === '__user__') return false
    if (!hasBoundVoiceForSpeaker(sid)) {
      showVnToast('该角色未绑定音色，无法播放语音')
      return false
    }
    const playToken = ++vnVoicePlayTokenRef.current
    const expectedKey = String(vnVoiceCacheKey || '').trim()
    vnVoiceDoneKeyRef.current = ''
    vnVoiceDoneAtRef.current = 0

    try {
      setVnLineVoiceGenerating(true)
      const currentIdx = vnLogEntries.findIndex((x) => String(x.voiceCacheKey || '') === vnVoiceCacheKey)
      const contextTexts = (currentIdx >= 0
        ? vnLogEntries.slice(Math.max(0, currentIdx - 5), currentIdx)
        : vnLogEntries.slice(-5)
      )
        .map((x) => String(x.text || '').trim())
        .filter(Boolean)
      let src = await synthVnVoiceForLine({ speakerId: sid, text, cacheKey: vnVoiceCacheKey, contextTexts })
      if (playToken !== vnVoicePlayTokenRef.current) return false
      if (expectedKey && expectedKey !== vnCurrentVoiceKeyRef.current) return false
      if (src) {
        stopVnLineVoice({ invalidatePending: false })
        if (playToken !== vnVoicePlayTokenRef.current) return false
        if (expectedKey && expectedKey !== vnCurrentVoiceKeyRef.current) return false
        const a = vnLineAudioRef.current ?? new Audio()
        a.preload = 'auto'
        a.src = src
        a.onended = () => {
          if (playToken !== vnVoicePlayTokenRef.current) return
          setVnLineVoicePlaying(false)
          vnVoiceDoneKeyRef.current = expectedKey
          vnVoiceDoneAtRef.current = Date.now()
        }
        a.onerror = () => {
          if (playToken !== vnVoicePlayTokenRef.current) return
          setVnLineVoicePlaying(false)
          vnVoiceDoneKeyRef.current = expectedKey
          vnVoiceDoneAtRef.current = Date.now()
        }
        vnLineAudioRef.current = a
        a.currentTime = 0
        await a.play()
        if (playToken !== vnVoicePlayTokenRef.current) {
          a.pause()
          return false
        }
        setVnLineVoicePlaying(true)
        return true
      }
      // 没有可播音频时也视作“本句语音流程结束”，避免自动播放卡死。
      vnVoiceDoneKeyRef.current = expectedKey
      vnVoiceDoneAtRef.current = Date.now()
      showVnToast('该角色未绑定音色或合成失败，请检查音色绑定')
      return false
    } catch {
      setVnLineVoicePlaying(false)
      vnVoiceDoneKeyRef.current = expectedKey
      vnVoiceDoneAtRef.current = Date.now()
      showVnToast('语音已生成但浏览器拦截了自动播放，请点一下播放键继续')
      return false
    } finally {
      setVnLineVoiceGenerating(false)
    }
  }, [
    activeSpeakerId,
    synthVnVoiceForLine,
    stopVnLineVoice,
    currentArchive.vnVoiceDisabled,
    showVnToast,
    hasBoundVoiceForSpeaker,
    vnCanPlayBubbleVoice,
    vnLineVoiceGenerating,
    vnLineVoicePlaying,
    vnBubbleText,
    vnLogEntries,
    vnVoiceCacheKey,
  ])
  const playCachedLogVoice = useCallback(
    async (entry: VnLogEntry) => {
      if (currentArchive.vnVoiceDisabled) {
        showVnToast('已禁用语音合成，可在 VN 菜单关闭后恢复')
        return
      }
      const speakerId = String(entry.speakerId || '').trim()
      const key = String(entry.voiceCacheKey || '').trim()
      if (!key || !speakerId || speakerId === '__user__') return
      if (!hasBoundVoiceForSpeaker(speakerId)) {
        showVnToast('该角色未绑定音色，无法播放语音')
        return
      }
      if (vnLogPlayingId === entry.id && vnLineVoicePlaying) {
        stopVnLineVoice()
        setVnLogPlayingId(null)
        return
      }
      try {
        setVnLogGeneratingId(entry.id)
        let src = String(vnLineVoiceCacheRef.current.get(key) || '').trim()
        if (!src) {
          const idx = Math.max(0, Number(entry.order || 0))
          const contextTexts = vnLogEntries
            .slice(Math.max(0, idx - 5), idx)
            .map((x) => String(x.text || '').trim())
            .filter(Boolean)
          src = await synthVnVoiceForLine({
            speakerId,
            text: String(entry.text || '').trim(),
            cacheKey: key,
            contextTexts,
          })
        }
        if (!src) {
          showVnToast('该角色未绑定音色或合成失败，请检查音色绑定')
          return
        }
        stopVnLineVoice({ invalidatePending: false })
        const a = vnLineAudioRef.current ?? new Audio()
        a.preload = 'auto'
        a.src = src
        a.onended = () => {
          setVnLineVoicePlaying(false)
          setVnLogPlayingId(null)
        }
        a.onerror = () => {
          setVnLineVoicePlaying(false)
          setVnLogPlayingId(null)
        }
        vnLineAudioRef.current = a
        a.currentTime = 0
        await a.play()
        setVnLineVoicePlaying(true)
        setVnLogPlayingId(entry.id)
      } catch {
        setVnLineVoicePlaying(false)
        setVnLogPlayingId(null)
      } finally {
        setVnLogGeneratingId(null)
      }
    },
    [currentArchive.vnVoiceDisabled, hasBoundVoiceForSpeaker, showVnToast, stopVnLineVoice, synthVnVoiceForLine, vnLineVoicePlaying, vnLogEntries, vnLogPlayingId],
  )

  useEffect(() => {
    if (!isVn) return
    const cueName = vnEffectiveBackgroundCueName
    if (!cueName) return
    const hit = resolveVnBackgroundByName(cueName)
    if (!hit?.url || hit.url === vnBgCurrentUrl) return
    if (vnBgFadeTimerRef.current != null) {
      window.clearTimeout(vnBgFadeTimerRef.current)
      vnBgFadeTimerRef.current = null
    }
    if (vnBgFlashTimerRef.current != null) {
      window.clearTimeout(vnBgFlashTimerRef.current)
      vnBgFlashTimerRef.current = null
    }
    setVnBgPrevUrl(vnBgCurrentUrl)
    setVnBgCurrentUrl(hit.url)
    setVnBgFlashOn(true)
    vnBgFlashTimerRef.current = window.setTimeout(() => {
      setVnBgFlashOn(false)
      vnBgFlashTimerRef.current = null
    }, 140)
    vnBgFadeTimerRef.current = window.setTimeout(() => {
      setVnBgPrevUrl(null)
      vnBgFadeTimerRef.current = null
    }, 420)
  }, [isVn, vnBgCurrentUrl, vnEffectiveBackgroundCueName])

  useEffect(() => {
    return () => {
      if (vnBgFadeTimerRef.current != null) window.clearTimeout(vnBgFadeTimerRef.current)
      if (vnBgFlashTimerRef.current != null) window.clearTimeout(vnBgFlashTimerRef.current)
    }
  }, [])
  useEffect(() => {
    if (isVn) return
    stopVnBgm()
  }, [isVn, stopVnBgm])
  useEffect(() => stopVnBgm, [stopVnBgm])
  useEffect(() => {
    stopVnLineVoice()
  }, [vnBubbleIndex, latestAi?.id, stopVnLineVoice])
  useEffect(
    () => () => {
      stopVnLineVoice()
      for (const u of vnLineVoiceCacheRef.current.values()) {
        if (u.startsWith('blob:')) URL.revokeObjectURL(u)
      }
      vnLineVoiceCacheRef.current.clear()
    },
    [stopVnLineVoice],
  )
  useEffect(() => {
    if (!isVn || !regeneratingPlotId) return
    stopVnLineVoice()
    setVnShownText('')
    setVnTyping(false)
  }, [isVn, regeneratingPlotId, stopVnLineVoice])
  const activeSprite = useActiveSprite(activeSpeakerId)
  const hasNextVnBubble = vnBubbleIndex < vnBubbles.length - 1
  const vnUiLoading = loading || vnSubmitting
  const canVnRollback = useMemo(() => {
    if (!isVn || vnUiLoading) return false
    const plots = currentArchive.plots
    if (plots.length < 2) return false
    const last = plots[plots.length - 1]
    if (last?.type !== 'ai') return false
    const prev = plots[plots.length - 2]
    const nextLen = prev?.type === 'player' ? plots.length - 2 : plots.length - 1
    return nextLen >= 1
  }, [currentArchive.plots, isVn, vnUiLoading])
  /** 最后一条为已完成的 AI 回复时可重生本轮（不删用户输入，仅替换该条 AI 展示稿） */
  const canVnRegenerateRound = useMemo(() => {
    if (!isVn || vnUiLoading) return false
    const plots = currentArchive.plots
    const last = plots[plots.length - 1]
    if (last?.type !== 'ai') return false
    if (regeneratingPlotId) return false
    return true
  }, [currentArchive.plots, isVn, regeneratingPlotId, vnUiLoading])
  const isAwaitingVnAiReply =
    loading &&
    !!latestPlayer &&
    (!latestAi || Number(latestAi.timestamp || 0) < Number(latestPlayer.timestamp || 0))
  const vnBoxLoading = vnUiLoading && !vnTargetText.trim()
  useEffect(() => {
    if (!isVn || !vnAutoVoicePlay) return
    if (currentArchive.vnVoiceDisabled) return
    if (!vnCanPlayBubbleVoice) return
    if (vnTyping || vnBoxLoading) return
    if (vnLineVoicePlaying || vnLineVoiceGenerating) return
    if (vnLastAutoVoiceKeyRef.current === vnAutoPlayOnceKey) return
    const key = vnAutoPlayOnceKey
    vnLastAutoVoiceKeyRef.current = key
    void (async () => {
      const ok = await playVnBubbleVoice()
      // 只有真正开始播放才消费本句 key；失败则允许后续自动重试。
      if (!ok && vnLastAutoVoiceKeyRef.current === key) vnLastAutoVoiceKeyRef.current = ''
    })()
  }, [
    isVn,
    playVnBubbleVoice,
    vnAutoVoicePlay,
    vnBoxLoading,
    vnCanPlayBubbleVoice,
    vnLineVoiceGenerating,
    vnLineVoicePlaying,
    vnTyping,
    vnAutoPlayOnceKey,
  ])
  useEffect(() => {
    if (!currentArchive.vnVoiceDisabled) return
    // 一键禁用后立刻停播 + 关闭自动播，避免继续占用资源
    stopVnLineVoice()
    if (vnAutoVoicePlay) setVnAutoVoicePlay(false)
  }, [currentArchive.vnVoiceDisabled, stopVnLineVoice, vnAutoVoicePlay])
  useEffect(() => {
    if (vnAutoVoicePlay) vnLastAutoVoiceKeyRef.current = ''
  }, [vnAutoVoicePlay])

  useLayoutEffect(() => {
    if (!isVn || !currentCharacter.id) return
    const rbKey = vnRollbackJumpStorageKey(currentCharacter.id)
    let ts = 0
    try {
      ts = Number(sessionStorage.getItem(rbKey))
    } catch {
      /* ignore */
    }
    if (!Number.isFinite(ts) || ts <= 0) return
    if (Date.now() - ts > 8000) {
      try {
        sessionStorage.removeItem(rbKey)
      } catch {
        /* ignore */
      }
      return
    }
    const aiId = String(latestAi?.id || '').trim()
    if (!aiId || vnBubbles.length === 0) return
    try {
      sessionStorage.removeItem(rbKey)
    } catch {
      /* ignore */
    }
    const lastIdx = Math.max(0, vnBubbles.length - 1)
    const aiSig = buildVnAiProgressSignature(String(latestAi?.content || ''))
    vnLatestAiIdRef.current = aiId
    vnLatestAiSigRef.current = aiSig
    vnCurrentCharIdRef.current = String(currentCharacter.id || '').trim()
    vnPendingRestoreIndexRef.current = lastIdx
    vnProgressRestoreReadyRef.current = true
    setVnBubbleIndex(lastIdx)
    try {
      const payload = {
        latestAiId: aiId,
        latestAiSig: aiSig,
        bubbleIndex: lastIdx,
        updatedAt: Date.now(),
      }
      localStorage.setItem(vnProgressLsKey(currentCharacter.id), JSON.stringify(payload))
      localStorage.setItem(VN_PROGRESS_GLOBAL_KEY, JSON.stringify(payload))
    } catch {
      /* ignore */
    }
    stopVnLineVoice()
    setVnShownText('')
    setVnTyping(false)
  }, [currentCharacter.id, isVn, latestAi?.content, latestAi?.id, stopVnLineVoice, vnBubbles.length])

  useEffect(() => {
    if (!isVn) return
    vnProgressRestoreReadyRef.current = false
    vnPendingRestoreIndexRef.current = null
    const key = vnProgressLsKey(currentCharacter.id)
    const aiId = String(latestAi?.id || '').trim()
    const aiSig = buildVnAiProgressSignature(String(latestAi?.content || ''))
    if (!aiId) {
      vnPendingRestoreIndexRef.current = 0
      setVnBubbleIndex(0)
      vnProgressRestoreReadyRef.current = true
      return
    }
    try {
      const raw = localStorage.getItem(key) || localStorage.getItem(VN_PROGRESS_GLOBAL_KEY)
      if (!raw) {
        setVnBubbleIndex(0)
        vnProgressRestoreReadyRef.current = true
        return
      }
      const parsed = JSON.parse(raw) as { latestAiId?: string; latestAiSig?: string; bubbleIndex?: number } | null
      const savedAiId = String(parsed?.latestAiId || '').trim()
      const savedAiSig = String(parsed?.latestAiSig || '').trim()
      const savedIdx = Number(parsed?.bubbleIndex)
      const hitById = !!savedAiId && savedAiId === aiId
      const hitBySig = !!savedAiSig && !!aiSig && savedAiSig === aiSig
      const hitLegacy = !savedAiId && !savedAiSig
      // 同 id 但正文签名与存档不一致（重新生成、编辑、或旧存档无签名→现已有签名）：从本轮首气泡开始
      if (hitById && savedAiSig !== aiSig) {
        vnPendingRestoreIndexRef.current = 0
        setVnBubbleIndex(0)
        vnProgressRestoreReadyRef.current = true
        return
      }
      if (Number.isFinite(savedIdx) && (hitById || hitBySig || hitLegacy)) {
        const restored = Math.max(0, Math.round(savedIdx))
        vnPendingRestoreIndexRef.current = restored
        // 关键：恢复时不依赖当前 bubbles 长度，避免初始化阶段被错误钳到 0
        setVnBubbleIndex(restored)
        vnProgressRestoreReadyRef.current = true
        return
      }
      vnPendingRestoreIndexRef.current = 0
      setVnBubbleIndex(0)
      vnProgressRestoreReadyRef.current = true
    } catch {
      vnPendingRestoreIndexRef.current = 0
      setVnBubbleIndex(0)
      vnProgressRestoreReadyRef.current = true
    }
  }, [isVn, currentCharacter.id, latestAi?.id, latestAi?.timestamp, vnBubbles.length])

  useEffect(() => {
    if (!isVn) return
    if (!vnProgressRestoreReadyRef.current) return
    const pending = vnPendingRestoreIndexRef.current
    if (pending != null && Math.round(vnBubbleIndex) !== pending) return
    if (pending != null && Math.round(vnBubbleIndex) === pending) {
      vnPendingRestoreIndexRef.current = null
    }
    const aiId = String(latestAi?.id || '').trim()
    if (!aiId) return
    if (!vnBubbles.length) return
    const key = vnProgressLsKey(currentCharacter.id)
    const payload = {
      latestAiId: aiId,
      latestAiSig: buildVnAiProgressSignature(String(latestAi?.content || '')),
      // 关键：持久化当前 index 原值，避免在气泡短暂未就绪时覆盖为 0
      bubbleIndex: Math.max(0, Math.round(vnBubbleIndex)),
      updatedAt: Date.now(),
    }
    try {
      localStorage.setItem(key, JSON.stringify(payload))
      localStorage.setItem(VN_PROGRESS_GLOBAL_KEY, JSON.stringify(payload))
    } catch {
      // ignore persistence failures
    }
  }, [isVn, currentCharacter.id, latestAi?.content, latestAi?.id, vnBubbleIndex, vnBubbles.length])

  const persistVnProgressNow = useCallback((nextIndex: number) => {
    const aiId = String(vnLatestAiIdRef.current || '').trim()
    const aiSig = String(vnLatestAiSigRef.current || '').trim()
    const charId = String(vnCurrentCharIdRef.current || '').trim()
    if (!aiId) return
    const payload = {
      latestAiId: aiId,
      latestAiSig: aiSig,
      bubbleIndex: Math.max(0, Math.round(nextIndex)),
      updatedAt: Date.now(),
    }
    try {
      if (charId) localStorage.setItem(vnProgressLsKey(charId), JSON.stringify(payload))
      localStorage.setItem(VN_PROGRESS_GLOBAL_KEY, JSON.stringify(payload))
    } catch {
      // ignore persistence failures
    }
  }, [])

  const handleVnContinue = useCallback(() => {
    if (vnTyping) {
      skipVnTyping()
      return
    }
    if (hasNextVnBubble) {
      setVnBubbleIndex((v) => {
        const next = Math.min(v + 1, Math.max(0, vnBubbles.length - 1))
        persistVnProgressNow(next)
        return next
      })
    }
  }, [hasNextVnBubble, persistVnProgressNow, vnBubbles.length, vnTyping])

  useEffect(() => {
    if (vnRafRef.current != null) {
      window.cancelAnimationFrame(vnRafRef.current)
      vnRafRef.current = null
    }
    if (!isVn) return
    const full = vnTargetText
    if (!full) {
      setVnShownText('')
      setVnTyping(false)
      return
    }
    // 切换下一句时先落一个首字，避免“先空一下再出现”导致的卡顿观感
    setVnShownText(full.slice(0, 1))
    setVnTyping(true)
    let index = Math.min(1, full.length)
    let lastTs = 0
    let carryMs = 0
    // 放慢基础速度：1x 约 58ms/字，且保持随 playSpeed 加速
    const msPerChar = Math.max(20, Math.round(58 / Math.max(0.5, playSpeed)))
    const tick = (ts: number) => {
      if (!lastTs) lastTs = ts
      const dt = ts - lastTs
      lastTs = ts
      carryMs += dt
      let advanced = false
      while (carryMs >= msPerChar && index < full.length) {
        carryMs -= msPerChar
        index += 1
        advanced = true
      }
      if (advanced) {
        setVnShownText(full.slice(0, index))
      }
      if (index >= full.length) {
        setVnTyping(false)
        vnRafRef.current = null
        return
      }
      vnRafRef.current = window.requestAnimationFrame(tick)
    }
    vnRafRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (vnRafRef.current != null) {
        window.cancelAnimationFrame(vnRafRef.current)
        vnRafRef.current = null
      }
    }
  }, [isVn, vnTargetText, playSpeed])

  const skipVnTyping = () => {
    if (!vnTyping) return
    if (vnRafRef.current != null) {
      window.cancelAnimationFrame(vnRafRef.current)
      vnRafRef.current = null
    }
    setVnShownText(vnTargetText)
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
  const vnSpriteOffsetPx = useMemo(() => {
    if (!activeSprite) return { x: 0, y: 0 }
    const rect = vnRootRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (activeSprite.position.x / 100) * rect.width,
      y: (activeSprite.position.y / 100) * rect.height,
    }
  }, [activeSprite])

  const vnBranchOptions = useMemo(
    () => currentArchive.pendingBranches.slice(0, 3),
    [currentArchive.pendingBranches],
  )
  const branchListLoading = branchesLoading && currentArchive.pendingBranches.length === 0
  const isVnEmpty = vnBubbles.length === 0
  const isLastVnBubble = !isVnEmpty && !hasNextVnBubble
  const shouldShowVnFloatingOptions = isVnEmpty || isLastVnBubble
  const showVnBlockingGeneratingModal = isVn && (vnSubmitting || isAwaitingVnAiReply)
  const handleBranchPick = useCallback((x: BranchOption) => {
    stageBranchChoice(x)
    setInput(x.content)
  }, [stageBranchChoice])
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
    if (!Number.isFinite(n)) return 500
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
  const handleVnBranchPick = useCallback(
    async (x: BranchOption) => {
      setVnSubmitting(true)
      stageBranchChoice(x)
      try {
        const ok = await sendPlayerInput(x.content, perspective, {
          ...narrativeGenOptions,
          branchContinuationHint: x.nextPrompt,
        })
        if (ok) {
          setInput('')
        }
      } finally {
        setVnSubmitting(false)
      }
    },
    [narrativeGenOptions, perspective, sendPlayerInput, stageBranchChoice],
  )
  const handleVnCustomGenerate = useCallback(async () => {
    const text = vnCustomInput.trim()
    if (!text) return
    setVnSubmitting(true)
    try {
      const ok = await sendPlayerInput(text, perspective, {
        ...narrativeGenOptions,
        vnCustomIntentMode: currentArchive.vnCustomInputParaphrase ? 'paraphrase' : 'canon',
      })
      if (ok) {
        setVnCustomInput('')
        setInput('')
        setVnCustomInputModalOpen(false)
      }
    } finally {
      setVnSubmitting(false)
    }
  }, [currentArchive.vnCustomInputParaphrase, narrativeGenOptions, perspective, sendPlayerInput, vnCustomInput])
  useEffect(() => {
    vnAutoAdvanceRef.current = () => {
      if (hasNextVnBubble) {
        setVnBubbleIndex((v) => {
          const next = Math.min(v + 1, Math.max(0, vnBubbles.length - 1))
          persistVnProgressNow(next)
          return next
        })
      }
    }
  }, [hasNextVnBubble, persistVnProgressNow, vnBubbles.length])

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

  const confirmVnRollback = useCallback(() => {
    setVnRollbackConfirmOpen(false)
    const ok = vnRollbackLastRound()
    if (!ok) showVnToast('暂无上一轮可撤回')
  }, [showVnToast, vnRollbackLastRound])

  const confirmVnRegenerateRound = useCallback(() => {
    setVnRegenerateConfirmOpen(false)
    const plots = currentArchive.plots
    const last = plots[plots.length - 1]
    if (last?.type !== 'ai') return
    void regenerateAiPlot(last.id, perspective, narrativeGenOptions)
  }, [currentArchive.plots, narrativeGenOptions, perspective, regenerateAiPlot])

  useEffect(() => {
    if (!currentArchive.godPerspective) return
    setAutoUserReaction(false)
    setAutoUserOpen(false)
  }, [currentArchive.godPerspective])

  useEffect(() => {
    if (currentArchive.plots.length > 0) {
      if (initialBiasDismissedFor) setInitialBiasDismissedFor(null)
      if (initialBiasOpen) setInitialBiasOpen(false)
      return
    }
    if (isVn) {
      if (initialBiasOpen) setInitialBiasOpen(false)
      return
    }
    if (loading) return
    if (initialBiasDismissedFor === currentCharacter.id) return
    if (currentArchive.plots.length === 0) setInitialBiasOpen(true)
  }, [currentArchive.plots.length, loading, initialBiasDismissedFor, currentCharacter.id, isVn, initialBiasOpen])

  useEffect(() => {
    if (vnAutoTimerRef.current) {
      window.clearTimeout(vnAutoTimerRef.current)
      vnAutoTimerRef.current = null
    }
    if (!isVn || !isAutoPlay || loading || vnTyping) return
    if (!vnTargetText.trim()) return
    const voiceSyncEnabled = vnAutoVoicePlay && !currentArchive.vnVoiceDisabled
    const audio = vnLineAudioRef.current
    const audioBusy = !!audio && !audio.paused && !audio.ended
    // 关键：只要开了自动语音，就必须等当前语音彻底结束，避免“语音还在播就切下一句”造成误判成旁白在念。
    if (voiceSyncEnabled && (vnLineVoiceGenerating || vnLineVoicePlaying || audioBusy)) return
    let delayMs = 1500
    if (voiceSyncEnabled && vnCanPlayBubbleVoice) {
      const currentKey = String(vnCurrentVoiceKeyRef.current || '').trim()
      if (!currentKey) return
      // 严格串行：必须是“当前句语音已完成”才允许进入 1s 缓冲后切下一句。
      if (vnVoiceDoneKeyRef.current !== currentKey) return
      const elapsed = Date.now() - Number(vnVoiceDoneAtRef.current || 0)
      delayMs = Math.max(0, 1000 - elapsed)
    }
    vnAutoTimerRef.current = window.setTimeout(() => {
      vnAutoAdvanceRef.current()
    }, delayMs)
    return () => {
      if (vnAutoTimerRef.current) {
        window.clearTimeout(vnAutoTimerRef.current)
        vnAutoTimerRef.current = null
      }
    }
  }, [
    currentArchive.vnVoiceDisabled,
    isAutoPlay,
    isVn,
    loading,
    vnAutoVoicePlay,
    vnCanPlayBubbleVoice,
    vnLineVoiceGenerating,
    vnLineVoicePlaying,
    vnTargetText,
    vnTyping,
  ])

  useEffect(() => {
    if (!isVn || !logOpen) return
    requestAnimationFrame(() => {
      const el = vnLogScrollRef.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  }, [isVn, logOpen, vnLogEntries.length])

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
          {vnToast ? (
            <div className="pointer-events-none absolute left-1/2 top-16 z-[80] -translate-x-1/2 rounded-xl bg-white/90 px-4 py-2 text-[13px] text-[#1f2937] shadow-[0_10px_22px_rgba(0,0,0,0.12)] backdrop-blur">
              {vnToast}
            </div>
          ) : null}
          <div
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-[420ms] ease-out"
            style={{
              backgroundImage: `url(${vnBgCurrentUrl})`,
            }}
          />
          {vnBgPrevUrl ? (
            <motion.div
              className="pointer-events-none absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${vnBgPrevUrl})` }}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.42, ease: 'easeOut' }}
            />
          ) : null}
          <div
            className="pointer-events-none absolute inset-0 z-[8] bg-white transition-opacity duration-150"
            style={{ opacity: vnBgFlashOn ? 0.72 : 0 }}
          />
          <motion.div
            className="pointer-events-none absolute inset-0 z-[9]"
            animate={{ opacity: vnFlashbackOn ? 1 : 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            style={{
              boxShadow: 'inset 0 0 120px rgba(255,255,255,0.48), inset 0 0 40px rgba(255,255,255,0.42)',
              background:
                'radial-gradient(ellipse at center, rgba(255,255,255,0.02) 32%, rgba(255,255,255,0.24) 78%, rgba(255,255,255,0.42) 100%)',
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
              className="absolute z-30 w-56 rounded-xl border border-stone-200 bg-white/92 p-1 shadow-[0_10px_28px_rgba(0,0,0,0.1)] backdrop-blur-xl"
              style={{ left: vnMenuPos.left, top: vnMenuPos.top }}
            >
              <button
                type="button"
                disabled={!canVnRollback}
                title={
                  canVnRollback
                    ? '删除本轮输入与生成，气泡回到上一轮最后一句'
                    : '至少经历一轮对话后才可撤回'
                }
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] ${
                  canVnRollback ? 'text-[#262626] hover:bg-stone-50' : 'cursor-not-allowed text-[#a3a3a3]'
                }`}
                onClick={() => {
                  setMenuOpen(false)
                  if (canVnRollback) setVnRollbackConfirmOpen(true)
                }}
              >
                <Undo2 className="size-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
                撤回上一轮
              </button>
              <button
                type="button"
                disabled={!canVnRegenerateRound}
                title={
                  canVnRegenerateRound
                    ? '基于当前设定重新请求 AI，替换本轮最后一条回复'
                    : regeneratingPlotId
                      ? '正在重新生成中'
                      : '需先完成一轮 AI 回复（最后一条为对方发言）'
                }
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] ${
                  canVnRegenerateRound ? 'text-[#262626] hover:bg-stone-50' : 'cursor-not-allowed text-[#a3a3a3]'
                }`}
                onClick={() => {
                  setMenuOpen(false)
                  if (canVnRegenerateRound) setVnRegenerateConfirmOpen(true)
                }}
              >
                <RefreshCw className="size-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
                重新生成此轮
              </button>
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
                  stopVnBgm()
                  setMode('normal')
                  setMenuOpen(false)
                }}
              >
                切回普通模式
              </button>
              <div className="flex items-center justify-between rounded-lg px-3 py-2 text-[13px] text-[#262626] hover:bg-stone-50">
                <span>弹幕模型</span>
                <VnCapsuleSwitch
                  checked={vnDanmakuModelOn}
                  onToggle={() => {
                    void toggleVnDanmakuModel()
                  }}
                />
              </div>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#262626] hover:bg-stone-50"
                onClick={() => {
                  setPortraitSetupOpen(true)
                  setMenuOpen(false)
                }}
              >
                立绘设置
              </button>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#262626] hover:bg-stone-50"
                onClick={() => {
                  setBgmConfigOpen(true)
                  setMenuOpen(false)
                }}
              >
                BGM配置
              </button>
              <div className="flex items-center justify-between rounded-lg px-3 py-2 text-[13px] text-[#262626] hover:bg-stone-50">
                <span>自动语音播放</span>
                <VnCapsuleSwitch
                  checked={vnAutoVoicePlay}
                  onToggle={() => {
                    setVnAutoVoicePlay((v) => !v)
                  }}
                />
              </div>
              <div
                className="flex items-center justify-between rounded-lg px-3 py-2 text-[13px] text-[#262626] hover:bg-stone-50"
                title="开启后将禁用 VN 语音合成/播放，并要求模型不输出隐藏语音参数块，以节省 token"
              >
                <span>禁用语音合成</span>
                <VnCapsuleSwitch
                  checked={!!currentArchive.vnVoiceDisabled}
                  onToggle={() => {
                    const next = !currentArchive.vnVoiceDisabled
                    setVnVoiceDisabled(next)
                    if (next) {
                      stopVnLineVoice()
                      setVnAutoVoicePlay(false)
                    }
                  }}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg px-3 py-2 text-[13px] text-[#262626] hover:bg-stone-50">
                <span>剧情分支</span>
                <VnCapsuleSwitch
                  checked={currentArchive.branchEnabled}
                  onToggle={() => {
                    setBranchEnabled(!currentArchive.branchEnabled)
                  }}
                />
              </div>
            </div>
          ) : null}

        {activeSpeakerId && activeSprite?.imageUrl ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-[calc(170px+max(10px,env(safe-area-inset-bottom,0px)))] z-[9] flex justify-center px-4">
            <motion.div
              key={`vn-speaker-sprite-${activeSpeakerId}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              style={{
                x: vnSpriteOffsetPx.x,
                y: vnSpriteOffsetPx.y,
                scale: activeSprite?.scale ?? 1,
              }}
            >
              <ChromaKeyRenderer
                imageUrl={activeSprite.imageUrl}
                chromaKey={activeSprite.chromaKey}
                className="max-h-[50dvh] w-auto shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
              />
            </motion.div>
          </div>
        ) : null}

          <div className="relative z-10 flex h-full min-h-0 flex-col px-4 pb-[calc(64px+max(10px,env(safe-area-inset-bottom,0px)))]">
            <div className="basis-[65%] shrink-0" />
            <div className="relative">
              {shouldShowVnFloatingOptions ? (
                <div className="pointer-events-auto absolute inset-x-0 bottom-[calc(100%+8px)] z-20">
                  <div className="space-y-2.5">
                    {currentArchive.branchEnabled ? (
                      <>
                        {branchListLoading ? (
                          <div className="space-y-2.5">
                            {Array.from({ length: 3 }).map((_, idx) => (
                              <div
                                key={`vn-branch-loading-${idx}`}
                                className="animate-pulse rounded-xl border border-white/60 bg-white/70 px-3 py-2.5"
                              >
                                <div className="h-3 w-full rounded bg-stone-200/70" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          vnBranchOptions.map((item, idx) => (
                            <button
                              key={item.id}
                              type="button"
                              disabled={vnUiLoading}
                              onClick={() => {
                                void handleVnBranchPick(item)
                              }}
                              className={`w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 text-center text-[14px] leading-[1.75] text-[#1f2937] transition-all hover:bg-white ${
                                idx === 2 ? 'mt-5' : ''
                              }`}
                            >
                              {item.content}
                            </button>
                          ))
                        )}
                      </>
                    ) : null}
                    <button
                      type="button"
                      disabled={vnUiLoading}
                      onClick={() => setVnCustomInputModalOpen(true)}
                      className="w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 text-center text-[14px] leading-[1.75] text-[#1f2937] transition-all hover:bg-white"
                    >
                      自定义输入
                    </button>
                    {vnUiLoading ? (
                      <div className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-center text-[13px] text-[#4b5563]">
                        剧情正在生成中...
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <VNDialogBox
                name={vnDialogName}
                loading={vnBoxLoading}
                innerVoice={vnBubbleIsInnerThought}
                showNameTag={!!vnBubble.speaker || vnBubbleIsInnerThought}
                canPlayVoice={vnCanPlayBubbleVoice}
                voiceDisabled={!!currentArchive.vnVoiceDisabled}
                voiceGenerating={vnLineVoiceGenerating}
                voicePlaying={vnLineVoicePlaying}
                onToggleVoice={() => {
                  void playVnBubbleVoice()
                }}
                onDisabledVoiceClick={() => showVnToast('已禁用语音合成，可在 VN 菜单关闭后恢复')}
                onContinue={handleVnContinue}
                showContinueHint={!vnBoxLoading}
              >
                {vnBubble.text}
              </VNDialogBox>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-20 px-4">
            <VNBottomControls
              isAutoPlay={isAutoPlay}
              playSpeed={playSpeed}
              onExit={() => {
                stopVnBgm()
                setMode('normal')
              }}
              onLog={openLog}
              onHeartWhisper={() => setHeartWhisperOpen(true)}
              onToggleAuto={toggleAutoPlay}
              onCycleSpeed={cyclePlaySpeed}
            />
          </div>

          {regeneratingPlotId ? (
            <div
              className="absolute inset-0 z-[130] flex flex-col items-center justify-center gap-3 touch-none bg-black/50 px-6"
              aria-busy="true"
              aria-live="polite"
              role="alertdialog"
              aria-label="正在重新生成剧情"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex max-w-[300px] flex-col items-center rounded-2xl border border-white/25 bg-white/95 px-6 py-8 shadow-[0_16px_48px_rgba(0,0,0,0.22)] backdrop-blur-md">
                <Loader2 className="size-9 animate-spin text-neutral-700" strokeWidth={1.75} />
                <p className="mt-4 text-center text-[15px] font-semibold text-neutral-900">正在重新生成</p>
                <p className="mt-1.5 text-center text-[12px] leading-relaxed text-neutral-500">
                  请稍候，当前无法操作；完成后将从本轮<strong className="font-medium text-neutral-700">第一句对白</strong>开始显示。
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <AnimatePresence>
        {isVn && logOpen ? (
          <motion.div
            className="absolute inset-0 z-[120] flex items-center justify-center bg-black/22 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <motion.div
              className="flex h-[78dvh] w-full max-w-[680px] flex-col overflow-hidden rounded-3xl border border-[#DCC9A6] bg-[#F8F8F6] shadow-[0_22px_60px_rgba(0,0,0,0.16)]"
              initial={{ y: 36, opacity: 0.78, scale: 0.985 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0.86, scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 240, damping: 30, mass: 0.92 }}
            >
              <div
                className="relative flex items-center justify-center border-b border-[#E6D9BF] bg-[#F3F1EC] px-4 py-3"
                style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
              >
                <p className="text-[12px] tracking-[0.45em] text-[#2F3540]">L O G</p>
                <button
                  type="button"
                  className="absolute right-3 rounded-full border border-[#E1D6BF] bg-[#FCFBF8] p-1.5 text-[#4B5563] transition hover:bg-white"
                  onClick={closeLog}
                  aria-label="关闭历史记录"
                >
                  <ChevronDown className="size-4" strokeWidth={1.5} />
                </button>
              </div>

              <div
                ref={vnLogScrollRef}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4 [scrollbar-color:rgba(120,130,145,0.35)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#9CA3AF]/40 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
              >
                {vnLogEntries.length ? (
                  vnLogEntries.map((entry) => {
                    const canPlayVoice =
                      entry.kind === 'dialogue' &&
                      entry.isUser !== true &&
                      !!entry.speakerId &&
                      entry.speakerId !== '__user__'
                    return (
                      <VnLogItemRenderer
                        key={entry.id}
                        item={entry}
                        canPlayVoice={canPlayVoice}
                        playing={vnLogPlayingId === entry.id && vnLineVoicePlaying}
                        generating={vnLogGeneratingId === entry.id}
                        onPlayVoice={() => {
                          void playCachedLogVoice(entry)
                        }}
                      />
                    )
                  })
                ) : (
                  <p className="py-8 text-center text-[13px] font-light text-[#9CA3AF]">当前还没有可回顾的台词</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {isVn && vnCustomInputModalOpen ? (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/35 p-4">
          <div className="w-full max-w-[520px] rounded-2xl border border-stone-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <p className="text-[14px] font-semibold text-stone-900">自定义输入</p>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-[13px] text-stone-500 hover:bg-stone-50 hover:text-stone-700"
                onClick={() => setVnCustomInputModalOpen(false)}
              >
                关闭
              </button>
            </div>
            <div className="space-y-2 px-4 py-4">
              <p className="text-[12px] leading-relaxed text-stone-500">
                输入剧情走向；开关「转述」决定这条输入是<strong className="font-medium text-stone-700">写作引导</strong>
                还是<strong className="font-medium text-stone-700">既成事实</strong>（见下方说明）。
              </p>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[#262626]">转述</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-stone-500">
                    开：输入仅指导方向，正文须<strong>当场演出过程</strong>（尚未默认已发生）。关：输入视为<strong>已经发生</strong>，正文直接写他人反应。
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!currentArchive.vnCustomInputParaphrase}
                  title="转述：输入为剧情引导，非既成事实"
                  onClick={() => setVnCustomInputParaphrase(!currentArchive.vnCustomInputParaphrase)}
                  className={`relative h-8 w-[52px] shrink-0 rounded-full p-1 transition-colors ${
                    currentArchive.vnCustomInputParaphrase ? 'bg-black' : 'bg-[#cccccc]'
                  }`}
                >
                  <span
                    className={`block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                      currentArchive.vnCustomInputParaphrase ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2">
                  <p className="text-[13px] text-[#262626]">上帝视角</p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={currentArchive.godPerspective}
                    onClick={() => setGodPerspective(!currentArchive.godPerspective)}
                    className={`relative h-8 w-[52px] rounded-full p-1 transition-colors ${
                      currentArchive.godPerspective ? 'bg-black' : 'bg-[#cccccc]'
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white transition-transform ${
                        currentArchive.godPerspective ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2">
                  <p className={`text-[13px] ${godLocksNoInterrupt ? 'text-[#a3a3a3]' : 'text-[#262626]'}`}>抢话</p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!godLocksNoInterrupt && autoUserReaction}
                    disabled={godLocksNoInterrupt}
                    onClick={() => {
                      if (godLocksNoInterrupt) return
                      setAutoUserReaction((v) => !v)
                    }}
                    className={`relative h-8 w-[52px] rounded-full p-1 transition-colors ${
                      godLocksNoInterrupt
                        ? 'cursor-not-allowed bg-[#d6d6d6]'
                        : autoUserReaction
                          ? 'bg-black'
                          : 'bg-[#cccccc]'
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white transition-transform ${
                        !godLocksNoInterrupt && autoUserReaction ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[12px] text-[#525252]">目标字数限制</p>
                  <span className="text-[11px] text-[#8e8e8e]">{lengthLabel}</span>
                </div>
                <input
                  type="number"
                  min={DATING_AI_LENGTH_TARGET_MIN}
                  max={DATING_AI_LENGTH_TARGET_MAX}
                  step={10}
                  value={lengthTargetChars}
                  onChange={(e) => setLengthTargetChars(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[13px] text-[#262626] outline-none focus:border-stone-400"
                  placeholder="如 500"
                />
                <p className="mt-1 text-[10px] leading-snug text-[#9a9a9a]">
                  范围 {DATING_AI_LENGTH_TARGET_MIN} - {DATING_AI_LENGTH_TARGET_MAX}，模型会尽量控制在目标区间附近。
                </p>
              </div>
              <textarea
                value={vnCustomInput}
                onChange={(e) => setVnCustomInput(e.target.value)}
                placeholder="例如：让两人先冷静下来，再慢慢把误会说开。"
                rows={4}
                enterKeyHint="send"
                autoComplete="off"
                className="w-full resize-y rounded-xl border border-stone-200 bg-white px-3 py-2 text-[14px] text-stone-900 outline-none focus:border-stone-400"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-stone-100 px-4 py-3">
              <button
                type="button"
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-[13px] text-stone-700 hover:bg-stone-50"
                onClick={() => setVnCustomInputModalOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                disabled={loading || !vnCustomInput.trim()}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
                onClick={() => {
                  void handleVnCustomGenerate()
                }}
              >
                {loading ? '生成中…' : '生成剧情'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
      <SpriteEditorPage
        open={portraitSetupOpen}
        actors={spriteActors}
        onClose={() => setPortraitSetupOpen(false)}
      />
      {showVnBlockingGeneratingModal ? (
        <div className="absolute inset-0 z-[130] flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
          <div className="mx-6 w-full max-w-[320px] rounded-2xl border border-white/35 bg-white/85 px-5 py-4 text-center shadow-[0_18px_44px_rgba(0,0,0,0.22)]">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#c7ced9] border-t-[#111827]" />
            <p className="text-[15px] font-medium text-[#111827]">剧情正在生成中</p>
            <p className="mt-1 text-[12px] text-[#4b5563]">请稍候，生成完成后将自动继续</p>
          </div>
        </div>
      ) : null}
      {bgmConfigOpen ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-[420px] rounded-2xl border border-stone-200 bg-white p-4 shadow-lg">
            <p className="text-[15px] font-semibold text-stone-900">BGM配置</p>
            <p className="mt-2 text-[13px] leading-relaxed text-stone-600">
              当前已接入 VN 自动切歌。
              {vnBgmCurrentName ? `正在播放：${vnBgmCurrentName}。` : vnBgmAwaitingGesture ? '等待你的首次点击后播放 BGM。' : '当前暂无播放。'}
              你可以继续往 BGM 文件夹放歌，系统会自动纳入候选并在剧情节点前切换。
            </p>
            <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
              <div className="flex items-center justify-between text-[12px] text-stone-700">
                <span>BGM音量</span>
                <span>
                  {Math.round(vnBgmVolumeBalance) === 0
                    ? '持平'
                    : `${Math.round(vnBgmVolumeBalance) > 0 ? '+' : ''}${Math.round(vnBgmVolumeBalance)}%`}
                </span>
              </div>
              <input
                type="range"
                min={VN_BGM_BALANCE_MIN}
                max={VN_BGM_BALANCE_MAX}
                step={1}
                value={Math.round(vnBgmVolumeBalance)}
                onChange={(e) => {
                  const balance = clampVnBgmBalance(Number(e.target.value))
                  updateVnBgmVolumeScale(toVnBgmVolumeScale(balance))
                }}
                className="mt-2 w-full accent-neutral-900"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-stone-500">
                <span>更小</span>
                <span>居中=持平</span>
                <span>更大</span>
              </div>
              <p className="mt-1 text-[11px] text-stone-500">仅影响 VN 背景音乐，不影响对白语音音量。</p>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-[12px] text-white"
                onClick={() => setBgmConfigOpen(false)}
              >
                关闭
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

      {vnRollbackConfirmOpen ? (
        <div
          className="absolute inset-0 z-[52] flex items-center justify-center bg-black/35 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vn-rollback-confirm-title"
          onClick={() => setVnRollbackConfirmOpen(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl border border-stone-200 bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="vn-rollback-confirm-title" className="text-center text-[16px] font-semibold text-[#262626]">
              确认撤回上一轮？
            </p>
            <p className="mt-2 text-center text-[12px] leading-relaxed text-[#737373]">
              将删除你的最后一条输入与本轮 AI 回复，对话气泡回到上一轮末尾。此操作不可撤销。
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-[13px] text-[#262626] hover:bg-stone-50"
                onClick={() => setVnRollbackConfirmOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-xl bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-neutral-800"
                onClick={confirmVnRollback}
              >
                确认撤回
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {vnRegenerateConfirmOpen ? (
        <div
          className="absolute inset-0 z-[52] flex items-center justify-center bg-black/35 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vn-regen-confirm-title"
          onClick={() => setVnRegenerateConfirmOpen(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl border border-stone-200 bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="vn-regen-confirm-title" className="text-center text-[16px] font-semibold text-[#262626]">
              重新生成此轮内容？
            </p>
            <p className="mt-2 text-center text-[12px] leading-relaxed text-[#737373]">
              将按当前视角与长度等设定重新请求 AI，<span className="font-medium text-[#404040]">新生成结果会直接覆盖</span>
              当前可见的本轮对方回复；你的输入不会删除。若介意当前稿，请先自行复制备份。
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-[13px] text-[#262626] hover:bg-stone-50"
                onClick={() => setVnRegenerateConfirmOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-xl bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-neutral-800"
                onClick={confirmVnRegenerateRound}
              >
                确认重新生成
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

