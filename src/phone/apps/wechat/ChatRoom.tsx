import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, PhoneCall, X } from 'lucide-react'

import { useCustomization } from '../../CustomizationContext'
import { Pressable } from '../../components/Pressable'
import type { WeChatBubbleTheme, WeChatTheme } from '../../types'
import { wechatBubbleThemesEqual } from '../../types'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { useIsSubApiEnabled } from '../api/ApiSettingsContext'

import { useChatTheme } from './ChatThemeContext'
import {
  densityToTrackCount,
  hexAndOpacityToRgba,
  resolveEffectiveDanmakuVisuals,
} from './danmakuResolve'
import { personaDb } from './newFriendsPersona/idb'
import type {
  Character,
  CharacterBusySettingsRow,
  CharacterDanmakuSettingsRow,
  HeartWhisper,
  PlayerIdentity,
  WeChatChatMessage,
  WeChatImageMime,
  WeChatGlobalSettingsRow,
  WeChatRedPacketPayload,
  WeChatTransferPayload,
  WeChatReplyToMeta,
} from './newFriendsPersona/types'
import {
  requestWeChatHeartWhisper,
  requestWeChatDanmakuVarietyShow,
  requestWeChatPeerReplyBubbles,
  requestWeChatPeerReplyBubblesWithImage,
  requestWeChatVoiceCallReplyText,
  requestWeChatVoiceCallDecision,
  WECHAT_RECALL_ACTION_TOKEN,
  type BusyRuntimeContext,
  type ChatTranscriptTurn,
  type WeChatPeerReplyResult,
} from './wechatChatAi'
import { loadOfflineDatingPlotsPromptBlock } from './dating/loadOfflineDatingPlotsForWechatPrompt'
import { runUnifiedAutoMemorySummaryAfterThreshold } from './unifiedMemoryAutoSummary'
import { DanmakuOverlay } from './DanmakuOverlay'
import { useWeChatCurrentTime } from './time/useWeChatCurrentTime'
import { formatWeChatChatTimestamp, shouldRenderWeChatTimestamp } from './time/wechatTimeUtils'
import { WECHAT_LUMI_PEER_CHARACTER_ID, wechatConversationKey } from './wechatConversationKey'
import { formatWorldBackgroundForPrompt } from './newFriendsPersona/worldBackgroundFormat'
import { WeChatMessageBubbleRow } from './WeChatMessageBubbleRow'
import { WeChatChatImageBubbleRow } from './WeChatChatImageBubbleRow'
import {
  WeChatMessageActionPanel,
  type PanelAnchor,
  type WeChatMessageActionId,
} from './WeChatMessageActionPanel'
import { WeChatCenterToast } from './WeChatCenterToast'
import { WeChatConfirmDialog } from './WeChatConfirmDialog'
import {
  PLUS_MENU_HEIGHT_PX,
  WeChatChatPlusMenuPanel,
  type WeChatPlusActionId,
} from './WeChatChatPlusMenu'
import { CheckPhoneFlow } from './checkPhone/CheckPhoneFlow'
import { WeChatChatCameraScreen } from './WeChatChatCameraScreen'
import { useWeChatConsole } from './WeChatConsoleContext'
import { HeartWhisperModal } from './HeartWhisperModal'
import { RedPacketChatRow } from './redPacket/RedPacketChatRow'
import { TransferChatRow } from './transfer/TransferChatRow'
import { RedPacketModal } from './redPacket/RedPacketModal'
import { upsertLumiTransfer } from './transfer/lumiTransferStorage'
import { evaluateExpiredTransfers, getLumiTransferFresh } from './transfer/lumiTransferStorage'
import { walletAddTransaction, walletAdjustBalance } from './wallet/walletMockStore'
import { CallingScreen } from './voiceCall/CallingScreen'
import { IncomingCallScreen } from './voiceCall/IncomingCallScreen'
import { VoiceCallActionSheet } from './voiceCall/VoiceCallActionSheet'
import { VoiceCallPanel } from './voiceCall/VoiceCallPanel'
import { requestSiliconflowTranscription } from './voiceCall/siliconflowAsr'
import { StickerPickerPanel } from './stickers/StickerPickerPanel'
import { resolveStickerOutputRef } from './stickers/stickerStore'
import { ChatInputBar } from './voiceInput/ChatInputBar'
import { VoiceOverlay, type VoiceGestureZone } from './voiceInput/VoiceOverlay'
import { VoiceMessageBubble } from './VoiceMessageBubble'
import { createMiniMaxT2ASyncAudioBlob } from '../voiceprint/services/minimaxApi'
import { RecallNotice } from './RecallNotice'
import { RecallHistoryModal, type RecallHistoryRecord } from './RecallHistoryModal'
import './chatRoomMotion.css'
import { useConsoleLogger } from './useConsoleLogger'

const VoiceCallPanelCompat = VoiceCallPanel as unknown as (
  props: ComponentProps<typeof VoiceCallPanel> & { initialAiText?: string }
) => ReactNode

const LUMI_DEFAULT_OPENING_BUBBLES = [
  '嗨，我是 Lumi，是您的专属小助手！',
  '您在这里遇到任何问题，都可以直接问我：比如 API/模型怎么配、人设/世界书怎么绑、发图看图怎么用、气泡主题/拆条怎么调等。你有什么困惑的地方吗？',
  '官方教程（建议收藏）：https://www.notion.so/Lumi-Phone-350d29002fd980fdafb8c00f3e13b2b6?source=copy_link',
]
const ENTER_DOUBLE_TAP_WINDOW_MS = 220
const ENTER_SINGLE_COMMIT_DELAY_MS = 80
const CHAT_VISIBLE_MSG_INITIAL = 30
const CHAT_VISIBLE_MSG_STEP = 30
const hasSpeechRecognitionApi = true
const VOICE_HOLD_START_MS = 180
const VOICE_TAP_MOVE_THRESHOLD_PX = 12
const VOICE_ALLOWED_TONE_TOKENS = new Set([
  'clear-throat',
  'laughs',
  'chuckle',
  'coughs',
  'groans',
  'breath',
  'pant',
  'inhale',
  'exhale',
  'gasps',
  'sniffs',
  'sighs',
  'snorts',
  'burps',
  'lip-smacking',
  'humming',
  'hissing',
  'emm',
  'sneezes',
])

function isSameApiConfigShape(
  a: ReturnType<typeof useCurrentApiConfig>,
  b: ReturnType<typeof useCurrentApiConfig>,
): boolean {
  if (!a || !b) return false
  return (
    String(a.apiUrl || '').trim() === String(b.apiUrl || '').trim() &&
    String(a.apiKey || '').trim() === String(b.apiKey || '').trim() &&
    String(a.modelId || '').trim() === String(b.modelId || '').trim()
  )
}
const VOICE_ALLOWED_EMOTIONS = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'neutral', 'calm', 'fluent', 'whisper'] as const
function makeStableLumiOpeningId(conversationKey: string, index: number): string {
  const key = conversationKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 48)
  return `wxm-${key}-lumi-open-${index}`
}

function makeStablePersonaOpeningId(conversationKey: string, index: number): string {
  const key = conversationKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 48)
  return `wxm-${key}-persona-open-${index}`
}

function itemsToTranscript(items: ChatItem[]): ChatTranscriptTurn[] {
  return items
    .filter((x): x is ChatMsg => x.kind === 'msg')
    .map((m) => {
      if (m.isRecalled) {
        const who = m.from === 'self' ? '用户' : '对方'
        return { id: m.id, from: m.from, text: `（${who}撤回了一条消息）` }
      }
      if (m.voice) {
        const txt = m.voice.transcriptText?.trim() || m.text?.trim() || '（语音）'
        const emo = m.voice.emotionLabel?.trim()
        const who = m.from === 'self' ? '用户语音' : '对方语音'
        const voiceText = emo ? `（${who}，情绪：${emo}）${txt}` : `（${who}）${txt}`
        return { id: m.id, from: m.from, text: voiceText, replyTo: m.replyTo }
      }
      const text = m.text?.trim()
      if (text) return { id: m.id, from: m.from, text, replyTo: m.replyTo }
      if (m.images?.length) return { id: m.id, from: m.from, text: '（发送了一张图片）', replyTo: m.replyTo }
      return { id: m.id, from: m.from, text: '', replyTo: m.replyTo }
    })
    .filter((t) => t.text.trim())
}

function bubbleForRole(theme: WeChatTheme, roleKey: string): WeChatBubbleTheme {
  let by = theme.bubbleByRole?.[roleKey]
  if (!by && roleKey === WECHAT_LUMI_PEER_CHARACTER_ID) {
    by = theme.bubbleByRole?.['lumi']
  }
  if (!by) return theme.bubbleGlobal
  if (wechatBubbleThemesEqual(by, theme.bubbleGlobal)) return theme.bubbleGlobal
  return by
}

function sleep(ms: number) {
  return new Promise<void>((r) => {
    window.setTimeout(r, ms)
  })
}

function sanitizeVoiceTranscriptDisplay(input: string): string {
  return String(input ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\{\/?(happy|sad|angry|fearful|disgusted|surprised|neutral|calm|fluent|whisper)\}/gi, ' ')
    // 去掉独立口癖（如“啧”“哈...”），避免显示在语音转写文本中
    .replace(/(^|[\s，。！？!?,、；;:：])(啧+|哈+)(?:\s*(?:\.{2,}|…+|~+|～+))?(?=$|[\s，。！？!?,、；;:：])/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeVoiceControlForTextBubble(input: string): string {
  return String(input ?? '')
    .replace(/<#\s*[\d.]+\s*#>/g, ' ')
    .replace(/\(([a-zA-Z][a-zA-Z\- ]{0,24})\)/g, ' ')
    .replace(/\{\/?(happy|sad|angry|fearful|disgusted|surprised|neutral|calm|fluent|whisper)\}/gi, ' ')
    // 去掉模型偶发泄露的“语音来源标签”，避免在普通文本气泡里显示“（对方语音）”
    .replace(/（(?:对方|用户)?语音(?:[，,:：][^）]{1,16})?）/g, ' ')
    .replace(/\((?:对方|用户)?语音(?:[，,:：][^)]{1,16})?\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeVoiceScriptForTts(input: string): string {
  let s = String(input ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return '{neutral}(breath)<#0.4#>嗯。{/neutral}'

  // 仅保留白名单语气词，其他括号内容清除，避免读出奇怪英文词。
  s = s.replace(/\(([^)]*)\)/g, (_m, inner: string) => {
    const token = String(inner || '').trim().toLowerCase()
    return VOICE_ALLOWED_TONE_TOKENS.has(token) ? `(${token})` : ' '
  })

  // 清理非白名单情绪标签，避免错误标签被朗读
  s = s.replace(/\{\/?([a-zA-Z]+)\}/g, (m, tag: string) => {
    const t = String(tag || '').toLowerCase()
    return (VOICE_ALLOWED_EMOTIONS as readonly string[]).includes(t) ? m.toLowerCase() : ' '
  })

  // 去掉独立口癖语气词（如“啧”“哈...”），避免生成无意义口头音。
  s = s.replace(
    /(^|[\s，。！？!?,、；;:：])(啧+|哈+)(?:\s*(?:\.{2,}|…+|~+|～+))?(?=$|[\s，。！？!?,、；;:：])/gu,
    '$1',
  )

  const plain = sanitizeVoiceControlForTextBubble(s)
  const guessEmotion = () => {
    const t = plain
    // 轻量启发式：问号/“真的假的/啊？”偏惊讶；撒娇/喜欢偏开心；明显负向偏伤感；强烈否定偏生气
    const surprised = /真的假的|真的吗|不会吧|啊\?|诶\?|哎\?|震惊|？！|\?!|\?！/u.test(t) || /[?？]/u.test(t)
    const happy = /喜欢|求求|拜托|太好了|好耶|开心|嘿嘿|嘻嘻|~|么|嘛/u.test(t)
    const sad = /难过|委屈|想哭|呜呜|唉|算了吧|对不起/u.test(t)
    const angry = /气死|烦死|别闹|够了|离谱|你干嘛/u.test(t)
    if (angry) return 'angry' as const
    if (sad) return 'sad' as const
    if (surprised && !happy) return 'surprised' as const
    if (happy) return 'happy' as const
    // 句子更长且较顺滑时偏 fluent
    if (t.length >= 26 && /[，。,.]/u.test(t) && !/[!?？！]/u.test(t)) return 'fluent' as const
    return 'neutral' as const
  }
  // 停顿更“像人”：省略号/波浪号/标点插入不同停顿
  if (!/<#\s*[\d.]+\s*#>/.test(s)) {
    s = s
      .replace(/(\.\.\.|…+)/g, `<#0.5#>$1<#0.5#>`)
      .replace(/([，,])/g, `$1<#0.35#>`)
      .replace(/([。；;])/g, `$1<#0.5#>`)
      .replace(/([！？!?])/g, `$1<#0.6#>`)
      .replace(/(~+)/g, `$1<#0.25#>`)
      .replace(/\s+/g, ' ')
      .trim()
    if (!/<#\s*[\d.]+\s*#>/.test(s)) s = `<#0.4#>${s}`
  }

  // 没有情绪标签就按内容猜一个（不再默认 neutral）
  const hasEmotionTag = /\{(happy|sad|angry|fearful|disgusted|surprised|neutral|calm|fluent|whisper)\}/i.test(s)
  if (!hasEmotionTag) {
    const emo = guessEmotion()
    s = `{${emo}}${s}{/${emo}}`
  }

  // 再次收敛空白
  return s.replace(/\s+/g, ' ').trim()
}

function stripEmotionTagsForTts(input: string): string {
  // 按官方 t2a_v2 文档：保留语气词标签与停顿；花括号情绪标签不直接入文本，改由 voice_setting.emotion 控制。
  let s = String(input ?? '')
    .replace(/\{\/?(happy|sad|angry|fearful|disgusted|surprised|neutral|calm|fluent|whisper)\}/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // 统一各种括号到 ()，便于白名单判定（例如 （coughs） / [coughs] / 【coughs】）
  s = s
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/【/g, '(')
    .replace(/】/g, ')')

  // 仅保留白名单语气词，其他英文括号内容剔除，避免被直接念出来
  s = s.replace(/\(([^)]*)\)/g, (_m, inner: string) => {
    const token = String(inner || '').trim().toLowerCase()
    return VOICE_ALLOWED_TONE_TOKENS.has(token) ? `(${token})` : ' '
  })

  // 保留合法停顿控制符，清理其它尖括号片段
  s = s.replace(/<(?!#\s*[\d.]+\s*#>)[^>]*>/g, ' ')

  return s.replace(/\s+/g, ' ').trim()
}

function pickVoiceEmotionForTts(input: string): (typeof VOICE_ALLOWED_EMOTIONS)[number] | undefined {
  const s = String(input ?? '')
  const m = s.match(/\{(happy|sad|angry|fearful|disgusted|surprised|neutral|calm|fluent|whisper)\}/i)
  if (!m?.[1]) return undefined
  const emo = m[1].toLowerCase() as (typeof VOICE_ALLOWED_EMOTIONS)[number]
  return (VOICE_ALLOWED_EMOTIONS as readonly string[]).includes(emo) ? emo : undefined
}

function mapWeChatMessagesToChatItems(msgs: WeChatChatMessage[]): ChatMsg[] {
  if (msgs.length === 0) {
    return []
  }
  const mapped: ChatMsg[] = []
  for (const m of msgs) {
    mapped.push({
      id: m.id,
      kind: 'msg',
      from: m.type === 'player' ? 'self' : 'other',
      text: m.content,
      thinking: m.thinking,
      timestamp: m.timestamp,
      replyTo: m.replyTo,
      images: m.images,
      redPacket: m.redPacket,
      transfer: m.transfer,
      callStatus: m.callStatus,
      voice: m.voice,
      originalText: m.originalContent,
      isRecalled: m.isRecalled,
      recallTimestamp: m.recallTimestamp,
      recalledBy: m.recalledBy === 'character' ? 'other' : m.recalledBy === 'player' ? 'self' : undefined,
      status: 'sent',
    })
  }
  return mapped
}

function rebuildChatItemsWithTimestamps(msgs: ChatMsg[], formatWxTimeLabel: (ts: number) => string, nowMs: number): ChatItem[] {
  if (msgs.length === 0) {
    return [{ id: `t-empty-${nowMs}`, kind: 'time', text: formatWxTimeLabel(nowMs) }]
  }
  const next: ChatItem[] = []
  let lastShownTime: number | null = null
  for (const msg of msgs) {
    if (shouldRenderWeChatTimestamp(lastShownTime, msg.timestamp)) {
      next.push({
        id: `t-${msg.id}-${msg.timestamp}`,
        kind: 'time',
        text: formatWxTimeLabel(msg.timestamp),
      })
      lastShownTime = msg.timestamp
    }
    next.push(msg)
  }
  return next
}

function messagePlainPreview(
  msg: Pick<ChatMsg, 'text' | 'images' | 'redPacket' | 'transfer' | 'callStatus' | 'voice' | 'isRecalled'>,
): string {
  if (msg.isRecalled) return '该消息已撤回'
  if (msg.transfer) return '[转账]'
  if (msg.callStatus) return '[通话]'
  if (msg.voice) return `[语音] ${Math.max(1, Math.round(msg.voice.durationSec || 1))}"`
  const rp = msg.redPacket
  if (rp) {
    const r = rp.remark?.trim()
    return r ? `[红包] ${r}` : '[红包]'
  }
  const t = msg.text?.trim()
  if (t) return t
  if (msg.images?.length) return '[图片]'
  return '...'
}

function parseReplyMarker(raw: string): { replyMessageId?: string; text: string } {
  const line = String(raw ?? '')
    // 无论出现在行首/行中/行尾，都剥离模型泄露的内部消息ID标记
    .replace(/\s*(?:\[消息ID[:：][^\]]+\]|【消息ID[:：][^】]+】)\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (!line) return { text: '' }
  const inline = line.match(/^\[引用[:：]([^\]]+)\]\s*(.*)$/)
  if (inline) {
    return {
      replyMessageId: inline[1]?.trim() || undefined,
      text: (inline[2] ?? '').trim(),
    }
  }
  const pure = line.match(/^\[引用[:：]([^\]]+)\]$/)
  if (pure) return { replyMessageId: pure[1]?.trim() || undefined, text: '' }
  // 兼容旧格式：
  // [引用回复] 本条正在回复：消息ID=xxx; 发送者=xxx; 原文=xxx; <正文>
  // 以及仅有头部、正文另起一行/下一条的场景
  const legacyHeader = line.match(
    /^\[引用回复\]\s*本条正在回复[:：]\s*消息ID\s*[=：:]\s*([^;；\s]+)\s*[;；]?\s*([\s\S]*)$/,
  )
  if (legacyHeader) {
    const replyMessageId = legacyHeader[1]?.trim() || undefined
    const tail = (legacyHeader[2] ?? '').trim()
    // 尽量剥离 "发送者=...; 原文=...;" 的元信息，保留真正正文
    const text = tail
      .replace(/^(?:发送者\s*[=：:]\s*[^;；\n]+[;；]?\s*)+/u, '')
      .replace(/^(?:原文\s*[=：:]\s*[^;；\n]+[;；]?\s*)+/u, '')
      .trim()
    return { replyMessageId, text }
  }
  return { text: line }
}

function parseBusyDirective(raw: string): { reason: string; duration: number } | null {
  const line = String(raw ?? '')
    .replace(/```(?:json)?/gi, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
  const busyIdx = line.toUpperCase().indexOf('[BUSY]')
  if (busyIdx < 0) return null
  const after = line.slice(busyIdx + '[BUSY]'.length)
  const left = after.indexOf('{')
  const right = after.lastIndexOf('}')
  if (left < 0 || right <= left) return null
  const jsonRaw = after.slice(left, right + 1)
  try {
    const j = JSON.parse(jsonRaw) as { reason?: unknown; duration?: unknown }
    const reason = String(j.reason ?? '').trim() || '暂时有事'
    const duration = Math.min(120, Math.max(1, Math.round(Number(j.duration ?? 15) || 15)))
    return { reason, duration }
  } catch {
    return null
  }
}

type AiRedPacketDirective = { amountYuan: number; remark: string }
type AiTransferDirective = { amountYuan: number; remark: string }
type AiVoiceCallDirective = { type: 'start'; openingLine?: string }

function parseRedPacketDirective(raw: string): AiRedPacketDirective | null {
  const line = String(raw ?? '').trim()
  const m = /^\[REDPACKET\]\s*(\{[\s\S]*\})$/i.exec(line)
  if (!m) return null
  try {
    const j = JSON.parse(m[1]!) as { amount?: unknown; remark?: unknown }
    const amountRaw = Number(j.amount)
    const amountYuan = Number.isFinite(amountRaw) ? Math.round(amountRaw * 100) / 100 : Number.NaN
    const remark = String(j.remark ?? '').trim().slice(0, 64)
    if (!Number.isFinite(amountYuan) || amountYuan < 0.01 || amountYuan > 200) return null
    return { amountYuan, remark }
  } catch {
    return null
  }
}

function parseTransferDirective(raw: string): AiTransferDirective | null {
  const line = String(raw ?? '').trim()
  const m = /^\[TRANSFER\]\s*(\{[\s\S]*\})$/i.exec(line)
  if (!m) return null
  try {
    const j = JSON.parse(m[1]!) as { amount?: unknown; remark?: unknown }
    const amountRaw = Number(j.amount)
    const amountYuan = Number.isFinite(amountRaw) ? Math.round(amountRaw * 100) / 100 : Number.NaN
    const remark = String(j.remark ?? '').trim().slice(0, 40)
    if (!Number.isFinite(amountYuan) || amountYuan < 0.01) return null
    return { amountYuan, remark }
  } catch {
    return null
  }
}

function parseVoiceCallDirective(raw: string): AiVoiceCallDirective | null {
  const line = String(raw ?? '').trim()
  const m =
    /^\[VOICECALL\]\s*(\{[\s\S]*\})$/i.exec(line) ??
    /^\[VOICECALL\s*(\{[\s\S]*\})\]$/i.exec(line)
  if (!m) return null
  try {
    const j = JSON.parse(m[1]!) as { type?: unknown; opening?: unknown; openingLine?: unknown; firstLine?: unknown }
    const t = String(j.type ?? '')
      .trim()
      .toLowerCase()
    if (t !== 'start') return null
    const openingRaw = j.openingLine ?? j.opening ?? j.firstLine
    const openingLine = typeof openingRaw === 'string' ? openingRaw.trim().slice(0, 120) : ''
    return openingLine ? { type: 'start', openingLine } : { type: 'start' }
  } catch {
    return null
  }
}

/** 角色侧：单行 `[表情包]引用名` 或兼容旧版 `[表情包]URL/路径`（须能解析到表情包资源库） */
function parseCharacterStickerLine(line: string): { url: string } | null {
  const t = String(line ?? '').trim()
  const m = /^\[表情包\]\s*(.+)$/.exec(t)
  if (!m) return null
  const raw = m[1]!.trim().replace(/^['"`「」]+|['"`」]+$/g, '').trim()
  if (!raw) return null
  const url = resolveStickerOutputRef(raw)
  if (!url) return null
  return { url }
}

function extractDanmakuFromBubbleText(lines: string[]): { cleaned: string[]; danmakuLines: string[] } {
  const input = (lines ?? []).map((s) => String(s ?? '')).join('\n')
  const normalized = input
    .replace(/\\n/g, '\n')
    .replace(/\\<(\/?danmaku\b[^>]*)>/gi, '<$1>')
  const tagRe = /<danmaku\b[^>]*>([\s\S]*?)<\/danmaku>/gi
  const blocks: string[] = []
  const visible = normalized.replace(tagRe, (_all, body: string) => {
    blocks.push(String(body ?? '').trim())
    return ''
  })
  const cleaned = visible
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!blocks.length) return { cleaned, danmakuLines: [] }
  const dm: string[] = []
  for (const body of blocks) {
    try {
      const j = JSON.parse(body) as unknown
      if (Array.isArray(j)) {
        dm.push(...j.map((x) => String(x ?? '').trim()).filter(Boolean))
        continue
      }
    } catch {
      // ignore and fallback
    }
    dm.push(
      ...body
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
  }
  return { cleaned, danmakuLines: dm.slice(0, 20) }
}

function formatBusyCountdownByEndTime(endTimeMs: number, nowMs = Date.now()): string {
  const remainMs = Math.max(0, endTimeMs - nowMs)
  const totalSec = Math.ceil(remainMs / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}分${String(sec).padStart(2, '0')}秒`
}

function buildBusyToastText(peerName: string, reason: string, endTimeMs: number, nowMs = Date.now()): string {
  const cleanReason = reason.trim() || '处理点事情'
  const countdown = formatBusyCountdownByEndTime(endTimeMs, nowMs)
  return `${peerName}正在${cleanReason}\n预计还要 ${countdown}`
}

const LS_TRANSFER_RETURN_NOTIFIED_KEY = 'wechat-transfer-return-notified-v1'
const LS_REDPACKET_EXPIRED_NOTIFIED_KEY = 'wechat-redpacket-expired-notified-v1'

function readNotifiedSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string' && !!String(x).trim()).map((s) => String(s).trim()))
  } catch {
    return new Set()
  }
}

function writeNotifiedSet(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...set]))
  } catch {
    /* ignore */
  }
}

/** 将子元素顶对齐到容器可视区域顶部，ease-out 约 300ms */
function scrollChildToTopSmooth(
  container: HTMLElement,
  child: HTMLElement,
  durationMs: number,
  onDone?: () => void,
) {
  const cRect = container.getBoundingClientRect()
  const chRect = child.getBoundingClientRect()
  const targetTop = container.scrollTop + (chRect.top - cRect.top)
  const end = Math.max(0, targetTop)
  const start = container.scrollTop
  const t0 = performance.now()
  const easeOut = (t: number) => 1 - (1 - t) * (1 - t)
  const tick = (now: number) => {
    const t = Math.min(1, (now - t0) / durationMs)
    container.scrollTop = start + (end - start) * easeOut(t)
    if (t < 1) requestAnimationFrame(tick)
    else onDone?.()
  }
  requestAnimationFrame(tick)
}

function isScrollNearBottom(el: HTMLElement, thresholdPx = 28): boolean {
  const remain = el.scrollHeight - (el.scrollTop + el.clientHeight)
  return remain <= thresholdPx
}

function randomBetween(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1))
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race<T>([
    promise,
    new Promise<T>((_, reject) =>
      window.setTimeout(() => reject(new Error(`timeout:${timeoutMs}ms`)), timeoutMs),
    ),
  ])
}

function parseDataUrlParts(dataUrl: string): { mime: string; base64: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!m) return null
  return { mime: String(m[1] ?? '').toLowerCase(), base64: String(m[2] ?? '').trim() }
}

function isSupportedStickerMime(mime: string): mime is WeChatImageMime {
  return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/gif' || mime === 'image/webp'
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk)
    binary += String.fromCharCode(...sub)
  }
  return btoa(binary)
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const mime = (blob.type || 'audio/mpeg').trim().toLowerCase()
  const base64 = arrayBufferToBase64(await blob.arrayBuffer())
  return `data:${mime};base64,${base64}`
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image_load_failed'))
    img.src = src
  })
}

async function stickerUrlToImagePayload(url: string): Promise<{ base64: string; mime: WeChatImageMime }> {
  const raw = url.trim()
  if (!raw) throw new Error('empty_sticker_url')
  const parsed = parseDataUrlParts(raw)
  if (parsed?.base64 && isSupportedStickerMime(parsed.mime)) {
    return { base64: parsed.base64, mime: parsed.mime }
  }
  if (!parsed) {
    const resp = await fetch(raw, { mode: 'cors' })
    if (!resp.ok) throw new Error(`sticker_fetch_failed:${resp.status}`)
    const blob = await resp.blob()
    const mime = blob.type.toLowerCase()
    if (isSupportedStickerMime(mime)) {
      const base64 = arrayBufferToBase64(await blob.arrayBuffer())
      return { base64, mime }
    }
  }

  let src = raw
  let revokeUrl: string | null = null
  try {
    if (!parsed) {
      const resp = await fetch(raw)
      if (!resp.ok) throw new Error(`sticker_fetch_failed:${resp.status}`)
      const blob = await resp.blob()
      src = URL.createObjectURL(blob)
      revokeUrl = src
    }
    const img = await loadImageElement(src)
    const width = Math.max(1, img.naturalWidth || img.width || 1)
    const height = Math.max(1, img.naturalHeight || img.height || 1)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas_ctx_unavailable')
    ctx.drawImage(img, 0, 0, width, height)
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const jpeg = parseDataUrlParts(jpegDataUrl)
    if (!jpeg?.base64) throw new Error('jpeg_encode_failed')
    return { base64: jpeg.base64, mime: 'image/jpeg' }
  } finally {
    if (revokeUrl) URL.revokeObjectURL(revokeUrl)
  }
}

function MultiSelectCheck({ checked }: { checked: boolean }) {
  return (
    <span
      className="flex h-6 w-6 items-center justify-center rounded-full border"
      style={{
        borderColor: checked ? '#000000' : '#c7c7cc',
        backgroundColor: checked ? '#000000' : 'transparent',
      }}
      aria-hidden
    >
      {checked ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : null}
    </span>
  )
}

type MsgStatus = 'sending' | 'sent' | 'failed'

type ChatMsg = {
  id: string
  kind: 'msg'
  from: 'self' | 'other'
  text: string
  thinking?: string
  timestamp: number
  replyTo?: WeChatReplyToMeta
  images?: { base64: string; type: WeChatImageMime }[]
  redPacket?: WeChatRedPacketPayload
  transfer?: WeChatTransferPayload
  callStatus?: { status: 'rejected' | 'no_answer' | 'duration'; durationSec?: number }
  voice?: {
    durationSec: number
    emotionAnalyzed?: boolean
    emotionLabel?: string
    ttsScript?: string
    audioUrl?: string
    transcriptText?: string
  }
  status?: MsgStatus
  /** 为 true 时播放对方消息入场动效 */
  otherAnimated?: boolean
  /** 为 true 时播放己方消息入场动效（与对方相同） */
  selfAnimated?: boolean
  originalText?: string
  isRecalled?: boolean
  recallTimestamp?: number
  recalledBy?: 'self' | 'other'
}

type ChatTime = { id: string; kind: 'time'; text: string }

type ChatItem = ChatMsg | ChatTime

type ChatMsgProps = {
  messageText: string
  bubble: WeChatBubbleTheme
  showAvatar: boolean
  showBubbleTail: boolean
  /** 己方气泡旁头像，与全局资料一致 */
  chatSelfAvatarUrl?: string
  /** 对方气泡旁头像（通讯录 / 人设库） */
  chatOtherAvatarUrl?: string
  /** 单击对方头像：快捷打开面板（如心语） */
  onOtherAvatarClick?: () => void
  onBubbleLongPress?: (anchorRect: DOMRect) => void
  bubbleSelected?: boolean
}

/** 连续同侧 8px；交替 16px */
function messageBlockSpacing(items: ChatItem[], index: number): string {
  if (index <= 0) return ''
  const cur = items[index]
  const prev = items[index - 1]
  if (cur.kind === 'time') return 'mt-4'
  if (prev.kind === 'time') return 'mt-4'
  if (cur.kind === 'msg' && prev.kind === 'msg') {
    if (cur.from === prev.from) return 'mt-2'
    return 'mt-4'
  }
  return 'mt-4'
}

/** 与上一条是否为连续同侧（对方合并：首条显头像） */
function consecutiveSameSpeaker(items: ChatItem[], index: number): boolean {
  if (index <= 0) return false
  const cur = items[index]
  if (cur.kind !== 'msg' || cur.isRecalled) return false
  for (let i = index - 1; i >= 0; i -= 1) {
    const prev = items[i]
    if (prev.kind === 'time') return false
    if (prev.kind !== 'msg') continue
    // 已撤回消息只显示撤回提示，不应参与头像“连续同侧”合并判断。
    if (prev.isRecalled) continue
    return cur.from === prev.from
  }
  return false
}

/** 极简入场：轻微上移 + 微缩放 + 渐显，避免弹跳感。 */
function ChatMessageEnter({ children, isSelf = false }: { children: ReactNode; isSelf?: boolean }) {
  const [entered, setEntered] = useState(false)
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
        transformOrigin: isSelf ? 'right bottom' : 'left bottom',
        transition: 'opacity 320ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </div>
  )
}

function OtherMessageEnter({
  messageText,
  bubble,
  showAvatar,
  showBubbleTail,
  showAvatarColumn = true,
  chatOtherAvatarUrl,
  onOtherAvatarClick,
  onBubbleLongPress,
  bubbleSelected,
}: ChatMsgProps & { showAvatarColumn?: boolean }) {
  return (
    <ChatMessageEnter isSelf={false}>
      <WeChatMessageBubbleRow
        messageText={messageText}
        isSelf={false}
        bubble={bubble}
        showAvatar={showAvatar}
        showBubbleTail={showBubbleTail}
        variant="chat"
        avatarTapMotion
        showAvatarColumn={showAvatarColumn}
        chatOtherAvatarUrl={chatOtherAvatarUrl}
        onOtherAvatarClick={onOtherAvatarClick}
        onBubbleLongPress={onBubbleLongPress}
        bubbleSelected={bubbleSelected}
      />
    </ChatMessageEnter>
  )
}

function FailRetryIcon({ onClick }: { onClick: () => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <Pressable
      aria-label="重发"
      className="wx-chat-fail-btn mb-1 flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-full text-[16px]"
      style={{
        color: '#b42318',
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease-out',
      }}
      onClick={onClick}
    >
      ⚠️
    </Pressable>
  )
}

function SelfMessageEnter({
  messageText,
  bubble,
  showAvatar,
  showBubbleTail,
  showAvatarColumn = true,
  chatAccessory,
  chatBubbleOverlay,
  chatSelfAvatarUrl,
  onBubbleLongPress,
  bubbleSelected,
}: ChatMsgProps & {
  showAvatarColumn?: boolean
  chatAccessory?: ReactNode
  chatBubbleOverlay?: ReactNode
}) {
  return (
    <ChatMessageEnter isSelf>
      <WeChatMessageBubbleRow
        messageText={messageText}
        isSelf
        bubble={bubble}
        showAvatar={showAvatar}
        showBubbleTail={showBubbleTail}
        variant="chat"
        showAvatarColumn={showAvatarColumn}
        chatAccessory={chatAccessory}
        chatBubbleOverlay={chatBubbleOverlay}
        chatSelfAvatarUrl={chatSelfAvatarUrl}
        onBubbleLongPress={onBubbleLongPress}
        bubbleSelected={bubbleSelected}
      />
    </ChatMessageEnter>
  )
}

type DmBullet = {
  id: string
  text: string
  track: number
  durationSec: number
  startDelaySec?: number
  fontPx: number
  colorRgba: string
  style: 'none' | 'gray' | 'white'
  positionMode: 'top' | 'middle' | 'bottom' | 'random'
  /** 随机纵向位置（0～100，相对弹幕区） */
  topPct?: number
}

export function ChatRoom({
  onBack: _onBack,
  onOtherTypingChange,
  skipBusySignal = 0,
  personaCharacterId = null,
  playerDisplayName = '',
  /** 仅在与内置 Lumi 助手会话且未绑人设时为 true；其他聊天勿开，以免注入 Lumi 专用系统提示词 */
  useLumiProjectAssistantPrompt = false,
  /** 会话存储用的角色 id：Lumi 为固定助手 id，角色私聊为对应 characterId */
  conversationCharacterId,
  /** 当前玩家身份 id，无则传 `__none__` */
  playerIdentityId,
  /** 玩家头像（与「我」页资料一致），用于己方聊天气泡 */
  playerAvatarUrl,
  /** 对方在微信通讯录中的头像 URL；缺省时（角色私聊）会尝试从人设库读取 */
  peerAvatarUrl,
  /** 系统通知标题（通讯录备注名 / Lumi） */
  peerNotifyTitle = '',
  /** 会话设置：自定义聊天区背景（URL / dataURL） */
  chatBackgroundUrl,
  /** 会话设置：弹幕模式 */
  danmakuEnabled = false,
  /** 从「查找聊天记录」等入口定位到指定消息 id */
  scrollToMessageId = null,
  onScrollToMessageConsumed,
  onRequestForwardMessage,
  onRequestForwardMessages,
  onOpenSendRedPacket,
  onNavigateRedPacketDetail,
  onOpenLumiTransfer,
  onOpenAffectionPay,
  onNavigateTransferDetail,
}: {
  onBack: () => void
  /** 同步「对方正在输入」到顶栏（替代底部提示） */
  onOtherTypingChange?: (visible: boolean) => void
  /** 上层点击“跳过忙碌”后递增，用于立即触发一轮忙后回复 */
  skipBusySignal?: number
  /** 与人设库角色 id 绑定后注入世界书；未绑定时仅用通用提示词 */
  personaCharacterId?: string | null
  /** 玩家在微信侧展示名，供模型称呼参考 */
  playerDisplayName?: string
  useLumiProjectAssistantPrompt?: boolean
  conversationCharacterId: string
  playerIdentityId: string
  playerAvatarUrl?: string
  peerAvatarUrl?: string
  peerNotifyTitle?: string
  chatBackgroundUrl?: string
  danmakuEnabled?: boolean
  scrollToMessageId?: string | null
  onScrollToMessageConsumed?: () => void
  /** 点击长按面板「转发」后交给上层路由打开“选择聊天”页 */
  onRequestForwardMessage?: (msg: WeChatChatMessage) => void
  /** 多选模式：转发多条（合并/逐条） */
  onRequestForwardMessages?: (payload: {
    mode: 'multi-item' | 'multi-merge'
    messageIds: string[]
    mergeTitle: { userName: string; peerName: string }
  }) => void
  /** 发红包：由 WeChatApp 切到 `red-packet-send` 路由 */
  onOpenSendRedPacket?: () => void
  /** 拆红包动画结束后进入详情页 */
  onNavigateRedPacketDetail?: (p: {
    messageId: string
    amountYuan: number
    remark: string
    senderName: string
    senderAvatarUrl?: string
    chatPeerName: string
    fromSelf: boolean
  }) => void
  /** 打开转账页 */
  onOpenLumiTransfer?: () => void
  /** 打开亲情卡代付页 */
  onOpenAffectionPay?: () => void
  /** 打开转账详情 */
  onNavigateTransferDetail?: (transferId: string) => void
}) {
  const logger = useConsoleLogger()

  // `ChatRoom` 顶栏由上层承载，这里仅保留引用以避免未使用告警
  useEffect(() => {}, [_onBack])
  const { state, setUi } = useCustomization()
  const { wechatTheme } = state
  const { chatTheme } = useChatTheme()
  const apiConfig = useCurrentApiConfig('chatCard')
  const danmakuApiConfig = useCurrentApiConfig('danmaku')
  const danmakuSubApiEnabled = useIsSubApiEnabled('danmaku')
  const voiceAsrApiConfig = useCurrentApiConfig('voiceAsr')
  const voiceAsrEnabled = useIsSubApiEnabled('voiceAsr')
  const { currentTimeMs, getCurrentTimeMs } = useWeChatCurrentTime({
    characterId: personaCharacterId?.trim() || conversationCharacterId,
  })
  const [globalDm, setGlobalDm] = useState<WeChatGlobalSettingsRow | null>(null)
  const [peerDmRow, setPeerDmRow] = useState<CharacterDanmakuSettingsRow | null>(null)
  const [peerBusyRow, setPeerBusyRow] = useState<CharacterBusySettingsRow | null>(null)
  const [globalModeBusyEnabled, setGlobalModeBusyEnabled] = useState(true)
  const [dmBullets, setDmBullets] = useState<DmBullet[]>([])
  const dmLaneBusyUntilRef = useRef<number[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const g = await personaDb.getGlobalSettings()
      if (cancelled) return
      setGlobalDm(g)
      const pid = (personaCharacterId?.trim() || conversationCharacterId.trim()) || ''
      if (g.danmakuScopeMode === 'character' && pid) {
        const row = await personaDb.getCharacterDanmakuSettings(pid)
        if (!cancelled) setPeerDmRow(row)
      } else if (!cancelled) {
        setPeerDmRow(null)
      }
      if (g.busyMode === 'character' && pid) {
        const row = await personaDb.getCharacterBusySettings(pid)
        if (!cancelled) setPeerBusyRow(row)
      } else if (!cancelled) {
        setPeerBusyRow(null)
        const convKey = wechatConversationKey(conversationCharacterId, playerIdentityId)
        const kv = await personaDb.getPhoneKv(`busy-conv:${convKey}`)
        if (!cancelled) setGlobalModeBusyEnabled(typeof kv === 'boolean' ? kv : true)
      }
    }
    void load()
    const onStorage = () => void load()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => {
      cancelled = true
      window.removeEventListener('wechat-storage-changed', onStorage)
    }
  }, [personaCharacterId, conversationCharacterId, playerIdentityId])

  const effectiveDm = useMemo(() => {
    if (!globalDm) return null
    const pid = (personaCharacterId?.trim() || conversationCharacterId.trim()) || ''
    return resolveEffectiveDanmakuVisuals(globalDm, pid, peerDmRow)
  }, [globalDm, personaCharacterId, conversationCharacterId, peerDmRow])

  const bubble = useMemo(
    () => bubbleForRole(wechatTheme, conversationCharacterId),
    [wechatTheme, conversationCharacterId],
  )
  const showAvatar = bubble.showAvatar
  const showBubbleTail = bubble.showBubbleTail && showAvatar
  const showTimestamp = wechatTheme.timestampStyle !== 'hidden'
  const mergeAvatarGroup = bubble.mergeConsecutiveAvatarGroup

  const conversationKey = useMemo(
    () => wechatConversationKey(conversationCharacterId, playerIdentityId),
    [conversationCharacterId, playerIdentityId],
  )
  const synthCharacterVoiceAudioUrl = useCallback(
    async (ttsScript: string, emotion?: (typeof VOICE_ALLOWED_EMOTIONS)[number]): Promise<string> => {
      try {
        const apiKey = String(localStorage.getItem('minimax:apiKey') || '').trim()
        if (!apiKey) return ''
        const groupId = String(localStorage.getItem('minimax:groupId') || '').trim()
        const speechModel = String(localStorage.getItem('minimax:speechModel') || 'speech-2.8-hd').trim() || 'speech-2.8-hd'
        const rawMap = localStorage.getItem('minimax:characterVoiceMap') || '{}'
        const map = JSON.parse(rawMap) as Record<string, unknown>
        const voiceId = String(map?.[conversationCharacterId] ?? '').trim()
        if (!voiceId) return ''
        const blob = await createMiniMaxT2ASyncAudioBlob(
          { apiKey, groupId },
          { voice_id: voiceId, text: ttsScript, model: speechModel, emotion },
        )
        return await blobToDataUrl(blob)
      } catch (e) {
        logger.log('error', `角色语音合成失败: ${e instanceof Error ? e.message : String(e)}`)
        return ''
      }
    },
    [conversationCharacterId, logger],
  )
  const voiceSynthesisPromiseRef = useRef(new Map<string, Promise<string>>())

  const [peerAvatarResolved, setPeerAvatarResolved] = useState<string | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    const direct = peerAvatarUrl?.trim()
    if (direct) {
      setPeerAvatarResolved(direct)
      return
    }
    if (useLumiProjectAssistantPrompt) {
      setPeerAvatarResolved(undefined)
      return
    }
    const cid = (personaCharacterId?.trim() || conversationCharacterId.trim()) || ''
    if (!cid || cid === WECHAT_LUMI_PEER_CHARACTER_ID) {
      setPeerAvatarResolved(undefined)
      return
    }
    void personaDb.getCharacter(cid).then((c) => {
      if (cancelled) return
      setPeerAvatarResolved(c?.avatarUrl?.trim() || undefined)
    })
    return () => {
      cancelled = true
    }
  }, [peerAvatarUrl, useLumiProjectAssistantPrompt, personaCharacterId, conversationCharacterId])

  const [memoryNotesForPrompt, setMemoryNotesForPrompt] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const s = await personaDb.formatCharacterMemoriesForPrompt(conversationCharacterId)
        if (!cancelled) setMemoryNotesForPrompt(s)
      } catch {
        if (!cancelled) setMemoryNotesForPrompt('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [conversationCharacterId])

  useEffect(() => {
    const onStorage = () => {
      void personaDb.formatCharacterMemoriesForPrompt(conversationCharacterId).then(setMemoryNotesForPrompt)
    }
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [conversationCharacterId])

  const formatWxTimeLabel = useCallback((ts: number) => {
    return formatWeChatChatTimestamp(ts, currentTimeMs)
  }, [currentTimeMs])

  const [items, setItems] = useState<ChatItem[]>([])
  const itemsRef = useRef(items)
  itemsRef.current = items
  const rebuildWithCurrentTime = useCallback(
    (msgs: ChatMsg[]) => rebuildChatItemsWithTimestamps(msgs, formatWxTimeLabel, currentTimeMs),
    [currentTimeMs, formatWxTimeLabel],
  )
  const extractMessages = useCallback((list: ChatItem[]) => list.filter((it): it is ChatMsg => it.kind === 'msg'), [])
  const ensureVoiceMessageAudio = useCallback(
    async (messageId: string, voice?: ChatMsg['voice'], opts?: { forceResynthesize?: boolean }): Promise<string> => {
      const msgId = messageId.trim()
      if (!msgId || !voice) return ''
      const forceResynthesize = opts?.forceResynthesize === true
      const existingAudioUrl = voice.audioUrl?.trim() || ''
      if (existingAudioUrl && !forceResynthesize) return existingAudioUrl

      const pending = voiceSynthesisPromiseRef.current.get(msgId)
      if (pending) return pending

      const task = (async () => {
        const rawScript = String(voice.ttsScript || '').trim()
        const emotion = pickVoiceEmotionForTts(rawScript)
        const playableScript = stripEmotionTagsForTts(rawScript)
        if (!playableScript) return ''
        const synthesizedAudioUrl = await synthCharacterVoiceAudioUrl(playableScript, emotion)
        if (!synthesizedAudioUrl) return ''

        setItems((prev) => {
          const next = rebuildWithCurrentTime(
            extractMessages(prev).map((msg) =>
              msg.id !== msgId || !msg.voice
                ? msg
                : {
                    ...msg,
                    voice: {
                      ...msg.voice,
                      audioUrl: synthesizedAudioUrl,
                    },
                  },
            ),
          )
          itemsRef.current = next
          return next
        })

        try {
          await personaDb.patchWeChatChatMessageById(msgId, {
            voice: { audioUrl: synthesizedAudioUrl },
          })
        } catch (e) {
          logger.log('error', `角色语音缓存落库失败 id=${msgId} err=${e instanceof Error ? e.message : String(e)}`)
        }

        return synthesizedAudioUrl
      })()

      voiceSynthesisPromiseRef.current.set(msgId, task)
      try {
        return await task
      } finally {
        voiceSynthesisPromiseRef.current.delete(msgId)
      }
    },
    [extractMessages, logger, rebuildWithCurrentTime, synthCharacterVoiceAudioUrl],
  )
  const mergeIncomingMessage = useCallback(
    (prev: ChatItem[], incoming: ChatMsg) => {
      // 与异步 hydrate 并发时，可能已存在同 id 行；先去重再追加，避免短暂双气泡闪烁
      const base = extractMessages(prev).filter((m) => m.id !== incoming.id)
      return rebuildWithCurrentTime([...base, incoming])
    },
    [extractMessages, rebuildWithCurrentTime],
  )

  const appendSystemNote = useCallback(
    async (text: string) => {
      const seg = String(text ?? '').trim()
      if (!seg) return
      const ts = getCurrentTimeMs()
      const id = `wxsys-${ts}-${Math.random().toString(36).slice(2, 7)}`
      try {
        await personaDb.appendWeChatChatMessage({
          id,
          characterId: conversationCharacterId,
          playerIdentityId,
          type: 'player',
          content: seg,
          timestamp: ts,
          isRead: true,
          conversationKey,
        })
      } catch {
        // ignore
      }
      const incoming: ChatMsg = { id, kind: 'msg', from: 'self', text: seg, timestamp: ts, status: 'sent', selfAnimated: true }
      setItems((prev) => {
        const next = rebuildWithCurrentTime([...extractMessages(prev), incoming])
        itemsRef.current = next
        return next
      })
    },
    [conversationCharacterId, conversationKey, extractMessages, getCurrentTimeMs, playerIdentityId, rebuildWithCurrentTime],
  )

  const appendCallStatusBubble = useCallback(
    async (
      payload: { status: 'rejected' | 'no_answer' | 'duration'; durationSec?: number },
      initiator: 'self' | 'other' = 'self',
    ) => {
      const ts = getCurrentTimeMs()
      const dedupKey = `${initiator}:${payload.status}:${payload.durationSec ?? 0}`
      const last = callBubbleDedupRef.current
      if (last && last.key === dedupKey && ts - last.ts < 1200) return
      callBubbleDedupRef.current = { key: dedupKey, ts }
      const id = `wxcall-${ts}-${Math.random().toString(36).slice(2, 7)}`
      const content = '[通话]'
      const msgType = initiator === 'self' ? 'player' : 'character'
      const from = initiator === 'self' ? 'self' : 'other'
      try {
        await personaDb.appendWeChatChatMessage({
          id,
          characterId: conversationCharacterId,
          playerIdentityId,
          type: msgType,
          content,
          callStatus: payload,
          timestamp: ts,
          isRead: true,
          conversationKey,
        })
      } catch {
        // ignore
      }
      const incoming: ChatMsg = {
        id,
        kind: 'msg',
        from,
        text: content,
        timestamp: ts,
        status: 'sent',
        callStatus: payload,
        selfAnimated: from === 'self' ? true : undefined,
        otherAnimated: from === 'other' ? true : undefined,
      }
      setItems((prev) => {
        const next = rebuildWithCurrentTime([...extractMessages(prev), incoming])
        itemsRef.current = next
        return next
      })
    },
    [conversationCharacterId, conversationKey, extractMessages, getCurrentTimeMs, playerIdentityId, rebuildWithCurrentTime],
  )

  useEffect(() => {
    setItems((prev) => {
      const rebuilt = rebuildWithCurrentTime(extractMessages(prev))
      itemsRef.current = rebuilt
      return rebuilt
    })
  }, [currentTimeMs, extractMessages, rebuildWithCurrentTime])

  // 让角色/Lumi“知道”转账退还、红包 24h 未领取：用系统提示消息写入对话历史（供模型读取）。
  useEffect(() => {
    let cancelled = false
    const transferNotified = readNotifiedSet(LS_TRANSFER_RETURN_NOTIFIED_KEY)
    const redPacketNotified = readNotifiedSet(LS_REDPACKET_EXPIRED_NOTIFIED_KEY)

    const tick = async () => {
      if (cancelled) return
      const now = getCurrentTimeMs()

      // 1) 转账：检查 localStorage 中是否出现 pending->returned（超时或主动退还），写入一次系统提示
      evaluateExpiredTransfers(() => now)
      for (const it of extractMessages(itemsRef.current)) {
        const tid = it.transfer?.transferId?.trim()
        if (!tid) continue
        if (transferNotified.has(tid)) continue
        const rec = getLumiTransferFresh(tid, () => now)
        if (rec?.status === 'returned') {
          transferNotified.add(tid)
          writeNotifiedSet(LS_TRANSFER_RETURN_NOTIFIED_KEY, transferNotified)
          const peerName = peerNotifyTitle.trim() || '对方'
          if (rec.receiverId === playerIdentityId) {
            void appendSystemNote(`【系统】你退还了${peerName}的转账`)
          } else {
            void appendSystemNote(`【系统】${peerName}退还了你的转账`)
          }
        }
      }

      // 2) 红包：24h 未领取 → 失效提示（不改红包状态，仅提示一次，便于模型感知）
      const EXPIRE_MS = 24 * 60 * 60 * 1000
      for (const it of extractMessages(itemsRef.current)) {
        const rp = it.redPacket
        if (!rp || rp.opened) continue
        const pid = rp.packetId?.trim()
        if (!pid) continue
        if (redPacketNotified.has(pid)) continue
        if (now - it.timestamp >= EXPIRE_MS) {
          redPacketNotified.add(pid)
          writeNotifiedSet(LS_REDPACKET_EXPIRED_NOTIFIED_KEY, redPacketNotified)
          void appendSystemNote('【系统】红包24小时未领取，已自动退回')
        }
      }

      // 3) 红包：对方领取了你发起的红包（若未来支持角色拆包，这里能自动提示）
      for (const it of extractMessages(itemsRef.current)) {
        const rp = it.redPacket
        if (!rp || !rp.opened) continue
        if (it.from !== 'self') continue
        const pid = rp.packetId?.trim()
        if (!pid) continue
        if (redPacketNotified.has(`opened:${pid}`)) continue
        redPacketNotified.add(`opened:${pid}`)
        writeNotifiedSet(LS_REDPACKET_EXPIRED_NOTIFIED_KEY, redPacketNotified)
        void appendSystemNote(`【系统】${peerNotifyTitle.trim() || '对方'}领取了你的红包`)
      }
    }

    const id = window.setInterval(() => void tick(), 4000)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [appendSystemNote, extractMessages, getCurrentTimeMs, peerNotifyTitle, playerIdentityId])

  const opponentQueueStopRef = useRef(false)
  const oldestMsgTsRef = useRef<number | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [, setHistoryExhausted] = useState(false)
  const [hasOlderHistory, setHasOlderHistory] = useState(false)
  const [visibleMsgLimit, setVisibleMsgLimit] = useState(CHAT_VISIBLE_MSG_INITIAL)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const historyExhaustedRef = useRef(false)
  const userScrolledRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [, setIsAtBottom] = useState(true)
  const isAtBottomRef = useRef(true)
  const [pendingNewCount, setPendingNewCount] = useState(0)

  const hydrateMessages = useCallback(
    async (scrollToBottom: boolean) => {
      // 避免“偶发丢记录”观感：刷新/存储变更时按当前可见窗口动态拉取，
      // 不要每次都硬回退到最近 50 条。
      const recentLimit = Math.max(50, visibleMsgLimit + 20)
      let msgs = await personaDb.listWeChatChatMessagesRecent({
        conversationKey,
        limit: recentLimit,
      })

      // Lumi 小助手：首次进入且无历史时，写入默认开场白（只写一次，避免每次进入都刷屏）。
      const isLumiAssistantSession =
        useLumiProjectAssistantPrompt && conversationCharacterId === WECHAT_LUMI_PEER_CHARACTER_ID
      if (isLumiAssistantSession && msgs.length === 0) {
        const baseTs = getCurrentTimeMs()
        const inserted: WeChatChatMessage[] = []
        for (let i = 0; i < LUMI_DEFAULT_OPENING_BUBBLES.length; i += 1) {
          const content = LUMI_DEFAULT_OPENING_BUBBLES[i]?.trim()
          if (!content) continue
          const ts = baseTs + i
          const id = makeStableLumiOpeningId(conversationKey, i)
          const row: WeChatChatMessage = {
            id,
            characterId: conversationCharacterId,
            playerIdentityId,
            type: 'character',
            content,
            timestamp: ts,
            isRead: true,
            conversationKey,
          }
          inserted.push(row)
          try {
            await personaDb.appendWeChatChatMessage(row)
          } catch {
            // ignore
          }
        }
        // 重新读取，确保使用库里最终结果（也避免并发/StrictMode 下的重复写入观感）
        msgs = await personaDb.listWeChatChatMessagesRecent({
          conversationKey,
          limit: recentLimit,
        })
      }

      // 普通角色会话：若首次进入且无历史，按人设开场白（每行一个气泡）写入一次。
      if (!isLumiAssistantSession && msgs.length === 0) {
        const cid = (personaCharacterId?.trim() || conversationCharacterId.trim()) || ''
        if (cid) {
          try {
            const ch = await personaDb.getCharacter(cid)
            const openingBubbles = String(ch?.openingLines || '')
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 8)
            if (openingBubbles.length) {
              const baseTs = getCurrentTimeMs()
              for (let i = 0; i < openingBubbles.length; i += 1) {
                const content = openingBubbles[i]!
                const ts = baseTs + i
                const id = makeStablePersonaOpeningId(conversationKey, i)
                const row: WeChatChatMessage = {
                  id,
                  characterId: conversationCharacterId,
                  playerIdentityId,
                  type: 'character',
                  content,
                  timestamp: ts,
                  isRead: true,
                  conversationKey,
                }
                try {
                  await personaDb.appendWeChatChatMessage(row)
                } catch {
                  // ignore
                }
              }
              msgs = await personaDb.listWeChatChatMessagesRecent({
                conversationKey,
                limit: recentLimit,
              })
            }
          } catch {
            // ignore
          }
        }
      }

      const mapped = rebuildWithCurrentTime(mapWeChatMessagesToChatItems(msgs))
      const prevOtherIds = new Set(
        itemsRef.current
          .filter((it): it is ChatMsg => it.kind === 'msg' && it.from === 'other')
          .map((it) => it.id),
      )
      const appendedOtherCount = mapped.reduce((acc, it) => {
        if (it.kind !== 'msg' || it.from !== 'other') return acc
        return prevOtherIds.has(it.id) ? acc : acc + 1
      }, 0)
      oldestMsgTsRef.current = msgs.length ? (msgs[0]?.timestamp ?? null) : null
      {
        const oldestTs = msgs[0]?.timestamp
        if (oldestTs == null) {
          historyExhaustedRef.current = true
          setHistoryExhausted(true)
          setHasOlderHistory(false)
        } else {
          const olderProbe = await personaDb.listWeChatChatMessagesRecent({
            conversationKey,
            limit: 1,
            beforeTimestamp: oldestTs,
          })
          const hasOlder = olderProbe.length > 0
          historyExhaustedRef.current = !hasOlder
          setHistoryExhausted(!hasOlder)
          setHasOlderHistory(hasOlder)
        }
      }
      setItems(mapped)
      itemsRef.current = mapped
      if (scrollToBottom) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = scrollRef.current
            if (!el) return
            el.scrollTop = el.scrollHeight
            isAtBottomRef.current = true
            setIsAtBottom(true)
            setPendingNewCount(0)
          })
        })
      } else if (appendedOtherCount > 0) {
        const el = scrollRef.current
        const atBottomNow = el ? isScrollNearBottom(el) : isAtBottomRef.current
        const browsingHistory = !!el && userScrolledRef.current && !atBottomNow
        const shouldStickToBottom = atBottomNow && !browsingHistory
        isAtBottomRef.current = shouldStickToBottom
        setIsAtBottom(shouldStickToBottom)
        if (shouldStickToBottom) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const root = scrollRef.current
              if (!root) return
              root.scrollTop = root.scrollHeight
              isAtBottomRef.current = true
              setIsAtBottom(true)
              setPendingNewCount(0)
            })
          })
        } else {
          setPendingNewCount((c) => c + appendedOtherCount)
        }
      }
    },
    [
      conversationKey,
      getCurrentTimeMs,
      rebuildWithCurrentTime,
      useLumiProjectAssistantPrompt,
      personaCharacterId,
      conversationCharacterId,
      playerIdentityId,
      visibleMsgLimit,
    ],
  )

  const hydrateMessagesRef = useRef(hydrateMessages)
  hydrateMessagesRef.current = hydrateMessages

  useEffect(() => {
    historyExhaustedRef.current = false
    setHistoryExhausted(false)
    setHasOlderHistory(false)
    setVisibleMsgLimit(CHAT_VISIBLE_MSG_INITIAL)
    userScrolledRef.current = false
    void hydrateMessagesRef.current(true)
  }, [conversationKey])

  useEffect(() => {
    const id = scrollToMessageId?.trim()
    if (!id) return
    let cancelled = false
    void (async () => {
      const anchor = await personaDb.getWeChatChatMessageById(id)
      if (cancelled || !anchor || anchor.conversationKey !== conversationKey) {
        onScrollToMessageConsumed?.()
        return
      }
      const older = await personaDb.listWeChatChatMessagesBeforeTimestampAsc({
        conversationKey,
        beforeTimestampExclusive: anchor.timestamp,
        limit: 80,
      })
      const newer = await personaDb.listWeChatChatMessagesFromTimestampAsc({
        conversationKey,
        fromTimestampInclusive: anchor.timestamp,
        limit: 400,
      })
      const byId = new Map<string, WeChatChatMessage>()
      for (const m of older) byId.set(m.id, m)
      for (const m of newer) byId.set(m.id, m)
      const merged = [...byId.values()].sort((a, b) => a.timestamp - b.timestamp)
      const mapped = rebuildWithCurrentTime(mapWeChatMessagesToChatItems(merged))
      if (cancelled) return
      setItems(mapped)
      itemsRef.current = mapped
      // 来自「按日期/搜索定位」的跳转必须能直接看到目标消息：
      // 若仍按默认 30 条裁剪，目标锚点可能被截断导致看起来“没跳转”。
      const mergedMsgCount = mapped.reduce((n, it) => (it.kind === 'msg' ? n + 1 : n), 0)
      setVisibleMsgLimit(Math.max(CHAT_VISIBLE_MSG_INITIAL, mergedMsgCount))
      oldestMsgTsRef.current = merged[0]?.timestamp ?? null
      historyExhaustedRef.current = older.length < 80
      setHistoryExhausted(older.length < 80)
      setHasOlderHistory(older.length >= 80)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return
          const root = scrollRef.current
          const target = root?.querySelector(`[data-wx-msg-id="${anchor.id}"]`) as HTMLElement | null
          if (!root || !target) {
            onScrollToMessageConsumed?.()
            return
          }
          scrollChildToTopSmooth(root, target, 300, () => onScrollToMessageConsumed?.())
        })
      })
    })()
    return () => {
      cancelled = true
    }
  }, [scrollToMessageId, conversationKey, rebuildWithCurrentTime, onScrollToMessageConsumed])

  useEffect(() => {
    const onStorage = () => void hydrateMessagesRef.current(false)
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [])

  const [draft, setDraft] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text')
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(false)
  const [voiceGestureZone, setVoiceGestureZone] = useState<VoiceGestureZone>('send')
  const [voicePressing, setVoicePressing] = useState(false)
  const [voiceSessionStartMs, setVoiceSessionStartMs] = useState<number | null>(null)
  const [voiceThumbOrigin, setVoiceThumbOrigin] = useState<{ x: number; y: number } | null>(null)
  const [mockVoiceInputOpen, setMockVoiceInputOpen] = useState(false)
  const [mockVoiceInputDraft, setMockVoiceInputDraft] = useState('')
  const [voiceConfigAlertOpen, setVoiceConfigAlertOpen] = useState(false)
  const [voiceConfigAlertMessage, setVoiceConfigAlertMessage] = useState('未配置语音识别 API Key')
  const [stubPanel, setStubPanel] = useState<null | 'emoji'>(null)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const [retryReplyPromptOpen, setRetryReplyPromptOpen] = useState(false)
  const [retryReplyBiasDraft, setRetryReplyBiasDraft] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [heartWhisperOpen, setHeartWhisperOpen] = useState(false)
  const [callSheetOpen, setCallSheetOpen] = useState(false)
  const [callingOpen, setCallingOpen] = useState(false)
  const [incomingCallOpen, setIncomingCallOpen] = useState(false)
  const [voiceCallOpen, setVoiceCallOpen] = useState(false)
  const [activeCallInitiator, setActiveCallInitiator] = useState<'self' | 'other' | null>(null)
  const [incomingCallOpeningLine, setIncomingCallOpeningLine] = useState<string>('')
  const [outgoingCallOpeningLine, setOutgoingCallOpeningLine] = useState<string>('')
  const incomingRejectLockRef = useRef(false)
  const callBubbleDedupRef = useRef<{ key: string; ts: number } | null>(null)
  /** 拆红包全屏层：存消息 id */
  const [redPacketModalId, setRedPacketModalId] = useState<string | null>(null)
  const [heartWhisperLoading, setHeartWhisperLoading] = useState(false)
  const [heartWhisperData, setHeartWhisperData] = useState<HeartWhisper | null>(null)
  const retryReplyBiasRef = useRef('')
  const { openConsole } = useWeChatConsole()
  const [composerToast, setComposerToast] = useState<string | null>(null)
  const [centerToast, setCenterToast] = useState<string | null>(null)
  const [keyboardInsetPx, setKeyboardInsetPx] = useState(0)
  const keyboardDebugEnabled = !!state.ui.keyboardDebugEnabled
  const keyboardDebugInsetPx = Math.max(-220, Math.min(220, Math.round(state.ui.keyboardDebugInsetPx || 0)))
  const composerInsetPx =
    keyboardInsetPx > 0
      ? Math.max(0, keyboardInsetPx + keyboardDebugInsetPx)
      : 0
  const toastTimerRef = useRef<number | null>(null)
  const centerToastTimerRef = useRef<number | null>(null)
  /** 已读不回 / 忙碌：阻止新的 AI 回复，直至用户发送消息或点「继续回复」 */
  const manualAiPauseRef = useRef(false)

  const [replyingTo, setReplyingTo] = useState<null | WeChatReplyToMeta>(null)
  const replyingToRef = useRef(replyingTo)
  replyingToRef.current = replyingTo
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)

  const [editing, setEditing] = useState<null | { id: string; original: string }>(null)

  const [actionPanelOpen, setActionPanelOpen] = useState(false)
  const [actionAnchor, setActionAnchor] = useState<PanelAnchor | null>(null)
  const [actionMessageId, setActionMessageId] = useState<string | null>(null)
  const [actionMessageIsSelf, setActionMessageIsSelf] = useState<boolean>(false)
  const [actionMessageText, setActionMessageText] = useState<string>('')
  const [actionMessageCanRecall, setActionMessageCanRecall] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [voiceResynthesizeConfirmId, setVoiceResynthesizeConfirmId] = useState<string | null>(null)
  const [voiceResynthesizing, setVoiceResynthesizing] = useState(false)
  const aiCallingRef = useRef(false)
  const lastUserAiTriggerTsRef = useRef<number>(0)

  const closeActionPanel = useCallback(() => {
    setActionPanelOpen(false)
    setActionAnchor(null)
    setActionMessageId(null)
    setActionMessageText('')
    setActionMessageCanRecall(false)
    setConfirmDeleteOpen(false)
  }, [])

  const showCenterToast = useCallback((msg: string) => {
    if (centerToastTimerRef.current != null) window.clearTimeout(centerToastTimerRef.current)
    setCenterToast(msg)
    centerToastTimerRef.current = window.setTimeout(() => {
      setCenterToast(null)
      centerToastTimerRef.current = null
    }, 1500)
  }, [])

  const requestVoiceResynthesizeConfirm = useCallback((messageId: string) => {
    const id = messageId.trim()
    if (!id) return
    setVoiceResynthesizeConfirmId(id)
  }, [])

  const runVoiceResynthesize = useCallback(async () => {
    const msgId = voiceResynthesizeConfirmId?.trim() || ''
    if (!msgId || voiceResynthesizing) return
    const target = extractMessages(itemsRef.current).find((m) => m.id === msgId)
    if (!target?.voice) {
      setVoiceResynthesizeConfirmId(null)
      showCenterToast('语音消息不存在或已被删除')
      return
    }
    setVoiceResynthesizing(true)
    try {
      // 先清掉旧缓存，确保 UI 与落库都进入“待重合成”状态。
      setItems((prev) => {
        const next = rebuildWithCurrentTime(
          extractMessages(prev).map((msg) =>
            msg.id !== msgId || !msg.voice
              ? msg
              : {
                  ...msg,
                  voice: {
                    ...msg.voice,
                    audioUrl: undefined,
                  },
                },
          ),
        )
        itemsRef.current = next
        return next
      })
      try {
        await personaDb.patchWeChatChatMessageById(msgId, { voice: { audioUrl: '' } })
      } catch (e) {
        logger.log('error', `清理旧语音缓存失败 id=${msgId} err=${e instanceof Error ? e.message : String(e)}`)
      }

      const nextUrl = await ensureVoiceMessageAudio(
        msgId,
        {
          ...target.voice,
          audioUrl: '',
        },
        { forceResynthesize: true },
      )
      if (!nextUrl) showCenterToast('重新合成失败，请稍后重试')
      else showCenterToast('已重新合成语音')
    } finally {
      setVoiceResynthesizing(false)
      setVoiceResynthesizeConfirmId(null)
    }
  }, [
    ensureVoiceMessageAudio,
    extractMessages,
    logger,
    rebuildWithCurrentTime,
    showCenterToast,
    voiceResynthesizeConfirmId,
    voiceResynthesizing,
  ])

  useEffect(() => {
    return () => {
      if (centerToastTimerRef.current != null) window.clearTimeout(centerToastTimerRef.current)
    }
  }, [])

  const MAX_MULTI_SELECT = 100
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([])
  const selectedSet = useMemo(() => new Set(selectedMessageIds), [selectedMessageIds])
  const [multiDeleteConfirmOpen, setMultiDeleteConfirmOpen] = useState(false)
  const [recallModalOpen, setRecallModalOpen] = useState(false)
  const [recallModalRecord, setRecallModalRecord] = useState<RecallHistoryRecord | null>(null)
  const pendingRecalledUserTextRef = useRef<string | null>(null)
  const [recallAnimatingIds, setRecallAnimatingIds] = useState<Set<string>>(() => new Set())
  const activeVoicePointerIdRef = useRef<number | null>(null)
  const voiceHoldTimerRef = useRef<number | null>(null)
  const voiceDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const voiceLongPressAttemptedRef = useRef(false)
  const voiceRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceStreamRef = useRef<MediaStream | null>(null)
  const voiceChunksRef = useRef<Blob[]>([])
  const [forwardModeSheetOpen, setForwardModeSheetOpen] = useState(false)
  const [checkPhoneOpen, setCheckPhoneOpen] = useState(false)

  const openHeartWhisperPanel = useCallback(() => {
    if (isMultiSelectMode) return
    setPlusMenuOpen(false)
    setHeartWhisperOpen(true)
  }, [isMultiSelectMode])

  const exitMultiSelect = useCallback(() => {
    setIsMultiSelectMode(false)
    setSelectedMessageIds([])
    setMultiDeleteConfirmOpen(false)
    setForwardModeSheetOpen(false)
  }, [])

  const toggleSelect = useCallback(
    (id: string) => {
      const tid = id.trim()
      if (!tid) return
      setSelectedMessageIds((prev) => {
        const set = new Set(prev)
        if (set.has(tid)) {
          set.delete(tid)
          return [...set]
        }
        if (set.size >= MAX_MULTI_SELECT) {
          showCenterToast(`最多只能选择${MAX_MULTI_SELECT}条消息`)
          return prev
        }
        set.add(tid)
        return [...set]
      })
    },
    [showCenterToast, MAX_MULTI_SELECT],
  )

  const resolveSenderName = useCallback(
    (isSelf: boolean) => {
      if (isSelf) return (playerDisplayName.trim() || '我').slice(0, 64)
      return (peerNotifyTitle.trim() || '对方').slice(0, 64)
    },
    [playerDisplayName, peerNotifyTitle],
  )

  const buildReplyMetaById = useCallback(
    async (messageId: string): Promise<WeChatReplyToMeta | null> => {
      const local = itemsRef.current.find((it): it is ChatMsg => it.kind === 'msg' && it.id === messageId)
      if (local) {
        return {
          messageId: local.id,
          senderName: resolveSenderName(local.from === 'self'),
          content: messagePlainPreview(local).slice(0, 300),
          isUser: local.from === 'self',
        }
      }
      const msg = await Promise.race<WeChatChatMessage | null>([
        personaDb.getWeChatChatMessageById(messageId),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 300)),
      ])
      if (!msg) return null
      if (msg.isRecalled) {
        return {
          messageId: msg.id,
          senderName: resolveSenderName(msg.type === 'player'),
          content: '该消息已撤回',
          isUser: msg.type === 'player',
        }
      }
      const rp = msg.redPacket
      const snap = rp
        ? (`[红包] ${(rp.remark ?? '').trim()}`.trim() || '[红包]').slice(0, 300)
        : (msg.content?.trim() || (msg.images?.length ? '[图片]' : '...')).slice(0, 300)
      return {
        messageId: msg.id,
        senderName: resolveSenderName(msg.type === 'player'),
        content: snap,
        isUser: msg.type === 'player',
      }
    },
    [resolveSenderName],
  )

  const jumpToMessage = useCallback(
    (messageId: string) => {
      const id = messageId.trim()
      if (!id) return
      const root = scrollRef.current
      if (!root) return
      const target = root.querySelector(`[data-wx-msg-id="${id}"]`) as HTMLElement | null
      if (!target) {
        showCenterToast('原消息不存在或已被删除')
        return
      }
      scrollChildToTopSmooth(root, target, 280, () => {
        setHighlightedMessageId(id)
        window.setTimeout(() => {
          setHighlightedMessageId((prev) => (prev === id ? null : prev))
        }, 500)
      })
    },
    [showCenterToast],
  )

  const openActionPanelFor = useCallback(
    (params: { id: string; isSelf: boolean; text: string; ts: number; anchorRect: DOMRect }) => {
      const preferBelow = params.anchorRect.top < 100
      setActionMessageId(params.id)
      setActionMessageIsSelf(params.isSelf)
      setActionMessageText(params.text)
      const msgs = extractMessages(itemsRef.current)
      const last = msgs.length ? msgs[msgs.length - 1] : null
      const canRecall = !!(params.isSelf && last?.id === params.id && !last.isRecalled)
      setActionMessageCanRecall(canRecall)
      setActionAnchor({ rect: params.anchorRect, preferBelow })
      setActionPanelOpen(true)
      setConfirmDeleteOpen(false)
    },
    [extractMessages],
  )

  const scrollToBottomSmooth = useCallback((opts?: { force?: boolean }) => {
    const el = scrollRef.current
    if (!el) return
    const force = opts?.force === true
    if (!force) {
      const atBottomNow = isScrollNearBottom(el)
      const browsingHistory = userScrolledRef.current && !atBottomNow
      if (!atBottomNow || browsingHistory) return
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const now = scrollRef.current
        if (!now) return
        now.scrollTo({ top: now.scrollHeight, behavior: 'smooth' })
        isAtBottomRef.current = true
        setIsAtBottom(true)
        setPendingNewCount(0)
        window.setTimeout(() => {
          const latest = scrollRef.current
          if (!latest) return
          latest.scrollTo({ top: latest.scrollHeight, behavior: 'auto' })
        }, 240)
      })
    })
  }, [])

  const onActionPanelAction = useCallback(
    async (id: WeChatMessageActionId) => {
      const mid = actionMessageId?.trim() || ''
      if (!mid) {
        closeActionPanel()
        return
      }
      const close = () => closeActionPanel()

      const focusComposer = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => textareaRef.current?.focus())
        })
      }

      if (id === 'delete') {
        setConfirmDeleteOpen(true)
        return
      }

      close()

      switch (id) {
        case 'copy': {
          const text = (actionMessageText ?? '').trim()
          try {
            await navigator.clipboard.writeText(text)
          } catch {
            // fallback：旧浏览器 / 权限问题
            const ta = document.createElement('textarea')
            ta.value = text
            ta.style.position = 'fixed'
            ta.style.left = '-9999px'
            ta.style.top = '0'
            document.body.appendChild(ta)
            ta.focus()
            ta.select()
            try {
              document.execCommand('copy')
            } catch {
              /* ignore */
            } finally {
              document.body.removeChild(ta)
            }
          }
          showCenterToast('已复制')
          return
        }
        case 'forward': {
          const msg = await personaDb.getWeChatChatMessageById(mid)
          if (msg) onRequestForwardMessage?.(msg)
          return
        }
        case 'favorite': {
          const msg = await personaDb.getWeChatChatMessageById(mid)
          if (msg) {
            await personaDb.addFavoriteFromWeChatMessage(msg)
            await personaDb.setWeChatChatMessageFavorite(mid, true)
          }
          showCenterToast('已收藏')
          return
        }
        case 'multiSelect': {
          setIsMultiSelectMode(true)
          setSelectedMessageIds([mid])
          return
        }
        case 'quote': {
          const localQuote = itemsRef.current.find((it): it is ChatMsg => it.kind === 'msg' && it.id === mid)
          if (localQuote?.isRecalled) {
            showCenterToast('已撤回的消息无法引用')
            return
          }
          const rowQuote = await personaDb.getWeChatChatMessageById(mid)
          if (rowQuote?.isRecalled) {
            showCenterToast('已撤回的消息无法引用')
            return
          }
          const meta = await buildReplyMetaById(mid)
          if (!meta) {
            showCenterToast('该消息不存在或已被删除')
            return
          }
          setReplyingTo(meta)
          focusComposer()
          return
        }
        case 'translate': {
          showCenterToast('翻译中...')
          return
        }
        case 'edit': {
          if (!actionMessageIsSelf) {
            showCenterToast('无法编辑他人消息')
            return
          }
          const original = (actionMessageText ?? '').trim()
          setEditing({ id: mid, original })
          setDraft(original)
          focusComposer()
          return
        }
        case 'recall': {
          if (!actionMessageCanRecall || !actionMessageIsSelf) {
            showCenterToast('该消息当前不可撤回')
            return
          }
          const row = await personaDb.getWeChatChatMessageById(mid)
          if (!row || row.type !== 'player') {
            showCenterToast('原消息不存在或已被删除')
            return
          }
          const recalledAt = getCurrentTimeMs()
          const original = row.content?.trim() || row.originalContent?.trim() || ''
          pendingRecalledUserTextRef.current = original
          await personaDb.patchWeChatChatMessageById(mid, {
            content: '',
            isRecalled: true,
            recalledBy: 'player',
            recallTimestamp: recalledAt,
            originalContent: original,
          })
          setItems((prev) => {
            const next = rebuildWithCurrentTime(
              extractMessages(prev).map((msg) => {
                if (msg.id !== mid) return msg
                return {
                  ...msg,
                  text: '',
                  isRecalled: true,
                  recalledBy: 'self',
                  recallTimestamp: recalledAt,
                  originalText: original,
                }
              }),
            )
            itemsRef.current = next
            return next
          })
          return
        }
        case 'resynthesizeVoice': {
          const target = itemsRef.current.find((it): it is ChatMsg => it.kind === 'msg' && it.id === mid)
          if (!target?.voice || target.from !== 'other') {
            showCenterToast('仅支持角色语音重合成')
            return
          }
          requestVoiceResynthesizeConfirm(mid)
          return
        }
        default:
          return
      }
    },
    [
      actionMessageId,
      actionMessageIsSelf,
      actionMessageText,
      closeActionPanel,
      showCenterToast,
      actionMessageCanRecall,
      buildReplyMetaById,
      onRequestForwardMessage,
      requestVoiceResynthesizeConfirm,
      getCurrentTimeMs,
      rebuildWithCurrentTime,
      extractMessages,
    ],
  )

  useEffect(() => {
    if (!actionPanelOpen) return
    const onDown = () => {
      // 面板内会 stopPropagation；confirm 弹窗打开时不关闭面板（微信一致）
      if (confirmDeleteOpen) return
      closeActionPanel()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeActionPanel()
    }
    const onPop = () => closeActionPanel()
    const scrollEl = scrollRef.current
    const onScroll = () => closeActionPanel()
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('popstate', onPop)
    scrollEl?.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', onPop)
      scrollEl?.removeEventListener('scroll', onScroll)
    }
  }, [actionPanelOpen, closeActionPanel, confirmDeleteOpen])

  useEffect(() => {
    if (!isMultiSelectMode) return
    // 进入多选后：关闭长按面板、关闭引用/编辑、收起加号菜单
    closeActionPanel()
    setReplyingTo(null)
    setEditing(null)
    setPlusMenuOpen(false)
    setStubPanel(null)
  }, [isMultiSelectMode, closeActionPanel])

  const showComposerToast = useCallback((msg: string) => {
    if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current)
    setComposerToast(msg)
    toastTimerRef.current = window.setTimeout(() => {
      setComposerToast(null)
      toastTimerRef.current = null
    }, 2200)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  // iOS/移动端键盘：用 visualViewport 计算“键盘遮挡高度”，把输入栏整体上移
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const nav = navigator as Navigator & {
      virtualKeyboard?: {
        boundingRect?: { height?: number }
        addEventListener?: (type: 'geometrychange', listener: () => void) => void
        removeEventListener?: (type: 'geometrychange', listener: () => void) => void
      }
    }
    const virtualKeyboard = nav.virtualKeyboard
    // iOS 上地址栏/工具栏会让 innerHeight 与 offsetTop 抖动。
    // 记录“键盘未弹出时”的最大可视高度作为 baseline，再用 baseline - 当前可视高度估算键盘遮挡。
    const baselineRef = { current: 0 }

    const update = () => {
      const visible = vv.height + vv.offsetTop
      const cssVhRaw = window.getComputedStyle(document.documentElement).getPropertyValue('--app-vh')
      const cssVh = Number.parseFloat(cssVhRaw)
      const vkInset = Math.max(0, Math.round(virtualKeyboard?.boundingRect?.height ?? 0))
      // baseline 取“见过的最大 visible”，通常是键盘收起时
      const baselineCandidate = Math.max(
        visible,
        Math.round(window.innerHeight || 0),
        Number.isFinite(cssVh) ? Math.round(cssVh) : 0,
      )
      if (baselineCandidate > baselineRef.current) baselineRef.current = baselineCandidate
      let inset = Math.max(
        0,
        Math.round(baselineRef.current - visible),
        Math.round((window.innerHeight || 0) - visible),
        Number.isFinite(cssVh) ? Math.round(cssVh - visible) : 0,
        vkInset,
      )
      // 防止异常值把输入栏顶飞（比如旋转/系统动画瞬间）
      inset = Math.min(inset, Math.round((baselineRef.current * 0.6) || 0))

      setKeyboardInsetPx((prev) => {
        // 抖动阈值：小于 4px 的变化忽略，减少 iOS26 上的“多一截”跳动感
        if (Math.abs(prev - inset) < 4) return prev
        return inset
      })
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    virtualKeyboard?.addEventListener?.('geometrychange', update)
    window.addEventListener('orientationchange', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      virtualKeyboard?.removeEventListener?.('geometrychange', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  const draftRef = useRef(draft)
  draftRef.current = draft
  const enterDebounceTimerRef = useRef<number | null>(null)
  const lastEnterDownRef = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const refocusComposer = useCallback(() => {
    requestAnimationFrame(() => {
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
    })
  }, [])

  const sendQueueRef = useRef<Array<{ text: string; triggerAi: boolean }>>([])
  const processingSendRef = useRef(false)

  const [typingVisible, setTypingVisible] = useState(false)
  const [flushUiBusy, setFlushUiBusy] = useState(false)
  const [awaitingAiKick, setAwaitingAiKick] = useState(false)
  const pendingAiRepliesRef = useRef(0)
  const flushAiRepliesBusyRef = useRef(false)
  const skipBusyBypassRef = useRef(false)
  const skipBusyLastTriggerMsRef = useRef(0)
  const aiFailureCooldownUntilRef = useRef(0)
  const aiLastErrorToastMsRef = useRef(0)

  useEffect(() => {
    onOtherTypingChange?.(typingVisible)
    return () => {
      onOtherTypingChange?.(false)
    }
  }, [typingVisible, onOtherTypingChange])

  // moved earlier

  const jumpToBottom = useCallback(() => {
    scrollToBottomSmooth({ force: true })
  }, [scrollToBottomSmooth])

  /**
   * 普通文本消息队列节奏：
   * - 首条不等待
   * - 后续按“每 5 字 = 1 秒”计算（10 字=2 秒）
   */
  const gapBeforeBubbleMs = useCallback((currentSegmentLength: number, isFirst: boolean) => {
    if (isFirst) return 0
    const chars = Math.max(1, currentSegmentLength)
    return Math.min(25000, Math.ceil(chars / 5) * 1000)
  }, [])

  /**
   * 分段等待：改为确定性等待，避免随机切片导致“看起来卡住”。
   * 等待期间保持“对方正在输入”。
   */
  const gapDelayWithTyping = useCallback(async (totalMs: number) => {
    if (totalMs <= 0 || opponentQueueStopRef.current) return
    setTypingVisible(true)
    await sleep(totalMs)
    setTypingVisible(false)
  }, [])

  /** 消费模型返回的弹幕行；当本地配置尚未加载完成时，回退实时读取 DB，避免“首轮丢弹幕”。 */
  const enqueueDanmakuLines = useCallback(async (lines: string[]) => {
    if (!lines.length || !danmakuEnabled) return
    let eff = effectiveDm
    if (!eff) {
      const g = await personaDb.getGlobalSettings()
      const pid = (personaCharacterId?.trim() || conversationCharacterId.trim()) || ''
      const row = pid ? await personaDb.getCharacterDanmakuSettings(pid) : null
      eff = resolveEffectiveDanmakuVisuals(g, pid, row)
    }
    if (!eff || eff.skipCharacter) return
    logger.log(
      'ai',
      `[DMDBG] enqueue lines=${lines.length} poolBefore=${dmBullets.length} density=${eff.density} pos=${eff.position}`,
    )
    const trackCount = densityToTrackCount(eff.density)
    const durationSec = eff.scrollDurationSec
    const fontPx = eff.fontSize
    const colorRgba = hexAndOpacityToRgba(eff.color, eff.opacity)
    if (dmLaneBusyUntilRef.current.length !== trackCount) {
      dmLaneBusyUntilRef.current = Array.from({ length: trackCount }, () => 0)
    }

    lines.forEach((line, i) => {
      const scheduleDelay = Math.max(0, i * randomBetween(80, 260) + randomBetween(0, 900))
      window.setTimeout(() => {
        const pickTrackWithGap = () => {
          const now = Date.now()
          const busy = dmLaneBusyUntilRef.current
          let best = 0
          let bestWait = Number.POSITIVE_INFINITY
          for (let t = 0; t < trackCount; t += 1) {
            const wait = Math.max(0, (busy[t] ?? 0) - now)
            if (wait <= 0) return { track: t, waitMs: 0 }
            if (wait < bestWait) {
              bestWait = wait
              best = t
            }
          }
          return { track: best, waitMs: Math.max(0, bestWait) }
        }
        const place = () => {
          const { track, waitMs } = pickTrackWithGap()
          if (waitMs > 0) {
            window.setTimeout(place, waitMs)
            return
          }
          const id = `dm-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`
          const durationJitter = (Math.random() - 0.5) * 2.2
          const realDuration = Math.max(3, durationSec + durationJitter)
          const safeGapMs = Math.max(1100, realDuration * 1000 * 0.62)
          dmLaneBusyUntilRef.current[track] = Date.now() + safeGapMs
          const topPct =
            eff.position === 'random'
              ? Math.min(92, Math.max(2, (track / Math.max(1, trackCount - 1)) * 72 + Math.random() * 6))
              : undefined
          setDmBullets((prev) => {
            const next = [
              ...prev,
              {
                id,
                text: line,
                track,
                durationSec: realDuration,
                startDelaySec: Math.random() * 0.65,
                fontPx,
                colorRgba,
                style: eff.style,
                positionMode: eff.position,
                topPct,
              },
            ]
            // 循环渲染下保留近期窗口，避免数组无限膨胀。
            return next.slice(-180)
          })
        }
        place()
      }, scheduleDelay)
    })
  }, [danmakuEnabled, effectiveDm, personaCharacterId, conversationCharacterId, logger, dmBullets.length])

  const generateHeartWhisper = useCallback(async () => {
    if (heartWhisperLoading) return
    setHeartWhisperLoading(true)
    try {
      let character: Character | null = null
      let worldBackgroundPrompt: string | undefined
      const pcid = personaCharacterId?.trim()
      const lumiAssistantChat = useLumiProjectAssistantPrompt
      if (!lumiAssistantChat && pcid) {
        character = await personaDb.getCharacter(pcid)
        if (character?.worldBackgroundEnabled !== false && character?.worldBackgroundId?.trim()) {
          const wbg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
          const block = formatWorldBackgroundForPrompt(wbg)
          if (block.trim()) worldBackgroundPrompt = block
        }
      }
      let playerIdentity: PlayerIdentity | null = null
      const piid = playerIdentityId.trim()
      if (!lumiAssistantChat && piid && piid !== '__none__') {
        playerIdentity = await personaDb.getPlayerIdentity(piid)
      }
      const peerName = playerDisplayName.trim() || state.profile.displayName.trim() || '朋友'
      const promptMode = lumiAssistantChat ? 'lumi-assistant' : 'persona'
      const offlineDatingPlotsContext =
        promptMode === 'persona' && pcid
          ? await loadOfflineDatingPlotsPromptBlock(pcid, character?.name ?? null)
          : ''
      const whisper = await requestWeChatHeartWhisper({
        apiConfig,
        character,
        playerIdentity,
        playerDisplayName: peerName,
        transcript: itemsToTranscript(itemsRef.current),
        promptMode,
        nowMs: getCurrentTimeMs(),
        longTermMemoryNotes: memoryNotesForPrompt.trim() || undefined,
        worldBackgroundPrompt,
        offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
      })
      await personaDb.putHeartWhisper(conversationCharacterId, whisper)
      setHeartWhisperData(whisper)
      showComposerToast('心语已更新')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败'
      showComposerToast(`心语生成失败：${msg}`)
    } finally {
      setHeartWhisperLoading(false)
    }
  }, [
    apiConfig,
    conversationCharacterId,
    getCurrentTimeMs,
    heartWhisperLoading,
    memoryNotesForPrompt,
    personaCharacterId,
    playerDisplayName,
    playerIdentityId,
    showComposerToast,
    state.profile.displayName,
    useLumiProjectAssistantPrompt,
  ])

  useEffect(() => {
    if (!heartWhisperOpen) return
    let cancelled = false
    void (async () => {
      const row = await personaDb.getHeartWhisper(conversationCharacterId)
      if (cancelled) return
      setHeartWhisperData(row?.data ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [conversationCharacterId, heartWhisperOpen])

  const flushAiReplies = useCallback(async () => {
    const nowGate = Date.now()
    if (nowGate < aiFailureCooldownUntilRef.current) {
      pendingAiRepliesRef.current = 0
      setAwaitingAiKick(false)
      setTypingVisible(false)
      return
    }
    if (flushAiRepliesBusyRef.current) return
    flushAiRepliesBusyRef.current = true
    aiCallingRef.current = true
    setAwaitingAiKick(false)
    setFlushUiBusy(true)
    const peerName = playerDisplayName.trim() || state.profile.displayName.trim() || '朋友'
    try {
      while (pendingAiRepliesRef.current > 0) {
        if (manualAiPauseRef.current) {
          pendingAiRepliesRef.current = 0
          break
        }
        pendingAiRepliesRef.current -= 1
        opponentQueueStopRef.current = false
        const transcript = itemsToTranscript(itemsRef.current)
        const roundReplyBias = retryReplyBiasRef.current.trim()
        retryReplyBiasRef.current = ''

        setTypingVisible(true)
        await sleep(randomBetween(520, 1600))
        if (opponentQueueStopRef.current) {
          setTypingVisible(false)
          continue
        }

        let character: Character | null = null
        let worldBackgroundPrompt: string | undefined
        const cid = personaCharacterId?.trim()
        const lumiAssistantChat = useLumiProjectAssistantPrompt
        if (!lumiAssistantChat && cid) {
          try {
            character = await personaDb.getCharacter(cid)
            if (character?.worldBackgroundEnabled !== false && character?.worldBackgroundId?.trim()) {
              const wbg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
              const block = formatWorldBackgroundForPrompt(wbg)
              if (block.trim()) worldBackgroundPrompt = block
            }
          } catch {
            character = null
          }
        }

        let playerIdentity: PlayerIdentity | null = null
        const pid = playerIdentityId.trim()
        if (!lumiAssistantChat && pid && pid !== '__none__') {
          try {
            playerIdentity = await personaDb.getPlayerIdentity(pid)
          } catch {
            playerIdentity = null
          }
        }

        const pm = lumiAssistantChat ? 'lumi-assistant' : 'persona'
        const offlineDatingPlotsContext =
          pm === 'persona' && cid
            ? await loadOfflineDatingPlotsPromptBlock(cid, character?.name ?? null)
            : ''

        let aiReply: WeChatPeerReplyResult = { bubbles: [] }
        let aiRequestFailed = false
        let clearBusyAfterReply = false
        let suppressBusyDirectiveThisRound = false
        try {
          const hasApi =
            !!apiConfig?.apiUrl?.trim() &&
            !!apiConfig?.apiKey?.trim() &&
            !!apiConfig?.modelId?.trim()
          if (!hasApi) {
            // 不做任何本地兜底回复：未触发模型时不应出现角色消息
            showComposerToast('未配置 AI API，无法生成对方回复')
            pendingAiRepliesRef.current = 0
            setTypingVisible(false)
            continue
          } else {
            const busyGs = await personaDb.getGlobalSettings()
            const busyConvEnabledRaw = await personaDb.getPhoneKv(`busy-conv:${conversationKey}`)
            const busyConvEnabled = typeof busyConvEnabledRaw === 'boolean' ? busyConvEnabledRaw : true
            const busySwitchEnabledRaw =
              busyGs.busyEnabled && (busyGs.busyMode === 'character' ? (peerBusyRow?.enabled ?? true) : busyConvEnabled)
            if (skipBusyBypassRef.current) {
              suppressBusyDirectiveThisRound = true
              skipBusyBypassRef.current = false
            }
            const busySwitchEnabled = suppressBusyDirectiveThisRound ? false : busySwitchEnabledRaw
            const busyRow = await personaDb.getCharacterBusySettings(conversationCharacterId)
            const nowTs = getCurrentTimeMs()
            const busyStillActive = !!busyRow?.isBusy && (busyRow.busyEndTime ?? 0) > nowTs
            clearBusyAfterReply = !!busySwitchEnabled && !!busyRow?.isBusy && !busyStillActive
            if (clearBusyAfterReply) {
              // 关键：忙碌已过期时先解除 busy，避免后续 AI 失败时被“过期忙碌”反复触发重试。
              await personaDb.putCharacterBusySettings({
                characterId: conversationCharacterId,
                isBusy: false,
                busyReason: '',
                busyStartTime: 0,
                busyEndTime: 0,
                busyDurationMinutes: busyRow?.busyDurationMinutes ?? 15,
                busyMessages: [],
              })
              clearBusyAfterReply = false
            }
            if (busySwitchEnabled && busyStillActive) {
              showCenterToast(buildBusyToastText(peerNotifyTitle || '对方', busyRow?.busyReason || '处理点事情', busyRow?.busyEndTime ?? nowTs, nowTs))
              pendingAiRepliesRef.current = 0
              continue
            }
            const reversed = [...itemsRef.current].reverse()
            const lastSelf = reversed.find((x) => x.kind === 'msg' && x.from === 'self') as ChatMsg | undefined
            const lastOther = reversed.find((x) => x.kind === 'msg' && x.from === 'other') as ChatMsg | undefined
            const lastSelfVoice = reversed.find((x) => x.kind === 'msg' && x.from === 'self' && !!x.voice) as ChatMsg | undefined
            const voiceEmotionBias = (() => {
              const v = lastSelfVoice?.voice
              if (!v) return ''
              const emotion = v.emotionLabel?.trim()
              const transcript = v.transcriptText?.trim() || lastSelfVoice?.text?.trim() || ''
              if (!emotion && !transcript) return ''
              const chunks: string[] = ['【语音情绪权重提示】']
              if (emotion) chunks.push(`- 用户上一条语音情绪倾向：${emotion}。`)
              if (transcript) chunks.push(`- 语音转写要点：${transcript}`)
              chunks.push('- 回复时先做情绪承接，再给出内容回应；语气自然、克制、贴近真实聊天。')
              return chunks.join('\n')
            })()
            const mergedReplyBias = [roundReplyBias, voiceEmotionBias].filter((x) => x.trim()).join('\n\n')
            const recallPreview = pendingRecalledUserTextRef.current?.trim() || ''
            const recallVagueShape = (() => {
              if (!recallPreview) return ''
              const n = recallPreview.length
              if (n <= 6) return '你只觉得那条气泡非常短，像一句直球或一句狠话。'
              if (n <= 24) return '你只觉得那条不长，像吐槽、撒娇或一句追问。'
              return '你只觉得那条不算短，但规则禁止你还原任何原词。'
            })()
            const recallBias = recallPreview
              ? Math.random() < 0.2
                ? `[系统提示] 用户刚刚撤回了一条私聊消息；你手快，在消失前**瞥到一点氛围**（${recallVagueShape}）**硬性约束**：正文里**禁止**复述撤回原文、**禁止**用加粗/引号复刻措辞、**禁止**使用 \`[引用:消息ID]\` 指向该条或任何等价「引用条」展示原文；只能用人设口吻**旁敲侧击**一句（如「撤回什么呢，我都看见了」「当我瞎？」），让读者感觉你瞄到了又不当众拆穿。`
                : `[系统提示] 用户刚刚撤回了一条消息，你没看清具体内容。**禁止**假装你看见了原文、**禁止**复述臆测的具体措辞；可以好奇追问，或照常接话。`
              : ''
            const finalReplyBias = [mergedReplyBias, recallBias].filter((x) => x.trim()).join('\n\n')
            pendingRecalledUserTextRef.current = null
            // 关键：如果玩家在发图后又补了一句文字（例如“你看不见吗”），则最后一条 self 可能是纯文本。
            // 为确保模型能对“最近一次发的图片”做出反应，这里改为：优先取“最近一次 self 图片消息”，但仅限于发生在最近一次 other 消息之后（即本轮玩家侧发送的图）。
            const lastSelfWithImage = reversed.find((x) => {
              if (x.kind !== 'msg' || x.from !== 'self') return false
              if (!x.images?.[0]?.base64?.trim()) return false
              if (!lastOther) return true
              // items 是按时间顺序；reverse 后越靠前越新，因此当找到的 self 图消息比 lastOther 新就算同一轮
              const selfIdx = itemsRef.current.findIndex((it) => it.id === x.id)
              const otherIdx = itemsRef.current.findIndex((it) => it.id === lastOther.id)
              return otherIdx < 0 || selfIdx > otherIdx
            }) as ChatMsg | undefined
            const img = lastSelfWithImage?.images?.[0]
            // 线上回复思维链开关：已取消（每次回复都走好感度一致性思维链 CoT）。
            const includeThinkingChain = true
            const busyCfg =
              busyGs.busyMode === 'character'
                ? {
                    maxDuration: peerBusyRow?.maxDuration ?? busyGs.globalBusyConfig.maxDuration,
                    customScenarios: peerBusyRow?.customScenarios ?? busyGs.globalBusyConfig.customScenarios,
                  }
                : busyGs.globalBusyConfig
            const busyContext: BusyRuntimeContext | undefined = busySwitchEnabled
              ? {
                  enabled: true,
                  isBusy: !!busyRow?.isBusy && (busyRow.busyEndTime ?? 0) > nowTs,
                  remainingMinutes: busyRow?.busyEndTime ? Math.max(0, Math.ceil((busyRow.busyEndTime - nowTs) / 60000)) : 0,
                  reason: busyRow?.busyReason ?? '',
                  maxDuration: busyCfg.maxDuration,
                  customScenarios: busyCfg.customScenarios,
                  busyMessages: (busyRow?.busyMessages ?? []).map((m) => ({
                    id: m.id,
                    content: m.content,
                    timestamp: m.timestamp,
                  })),
                }
              : undefined
            const danmakuConfig =
              danmakuEnabled && effectiveDm && !effectiveDm.skipCharacter
                ? {
                    enabled: true,
                    useMemory: effectiveDm.useMemory,
                    generateCount: effectiveDm.generateCount,
                    customPrompt: effectiveDm.customPrompt.trim() || undefined,
                  }
                : undefined
            const hasDanmakuSubApi =
              !!danmakuApiConfig?.apiUrl?.trim() &&
              !!danmakuApiConfig?.apiKey?.trim() &&
              !!danmakuApiConfig?.modelId?.trim() &&
              danmakuSubApiEnabled &&
              !isSameApiConfigShape(danmakuApiConfig, apiConfig)
            const shouldSplitDanmakuCall = !!danmakuConfig && hasDanmakuSubApi
            logger.log(
              'ai',
              `flushAiReplies: promptMode=${pm} personaCharacterId=${cid || 'none'} offlinePlotsChars=${offlineDatingPlotsContext.length} lastSelf=${lastSelf?.id ?? 'none'} lastOther=${lastOther?.id ?? 'none'} pickedImageFrom=${lastSelfWithImage?.id ?? 'none'} hasImage=${Boolean(img?.base64?.trim())} imgLen=${img?.base64?.trim()?.length ?? 0}`,
            )
            if (img?.base64?.trim()) {
              const userImageIsSticker = Boolean(lastSelfWithImage?.text?.trim().startsWith('[表情包]'))
              // 表情包：不走“带图”调用（避免发表情包后立刻触发图片理解/描述倾向），
              // 只按文本协议（用户消息以 [表情包] 开头）与普通文字一致触发回复。
              if (userImageIsSticker) {
                aiReply = await requestWeChatPeerReplyBubbles({
                  apiConfig,
                  character,
                  playerIdentity,
                  playerDisplayName: peerName,
                  transcript,
                  promptMode: pm,
                  longTermMemoryNotes: memoryNotesForPrompt.trim() || undefined,
                  worldBackgroundPrompt,
                  offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
                  replyBias: finalReplyBias || undefined,
                  busyContext,
                  includeThinkingChain,
                  currentTimeMs: getCurrentTimeMs(),
                  danmakuConfig: shouldSplitDanmakuCall ? undefined : danmakuConfig,
                })
              } else {
                aiReply = await requestWeChatPeerReplyBubblesWithImage({
                  apiConfig,
                  character,
                  playerIdentity,
                  playerDisplayName: peerName,
                  transcript,
                  promptMode: pm,
                  imageBase64: img.base64.trim(),
                  imageMime: img.type ?? 'image/jpeg',
                  userImageIsSticker,
                  longTermMemoryNotes: memoryNotesForPrompt.trim() || undefined,
                  worldBackgroundPrompt,
                  offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
                  replyBias: finalReplyBias || undefined,
                  busyContext,
                  includeThinkingChain,
                  currentTimeMs: getCurrentTimeMs(),
                  danmakuConfig: shouldSplitDanmakuCall ? undefined : danmakuConfig,
                })
              }
            } else {
              aiReply = await requestWeChatPeerReplyBubbles({
                apiConfig,
                character,
                playerIdentity,
                playerDisplayName: peerName,
                transcript,
                promptMode: pm,
                longTermMemoryNotes: memoryNotesForPrompt.trim() || undefined,
                worldBackgroundPrompt,
                offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
                replyBias: finalReplyBias || undefined,
                busyContext,
                includeThinkingChain,
                currentTimeMs: getCurrentTimeMs(),
                danmakuConfig: shouldSplitDanmakuCall ? undefined : danmakuConfig,
              })
            }
            if (shouldSplitDanmakuCall && danmakuApiConfig && danmakuConfig) {
              try {
                const splitLines = await requestWeChatDanmakuVarietyShow({
                  apiConfig: danmakuApiConfig,
                  character,
                  playerIdentity,
                  playerDisplayName: peerName,
                  transcript,
                  promptMode: pm,
                  useMemory: danmakuConfig.useMemory,
                  generateCount: danmakuConfig.generateCount,
                  customRulesPrompt: danmakuConfig.customPrompt,
                  longTermMemoryNotes: memoryNotesForPrompt.trim() || undefined,
                  worldBackgroundPrompt,
                  offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
                })
                logger.log('ai', `[DMDBG] split-call enabled lines=${splitLines.length}`)
                if (splitLines.length > 0) queueMicrotask(() => enqueueDanmakuLines(splitLines))
              } catch (err) {
                logger.log('error', `弹幕副接口调用失败: ${err instanceof Error ? err.message : String(err)}`)
              }
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : '未知错误'
          aiRequestFailed = true
          logger.log('error', `AI请求失败: ${msg}`)
          aiFailureCooldownUntilRef.current = Date.now() + 8000
          pendingAiRepliesRef.current = 0
          const nowToast = Date.now()
          if (nowToast - aiLastErrorToastMsRef.current > 3000) {
            aiLastErrorToastMsRef.current = nowToast
            showComposerToast(`AI请求失败：${msg.slice(0, 120)}`)
          }
        } finally {
          setTypingVisible(false)
        }

        if (opponentQueueStopRef.current) continue
        if (aiRequestFailed) continue

        let bubbles = aiReply.bubbles ?? []
        const bubbleExtraction = extractDanmakuFromBubbleText(bubbles)
        bubbles = bubbleExtraction.cleaned
        const danmakuLinesCollected = [
          ...(aiReply.danmakuLines ?? []).map((s) => String(s ?? '').trim()).filter(Boolean),
          ...bubbleExtraction.danmakuLines,
        ].filter(Boolean)
        logger.log(
          'ai',
          `[DMDBG] extract inline=${(aiReply.danmakuLines ?? []).length} fallback=${bubbleExtraction.danmakuLines.length} total=${danmakuLinesCollected.length} bubblesAfterClean=${bubbles.length}`,
        )
        const busyCandidate = [bubbles?.[0] ?? '', bubbles?.[1] ?? '', bubbles?.[2] ?? ''].join('')
        const busyDirective = parseBusyDirective(busyCandidate.trim())
        // 思维链仅用于模型内部推演，不在聊天室落库/展示。
        const thinking = undefined
        if (busyDirective && !suppressBusyDirectiveThisRound) {
          const nowTs = getCurrentTimeMs()
          const end = nowTs + busyDirective.duration * 60 * 1000
          await personaDb.putCharacterBusySettings({
            characterId: conversationCharacterId,
            isBusy: true,
            busyReason: busyDirective.reason,
            busyStartTime: nowTs,
            busyEndTime: end,
            busyDurationMinutes: busyDirective.duration,
          })
          showCenterToast(buildBusyToastText(peerNotifyTitle || '对方', busyDirective.reason, end, nowTs))
          continue
        }
        if (busyDirective && suppressBusyDirectiveThisRound) {
          bubbles = ['我回来了，刚刚忙完。']
        }

        // 兜底：模型/解析偶发返回重复气泡（例如同一段被输出两遍）。
        // 这里做轻量去重（保序 + 去掉相邻重复），避免 UI 瞬间渲染两条一样的消息。
        bubbles = (bubbles ?? [])
          .map((s) => String(s ?? '').trim())
          .filter(Boolean)
          .filter((s) => !/^\[BUSY\]/i.test(s) && !/^["'“”‘’]\s*,?\s*"duration"\s*:/i.test(s))
          .reduce<string[]>((acc, cur) => {
            const prev = acc.length ? acc[acc.length - 1] : ''
            if (prev && prev === cur) return acc
            acc.push(cur)
            return acc
          }, [])

        await sleep(randomBetween(280, 780))
        if (opponentQueueStopRef.current) continue

        let pendingReplyMessageId: string | undefined
        let thinkingAttached = false
        const emittedThisRound = new Set<string>()
        const emittedMessageIdsThisRound = new Set<string>()
        const emittedMessageOrderThisRound: string[] = []
        const emittedMessageMetaThisRound = new Map<string, { timestamp: number; preview: string }>()
        const markEmittedThisRound = (id: string, timestamp: number, preview: string) => {
          emittedMessageIdsThisRound.add(id)
          emittedMessageOrderThisRound.push(id)
          emittedMessageMetaThisRound.set(id, { timestamp, preview })
        }
        for (let i = 0; i < bubbles.length; i += 1) {
          try {
            if (opponentQueueStopRef.current) break
            const rawLine = String(bubbles[i] ?? '').trim()
            const normalizedRawLine = rawLine.replace(/\\n/g, '\n').trim()
            const expandedLines = normalizedRawLine
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean)
            if (expandedLines.length > 1) {
              bubbles.splice(i, 1, ...expandedLines)
              i -= 1
              continue
            }
            const currentLine = expandedLines[0] ?? normalizedRawLine
            if (!currentLine) continue
            if (currentLine === WECHAT_RECALL_ACTION_TOKEN) {
              const lastId = emittedMessageOrderThisRound.length ? emittedMessageOrderThisRound[emittedMessageOrderThisRound.length - 1] : ''
              if (!lastId) continue
              const emittedMeta = emittedMessageMetaThisRound.get(lastId)
              setRecallAnimatingIds((prev) => new Set(prev).add(lastId))
              await sleep(randomBetween(1100, 1800))
              const recalledAt = getCurrentTimeMs()
              let original = emittedMeta?.preview?.trim() || ''
              try {
                const fromDb = await personaDb.getWeChatChatMessageById(lastId)
                if (fromDb) {
                  original = fromDb.originalContent?.trim() || fromDb.content?.trim() || original
                } else if (!original) {
                  const local = extractMessages(itemsRef.current).find((x) => x.id === lastId)
                  original = local?.originalText?.trim() || local?.text?.trim() || ''
                }
                await personaDb.patchWeChatChatMessageById(lastId, {
                  content: '',
                  isRecalled: true,
                  recalledBy: 'character',
                  recallTimestamp: recalledAt,
                  originalContent: original,
                })
              } catch (e) {
                logger.log('error', `角色撤回落库失败 id=${lastId} err=${e instanceof Error ? e.message : String(e)}`)
              }
              setItems((prev) => {
                const next = rebuildWithCurrentTime(
                  extractMessages(prev).map((msg) =>
                    msg.id !== lastId
                      ? msg
                      : {
                          ...msg,
                          text: '',
                          isRecalled: true,
                          recalledBy: 'other',
                          recallTimestamp: recalledAt,
                          originalText: original,
                        },
                  ),
                )
                itemsRef.current = next
                return next
              })
              setRecallAnimatingIds((prev) => {
                const next = new Set(prev)
                next.delete(lastId)
                return next
              })
              continue
            }
            const voiceLineMatch = currentLine.match(/^(?:\[语音\]|【语音】)\s*(.*)$/)
            if (voiceLineMatch) {
              const rawScript = String(voiceLineMatch[1] ?? '').trim()
              if (!rawScript) continue
              const normalizedScript = normalizeVoiceScriptForTts(rawScript)
              const seg = sanitizeVoiceTranscriptDisplay(normalizedScript)
              const estimatedVoiceSec = Math.max(1, Math.min(30, Math.round(seg.length / 6)))
              // 语音条按时长出队：避免“语音消息不到 1 秒就弹出”的违和感。
              const voiceQueueDelayMs = Math.max(1200, Math.min(30000, estimatedVoiceSec * 1000))
              await gapDelayWithTyping(voiceQueueDelayMs)
              if (opponentQueueStopRef.current) break
              const ts = getCurrentTimeMs()
              const oid = `wxm-${ts}-ov-${i}-${Math.random().toString(36).slice(2, 6)}`
              const replyToMeta = pendingReplyMessageId ? await buildReplyMetaById(pendingReplyMessageId) : null
              pendingReplyMessageId = undefined
              const voice = {
                durationSec: estimatedVoiceSec,
                emotionAnalyzed: true,
                ttsScript: normalizedScript,
                transcriptText: seg || '（语音）',
              }
              try {
                await withTimeout(
                  personaDb.appendWeChatChatMessage({
                    id: oid,
                    characterId: conversationCharacterId,
                    playerIdentityId,
                    type: 'character',
                    content: seg || '[语音]',
                    thinking: !thinkingAttached ? thinking : undefined,
                    replyTo: replyToMeta ?? undefined,
                    timestamp: ts,
                    isRead: true,
                    conversationKey,
                    notifyPeerTitle: peerNotifyTitle.trim() || undefined,
                    voice,
                  }),
                  2000,
                )
              } catch {
                /* ignore */
              }
              const incoming: ChatMsg = {
                id: oid,
                kind: 'msg',
                from: 'other',
                text: seg || '[语音]',
                thinking: !thinkingAttached ? thinking : undefined,
                timestamp: ts,
                replyTo: replyToMeta ?? undefined,
                voice,
                otherAnimated: true,
              }
              if (!thinkingAttached && thinking) thinkingAttached = true
              const el = scrollRef.current
              const atBottomNow = el ? isScrollNearBottom(el) : isAtBottomRef.current
              const browsingHistory = !!el && userScrolledRef.current && !atBottomNow
              const shouldStickToBottom = atBottomNow && !browsingHistory
              isAtBottomRef.current = shouldStickToBottom
              setIsAtBottom(shouldStickToBottom)
              setItems((prev) => {
                const next = mergeIncomingMessage(prev, incoming)
                itemsRef.current = next
                return next
              })
              markEmittedThisRound(oid, ts, seg || '[语音]')
              if (shouldStickToBottom) scrollToBottomSmooth()
              else setPendingNewCount((c) => c + 1)
              await sleep(randomBetween(220, 420))
              continue
            }
            const rpDirective = parseRedPacketDirective(currentLine)
            const tfDirective = parseTransferDirective(currentLine)
            const vcDirective = parseVoiceCallDirective(currentLine)
            if (rpDirective || tfDirective || vcDirective) {
              const ts = getCurrentTimeMs()
              const mid = `wxm-${ts}-o-${i}-${Math.random().toString(36).slice(2, 6)}`
              if (vcDirective?.type === 'start') {
                setActiveCallInitiator('other')
                setIncomingCallOpeningLine(vcDirective.openingLine ?? '')
                incomingRejectLockRef.current = false
                setIncomingCallOpen(true)
                await sleep(randomBetween(120, 220))
                continue
              }
              if (rpDirective) {
                // 角色发红包给用户：备注可用于安慰/祝福；金额 0.01~200
                const packetId = `wxrp-${ts}-${Math.random().toString(36).slice(2, 9)}`
                const seg = rpDirective.remark ? `[红包] ${rpDirective.remark}` : '[红包]'
                await personaDb.appendWeChatChatMessage({
                  id: mid,
                  characterId: conversationCharacterId,
                  playerIdentityId,
                  type: 'character',
                  content: seg,
                  thinking: !thinkingAttached ? thinking : undefined,
                  timestamp: ts,
                  isRead: true,
                  conversationKey,
                  notifyPeerTitle: peerNotifyTitle.trim() || undefined,
                  redPacket: { packetId, amountYuan: rpDirective.amountYuan, remark: rpDirective.remark, opened: false },
                })
                const incoming: ChatMsg = {
                  id: mid,
                  kind: 'msg',
                  from: 'other',
                  text: seg,
                  thinking: !thinkingAttached ? thinking : undefined,
                  timestamp: ts,
                  redPacket: { packetId, amountYuan: rpDirective.amountYuan, remark: rpDirective.remark, opened: false },
                  otherAnimated: true,
                }
                if (!thinkingAttached && thinking) thinkingAttached = true
                setItems((prev) => {
                  const next = mergeIncomingMessage(prev, incoming)
                  itemsRef.current = next
                  return next
                })
                markEmittedThisRound(mid, ts, seg)
                scrollToBottomSmooth()
                await sleep(randomBetween(120, 240))
                continue
              }
              if (tfDirective) {
                // 角色转账给用户：用 localStorage 记录 24h 退还；备注可用于安慰
                const transferId = `wxtr-${ts}-${Math.random().toString(36).slice(2, 10)}`
                const expiresAt = ts + 24 * 60 * 60 * 1000
                const seg = tfDirective.remark ? `[转账] ${tfDirective.remark}` : '[转账]'
                upsertLumiTransfer({
                  id: transferId,
                  amount: tfDirective.amountYuan,
                  remark: tfDirective.remark,
                  senderId: conversationCharacterId,
                  receiverId: playerIdentityId,
                  status: 'pending',
                  createdAt: ts,
                  expiresAt,
                  conversationKey,
                  messageId: transferId,
                })
                await personaDb.appendWeChatChatMessage({
                  id: mid,
                  characterId: conversationCharacterId,
                  playerIdentityId,
                  type: 'character',
                  content: seg,
                  thinking: !thinkingAttached ? thinking : undefined,
                  timestamp: ts,
                  isRead: true,
                  conversationKey,
                  notifyPeerTitle: peerNotifyTitle.trim() || undefined,
                  transfer: { transferId },
                })
                const incoming: ChatMsg = {
                  id: mid,
                  kind: 'msg',
                  from: 'other',
                  text: seg,
                  thinking: !thinkingAttached ? thinking : undefined,
                  timestamp: ts,
                  transfer: { transferId },
                  otherAnimated: true,
                }
                if (!thinkingAttached && thinking) thinkingAttached = true
                setItems((prev) => {
                  const next = mergeIncomingMessage(prev, incoming)
                  itemsRef.current = next
                  return next
                })
                markEmittedThisRound(mid, ts, seg)
                scrollToBottomSmooth()
                await sleep(randomBetween(120, 240))
                continue
              }
            }

            const charSticker = parseCharacterStickerLine(currentLine)
            if (charSticker) {
              const url = charSticker.url
              const dedupeSticker = `sticker:${url}`
              if (emittedThisRound.has(dedupeSticker)) continue
              emittedThisRound.add(dedupeSticker)
              const gapSticker = gapBeforeBubbleMs(8, i === 0)
              if (gapSticker > 0) {
                await gapDelayWithTyping(gapSticker)
              }
              if (opponentQueueStopRef.current) break
              const replyToSticker = pendingReplyMessageId ? await buildReplyMetaById(pendingReplyMessageId) : null
              pendingReplyMessageId = undefined
              const tsSticker = getCurrentTimeMs()
              const oidSticker = `wxm-${tsSticker}-ost-${i}-${Math.random().toString(36).slice(2, 6)}`
              try {
                const payloadSticker = await stickerUrlToImagePayload(url)
                const thinkingForSticker = !thinkingAttached ? thinking : undefined
                await withTimeout(
                  personaDb.appendWeChatChatMessage({
                    id: oidSticker,
                    characterId: conversationCharacterId,
                    playerIdentityId,
                    type: 'character',
                    content: '[表情包]',
                    thinking: thinkingForSticker,
                    replyTo: replyToSticker ?? undefined,
                    timestamp: tsSticker,
                    isRead: true,
                    conversationKey,
                    notifyPeerTitle: peerNotifyTitle.trim() || undefined,
                    images: [{ base64: payloadSticker.base64, type: payloadSticker.mime }],
                  }),
                  8000,
                )
                if (thinkingForSticker) thinkingAttached = true
                const incomingSticker: ChatMsg = {
                  id: oidSticker,
                  kind: 'msg',
                  from: 'other',
                  text: '[表情包]',
                  thinking: thinkingForSticker,
                  timestamp: tsSticker,
                  replyTo: replyToSticker ?? undefined,
                  images: [{ base64: payloadSticker.base64, type: payloadSticker.mime }],
                  otherAnimated: true,
                }
                const elSt = scrollRef.current
                const atBottomSt = elSt ? isScrollNearBottom(elSt) : isAtBottomRef.current
                const browsingHistorySt = !!elSt && userScrolledRef.current && !atBottomSt
                const shouldStickToBottomSt = atBottomSt && !browsingHistorySt
                isAtBottomRef.current = shouldStickToBottomSt
                setIsAtBottom(shouldStickToBottomSt)
                setItems((prev) => {
                  const next = mergeIncomingMessage(prev, incomingSticker)
                  itemsRef.current = next
                  return next
                })
                markEmittedThisRound(oidSticker, tsSticker, '[表情包]')
                if (shouldStickToBottomSt) scrollToBottomSmooth()
                else setPendingNewCount((c) => c + 1)
                await sleep(randomBetween(120, 260))
              } catch (e) {
                logger.log('error', `角色表情包发送失败: ${e instanceof Error ? e.message : String(e)}`)
              }
              continue
            }

            const parsed = parseReplyMarker(currentLine)
            if (parsed.replyMessageId) {
              pendingReplyMessageId = parsed.replyMessageId
            }
            const segRaw = parsed.text.trim()
            const seg = sanitizeVoiceControlForTextBubble(segRaw) || segRaw
            if (!seg) continue
            const nextIsRecall = bubbles[i + 1] === WECHAT_RECALL_ACTION_TOKEN
            const dedupeKey = seg.replace(/\s+/g, ' ').trim()
            if (!nextIsRecall && emittedThisRound.has(dedupeKey)) {
              logger.log('ai', `跳过重复分段#${i + 1}: ${seg}`)
              continue
            }
            emittedThisRound.add(dedupeKey)
            logger.log('ai', `队列分段#${i + 1}/${bubbles.length} len=${seg.length} text=${seg}`)
            const gap = gapBeforeBubbleMs(seg.length, i === 0)
            if (gap > 0) {
              logger.log('ai', `分段等待#${i + 1}: ${gap}ms`)
              await gapDelayWithTyping(gap)
              logger.log('ai', `分段等待结束#${i + 1}`)
            }
            if (opponentQueueStopRef.current) break

            const replyToMeta = pendingReplyMessageId ? await buildReplyMetaById(pendingReplyMessageId) : null
            pendingReplyMessageId = undefined

            const ts = getCurrentTimeMs()
            const oid = `wxm-${ts}-o-${i}-${Math.random().toString(36).slice(2, 6)}`
            try {
              await withTimeout(
                personaDb.appendWeChatChatMessage({
                  id: oid,
                  characterId: conversationCharacterId,
                  playerIdentityId,
                  type: 'character',
                  content: seg,
                  thinking: !thinkingAttached ? thinking : undefined,
                  replyTo: replyToMeta ?? undefined,
                  timestamp: ts,
                  isRead: true,
                  conversationKey,
                  notifyPeerTitle: peerNotifyTitle.trim() || undefined,
                }),
                2000,
              )
              logger.log('ai', `已落库分段#${i + 1} id=${oid}`)
            } catch (err) {
              logger.log(
                'error',
                `分段落库异常#${i + 1} id=${oid} err=${err instanceof Error ? err.message : String(err)}`,
              )
            }
            // 关键：无论后续是否因“近邻重复渲染”跳过 UI，都必须把本条写入 emitted 序列，
            // 否则紧随其后的撤回 token 将找不到要撤回的目标消息。
            markEmittedThisRound(oid, ts, seg)

            const lastOther = [...itemsRef.current].reverse().find((x) => x.kind === 'msg' && x.from === 'other') as ChatMsg | undefined
            if (!nextIsRecall && lastOther?.text?.trim() === seg) {
              logger.log('ai', `跳过近邻重复渲染#${i + 1}`)
              continue
            }
            const incoming: ChatMsg = {
              id: oid,
              kind: 'msg',
              from: 'other',
              text: seg,
              thinking: !thinkingAttached ? thinking : undefined,
              timestamp: ts,
              replyTo: replyToMeta ?? undefined,
              otherAnimated: true,
            }
            if (!thinkingAttached && thinking) thinkingAttached = true
            const el = scrollRef.current
            const atBottomNow = el ? isScrollNearBottom(el) : isAtBottomRef.current
            const browsingHistory = !!el && userScrolledRef.current && !atBottomNow
            const shouldStickToBottom = atBottomNow && !browsingHistory
            isAtBottomRef.current = shouldStickToBottom
            setIsAtBottom(shouldStickToBottom)
            setItems((prev) => {
              const next = mergeIncomingMessage(prev, incoming)
              itemsRef.current = next
              return next
            })
            if (shouldStickToBottom) {
              scrollToBottomSmooth()
            } else {
              setPendingNewCount((c) => c + 1)
            }
            await sleep(randomBetween(120, 260))
          } catch (err) {
            logger.log('error', `分段处理异常#${i + 1}: ${err instanceof Error ? err.message : String(err)}`)
            continue
          }
        }

        const inlineDanmakuLines = danmakuLinesCollected
        if (inlineDanmakuLines.length > 0) queueMicrotask(() => enqueueDanmakuLines(inlineDanmakuLines))
        if (clearBusyAfterReply) {
          await personaDb.putCharacterBusySettings({
            characterId: conversationCharacterId,
            isBusy: false,
            busyReason: '',
            busyStartTime: 0,
            busyEndTime: 0,
            busyDurationMinutes: 15,
            busyMessages: [],
          })
        }

        void (async () => {
          let shouldSummarizeNow = false
          try {
            const { shouldSummarize } = await personaDb.bumpMemoryAiRoundCount(conversationKey)
            shouldSummarizeNow = shouldSummarize
            if (!shouldSummarizeNow) return
            await runUnifiedAutoMemorySummaryAfterThreshold({
              apiConfig,
              conversationKey,
              characterId: conversationCharacterId,
              characterRealName: peerNotifyTitle.trim() || '对方',
            })
          } catch (err) {
            if (shouldSummarizeNow) {
              await personaDb.rollbackMemoryAiRoundCountForRetry(conversationKey)
            }
            logger.log('error', `自动总结失败: ${err instanceof Error ? err.message : String(err)}`)
          }
        })()
      }
    } finally {
      flushAiRepliesBusyRef.current = false
      setFlushUiBusy(false)
      setTypingVisible(false)
      aiCallingRef.current = pendingAiRepliesRef.current > 0
      if (pendingAiRepliesRef.current > 0) {
        queueMicrotask(() => {
          void flushAiReplies()
        })
      }
    }
  }, [
    apiConfig,
    conversationCharacterId,
    conversationKey,
    gapBeforeBubbleMs,
    gapDelayWithTyping,
    personaCharacterId,
    playerDisplayName,
    playerIdentityId,
    scrollToBottomSmooth,
    state.profile.displayName,
    useLumiProjectAssistantPrompt,
    memoryNotesForPrompt,
    peerNotifyTitle,
    enqueueDanmakuLines,
    danmakuEnabled,
    effectiveDm,
    danmakuApiConfig,
    danmakuSubApiEnabled,
    showComposerToast,
    buildReplyMetaById,
    logger,
    showCenterToast,
    peerBusyRow?.enabled,
    peerBusyRow?.maxDuration,
    peerBusyRow?.customScenarios,
    mergeIncomingMessage,
    getCurrentTimeMs,
  ])

  const busyExpireHandledEndRef = useRef(0)
  useEffect(() => {
    if (!globalDm?.busyEnabled) return
    const busySwitchEnabled = globalDm.busyMode === 'character' ? (peerBusyRow?.enabled ?? true) : globalModeBusyEnabled
    if (!busySwitchEnabled) return
    if (!peerBusyRow?.isBusy || peerBusyRow.busyEndTime <= 0) {
      busyExpireHandledEndRef.current = 0
      return
    }
    const ms = peerBusyRow.busyEndTime - currentTimeMs
    if (ms <= 0) return
    const t = window.setTimeout(() => {
      pendingAiRepliesRef.current += 1
      void flushAiReplies()
    }, ms + 30)
    return () => window.clearTimeout(t)
  }, [globalDm?.busyEnabled, globalDm?.busyMode, peerBusyRow, globalModeBusyEnabled, flushAiReplies, currentTimeMs])

  useEffect(() => {
    if (!peerBusyRow?.isBusy || peerBusyRow.busyEndTime <= 0) {
      busyExpireHandledEndRef.current = 0
      return
    }
    const end = peerBusyRow.busyEndTime
    const tick = () => {
      if (getCurrentTimeMs() < end) return
      if (busyExpireHandledEndRef.current === end) return
      busyExpireHandledEndRef.current = end
      pendingAiRepliesRef.current += 1
      void flushAiReplies()
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [peerBusyRow?.isBusy, peerBusyRow?.busyEndTime, flushAiReplies, getCurrentTimeMs])

  useEffect(() => {
    if (!skipBusySignal) return
    const now = Date.now()
    if (now - skipBusyLastTriggerMsRef.current < 1200) return
    skipBusyLastTriggerMsRef.current = now
    skipBusyBypassRef.current = true
    pendingAiRepliesRef.current = Math.max(1, pendingAiRepliesRef.current)
    void flushAiReplies()
  }, [skipBusySignal, flushAiReplies])

  const commitSendRef = useRef<(raw: string, triggerAi: boolean) => void>(() => {})

  const commitSend = useCallback(
    (raw: string, triggerAi: boolean) => {
      const text = raw.trim()
      if (!text) return
      const replyTo = replyingToRef.current ?? undefined
      if (enterDebounceTimerRef.current != null) {
        window.clearTimeout(enterDebounceTimerRef.current)
        enterDebounceTimerRef.current = null
      }
      lastEnterDownRef.current = 0
      manualAiPauseRef.current = false
      opponentQueueStopRef.current = true
      setTypingVisible(false)
      if (processingSendRef.current) {
        sendQueueRef.current.push({ text, triggerAi })
        return
      }
      processingSendRef.current = true
      setDraft('')
      setSendBusy(true)
      setReplyingTo(null)
      setEditing(null)
      const ts = getCurrentTimeMs()
      const id = `wxm-${ts}-s-${Math.random().toString(36).slice(2, 8)}`
      void (async () => {
        try {
          await personaDb.appendWeChatChatMessage({
            id,
            characterId: conversationCharacterId,
            playerIdentityId,
            type: 'player',
            content: text,
            replyTo,
            timestamp: ts,
            isRead: true,
            conversationKey,
          })
        } catch {
          /* ignore */
        }
      })()
      void (async () => {
        try {
          const busyGs = await personaDb.getGlobalSettings()
          const busyConvEnabledRaw = await personaDb.getPhoneKv(`busy-conv:${conversationKey}`)
          const busyConvEnabled = typeof busyConvEnabledRaw === 'boolean' ? busyConvEnabledRaw : true
          const busySwitchEnabled =
            busyGs.busyEnabled && (busyGs.busyMode === 'character' ? (peerBusyRow?.enabled ?? true) : busyConvEnabled)
          if (!busySwitchEnabled) return
          const row = await personaDb.getCharacterBusySettings(conversationCharacterId)
          if (!row?.isBusy || row.busyEndTime <= getCurrentTimeMs()) return
          await personaDb.putCharacterBusySettings({
            characterId: conversationCharacterId,
            busyMessages: [
              ...(row.busyMessages ?? []),
              {
                id,
                characterId: conversationCharacterId,
                playerIdentityId,
                type: 'player',
                content: text,
                timestamp: ts,
                isRead: true,
                conversationKey,
              },
            ],
          })
        } catch {
          /* ignore */
        }
      })()
      setItems((prev) => {
        const next = rebuildWithCurrentTime([
          ...extractMessages(prev),
          { id, kind: 'msg', from: 'self', text, timestamp: ts, replyTo, status: 'sent', selfAnimated: true },
        ])
        itemsRef.current = next
        return next
      })
      scrollToBottomSmooth()
      window.setTimeout(() => {
        setSendBusy(false)
        processingSendRef.current = false
        opponentQueueStopRef.current = false
        const next = sendQueueRef.current.shift()
        if (next?.text.trim()) {
          window.setTimeout(() => void commitSendRef.current(next.text, next.triggerAi), 0)
        }
      }, 260)
      if (triggerAi) {
        aiCallingRef.current = true
        lastUserAiTriggerTsRef.current = ts
        setAwaitingAiKick(true)
        window.setTimeout(() => {
          pendingAiRepliesRef.current += 1
          void flushAiReplies()
        }, 420)
      }
    },
    [conversationCharacterId, conversationKey, extractMessages, flushAiReplies, getCurrentTimeMs, playerIdentityId, rebuildWithCurrentTime, scrollToBottomSmooth, peerBusyRow?.enabled],
  )

  commitSendRef.current = commitSend

  const appendVoiceMessage = useCallback(
    async (opts: {
      durationSec: number
      audioBlob?: Blob | null
      transcriptText?: string
      emotion?: string
    }) => {
      const ts = getCurrentTimeMs()
      const id = `wxm-${ts}-voice-${Math.random().toString(36).slice(2, 8)}`
      const audioUrl = opts.audioBlob ? await blobToDataUrl(opts.audioBlob) : ''
      const transcriptText = sanitizeVoiceTranscriptDisplay(opts.transcriptText?.trim() || '')
      const emotionLabel = opts.emotion?.trim() || ''
      const voice = {
        durationSec: Math.max(1, opts.durationSec),
        emotionAnalyzed: true,
        emotionLabel: emotionLabel || undefined,
        ttsScript: undefined,
        audioUrl: audioUrl || undefined,
        transcriptText: transcriptText || undefined,
      }
      const persistedContent = transcriptText || '[语音]'
      try {
        await personaDb.appendWeChatChatMessage({
          id,
          characterId: conversationCharacterId,
          playerIdentityId,
          type: 'player',
          content: persistedContent,
          voice,
          timestamp: ts,
          isRead: true,
          conversationKey,
        })
      } catch {
        // ignore
      }
      setItems((prev) => {
        const next = rebuildWithCurrentTime([
          ...extractMessages(prev),
          {
            id,
            kind: 'msg',
            from: 'self',
            text: persistedContent,
            timestamp: ts,
            voice,
            status: 'sent',
            selfAnimated: true,
          },
        ])
        itemsRef.current = next
        return next
      })
      scrollToBottomSmooth()
    },
    [conversationCharacterId, conversationKey, extractMessages, getCurrentTimeMs, playerIdentityId, rebuildWithCurrentTime, scrollToBottomSmooth],
  )

  const commitSendImage = useCallback(
    (base64: string, triggerAi: boolean, mime: WeChatImageMime = 'image/jpeg', contentCaption = '') => {
      let clipped = base64.trim()
      // 兼容传入 dataURL / 纯 base64 两种形态
      clipped = clipped.replace(/^data:image\/(?:jpeg|png|gif|webp);base64,/i, '').trim()
      if (!clipped) return
      // 过短一般代表异常（比如没有真正拿到图片）
      if (clipped.length < 64) {
        showComposerToast('图片处理失败，请重试')
        logger.log('error', `commitSendImage: base64 过短 len=${clipped.length}`)
        return
      }
      logger.log('frontend', `commitSendImage: len=${clipped.length} triggerAi=${String(triggerAi)}`)
      manualAiPauseRef.current = false
      opponentQueueStopRef.current = true
      setTypingVisible(false)
      setDraft('')
      const replyTo = replyingToRef.current ?? undefined
      setReplyingTo(null)
      setSendBusy(true)
      const ts = getCurrentTimeMs()
      const id = `wxm-${ts}-img-s-${Math.random().toString(36).slice(2, 8)}`
      void (async () => {
        try {
          logger.log('indexeddb', `appendWeChatChatMessage(image): id=${id} len=${clipped.length}`)
          await personaDb.appendWeChatChatMessage({
            id,
            characterId: conversationCharacterId,
            playerIdentityId,
            type: 'player',
            content: contentCaption.trim(),
            replyTo,
            images: [{ base64: clipped, type: mime }],
            timestamp: ts,
            isRead: true,
            conversationKey,
          })
          logger.log('indexeddb', `appendWeChatChatMessage(image): ok id=${id}`)

          // 关键：立刻从库里读回归一化后的消息，避免“即时 state 与落库结构不一致”
          const stored = await personaDb.getWeChatChatMessageById(id)
          if (stored?.images?.[0]?.base64?.trim()) {
            logger.log('indexeddb', `hydrate(image): ok id=${id} len=${stored.images[0].base64.length}`)
            setItems((prev) => {
              const next = rebuildWithCurrentTime(extractMessages(prev).map((it) => {
                if (it.kind !== 'msg' || it.id !== id) return it
                return {
                  ...it,
                  text: stored.content ?? '',
                  images: stored.images,
                }
              }))
              itemsRef.current = next
              return next
            })
          } else {
            logger.log('error', `hydrate(image): missing images id=${id}`)
          }
        } catch {
          logger.log('error', `appendWeChatChatMessage(image) failed`)
          /* ignore */
        }
      })()
      setItems((prev) => {
        logger.log('frontend', `state insert(image): id=${id} len=${clipped.length}`)
        const next = rebuildWithCurrentTime([
          ...extractMessages(prev),
          {
            id,
            kind: 'msg',
            from: 'self',
            text: contentCaption.trim(),
            timestamp: ts,
            replyTo: replyTo ?? undefined,
            images: [{ base64: clipped, type: mime }],
            status: 'sent',
            selfAnimated: true,
          },
        ])
        itemsRef.current = next
        return next
      })
      scrollToBottomSmooth()
      window.setTimeout(() => {
        setSendBusy(false)
        processingSendRef.current = false
        opponentQueueStopRef.current = false
      }, 260)
      if (triggerAi) {
        aiCallingRef.current = true
        lastUserAiTriggerTsRef.current = ts
        setAwaitingAiKick(true)
        window.setTimeout(() => {
          pendingAiRepliesRef.current += 1
          void flushAiReplies()
        }, 420)
      }
    },
    [conversationCharacterId, conversationKey, extractMessages, flushAiReplies, getCurrentTimeMs, playerIdentityId, rebuildWithCurrentTime, scrollToBottomSmooth, showComposerToast, logger],
  )

  const lastChatMsg = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const it = items[i]!
      if (it.kind === 'msg') return it
    }
    return null
  }, [items])

  const canNudgeAiReply = useMemo(
    () =>
      Boolean(
        lastChatMsg?.kind === 'msg' &&
          lastChatMsg.from === 'self' &&
          !draft.trim() &&
          !sendBusy &&
          !typingVisible &&
          !flushUiBusy &&
          !awaitingAiKick,
      ),
    [lastChatMsg, draft, sendBusy, typingVisible, flushUiBusy, awaitingAiKick],
  )

  const planeCanAct = Boolean(draft.trim() || canNudgeAiReply)

  const onSendButtonClick = useCallback(() => {
    if (sendBusy) return
    if (enterDebounceTimerRef.current != null) {
      window.clearTimeout(enterDebounceTimerRef.current)
      enterDebounceTimerRef.current = null
    }
    lastEnterDownRef.current = 0
    if (draft.trim()) {
      commitSend(draft, true)
      return
    }
    if (canNudgeAiReply) {
      manualAiPauseRef.current = false
      pendingAiRepliesRef.current += 1
      void flushAiReplies()
    }
  }, [canNudgeAiReply, commitSend, draft, flushAiReplies, sendBusy])

  const openApiSettings = useCallback(() => {
    window.dispatchEvent(new CustomEvent('phone:open-app', { detail: { id: 'api' } }))
  }, [])

  const startVoiceRecordingOrWarn = useCallback(
    (origin: { x: number; y: number }) => {
      voiceLongPressAttemptedRef.current = true
      const hasSenseVoiceSmallKey = Boolean(voiceAsrEnabled && voiceAsrApiConfig?.apiKey?.trim())
      if (!hasSpeechRecognitionApi || !hasSenseVoiceSmallKey) {
        setVoiceConfigAlertMessage(
          '当前未配置 SenseVoiceSmall 的 API Key，无法使用录音语音功能。请先前往 API 设置完成配置。你也可以单击“按住说话”按钮，改为语音内容的纯文字输入。',
        )
        setVoiceConfigAlertOpen(true)
        return
      }
      setVoicePressing(true)
      setVoiceOverlayOpen(true)
      setVoiceGestureZone('send')
      setVoiceThumbOrigin(origin)
      void (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          voiceStreamRef.current = stream
          const recorder = new MediaRecorder(stream)
          voiceChunksRef.current = []
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) voiceChunksRef.current.push(ev.data)
          }
          recorder.start(120)
          voiceRecorderRef.current = recorder
        } catch (err) {
          setVoicePressing(false)
          setVoiceOverlayOpen(false)
          setVoiceGestureZone('send')
          setVoiceThumbOrigin(null)
          showComposerToast(err instanceof Error ? `麦克风不可用：${err.message}` : '麦克风不可用')
        }
      })()
    },
    [showComposerToast, voiceAsrApiConfig?.apiKey, voiceAsrEnabled],
  )

  const resolveVoiceZone = useCallback((clientX: number, clientY: number): VoiceGestureZone => {
    const origin = voiceThumbOrigin
    if (!origin) return 'send'
    const dx = clientX - origin.x
    const dy = clientY - origin.y
    const distance = Math.hypot(dx, dy)
    if (distance < 56) return 'send'
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    const inCancelSector = angle >= -165 && angle <= -105
    const inToTextSector = angle >= -75 && angle <= -15
    if (distance >= 68 && inCancelSector) return 'cancel'
    if (distance >= 68 && inToTextSector) return 'toText'
    return 'send'
  }, [voiceThumbOrigin])

  const onVoicePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      activeVoicePointerIdRef.current = e.pointerId
      voiceLongPressAttemptedRef.current = false
      voiceDownPosRef.current = { x: e.clientX, y: e.clientY }
      if (voiceHoldTimerRef.current != null) {
        window.clearTimeout(voiceHoldTimerRef.current)
        voiceHoldTimerRef.current = null
      }
      voiceHoldTimerRef.current = window.setTimeout(() => {
        startVoiceRecordingOrWarn({ x: e.clientX, y: e.clientY })
      }, VOICE_HOLD_START_MS)
      setVoiceSessionStartMs(Date.now())
    },
    [startVoiceRecordingOrWarn],
  )

  const onVoicePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      if (activeVoicePointerIdRef.current !== e.pointerId) return
      const down = voiceDownPosRef.current
      if (down && !voicePressing) {
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
        if (moved > VOICE_TAP_MOVE_THRESHOLD_PX && voiceHoldTimerRef.current != null) {
          window.clearTimeout(voiceHoldTimerRef.current)
          voiceHoldTimerRef.current = null
          startVoiceRecordingOrWarn({ x: down.x, y: down.y })
        }
      }
      if (!voicePressing) return
      setVoiceGestureZone(resolveVoiceZone(e.clientX, e.clientY))
    },
    [resolveVoiceZone, startVoiceRecordingOrWarn, voicePressing],
  )

  const onVoicePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      if (activeVoicePointerIdRef.current !== e.pointerId) return
      if (voiceHoldTimerRef.current != null) {
        window.clearTimeout(voiceHoldTimerRef.current)
        voiceHoldTimerRef.current = null
      }
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      const zone = resolveVoiceZone(e.clientX, e.clientY)
      const durationSec = Math.max(1, Math.round((Date.now() - (voiceSessionStartMs ?? Date.now())) / 1000))
      const wasPressing = voicePressing
      setVoicePressing(false)
      setVoiceOverlayOpen(false)
      setVoiceSessionStartMs(null)
      setVoiceThumbOrigin(null)
      voiceDownPosRef.current = null
      activeVoicePointerIdRef.current = null
      setVoiceGestureZone('send')
      const longPressAttempted = voiceLongPressAttemptedRef.current
      voiceLongPressAttemptedRef.current = false
      if (!wasPressing) {
        if (longPressAttempted) return
        setMockVoiceInputOpen(true)
        return
      }
      const recorder = voiceRecorderRef.current
      const stream = voiceStreamRef.current
      const settleRecordedAudio = async (): Promise<Blob | null> => {
        if (!recorder) return null
        if (recorder.state !== 'inactive') {
          await new Promise<void>((resolve) => {
            recorder.onstop = () => resolve()
            recorder.stop()
          })
        }
        const blob = voiceChunksRef.current.length
          ? new Blob(voiceChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          : null
        voiceRecorderRef.current = null
        voiceChunksRef.current = []
        if (stream) {
          stream.getTracks().forEach((t) => t.stop())
          voiceStreamRef.current = null
        }
        return blob
      }
      if (zone === 'cancel') {
        void settleRecordedAudio()
        return
      }
      if (zone === 'toText') {
        void (async () => {
          try {
            const audioBlob = await settleRecordedAudio()
            if (!audioBlob) {
              showComposerToast('录音为空，请重试')
              return
            }
            const asr = await requestSiliconflowTranscription(voiceAsrApiConfig, audioBlob)
            const text = asr.text.trim() || `（语音转文字）${durationSec}秒录音未识别到清晰文本`
            setDraft(text)
            setInputMode('text')
            showComposerToast('已转文字，可编辑后发送')
          } catch (err) {
            showComposerToast(err instanceof Error ? `转写失败：${err.message}` : '转写失败')
          }
        })()
        return
      }
      void (async () => {
        try {
          const audioBlob = await settleRecordedAudio()
          if (!audioBlob) {
            showComposerToast('录音为空，请重试')
            return
          }
          let transcriptText = ''
          let emotion = ''
          try {
            const asr = await requestSiliconflowTranscription(voiceAsrApiConfig, audioBlob)
            transcriptText = asr.text.trim()
            emotion = asr.emotion || ''
          } catch {
            // 发送语音不强依赖转写，失败可忽略
          }
          await appendVoiceMessage({ durationSec, audioBlob, transcriptText, emotion })
        } catch (err) {
          showComposerToast(err instanceof Error ? `录音处理失败：${err.message}` : '录音处理失败')
        }
      })()
    },
    [appendVoiceMessage, resolveVoiceZone, showComposerToast, voiceAsrApiConfig, voicePressing, voiceSessionStartMs],
  )

  const runRetryReply = useCallback(
    async (biasRaw: string) => {
      const bias = biasRaw.trim()
      const msgs = extractMessages(itemsRef.current)
      const lastSelfIdx = (() => {
        for (let i = msgs.length - 1; i >= 0; i -= 1) {
          const m = msgs[i]
          if (m?.from === 'self') return i
        }
        return -1
      })()
      if (lastSelfIdx < 0) {
        showComposerToast('未找到可重试的本轮用户消息')
        return
      }
      const toRemove = msgs
        .slice(lastSelfIdx + 1)
        .filter((m) => m.from === 'other')
        .map((m) => m.id)
      opponentQueueStopRef.current = true
      setTypingVisible(false)
      pendingAiRepliesRef.current = 0
      manualAiPauseRef.current = false

      if (toRemove.length) {
        for (const id of toRemove) {
          await personaDb.deleteWeChatChatMessageById(id)
        }
        setItems((prev) => {
          const kill = new Set(toRemove)
          const next = rebuildWithCurrentTime(extractMessages(prev).filter((it) => !kill.has(it.id)))
          itemsRef.current = next
          return next
        })
      }

      retryReplyBiasRef.current = bias
      window.setTimeout(() => {
        opponentQueueStopRef.current = false
        pendingAiRepliesRef.current = 1
        void flushAiReplies()
      }, 120)
      showComposerToast(bias ? '已按偏向发起重新回复' : '已发起重新回复')
    },
    [extractMessages, flushAiReplies, rebuildWithCurrentTime, showComposerToast],
  )

  const handlePlusAction = useCallback(
    (id: WeChatPlusActionId) => {
      setPlusMenuOpen(false)
      const stub = (name: string) => showComposerToast(`「${name}」功能开发中`)

      switch (id) {
        case 'photo':
          stub('照片')
          break
        case 'camera':
          setStubPanel(null)
          setPlusMenuOpen(false)
          setCameraOpen(true)
          logger.log('frontend', '点击加号菜单：拍摄')
          break
        case 'call':
          setCallSheetOpen(true)
          break
        case 'location':
          stub('位置')
          break
        case 'redpacket':
          if (onOpenSendRedPacket) {
            onOpenSendRedPacket()
          } else {
            stub('红包')
          }
          break
        case 'transfer':
          if (onOpenLumiTransfer) {
            onOpenLumiTransfer()
          } else {
            stub('转账')
          }
          break
        case 'affection_pay':
          if (onOpenAffectionPay) {
            onOpenAffectionPay()
          } else {
            stub('亲情卡支付')
          }
          break
        case 'favorite':
          stub('收藏')
          break
        case 'contact':
          stub('个人名片')
          break
        case 'music':
          stub('音乐')
          break
        case 'heart_words':
          openHeartWhisperPanel()
          break
        case 'read_ignore':
          manualAiPauseRef.current = true
          opponentQueueStopRef.current = true
          setTypingVisible(false)
          pendingAiRepliesRef.current = 0
          showComposerToast('已读不回：已暂停对方回复；发送消息或点「继续回复」可恢复')
          break
        case 'busy':
          manualAiPauseRef.current = true
          opponentQueueStopRef.current = true
          setTypingVisible(false)
          pendingAiRepliesRef.current = 0
          showComposerToast('忙碌：已暂停对方回复')
          break
        case 'retry_reply':
          setRetryReplyBiasDraft('')
          setRetryReplyPromptOpen(true)
          break
        case 'continue_reply':
          manualAiPauseRef.current = false
          opponentQueueStopRef.current = false
          pendingAiRepliesRef.current += 1
          void flushAiReplies()
          showComposerToast('已继续回复')
          break
        case 'console_logs':
          setStubPanel(null)
          setPlusMenuOpen(false)
          openConsole()
          showComposerToast('控制台已打开')
          logger.log('frontend', '点击加号菜单：控制台日志')
          break
        case 'check_phone':
          setStubPanel(null)
          setPlusMenuOpen(false)
          setCheckPhoneOpen(true)
          logger.log('frontend', '点击加号菜单：查手机（Spy Mode）')
          break
        default:
          break
      }
    },
    [
      conversationCharacterId,
      logger,
      onOpenLumiTransfer,
      onOpenSendRedPacket,
      openConsole,
      showComposerToast,
    ],
  )

  const onComposerKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== 'Enter' || e.shiftKey) return
      const ne = e.nativeEvent
      if (ne.isComposing) return
      e.preventDefault()
      if (sendBusy) return
      const text = draftRef.current.trim()
      // 空输入时：如果上一条是玩家消息，则回车直接触发“请求对方回复”（微信同款：不需要点纸飞机）
      if (!text) {
        if (!canNudgeAiReply) return
        manualAiPauseRef.current = false
        pendingAiRepliesRef.current += 1
        void flushAiReplies()
        refocusComposer()
        return
      }
      const now = Date.now()
      if (now - lastEnterDownRef.current <= ENTER_DOUBLE_TAP_WINDOW_MS) {
        if (enterDebounceTimerRef.current != null) {
          window.clearTimeout(enterDebounceTimerRef.current)
          enterDebounceTimerRef.current = null
        }
        lastEnterDownRef.current = 0
        commitSend(text, true)
        refocusComposer()
        return
      }
      lastEnterDownRef.current = now
      if (enterDebounceTimerRef.current != null) window.clearTimeout(enterDebounceTimerRef.current)
      enterDebounceTimerRef.current = window.setTimeout(() => {
        enterDebounceTimerRef.current = null
        lastEnterDownRef.current = 0
        const t = draftRef.current.trim()
        if (t) {
          commitSend(t, false)
          refocusComposer()
        }
      }, ENTER_SINGLE_COMMIT_DELAY_MS)
    },
    [canNudgeAiReply, commitSend, flushAiReplies, refocusComposer, sendBusy],
  )

  const sendStickerFromPicker = useCallback(
    async ({ url, description }: { url: string; description: string }) => {
      const src = url.trim()
      if (!src) return
      setStubPanel(null)
      try {
        const payload = await stickerUrlToImagePayload(src)
        const cap = description.trim() ? `[表情包] ${description.trim()}` : '[表情包]'
        // 与拍摄/相册图片一致：发出后不自动拉模型，由用户点纸飞机或空输入回车等方式触发回复
        commitSendImage(payload.base64, false, payload.mime, cap)
      } catch (e) {
        const err = e instanceof Error ? e.message : 'unknown'
        logger.log('error', `sticker send as image failed: ${err}`)
        showComposerToast('表情图片发送失败，已回退为文本消息')
        const prompt = `用户发送了一个表情包：[${src}] (描述：${description || '未填写'})`
        commitSend(prompt, false)
      }
    },
    [commitSend, commitSendImage, logger, showComposerToast],
  )

  const retrySend = useCallback(
    (id: string, text: string) => {
      setItems((prev) => rebuildWithCurrentTime(extractMessages(prev).filter((it) => it.id !== id)))
      commitSend(text, true)
    },
    [commitSend, extractMessages, rebuildWithCurrentTime],
  )

  const loadMoreHistory = useCallback(async () => {
    if (historyLoading) return
    const loadedMsgCount = itemsRef.current.reduce((n, it) => (it.kind === 'msg' ? n + 1 : n), 0)
    if (loadedMsgCount > visibleMsgLimit) {
      setVisibleMsgLimit((v) => v + CHAT_VISIBLE_MSG_STEP)
      return
    }
    if (historyExhaustedRef.current) return
    const beforeTs = oldestMsgTsRef.current
    if (beforeTs == null) return
    const root = scrollRef.current
    const prevHeight = root?.scrollHeight ?? 0
    const prevTop = root?.scrollTop ?? 0
    setHistoryLoading(true)
    try {
      const older = await personaDb.listWeChatChatMessagesRecent({
        conversationKey,
        limit: 50,
        beforeTimestamp: beforeTs,
      })
      if (older.length === 0) {
        historyExhaustedRef.current = true
        setHistoryExhausted(true)
        setHasOlderHistory(false)
        return
      }
      if (older.length < 50) {
        historyExhaustedRef.current = true
        setHistoryExhausted(true)
        setHasOlderHistory(false)
      } else {
        setHasOlderHistory(true)
      }
      oldestMsgTsRef.current = older[0]?.timestamp ?? oldestMsgTsRef.current
      const prepend: ChatMsg[] = []
      for (const m of older) {
        prepend.push({
          id: m.id,
          kind: 'msg',
          from: m.type === 'player' ? 'self' : 'other',
          text: m.content,
          thinking: m.thinking,
          timestamp: m.timestamp,
          replyTo: m.replyTo,
          images: m.images,
          redPacket: m.redPacket,
          transfer: m.transfer,
          callStatus: m.callStatus,
          voice: m.voice,
          originalText: m.originalContent,
          isRecalled: m.isRecalled,
          recallTimestamp: m.recallTimestamp,
          recalledBy: m.recalledBy === 'character' ? 'other' : m.recalledBy === 'player' ? 'self' : undefined,
          status: 'sent',
        })
      }
      setItems((prev) => {
        const next = rebuildWithCurrentTime([...prepend, ...extractMessages(prev)])
        itemsRef.current = next
        return next
      })
      setVisibleMsgLimit((v) => v + CHAT_VISIBLE_MSG_STEP)
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (!el) return
        const delta = el.scrollHeight - prevHeight
        if (delta > 0) el.scrollTop = prevTop + delta
      })
    } finally {
      setHistoryLoading(false)
    }
  }, [conversationKey, extractMessages, historyLoading, rebuildWithCurrentTime, visibleMsgLimit])

  const onScrollPane = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop > 40) userScrolledRef.current = true
    const atBottom = isScrollNearBottom(el)
    isAtBottomRef.current = atBottom
    setIsAtBottom(atBottom)
    if (atBottom) {
      userScrolledRef.current = false
      setPendingNewCount(0)
    }
  }, [])

  const sharedMsgProps: ChatMsgProps = useMemo(
    () => ({
      messageText: '',
      bubble,
      showAvatar,
      showBubbleTail,
      chatSelfAvatarUrl: playerAvatarUrl?.trim() || undefined,
      chatOtherAvatarUrl: peerAvatarResolved,
      onOtherAvatarClick: openHeartWhisperPanel,
    }),
    [bubble, showAvatar, showBubbleTail, playerAvatarUrl, peerAvatarResolved, openHeartWhisperPanel],
  )

  const MERGE_FORWARD_PREFIX = '__wx_merge_forward__:' as const
  const msgById = useMemo(() => {
    const map = new Map<string, ChatMsg>()
    for (const it of items) {
      if (it.kind === 'msg') map.set(it.id, it)
    }
    return map
  }, [items])

  const actionPanelTargetMsg = useMemo(() => {
    const id = actionMessageId?.trim()
    if (!id) return null
    return items.find((it): it is ChatMsg => it.kind === 'msg' && it.id === id) ?? null
  }, [actionMessageId, items])

  const wechatActionPanelIds = useMemo((): WeChatMessageActionId[] => {
    const withRecall: WeChatMessageActionId[] = [
      'copy',
      'forward',
      'favorite',
      'delete',
      'multiSelect',
      'quote',
      'translate',
      'edit',
      'recall',
    ]
    const base: WeChatMessageActionId[] = ['copy', 'forward', 'favorite', 'delete', 'multiSelect', 'quote', 'translate', 'edit']
    let next = actionMessageCanRecall ? [...withRecall] : [...base]
    if (actionPanelTargetMsg?.isRecalled) next = next.filter((x) => x !== 'quote')
    if (actionPanelTargetMsg?.voice) next = next.filter((x) => x !== 'copy')
    if (actionPanelTargetMsg?.voice && actionPanelTargetMsg.from === 'other') next = [...next, 'resynthesizeVoice']
    return next
  }, [actionMessageCanRecall, actionPanelTargetMsg?.from, actionPanelTargetMsg?.isRecalled, actionPanelTargetMsg?.voice])

  const redPacketModalIdRef = useRef<string | null>(null)
  useEffect(() => {
    redPacketModalIdRef.current = redPacketModalId
  }, [redPacketModalId])

  const redPacketModalSender = useMemo(() => {
    if (!redPacketModalId) return null
    const cm = msgById.get(redPacketModalId)
    const rp = cm?.redPacket
    if (!cm || !rp || rp.opened) return null
    const isSelfMsg = cm.from === 'self'
    // 规则：自发红包不可自领（群聊红包后续另做）
    if (isSelfMsg) return null
    return {
      remark: rp.remark,
      senderName: isSelfMsg ? (playerDisplayName.trim() || '我') : (peerNotifyTitle.trim() || '对方'),
      senderAvatarUrl: isSelfMsg ? playerAvatarUrl?.trim() || undefined : peerAvatarResolved,
    }
  }, [redPacketModalId, msgById, playerDisplayName, peerNotifyTitle, playerAvatarUrl, peerAvatarResolved])

  useEffect(() => {
    if (!redPacketModalId) return
    const cm = msgById.get(redPacketModalId)
    if (cm?.redPacket?.opened) setRedPacketModalId(null)
  }, [redPacketModalId, msgById])

  const [expandedThinkingIds, setExpandedThinkingIds] = useState<Set<string>>(() => new Set())
  const toggleThinkingFold = useCallback((id: string) => {
    setExpandedThinkingIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  useEffect(() => {
    setExpandedThinkingIds(new Set())
  }, [conversationKey])

  const totalMsgCount = useMemo(() => items.reduce((n, it) => (it.kind === 'msg' ? n + 1 : n), 0), [items])
  const visibleItems = useMemo(() => {
    const cap = Math.max(CHAT_VISIBLE_MSG_INITIAL, visibleMsgLimit)
    if (totalMsgCount <= cap) return items
    let msgSeen = 0
    let start = 0
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i]?.kind === 'msg') {
        msgSeen += 1
        if (msgSeen >= cap) {
          start = i
          break
        }
      }
    }
    while (start > 0 && items[start - 1]?.kind === 'time') start -= 1
    return items.slice(start)
  }, [items, totalMsgCount, visibleMsgLimit])
  const hasHiddenLoadedMessages = totalMsgCount > visibleMsgLimit
  const canLoadMoreAtTop = hasHiddenLoadedMessages || hasOlderHistory

  const messagesView = useMemo(() => {
    const resolveReplyPreview = (m: ChatMsg) => {
      const reply = m.replyTo
      if (!reply) return undefined
      const target = msgById.get(reply.messageId)
      const targetExists = !!target
      const recalled = target?.isRecalled === true
      return {
        senderName: reply.senderName || '未知',
        content: recalled ? '该消息已撤回' : reply.content || '...',
        deleted: !targetExists || recalled,
        recalled,
      }
    }
    const renderDetachedReply = (m: ChatMsg, isSelf: boolean) => {
      const reply = resolveReplyPreview(m)
      if (!reply) return null
      const inset = showAvatar ? 24 + 40 + 12 : 24
      const sideStyle = isSelf ? { marginRight: `${inset}px` } : { marginLeft: `${inset}px` }
      const textColor = '#8e8e8e'
      return (
        <div className={`mt-1 flex w-full max-w-full overflow-x-hidden ${isSelf ? 'justify-end' : 'justify-start'}`}>
          <button
            type="button"
            onClick={() => {
              const id = m.replyTo?.messageId?.trim()
              if (id) jumpToMessage(id)
            }}
            className="max-w-[calc(100%-24px-24px-80px)] rounded-[8px] px-1.5 py-1 text-left"
            style={{
              background: '#f5f5f5',
              ...(showAvatar ? sideStyle : {}),
            }}
          >
            <span className="flex items-start gap-2 px-1">
              <span
                className="mt-[1px] h-8 w-px shrink-0"
                style={{ background: '#d4d4d4' }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] italic" style={{ color: textColor }}>
                  {reply.senderName}：
                </span>
                <span
                  className="line-clamp-2 block text-[14px] italic leading-[1.35]"
                  style={{ color: textColor, opacity: reply.deleted ? 0.7 : 1 }}
                >
                  {reply.recalled ? '该消息已撤回' : reply.deleted ? '该消息已被删除' : reply.content}
                </span>
              </span>
            </span>
          </button>
        </div>
      )
    }
    const renderThinkingFold = (m: ChatMsg, isSelf: boolean, index: number) => {
      const text = m.thinking?.trim()
      if (!text || isSelf) return null
      const prev = index > 0 ? items[index - 1] : null
      if (
        prev &&
        prev.kind === 'msg' &&
        prev.from === 'other' &&
        (prev.thinking?.trim() || '') === text
      ) {
        return null
      }
      const expanded = expandedThinkingIds.has(m.id)
      const inset = showAvatar ? 24 + 40 + 12 : 24
      const sideStyle = isSelf ? { marginRight: `${inset}px` } : { marginLeft: `${inset}px` }
      return (
        <div className={`mb-1 flex w-full max-w-full overflow-x-hidden ${isSelf ? 'justify-end' : 'justify-start'}`}>
          <button
            type="button"
            onClick={() => toggleThinkingFold(m.id)}
            className="max-w-[calc(100%-24px-24px-80px)] rounded-[10px] border border-black/8 bg-black/[0.03] px-2.5 py-1.5 text-left"
            style={showAvatar ? sideStyle : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-[#666]">思维链</span>
              <ChevronDown
                className={`size-3.5 shrink-0 text-[#999] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            </div>
            {expanded ? (
              <p className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-[1.45] text-[#666]">{text}</p>
            ) : null}
          </button>
        </div>
      )
    }
    return visibleItems.map((m, i) => {
      const gap = messageBlockSpacing(visibleItems, i)
      const showAvatarColumnOther = !mergeAvatarGroup || !consecutiveSameSpeaker(visibleItems, i)
      const showAvatarColumnSelf = !mergeAvatarGroup || !consecutiveSameSpeaker(visibleItems, i)
      if (m.kind === 'time') {
        if (!showTimestamp) return null
        const parts = m.text.split(' ')
        const left = parts.slice(0, -1).join(' ')
        const time = parts.at(-1) ?? ''
        return (
          <div key={m.id} className={gap}>
            <div className="flex justify-center">
              <span
                className="rounded-full bg-[#f2f2f2] px-3 py-1 text-[12px]"
                style={{
                  color: '#999999',
                  lineHeight: 1.1,
                }}
              >
                {left ? <span style={{ fontFamily: 'var(--wx-font)' }}>{left}&nbsp;</span> : null}
                <span
                  style={{
                    fontFamily: 'var(--wx-num-font)',
                    fontVariantNumeric: 'tabular-nums lining-nums',
                    fontFeatureSettings: '"tnum" 1, "lnum" 1',
                    display: 'inline-block',
                  }}
                >
                  {time}
                </span>
              </span>
            </div>
          </div>
        )
      }

      const isSelf = m.from === 'self'
      if (m.isRecalled) {
        const noticeText = isSelf ? '你撤回了一条消息' : `${peerNotifyTitle.trim() || '对方'}撤回了一条消息`
        return (
          <div key={m.id} className={gap} data-wx-msg-id={m.id}>
            <RecallNotice
              text={noticeText}
              onClick={() => {
                setRecallModalRecord({
                  sender: isSelf ? 'self' : 'other',
                  senderName: peerNotifyTitle.trim() || '对方',
                  sentAt: m.timestamp,
                  recalledAt: m.recallTimestamp,
                  originalText: m.originalText || '（无内容）',
                })
                setRecallModalOpen(true)
              }}
            />
          </div>
        )
      }
      // 系统通知条：居中展示，像时间戳一样（用于“领取/退还/到期”等事件提示）
      if (typeof m.text === 'string' && m.text.trim().startsWith('【系统】')) {
        const raw = m.text.trim()
        const text = raw.replace(/^【系统】\s*/, '')
        return (
          <div key={m.id} className={gap}>
            <div className="flex justify-center">
              <span className="rounded-full bg-[#f2f2f2] px-3 py-1 text-[12px]" style={{ color: '#999999', lineHeight: 1.1 }}>
                {text}
              </span>
            </div>
          </div>
        )
      }
      const isSelected = isMultiSelectMode && selectedSet.has(m.id)
      const wrap = (node: ReactNode, replyNode?: ReactNode) => {
        const hi = highlightedMessageId === m.id
        const hiCls = hi ? 'rounded-[8px] bg-black/5 transition-colors duration-300' : ''
        const recallAnimCls = recallAnimatingIds.has(m.id) ? 'animate-[wxRecallShake_420ms_ease-in-out]' : ''
        const thinkingNode = m.kind === 'msg' ? renderThinkingFold(m, isSelf, i) : null
        if (!isMultiSelectMode) {
          return (
            <div key={m.id} className={`${gap} ${hiCls} ${recallAnimCls}`} data-wx-msg-id={m.id}>
              {thinkingNode}
              {node}
              {replyNode}
            </div>
          )
        }
        return (
          <div
            key={m.id}
            className={`${gap} ${hiCls} ${recallAnimCls}`}
            data-wx-msg-id={m.id}
            onClickCapture={(e) => {
              e.stopPropagation()
              toggleSelect(m.id)
            }}
          >
            <div className={`relative ${isSelf ? '' : 'pl-[44px]'}`}>
              {/* 统一对齐到页面左侧的勾选列 */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <MultiSelectCheck checked={isSelected} />
              </div>
              {thinkingNode}
              {node}
              {replyNode}
            </div>
          </div>
        )
      }

      // 合并转发卡片消息（自发）
      if (isSelf && typeof m.text === 'string' && m.text.startsWith(MERGE_FORWARD_PREFIX)) {
        let title = '聊天记录'
        let previewLines: string[] = []
        try {
          const raw = m.text.slice(MERGE_FORWARD_PREFIX.length)
          const parsed = JSON.parse(raw) as { title?: unknown; previewLines?: unknown }
          title = typeof parsed?.title === 'string' ? parsed.title : title
          previewLines = Array.isArray(parsed?.previewLines)
            ? parsed.previewLines.filter((x): x is string => typeof x === 'string').slice(0, 4)
            : []
        } catch {
          /* ignore */
        }
        const card = (
          <div className="flex w-full max-w-full shrink-0 items-end justify-end gap-[4px] overflow-x-hidden">
            <div className="mr-[24px] ml-auto min-w-0">
              <Pressable
                type="button"
                className="max-w-[calc(100%-24px-24px-80px)] rounded-[12px] border border-[#e5e5e5] bg-white px-3 py-2 text-left active:bg-[#f5f5f5]"
                onClick={() => showCenterToast('查看聊天记录（预留）')}
              >
                <div className="text-[15px] font-semibold text-black">{title}</div>
                <div className="mt-1 space-y-[2px] text-[12px] leading-snug text-[#666]">
                  {previewLines.length ? previewLines.map((ln, idx) => <div key={idx} className="truncate">{ln}</div>) : (
                    <div className="truncate">…</div>
                  )}
                </div>
              </Pressable>
            </div>
          </div>
        )
        return wrap(card)
      }

      if (m.voice) {
        const d = Math.max(1, Math.round(m.voice.durationSec || 1))
        const showAvatarVisual = showAvatar && (isSelf ? showAvatarColumnSelf : showAvatarColumnOther)
        const reserveAvatarGutter = showAvatar
        const avatarNode = (
          <img
            src={(isSelf ? sharedMsgProps.chatSelfAvatarUrl : sharedMsgProps.chatOtherAvatarUrl) || ''}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 object-cover"
            style={{
              borderRadius: `${bubble.avatarRadiusPx}px`,
              border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
            }}
            aria-hidden
          />
        )
        const avatarPlaceholder = <div className="h-10 w-10 shrink-0" aria-hidden />
        const bubbleNode = (
          <VoiceMessageBubble
            isUser={isSelf}
            duration={d}
            audioUrl={m.voice.audioUrl || ''}
            transcriptText={m.voice.transcriptText || '（暂未生成转写文本）'}
            onRequestAudio={isSelf ? undefined : () => ensureVoiceMessageAudio(m.id, m.voice)}
            onLongPress={
              isMultiSelectMode
                ? undefined
                : (rect) =>
                    openActionPanelFor({
                      id: m.id,
                      isSelf,
                      text: messagePlainPreview(m),
                      ts: m.timestamp,
                      anchorRect: rect,
                    })
            }
            onTranscriptToggle={() => {
              if (!isAtBottomRef.current) return
              requestAnimationFrame(() => {
                scrollToBottomSmooth({ force: true })
                window.setTimeout(() => {
                  scrollToBottomSmooth({ force: true })
                }, 240)
              })
            }}
          />
        )
        const voiceRow = (
          isSelf ? (
            <div className="flex w-full max-w-full shrink-0 items-end justify-end overflow-x-hidden">
              {!showAvatar ? (
                <div className="mr-[24px] ml-auto min-w-0">{bubbleNode}</div>
              ) : showAvatarVisual ? (
                <div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-[12px]">
                  {bubbleNode}
                  {sharedMsgProps.chatSelfAvatarUrl ? avatarNode : (
                    <div
                      className="h-10 w-10 shrink-0"
                      style={{ borderRadius: `${bubble.avatarRadiusPx}px`, background: 'rgba(0,0,0,0.04)' }}
                      aria-hidden
                    />
                  )}
                </div>
              ) : reserveAvatarGutter ? (
                <div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-[12px]">
                  {bubbleNode}
                  {avatarPlaceholder}
                </div>
              ) : (
                <div className="mr-[24px] ml-auto min-w-0">{bubbleNode}</div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-full shrink-0 overflow-x-hidden">
              {!showAvatar ? (
                <div className="ml-[24px] mr-auto min-w-0">{bubbleNode}</div>
              ) : showAvatarVisual ? (
                <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
                  {sharedMsgProps.chatOtherAvatarUrl ? avatarNode : (
                    <div
                      className="h-10 w-10 shrink-0"
                      style={{
                        borderRadius: `${bubble.avatarRadiusPx}px`,
                        background: 'rgba(0,0,0,0.06)',
                        border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
                      }}
                      aria-hidden
                    />
                  )}
                  {bubbleNode}
                </div>
              ) : reserveAvatarGutter ? (
                <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
                  {avatarPlaceholder}
                  {bubbleNode}
                </div>
              ) : (
                <div className="ml-[24px] mr-auto min-w-0">{bubbleNode}</div>
              )}
            </div>
          )
        )
        return wrap(voiceRow, renderDetachedReply(m, isSelf))
      }

      if (m.redPacket) {
        const rp = m.redPacket
        const rowInner = (
          <RedPacketChatRow
            id={m.id}
            isSelf={isSelf}
            data={{ remark: rp.remark, opened: rp.opened, amountYuan: rp.amountYuan }}
            bubble={bubble}
            showAvatar={showAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedMsgProps.chatOtherAvatarUrl}
            selected={actionPanelOpen && actionMessageId === m.id}
            onOpen={() => {
              if (rp.opened) {
                if (onNavigateRedPacketDetail) {
                  const senderName = isSelf
                    ? playerDisplayName.trim() || '我'
                    : peerNotifyTitle.trim() || '对方'
                  const senderAvatarUrl = isSelf
                    ? playerAvatarUrl?.trim() || undefined
                    : peerAvatarResolved
                  onNavigateRedPacketDetail({
                    messageId: m.id,
                    amountYuan: rp.amountYuan,
                    remark: rp.remark,
                    senderName,
                    senderAvatarUrl,
                    chatPeerName: peerNotifyTitle.trim() || '聊天',
                    fromSelf: isSelf,
                  })
                }
                return
              }
              // 规则：自发红包不可自领（群聊红包后续另做）
              if (isSelf) {
                showCenterToast('自己发起的红包只能由对方领取')
                return
              }
              setRedPacketModalId(m.id)
            }}
            onLongPress={
              isMultiSelectMode
                ? undefined
                : (rect) =>
                    openActionPanelFor({
                      id: m.id,
                      isSelf,
                      text: messagePlainPreview(m),
                      ts: m.timestamp,
                      anchorRect: rect,
                    })
            }
          />
        )
        const rowWrapped =
          !isSelf && m.otherAnimated ? (
            <ChatMessageEnter isSelf={false}>{rowInner}</ChatMessageEnter>
          ) : isSelf && m.selfAnimated ? (
            <ChatMessageEnter isSelf>{rowInner}</ChatMessageEnter>
          ) : (
            rowInner
          )
        return wrap(rowWrapped, renderDetachedReply(m, isSelf))
      }

      if (m.transfer) {
        const tid = m.transfer.transferId
        const rowInner = (
          <TransferChatRow
            id={m.id}
            isSelf={isSelf}
            transferId={tid}
            getCurrentTime={getCurrentTimeMs}
            bubble={bubble}
            showAvatar={showAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedMsgProps.chatOtherAvatarUrl}
            selected={actionPanelOpen && actionMessageId === m.id}
            onOpen={() => {
              if (onNavigateTransferDetail) onNavigateTransferDetail(tid)
            }}
            onLongPress={
              isMultiSelectMode
                ? undefined
                : (rect) =>
                    openActionPanelFor({
                      id: m.id,
                      isSelf,
                      text: messagePlainPreview(m),
                      ts: m.timestamp,
                      anchorRect: rect,
                    })
            }
          />
        )
        const rowWrapped =
          !isSelf && m.otherAnimated ? (
            <ChatMessageEnter isSelf={false}>{rowInner}</ChatMessageEnter>
          ) : isSelf && m.selfAnimated ? (
            <ChatMessageEnter isSelf>{rowInner}</ChatMessageEnter>
          ) : (
            rowInner
          )
        return wrap(rowWrapped, renderDetachedReply(m, isSelf))
      }

      if (m.callStatus) {
        const cs = m.callStatus
        const data =
          cs.status === 'duration'
            ? ({ status: 'duration', durationSec: cs.durationSec ?? 0 } as const)
            : cs.status === 'rejected'
              ? ({ status: 'rejected' } as const)
              : ({ status: 'no_answer' } as const)
        const bubbleText =
          data.status === 'duration'
            ? `通话时长 ${String(Math.floor(data.durationSec / 60)).padStart(2, '0')}:${String(data.durationSec % 60).padStart(2, '0')}`
            : data.status === 'rejected'
              ? '已拒接'
              : '对方未应答'
        const rowInner = (
          <WeChatMessageBubbleRow
            messageText={bubbleText}
            messagePrefixIcon={<PhoneCall className="size-[14px]" strokeWidth={1.9} aria-hidden />}
            isSelf={isSelf}
            bubble={bubble}
            showAvatar={showAvatar}
            showBubbleTail={showBubbleTail}
            variant="chat"
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedMsgProps.chatOtherAvatarUrl}
          />
        )
        const rowWrapped =
          !isSelf && m.otherAnimated ? (
            <ChatMessageEnter isSelf={false}>{rowInner}</ChatMessageEnter>
          ) : isSelf && m.selfAnimated ? (
            <ChatMessageEnter isSelf>{rowInner}</ChatMessageEnter>
          ) : (
            rowInner
          )
        return wrap(rowWrapped, renderDetachedReply(m, isSelf))
      }

      const image = m.images?.[0]
      const img = image?.base64?.trim()
      if (img) {
        // 关键调试：若 base64 以 data: 开头，说明上游没剥离前缀，会导致 dataURL 拼接错误
        if (img.startsWith('data:')) {
          logger.log('error', `渲染图片消息：base64 竟然包含 dataURL 前缀，len=${img.length}`)
        }
        const src = `data:${image?.type ?? 'image/jpeg'};base64,${img}`
        const isSticker = typeof m.text === 'string' && m.text.trim().startsWith('[表情包]')
        return wrap(
              <WeChatChatImageBubbleRow
              id={m.id}
              isSelf={isSelf}
              src={src}
              isSticker={isSticker}
              bubble={bubble}
              showAvatar={showAvatar}
              showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
              chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
              chatOtherAvatarUrl={sharedMsgProps.chatOtherAvatarUrl}
              onOtherAvatarClick={sharedMsgProps.onOtherAvatarClick}
              selected={actionPanelOpen && actionMessageId === m.id}
              onLongPress={
                isMultiSelectMode
                  ? undefined
                  : (rect) =>
                      openActionPanelFor({
                        id: m.id,
                        isSelf,
                        text: messagePlainPreview(m),
                        ts: m.timestamp,
                        anchorRect: rect,
                      })
              }
            />
          ,
          renderDetachedReply(m, isSelf),
        )
      }
      if (!isSelf) {
        if (m.otherAnimated) {
          return wrap(
            <OtherMessageEnter
                {...sharedMsgProps}
                messageText={m.text}
                showAvatarColumn={showAvatarColumnOther}
                bubbleSelected={actionPanelOpen && actionMessageId === m.id}
                onBubbleLongPress={
                  isMultiSelectMode
                    ? undefined
                    : (rect) => openActionPanelFor({ id: m.id, isSelf: false, text: messagePlainPreview(m), ts: m.timestamp, anchorRect: rect })
                }
              />,
            renderDetachedReply(m, false),
          )
        }
        return wrap(
          <WeChatMessageBubbleRow
              messageText={m.text}
              isSelf={false}
              bubble={bubble}
              showAvatar={showAvatar}
              showBubbleTail={showBubbleTail}
              variant="chat"
              avatarTapMotion
              showAvatarColumn={showAvatarColumnOther}
              chatOtherAvatarUrl={sharedMsgProps.chatOtherAvatarUrl}
              onOtherAvatarClick={sharedMsgProps.onOtherAvatarClick}
              bubbleSelected={actionPanelOpen && actionMessageId === m.id}
              onBubbleLongPress={
                isMultiSelectMode
                  ? undefined
                  : (rect) => openActionPanelFor({ id: m.id, isSelf: false, text: messagePlainPreview(m), ts: m.timestamp, anchorRect: rect })
              }
            />,
          renderDetachedReply(m, false),
        )
      }

      const st = m.status ?? 'sent'
      return wrap(
        m.selfAnimated ? (
          <SelfMessageEnter
              messageText={m.text}
              bubble={bubble}
              showAvatar={showAvatar}
              showBubbleTail={showBubbleTail}
              showAvatarColumn={showAvatarColumnSelf}
              chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
              chatAccessory={st === 'failed' ? <FailRetryIcon onClick={() => retrySend(m.id, m.text)} /> : undefined}
              chatBubbleOverlay={st === 'sending' ? <span className="wx-chat-sending-dot" aria-hidden /> : undefined}
              bubbleSelected={actionPanelOpen && actionMessageId === m.id}
              onBubbleLongPress={
                isMultiSelectMode
                  ? undefined
                  : (rect) => openActionPanelFor({ id: m.id, isSelf: true, text: messagePlainPreview(m), ts: m.timestamp, anchorRect: rect })
              }
            />
        ) : (
          <WeChatMessageBubbleRow
              messageText={m.text}
              isSelf
              bubble={bubble}
              showAvatar={showAvatar}
              showBubbleTail={showBubbleTail}
              variant="chat"
              showAvatarColumn={showAvatarColumnSelf}
              chatAccessory={st === 'failed' ? <FailRetryIcon onClick={() => retrySend(m.id, m.text)} /> : undefined}
              chatBubbleOverlay={st === 'sending' ? <span className="wx-chat-sending-dot" aria-hidden /> : undefined}
              chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
              bubbleSelected={actionPanelOpen && actionMessageId === m.id}
              onBubbleLongPress={
                isMultiSelectMode
                  ? undefined
                  : (rect) => openActionPanelFor({ id: m.id, isSelf: true, text: messagePlainPreview(m), ts: m.timestamp, anchorRect: rect })
              }
            />
        ),
        renderDetachedReply(m, true),
      )
    })
  }, [
    bubble,
    visibleItems,
    mergeAvatarGroup,
    retrySend,
    sharedMsgProps,
    showAvatar,
    showBubbleTail,
    showTimestamp,
    logger,
    isMultiSelectMode,
    selectedSet,
    toggleSelect,
    actionPanelOpen,
    actionMessageId,
    highlightedMessageId,
    msgById,
    jumpToMessage,
    openActionPanelFor,
    showCenterToast,
    onNavigateRedPacketDetail,
    playerDisplayName,
    peerNotifyTitle,
    playerAvatarUrl,
    peerAvatarResolved,
    setRedPacketModalId,
    onNavigateTransferDetail,
    getCurrentTimeMs,
    expandedThinkingIds,
    toggleThinkingFold,
    recallAnimatingIds,
    ensureVoiceMessageAudio,
    items,
    scrollToBottomSmooth,
  ])

  const btnPx = chatTheme.inputBar.buttonSize
  const btnColor = chatTheme.inputBar.buttonColor

  useEffect(() => {
    return () => {
      if (enterDebounceTimerRef.current != null) window.clearTimeout(enterDebounceTimerRef.current)
      if (voiceHoldTimerRef.current != null) window.clearTimeout(voiceHoldTimerRef.current)
      if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
        voiceRecorderRef.current.stop()
      }
      if (voiceStreamRef.current) {
        voiceStreamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  useLayoutEffect(() => {
    const ta = textareaRef.current
    if (!ta || inputMode !== 'text') return
    ta.style.height = '0px'
    const next = Math.min(120, Math.max(44, ta.scrollHeight))
    ta.style.height = `${next}px`
  }, [draft, inputMode])

  const bgUrl = chatBackgroundUrl?.trim()

  const showDmOverlay = danmakuEnabled && !(effectiveDm?.skipCharacter)
  const dmZoneStyle = useMemo((): CSSProperties => {
    const p = effectiveDm?.position ?? 'top'
    if (p === 'middle') return { top: '28%', height: '30%' }
    if (p === 'bottom') return { top: '54%', height: '30%' }
    if (p === 'random') return { top: '6%', height: '58%' }
    return { top: '3%', height: '26%' }
  }, [effectiveDm?.position])

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col" data-wx-chat-motion-scope>
      <style>{`@keyframes wxRecallShake { 0% { transform: translateX(0); opacity: 1; } 25% { transform: translateX(-2px); } 50% { transform: translateX(2px); } 75% { transform: translateX(-1px); } 100% { transform: translateX(0); opacity: 0.75; } }`}</style>
      {showDmOverlay ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-0 z-[60]">
          <DanmakuOverlay bullets={dmBullets} zoneStyle={dmZoneStyle} />
        </div>
      ) : null}
      <div
        ref={scrollRef}
        onScroll={onScrollPane}
        className="relative min-h-0 w-full max-w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain py-4 pl-0 pr-0 [-webkit-overflow-scrolling:touch]"
        style={{
          // 给消息列表留出“键盘上移后的输入栏”空间，避免最后几条被挡住
          paddingBottom: 12 + (isMultiSelectMode ? 86 : composerInsetPx),
          scrollBehavior: 'smooth',
          ...(bgUrl
            ? {
                backgroundImage: `url(${bgUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'scroll',
              }
            : {}),
        }}
      >
        {/* 多选模式不在顶部显示“已选中” */}
        <div ref={topSentinelRef} className="h-px w-full shrink-0 bg-transparent opacity-0" aria-hidden />
        {canLoadMoreAtTop ? (
          <div className="flex justify-center pb-2 pt-1">
            <button
              type="button"
              className="rounded-full border border-[#dcdcdc] bg-white px-3 py-1 text-[12px] text-[#666] active:bg-[#f5f5f5] disabled:opacity-60"
              disabled={historyLoading}
              onClick={() => void loadMoreHistory()}
            >
              {historyLoading ? '加载中...' : '加载更多聊天记录'}
            </button>
          </div>
        ) : null}
        {historyLoading ? (
          <div className="wx-chat-history-dots" aria-live="polite">
            <span className="wx-chat-history-dot" />
            <span className="wx-chat-history-dot" />
            <span className="wx-chat-history-dot" />
          </div>
        ) : null}
        <div className="flex w-full max-w-full flex-col">{messagesView}</div>
      </div>

      {isMultiSelectMode ? (
        <div
          className="relative z-10 w-full max-w-full shrink-0 border-t border-[#e5e5e5] bg-white"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-center justify-between px-4 py-2">
            <div className="text-[12px] text-[#8e8e8e]">已选中 {selectedMessageIds.length} 条</div>
            <Pressable
              type="button"
              className="rounded-[10px] px-2 py-1 text-[13px] text-black active:bg-[#f5f5f5]"
              onClick={exitMultiSelect}
            >
              取消
            </Pressable>
          </div>
          <div className="flex h-[50px] items-center justify-around px-6">
            {(() => {
              const enabled = selectedMessageIds.length > 0
              const color = enabled ? '#000000' : '#8e8e8e'
              return (
                <>
                  <Pressable
                    type="button"
                    disabled={!enabled}
                    className="text-[15px] disabled:opacity-100"
                    style={{ color }}
                    onClick={() => setMultiDeleteConfirmOpen(true)}
                  >
                    删除
                  </Pressable>
                  <Pressable
                    type="button"
                    disabled={!enabled}
                    className="text-[15px] disabled:opacity-100"
                    style={{ color }}
                    onClick={() => {
                      void (async () => {
                        const ids = [...selectedMessageIds]
                        let ok = 0
                        for (const id of ids) {
                          const msg = await personaDb.getWeChatChatMessageById(id)
                          if (!msg) continue
                          await personaDb.addFavoriteFromWeChatMessage(msg)
                          await personaDb.setWeChatChatMessageFavorite(id, true)
                          ok += 1
                        }
                        if (ok > 0) showCenterToast(`已收藏${ok}条消息`)
                      })()
                    }}
                  >
                    收藏
                  </Pressable>
                  <Pressable
                    type="button"
                    disabled={!enabled}
                    className="text-[15px] font-medium disabled:opacity-100"
                    style={{ color: enabled ? '#000000' : '#8e8e8e' }}
                    onClick={() => setForwardModeSheetOpen(true)}
                  >
                    转发
                  </Pressable>
                </>
              )
            })()}
          </div>
        </div>
      ) : (
        <>
          {pendingNewCount > 0 ? (
            <div
              className="pointer-events-none absolute inset-x-0 z-20 flex justify-center"
              style={{ bottom: `calc(${70 + composerInsetPx}px + env(safe-area-inset-bottom, 0px))` }}
            >
              <Pressable
                type="button"
                aria-label="查看新消息并滚动到底部"
                onClick={jumpToBottom}
                className="pointer-events-auto flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-[12px] text-[#6b7280] shadow-sm active:bg-[#f5f5f5]"
              >
                <span>新消息{pendingNewCount}条</span>
                <ChevronDown size={14} color="#6b7280" aria-hidden />
              </Pressable>
            </div>
          ) : null}
          <div
            className="relative z-10 w-full max-w-full shrink-0 border-t"
            style={{
              backgroundColor: chatTheme.inputBar.backgroundColor,
              borderTopColor: '#e5e5e5',
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 12,
              paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
              transform: composerInsetPx > 0 ? `translate3d(0, -${composerInsetPx}px, 0)` : undefined,
              transition: 'transform 220ms ease-out',
              willChange: composerInsetPx > 0 ? 'transform' : undefined,
            }}
          >
        {composerToast ? (
          <div className="mb-2 rounded-[10px] bg-neutral-900 px-3 py-2 text-center text-[12px] leading-snug text-white">
            {composerToast}
          </div>
        ) : null}
        {replyingTo ? (
          <div
            className="mb-2 h-11 border-b border-[#ececec] bg-[#f5f5f5]"
            aria-label="引用预览"
          >
            <div className="flex h-full items-center pl-4 pr-2">
              <span className="mr-3 h-6 w-px shrink-0 bg-black" aria-hidden />
              <div className="min-w-0 flex-1 text-[#6b7280]">
                <div className="truncate text-[14px] leading-[1.2]">{replyingTo.senderName}：</div>
                <div className="truncate text-[14px] leading-[1.2]">{replyingTo.content || '...'}</div>
              </div>
              <Pressable
                type="button"
                aria-label="取消引用"
                className="ml-2 flex h-6 w-6 items-center justify-center rounded-[8px] active:bg-black/5"
                onClick={() => setReplyingTo(null)}
              >
                <X size={16} color="#8e8e8e" aria-hidden />
              </Pressable>
            </div>
          </div>
        ) : null}
        {editing ? (
          <div
            className="mb-2 flex items-center justify-between gap-2 rounded-[12px] border border-[#e5e5e5] bg-white px-3 py-2"
            aria-label="编辑状态"
          >
            <div className="min-w-0 flex-1 truncate text-[12px] text-[#111]">编辑中（预留）：{editing.original}</div>
            <Pressable
              type="button"
              aria-label="取消编辑"
              className="flex h-6 w-6 items-center justify-center rounded-[8px] active:bg-[#f5f5f5]"
              onClick={() => {
                setEditing(null)
                setDraft('')
              }}
            >
              <X size={16} color="#000000" aria-hidden />
            </Pressable>
          </div>
        ) : null}
        {keyboardDebugEnabled ? (
          <div className="mb-2 rounded-[10px] border border-[#d9d9d9] bg-[#fafafa] px-2 py-2 text-[12px] text-[#333]">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span>键盘抬升补偿调试</span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-[#666]">补偿：{keyboardDebugInsetPx >= 0 ? '+' : ''}{keyboardDebugInsetPx}px</span>
                <Pressable
                  type="button"
                  aria-label="关闭键盘调试盘"
                  className="flex h-6 w-6 items-center justify-center rounded-[8px] border border-[#e5e5e5] bg-white text-[#666] active:bg-[#f3f3f3]"
                  onClick={() => setUi({ keyboardDebugEnabled: false })}
                >
                  <X size={14} aria-hidden />
                </Pressable>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={-220}
                max={220}
                step={1}
                value={keyboardDebugInsetPx}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  setUi({ keyboardDebugInsetPx: Number.isFinite(n) ? Math.max(-220, Math.min(220, Math.round(n))) : 0 })
                }}
                className="h-8 w-24 rounded-[8px] border border-[#ddd] bg-white px-2 text-[12px] outline-none"
                aria-label="键盘抬升补偿（像素）"
              />
              <input
                type="range"
                min={-220}
                max={220}
                step={1}
                value={keyboardDebugInsetPx}
                onChange={(e) => setUi({ keyboardDebugInsetPx: Number(e.target.value) })}
                className="min-w-0 flex-1"
                aria-label="键盘抬升补偿滑杆"
              />
              <Pressable
                type="button"
                onClick={() => setUi({ keyboardDebugInsetPx: 0 })}
                className="h-8 rounded-[8px] border border-[#ddd] bg-white px-3 text-[12px] text-[#333]"
              >
                归零
              </Pressable>
            </div>
          </div>
        ) : null}
        <ChatInputBar
          inputMode={inputMode}
          btnPx={btnPx}
          btnColor={btnColor}
          borderRadius={chatTheme.inputBar.borderRadius}
          borderColor={chatTheme.inputBar.borderColor}
          draft={draft}
          sendBusy={sendBusy}
          planeCanAct={planeCanAct}
          plusMenuOpen={plusMenuOpen}
          onToggleInputMode={() => {
            setInputMode((m) => (m === 'text' ? 'voice' : 'text'))
            setStubPanel(null)
            setPlusMenuOpen(false)
          }}
          textareaRef={textareaRef}
          onVoicePointerDown={onVoicePointerDown}
          onVoicePointerMove={onVoicePointerMove}
          onVoicePointerUp={onVoicePointerUp}
          onDraftChange={(v) => setDraft(v)}
          onComposerKeyDown={onComposerKeyDown}
          onToggleEmoji={() => {
            setPlusMenuOpen(false)
            setStubPanel((p) => (p === 'emoji' ? null : 'emoji'))
          }}
          onTogglePlus={() => {
            setStubPanel(null)
            setCameraOpen(false)
            setPlusMenuOpen((v) => !v)
          }}
          onSend={onSendButtonClick}
        />

        {stubPanel ? (
          <StickerPickerPanel
            onPick={({ url, description }) => {
              void sendStickerFromPicker({ url, description })
            }}
          />
        ) : null}

        <motion.div
          initial={false}
          animate={{ height: plusMenuOpen ? PLUS_MENU_HEIGHT_PX : 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className={`w-full max-w-full min-w-0 overflow-hidden bg-white ${plusMenuOpen ? '' : 'pointer-events-none'}`}
        >
          <div className="w-full max-w-full min-w-0" style={{ height: PLUS_MENU_HEIGHT_PX }}>
            <WeChatChatPlusMenuPanel onAction={handlePlusAction} />
          </div>
        </motion.div>
      </div>
        </>
      )}

      <AnimatePresence>
        {voiceOverlayOpen ? (
          <VoiceOverlay
            open={voiceOverlayOpen}
            activeZone={voiceGestureZone}
            durationSec={Math.max(1, Math.round((Date.now() - (voiceSessionStartMs ?? Date.now())) / 1000))}
            thumbOrigin={voiceThumbOrigin}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {mockVoiceInputOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[125] bg-black/20"
            onClick={() => setMockVoiceInputOpen(false)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0.7 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="absolute inset-x-3 bottom-3 rounded-[20px] border border-[#ece7da] bg-[#fffdfa] p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[13px] leading-relaxed text-[#555]">
                当前未配置语音 API，请直接输入您的台词，并可使用括号标注语气（例如：*(温柔地) 你好*）
              </div>
              <textarea
                className="mt-3 min-h-[96px] w-full resize-none rounded-[12px] border border-[#e9e4d8] bg-white px-3 py-2 text-[14px] outline-none"
                placeholder="请输入要发送的文本..."
                value={mockVoiceInputDraft}
                onChange={(e) => setMockVoiceInputDraft(e.target.value)}
              />
              <div className="mt-3 flex justify-end gap-2">
                <Pressable
                  className="rounded-[10px] border border-[#e5e5e5] bg-white px-3 py-1.5 text-[13px]"
                  onClick={() => setMockVoiceInputOpen(false)}
                >
                  取消
                </Pressable>
                <Pressable
                  className="rounded-[10px] bg-[#f4efe3] px-3 py-1.5 text-[13px] text-[#2f2f2f]"
                  onClick={() => {
                    const text = mockVoiceInputDraft.trim()
                    if (!text) return
                    commitSend(text, true)
                    setMockVoiceInputDraft('')
                    setMockVoiceInputOpen(false)
                  }}
                >
                  发送文本
                </Pressable>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {cameraOpen ? (
          <WeChatChatCameraScreen
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onToast={showComposerToast}
            onSend={({ base64, mime }) => {
              setCameraOpen(false)
              // 微信一致：拍摄/相册发送只是“发出去”，不自动触发对方回复；
              // 用户需要点纸飞机（空输入）或双击回车等方式再触发模型回复。
              commitSendImage(base64, false, mime)
            }}
          />
        ) : null}
      </AnimatePresence>

      <VoiceCallActionSheet
        open={callSheetOpen}
        onClose={() => setCallSheetOpen(false)}
        onChooseVoice={() => {
          setActiveCallInitiator('self')
          setIncomingCallOpeningLine('')
          setOutgoingCallOpeningLine('')
          setCallingOpen(true)
        }}
      />
      <CallingScreen
        open={callingOpen}
        peerRemarkName={peerNotifyTitle.trim() || '对方'}
        peerAvatarUrl={peerAvatarResolved}
        backgroundImage={undefined}
        onCancel={() => {
          setCallingOpen(false)
          setActiveCallInitiator(null)
          setIncomingCallOpeningLine('')
          setOutgoingCallOpeningLine('')
        }}
        onDecision={(d) => {
          setCallingOpen(false)
          if (d === 'ACCEPT') {
            setVoiceCallOpen(true)
            return
          }
          if (d === 'REJECT') {
            const initiator = activeCallInitiator ?? 'self'
            void (async () => {
              await appendCallStatusBubble({ status: 'rejected' }, initiator)
              // 角色拒接用户来电后，必须走模型追加一条“普通消息”解释原因（不可本地硬编码文案）。
              if (initiator === 'self') {
                retryReplyBiasRef.current = [
                  '[系统提示] 你刚刚拒接了用户来电。',
                  '- 现在请继续按普通线上聊天机制自然回复，解释拒接原因（例如正在忙/不方便接听/情绪上不想接）。',
                  '- 必须保持人设和当前关系状态；如果双方在闹矛盾，可直接带情绪表达不想接电话。',
                  '- 禁止输出协议标签或 JSON，按正常微信聊天口吻分行回复。',
                ].join('\n')
                pendingAiRepliesRef.current += 1
                void flushAiReplies()
              }
            })()
            setActiveCallInitiator(null)
            setIncomingCallOpeningLine('')
            setOutgoingCallOpeningLine('')
            return
          }
          void appendCallStatusBubble({ status: 'no_answer' }, activeCallInitiator ?? 'self')
          setActiveCallInitiator(null)
          setIncomingCallOpeningLine('')
          setOutgoingCallOpeningLine('')
        }}
        requestDecision={async () => {
          let character: Character | null = null
          let worldBackgroundPrompt: string | undefined
          const pcid = personaCharacterId?.trim()
          const lumiAssistantChat = useLumiProjectAssistantPrompt
          if (!lumiAssistantChat && pcid) {
            try {
              character = await personaDb.getCharacter(pcid)
              if (character?.worldBackgroundEnabled !== false && character?.worldBackgroundId?.trim()) {
                const wbg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
                const block = formatWorldBackgroundForPrompt(wbg)
                if (block.trim()) worldBackgroundPrompt = block
              }
            } catch {
              character = null
            }
          }

          let playerIdentity: PlayerIdentity | null = null
          const piid = playerIdentityId.trim()
          if (!lumiAssistantChat && piid && piid !== '__none__') {
            try {
              playerIdentity = await personaDb.getPlayerIdentity(piid)
            } catch {
              playerIdentity = null
            }
          }

          const peerName = playerDisplayName.trim() || state.profile.displayName.trim() || '朋友'
          const promptMode = lumiAssistantChat ? 'lumi-assistant' : 'persona'
          const offlineDatingPlotsContext =
            promptMode === 'persona' && pcid
              ? await loadOfflineDatingPlotsPromptBlock(pcid, character?.name ?? null)
              : ''
          const transcript = itemsToTranscript(itemsRef.current)
          const res = await requestWeChatVoiceCallDecision({
            apiConfig,
            character,
            playerIdentity,
            playerDisplayName: peerName,
            transcript,
            promptMode,
            longTermMemoryNotes: memoryNotesForPrompt.trim() || undefined,
            worldBackgroundPrompt,
            offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
            currentTimeMs: getCurrentTimeMs(),
          })
          if (res.decision === 'ACCEPT') {
            const opening = String(res.opening ?? '').trim()
            setOutgoingCallOpeningLine(opening)
          }
          return res.decision
        }}
      />
      <IncomingCallScreen
        open={incomingCallOpen}
        peerRemarkName={peerNotifyTitle.trim() || '对方'}
        peerAvatarUrl={peerAvatarResolved}
        backgroundImage={undefined}
        onReject={() => {
          if (incomingRejectLockRef.current) return
          incomingRejectLockRef.current = true
          setIncomingCallOpen(false)
          void appendCallStatusBubble({ status: 'rejected' }, activeCallInitiator ?? 'other')
          setActiveCallInitiator(null)
          setIncomingCallOpeningLine('')
          setOutgoingCallOpeningLine('')
        }}
        onAccept={() => {
          incomingRejectLockRef.current = false
          setIncomingCallOpen(false)
          setVoiceCallOpen(true)
        }}
      />
      <VoiceCallPanelCompat
        open={voiceCallOpen}
        peerRemarkName={peerNotifyTitle.trim() || '对方'}
        peerAvatarUrl={peerAvatarResolved}
        // 预留：从“我的 -> 设置 -> 通话背景”读取并传入
        backgroundImage={undefined}
        initialAiText={
          activeCallInitiator === 'other'
            ? incomingCallOpeningLine
            : activeCallInitiator === 'self'
              ? outgoingCallOpeningLine
              : ''
        }
        onClose={() => {
          setVoiceCallOpen(false)
          setActiveCallInitiator(null)
          setIncomingCallOpeningLine('')
          setOutgoingCallOpeningLine('')
        }}
        onHangup={(durationSec) => {
          void appendCallStatusBubble({ status: 'duration', durationSec }, activeCallInitiator ?? 'self')
          setActiveCallInitiator(null)
          setIncomingCallOpeningLine('')
          setOutgoingCallOpeningLine('')
        }}
        onRequestAiReply={async (text, opts) => {
          let character: Character | null = null
          let worldBackgroundPrompt: string | undefined
          const pcid = personaCharacterId?.trim()
          const lumiAssistantChat = useLumiProjectAssistantPrompt
          if (!lumiAssistantChat && pcid) {
            try {
              character = await personaDb.getCharacter(pcid)
              if (character?.worldBackgroundEnabled !== false && character?.worldBackgroundId?.trim()) {
                const wbg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
                const block = formatWorldBackgroundForPrompt(wbg)
                if (block.trim()) worldBackgroundPrompt = block
              }
            } catch {
              character = null
            }
          }

          let playerIdentity: PlayerIdentity | null = null
          const piid = playerIdentityId.trim()
          if (!lumiAssistantChat && piid && piid !== '__none__') {
            try {
              playerIdentity = await personaDb.getPlayerIdentity(piid)
            } catch {
              playerIdentity = null
            }
          }

          const peerName = playerDisplayName.trim() || state.profile.displayName.trim() || '朋友'
          const promptMode = lumiAssistantChat ? 'lumi-assistant' : 'persona'
          const offlineDatingPlotsContext =
            promptMode === 'persona' && pcid
              ? await loadOfflineDatingPlotsPromptBlock(pcid, character?.name ?? null)
              : ''

          const transcript: ChatTranscriptTurn[] = [
            ...itemsToTranscript(itemsRef.current),
            {
              from: 'self',
              text:
                opts?.fromVoice && opts.voiceEmotion
                  ? `（这是一条用户语音转写；识别到的情绪倾向：${opts.voiceEmotion}。请先按该情绪理解用户状态，再给出有情绪承接的回复。）\n${text}`
                  : text,
            },
          ]
          return await requestWeChatVoiceCallReplyText({
            apiConfig,
            character,
            playerIdentity,
            playerDisplayName: peerName,
            transcript,
            promptMode,
            longTermMemoryNotes: memoryNotesForPrompt.trim() || undefined,
            worldBackgroundPrompt,
            offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
            currentTimeMs: getCurrentTimeMs(),
          })
        }}
        onTranscribeAudio={async (audioBlob) => {
          if (!voiceAsrEnabled) {
            throw new Error('语音识别已关闭，无法使用')
          }
          const cfg = voiceAsrApiConfig
          if (!cfg?.apiKey?.trim()) {
            throw new Error('未配置语音识别api，无法使用')
          }
          return await requestSiliconflowTranscription(cfg, audioBlob)
        }}
      />

      <HeartWhisperModal
        open={heartWhisperOpen}
        loading={heartWhisperLoading}
        data={heartWhisperData}
        onClose={() => setHeartWhisperOpen(false)}
        onGenerate={() => void generateHeartWhisper()}
      />

      {redPacketModalSender ? (
        <RedPacketModal
          key={redPacketModalId ?? 'rp'}
          open
          remark={redPacketModalSender.remark}
          senderName={redPacketModalSender.senderName}
          senderAvatarUrl={redPacketModalSender.senderAvatarUrl}
          onClose={() => setRedPacketModalId(null)}
          onFlowComplete={async () => {
            const id = redPacketModalIdRef.current
            if (!id) return
            const fromDb = await personaDb.getWeChatChatMessageById(id)
            const cur = fromDb?.redPacket
            const rp = fromDb?.redPacket ?? cur
            if (cur) {
              await personaDb.patchWeChatChatMessageById(id, { redPacket: { ...cur, opened: true } })
            }
            // 系统通知条：你领取了XX的红包（XX=对方微信备注）
            void appendSystemNote(`【系统】你领取了${peerNotifyTitle.trim() || '对方'}的红包`)
            if (rp?.amountYuan && Number.isFinite(rp.amountYuan) && rp.amountYuan > 0) {
              walletAdjustBalance(rp.amountYuan)
              walletAddTransaction({
                type: 'topup',
                title: `收到${peerNotifyTitle.trim() || '对方'}的红包`,
                amount: rp.amountYuan,
              })
            }
            setItems((prev) =>
              rebuildWithCurrentTime(
                extractMessages(prev).map((it) => {
                  if (it.id !== id || !it.redPacket) return it
                  return { ...it, redPacket: { ...it.redPacket, opened: true } }
                }),
              ),
            )
            setRedPacketModalId(null)
            if (!rp || !onNavigateRedPacketDetail) return
            const isSelfMsg = fromDb?.type === 'player'
            onNavigateRedPacketDetail({
              messageId: id,
              amountYuan: rp.amountYuan,
              remark: rp.remark,
              senderName: isSelfMsg ? playerDisplayName.trim() || '我' : peerNotifyTitle.trim() || '对方',
              senderAvatarUrl: isSelfMsg ? playerAvatarUrl?.trim() || undefined : peerAvatarResolved,
              chatPeerName: peerNotifyTitle.trim() || '聊天',
              fromSelf: isSelfMsg,
            })
          }}
        />
      ) : null}

      <WeChatMessageActionPanel
        open={actionPanelOpen}
        anchor={actionAnchor}
        onAction={onActionPanelAction}
        actionIds={wechatActionPanelIds}
      />
      {retryReplyPromptOpen ? (
        <div className="fixed inset-0 z-[1210] flex items-center justify-center bg-black/50 px-4" role="presentation">
          <div className="w-full max-w-[360px] overflow-hidden rounded-[16px] bg-white shadow-lg">
            <div className="px-5 pb-4 pt-5">
              <h2 className="text-center text-[16px] font-semibold text-[#111]">重新回复偏向</h2>
              <p className="mt-2 text-center text-[13px] leading-relaxed text-[#666]">
                填写你希望角色本轮偏向的方向（选填），将撤销当轮角色回复并重生一轮。
              </p>
              <textarea
                value={retryReplyBiasDraft}
                onChange={(e) => setRetryReplyBiasDraft(e.target.value.slice(0, 240))}
                placeholder="例如：先安抚我的情绪，再解释；语气更温柔一点"
                className="mt-3 h-[96px] w-full resize-none rounded-[12px] border border-[#e5e5e5] px-3 py-2 text-[14px] leading-relaxed text-black outline-none placeholder:text-[#9a9a9a] focus:border-[#cfcfcf]"
              />
            </div>
            <div className="grid grid-cols-2 border-t border-[#e5e5e5]">
              <Pressable
                type="button"
                className="h-[48px] text-[15px] text-[#111] active:bg-[#f5f5f5]"
                onClick={() => {
                  setRetryReplyPromptOpen(false)
                  setRetryReplyBiasDraft('')
                }}
              >
                取消
              </Pressable>
              <Pressable
                type="button"
                className="h-[48px] border-l border-[#e5e5e5] text-[15px] text-[#111] active:bg-[#f5f5f5]"
                onClick={() => {
                  const bias = retryReplyBiasDraft
                  setRetryReplyPromptOpen(false)
                  setRetryReplyBiasDraft('')
                  void runRetryReply(bias)
                }}
              >
                确认重试
              </Pressable>
            </div>
          </div>
        </div>
      ) : null}
      <WeChatConfirmDialog
        open={voiceConfigAlertOpen}
        title="语音录音不可用"
        description={voiceConfigAlertMessage}
        cancelText="知道了"
        confirmText="去配置"
        onCancel={() => setVoiceConfigAlertOpen(false)}
        onConfirm={() => {
          setVoiceConfigAlertOpen(false)
          openApiSettings()
        }}
      />
      <WeChatConfirmDialog
        open={confirmDeleteOpen}
        title="删除消息"
        description="确定要删除这条消息吗？"
        cancelText="取消"
        confirmText="删除"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          const mid = actionMessageId?.trim() || ''
          if (!mid) {
            setConfirmDeleteOpen(false)
            closeActionPanel()
            return
          }
          void (async () => {
            await personaDb.deleteWeChatChatMessageById(mid)
            setItems((prev) => {
              const next = rebuildWithCurrentTime(extractMessages(prev).filter((it) => it.id !== mid))
              itemsRef.current = next
              return next
            })
            setConfirmDeleteOpen(false)
            closeActionPanel()
          })()
        }}
      />
      <WeChatConfirmDialog
        open={!!voiceResynthesizeConfirmId}
        title="重新合成语音"
        description="将按当前语音参数重新合成这条语音，并覆盖旧缓存。是否继续？"
        cancelText="取消"
        confirmText={voiceResynthesizing ? '合成中…' : '确认重合成'}
        onCancel={() => {
          if (voiceResynthesizing) return
          setVoiceResynthesizeConfirmId(null)
        }}
        onConfirm={() => {
          void runVoiceResynthesize()
        }}
      />
      <WeChatConfirmDialog
        open={multiDeleteConfirmOpen}
        title="删除消息"
        description={`确定要删除这${selectedMessageIds.length}条消息吗？`}
        cancelText="取消"
        confirmText="删除"
        onCancel={() => setMultiDeleteConfirmOpen(false)}
        onConfirm={() => {
          const ids = [...selectedMessageIds]
          if (!ids.length) {
            setMultiDeleteConfirmOpen(false)
            return
          }
          void (async () => {
            for (const id of ids) {
              await personaDb.deleteWeChatChatMessageById(id)
            }
            setItems((prev) => {
              const set = new Set(ids)
              const next = rebuildWithCurrentTime(extractMessages(prev).filter((it) => !set.has(it.id)))
              itemsRef.current = next
              return next
            })
            setMultiDeleteConfirmOpen(false)
            exitMultiSelect()
          })()
        }}
      />
      <CheckPhoneFlow
        open={checkPhoneOpen}
        characterId={conversationCharacterId}
        characterName={peerNotifyTitle.trim() || '对方'}
        playerIdentityId={playerIdentityId}
        playerDisplayName={playerDisplayName.trim() || state.profile.displayName.trim() || '朋友'}
        useLumiProjectAssistantPrompt={useLumiProjectAssistantPrompt}
        onToast={showComposerToast}
        onClose={() => setCheckPhoneOpen(false)}
      />
      <RecallHistoryModal
        open={recallModalOpen}
        record={recallModalRecord}
        onClose={() => {
          setRecallModalOpen(false)
          setRecallModalRecord(null)
        }}
      />
      <WeChatCenterToast message={centerToast} />

      <AnimatePresence>
        {forwardModeSheetOpen ? (
          <motion.div
            className="fixed inset-0 z-[1206]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setForwardModeSheetOpen(false)
            }}
          >
            <div className="absolute inset-0 bg-black/20" />
            <motion.div
              className="absolute inset-x-0 bottom-0 rounded-t-[16px] bg-white px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
              initial={{ y: 30 }}
              animate={{ y: 0 }}
              exit={{ y: 30 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Pressable
                type="button"
                className="flex w-full items-center justify-between rounded-[12px] px-3 py-3 text-left active:bg-[#f5f5f5]"
                onClick={() => {
                  const ids = [...selectedMessageIds]
                  setForwardModeSheetOpen(false)
                  if (!ids.length) return
                  onRequestForwardMessages?.({
                    mode: 'multi-merge',
                    messageIds: ids,
                    mergeTitle: { userName: playerDisplayName.trim() || '我', peerName: peerNotifyTitle.trim() || '对方' },
                  })
                }}
              >
                <span className="text-[15px] text-black">合并转发</span>
                <span className="text-[12px] text-[#8e8e8e]">聊天记录卡片</span>
              </Pressable>
              <Pressable
                type="button"
                className="mt-1 flex w-full items-center justify-between rounded-[12px] px-3 py-3 text-left active:bg-[#f5f5f5]"
                onClick={() => {
                  const ids = [...selectedMessageIds]
                  setForwardModeSheetOpen(false)
                  if (!ids.length) return
                  onRequestForwardMessages?.({
                    mode: 'multi-item',
                    messageIds: ids,
                    mergeTitle: { userName: playerDisplayName.trim() || '我', peerName: peerNotifyTitle.trim() || '对方' },
                  })
                }}
              >
                <span className="text-[15px] text-black">逐条转发</span>
                <span className="text-[12px] text-[#8e8e8e]">按原顺序发送</span>
              </Pressable>
              <Pressable
                type="button"
                className="mt-3 w-full rounded-[12px] bg-[#f5f5f5] px-4 py-3 text-[15px] text-black active:bg-[#ededed]"
                onClick={() => setForwardModeSheetOpen(false)}
              >
                取消
              </Pressable>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

    </div>
  )
}
