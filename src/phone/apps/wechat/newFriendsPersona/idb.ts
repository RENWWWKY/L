import type {
  Character,
  CharacterMemory,
  ChatConversationSettingsRow,
  CharacterNotificationSettingsRow,
  CharacterBusySettingsRow,
  CharacterTimeSettingsRow,
  HeartWhisper,
  HeartWhisperRow,
  Favorite,
  GroupChatRow,
  MemorySettingsRow,
  NetworkGraphViewRecord,
  NotificationAudioConfig,
  PlayerIdentity,
  PlayerNetworkLink,
  Relationship,
  ScheduleTable,
  TableCell,
  TableCellStyle,
  TimelineEvent,
  TimelineEventImportance,
  CharacterDanmakuSettingsRow,
  WeChatChatMessage,
  WeChatRedPacketPayload,
  WeChatTransferPayload,
  WeChatCallStatusPayload,
  WeChatVoicePayload,
  WeChatTimeConfig,
  WeChatGlobalSettingsRow,
  WeChatMessageSearchIndexRow,
  WorldBackground,
} from './types'
import { formatWeChatMessageListTimestamp as formatWeChatMessageListTimestampFn } from './chatMessageTimestampFormat'
import { emptyWorldBackgroundSettings, formatTimelineEventDate } from './types'
import { DEFAULT_WORLD_BACKGROUND_ID } from './worldBackgroundConstants'
import { buildPresetWorldBackgrounds } from './worldBackgroundSeed'
import { WECHAT_LUMI_PEER_CHARACTER_ID, wechatConversationKey } from '../wechatConversationKey'
import { maybeNotifyWeChatCharacterMessage } from '../wechatSystemNotify'
import { getWeChatBuiltInNotifySoundMeta, playWeChatNotifySound } from '../wechatNotifySound'
import { normalizeWeChatTimeConfig } from '../time/wechatTimeUtils'
import {
  DEFAULT_CHAT_THEME,
  DEFAULT_CHAT_THEME_ID,
  type ChatTheme,
  normalizeChatTheme,
} from '../chatTheme/types'

const DB_NAME = 'wechat-personas-v1'
const DB_VERSION = 21

/** 复合索引：按会话 + 时间戳范围查询（日历、按日跳转） */
const CHAT_MSG_INDEX_CONV_TS = 'conversationKey_timestamp'
const PHONE_KV_STORE = 'phoneKv'
const STORE = 'characters'
const WORLD_BG_STORE = 'worldBackgrounds'
const CHAT_MSG_STORE = 'chatMessages'
const IDENTITY_STORE = 'playerIdentities'
const REL_STORE = 'relationships'
const GRAPH_VIEW_STORE = 'networkGraphViews'
const PLAYER_LINKS_STORE = 'playerNetworkLinks'
const CONFIG_STORE = 'appConfig'
const MEMORY_SETTINGS_STORE = 'memorySettings'
const CHARACTER_MEMORIES_STORE = 'characterMemories'
const CHAT_THEME_STORE = 'chatTheme'
const CHAT_CONV_SETTINGS_STORE = 'chatConversationSettings'
const GROUP_CHATS_STORE = 'groupChats'
const GLOBAL_SETTINGS_STORE = 'globalSettings'
/** 通讯录「新的朋友」：好友申请元数据（消息线程复用 chatMessages + conversationKey） */
const FRIEND_REQUEST_STORE = 'friendRequests'
const CHARACTER_DANMAKU_STORE = 'characterDanmakuSettings'
const CHARACTER_NOTIFY_STORE = 'characterNotificationSettings'
const CHARACTER_BUSY_STORE = 'characterBusySettings'
const CHARACTER_TIME_STORE = 'characterTimeSettings'
const FAVORITES_STORE = 'favorites'
const HEART_WHISPER_STORE = 'heartWhispers'

/** 与 DatingContext / loadOfflineDatingPlotsForWechatPrompt 一致（IndexedDB phoneKv） */
const WECHAT_DATING_ARCHIVES_KV_KEY = 'wechat-dating-archives-v1'
const WECHAT_DATING_CHARACTERS_KV_KEY = 'wechat-dating-characters-v1'
const WECHAT_DATING_HEART_WHISPER_KV_PREFIX = 'wechat-dating-heart-whisper-v1:'
const WECHAT_DATING_STYLE_TUNING_LS_PREFIX = 'wechat-dating-style-tuning:'

type Stored = Character

export const DEFAULT_WECHAT_GLOBAL_SETTINGS: WeChatGlobalSettingsRow = {
  id: 'global',
  notificationEnabled: true,
  notificationMode: 'global',
  globalAudio: { type: 'default', defaultKey: 'notify2' },
  busyEnabled: true,
  busyMode: 'global',
  globalBusyConfig: {
    maxDuration: 30,
    triggerProbability: 20,
    customScenarios: [],
  },
  globalTimeConfig: normalizeWeChatTimeConfig({ mode: 'system', timeMultiplier: 1 }),
  danmakuScopeMode: 'global',
  danmakuUseMemory: false,
  danmakuGenerateCount: 5,
  danmakuFontSize: 14,
  danmakuColor: '#000000',
  danmakuOpacity: 0.85,
  danmakuScrollDurationSec: 8,
  danmakuPosition: 'top',
  danmakuDensity: 'normal',
  danmakuStyle: 'none',
  danmakuCustomPrompt: '',
  theme: 'light',
  createdAt: Date.now(),
}

function normalizeWeChatGlobalSettingsRow(input: unknown): WeChatGlobalSettingsRow {
  const r = (input ?? {}) as Partial<WeChatGlobalSettingsRow> & {
    danmakuSize?: 'small' | 'normal' | 'large'
    danmakuCount?: 'low' | 'normal' | 'high'
    danmakuSpeed?: 'slow' | 'normal' | 'fast'
  }
  const now = Date.now()
  const op = typeof r.danmakuOpacity === 'number' && Number.isFinite(r.danmakuOpacity) ? r.danmakuOpacity : 0.85

  let fontSize = typeof r.danmakuFontSize === 'number' && Number.isFinite(r.danmakuFontSize) ? r.danmakuFontSize : 14
  if (r.danmakuSize === 'small') fontSize = 12
  if (r.danmakuSize === 'large') fontSize = 18
  fontSize = Math.min(24, Math.max(12, Math.round(fontSize)))

  let position: WeChatGlobalSettingsRow['danmakuPosition'] = 'top'
  if (r.danmakuPosition === 'middle' || r.danmakuPosition === 'bottom' || r.danmakuPosition === 'random') {
    position = r.danmakuPosition
  }

  const color =
    typeof r.danmakuColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(r.danmakuColor.trim())
      ? r.danmakuColor.trim()
      : '#000000'

  let scope: WeChatGlobalSettingsRow['danmakuScopeMode'] = 'global'
  if (r.danmakuScopeMode === 'character') scope = 'character'

  let style: WeChatGlobalSettingsRow['danmakuStyle'] = 'none'
  if (r.danmakuStyle === 'gray' || r.danmakuStyle === 'white') style = r.danmakuStyle

  let scrollSec =
    typeof r.danmakuScrollDurationSec === 'number' && Number.isFinite(r.danmakuScrollDurationSec)
      ? r.danmakuScrollDurationSec
      : 8
  if (r.danmakuSpeed === 'slow') scrollSec = 12
  if (r.danmakuSpeed === 'fast') scrollSec = 5
  if (r.danmakuSpeed === 'normal') scrollSec = 8
  scrollSec = Math.min(15, Math.max(5, scrollSec))

  const useMem = typeof r.danmakuUseMemory === 'boolean' ? r.danmakuUseMemory : false
  let genCount =
    typeof r.danmakuGenerateCount === 'number' && Number.isFinite(r.danmakuGenerateCount)
      ? Math.round(r.danmakuGenerateCount)
      : 5
  genCount = Math.min(20, Math.max(1, genCount))

  let density: WeChatGlobalSettingsRow['danmakuDensity'] = 'normal'
  if (r.danmakuDensity === 'sparse' || r.danmakuDensity === 'dense') density = r.danmakuDensity
  else if (r.danmakuCount === 'low') density = 'sparse'
  else if (r.danmakuCount === 'high') density = 'dense'

  const notificationEnabled = typeof (r as any).notificationEnabled === 'boolean' ? !!(r as any).notificationEnabled : true
  const notificationMode: WeChatGlobalSettingsRow['notificationMode'] =
    (r as any).notificationMode === 'character' ? 'character' : 'global'
  const busyEnabled = typeof (r as any).busyEnabled === 'boolean' ? !!(r as any).busyEnabled : true
  const busyMode: WeChatGlobalSettingsRow['busyMode'] = (r as any).busyMode === 'character' ? 'character' : 'global'
  const rawBusy = ((r as any).globalBusyConfig ?? {}) as Partial<WeChatGlobalSettingsRow['globalBusyConfig']>
  const maxDuration = Math.min(120, Math.max(1, Math.round(Number(rawBusy.maxDuration ?? 30) || 30)))
  const triggerProbability = Math.min(100, Math.max(0, Math.round(Number(rawBusy.triggerProbability ?? 20) || 20)))
  const customScenariosRaw = Array.isArray(rawBusy.customScenarios) ? rawBusy.customScenarios : []
  const customScenarios = customScenariosRaw
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .slice(0, 50)
  const globalTimeConfig = normalizeWeChatTimeConfig((r as any).globalTimeConfig)

  const normalizeAudio = (raw: unknown): NotificationAudioConfig => {
    const a = (raw ?? {}) as any
    if (a?.type === 'custom') {
      const base64 = typeof a.customAudioBase64 === 'string' ? a.customAudioBase64 : ''
      const name = typeof a.customAudioName === 'string' ? a.customAudioName : ''
      const mime = typeof a.customAudioMime === 'string' ? a.customAudioMime : ''
      if (base64.trim() && name.trim() && mime.trim()) {
        const clipped = base64.length > 8_000_000 ? base64.slice(0, 8_000_000) : base64
        return { type: 'custom', customAudioBase64: clipped, customAudioName: name.trim(), customAudioMime: mime.trim() }
      }
    }
    const key = a?.defaultKey === 'lai' ? 'lai' : 'notify2'
    return { type: 'default', defaultKey: key }
  }
  const globalAudio = normalizeAudio((r as any).globalAudio)

  const customPromptRaw = typeof r.danmakuCustomPrompt === 'string' ? r.danmakuCustomPrompt : ''
  const danmakuCustomPrompt = customPromptRaw.length > 6000 ? customPromptRaw.slice(0, 6000) : customPromptRaw

  return {
    id: 'global',
    notificationEnabled,
    notificationMode,
    globalAudio,
    busyEnabled,
    busyMode,
    globalBusyConfig: {
      maxDuration,
      triggerProbability,
      customScenarios,
    },
    globalTimeConfig,
    danmakuScopeMode: scope,
    danmakuUseMemory: useMem,
    danmakuGenerateCount: genCount,
    danmakuFontSize: fontSize,
    danmakuColor: color,
    danmakuOpacity: Math.min(1, Math.max(0.3, op)),
    danmakuScrollDurationSec: scrollSec,
    danmakuPosition: position,
    danmakuDensity: density,
    danmakuStyle: style,
    danmakuCustomPrompt,
    theme: r.theme === 'dark' ? 'dark' : 'light',
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : now,
  }
}

function normalizeCharacterDanmakuSettingsRow(input: unknown): CharacterDanmakuSettingsRow | null {
  const r = (input ?? {}) as Partial<CharacterDanmakuSettingsRow> & { speed?: 'slow' | 'normal' | 'fast' }
  if (typeof r.characterId !== 'string' || !r.characterId.trim()) return null
  const now = Date.now()
  const fs = typeof r.fontSize === 'number' && Number.isFinite(r.fontSize) ? Math.round(r.fontSize) : 14
  const op = typeof r.opacity === 'number' && Number.isFinite(r.opacity) ? r.opacity : 0.85
  const col =
    typeof r.color === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(r.color.trim()) ? r.color.trim() : '#000000'
  let pos: CharacterDanmakuSettingsRow['position'] = 'top'
  if (r.position === 'middle' || r.position === 'bottom' || r.position === 'random') pos = r.position
  let st: CharacterDanmakuSettingsRow['style'] = 'none'
  if (r.style === 'gray' || r.style === 'white') st = r.style
  let scrollSec =
    typeof r.scrollDurationSec === 'number' && Number.isFinite(r.scrollDurationSec) ? r.scrollDurationSec : 8
  if (r.speed === 'slow') scrollSec = 12
  if (r.speed === 'fast') scrollSec = 5
  if (r.speed === 'normal') scrollSec = 8
  scrollSec = Math.min(15, Math.max(5, scrollSec))

  const useMem = typeof r.useMemory === 'boolean' ? r.useMemory : false
  let genCount =
    typeof r.generateCount === 'number' && Number.isFinite(r.generateCount) ? Math.round(r.generateCount) : 5
  genCount = Math.min(20, Math.max(1, genCount))

  let dens: CharacterDanmakuSettingsRow['density'] = 'normal'
  if (r.density === 'sparse' || r.density === 'dense') dens = r.density

  const charPromptRaw = typeof r.customPrompt === 'string' ? r.customPrompt : ''
  const customPrompt = charPromptRaw.length > 6000 ? charPromptRaw.slice(0, 6000) : charPromptRaw

  return {
    characterId: r.characterId.trim(),
    enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
    useMemory: useMem,
    generateCount: genCount,
    fontSize: Math.min(24, Math.max(12, fs)),
    color: col,
    opacity: Math.min(1, Math.max(0.3, op)),
    scrollDurationSec: scrollSec,
    position: pos,
    density: dens,
    style: st,
    customPrompt,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : now,
  }
}

function normalizeCharacterNotificationSettingsRow(input: unknown): CharacterNotificationSettingsRow | null {
  const r = (input ?? {}) as Partial<CharacterNotificationSettingsRow>
  if (typeof r.characterId !== 'string' || !r.characterId.trim()) return null
  const now = Date.now()
  const enabled = typeof r.notificationEnabled === 'boolean' ? r.notificationEnabled : true
  const a = (r.audio ?? {}) as any
  let audio: CharacterNotificationSettingsRow['audio'] = { type: 'global' }
  if (a?.type === 'custom') {
    const base64 = typeof a.customAudioBase64 === 'string' ? a.customAudioBase64 : ''
    const name = typeof a.customAudioName === 'string' ? a.customAudioName : ''
    const mime = typeof a.customAudioMime === 'string' ? a.customAudioMime : ''
    if (base64.trim() && name.trim() && mime.trim()) {
      const clipped = base64.length > 8_000_000 ? base64.slice(0, 8_000_000) : base64
      audio = { type: 'custom', customAudioBase64: clipped, customAudioName: name.trim(), customAudioMime: mime.trim() }
    }
  } else if (a?.type === 'global') {
    audio = { type: 'global' }
  }
  return {
    characterId: r.characterId.trim(),
    notificationEnabled: enabled,
    audio,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : now,
  }
}

function normalizeCharacterBusySettingsRow(input: unknown): CharacterBusySettingsRow | null {
  const r = (input ?? {}) as Partial<CharacterBusySettingsRow>
  if (typeof r.characterId !== 'string' || !r.characterId.trim()) return null
  const now = Date.now()
  const maxDuration = Math.min(120, Math.max(1, Math.round(Number(r.maxDuration ?? 30) || 30)))
  const triggerProbability = Math.min(100, Math.max(0, Math.round(Number(r.triggerProbability ?? 20) || 20)))
  const customScenarios = Array.isArray(r.customScenarios)
    ? r.customScenarios.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, 50)
    : []
  const busyMessages = Array.isArray(r.busyMessages)
    ? r.busyMessages.filter((m): m is WeChatChatMessage => !!m && typeof m === 'object' && typeof (m as any).id === 'string')
    : []
  return {
    characterId: r.characterId.trim(),
    enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
    maxDuration,
    triggerProbability,
    customScenarios,
    isBusy: typeof r.isBusy === 'boolean' ? r.isBusy : false,
    busyReason: typeof r.busyReason === 'string' ? r.busyReason : '',
    busyStartTime: typeof r.busyStartTime === 'number' && Number.isFinite(r.busyStartTime) ? r.busyStartTime : 0,
    busyEndTime: typeof r.busyEndTime === 'number' && Number.isFinite(r.busyEndTime) ? r.busyEndTime : 0,
    busyDurationMinutes:
      typeof r.busyDurationMinutes === 'number' && Number.isFinite(r.busyDurationMinutes)
        ? Math.min(120, Math.max(1, Math.round(r.busyDurationMinutes)))
        : 15,
    busyMessages,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : now,
  }
}

function normalizeCharacterTimeSettingsRow(input: unknown): CharacterTimeSettingsRow | null {
  const r = (input ?? {}) as Partial<CharacterTimeSettingsRow> & { config?: Partial<WeChatTimeConfig> | null }
  if (typeof r.characterId !== 'string' || !r.characterId.trim()) return null
  const now = Date.now()
  return {
    characterId: r.characterId.trim(),
    config: normalizeWeChatTimeConfig(r.config),
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : now,
  }
}

function normalizeHeartWhisper(input: unknown): HeartWhisper {
  const r = (input ?? {}) as Partial<HeartWhisper>
  const txt = (v: unknown) => String(v ?? '').trim()
  return {
    timestamp: txt(r.timestamp),
    location: txt(r.location),
    action: txt(r.action),
    outfit: txt(r.outfit),
    innerThoughts: txt(r.innerThoughts),
    userImpression: txt(r.userImpression),
  }
}

function normalizeHeartWhisperRow(input: unknown): HeartWhisperRow | null {
  const r = (input ?? {}) as Partial<HeartWhisperRow> & { data?: Partial<HeartWhisper> | null }
  if (typeof r.characterId !== 'string' || !r.characterId.trim()) return null
  return {
    characterId: r.characterId.trim(),
    data: normalizeHeartWhisper(r.data),
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : Date.now(),
  }
}

function normalizeCharacter(input: unknown): Stored {
  const now = Date.now()
  const c = (input ?? {}) as Partial<Stored>
  const worldBooksRaw = Array.isArray((c as { worldBooks?: unknown }).worldBooks)
    ? ((c as { worldBooks: unknown[] }).worldBooks as unknown[])
    : []
  const worldBooks = worldBooksRaw
    .filter((w: unknown) => w && typeof w === 'object')
    .map((w: unknown) => {
      const wb = w as Record<string, unknown>
      const legacyPriority =
        wb.priority === 'before' || wb.priority === 'after' ? (wb.priority as 'before' | 'after') : null
      const itemsRaw = Array.isArray(wb.items) ? (wb.items as unknown[]) : []
      const items = itemsRaw
        .filter((it: unknown) => it && typeof it === 'object')
        .map((it: unknown) => {
          const i = it as Record<string, unknown>
          return {
            id: typeof i.id === 'string' ? i.id : `it-${now}-${Math.random().toString(36).slice(2, 6)}`,
            name: typeof i.name === 'string' ? i.name : '新条目',
            enabled: typeof i.enabled === 'boolean' ? i.enabled : true,
            priority:
              i.priority === 'before' || i.priority === 'after'
                ? (i.priority as 'before' | 'after')
                : legacyPriority ?? 'before',
            keywords: typeof i.keywords === 'string' ? i.keywords : '',
            content: typeof i.content === 'string' ? i.content : '',
            updatedAt: typeof i.updatedAt === 'number' ? i.updatedAt : now,
            collapsed: typeof i.collapsed === 'boolean' ? i.collapsed : false,
          }
        })
      return {
        id: typeof wb.id === 'string' ? wb.id : `wb-${now}-${Math.random().toString(36).slice(2, 6)}`,
        name: typeof wb.name === 'string' ? wb.name : '新的世界书',
        enabled: typeof wb.enabled === 'boolean' ? wb.enabled : true,
        items,
        collapsed: typeof wb.collapsed === 'boolean' ? wb.collapsed : false,
      }
    })

  const raw = c as Record<string, unknown>
  const normalizeSchedule = (s: unknown): ScheduleTable | undefined => {
    const r = (s ?? null) as any
    if (!r || typeof r !== 'object') return undefined
    const now2 = now
    const headers = Array.isArray(r.headers) ? r.headers.map((x: any) => String(x ?? '').trim()) : []
    const cols = Math.min(50, Math.max(1, headers.length || 1))
    const safeHeaders = headers.length ? headers.slice(0, cols) : new Array(cols).fill('')

    const normalizeCellStyle = (rawStyle: any): TableCellStyle => {
      const s2 = rawStyle ?? {}
      const align = s2.align === 'center' || s2.align === 'right' ? s2.align : 'left'
      return {
        bold: !!s2.bold,
        italic: !!s2.italic,
        underline: !!s2.underline,
        strikethrough: !!s2.strikethrough,
        highlight: !!s2.highlight,
        align,
      }
    }
    const toCell = (x: any): TableCell => {
      if (x && typeof x === 'object' && typeof x.content === 'string') {
        const colspan =
          typeof x.colspan === 'number' && Number.isFinite(x.colspan) ? Math.min(50, Math.max(1, Math.floor(x.colspan))) : 1
        const rowspan =
          typeof x.rowspan === 'number' && Number.isFinite(x.rowspan) ? Math.min(50, Math.max(1, Math.floor(x.rowspan))) : 1
        return {
          content: String(x.content ?? ''),
          style: normalizeCellStyle(x.style),
          colspan,
          rowspan,
        }
      }
      // 兼容旧数据：string 直接转 content
      return {
        content: String(x ?? ''),
        style: normalizeCellStyle(null),
        colspan: 1,
        rowspan: 1,
      }
    }
    const rowsRaw = Array.isArray(r.rows) ? (r.rows as any[]) : []
    let rows = rowsRaw
      .filter((row) => Array.isArray(row))
      .map((row) => {
        const rr = (row as any[]).slice(0, cols).map(toCell)
        while (rr.length < cols) rr.push(toCell(''))
        return rr
      })
      .slice(0, 200)

    // 兼容更旧版本：rows 为 string[][]
    if (!rows.length && Array.isArray(r.rows) && Array.isArray(r.rows?.[0]) && typeof r.rows?.[0]?.[0] === 'string') {
      const legacy = (r.rows as any[])
        .filter((row: any) => Array.isArray(row))
        .map((row: any[]) => {
          const rr = row.slice(0, cols).map((v) => toCell(String(v ?? '')))
          while (rr.length < cols) rr.push(toCell(''))
          return rr
        })
        .slice(0, 200)
      if (legacy.length) {
        rows = legacy
      }
    }
    const styleIn = r.style ?? {}
    const headerStyle = styleIn.headerStyle === 'dark' || styleIn.headerStyle === 'light' || styleIn.headerStyle === 'none' ? styleIn.headerStyle : 'dark'
    const borderStyle = styleIn.borderStyle === 'solid' || styleIn.borderStyle === 'dashed' || styleIn.borderStyle === 'none' ? styleIn.borderStyle : 'solid'
    const rowHeight = styleIn.rowHeight === 'compact' || styleIn.rowHeight === 'normal' || styleIn.rowHeight === 'loose' ? styleIn.rowHeight : 'normal'
    const name = typeof r.name === 'string' ? r.name.slice(0, 40).trim() : ''
    const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim().slice(0, 80) : `t-${now2}`
    const createdAt = typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : now2
    const updatedAt = typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : now2
    const columnWidthsRaw = Array.isArray(r.columnWidths) ? (r.columnWidths as any[]) : []
    const columnWidths = columnWidthsRaw
      .map((x) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(300, Math.max(50, Math.floor(x))) : 96))
      .slice(0, cols)
    while (columnWidths.length < cols) columnWidths.push(96)
    const rowHeightsRaw = Array.isArray(r.rowHeights) ? (r.rowHeights as any[]) : []
    const rowHeights = rowHeightsRaw
      .map((x) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(300, Math.max(44, Math.floor(x))) : 44))
      .slice(0, rows.length)
    while (rowHeights.length < rows.length) rowHeights.push(44)

    if (!safeHeaders.length && !rows.length) return undefined
    return {
      id,
      name: name || '日程表',
      headers: safeHeaders.slice(0, 50),
      rows,
      columnWidths,
      rowHeights,
      style: { headerStyle, borderStyle, rowHeight },
      createdAt,
      updatedAt,
    }
  }
  return {
    id: typeof c.id === 'string' ? c.id : `ch-${now}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: typeof c.createdAt === 'number' ? c.createdAt : now,
    updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : now,
    name: typeof c.name === 'string' ? c.name : '',
    gender: c.gender === 'male' || c.gender === 'female' || c.gender === 'other' ? c.gender : 'female',
    age: typeof c.age === 'number' || c.age === null ? (c.age as number | null) : null,
    height: typeof raw.height === 'string' ? (raw.height as string) : '',
    weight: typeof raw.weight === 'string' ? (raw.weight as string) : '',
    birthdayMD:
      typeof raw.birthdayMD === 'string'
        ? (raw.birthdayMD as string)
        : typeof raw.birthday === 'string'
          ? (() => {
              const v = String(raw.birthday)
              const m = Number(v.slice(5, 7))
              const d = Number(v.slice(8, 10))
              if (!Number.isFinite(m) || !Number.isFinite(d)) return ''
              return `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            })()
          : '',
    zodiac: typeof c.zodiac === 'string' ? c.zodiac : '',
    identity: typeof c.identity === 'string' ? c.identity : '学生',
    mbti: typeof raw.mbti === 'string' ? (raw.mbti as string) : '',
    bio: typeof raw.bio === 'string' ? (raw.bio as string) : '',
    motto: typeof raw.motto === 'string' ? (raw.motto as string) : '',
    openingLines: typeof raw.openingLines === 'string' ? (raw.openingLines as string) : '',
    avatarUrl: typeof raw.avatarUrl === 'string' ? (raw.avatarUrl as string) : '',
    wechatNickname: typeof raw.wechatNickname === 'string' ? (raw.wechatNickname as string) : '',
    wechatId: typeof raw.wechatId === 'string' ? (raw.wechatId as string) : '',
    wechatSignature: typeof raw.wechatSignature === 'string' ? (raw.wechatSignature as string) : '',
    wechatRegion: typeof raw.wechatRegion === 'string' ? (raw.wechatRegion as string) : '',
    momentsCoverUrl: typeof raw.momentsCoverUrl === 'string' ? (raw.momentsCoverUrl as string) : '',
    worldBooks,
    playerIdentityId: typeof raw.playerIdentityId === 'string' ? (raw.playerIdentityId as string) : undefined,
    generatedForCharacterId:
      typeof raw.generatedForCharacterId === 'string' ? (raw.generatedForCharacterId as string) : undefined,
    interests: Array.isArray(raw.interests)
      ? (raw.interests as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined,
    painPoints: Array.isArray(raw.painPoints)
      ? (raw.painPoints as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined,
    unreadCount:
      typeof raw.unreadCount === 'number' && Number.isFinite(raw.unreadCount)
        ? Math.max(0, Math.floor(raw.unreadCount as number))
        : 0,
    worldBackgroundId:
      typeof raw.worldBackgroundId === 'string' && raw.worldBackgroundId.trim()
        ? raw.worldBackgroundId.trim()
        : DEFAULT_WORLD_BACKGROUND_ID,
    worldBackgroundEnabled: typeof raw.worldBackgroundEnabled === 'boolean' ? raw.worldBackgroundEnabled : true,
    isPinned: typeof raw.isPinned === 'boolean' ? raw.isPinned : undefined,
    lastMessageTime:
      typeof raw.lastMessageTime === 'number' && Number.isFinite(raw.lastMessageTime)
        ? raw.lastMessageTime
        : undefined,
    isMuted: typeof raw.isMuted === 'boolean' ? raw.isMuted : undefined,
    isDanmakuMode: typeof raw.isDanmakuMode === 'boolean' ? raw.isDanmakuMode : undefined,
    chatBackground: typeof raw.chatBackground === 'string' ? raw.chatBackground : undefined,
    remark: typeof raw.remark === 'string' ? raw.remark.slice(0, 64) : '',
    isStarred: typeof raw.isStarred === 'boolean' ? raw.isStarred : false,
    isBlocked: typeof raw.isBlocked === 'boolean' ? raw.isBlocked : false,
    momentsPermission: {
      blocked: !!((raw as { momentsPermission?: { blocked?: unknown } }).momentsPermission?.blocked),
    },
    schedule: normalizeSchedule((raw as any).schedule),
  }
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 50
  return Math.min(100, Math.max(0, n))
}

function clampInt(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo
  return Math.min(hi, Math.max(lo, Math.trunc(n)))
}

function daysInMonthFor(y: number, month1to12: number) {
  return new Date(y, month1to12, 0).getDate()
}

/** 从旧版 time 字符串或时间戳推断年月日 */
function parseLegacyTimelineDate(timeStr: string, createdAt: number): { year: number; month: number | null; day: number | null } {
  const s = timeStr.trim()
  if (s) {
    const bc = /公?元前\s*(\d+)/.exec(s)
    if (bc) return { year: -clampInt(parseInt(bc[1], 10), 1, 9_999_999), month: null, day: null }
    const m1 = /(\d{1,4})\s*年(?:\s*(\d{1,2})\s*月)?(?:\s*(\d{1,2})\s*日)?/.exec(s)
    if (m1) {
      const y = parseInt(m1[1], 10)
      const mo = m1[2] != null ? clampInt(parseInt(m1[2], 10), 1, 12) : null
      let d = m1[3] != null ? clampInt(parseInt(m1[3], 10), 1, 31) : null
      if (mo != null && d != null) d = clampInt(d, 1, daysInMonthFor(y, mo))
      return { year: y, month: mo, day: d }
    }
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (iso) {
      const y = +iso[1]
      const mo = clampInt(+iso[2], 1, 12)
      const dMax = daysInMonthFor(y, mo)
      const d = clampInt(+iso[3], 1, dMax)
      return { year: y, month: mo, day: d }
    }
  }
  const dt = new Date(createdAt)
  return {
    year: dt.getFullYear(),
    month: dt.getMonth() + 1,
    day: dt.getDate(),
  }
}

function normalizeWorldBackground(input: unknown): WorldBackground {
  const now = Date.now()
  const empty = emptyWorldBackgroundSettings()
  const raw = (input ?? {}) as Record<string, unknown>
  const sIn = (raw.settings ?? {}) as Record<string, unknown>
  const arr = (k: keyof typeof empty): string[] => {
    const v = sIn[k as string]
    if (!Array.isArray(v)) return [...(empty[k] as string[])]
    return v.map((x) => String(x).trim()).filter(Boolean)
  }

  const mapIn = (raw.map ?? {}) as Record<string, unknown>
  const markersRaw = Array.isArray(mapIn.markers) ? (mapIn.markers as unknown[]) : []
  const markers = markersRaw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map((m) => ({
      id: typeof m.id === 'string' ? m.id : `mk-${now}-${Math.random().toString(36).slice(2, 8)}`,
      name: typeof m.name === 'string' ? m.name : '',
      type: typeof m.type === 'string' ? m.type : '其他',
      description: typeof m.description === 'string' ? m.description : '',
      x: clampPct(typeof m.x === 'number' ? m.x : Number(m.x)),
      y: clampPct(typeof m.y === 'number' ? m.y : Number(m.y)),
    }))
  const imageUrl = typeof mapIn.imageUrl === 'string' ? mapIn.imageUrl : ''

  const timelineRaw = Array.isArray(raw.timeline) ? (raw.timeline as unknown[]) : []
  const timeline: TimelineEvent[] = timelineRaw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map((t) => {
      const imp = t.importance
      let importance: TimelineEventImportance = 'normal'
      if (imp === 'critical' || imp === 'important' || imp === 'normal') importance = imp
      const createdAt = typeof t.createdAt === 'number' ? t.createdAt : now
      const legacyTime = typeof t.time === 'string' ? t.time : ''

      let year: number
      let month: number | null
      let day: number | null
      const rawY = t.year
      const rawM = t.month
      const rawD = t.day
      if (typeof rawY === 'number' && Number.isFinite(rawY)) {
        year = rawY
        month =
          typeof rawM === 'number' && rawM >= 1 && rawM <= 12 ? clampInt(rawM, 1, 12) : null
        day = typeof rawD === 'number' && rawD >= 1 && rawD <= 31 ? clampInt(rawD, 1, 31) : null
        if (month == null) day = null
        else if (day != null) day = clampInt(day, 1, daysInMonthFor(year, month))
      } else {
        const p = parseLegacyTimelineDate(legacyTime, createdAt)
        year = p.year
        month = p.month
        day = p.day
      }

      const formatted = formatTimelineEventDate({ year, month, day, time: legacyTime })

      return {
        id: typeof t.id === 'string' ? t.id : `tl-${now}-${Math.random().toString(36).slice(2, 8)}`,
        year,
        month,
        day,
        time: legacyTime.trim() || formatted,
        title: typeof t.title === 'string' ? t.title : '',
        importance,
        description: typeof t.description === 'string' ? t.description : '',
        createdAt,
      }
    })

  return {
    id: typeof raw.id === 'string' ? raw.id : `wb-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: typeof raw.name === 'string' ? raw.name : '未命名世界',
    description: typeof raw.description === 'string' ? raw.description : '',
    isPreset: raw.isPreset === true,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
    settings: {
      worldType: arr('worldType'),
      era: arr('era'),
      technology: arr('technology'),
      supernatural: arr('supernatural'),
      geography: arr('geography'),
      politics: arr('politics'),
      society: arr('society'),
      economy: arr('economy'),
      religion: arr('religion'),
      races: arr('races'),
      conflicts: arr('conflicts'),
      rules: arr('rules'),
      customRuleLines: arr('customRuleLines'),
    },
    map: { imageUrl, markers },
    timeline,
  }
}

function normalizeWeChatChatMessage(input: unknown): WeChatChatMessage | null {
  const m = (input ?? {}) as Partial<WeChatChatMessage>
  if (typeof m.id !== 'string' || typeof m.characterId !== 'string' || typeof m.playerIdentityId !== 'string') {
    return null
  }
  if (m.type !== 'player' && m.type !== 'character') return null
  const content = typeof m.content === 'string' ? m.content : ''
  const thinking =
    typeof (m as { thinking?: unknown }).thinking === 'string'
      ? String((m as { thinking?: unknown }).thinking).trim().slice(0, 8000)
      : undefined
  const isFavorite = typeof (m as any).isFavorite === 'boolean' ? !!(m as any).isFavorite : undefined
  const rawReplyTo = (m as any).replyTo
  const replyTo =
    rawReplyTo && typeof rawReplyTo === 'object'
      ? (() => {
          const r = rawReplyTo as Record<string, unknown>
          const messageId = typeof r.messageId === 'string' ? r.messageId.trim() : ''
          if (!messageId) return undefined
          const senderName = typeof r.senderName === 'string' ? r.senderName.trim().slice(0, 64) : ''
          const content = typeof r.content === 'string' ? r.content.trim().slice(0, 300) : ''
          return {
            messageId,
            senderName: senderName || '未知',
            content: content || '...',
            isUser: !!r.isUser,
          }
        })()
      : typeof rawReplyTo === 'string' && rawReplyTo.trim()
        ? {
            messageId: rawReplyTo.trim(),
            senderName: '未知',
            content: '...',
            isUser: false,
          }
        : undefined
  const imagesRaw = Array.isArray(m.images) ? (m.images as unknown[]) : []
  const images = imagesRaw
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const it = x as { base64?: unknown; type?: unknown }
      const base64 = typeof it.base64 === 'string' ? it.base64 : ''
      const type =
        it.type === 'image/jpeg' || it.type === 'image/png' || it.type === 'image/gif' || it.type === 'image/webp'
          ? it.type
          : null
      if (!base64.trim() || !type) return null
      // 防止单条消息无限膨胀：保守截断 base64 长度（约等于 < 10MB 原图）
      const clipped = base64.length > 14_000_000 ? base64.slice(0, 14_000_000) : base64
      return { base64: clipped, type }
    })
    .filter((x): x is { base64: string; type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' } => !!x)
  const timestamp = typeof m.timestamp === 'number' ? m.timestamp : Date.now()
  const isRead = typeof m.isRead === 'boolean' ? m.isRead : false
  const conversationKey =
    typeof m.conversationKey === 'string' && m.conversationKey.trim()
      ? m.conversationKey
      : wechatConversationKey(m.characterId, m.playerIdentityId)
  const rawRp = (m as { redPacket?: unknown }).redPacket
  const redPacket: WeChatRedPacketPayload | undefined = (() => {
    if (!rawRp || typeof rawRp !== 'object') return undefined
    const r = rawRp as Record<string, unknown>
    const packetId = typeof r.packetId === 'string' ? r.packetId.trim() : ''
    const amountRaw = typeof r.amountYuan === 'number' ? r.amountYuan : Number.NaN
    const amountYuan = Number.isFinite(amountRaw) ? Math.round(amountRaw * 100) / 100 : Number.NaN
    const remark = typeof r.remark === 'string' ? r.remark.slice(0, 64) : ''
    const opened = !!r.opened
    if (!packetId || !Number.isFinite(amountYuan) || amountYuan <= 0) return undefined
    return { packetId, amountYuan, remark, opened }
  })()
  const rawTf = (m as { transfer?: unknown }).transfer
  const transfer: WeChatTransferPayload | undefined = (() => {
    if (!rawTf || typeof rawTf !== 'object') return undefined
    const r = rawTf as Record<string, unknown>
    const transferId = typeof r.transferId === 'string' ? r.transferId.trim() : ''
    if (!transferId) return undefined
    return { transferId }
  })()
  const rawCall = (m as { callStatus?: unknown }).callStatus
  const callStatus: WeChatCallStatusPayload | undefined = (() => {
    if (!rawCall || typeof rawCall !== 'object') return undefined
    const r = rawCall as Record<string, unknown>
    const status = typeof r.status === 'string' ? r.status.trim() : ''
    if (status !== 'rejected' && status !== 'no_answer' && status !== 'duration') return undefined
    const durationRaw = typeof r.durationSec === 'number' ? r.durationSec : Number.NaN
    const durationSec = Number.isFinite(durationRaw) ? Math.max(0, Math.floor(durationRaw)) : undefined
    return status === 'duration' ? { status, durationSec } : { status }
  })()
  const rawVoice = (m as { voice?: unknown }).voice
  const voice: WeChatVoicePayload | undefined = (() => {
    if (!rawVoice || typeof rawVoice !== 'object') return undefined
    const r = rawVoice as Record<string, unknown>
    const rawDuration = typeof r.durationSec === 'number' ? r.durationSec : Number.NaN
    if (!Number.isFinite(rawDuration) || rawDuration <= 0) return undefined
    const durationSec = Math.max(1, Math.floor(rawDuration))
    const emotionAnalyzed = !!r.emotionAnalyzed
    const emotionLabel = typeof r.emotionLabel === 'string' ? r.emotionLabel.trim().slice(0, 16) : ''
    const ttsScript = typeof r.ttsScript === 'string' ? r.ttsScript.trim().slice(0, 2000) : ''
    const audioUrl = typeof r.audioUrl === 'string' ? r.audioUrl.trim() : ''
    const transcriptText = typeof r.transcriptText === 'string' ? r.transcriptText.trim() : ''
    return {
      durationSec,
      emotionAnalyzed,
      emotionLabel: emotionLabel || undefined,
      ttsScript: ttsScript || undefined,
      audioUrl: audioUrl || undefined,
      transcriptText: transcriptText || undefined,
    }
  })()
  const originalContent =
    typeof (m as { originalContent?: unknown }).originalContent === 'string'
      ? String((m as { originalContent?: unknown }).originalContent).slice(0, 8000)
      : undefined
  const isRecalled = typeof (m as { isRecalled?: unknown }).isRecalled === 'boolean' ? !!(m as { isRecalled?: boolean }).isRecalled : undefined
  const recallRaw = (m as { recallTimestamp?: unknown }).recallTimestamp
  const recallTimestamp =
    typeof recallRaw === 'number' && Number.isFinite(recallRaw) ? Math.max(0, Math.floor(recallRaw)) : undefined
  const recalledByRaw = (m as { recalledBy?: unknown }).recalledBy
  const recalledBy = recalledByRaw === 'player' || recalledByRaw === 'character' ? recalledByRaw : undefined
  return {
    id: m.id,
    characterId: m.characterId,
    playerIdentityId: m.playerIdentityId,
    type: m.type,
    content,
    thinking: thinking || undefined,
    redPacket,
    transfer,
    callStatus,
    voice,
    images: images.length ? images : undefined,
    isFavorite,
    replyTo,
    originalContent,
    isRecalled,
    recallTimestamp,
    recalledBy,
    timestamp,
    isRead,
    conversationKey,
  }
}

function normalizeFavorite(input: unknown): Favorite | null {
  const r = (input ?? {}) as Partial<Favorite>
  if (typeof r.id !== 'string' || !r.id.trim()) return null
  if (typeof r.messageId !== 'string' || !r.messageId.trim()) return null
  if (typeof r.characterId !== 'string') return null
  const now = Date.now()
  const content = typeof r.content === 'string' ? r.content : ''
  const timestamp = typeof r.timestamp === 'number' && Number.isFinite(r.timestamp) ? r.timestamp : now
  const createdAt = typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : now
  return {
    id: r.id.trim(),
    messageId: r.messageId.trim(),
    characterId: r.characterId,
    content,
    timestamp,
    createdAt,
  }
}

function normalizeChatConversationSettingsRow(input: unknown): ChatConversationSettingsRow | null {
  const r = (input ?? {}) as Partial<ChatConversationSettingsRow>
  if (typeof r.conversationKey !== 'string' || !r.conversationKey.trim()) return null
  if (typeof r.peerCharacterId !== 'string') return null
  if (typeof r.playerIdentityId !== 'string') return null
  const now = Date.now()
  return {
    conversationKey: r.conversationKey.trim(),
    peerCharacterId: r.peerCharacterId,
    playerIdentityId: r.playerIdentityId,
    isPinned: typeof r.isPinned === 'boolean' ? r.isPinned : false,
    isMuted: typeof r.isMuted === 'boolean' ? r.isMuted : false,
    hiddenFromMessageList:
      typeof (r as { hiddenFromMessageList?: unknown }).hiddenFromMessageList === 'boolean'
        ? !!(r as { hiddenFromMessageList?: boolean }).hiddenFromMessageList
        : false,
    notifyEnabled: typeof (r as any).notifyEnabled === 'boolean' ? !!(r as any).notifyEnabled : true,
    showThinkingChain: typeof (r as { showThinkingChain?: unknown }).showThinkingChain === 'boolean'
      ? !!(r as { showThinkingChain?: unknown }).showThinkingChain
      : false,
    isDanmakuMode: typeof r.isDanmakuMode === 'boolean' ? r.isDanmakuMode : false,
    chatBackground: typeof r.chatBackground === 'string' ? r.chatBackground : '',
    lastMessageTime:
      typeof r.lastMessageTime === 'number' && Number.isFinite(r.lastMessageTime) ? r.lastMessageTime : 0,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : now,
  }
}

function normalizeGroupChatRow(input: unknown): GroupChatRow | null {
  const r = (input ?? {}) as Partial<GroupChatRow>
  if (typeof r.id !== 'string' || !r.id.trim()) return null
  const now = Date.now()
  const memberIds = Array.isArray(r.memberIds)
    ? (r.memberIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  return {
    id: r.id.trim(),
    name: typeof r.name === 'string' ? r.name : '群聊',
    avatar: typeof r.avatar === 'string' ? r.avatar : '',
    memberIds,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : now,
  }
}

function normalizeNetworkGraphView(input: unknown): NetworkGraphViewRecord | null {
  const now = Date.now()
  const v = (input ?? {}) as Partial<NetworkGraphViewRecord>
  if (typeof v.id !== 'string' || typeof v.rootCharacterId !== 'string' || typeof v.perspectiveCharacterId !== 'string') {
    return null
  }
  const pan = v.pan && typeof v.pan === 'object' ? (v.pan as { x?: unknown; y?: unknown }) : null
  const px = typeof pan?.x === 'number' ? pan.x : 0
  const py = typeof pan?.y === 'number' ? pan.y : 0
  const positions: Record<string, { x: number; y: number }> = {}
  if (v.positions && typeof v.positions === 'object' && !Array.isArray(v.positions)) {
    for (const [k, val] of Object.entries(v.positions as Record<string, unknown>)) {
      if (!val || typeof val !== 'object') continue
      const p = val as { x?: unknown; y?: unknown }
      if (typeof p.x === 'number' && typeof p.y === 'number') positions[k] = { x: p.x, y: p.y }
    }
  }
  return {
    id: v.id,
    rootCharacterId: v.rootCharacterId,
    perspectiveCharacterId: v.perspectiveCharacterId,
    scale: typeof v.scale === 'number' && Number.isFinite(v.scale) ? v.scale : 1,
    pan: { x: px, y: py },
    positions,
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : now,
  }
}

function graphViewId(rootCharacterId: string, perspectiveCharacterId: string) {
  return `${rootCharacterId}::${perspectiveCharacterId}`
}

function normalizePlayerLink(input: unknown, now: number): PlayerNetworkLink {
  const r = (input ?? {}) as Partial<PlayerNetworkLink>
  return {
    id: typeof r.id === 'string' ? r.id : `pl-${now}-${Math.random().toString(36).slice(2, 8)}`,
    characterId: typeof r.characterId === 'string' ? r.characterId : '',
    relationYouToThem: typeof r.relationYouToThem === 'string' ? r.relationYouToThem : '',
    relationThemToYou: typeof r.relationThemToYou === 'string' ? r.relationThemToYou : '',
    youSeeThem: typeof r.youSeeThem === 'string' ? r.youSeeThem : '',
    theySeeYou: typeof r.theySeeYou === 'string' ? r.theySeeYou : '',
  }
}

type PlayerLinksRecord = {
  rootCharacterId: string
  links: PlayerNetworkLink[]
  updatedAt: number
}

function normalizeCharacterMemory(input: unknown): CharacterMemory | null {
  const m = (input ?? {}) as Partial<CharacterMemory>
  if (typeof m.id !== 'string' || typeof m.characterId !== 'string') return null
  const now = Date.now()
  return {
    id: m.id,
    characterId: m.characterId,
    content: typeof m.content === 'string' ? m.content : '',
    createdAt: typeof m.createdAt === 'number' ? m.createdAt : now,
    updatedAt: typeof m.updatedAt === 'number' ? m.updatedAt : now,
    isAutoGenerated: typeof m.isAutoGenerated === 'boolean' ? m.isAutoGenerated : false,
  }
}

function normalizeMemorySettingsRow(input: unknown): MemorySettingsRow {
  const r = (input ?? {}) as Partial<MemorySettingsRow>
  const autoSummaryEnabled = typeof r.autoSummaryEnabled === 'boolean' ? r.autoSummaryEnabled : true
  const n =
    typeof r.autoSummaryInterval === 'number' && Number.isFinite(r.autoSummaryInterval)
      ? Math.max(1, Math.min(100, Math.floor(r.autoSummaryInterval)))
      : 10
  const mapRaw = r.aiRoundCountByConversation
  const aiRoundCountByConversation: Record<string, number> = {}
  if (mapRaw && typeof mapRaw === 'object' && !Array.isArray(mapRaw)) {
    for (const [k, v] of Object.entries(mapRaw as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) aiRoundCountByConversation[k] = Math.floor(v)
    }
  }
  const cursorRaw = r.summaryCursorTimestampByConversation
  const summaryCursorTimestampByConversation: Record<string, number> = {}
  if (cursorRaw && typeof cursorRaw === 'object' && !Array.isArray(cursorRaw)) {
    for (const [k, v] of Object.entries(cursorRaw as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        summaryCursorTimestampByConversation[k] = Math.floor(v)
      }
    }
  }
  const datingCursorRaw = r.datingPlotSummaryCursorByCharacterId
  const datingPlotSummaryCursorByCharacterId: Record<string, number> = {}
  if (datingCursorRaw && typeof datingCursorRaw === 'object' && !Array.isArray(datingCursorRaw)) {
    for (const [k, v] of Object.entries(datingCursorRaw as Record<string, unknown>)) {
      const kk = k.trim()
      if (!kk) continue
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        datingPlotSummaryCursorByCharacterId[kk] = Math.floor(v)
      }
    }
  }
  return {
    id: 'default',
    autoSummaryEnabled,
    autoSummaryInterval: n,
    aiRoundCountByConversation:
      Object.keys(aiRoundCountByConversation).length > 0 ? aiRoundCountByConversation : undefined,
    summaryCursorTimestampByConversation:
      Object.keys(summaryCursorTimestampByConversation).length > 0 ? summaryCursorTimestampByConversation : undefined,
    datingPlotSummaryCursorByCharacterId:
      Object.keys(datingPlotSummaryCursorByCharacterId).length > 0 ? datingPlotSummaryCursorByCharacterId : undefined,
  }
}

function localDateKeyFromTimestamp(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfLocalDayFromDateKey(dateKey: string): number | null {
  const p = dateKey.trim().split('-').map(Number)
  if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return null
  const [y, mo, da] = p
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return null
  const t = new Date(y, mo - 1, da).getTime()
  if (!Number.isFinite(t)) return null
  return t
}

function normalizeRelationship(input: unknown): Relationship {
  const now = Date.now()
  const r = (input ?? {}) as Partial<Relationship>
  return {
    id: typeof r.id === 'string' ? r.id : `rel-${now}-${Math.random().toString(36).slice(2, 8)}`,
    fromCharacterId: typeof r.fromCharacterId === 'string' ? r.fromCharacterId : '',
    toCharacterId: typeof r.toCharacterId === 'string' ? r.toCharacterId : '',
    relation: typeof r.relation === 'string' ? r.relation : '',
    fromPerspective: typeof r.fromPerspective === 'string' ? r.fromPerspective : '',
    toPerspective: typeof r.toPerspective === 'string' ? r.toPerspective : '',
    isPlayerIdentity: typeof (r as { isPlayerIdentity?: unknown }).isPlayerIdentity === 'boolean' ? r.isPlayerIdentity : false,
  }
}

export type FriendRequestRow = {
  /** `fr-${playerIdentityId}-${characterId}` */
  id: string
  characterId: string
  playerIdentityId: string
  source: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: number
  updatedAt: number
}

function normalizeFriendRequestRow(input: unknown): FriendRequestRow | null {
  const now = Date.now()
  const r = (input ?? {}) as Partial<FriendRequestRow>
  const characterId = typeof r.characterId === 'string' ? r.characterId.trim() : ''
  const playerIdentityId = typeof r.playerIdentityId === 'string' ? r.playerIdentityId.trim() : ''
  const id =
    typeof r.id === 'string' && r.id.trim()
      ? r.id.trim()
      : characterId && playerIdentityId
        ? `fr-${playerIdentityId}-${characterId}`
        : ''
  if (!id || !characterId || !playerIdentityId) return null
  const status: FriendRequestRow['status'] =
    r.status === 'accepted' || r.status === 'declined' || r.status === 'pending' ? r.status : 'pending'
  const createdAt = typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : now
  const updatedAt = typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : now
  return {
    id,
    characterId,
    playerIdentityId,
    source: typeof r.source === 'string' ? r.source : '',
    status,
    createdAt,
    updatedAt,
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = req.result
      const oldV = event.oldVersion
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(IDENTITY_STORE)) {
        const store = db.createObjectStore(IDENTITY_STORE, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(REL_STORE)) {
        const rs = db.createObjectStore(REL_STORE, { keyPath: 'id' })
        rs.createIndex('fromCharacterId', 'fromCharacterId', { unique: false })
        rs.createIndex('toCharacterId', 'toCharacterId', { unique: false })
      }
      if (!db.objectStoreNames.contains(GRAPH_VIEW_STORE)) {
        const gs = db.createObjectStore(GRAPH_VIEW_STORE, { keyPath: 'id' })
        gs.createIndex('rootCharacterId', 'rootCharacterId', { unique: false })
      }
      if (!db.objectStoreNames.contains(PLAYER_LINKS_STORE)) {
        db.createObjectStore(PLAYER_LINKS_STORE, { keyPath: 'rootCharacterId' })
      }
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
        const cms = db.createObjectStore(CHAT_MSG_STORE, { keyPath: 'id' })
        cms.createIndex('conversationKey', 'conversationKey', { unique: false })
      }
      if (!db.objectStoreNames.contains(MEMORY_SETTINGS_STORE)) {
        db.createObjectStore(MEMORY_SETTINGS_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(CHARACTER_MEMORIES_STORE)) {
        const mem = db.createObjectStore(CHARACTER_MEMORIES_STORE, { keyPath: 'id' })
        mem.createIndex('characterId', 'characterId', { unique: false })
      }
      if (!db.objectStoreNames.contains(CHAT_THEME_STORE)) {
        db.createObjectStore(CHAT_THEME_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(WORLD_BG_STORE)) {
        db.createObjectStore(WORLD_BG_STORE, { keyPath: 'id' })
      }
      if (oldV < 9) {
        const tx = (event.target as IDBOpenDBRequest).transaction
        if (tx && db.objectStoreNames.contains(WORLD_BG_STORE)) {
          const wbs = tx.objectStore(WORLD_BG_STORE)
          for (const w of buildPresetWorldBackgrounds()) {
            wbs.put(normalizeWorldBackground(w))
          }
        }
      }
      if (oldV < 10) {
        const tx = (event.target as IDBOpenDBRequest).transaction
        if (tx && db.objectStoreNames.contains(WORLD_BG_STORE)) {
          const wbs = tx.objectStore(WORLD_BG_STORE)
          for (const w of buildPresetWorldBackgrounds()) {
            wbs.put(normalizeWorldBackground(w))
          }
        }
      }
      if (!db.objectStoreNames.contains(PHONE_KV_STORE)) {
        db.createObjectStore(PHONE_KV_STORE, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE)) {
        const cs = db.createObjectStore(CHAT_CONV_SETTINGS_STORE, { keyPath: 'conversationKey' })
        cs.createIndex('playerIdentityId', 'playerIdentityId', { unique: false })
      }
      if (!db.objectStoreNames.contains(GROUP_CHATS_STORE)) {
        db.createObjectStore(GROUP_CHATS_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(FRIEND_REQUEST_STORE)) {
        const fr = db.createObjectStore(FRIEND_REQUEST_STORE, { keyPath: 'id' })
        fr.createIndex('playerIdentityId', 'playerIdentityId', { unique: false })
        fr.createIndex('characterId', 'characterId', { unique: false })
        fr.createIndex('createdAt', 'createdAt', { unique: false })
        fr.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
      if (oldV < 13) {
        const tx = (event.target as IDBOpenDBRequest).transaction
        if (tx && db.objectStoreNames.contains(CHAT_MSG_STORE)) {
          const cms = tx.objectStore(CHAT_MSG_STORE)
          if (!cms.indexNames.contains(CHAT_MSG_INDEX_CONV_TS)) {
            cms.createIndex(CHAT_MSG_INDEX_CONV_TS, ['conversationKey', 'timestamp'], { unique: false })
          }
        }
      }
      if (!db.objectStoreNames.contains(GLOBAL_SETTINGS_STORE)) {
        db.createObjectStore(GLOBAL_SETTINGS_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(CHARACTER_DANMAKU_STORE)) {
        db.createObjectStore(CHARACTER_DANMAKU_STORE, { keyPath: 'characterId' })
      }
      if (!db.objectStoreNames.contains(CHARACTER_NOTIFY_STORE)) {
        db.createObjectStore(CHARACTER_NOTIFY_STORE, { keyPath: 'characterId' })
      }
      if (!db.objectStoreNames.contains(CHARACTER_BUSY_STORE)) {
        db.createObjectStore(CHARACTER_BUSY_STORE, { keyPath: 'characterId' })
      }
      if (!db.objectStoreNames.contains(CHARACTER_TIME_STORE)) {
        db.createObjectStore(CHARACTER_TIME_STORE, { keyPath: 'characterId' })
      }
      if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
        const fav = db.createObjectStore(FAVORITES_STORE, { keyPath: 'id' })
        fav.createIndex('messageId', 'messageId', { unique: false })
        fav.createIndex('characterId', 'characterId', { unique: false })
        fav.createIndex('createdAt', 'createdAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(HEART_WHISPER_STORE)) {
        db.createObjectStore(HEART_WHISPER_STORE, { keyPath: 'characterId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('open indexeddb failed'))
  })
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('tx aborted'))
    tx.onerror = () => reject(tx.error ?? new Error('tx error'))
  })
}

export function emitWeChatStorageChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('wechat-storage-changed'))
}

export class PersonaDb {
  // -------- player identity --------

  async listPlayerIdentities(): Promise<PlayerIdentity[]> {
    const db = await openDb()
    const tx = db.transaction(IDENTITY_STORE, 'readonly')
    const store = tx.objectStore(IDENTITY_STORE)
    const req = store.getAll()
    const res = await new Promise<PlayerIdentity[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as PlayerIdentity[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('getAll identities failed'))
    })
    await txDone(tx)
    db.close()
    return res.map(normalizeCharacter).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  }

  async getPlayerIdentity(id: string): Promise<PlayerIdentity | null> {
    const db = await openDb()
    const tx = db.transaction(IDENTITY_STORE, 'readonly')
    const store = tx.objectStore(IDENTITY_STORE)
    const req = store.get(id)
    const res = await new Promise<PlayerIdentity | null>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as PlayerIdentity) ?? null)
      req.onerror = () => reject(req.error ?? new Error('get identity failed'))
    })
    await txDone(tx)
    db.close()
    return res ? normalizeCharacter(res) : null
  }

  async upsertPlayerIdentity(identity: PlayerIdentity): Promise<void> {
    const db = await openDb()
    const tx = db.transaction(IDENTITY_STORE, 'readwrite')
    tx.objectStore(IDENTITY_STORE).put(normalizeCharacter(identity))
    await txDone(tx)
    db.close()
  }

  async deletePlayerIdentity(id: string): Promise<void> {
    const db = await openDb()
    const stores: string[] = [IDENTITY_STORE, REL_STORE, CONFIG_STORE]
    const tx = db.transaction(stores, 'readwrite')
    tx.objectStore(IDENTITY_STORE).delete(id)

    // 清理身份相关关系
    const relStore = tx.objectStore(REL_STORE)
    const relReq = relStore.getAll()
    const rels = await new Promise<Relationship[]>((resolve, reject) => {
      relReq.onsuccess = () => resolve((relReq.result as Relationship[]) ?? [])
      relReq.onerror = () => reject(relReq.error ?? new Error('rel getAll'))
    })
    for (const r of rels) {
      if (r.isPlayerIdentity && (r.fromCharacterId === id || r.toCharacterId === id)) relStore.delete(r.id)
    }

    // 若删除的是当前身份，清空 currentIdentityId
    const cfgStore = tx.objectStore(CONFIG_STORE)
    const cfgReq = cfgStore.get('global')
    const cfg = await new Promise<Record<string, unknown> | null>((resolve) => {
      cfgReq.onsuccess = () => resolve((cfgReq.result as Record<string, unknown>) ?? null)
      cfgReq.onerror = () => resolve(null)
    })
    if (cfg && cfg.currentIdentityId === id) {
      cfgStore.put({ ...cfg, id: 'global', currentIdentityId: '' })
    }

    await txDone(tx)
    db.close()
  }

  async getCurrentIdentityId(): Promise<string> {
    const db = await openDb()
    const tx = db.transaction(CONFIG_STORE, 'readonly')
    const req = tx.objectStore(CONFIG_STORE).get('global')
    const row = await new Promise<Record<string, unknown> | null>((resolve) => {
      req.onsuccess = () => resolve((req.result as Record<string, unknown>) ?? null)
      req.onerror = () => resolve(null)
    })
    await txDone(tx)
    db.close()
    return typeof row?.currentIdentityId === 'string' ? (row.currentIdentityId as string) : ''
  }

  async setCurrentIdentityId(identityId: string): Promise<void> {
    const prev = (await this.getCurrentIdentityId()).trim()
    const next = identityId.trim()

    const db = await openDb()
    const tx = db.transaction(CONFIG_STORE, 'readwrite')
    const store = tx.objectStore(CONFIG_STORE)
    const req = store.get('global')
    const row = await new Promise<Record<string, unknown> | null>((resolve) => {
      req.onsuccess = () => resolve((req.result as Record<string, unknown>) ?? null)
      req.onerror = () => resolve(null)
    })
    store.put({ ...(row ?? {}), id: 'global', currentIdentityId: identityId })
    await txDone(tx)
    db.close()

    // 曾用「未选身份」下的 __none__ 会话聊过天、之后首次设置当前身份时，把记录迁到新 key，避免对话「整段消失」
    if (!prev && next && next !== '__none__') {
      await this.migrateWeChatDataFromNonePlayerIdentity(next)
    }
  }

  /**
   * 将会话主键为 `角色id::__none__` 的聊天与偏好迁到真实身份（与 `wechatConversationKey` 一致）。
   * 数据始终在 IndexedDB；仅 conversationKey 与当前身份不一致时，界面会显示为空。
   */
  async migrateWeChatDataFromNonePlayerIdentity(toPlayerIdentityId: string): Promise<void> {
    const toPid = toPlayerIdentityId.trim()
    if (!toPid || toPid === '__none__') return
    const fromPid = '__none__'
    let touched = false

    const db = await openDb()
    try {
      if (db.objectStoreNames.contains(CHAT_MSG_STORE)) {
        const tx = db.transaction(CHAT_MSG_STORE, 'readwrite')
        const store = tx.objectStore(CHAT_MSG_STORE)
        const all = await new Promise<unknown[]>((resolve, reject) => {
          const r = store.getAll()
          r.onsuccess = () => resolve((r.result as unknown[]) ?? [])
          r.onerror = () => reject(r.error ?? new Error('migrateWeChatDataFromNonePlayerIdentity: messages'))
        })
        for (const raw of all) {
          const m = normalizeWeChatChatMessage(raw)
          if (!m || m.playerIdentityId !== fromPid) continue
          const nextCk = wechatConversationKey(m.characterId, toPid)
          const merged = normalizeWeChatChatMessage({ ...m, playerIdentityId: toPid, conversationKey: nextCk })
          if (!merged) continue
          store.put(merged)
          touched = true
        }
        await txDone(tx)
      }

      if (db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE)) {
        const tx = db.transaction(CHAT_CONV_SETTINGS_STORE, 'readwrite')
        const store = tx.objectStore(CHAT_CONV_SETTINGS_STORE)
        const all = await new Promise<unknown[]>((resolve, reject) => {
          const r = store.getAll()
          r.onsuccess = () => resolve((r.result as unknown[]) ?? [])
          r.onerror = () => reject(r.error ?? new Error('migrateWeChatDataFromNonePlayerIdentity: conv settings'))
        })
        for (const raw of all) {
          const row = normalizeChatConversationSettingsRow(raw)
          if (!row || row.playerIdentityId !== fromPid) continue
          const newKey = wechatConversationKey(row.peerCharacterId, toPid)
          if (newKey === row.conversationKey) continue

          const existingRaw = await new Promise<unknown>((resolve, reject) => {
            const r = store.get(newKey)
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
          const existing = normalizeChatConversationSettingsRow(existingRaw)
          store.delete(row.conversationKey)
          if (existing) {
            store.put({
              ...existing,
              lastMessageTime: Math.max(row.lastMessageTime, existing.lastMessageTime),
              updatedAt: Math.max(row.updatedAt, existing.updatedAt),
            })
          } else {
            store.put({ ...row, conversationKey: newKey, playerIdentityId: toPid })
          }
          touched = true
        }
        await txDone(tx)
      }
    } finally {
      db.close()
    }

    if (touched) emitWeChatStorageChanged()
  }

  async getCurrentIdentity(): Promise<PlayerIdentity | null> {
    const id = await this.getCurrentIdentityId()
    if (!id) return null
    return await this.getPlayerIdentity(id)
  }

  async listCharacters(): Promise<Stored[]> {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    const res = await new Promise<Stored[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as Stored[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('getAll failed'))
    })
    await txDone(tx)
    db.close()
    return res.map(normalizeCharacter).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  }

  /** 仅主角/独立角色（人脉 NPC 不在列表展示） */
  async listRootCharacters(): Promise<Stored[]> {
    const all = await this.listCharacters()
    return all.filter((c) => !c.generatedForCharacterId)
  }

  async listNpcsFor(mainCharacterId: string): Promise<Stored[]> {
    const all = await this.listCharacters()
    return all.filter((c) => c.generatedForCharacterId === mainCharacterId)
  }

  async getCharacter(id: string): Promise<Stored | null> {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.get(id)
    const res = await new Promise<Stored | null>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as Stored) ?? null)
      req.onerror = () => reject(req.error ?? new Error('get failed'))
    })
    await txDone(tx)
    db.close()
    return res ? normalizeCharacter(res) : null
  }

  async upsertCharacter(c: Stored): Promise<void> {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(normalizeCharacter(c))
    await txDone(tx)
    db.close()
  }

  async updateCharacterContactSettings(
    characterId: string,
    patch: Partial<Pick<Stored, 'remark' | 'isStarred' | 'isBlocked' | 'momentsPermission'>>,
  ): Promise<Stored | null> {
    const current = await this.getCharacter(characterId)
    if (!current) return null
    const next = normalizeCharacter({
      ...current,
      ...patch,
      momentsPermission: {
        blocked: patch.momentsPermission?.blocked ?? current.momentsPermission?.blocked ?? false,
      },
      updatedAt: Date.now(),
    })
    await this.upsertCharacter(next)
    emitWeChatStorageChanged()
    return next
  }

  async deleteCharacter(id: string): Promise<void> {
    const npcs = await this.listNpcsFor(id)
    const idsToRemove = new Set<string>([id, ...npcs.map((n) => n.id)])
    const db = await openDb()
    const stores: string[] = [STORE, REL_STORE]
    if (db.objectStoreNames.contains(GRAPH_VIEW_STORE)) stores.push(GRAPH_VIEW_STORE)
    if (db.objectStoreNames.contains(CHAT_MSG_STORE)) stores.push(CHAT_MSG_STORE)
    if (db.objectStoreNames.contains(CHARACTER_MEMORIES_STORE)) stores.push(CHARACTER_MEMORIES_STORE)
    if (db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE)) stores.push(CHAT_CONV_SETTINGS_STORE)
    if (db.objectStoreNames.contains(CHARACTER_DANMAKU_STORE)) stores.push(CHARACTER_DANMAKU_STORE)
    const tx = db.transaction(stores, 'readwrite')
    const relStore = tx.objectStore(REL_STORE)
    const charStore = tx.objectStore(STORE)

    const relReq = relStore.getAll()
    const rels = await new Promise<Relationship[]>((resolve, reject) => {
      relReq.onsuccess = () => resolve((relReq.result as Relationship[]) ?? [])
      relReq.onerror = () => reject(relReq.error ?? new Error('rel getAll'))
    })
    for (const r of rels) {
      if (idsToRemove.has(r.fromCharacterId) || idsToRemove.has(r.toCharacterId)) {
        relStore.delete(r.id)
      }
    }
    for (const cid of idsToRemove) {
      charStore.delete(cid)
    }
    if (db.objectStoreNames.contains(CHARACTER_MEMORIES_STORE)) {
      const memStore = tx.objectStore(CHARACTER_MEMORIES_STORE)
      const memReq = memStore.getAll()
      const allMem = await new Promise<unknown[]>((resolve, reject) => {
        memReq.onsuccess = () => resolve((memReq.result as unknown[]) ?? [])
        memReq.onerror = () => reject(memReq.error ?? new Error('characterMemories getAll'))
      })
      for (const x of allMem) {
        const row = normalizeCharacterMemory(x)
        if (row && idsToRemove.has(row.characterId)) memStore.delete(row.id)
      }
    }
    if (db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      const cms = tx.objectStore(CHAT_MSG_STORE)
      const mReq = cms.getAll()
      const allMsgs = await new Promise<WeChatChatMessage[]>((resolve, reject) => {
        mReq.onsuccess = () => {
          const raw = (mReq.result as unknown[]) ?? []
          resolve(
            raw
              .map((x) => normalizeWeChatChatMessage(x))
              .filter((x): x is WeChatChatMessage => !!x),
          )
        }
        mReq.onerror = () => reject(mReq.error ?? new Error('chatMessages getAll'))
      })
      for (const msg of allMsgs) {
        if (idsToRemove.has(msg.characterId)) cms.delete(msg.id)
      }
    }
    if (db.objectStoreNames.contains(GRAPH_VIEW_STORE)) {
      const gv = tx.objectStore(GRAPH_VIEW_STORE)
      const gReq = gv.getAll()
      const rows = await new Promise<NetworkGraphViewRecord[]>((resolve, reject) => {
        gReq.onsuccess = () => resolve((gReq.result as NetworkGraphViewRecord[]) ?? [])
        gReq.onerror = () => reject(gReq.error ?? new Error('graphView getAll'))
      })
      for (const row of rows) {
        if (row.rootCharacterId === id || idsToRemove.has(row.perspectiveCharacterId)) gv.delete(row.id)
      }
    }
    if (db.objectStoreNames.contains(PLAYER_LINKS_STORE)) {
      tx.objectStore(PLAYER_LINKS_STORE).delete(id)
    }
    if (db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE)) {
      const css = tx.objectStore(CHAT_CONV_SETTINGS_STORE)
      const csReq = css.getAll()
      const allCs = await new Promise<unknown[]>((resolve, reject) => {
        csReq.onsuccess = () => resolve((csReq.result as unknown[]) ?? [])
        csReq.onerror = () => reject(csReq.error ?? new Error('chatConversationSettings getAll'))
      })
      for (const raw of allCs) {
        const row = normalizeChatConversationSettingsRow(raw)
        if (row && idsToRemove.has(row.peerCharacterId)) css.delete(row.conversationKey)
      }
    }
    if (db.objectStoreNames.contains(CHARACTER_DANMAKU_STORE)) {
      const ds = tx.objectStore(CHARACTER_DANMAKU_STORE)
      for (const cid of idsToRemove) {
        ds.delete(cid)
      }
    }
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  /**
   * 「不告知删除联系人」等场景：清掉该角色在约会页存档、线下总结游标、会话侧记忆计数与 legacy localStorage，
   * 避免重新加回后仍带着旧线下剧情或自动总结状态。
   */
  async purgeWechatDatingArtifactsAndMemoryTracksForCharacterIds(characterIds: string[]): Promise<void> {
    const ids = new Set(characterIds.map((x) => x.trim()).filter(Boolean))
    if (!ids.size) return

    try {
      const arch: Record<string, unknown> = {}
      const idbArch = await this.getPhoneKv(WECHAT_DATING_ARCHIVES_KV_KEY)
      if (idbArch && typeof idbArch === 'object' && !Array.isArray(idbArch)) Object.assign(arch, idbArch as Record<string, unknown>)
      if (typeof localStorage !== 'undefined') {
        try {
          const lsRaw = localStorage.getItem(WECHAT_DATING_ARCHIVES_KV_KEY)
          if (lsRaw) {
            const p = JSON.parse(lsRaw) as unknown
            if (p && typeof p === 'object' && !Array.isArray(p)) Object.assign(arch, p as Record<string, unknown>)
          }
        } catch {
          // ignore
        }
      }
      let archChanged = false
      for (const id of ids) {
        if (id in arch) {
          delete arch[id]
          archChanged = true
        }
      }
      if (archChanged) {
        await this.setPhoneKv(WECHAT_DATING_ARCHIVES_KV_KEY, arch)
        if (typeof localStorage !== 'undefined') {
          try {
            if (Object.keys(arch).length) localStorage.setItem(WECHAT_DATING_ARCHIVES_KV_KEY, JSON.stringify(arch))
            else localStorage.removeItem(WECHAT_DATING_ARCHIVES_KV_KEY)
          } catch {
            // ignore quota
          }
        }
      }
    } catch {
      // ignore
    }

    try {
      const seen = new Map<string, unknown>()
      const idbChars = await this.getPhoneKv(WECHAT_DATING_CHARACTERS_KV_KEY)
      if (Array.isArray(idbChars)) {
        for (const x of idbChars) {
          const id = typeof (x as { id?: unknown })?.id === 'string' ? (x as { id: string }).id.trim() : ''
          if (id) seen.set(id, x)
        }
      }
      if (typeof localStorage !== 'undefined') {
        try {
          const lsRaw = localStorage.getItem(WECHAT_DATING_CHARACTERS_KV_KEY)
          if (lsRaw) {
            const p = JSON.parse(lsRaw) as unknown
            if (Array.isArray(p)) {
              for (const x of p) {
                const id = typeof (x as { id?: unknown })?.id === 'string' ? (x as { id: string }).id.trim() : ''
                if (id) seen.set(id, x)
              }
            }
          }
        } catch {
          // ignore
        }
      }
      if (seen.size) {
        const arr = [...seen.values()]
        const filtered = arr.filter((x) => {
          const id = typeof (x as { id?: unknown })?.id === 'string' ? (x as { id: string }).id.trim() : ''
          return !id || !ids.has(id)
        })
        if (filtered.length !== arr.length) {
          await this.setPhoneKv(WECHAT_DATING_CHARACTERS_KV_KEY, filtered)
          if (typeof localStorage !== 'undefined') {
            try {
              if (filtered.length) localStorage.setItem(WECHAT_DATING_CHARACTERS_KV_KEY, JSON.stringify(filtered))
              else localStorage.removeItem(WECHAT_DATING_CHARACTERS_KV_KEY)
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      // ignore
    }

    for (const id of ids) {
      try {
        await this.deletePhoneKv(`${WECHAT_DATING_HEART_WHISPER_KV_PREFIX}${id}`)
      } catch {
        // ignore
      }
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(`${WECHAT_DATING_STYLE_TUNING_LS_PREFIX}${id}`)
        }
      } catch {
        // ignore
      }
    }

    try {
      const settings = await this.getMemorySettings()
      const datingMap = { ...(settings.datingPlotSummaryCursorByCharacterId ?? {}) }
      for (const id of ids) delete datingMap[id]
      const aiMap = { ...(settings.aiRoundCountByConversation ?? {}) }
      for (const k of Object.keys(aiMap)) {
        const peer = k.split('::')[0]?.trim()
        if (peer && ids.has(peer)) delete aiMap[k]
      }
      const sumMap = { ...(settings.summaryCursorTimestampByConversation ?? {}) }
      for (const k of Object.keys(sumMap)) {
        const peer = k.split('::')[0]?.trim()
        if (peer && ids.has(peer)) delete sumMap[k]
      }
      await this.putMemorySettings(
        {
          datingPlotSummaryCursorByCharacterId: Object.keys(datingMap).length ? datingMap : undefined,
          aiRoundCountByConversation: Object.keys(aiMap).length ? aiMap : undefined,
          summaryCursorTimestampByConversation: Object.keys(sumMap).length ? sumMap : undefined,
        },
        { emit: false },
      )
    } catch {
      // ignore
    }
  }

  /**
   * 清理通讯录侧数据（聊天/记忆/会话设置/弹幕/图谱视图/玩家链接），
   * 保留角色本体与角色-角色关系边。
   */
  async deleteCharacterDataKeepNetworkRelationships(characterIds: string[]): Promise<void> {
    if (!characterIds.length) return
    const idsToRemove = new Set(characterIds.map((x) => x.trim()).filter(Boolean))
    if (!idsToRemove.size) return

    await this.purgeWechatDatingArtifactsAndMemoryTracksForCharacterIds([...idsToRemove])

    const db = await openDb()
    const stores: string[] = []
    if (db.objectStoreNames.contains(GRAPH_VIEW_STORE)) stores.push(GRAPH_VIEW_STORE)
    if (db.objectStoreNames.contains(CHAT_MSG_STORE)) stores.push(CHAT_MSG_STORE)
    if (db.objectStoreNames.contains(CHARACTER_MEMORIES_STORE)) stores.push(CHARACTER_MEMORIES_STORE)
    if (db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE)) stores.push(CHAT_CONV_SETTINGS_STORE)
    if (db.objectStoreNames.contains(CHARACTER_DANMAKU_STORE)) stores.push(CHARACTER_DANMAKU_STORE)
    if (db.objectStoreNames.contains(PLAYER_LINKS_STORE)) stores.push(PLAYER_LINKS_STORE)
    if (db.objectStoreNames.contains(HEART_WHISPER_STORE)) stores.push(HEART_WHISPER_STORE)
    if (!stores.length) {
      db.close()
      emitWeChatStorageChanged()
      return
    }
    const tx = db.transaction(stores, 'readwrite')

    if (db.objectStoreNames.contains(CHARACTER_MEMORIES_STORE)) {
      const memStore = tx.objectStore(CHARACTER_MEMORIES_STORE)
      const memReq = memStore.getAll()
      const allMem = await new Promise<unknown[]>((resolve, reject) => {
        memReq.onsuccess = () => resolve((memReq.result as unknown[]) ?? [])
        memReq.onerror = () => reject(memReq.error ?? new Error('characterMemories getAll'))
      })
      for (const x of allMem) {
        const row = normalizeCharacterMemory(x)
        if (row && idsToRemove.has(row.characterId)) memStore.delete(row.id)
      }
    }

    if (db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      const cms = tx.objectStore(CHAT_MSG_STORE)
      const mReq = cms.getAll()
      const allMsgs = await new Promise<WeChatChatMessage[]>((resolve, reject) => {
        mReq.onsuccess = () => {
          const raw = (mReq.result as unknown[]) ?? []
          resolve(
            raw
              .map((x) => normalizeWeChatChatMessage(x))
              .filter((x): x is WeChatChatMessage => !!x),
          )
        }
        mReq.onerror = () => reject(mReq.error ?? new Error('chatMessages getAll'))
      })
      for (const msg of allMsgs) {
        if (idsToRemove.has(msg.characterId)) cms.delete(msg.id)
      }
    }

    if (db.objectStoreNames.contains(GRAPH_VIEW_STORE)) {
      const gv = tx.objectStore(GRAPH_VIEW_STORE)
      const gReq = gv.getAll()
      const rows = await new Promise<NetworkGraphViewRecord[]>((resolve, reject) => {
        gReq.onsuccess = () => resolve((gReq.result as NetworkGraphViewRecord[]) ?? [])
        gReq.onerror = () => reject(gReq.error ?? new Error('graphView getAll'))
      })
      for (const row of rows) {
        if (idsToRemove.has(row.rootCharacterId) || idsToRemove.has(row.perspectiveCharacterId)) gv.delete(row.id)
      }
    }

    if (db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE)) {
      const css = tx.objectStore(CHAT_CONV_SETTINGS_STORE)
      const csReq = css.getAll()
      const allCs = await new Promise<unknown[]>((resolve, reject) => {
        csReq.onsuccess = () => resolve((csReq.result as unknown[]) ?? [])
        csReq.onerror = () => reject(csReq.error ?? new Error('chatConversationSettings getAll'))
      })
      for (const raw of allCs) {
        const row = normalizeChatConversationSettingsRow(raw)
        if (row && idsToRemove.has(row.peerCharacterId)) css.delete(row.conversationKey)
      }
    }

    if (db.objectStoreNames.contains(CHARACTER_DANMAKU_STORE)) {
      const ds = tx.objectStore(CHARACTER_DANMAKU_STORE)
      for (const cid of idsToRemove) {
        ds.delete(cid)
      }
    }

    if (db.objectStoreNames.contains(PLAYER_LINKS_STORE)) {
      const links = tx.objectStore(PLAYER_LINKS_STORE)
      for (const cid of idsToRemove) {
        links.delete(cid)
      }
    }

    if (db.objectStoreNames.contains(HEART_WHISPER_STORE)) {
      const hs = tx.objectStore(HEART_WHISPER_STORE)
      for (const cid of idsToRemove) {
        hs.delete(cid)
      }
    }

    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  async listAllRelationships(): Promise<Relationship[]> {
    const db = await openDb()
    const tx = db.transaction(REL_STORE, 'readonly')
    const req = tx.objectStore(REL_STORE).getAll()
    const res = await new Promise<Relationship[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as Relationship[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('rel getAll'))
    })
    await txDone(tx)
    db.close()
    return res.map(normalizeRelationship)
  }

  async listRelationshipsInNetwork(characterIds: string[]): Promise<Relationship[]> {
    const set = new Set(characterIds)
    const all = await this.listAllRelationships()
    return all.filter((r) => set.has(r.fromCharacterId) && set.has(r.toCharacterId))
  }

  async listRelationshipsForIdentity(identityId: string): Promise<Relationship[]> {
    const all = await this.listAllRelationships()
    return all.filter((r) => r.isPlayerIdentity && (r.fromCharacterId === identityId || r.toCharacterId === identityId))
  }

  async upsertPlayerIdentityBindings(params: {
    identityId: string
    characterId: string
    identityName?: string
    characterName?: string
  }): Promise<void> {
    const { identityId, characterId, identityName = '你', characterName = '角色' } = params
    const a: Relationship = {
      id: `rel-pi-${identityId}-${characterId}-a`,
      fromCharacterId: identityId,
      toCharacterId: characterId,
      relation: '联系人',
      fromPerspective: `${identityName}认识${characterName}，双方已建立联系。`,
      toPerspective: `${characterName}认识${identityName}，双方已建立联系。`,
      isPlayerIdentity: true,
    }
    const b: Relationship = {
      id: `rel-pi-${identityId}-${characterId}-b`,
      fromCharacterId: characterId,
      toCharacterId: identityId,
      relation: '联系人',
      fromPerspective: `${characterName}认识${identityName}，双方已建立联系。`,
      toPerspective: `${identityName}认识${characterName}，双方已建立联系。`,
      isPlayerIdentity: true,
    }
    const db = await openDb()
    const tx = db.transaction(REL_STORE, 'readwrite')
    const store = tx.objectStore(REL_STORE)
    store.put(normalizeRelationship(a))
    store.put(normalizeRelationship(b))
    await txDone(tx)
    db.close()
  }

  /** 解除「玩家身份 ↔ 角色」双向绑定（与 upsertPlayerIdentityBindings 成对） */
  async deletePlayerIdentityBinding(identityId: string, characterId: string): Promise<void> {
    const db = await openDb()
    const tx = db.transaction(REL_STORE, 'readwrite')
    const store = tx.objectStore(REL_STORE)
    store.delete(`rel-pi-${identityId}-${characterId}-a`)
    store.delete(`rel-pi-${identityId}-${characterId}-b`)
    await txDone(tx)
    db.close()
  }

  async putRelationship(r: Relationship): Promise<void> {
    const db = await openDb()
    const tx = db.transaction(REL_STORE, 'readwrite')
    tx.objectStore(REL_STORE).put(normalizeRelationship(r))
    await txDone(tx)
    db.close()
  }

  async deleteRelationshipById(id: string): Promise<void> {
    const db = await openDb()
    const tx = db.transaction(REL_STORE, 'readwrite')
    tx.objectStore(REL_STORE).delete(id)
    await txDone(tx)
    db.close()
  }

  async bulkPutRelationships(items: Relationship[]): Promise<void> {
    const db = await openDb()
    const tx = db.transaction(REL_STORE, 'readwrite')
    const store = tx.objectStore(REL_STORE)
    for (const r of items) store.put(normalizeRelationship(r))
    await txDone(tx)
    db.close()
  }

  async deleteRelationshipsInvolving(characterId: string): Promise<void> {
    const db = await openDb()
    const tx = db.transaction(REL_STORE, 'readwrite')
    const store = tx.objectStore(REL_STORE)
    const req = store.getAll()
    const rels = await new Promise<Relationship[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as Relationship[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('rel getAll'))
    })
    for (const r of rels) {
      if (r.fromCharacterId === characterId || r.toCharacterId === characterId) store.delete(r.id)
    }
    await txDone(tx)
    db.close()
  }

  async deleteCharacterNpcOnly(npcId: string): Promise<void> {
    const existing = await this.getCharacter(npcId)
    const rootId = existing?.generatedForCharacterId ?? ''
    const db = await openDb()
    const stores: string[] = [STORE, REL_STORE]
    if (db.objectStoreNames.contains(GRAPH_VIEW_STORE)) stores.push(GRAPH_VIEW_STORE)
    if (db.objectStoreNames.contains(PLAYER_LINKS_STORE)) stores.push(PLAYER_LINKS_STORE)
    const tx = db.transaction(stores, 'readwrite')
    const relStore = tx.objectStore(REL_STORE)
    const charStore = tx.objectStore(STORE)
    const relReq = relStore.getAll()
    const rels = await new Promise<Relationship[]>((resolve, reject) => {
      relReq.onsuccess = () => resolve((relReq.result as Relationship[]) ?? [])
      relReq.onerror = () => reject(relReq.error ?? new Error('rel getAll'))
    })
    for (const r of rels) {
      if (r.fromCharacterId === npcId || r.toCharacterId === npcId) relStore.delete(r.id)
    }
    charStore.delete(npcId)
    if (db.objectStoreNames.contains(GRAPH_VIEW_STORE) && rootId) {
      tx.objectStore(GRAPH_VIEW_STORE).delete(graphViewId(rootId, npcId))
    }
    if (db.objectStoreNames.contains(PLAYER_LINKS_STORE) && rootId) {
      const plStore = tx.objectStore(PLAYER_LINKS_STORE)
      const req = plStore.get(rootId)
      const row = await new Promise<PlayerLinksRecord | undefined>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result as PlayerLinksRecord | undefined)
        req.onerror = () => reject(req.error ?? new Error('playerLinks get'))
      })
      if (row?.links?.length) {
        const now = Date.now()
        const next = row.links
          .filter((l) => l.characterId !== npcId)
          .map((l) => normalizePlayerLink(l, now))
        plStore.put({ rootCharacterId: rootId, links: next, updatedAt: now })
      }
    }
    await txDone(tx)
    db.close()
  }

  async getPlayerNetworkLinks(rootCharacterId: string): Promise<PlayerNetworkLink[]> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(PLAYER_LINKS_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(PLAYER_LINKS_STORE, 'readonly')
    const req = tx.objectStore(PLAYER_LINKS_STORE).get(rootCharacterId)
    const row = await new Promise<PlayerLinksRecord | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as PlayerLinksRecord | undefined)
      req.onerror = () => reject(req.error ?? new Error('playerLinks get'))
    })
    await txDone(tx)
    db.close()
    const now = Date.now()
    const raw = row?.links
    if (!Array.isArray(raw)) return []
    return raw.map((l) => normalizePlayerLink(l, now)).filter((l) => l.characterId)
  }

  async putPlayerNetworkLinks(rootCharacterId: string, links: PlayerNetworkLink[]): Promise<void> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(PLAYER_LINKS_STORE)) {
      db.close()
      return
    }
    const now = Date.now()
    const tx = db.transaction(PLAYER_LINKS_STORE, 'readwrite')
    const normalized = links.map((l) => normalizePlayerLink(l, now))
    tx.objectStore(PLAYER_LINKS_STORE).put({
      rootCharacterId,
      links: normalized,
      updatedAt: now,
    })
    await txDone(tx)
    db.close()
  }

  // -------- 微信私聊消息（chatMessages）与读游标 --------

  async appendWeChatChatMessage(
    row: Omit<WeChatChatMessage, 'conversationKey'> & {
      conversationKey?: string
      /** 对方消息用于系统通知标题；不传则不尝试 Notification */
      notifyPeerTitle?: string
    },
  ): Promise<void> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return
    }
    const { notifyPeerTitle, ...msgRow } = row
    const conversationKey =
      msgRow.conversationKey?.trim() || wechatConversationKey(msgRow.characterId, msgRow.playerIdentityId)
    const normalized = normalizeWeChatChatMessage({ ...msgRow, conversationKey })
    if (!normalized) return
    const tx = db.transaction(CHAT_MSG_STORE, 'readwrite')
    tx.objectStore(CHAT_MSG_STORE).put(normalized)
    await txDone(tx)
    db.close()
    await this.mergeConversationLastMessageTime({
      conversationKey,
      peerCharacterId: normalized.characterId,
      playerIdentityId: normalized.playerIdentityId,
      messageTimestamp: normalized.timestamp,
    })
    if (normalized.type === 'character' && notifyPeerTitle?.trim()) {
      const st = await this.getChatConversationSettings(conversationKey)
      maybeNotifyWeChatCharacterMessage({
        conversationKey,
        peerDisplayName: notifyPeerTitle.trim(),
        preview: normalized.content,
        isMuted: !!st?.isMuted,
      })
    }

    if (normalized.type === 'character') {
      await this.maybePlayWeChatNewMessageSound({
        conversationKey,
        peerCharacterId: normalized.characterId,
        playerIdentityId: normalized.playerIdentityId,
      })
    }
  }

  /** 局部更新一条聊天消息（如红包拆封状态），写入后广播 wechat-storage-changed */
  async patchWeChatChatMessageById(
    messageId: string,
    patch: Partial<
      Pick<
        WeChatChatMessage,
      'content' | 'replyTo' | 'images' | 'isRead' | 'originalContent' | 'isRecalled' | 'recallTimestamp' | 'recalledBy'
      >
    > & {
      redPacket?: Partial<WeChatRedPacketPayload>
    voice?: Partial<WeChatVoicePayload>
    },
  ): Promise<void> {
    const tid = messageId.trim()
    if (!tid) return
    const existing = await this.getWeChatChatMessageById(tid)
    if (!existing) return
    const merged: WeChatChatMessage = {
      ...existing,
      ...patch,
      redPacket:
        patch.redPacket !== undefined
          ? existing.redPacket
            ? ({ ...existing.redPacket, ...patch.redPacket } as WeChatRedPacketPayload)
            : (patch.redPacket as WeChatRedPacketPayload)
          : existing.redPacket,
      voice:
        patch.voice !== undefined
          ? existing.voice
            ? ({ ...existing.voice, ...patch.voice } as WeChatVoicePayload)
            : (patch.voice as WeChatVoicePayload)
          : existing.voice,
    }
    const normalized = normalizeWeChatChatMessage(merged)
    if (!normalized) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readwrite')
    tx.objectStore(CHAT_MSG_STORE).put(normalized)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  async deleteWeChatChatMessageById(id: string): Promise<void> {
    const tid = id.trim()
    if (!tid) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readwrite')
    tx.objectStore(CHAT_MSG_STORE).delete(tid)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  async setWeChatChatMessageFavorite(messageId: string, isFavorite: boolean): Promise<void> {
    const id = messageId.trim()
    if (!id) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readwrite')
    const store = tx.objectStore(CHAT_MSG_STORE)
    const req = store.get(id)
    const raw = await new Promise<unknown | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as unknown)
      req.onerror = () => reject(req.error ?? new Error('get message'))
    })
    const msg = normalizeWeChatChatMessage(raw)
    if (msg) {
      store.put({ ...msg, isFavorite })
    }
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  async addFavoriteFromWeChatMessage(msg: WeChatChatMessage): Promise<Favorite | null> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
      db.close()
      return null
    }
    const now = Date.now()
    const fav: Favorite = {
      id: `fav-${now}-${Math.random().toString(36).slice(2, 8)}`,
      messageId: msg.id,
      characterId: msg.characterId,
      content: msg.content,
      timestamp: msg.timestamp,
      createdAt: now,
    }
    const normalized = normalizeFavorite(fav)
    if (!normalized) return null
    const tx = db.transaction(FAVORITES_STORE, 'readwrite')
    tx.objectStore(FAVORITES_STORE).put(normalized)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
    return normalized
  }

  private async maybePlayWeChatNewMessageSound(params: {
    conversationKey: string
    peerCharacterId: string
    playerIdentityId: string
  }): Promise<void> {
    const gs = await this.getGlobalSettings()
    if (!gs.notificationEnabled) return

    const conv = await this.getChatConversationSettings(params.conversationKey)
    if (conv?.isMuted) return

    if (gs.notificationMode === 'character') {
      const cs = await this.getCharacterNotificationSettings(params.peerCharacterId)
      const enabled = cs?.notificationEnabled ?? true
      if (!enabled) return

      // 音频选择：角色自定义 > 全局
      if (cs?.audio?.type === 'custom') {
        await playWeChatNotifySound({ kind: 'base64', base64: cs.audio.customAudioBase64, mime: cs.audio.customAudioMime })
        return
      }
    } else {
      // 全局模式：聊天信息页通知开关（会话级）独立控制
      const enabled = conv?.notifyEnabled ?? true
      if (!enabled) return
    }

    // 全局音频：自定义 > 默认
    if (gs.globalAudio.type === 'custom') {
      await playWeChatNotifySound({
        kind: 'base64',
        base64: gs.globalAudio.customAudioBase64,
        mime: gs.globalAudio.customAudioMime,
      })
      return
    }
    const meta = getWeChatBuiltInNotifySoundMeta(gs.globalAudio.defaultKey)
    await playWeChatNotifySound({ kind: 'url', url: meta.url })
  }

  async listWeChatChatMessagesRecent(params: {
    conversationKey: string
    limit: number
    beforeTimestamp?: number
  }): Promise<WeChatChatMessage[]> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const idx = tx.objectStore(CHAT_MSG_STORE).index('conversationKey')
    const req = idx.getAll(IDBKeyRange.only(params.conversationKey))
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('chatMessages getAll'))
    })
    await txDone(tx)
    db.close()
    const msgs = raw
      .map((x) => normalizeWeChatChatMessage(x))
      .filter((x): x is WeChatChatMessage => !!x)
    const before = params.beforeTimestamp
    const filtered =
      typeof before === 'number' && Number.isFinite(before)
        ? msgs.filter((m) => m.timestamp < before)
        : msgs
    const lim = Math.max(1, Math.min(200, Math.floor(params.limit)))
    const desc = [...filtered].sort((a, b) => b.timestamp - a.timestamp)
    const tail = desc.slice(0, lim)
    tail.reverse()
    return tail
  }

  /**
   * 按角色聚合最近消息（跨玩家身份 / 跨会话 key）。
   * 用于记忆页兜底展示：当当前身份会话下暂无记录时，仍可看到该角色历史。
   */
  async listWeChatChatMessagesRecentByCharacter(params: {
    characterId: string
    limit: number
    beforeTimestamp?: number
  }): Promise<WeChatChatMessage[]> {
    const cid = params.characterId.trim()
    if (!cid) return []
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const req = tx.objectStore(CHAT_MSG_STORE).getAll()
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('chatMessages getAll by character'))
    })
    await txDone(tx)
    db.close()
    const msgs = raw
      .map((x) => normalizeWeChatChatMessage(x))
      .filter((x): x is WeChatChatMessage => !!x && x.characterId === cid)
    const before = params.beforeTimestamp
    const filtered =
      typeof before === 'number' && Number.isFinite(before)
        ? msgs.filter((m) => m.timestamp < before)
        : msgs
    const lim = Math.max(1, Math.min(200, Math.floor(params.limit)))
    const desc = [...filtered].sort((a, b) => b.timestamp - a.timestamp)
    const tail = desc.slice(0, lim)
    tail.reverse()
    return tail
  }

  /** 按角色 id 集合聚合所有私聊消息（时间正序）。 */
  async listWeChatChatMessagesByCharacterIds(characterIds: string[]): Promise<WeChatChatMessage[]> {
    const ids = [...new Set(characterIds.map((x) => x.trim()).filter(Boolean))]
    if (!ids.length) return []
    const idSet = new Set(ids)
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const req = tx.objectStore(CHAT_MSG_STORE).getAll()
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('chatMessages getAll by characterIds'))
    })
    await txDone(tx)
    db.close()
    return raw
      .map((x) => normalizeWeChatChatMessage(x))
      .filter((x): x is WeChatChatMessage => !!x && idSet.has(x.characterId))
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  async getWeChatChatMessageById(id: string): Promise<WeChatChatMessage | null> {
    const tid = id.trim()
    if (!tid) return null
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const req = tx.objectStore(CHAT_MSG_STORE).get(tid)
    const raw = await new Promise<unknown | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as unknown)
      req.onerror = () => reject(req.error ?? new Error('get message'))
    })
    await txDone(tx)
    db.close()
    return normalizeWeChatChatMessage(raw)
  }

  /**
   * 当前玩家身份下所有含红包字段的消息（全库扫描），按时间新→旧排序。
   * 用于红包收发记录页聚合；数据量较大时后续可加 playerIdentityId 索引优化。
   */
  async listWeChatRedPacketMessagesByPlayerIdentity(playerIdentityId: string): Promise<WeChatChatMessage[]> {
    const pid = playerIdentityId.trim()
    if (!pid) return []
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const req = tx.objectStore(CHAT_MSG_STORE).getAll()
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('chatMessages getAll'))
    })
    await txDone(tx)
    db.close()
    const out: WeChatChatMessage[] = []
    for (const x of raw) {
      const m = normalizeWeChatChatMessage(x)
      if (!m || m.playerIdentityId !== pid || !m.redPacket) continue
      out.push(m)
    }
    out.sort((a, b) => b.timestamp - a.timestamp)
    return out
  }

  /** 日历：最早一条时间戳 + 有消息的本地日期键（YYYY-MM-DD），单次游标扫描 */
  async getWeChatConversationCalendarMeta(conversationKey: string, nowMs = Date.now()): Promise<{
    minTimestamp: number | null
    dateKeys: string[]
  }> {
    const ck = conversationKey.trim()
    if (!ck) return { minTimestamp: null, dateKeys: [] }
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return { minTimestamp: null, dateKeys: [] }
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const store = tx.objectStore(CHAT_MSG_STORE)
    if (!store.indexNames.contains(CHAT_MSG_INDEX_CONV_TS)) {
      const idx = store.index('conversationKey')
      const req = idx.getAll(IDBKeyRange.only(ck))
      const raw = await new Promise<unknown[]>((resolve, reject) => {
        req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
        req.onerror = () => reject(req.error ?? new Error('getAll'))
      })
      await txDone(tx)
      db.close()
      const now = nowMs
      let minTs: number | null = null
      const dates = new Set<string>()
      for (const x of raw) {
        const m = normalizeWeChatChatMessage(x)
        if (!m) continue
        if (m.timestamp > now) continue
        minTs = minTs == null ? m.timestamp : Math.min(minTs, m.timestamp)
        dates.add(localDateKeyFromTimestamp(m.timestamp))
      }
      return { minTimestamp: minTs, dateKeys: [...dates].sort() }
    }
    const idx = store.index(CHAT_MSG_INDEX_CONV_TS)
    const now = nowMs
    const range = IDBKeyRange.bound([ck, 0], [ck, now])
    let minTs: number | null = null
    const dates = new Set<string>()
    await new Promise<void>((resolve, reject) => {
      const req = idx.openCursor(range, 'next')
      req.onsuccess = () => {
        const c = req.result
        if (!c) {
          resolve()
          return
        }
        const m = normalizeWeChatChatMessage(c.value)
        if (m && m.conversationKey === ck) {
          minTs = minTs == null ? m.timestamp : Math.min(minTs, m.timestamp)
          dates.add(localDateKeyFromTimestamp(m.timestamp))
        }
        c.continue()
      }
      req.onerror = () => reject(req.error ?? new Error('calendar cursor'))
    })
    await txDone(tx)
    db.close()
    return { minTimestamp: minTs, dateKeys: [...dates].sort() }
  }

  /** 指定本地日 00:00 起第一条消息（含该日 00:00 整点） */
  async getFirstWeChatMessageOnLocalDateKey(
    conversationKey: string,
    dateKey: string,
  ): Promise<WeChatChatMessage | null> {
    const ck = conversationKey.trim()
    const dayStart = startOfLocalDayFromDateKey(dateKey)
    if (!ck || dayStart == null) return null
    const dayEnd = dayStart + 86400000
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const store = tx.objectStore(CHAT_MSG_STORE)
    if (!store.indexNames.contains(CHAT_MSG_INDEX_CONV_TS)) {
      const idx = store.index('conversationKey')
      const req = idx.getAll(IDBKeyRange.only(ck))
      const raw = await new Promise<unknown[]>((resolve, reject) => {
        req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
        req.onerror = () => reject(req.error ?? new Error('getAll'))
      })
      await txDone(tx)
      db.close()
      let best: WeChatChatMessage | null = null
      for (const x of raw) {
        const m = normalizeWeChatChatMessage(x)
        if (!m || m.timestamp < dayStart || m.timestamp >= dayEnd) continue
        if (!best || m.timestamp < best.timestamp) best = m
      }
      return best
    }
    const idx = store.index(CHAT_MSG_INDEX_CONV_TS)
    const range = IDBKeyRange.bound([ck, dayStart], [ck, dayEnd - 1])
    const first = await new Promise<WeChatChatMessage | null>((resolve, reject) => {
      const req = idx.openCursor(range, 'next')
      req.onsuccess = () => {
        const c = req.result
        if (!c) {
          resolve(null)
          return
        }
        const m = normalizeWeChatChatMessage(c.value)
        resolve(m && m.conversationKey === ck ? m : null)
      }
      req.onerror = () => reject(req.error ?? new Error('cursor'))
    })
    await txDone(tx)
    db.close()
    return first
  }

  async listWeChatChatMessagesFromTimestampAsc(params: {
    conversationKey: string
    fromTimestampInclusive: number
    limit: number
  }): Promise<WeChatChatMessage[]> {
    const ck = params.conversationKey.trim()
    if (!ck) return []
    const lim = Math.max(1, Math.min(500, Math.floor(params.limit)))
    const fromTs = params.fromTimestampInclusive
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const store = tx.objectStore(CHAT_MSG_STORE)
    if (!store.indexNames.contains(CHAT_MSG_INDEX_CONV_TS)) {
      const idx = store.index('conversationKey')
      const req = idx.getAll(IDBKeyRange.only(ck))
      const raw = await new Promise<unknown[]>((resolve, reject) => {
        req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
        req.onerror = () => reject(req.error ?? new Error('getAll'))
      })
      await txDone(tx)
      db.close()
      const msgs = raw
        .map((x) => normalizeWeChatChatMessage(x))
        .filter((x): x is WeChatChatMessage => !!x)
        .filter((m) => m.timestamp >= fromTs)
        .sort((a, b) => a.timestamp - b.timestamp)
      return msgs.slice(0, lim)
    }
    const idx = store.index(CHAT_MSG_INDEX_CONV_TS)
    const out: WeChatChatMessage[] = []
    const range = IDBKeyRange.lowerBound([ck, fromTs])
    await new Promise<void>((resolve, reject) => {
      const req = idx.openCursor(range, 'next')
      req.onsuccess = () => {
        const c = req.result
        if (!c || out.length >= lim) {
          resolve()
          return
        }
        const key = c.key as [string, number]
        if (!key || key[0] !== ck) {
          resolve()
          return
        }
        const m = normalizeWeChatChatMessage(c.value)
        if (m) out.push(m)
        c.continue()
      }
      req.onerror = () => reject(req.error ?? new Error('cursor'))
    })
    await txDone(tx)
    db.close()
    return out
  }

  /** 严格早于 beforeTimestamp 的消息，按时间升序返回最多 limit 条（靠近锚点的一侧为较新） */
  async listWeChatChatMessagesBeforeTimestampAsc(params: {
    conversationKey: string
    beforeTimestampExclusive: number
    limit: number
  }): Promise<WeChatChatMessage[]> {
    const ck = params.conversationKey.trim()
    if (!ck) return []
    const before = params.beforeTimestampExclusive
    if (!Number.isFinite(before) || before <= 0) return []
    const lim = Math.max(1, Math.min(200, Math.floor(params.limit)))
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const store = tx.objectStore(CHAT_MSG_STORE)
    if (!store.indexNames.contains(CHAT_MSG_INDEX_CONV_TS)) {
      const idx = store.index('conversationKey')
      const req = idx.getAll(IDBKeyRange.only(ck))
      const raw = await new Promise<unknown[]>((resolve, reject) => {
        req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
        req.onerror = () => reject(req.error ?? new Error('getAll'))
      })
      await txDone(tx)
      db.close()
      const msgs = raw
        .map((x) => normalizeWeChatChatMessage(x))
        .filter((x): x is WeChatChatMessage => !!x)
        .filter((m) => m.timestamp < before)
        .sort((a, b) => b.timestamp - a.timestamp)
      return msgs.slice(0, lim).reverse()
    }
    const idx = store.index(CHAT_MSG_INDEX_CONV_TS)
    const acc: WeChatChatMessage[] = []
    const range = IDBKeyRange.bound([ck, 0], [ck, before - 1])
    await new Promise<void>((resolve, reject) => {
      const req = idx.openCursor(range, 'prev')
      req.onsuccess = () => {
        const c = req.result
        if (!c || acc.length >= lim) {
          resolve()
          return
        }
        const key = c.key as [string, number]
        if (!key || key[0] !== ck) {
          resolve()
          return
        }
        const m = normalizeWeChatChatMessage(c.value)
        if (m && m.timestamp < before) acc.push(m)
        c.continue()
      }
      req.onerror = () => reject(req.error ?? new Error('cursor'))
    })
    await txDone(tx)
    db.close()
    acc.reverse()
    return acc
  }

  /** 列表/搜索用时间格式（与微信一致） */
  formatWeChatMessageListTimestamp(ts: number, nowMs?: number): string {
    return formatWeChatMessageListTimestampFn(ts, nowMs)
  }

  /** 拉取会话内全部消息检索索引（单次游标；仅 id/content/timestamp/type） */
  async listWeChatMessagesForSearchIndex(conversationKey: string): Promise<WeChatMessageSearchIndexRow[]> {
    const ck = conversationKey.trim()
    if (!ck) return []
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const store = tx.objectStore(CHAT_MSG_STORE)
    const out: WeChatMessageSearchIndexRow[] = []
    if (!store.indexNames.contains(CHAT_MSG_INDEX_CONV_TS)) {
      const idx = store.index('conversationKey')
      const req = idx.getAll(IDBKeyRange.only(ck))
      const raw = await new Promise<unknown[]>((resolve, reject) => {
        req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
        req.onerror = () => reject(req.error ?? new Error('getAll'))
      })
      await txDone(tx)
      db.close()
      for (const x of raw) {
        const m = normalizeWeChatChatMessage(x)
        if (!m) continue
        out.push({
          id: m.id,
          content: m.content,
          timestamp: m.timestamp,
          type: m.type,
        })
      }
      return out
    }
    const idx = store.index(CHAT_MSG_INDEX_CONV_TS)
    const range = IDBKeyRange.bound([ck, 0], [ck, Number.MAX_SAFE_INTEGER])
    await new Promise<void>((resolve, reject) => {
      const req = idx.openCursor(range, 'next')
      req.onsuccess = () => {
        const c = req.result
        if (!c) {
          resolve()
          return
        }
        const m = normalizeWeChatChatMessage(c.value)
        if (m && m.conversationKey === ck) {
          out.push({
            id: m.id,
            content: m.content,
            timestamp: m.timestamp,
            type: m.type,
          })
        }
        c.continue()
      }
      req.onerror = () => reject(req.error ?? new Error('search index cursor'))
    })
    await txDone(tx)
    db.close()
    return out
  }

  /**
   * 全文搜索（主线程实现，作 Worker 不可用时的回退；不区分大小写，最多 100 条，新→旧）
   */
  async searchWeChatConversationMessagesByKeyword(
    conversationKey: string,
    keyword: string,
  ): Promise<WeChatMessageSearchIndexRow[]> {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return []
    const rows = await this.listWeChatMessagesForSearchIndex(conversationKey)
    return rows
      .filter((r) => r.content.toLowerCase().includes(kw))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100)
  }

  async getWechatReadCursor(conversationKey: string): Promise<number> {
    const db = await openDb()
    const tx = db.transaction(CONFIG_STORE, 'readonly')
    const req = tx.objectStore(CONFIG_STORE).get('global')
    const row = await new Promise<Record<string, unknown> | null>((resolve) => {
      req.onsuccess = () => resolve((req.result as Record<string, unknown>) ?? null)
      req.onerror = () => resolve(null)
    })
    await txDone(tx)
    db.close()
    const cursors = row?.wechatReadCursors
    if (cursors && typeof cursors === 'object') {
      const v = (cursors as Record<string, unknown>)[conversationKey]
      if (typeof v === 'number' && Number.isFinite(v)) return v
    }
    return 0
  }

  async setWechatReadCursor(conversationKey: string, ts: number): Promise<void> {
    const db = await openDb()
    const tx = db.transaction(CONFIG_STORE, 'readwrite')
    const store = tx.objectStore(CONFIG_STORE)
    const req = store.get('global')
    const row = await new Promise<Record<string, unknown> | null>((resolve) => {
      req.onsuccess = () => resolve((req.result as Record<string, unknown>) ?? null)
      req.onerror = () => resolve(null)
    })
    const prevCursors =
      row?.wechatReadCursors && typeof row.wechatReadCursors === 'object'
        ? { ...(row.wechatReadCursors as Record<string, unknown>) }
        : {}
    prevCursors[conversationKey] = ts
    store.put({ ...(row ?? {}), id: 'global', wechatReadCursors: prevCursors })
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  async countUnreadWeChatCharacterMessages(conversationKey: string): Promise<number> {
    const cursorTs = await this.getWechatReadCursor(conversationKey)
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return 0
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const idx = tx.objectStore(CHAT_MSG_STORE).index('conversationKey')
    const req = idx.getAll(IDBKeyRange.only(conversationKey))
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('chatMessages getAll'))
    })
    await txDone(tx)
    db.close()
    let n = 0
    for (const x of raw) {
      const m = normalizeWeChatChatMessage(x)
      if (!m || m.type !== 'character') continue
      if (m.timestamp > cursorTs) n += 1
    }
    return n
  }

  async markWeChatConversationReadToLatest(conversationKey: string): Promise<void> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const idx = tx.objectStore(CHAT_MSG_STORE).index('conversationKey')
    const req = idx.getAll(IDBKeyRange.only(conversationKey))
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('chatMessages getAll'))
    })
    await txDone(tx)
    db.close()
    let maxTs = 0
    for (const x of raw) {
      const m = normalizeWeChatChatMessage(x)
      if (m) maxTs = Math.max(maxTs, m.timestamp)
    }
    const prev = await this.getWechatReadCursor(conversationKey)
    const next = Math.max(prev, maxTs, Date.now())
    await this.setWechatReadCursor(conversationKey, next)
  }

  /**
   * 将会话标为未读：把读游标挪到最后一条「对方（角色）消息」时间戳之前，
   * 使该条及之后角色消息均计入未读（若无角色消息则游标置 0）。
   */
  async markWeChatConversationUnread(conversationKey: string): Promise<void> {
    const k = conversationKey.trim()
    if (!k) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const idx = tx.objectStore(CHAT_MSG_STORE).index('conversationKey')
    const req = idx.getAll(IDBKeyRange.only(k))
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('chatMessages getAll'))
    })
    await txDone(tx)
    db.close()
    let maxCharTs = 0
    for (const x of raw) {
      const m = normalizeWeChatChatMessage(x)
      if (!m || m.type !== 'character') continue
      maxCharTs = Math.max(maxCharTs, m.timestamp)
    }
    const nextCursor = maxCharTs > 0 ? maxCharTs - 1 : 0
    await this.setWechatReadCursor(k, nextCursor)
  }

  async advanceWechatReadCursor(conversationKey: string, ts: number): Promise<void> {
    const prev = await this.getWechatReadCursor(conversationKey)
    if (ts > prev) await this.setWechatReadCursor(conversationKey, ts)
  }

  // -------- 通讯录「新的朋友」（friendRequests）--------

  async listFriendRequests(params: {
    playerIdentityId: string
    /** 缺省 true：只返回 pending */
    pendingOnly?: boolean
  }): Promise<FriendRequestRow[]> {
    const pid = params.playerIdentityId.trim()
    if (!pid) return []
    const db = await openDb()
    if (!db.objectStoreNames.contains(FRIEND_REQUEST_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(FRIEND_REQUEST_STORE, 'readonly')
    const store = tx.objectStore(FRIEND_REQUEST_STORE)
    const idx = store.index('playerIdentityId')
    const req = idx.getAll(IDBKeyRange.only(pid))
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('friendRequests getAll'))
    })
    await txDone(tx)
    db.close()
    const rows = raw
      .map((x) => normalizeFriendRequestRow(x))
      .filter((x): x is FriendRequestRow => !!x)
      .sort((a, b) => b.updatedAt - a.updatedAt)
    const pendingOnly = params.pendingOnly ?? true
    return pendingOnly ? rows.filter((r) => r.status === 'pending') : rows
  }

  async getFriendRequestById(id: string): Promise<FriendRequestRow | null> {
    const tid = id.trim()
    if (!tid) return null
    const db = await openDb()
    if (!db.objectStoreNames.contains(FRIEND_REQUEST_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(FRIEND_REQUEST_STORE, 'readonly')
    const req = tx.objectStore(FRIEND_REQUEST_STORE).get(tid)
    const raw = await new Promise<unknown>((resolve) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    })
    await txDone(tx)
    db.close()
    return normalizeFriendRequestRow(raw)
  }

  async upsertFriendRequest(row: Omit<FriendRequestRow, 'updatedAt'> & { updatedAt?: number }): Promise<FriendRequestRow | null> {
    const normalized = normalizeFriendRequestRow({ ...row, updatedAt: row.updatedAt ?? Date.now() })
    if (!normalized) return null
    const db = await openDb()
    if (!db.objectStoreNames.contains(FRIEND_REQUEST_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(FRIEND_REQUEST_STORE, 'readwrite')
    tx.objectStore(FRIEND_REQUEST_STORE).put(normalized)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
    return normalized
  }

  async setFriendRequestStatus(requestId: string, status: FriendRequestRow['status']): Promise<void> {
    const id = requestId.trim()
    if (!id) return
    const existing = await this.getFriendRequestById(id)
    if (!existing) return
    await this.upsertFriendRequest({ ...existing, status, updatedAt: Date.now() })
  }

  async deleteFriendRequestById(requestId: string): Promise<void> {
    const id = requestId.trim()
    if (!id) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(FRIEND_REQUEST_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(FRIEND_REQUEST_STORE, 'readwrite')
    tx.objectStore(FRIEND_REQUEST_STORE).delete(id)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  async getNetworkGraphView(rootCharacterId: string, perspectiveCharacterId: string): Promise<NetworkGraphViewRecord | null> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(GRAPH_VIEW_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(GRAPH_VIEW_STORE, 'readonly')
    const req = tx.objectStore(GRAPH_VIEW_STORE).get(graphViewId(rootCharacterId, perspectiveCharacterId))
    const res = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('get graph view'))
    })
    await txDone(tx)
    db.close()
    return normalizeNetworkGraphView(res)
  }

  async putNetworkGraphView(record: NetworkGraphViewRecord): Promise<void> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(GRAPH_VIEW_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(GRAPH_VIEW_STORE, 'readwrite')
    const normalized = normalizeNetworkGraphView({
      ...record,
      updatedAt: Date.now(),
    })
    if (normalized) tx.objectStore(GRAPH_VIEW_STORE).put(normalized)
    await txDone(tx)
    db.close()
  }

  async deleteNetworkGraphView(rootCharacterId: string, perspectiveCharacterId: string): Promise<void> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(GRAPH_VIEW_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(GRAPH_VIEW_STORE, 'readwrite')
    tx.objectStore(GRAPH_VIEW_STORE).delete(graphViewId(rootCharacterId, perspectiveCharacterId))
    await txDone(tx)
    db.close()
  }

  async listNetworkGraphViewsForRoot(rootCharacterId: string): Promise<NetworkGraphViewRecord[]> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(GRAPH_VIEW_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(GRAPH_VIEW_STORE, 'readonly')
    const req = tx.objectStore(GRAPH_VIEW_STORE).getAll()
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('graphView getAll'))
    })
    await txDone(tx)
    db.close()
    const out: NetworkGraphViewRecord[] = []
    for (const raw of rows) {
      const n = normalizeNetworkGraphView(raw)
      if (n && n.rootCharacterId === rootCharacterId) out.push(n)
    }
    return out
  }

  async deleteNetworkGraphViewsForRoot(rootCharacterId: string): Promise<void> {
    const rows = await this.listNetworkGraphViewsForRoot(rootCharacterId)
    if (!rows.length) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(GRAPH_VIEW_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(GRAPH_VIEW_STORE, 'readwrite')
    const store = tx.objectStore(GRAPH_VIEW_STORE)
    for (const r of rows) store.delete(r.id)
    await txDone(tx)
    db.close()
  }

  /** 删除两端均落在给定角色集合内的关系（用于人脉包覆盖导入前清理圈内旧边） */
  async deleteIntraCliqueRelationships(characterIds: string[]): Promise<void> {
    if (!characterIds.length) return
    const set = new Set(characterIds)
    const all = await this.listAllRelationships()
    const victims = all.filter((r) => set.has(r.fromCharacterId) && set.has(r.toCharacterId))
    if (!victims.length) return
    const db = await openDb()
    const tx = db.transaction(REL_STORE, 'readwrite')
    const store = tx.objectStore(REL_STORE)
    for (const r of victims) store.delete(r.id)
    await txDone(tx)
    db.close()
  }

  /** 删除任一端落在给定 id 集合上的「玩家身份绑定」关系（isPlayerIdentity） */
  async deletePlayerIdentityRelationshipsTouchingCharacterIds(characterIds: string[]): Promise<void> {
    if (!characterIds.length) return
    const set = new Set(characterIds)
    const all = await this.listAllRelationships()
    const victims = all.filter(
      (r) => r.isPlayerIdentity && (set.has(r.fromCharacterId) || set.has(r.toCharacterId)),
    )
    if (!victims.length) return
    const db = await openDb()
    const tx = db.transaction(REL_STORE, 'readwrite')
    const store = tx.objectStore(REL_STORE)
    for (const r of victims) store.delete(r.id)
    await txDone(tx)
    db.close()
  }

  // -------- 长期记忆 memorySettings / characterMemories --------

  async getMemorySettings(): Promise<MemorySettingsRow> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(MEMORY_SETTINGS_STORE)) {
      db.close()
      return normalizeMemorySettingsRow(null)
    }
    const tx = db.transaction(MEMORY_SETTINGS_STORE, 'readonly')
    const req = tx.objectStore(MEMORY_SETTINGS_STORE).get('default')
    const res = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('get memorySettings'))
    })
    await txDone(tx)
    db.close()
    return normalizeMemorySettingsRow(res)
  }

  async putMemorySettings(
    partial: Partial<Omit<MemorySettingsRow, 'id'>>,
    opts?: { emit?: boolean },
  ): Promise<void> {
    const prev = await this.getMemorySettings()
    const merged = normalizeMemorySettingsRow({ ...prev, ...partial, id: 'default' })
    const db = await openDb()
    if (!db.objectStoreNames.contains(MEMORY_SETTINGS_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(MEMORY_SETTINGS_STORE, 'readwrite')
    tx.objectStore(MEMORY_SETTINGS_STORE).put(merged)
    await txDone(tx)
    db.close()
    if (opts?.emit !== false) emitWeChatStorageChanged()
  }

  /**
   * 每完成一轮 AI 回复后调用：计数 +1；达到间隔则返回 shouldSummarize 并重置该会话计数。
   */
  async bumpMemoryAiRoundCount(conversationKey: string): Promise<{ shouldSummarize: boolean }> {
    const settings = await this.getMemorySettings()
    if (settings.autoSummaryEnabled === false) {
      return { shouldSummarize: false }
    }
    const interval = settings.autoSummaryInterval
    const map = { ...(settings.aiRoundCountByConversation ?? {}) }
    const prev = map[conversationKey] ?? 0
    const next = prev + 1
    if (next >= interval) {
      delete map[conversationKey]
      await this.putMemorySettings({ aiRoundCountByConversation: map }, { emit: false })
      return { shouldSummarize: true }
    }
    map[conversationKey] = next
    await this.putMemorySettings({ aiRoundCountByConversation: map }, { emit: false })
    return { shouldSummarize: false }
  }

  /**
   * 自动总结触发后若本轮请求失败，将计数回退到“临界值”，保证下一轮回复可再次重试。
   */
  async rollbackMemoryAiRoundCountForRetry(conversationKey: string): Promise<void> {
    const settings = await this.getMemorySettings()
    const interval = Math.max(1, settings.autoSummaryInterval)
    const map = { ...(settings.aiRoundCountByConversation ?? {}) }
    map[conversationKey] = Math.max(0, interval - 1)
    await this.putMemorySettings({ aiRoundCountByConversation: map }, { emit: false })
  }

  /** 读取会话最近一次自动总结覆盖到的消息时间戳；未记录则返回 null。 */
  async getMemorySummaryCursorTimestamp(conversationKey: string): Promise<number | null> {
    const ck = conversationKey.trim()
    if (!ck) return null
    const settings = await this.getMemorySettings()
    const ts = settings.summaryCursorTimestampByConversation?.[ck]
    return typeof ts === 'number' && Number.isFinite(ts) && ts >= 0 ? ts : null
  }

  /** 写入会话自动总结游标（最近一次已总结到的消息时间戳）。 */
  async setMemorySummaryCursorTimestamp(conversationKey: string, timestamp: number): Promise<void> {
    const ck = conversationKey.trim()
    if (!ck || !Number.isFinite(timestamp) || timestamp < 0) return
    const settings = await this.getMemorySettings()
    const map = { ...(settings.summaryCursorTimestampByConversation ?? {}) }
    map[ck] = Math.floor(timestamp)
    await this.putMemorySettings({ summaryCursorTimestampByConversation: map }, { emit: false })
  }

  /** 约会线下剧情：读取上次自动总结覆盖到的 plot 时间戳（未记录视为 null，与「时间戳 > 游标」配对使用） */
  async getDatingPlotSummaryCursor(characterId: string): Promise<number | null> {
    const id = characterId.trim()
    if (!id) return null
    const settings = await this.getMemorySettings()
    const ts = settings.datingPlotSummaryCursorByCharacterId?.[id]
    return typeof ts === 'number' && Number.isFinite(ts) && ts >= 0 ? ts : null
  }

  /** 约会线下剧情：写入自动总结游标（最近一次已总结到的 plot 时间戳闭区间右端） */
  async setDatingPlotSummaryCursor(characterId: string, timestamp: number): Promise<void> {
    const id = characterId.trim()
    if (!id || !Number.isFinite(timestamp) || timestamp < 0) return
    const settings = await this.getMemorySettings()
    const map = { ...(settings.datingPlotSummaryCursorByCharacterId ?? {}) }
    map[id] = Math.floor(timestamp)
    await this.putMemorySettings({ datingPlotSummaryCursorByCharacterId: map }, { emit: false })
  }

  async listCharacterMemoriesForCharacter(characterId: string): Promise<CharacterMemory[]> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHARACTER_MEMORIES_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHARACTER_MEMORIES_STORE, 'readonly')
    const idx = tx.objectStore(CHARACTER_MEMORIES_STORE).index('characterId')
    const req = idx.getAll(IDBKeyRange.only(characterId))
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('characterMemories index getAll'))
    })
    await txDone(tx)
    db.close()
    return raw
      .map((x) => normalizeCharacterMemory(x))
      .filter((x): x is CharacterMemory => !!x)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async listAllCharacterMemories(): Promise<CharacterMemory[]> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHARACTER_MEMORIES_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHARACTER_MEMORIES_STORE, 'readonly')
    const req = tx.objectStore(CHARACTER_MEMORIES_STORE).getAll()
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('characterMemories getAll'))
    })
    await txDone(tx)
    db.close()
    return raw
      .map((x) => normalizeCharacterMemory(x))
      .filter((x): x is CharacterMemory => !!x)
  }

  async upsertCharacterMemory(row: CharacterMemory): Promise<void> {
    const normalized = normalizeCharacterMemory(row)
    if (!normalized) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHARACTER_MEMORIES_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(CHARACTER_MEMORIES_STORE, 'readwrite')
    tx.objectStore(CHARACTER_MEMORIES_STORE).put(normalized)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  /** 用给定列表覆盖指定角色集合的长期记忆。 */
  async replaceCharacterMemoriesByCharacterIds(characterIds: string[], rows: CharacterMemory[]): Promise<void> {
    const ids = [...new Set(characterIds.map((x) => x.trim()).filter(Boolean))]
    if (!ids.length) return
    const idSet = new Set(ids)
    const normalizedRows = rows
      .map((x) => normalizeCharacterMemory(x))
      .filter((x): x is CharacterMemory => !!x && idSet.has(x.characterId))
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHARACTER_MEMORIES_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(CHARACTER_MEMORIES_STORE, 'readwrite')
    const store = tx.objectStore(CHARACTER_MEMORIES_STORE)
    const allReq = store.getAll()
    const all = await new Promise<unknown[]>((resolve, reject) => {
      allReq.onsuccess = () => resolve((allReq.result as unknown[]) ?? [])
      allReq.onerror = () => reject(allReq.error ?? new Error('characterMemories getAll replace'))
    })
    for (const raw of all) {
      const row = normalizeCharacterMemory(raw)
      if (row && idSet.has(row.characterId)) store.delete(row.id)
    }
    for (const row of normalizedRows) store.put(row)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  /** 用给定列表覆盖指定角色集合的私聊消息。 */
  async replaceWeChatChatMessagesByCharacterIds(characterIds: string[], rows: WeChatChatMessage[]): Promise<void> {
    const ids = [...new Set(characterIds.map((x) => x.trim()).filter(Boolean))]
    if (!ids.length) return
    const idSet = new Set(ids)
    const normalizedRows = rows
      .map((x) =>
        normalizeWeChatChatMessage({
          ...x,
          conversationKey: wechatConversationKey(x.characterId, x.playerIdentityId),
        }),
      )
      .filter((x): x is WeChatChatMessage => !!x && idSet.has(x.characterId))
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readwrite')
    const store = tx.objectStore(CHAT_MSG_STORE)
    const allReq = store.getAll()
    const all = await new Promise<unknown[]>((resolve, reject) => {
      allReq.onsuccess = () => resolve((allReq.result as unknown[]) ?? [])
      allReq.onerror = () => reject(allReq.error ?? new Error('chatMessages getAll replace'))
    })
    for (const raw of all) {
      const row = normalizeWeChatChatMessage(raw)
      if (row && idSet.has(row.characterId)) store.delete(row.id)
    }
    for (const row of normalizedRows) store.put(row)
    await txDone(tx)
    db.close()

    for (const msg of normalizedRows) {
      await this.mergeConversationLastMessageTime({
        conversationKey: msg.conversationKey,
        peerCharacterId: msg.characterId,
        playerIdentityId: msg.playerIdentityId,
        messageTimestamp: msg.timestamp,
      })
    }
    emitWeChatStorageChanged()
  }

  async deleteCharacterMemory(id: string): Promise<void> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHARACTER_MEMORIES_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(CHARACTER_MEMORIES_STORE, 'readwrite')
    tx.objectStore(CHARACTER_MEMORIES_STORE).delete(id)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  /** 拼成注入系统提示的【长期记忆】正文；无条目时返回空串 */
  async formatCharacterMemoriesForPrompt(characterId: string): Promise<string> {
    const list = await this.listCharacterMemoriesForCharacter(characterId)
    const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt)
    if (!sorted.length) return ''
    return sorted.map((m, i) => `${i + 1}. ${m.content.trim()}`).join('\n')
  }

  // -------- chat theme (IndexedDB) --------

  async getChatTheme(id: string): Promise<ChatTheme | null> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_THEME_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(CHAT_THEME_STORE, 'readonly')
    const req = tx.objectStore(CHAT_THEME_STORE).get(id)
    const raw = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('getChatTheme'))
    })
    await txDone(tx)
    db.close()
    return raw ? normalizeChatTheme(raw) : null
  }

  async listChatThemes(): Promise<ChatTheme[]> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_THEME_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHAT_THEME_STORE, 'readonly')
    const req = tx.objectStore(CHAT_THEME_STORE).getAll()
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('listChatThemes'))
    })
    await txDone(tx)
    db.close()
    return raw.map((x) => normalizeChatTheme(x))
  }

  async upsertChatTheme(theme: ChatTheme): Promise<void> {
    const normalized = normalizeChatTheme(theme)
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_THEME_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(CHAT_THEME_STORE, 'readwrite')
    tx.objectStore(CHAT_THEME_STORE).put(normalized)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  /** 保证库内存在默认主题；返回当前应使用的主题（优先默认标记） */
  async ensureDefaultChatTheme(): Promise<ChatTheme> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_THEME_STORE)) {
      db.close()
      return DEFAULT_CHAT_THEME
    }
    const tx = db.transaction(CHAT_THEME_STORE, 'readwrite')
    const store = tx.objectStore(CHAT_THEME_STORE)
    const allReq = store.getAll()
    const all = await new Promise<unknown[]>((resolve, reject) => {
      allReq.onsuccess = () => resolve((allReq.result as unknown[]) ?? [])
      allReq.onerror = () => reject(allReq.error ?? new Error('getAll chatTheme'))
    })
    let themes = all.map((x) => normalizeChatTheme(x))
    const hasDefaultRow = themes.some((t) => t.id === DEFAULT_CHAT_THEME_ID)
    if (!hasDefaultRow) {
      store.put(DEFAULT_CHAT_THEME)
      themes = [...themes, DEFAULT_CHAT_THEME]
    } else if (!themes.some((t) => t.isDefault)) {
      const next = themes.map((t) =>
        t.id === DEFAULT_CHAT_THEME_ID ? { ...t, isDefault: true } : { ...t, isDefault: false },
      )
      for (const t of next) store.put(t)
      themes = next
    }
    await txDone(tx)
    db.close()
    let def = themes.find((t) => t.isDefault) ?? themes.find((t) => t.id === DEFAULT_CHAT_THEME_ID) ?? DEFAULT_CHAT_THEME
    /** 历史版本曾错误默认微信绿 #95ec69：迁回与全局微信气泡一致的灰蓝/浅灰 */
    if (def.id === DEFAULT_CHAT_THEME_ID && def.bubble.myBackgroundColor.trim().toLowerCase() === '#95ec69') {
      const migrated: ChatTheme = {
        ...def,
        bubble: {
          ...def.bubble,
          myBackgroundColor: DEFAULT_CHAT_THEME.bubble.myBackgroundColor,
          otherBackgroundColor: DEFAULT_CHAT_THEME.bubble.otherBackgroundColor,
        },
      }
      await this.upsertChatTheme(migrated)
      def = migrated
    }
    return def
  }

  // -------- world backgrounds --------

  async listWorldBackgrounds(): Promise<WorldBackground[]> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(WORLD_BG_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(WORLD_BG_STORE, 'readonly')
    const store = tx.objectStore(WORLD_BG_STORE)
    const req = store.getAll()
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('worldBackgrounds getAll'))
    })
    await txDone(tx)
    db.close()
    const list = rows.map((x) => normalizeWorldBackground(x))
    list.sort((a, b) => {
      if (a.isPreset !== b.isPreset) return a.isPreset ? -1 : 1
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
    })
    return list
  }

  async getWorldBackground(id: string): Promise<WorldBackground | null> {
    if (!id.trim()) return null
    const db = await openDb()
    if (!db.objectStoreNames.contains(WORLD_BG_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(WORLD_BG_STORE, 'readonly')
    const req = tx.objectStore(WORLD_BG_STORE).get(id)
    const res = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('getWorldBackground'))
    })
    await txDone(tx)
    db.close()
    return res ? normalizeWorldBackground(res) : null
  }

  async upsertWorldBackground(w: WorldBackground): Promise<void> {
    const normalized = normalizeWorldBackground(w)
    if (normalized.isPreset) return
    const existing = await this.getWorldBackground(normalized.id)
    if (existing?.isPreset) return

    const db = await openDb()
    if (!db.objectStoreNames.contains(WORLD_BG_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(WORLD_BG_STORE, 'readwrite')
    tx.objectStore(WORLD_BG_STORE).put(normalized)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  /** 仅可删自定义世界；关联角色与身份将切回默认预设 */
  async deleteWorldBackground(id: string): Promise<void> {
    const wb = await this.getWorldBackground(id)
    if (!wb || wb.isPreset) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(WORLD_BG_STORE)) {
      db.close()
      return
    }
    const stores = [WORLD_BG_STORE, STORE, IDENTITY_STORE]
    const tx = db.transaction(stores, 'readwrite')
    tx.objectStore(WORLD_BG_STORE).delete(id)

    const charStore = tx.objectStore(STORE)
    const charReq = charStore.getAll()
    const chars = await new Promise<Character[]>((resolve, reject) => {
      charReq.onsuccess = () => resolve(((charReq.result as Character[]) ?? []).map(normalizeCharacter))
      charReq.onerror = () => reject(charReq.error ?? new Error('chars getAll'))
    })
    for (const c of chars) {
      if (c.worldBackgroundId === id) {
        charStore.put(normalizeCharacter({ ...c, worldBackgroundId: DEFAULT_WORLD_BACKGROUND_ID, updatedAt: Date.now() }))
      }
    }

    const idStore = tx.objectStore(IDENTITY_STORE)
    const idReq = idStore.getAll()
    const ids = await new Promise<PlayerIdentity[]>((resolve, reject) => {
      idReq.onsuccess = () => resolve(((idReq.result as PlayerIdentity[]) ?? []).map(normalizeCharacter))
      idReq.onerror = () => reject(idReq.error ?? new Error('identities getAll'))
    })
    for (const p of ids) {
      if (p.worldBackgroundId === id) {
        idStore.put(normalizeCharacter({ ...p, worldBackgroundId: DEFAULT_WORLD_BACKGROUND_ID, updatedAt: Date.now() }))
      }
    }

    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  /** 通用键值（手机壳 / API / 约会等非人设数据），存 IndexedDB，避免 localStorage 配额过小 */
  async getPhoneKv(key: string): Promise<unknown | null> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(PHONE_KV_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(PHONE_KV_STORE, 'readonly')
    const req = tx.objectStore(PHONE_KV_STORE).get(key)
    const row = await new Promise<{ key: string; value: unknown } | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as { key: string; value: unknown } | undefined)
      req.onerror = () => reject(req.error ?? new Error('getPhoneKv'))
    })
    await txDone(tx)
    db.close()
    return row ? row.value : null
  }

  async setPhoneKv(key: string, value: unknown): Promise<void> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(PHONE_KV_STORE)) {
      db.close()
      throw new Error('phoneKv store missing')
    }
    const tx = db.transaction(PHONE_KV_STORE, 'readwrite')
    tx.objectStore(PHONE_KV_STORE).put({ key, value })
    await txDone(tx)
    db.close()
  }

  async deletePhoneKv(key: string): Promise<void> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(PHONE_KV_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(PHONE_KV_STORE, 'readwrite')
    tx.objectStore(PHONE_KV_STORE).delete(key)
    await txDone(tx)
    db.close()
  }

  // -------- 微信全局设置（弹幕、主题偏好等） --------

  async getGlobalSettings(): Promise<WeChatGlobalSettingsRow> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(GLOBAL_SETTINGS_STORE)) {
      db.close()
      return { ...DEFAULT_WECHAT_GLOBAL_SETTINGS, createdAt: Date.now() }
    }
    const tx = db.transaction(GLOBAL_SETTINGS_STORE, 'readonly')
    const req = tx.objectStore(GLOBAL_SETTINGS_STORE).get('global')
    const res = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('getGlobalSettings'))
    })
    await txDone(tx)
    db.close()
    const row = normalizeWeChatGlobalSettingsRow(res)
    return row ?? { ...DEFAULT_WECHAT_GLOBAL_SETTINGS, createdAt: Date.now() }
  }

  async putGlobalSettings(partial: Partial<Omit<WeChatGlobalSettingsRow, 'id' | 'createdAt'>>): Promise<void> {
    const prev = await this.getGlobalSettings()
    const now = Date.now()
    const next: WeChatGlobalSettingsRow = normalizeWeChatGlobalSettingsRow({
      ...prev,
      ...partial,
      id: 'global',
      createdAt: prev.createdAt || now,
    })
    const db = await openDb()
    if (!db.objectStoreNames.contains(GLOBAL_SETTINGS_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(GLOBAL_SETTINGS_STORE, 'readwrite')
    tx.objectStore(GLOBAL_SETTINGS_STORE).put(next)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  async getCharacterDanmakuSettings(characterId: string): Promise<CharacterDanmakuSettingsRow | null> {
    const cid = characterId.trim()
    if (!cid) return null
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHARACTER_DANMAKU_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(CHARACTER_DANMAKU_STORE, 'readonly')
    const req = tx.objectStore(CHARACTER_DANMAKU_STORE).get(cid)
    const res = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('getCharacterDanmakuSettings'))
    })
    await txDone(tx)
    db.close()
    return normalizeCharacterDanmakuSettingsRow(res)
  }

  async putCharacterDanmakuSettings(partial: Partial<CharacterDanmakuSettingsRow> & { characterId: string }): Promise<void> {
    const cid = partial.characterId.trim()
    if (!cid) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHARACTER_DANMAKU_STORE)) {
      db.close()
      return
    }
    const prev = await this.getCharacterDanmakuSettings(cid)
    const gs = await this.getGlobalSettings()
    const base: CharacterDanmakuSettingsRow =
      prev ??
      ({
        characterId: cid,
        enabled: true,
        useMemory: gs.danmakuUseMemory,
        generateCount: gs.danmakuGenerateCount,
        fontSize: gs.danmakuFontSize,
        color: gs.danmakuColor,
        opacity: gs.danmakuOpacity,
        scrollDurationSec: gs.danmakuScrollDurationSec,
        position: gs.danmakuPosition,
        density: gs.danmakuDensity,
        style: gs.danmakuStyle,
        customPrompt: gs.danmakuCustomPrompt,
        updatedAt: Date.now(),
      } satisfies CharacterDanmakuSettingsRow)
    const merged = { ...base, ...partial, characterId: cid, updatedAt: Date.now() }
    const next = normalizeCharacterDanmakuSettingsRow(merged)
    if (!next) return
    const tx = db.transaction(CHARACTER_DANMAKU_STORE, 'readwrite')
    tx.objectStore(CHARACTER_DANMAKU_STORE).put(next)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  // -------- 通知（按角色）--------

  async getCharacterNotificationSettings(characterId: string): Promise<CharacterNotificationSettingsRow | null> {
    const cid = characterId.trim()
    if (!cid) return null
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHARACTER_NOTIFY_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(CHARACTER_NOTIFY_STORE, 'readonly')
    const req = tx.objectStore(CHARACTER_NOTIFY_STORE).get(cid)
    const res = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('getCharacterNotificationSettings'))
    })
    await txDone(tx)
    db.close()
    return normalizeCharacterNotificationSettingsRow(res)
  }

  async putCharacterNotificationSettings(
    partial: Partial<CharacterNotificationSettingsRow> & { characterId: string },
  ): Promise<void> {
    const cid = partial.characterId.trim()
    if (!cid) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHARACTER_NOTIFY_STORE)) {
      db.close()
      return
    }
    const prev = await this.getCharacterNotificationSettings(cid)
    const base: CharacterNotificationSettingsRow =
      prev ??
      ({
        characterId: cid,
        notificationEnabled: true,
        audio: { type: 'global' },
        updatedAt: Date.now(),
      } satisfies CharacterNotificationSettingsRow)
    const merged = { ...base, ...partial, characterId: cid, updatedAt: Date.now() }
    const next = normalizeCharacterNotificationSettingsRow(merged)
    if (!next) return
    const tx = db.transaction(CHARACTER_NOTIFY_STORE, 'readwrite')
    tx.objectStore(CHARACTER_NOTIFY_STORE).put(next)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  async getCharacterBusySettings(characterId: string): Promise<CharacterBusySettingsRow | null> {
    const cid = characterId.trim()
    if (!cid) return null
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHARACTER_BUSY_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(CHARACTER_BUSY_STORE, 'readonly')
    const req = tx.objectStore(CHARACTER_BUSY_STORE).get(cid)
    const res = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('getCharacterBusySettings'))
    })
    await txDone(tx)
    db.close()
    return normalizeCharacterBusySettingsRow(res)
  }

  async putCharacterBusySettings(partial: Partial<CharacterBusySettingsRow> & { characterId: string }): Promise<void> {
    const cid = partial.characterId.trim()
    if (!cid) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHARACTER_BUSY_STORE)) {
      db.close()
      return
    }
    const prev = await this.getCharacterBusySettings(cid)
    const gs = await this.getGlobalSettings()
    const base: CharacterBusySettingsRow =
      prev ??
      ({
        characterId: cid,
        enabled: true,
        maxDuration: gs.globalBusyConfig.maxDuration,
        triggerProbability: gs.globalBusyConfig.triggerProbability,
        customScenarios: [...gs.globalBusyConfig.customScenarios],
        isBusy: false,
        busyReason: '',
        busyStartTime: 0,
        busyEndTime: 0,
        busyDurationMinutes: 15,
        busyMessages: [],
        updatedAt: Date.now(),
      } satisfies CharacterBusySettingsRow)
    const merged = { ...base, ...partial, characterId: cid, updatedAt: Date.now() }
    const next = normalizeCharacterBusySettingsRow(merged)
    if (!next) return
    const tx = db.transaction(CHARACTER_BUSY_STORE, 'readwrite')
    tx.objectStore(CHARACTER_BUSY_STORE).put(next)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  async getCharacterTimeSettings(characterId: string): Promise<CharacterTimeSettingsRow | null> {
    const cid = characterId.trim()
    if (!cid) return null
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHARACTER_TIME_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(CHARACTER_TIME_STORE, 'readonly')
    const req = tx.objectStore(CHARACTER_TIME_STORE).get(cid)
    const res = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('getCharacterTimeSettings'))
    })
    await txDone(tx)
    db.close()
    return normalizeCharacterTimeSettingsRow(res)
  }

  async putCharacterTimeSettings(partial: Partial<CharacterTimeSettingsRow> & { characterId: string }): Promise<void> {
    const cid = partial.characterId.trim()
    if (!cid) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHARACTER_TIME_STORE)) {
      db.close()
      return
    }
    const prev = await this.getCharacterTimeSettings(cid)
    const gs = await this.getGlobalSettings()
    const base: CharacterTimeSettingsRow =
      prev ??
      ({
        characterId: cid,
        config: normalizeWeChatTimeConfig(gs.globalTimeConfig),
        updatedAt: Date.now(),
      } satisfies CharacterTimeSettingsRow)
    const merged = {
      ...base,
      ...partial,
      characterId: cid,
      config: normalizeWeChatTimeConfig(partial.config ?? base.config),
      updatedAt: Date.now(),
    }
    const next = normalizeCharacterTimeSettingsRow(merged)
    if (!next) return
    const tx = db.transaction(CHARACTER_TIME_STORE, 'readwrite')
    tx.objectStore(CHARACTER_TIME_STORE).put(next)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  async getHeartWhisper(characterId: string): Promise<HeartWhisperRow | null> {
    const cid = characterId.trim()
    if (!cid) return null
    const db = await openDb()
    if (!db.objectStoreNames.contains(HEART_WHISPER_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(HEART_WHISPER_STORE, 'readonly')
    const req = tx.objectStore(HEART_WHISPER_STORE).get(cid)
    const res = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('getHeartWhisper'))
    })
    await txDone(tx)
    db.close()
    return normalizeHeartWhisperRow(res)
  }

  /** 心语按角色覆盖保存：每次新生成直接替换旧数据 */
  async putHeartWhisper(characterId: string, data: HeartWhisper): Promise<void> {
    const cid = characterId.trim()
    if (!cid) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(HEART_WHISPER_STORE)) {
      db.close()
      return
    }
    const row = normalizeHeartWhisperRow({
      characterId: cid,
      data,
      updatedAt: Date.now(),
    })
    if (!row) return
    const tx = db.transaction(HEART_WHISPER_STORE, 'readwrite')
    tx.objectStore(HEART_WHISPER_STORE).put(row)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  // -------- 会话聊天设置 / 群聊 --------

  async getChatConversationSettings(conversationKey: string): Promise<ChatConversationSettingsRow | null> {
    const k = conversationKey.trim()
    if (!k) return null
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(CHAT_CONV_SETTINGS_STORE, 'readonly')
    const req = tx.objectStore(CHAT_CONV_SETTINGS_STORE).get(k)
    const res = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('getChatConversationSettings'))
    })
    await txDone(tx)
    db.close()
    return normalizeChatConversationSettingsRow(res)
  }

  async listChatConversationSettingsByPlayerIdentity(playerIdentityId: string): Promise<ChatConversationSettingsRow[]> {
    const pid = playerIdentityId.trim()
    if (!pid) return []
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHAT_CONV_SETTINGS_STORE, 'readonly')
    const idx = tx.objectStore(CHAT_CONV_SETTINGS_STORE).index('playerIdentityId')
    const req = idx.getAll(pid)
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('listChatConversationSettings'))
    })
    await txDone(tx)
    db.close()
    return raw.map(normalizeChatConversationSettingsRow).filter((x): x is ChatConversationSettingsRow => !!x)
  }

  async upsertChatConversationSettings(
    params: {
      conversationKey: string
      peerCharacterId: string
      playerIdentityId: string
    } & Partial<
      Pick<
        ChatConversationSettingsRow,
        | 'isPinned'
        | 'isMuted'
        | 'hiddenFromMessageList'
        | 'notifyEnabled'
        | 'showThinkingChain'
        | 'isDanmakuMode'
        | 'chatBackground'
        | 'lastMessageTime'
      >
    >,
  ): Promise<void> {
    const existing = await this.getChatConversationSettings(params.conversationKey)
    const now = Date.now()
    const row: ChatConversationSettingsRow = {
      conversationKey: params.conversationKey.trim(),
      peerCharacterId: params.peerCharacterId.trim(),
      playerIdentityId: params.playerIdentityId.trim(),
      isPinned: params.isPinned ?? existing?.isPinned ?? false,
      isMuted: params.isMuted ?? existing?.isMuted ?? false,
      hiddenFromMessageList: params.hiddenFromMessageList ?? existing?.hiddenFromMessageList ?? false,
      notifyEnabled: params.notifyEnabled ?? existing?.notifyEnabled ?? true,
      showThinkingChain: params.showThinkingChain ?? existing?.showThinkingChain ?? false,
      isDanmakuMode: params.isDanmakuMode ?? existing?.isDanmakuMode ?? false,
      chatBackground: params.chatBackground ?? existing?.chatBackground ?? '',
      lastMessageTime: params.lastMessageTime ?? existing?.lastMessageTime ?? 0,
      updatedAt: now,
    }
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(CHAT_CONV_SETTINGS_STORE, 'readwrite')
    tx.objectStore(CHAT_CONV_SETTINGS_STORE).put(row)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  /**
   * 消息免打扰：写入会话设置，并在可匹配到人设行时同步 `characters.isMuted`（Lumi 仅会话表）。
   */
  async updateMuteStatus(params: {
    conversationKey: string
    peerCharacterId: string
    playerIdentityId: string
    isMuted: boolean
  }): Promise<void> {
    await this.upsertChatConversationSettings({
      conversationKey: params.conversationKey,
      peerCharacterId: params.peerCharacterId,
      playerIdentityId: params.playerIdentityId,
      isMuted: params.isMuted,
    })
    const peer = params.peerCharacterId.trim()
    if (peer && peer !== WECHAT_LUMI_PEER_CHARACTER_ID) {
      const ch = await this.getCharacter(peer)
      if (ch) {
        await this.upsertCharacter({ ...ch, isMuted: params.isMuted })
        emitWeChatStorageChanged()
      }
    }
  }

  /**
   * 置顶：写入会话设置，并在可匹配到人设行时同步 `characters.isPinned`（Lumi 仅会话表）。
   */
  async updatePinnedStatus(params: {
    conversationKey: string
    peerCharacterId: string
    playerIdentityId: string
    isPinned: boolean
  }): Promise<void> {
    await this.upsertChatConversationSettings({
      conversationKey: params.conversationKey,
      peerCharacterId: params.peerCharacterId,
      playerIdentityId: params.playerIdentityId,
      isPinned: params.isPinned,
    })
    const peer = params.peerCharacterId.trim()
    if (peer && peer !== WECHAT_LUMI_PEER_CHARACTER_ID) {
      const ch = await this.getCharacter(peer)
      if (ch) {
        await this.upsertCharacter({ ...ch, isPinned: params.isPinned })
        emitWeChatStorageChanged()
      }
    }
  }

  /**
   * 更新会话最后消息时间（取较大值合并），并同步到 `characters.lastMessageTime`（非 Lumi）。
   */
  async updateLastMessageTime(params: {
    conversationKey: string
    peerCharacterId: string
    playerIdentityId: string
    lastMessageTime: number
  }): Promise<void> {
    await this.mergeConversationLastMessageTime({
      conversationKey: params.conversationKey,
      peerCharacterId: params.peerCharacterId,
      playerIdentityId: params.playerIdentityId,
      messageTimestamp: params.lastMessageTime,
    })
  }

  /** 新消息写入后：合并 `lastMessageTime` 并同步人设表（若有）。 */
  async mergeConversationLastMessageTime(params: {
    conversationKey: string
    peerCharacterId: string
    playerIdentityId: string
    messageTimestamp: number
  }): Promise<void> {
    const existing = await this.getChatConversationSettings(params.conversationKey)
    const merged = Math.max(existing?.lastMessageTime ?? 0, params.messageTimestamp)
    await this.upsertChatConversationSettings({
      conversationKey: params.conversationKey,
      peerCharacterId: params.peerCharacterId,
      playerIdentityId: params.playerIdentityId,
      lastMessageTime: merged,
    })
    const peer = params.peerCharacterId.trim()
    if (peer && peer !== WECHAT_LUMI_PEER_CHARACTER_ID) {
      const ch = await this.getCharacter(peer)
      if (ch) {
        const cMerged = Math.max(ch.lastMessageTime ?? 0, merged)
        if (cMerged !== (ch.lastMessageTime ?? 0)) {
          await this.upsertCharacter({ ...ch, lastMessageTime: cMerged })
        }
      }
    }
  }

  async deleteAllWeChatMessagesForConversation(conversationKey: string): Promise<void> {
    const k = conversationKey.trim()
    if (!k) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readwrite')
    const idx = tx.objectStore(CHAT_MSG_STORE).index('conversationKey')
    await new Promise<void>((resolve, reject) => {
      const req = idx.openCursor(IDBKeyRange.only(k))
      req.onsuccess = () => {
        const cur = req.result
        if (cur) {
          cur.delete()
          cur.continue()
        } else resolve()
      }
      req.onerror = () => reject(req.error ?? new Error('deleteAllWeChatMessagesForConversation'))
    })
    await txDone(tx)
    db.close()
    await this.setWechatReadCursor(k, Date.now())
    emitWeChatStorageChanged()
  }

  async putGroupChat(row: GroupChatRow): Promise<void> {
    const normalized = normalizeGroupChatRow(row)
    if (!normalized) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(GROUP_CHATS_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(GROUP_CHATS_STORE, 'readwrite')
    tx.objectStore(GROUP_CHATS_STORE).put({ ...normalized, updatedAt: Date.now() })
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  async getGroupChat(id: string): Promise<GroupChatRow | null> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(GROUP_CHATS_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(GROUP_CHATS_STORE, 'readonly')
    const req = tx.objectStore(GROUP_CHATS_STORE).get(id.trim())
    const res = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('getGroupChat'))
    })
    await txDone(tx)
    db.close()
    return normalizeGroupChatRow(res)
  }

  async listGroupChats(): Promise<GroupChatRow[]> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(GROUP_CHATS_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(GROUP_CHATS_STORE, 'readonly')
    const req = tx.objectStore(GROUP_CHATS_STORE).getAll()
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('listGroupChats'))
    })
    await txDone(tx)
    db.close()
    return raw.map(normalizeGroupChatRow).filter((x): x is GroupChatRow => !!x)
  }
}

export const personaDb = new PersonaDb()

/**
 * 优先读 IndexedDB；若无则尝试 legacy 的 localStorage 键，成功则写入 IDB 并删除对应 localStorage。
 */
export async function pullPhoneKvWithLocalStorageLegacy(
  key: string,
  legacyLocalStorageKeys: string[],
): Promise<unknown | null> {
  const existing = await personaDb.getPhoneKv(key)
  if (existing != null) return existing
  if (typeof localStorage === 'undefined') return null
  for (const lk of legacyLocalStorageKeys) {
    const raw = localStorage.getItem(lk)
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as unknown
      await personaDb.setPhoneKv(key, parsed)
      localStorage.removeItem(lk)
      return parsed
    } catch {
      continue
    }
  }
  return null
}
