import type {
  Character,
  CharacterMemory,
  CharacterMemoryScope,
  ChatConversationSettingsRow,
  CharacterNotificationSettingsRow,
  CharacterBusySettingsRow,
  CharacterTimeSettingsRow,
  CharacterPsyche,
  GroupPsycheArchive,
  GroupPsycheRow,
  HeartWhisper,
  HeartWhisperRow,
  Favorite,
  GroupChatRow,
  GroupMember,
  GroupRobotRule,
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
  WorldBookUserPlaceholderBinding,
} from './types'
import { buildCharacterFullTrashArchive, type PersonaDbTrashSource } from '../../recycleBin/archiveCharacterDeletion'
import { INDEXED_TRASH_RETENTION_MS, emitIndexedTrashChanged } from '../../recycleBin/recycleBinEvents'
import type { IndexedTrashEntry } from '../../recycleBin/indexedTrashTypes'
import {
  MEMORY_ALWAYS_INJECT_CAP,
  isMemoryAlwaysTrigger,
  memoryHasTriggerDimensions,
  memoryTriggerMatchesHaystack,
  normalizeStoredMemoryEmotionNeedList,
  trimMemoryTriggerText,
} from '../memory/memoryTriggerUtils'
import { fetchEmbeddingVector, resolveEmbeddingApiCredentials } from '../memory/memoryEmbeddingApi'
import { migrateLegacyRootPublicUrl } from '../../../../publicAssetUrl'
import { repairCharacterAvatarForBundleImport } from '../../../utils/characterAvatarUrl'
import {
  backfillMemoryEmbeddingsBestEffort,
  isMemoryVectorRecallEnabled,
  MEMORY_VECTOR_MIN_SIM,
  MEMORY_VECTOR_TOP_GROUP,
  MEMORY_VECTOR_TOP_PRIVATE,
  pickMemoriesByVectorSimilarity,
  pickMemoriesByVectorSimilarityScored,
  resolveMemoryEmbeddingModelId,
  type MemoryVectorRecallOpts,
} from '../memory/memoryVectorRecall'
import { isCharacterLinkedMemory, isCharacterOwnPrivateMemory } from '../memory/memoryCharacterScope'
import {
  buildLinkedMemoryIdDisplayNameMap,
  characterDisplayNameForIdMap,
  resolveMissingIdPlaceholderDisplayNames,
} from '../memory/linkedMemoryEligiblePeers'
import {
  formatMemorySourceLineLabelFromMemory,
  formatPrivateMemoriesPromptWithLineScope,
  resolveMemoryLineRelation,
  type MemoryLineRelation,
} from '../wechatMemoryLineScope'
import { parseGroupRobotTriggerWordInput } from '../groupChatUtils'
import { formatWeChatMessageListTimestamp as formatWeChatMessageListTimestampFn } from './chatMessageTimestampFormat'
import { emptyWorldBackgroundSettings, formatTimelineEventDate } from './types'
import { DEFAULT_WORLD_BACKGROUND_ID } from './worldBackgroundConstants'
import { buildPresetWorldBackgrounds } from './worldBackgroundSeed'
import {
  WECHAT_GROUP_BOT_CHARACTER_ID,
  WECHAT_GROUP_USER_CHAR_ID,
  WECHAT_LUMI_PEER_CHARACTER_ID,
  groupMemoryBucketCharacterId,
  isWechatGroupConversationKey,
  parseGroupIdFromConversationKey,
  parseGroupIdFromGroupPeerCharacterId,
  parsePrivateWeChatConversationCharacterAndSession,
  parseWechatAccountPrivateConversationKey,
  conversationKeyBelongsToWechatAccount,
  wechatConversationKey,
  wechatGroupConversationKey,
  wechatGroupPeerCharacterId,
} from '../wechatConversationKey'
import { preserveCharacterBoundPlayerIdentity } from '../wechatCharacterPlayerIdentity'
import { formatWeChatMessagesTabPreviewFromStoredMessageContent } from '../wechatThreadPreviewText'
import { maybeNotifyWeChatCharacterMessage } from '../wechatSystemNotify'
import { getWeChatBuiltInNotifySoundMeta, playWeChatNotifySound } from '../wechatNotifySound'
import { normalizeWeChatTimeConfig } from '../time/wechatTimeUtils'
import {
  DEFAULT_CHAT_THEME,
  DEFAULT_CHAT_THEME_ID,
  type ChatTheme,
  normalizeChatTheme,
} from '../chatTheme/types'
import {
  expandLinkedMemoryPlaceholders,
  resolveCharUserNamesForPrompt,
} from '../charUserPlaceholders'
import {
  clearWeChatAccountLegacyLocalStorage,
  emitWeChatAccountDeepErased,
  shouldErasePhoneKvKeyForWeChatAccount,
} from '../wechatAccountDeepErase'
import {
  registerGlobalWechatCharacter,
  resolveCanonicalCharacterId,
  unregisterGlobalWechatCharacterForCharacterId,
} from '../wechatGlobalCharacterRegistry'
import { characterBelongsToWechatAccount, stampWechatAccountOwner } from '../wechatAccountScope'
import { WECHAT_USER_PROFILE_KV_KEY, WECHAT_USER_PROFILE_KV_KEY_LEGACY } from '../wechatProfileTypes'

const DB_NAME = 'wechat-personas-v1'
const DB_VERSION = 25

/** 复合索引：按会话 + 时间戳范围查询（日历、按日跳转） */
const CHAT_MSG_INDEX_CONV_TS = 'conversationKey_timestamp'
const PHONE_KV_STORE = 'phoneKv'
/** 从群聊切到某成员私聊时，短暂记住「来源群」，私聊 AI 摘录优先承接该群（TTL 内有效） */
const WX_PRIVATE_ANCHOR_GROUP_KV_PREFIX = 'wx-pv-anchor-grp:v1:'
const WX_PRIVATE_ANCHOR_GROUP_TTL_MS = 45 * 60 * 1000
/** 从某 NPC 私聊切回本群时，群 AI 优先承接该成员私聊语境（TTL 与私聊锚群一致） */
const WX_GROUP_ANCHOR_PRIVATE_PEER_KV_PREFIX = 'wx-grp-anchor-pv:v1:'
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
const GROUP_PSYCHE_STORE = 'groupPsyche'
const INDEXED_TRASH_STORE = 'indexedTrash'

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

function normalizeCharacterPsyche(input: unknown): CharacterPsyche | null {
  const r = (input ?? {}) as Partial<CharacterPsyche>
  if (typeof r.charId !== 'string' || !r.charId.trim()) return null
  const txt = (v: unknown) => String(v ?? '').trim()
  return {
    charId: r.charId.trim(),
    avatarUrl: typeof r.avatarUrl === 'string' ? r.avatarUrl : '',
    name: typeof r.name === 'string' ? r.name.trim() : '',
    location: txt(r.location),
    clothing: txt(r.clothing),
    posture: txt(r.posture),
    monologue: txt(r.monologue),
    impressionOnUser: txt(r.impressionOnUser),
  }
}

function normalizeGroupPsycheArchive(input: unknown): GroupPsycheArchive {
  const r = (input ?? {}) as Partial<GroupPsycheArchive>
  const raw = Array.isArray(r.characters) ? r.characters : []
  const characters = raw.map(normalizeCharacterPsyche).filter((x): x is CharacterPsyche => !!x)
  const ts = typeof r.timestamp === 'string' ? r.timestamp.trim() : ''
  return { timestamp: ts, characters }
}

function normalizeGroupPsycheRow(input: unknown): GroupPsycheRow | null {
  const r = (input ?? {}) as Partial<GroupPsycheRow> & { archive?: unknown }
  if (typeof r.conversationId !== 'string' || !r.conversationId.trim()) return null
  return {
    conversationId: r.conversationId.trim(),
    archive: normalizeGroupPsycheArchive(r.archive),
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : Date.now(),
  }
}

function normalizeWorldBookUserPlaceholderBinding(input: unknown): WorldBookUserPlaceholderBinding | null {
  const r = input as Record<string, unknown>
  if (!r || typeof r !== 'object') return null
  const wechatAccountId = typeof r.wechatAccountId === 'string' ? r.wechatAccountId.trim() : ''
  const playerIdentityId = typeof r.playerIdentityId === 'string' ? r.playerIdentityId.trim() : ''
  if (!wechatAccountId || !playerIdentityId || playerIdentityId === '__none__') return null
  const lineLabel = typeof r.lineLabel === 'string' ? r.lineLabel.trim() : undefined
  const displayName = typeof r.displayName === 'string' ? r.displayName.trim() : undefined
  return {
    wechatAccountId,
    playerIdentityId,
    ...(lineLabel ? { lineLabel } : {}),
    ...(displayName ? { displayName } : {}),
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
            pronounGuide:
              i.pronounGuide === 'user_as_i' || i.pronounGuide === 'third_person' || i.pronounGuide === 'default'
                ? (i.pronounGuide as 'default' | 'user_as_i' | 'third_person')
                : i.pronounGuide === 'mixed_explicit'
                  ? 'default'
                  : undefined,
            userPlaceholderBindings: Array.isArray(i.userPlaceholderBindings)
              ? (i.userPlaceholderBindings as unknown[])
                  .map(normalizeWorldBookUserPlaceholderBinding)
                  .filter((x): x is WorldBookUserPlaceholderBinding => !!x)
              : undefined,
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
    avatarUrl:
      typeof raw.avatarUrl === 'string'
        ? repairCharacterAvatarForBundleImport({
            avatarUrl: migrateLegacyRootPublicUrl(raw.avatarUrl as string),
          })
        : '',
    wechatNickname: typeof raw.wechatNickname === 'string' ? (raw.wechatNickname as string) : '',
    wechatId: typeof raw.wechatId === 'string' ? (raw.wechatId as string) : '',
    wechatSignature: typeof raw.wechatSignature === 'string' ? (raw.wechatSignature as string) : '',
    wechatRegion: typeof raw.wechatRegion === 'string' ? (raw.wechatRegion as string) : '',
    momentsCoverUrl:
      typeof raw.momentsCoverUrl === 'string'
        ? migrateLegacyRootPublicUrl(raw.momentsCoverUrl as string)
        : '',
    worldBooks,
    wechatAccountId: typeof raw.wechatAccountId === 'string' ? (raw.wechatAccountId as string).trim() : undefined,
    playerIdentityId: typeof raw.playerIdentityId === 'string' ? (raw.playerIdentityId as string) : undefined,
    linkedPlayerIdentityIds: Array.isArray(raw.linkedPlayerIdentityIds)
      ? (raw.linkedPlayerIdentityIds as unknown[])
          .filter((x): x is string => typeof x === 'string')
          .map((x) => x.trim())
          .filter((x) => x && x !== '__none__')
      : undefined,
    playerIdentityLinkMeta: Array.isArray(raw.playerIdentityLinkMeta)
      ? (raw.playerIdentityLinkMeta as unknown[])
          .map((x) => {
            const o = x as { playerIdentityId?: unknown; wechatAccountId?: unknown }
            const playerIdentityId =
              typeof o.playerIdentityId === 'string' ? o.playerIdentityId.trim() : ''
            const wechatAccountId =
              typeof o.wechatAccountId === 'string' ? o.wechatAccountId.trim() : ''
            if (!playerIdentityId || !wechatAccountId || playerIdentityId === '__none__') return null
            return { playerIdentityId, wechatAccountId }
          })
          .filter((x): x is { playerIdentityId: string; wechatAccountId: string } => x != null)
      : undefined,
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
    chatBackground:
      typeof raw.chatBackground === 'string'
        ? migrateLegacyRootPublicUrl(raw.chatBackground)
        : undefined,
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
  const recalledBy =
    recalledByRaw === 'player' || recalledByRaw === 'character' || recalledByRaw === 'moderator'
      ? recalledByRaw
      : undefined
  const quiet = typeof (m as { quiet?: unknown }).quiet === 'boolean' ? !!(m as { quiet?: boolean }).quiet : undefined
  const rawExt = (m as { ext?: unknown }).ext
  let ext: WeChatChatMessage['ext']
  if (rawExt && typeof rawExt === 'object') {
    const o = rawExt as Record<string, unknown>
    const groupBotDarkBubble = o.groupBotDarkBubble === true
    const centerSystemStrip = o.centerSystemStrip === true
    const shieldedMessageContent =
      typeof o.shieldedMessageContent === 'string'
        ? String(o.shieldedMessageContent).trim().slice(0, 8000)
        : undefined
    const muteSuppressStrip = o.muteSuppressStrip === true
    const mutedMessageVisibleToModeratorsOnly = o.mutedMessageVisibleToModeratorsOnly === true
    if (groupBotDarkBubble || centerSystemStrip || mutedMessageVisibleToModeratorsOnly) {
      ext = {
        groupBotDarkBubble: groupBotDarkBubble ? true : undefined,
        centerSystemStrip: centerSystemStrip ? true : undefined,
        shieldedMessageContent: shieldedMessageContent || undefined,
        muteSuppressStrip: muteSuppressStrip ? true : undefined,
        mutedMessageVisibleToModeratorsOnly: mutedMessageVisibleToModeratorsOnly ? true : undefined,
      }
    }
  }

  const base: WeChatChatMessage = {
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
    quiet,
  }
  return ext ? { ...base, ext } : base
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
    showGroupMemberNicknameInChat:
      typeof (r as { showGroupMemberNicknameInChat?: unknown }).showGroupMemberNicknameInChat === 'boolean'
        ? !!(r as { showGroupMemberNicknameInChat?: boolean }).showGroupMemberNicknameInChat
        : true,
    showGroupRankBadgesInChat:
      typeof (r as { showGroupRankBadgesInChat?: unknown }).showGroupRankBadgesInChat === 'boolean'
        ? !!(r as { showGroupRankBadgesInChat?: boolean }).showGroupRankBadgesInChat
        : false,
    chatBackground: typeof r.chatBackground === 'string' ? r.chatBackground : '',
    lastMessageTime:
      typeof r.lastMessageTime === 'number' && Number.isFinite(r.lastMessageTime) ? r.lastMessageTime : 0,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : now,
    ...(typeof r.uiOnlyHiddenBeforeTimestamp === 'number' &&
    Number.isFinite(r.uiOnlyHiddenBeforeTimestamp) &&
    r.uiOnlyHiddenBeforeTimestamp > 0
      ? { uiOnlyHiddenBeforeTimestamp: r.uiOnlyHiddenBeforeTimestamp }
      : {}),
    ...(typeof r.friendRequestAcceptedAtMs === 'number' &&
    Number.isFinite(r.friendRequestAcceptedAtMs) &&
    r.friendRequestAcceptedAtMs > 0
      ? { friendRequestAcceptedAtMs: r.friendRequestAcceptedAtMs }
      : {}),
  }
}

function normalizeGroupMember(input: unknown): GroupMember | null {
  const m = (input ?? {}) as Partial<GroupMember>
  const charId = typeof m.charId === 'string' ? m.charId.trim() : ''
  if (!charId) return null
  const role: GroupMember['role'] = m.role === 'owner' || m.role === 'admin' || m.role === 'member' ? m.role : 'member'
  const rawNick = typeof m.groupNickname === 'string' ? m.groupNickname.trim().slice(0, 64) : ''
  /** 用户占位成员不要用 charId 回填昵称（会变成 `__wx_group_user__`）；NPC 仍可用 id 作兜底展示 */
  let groupNickname = rawNick
  if (charId === WECHAT_GROUP_USER_CHAR_ID) {
    if (!groupNickname || groupNickname === WECHAT_GROUP_USER_CHAR_ID) groupNickname = ''
  } else if (!groupNickname) {
    groupNickname = charId
  }
  const bvRaw = (m as { botViolation?: unknown }).botViolation
  let botViolation: GroupMember['botViolation'] = undefined
  if (bvRaw && typeof bvRaw === 'object') {
    const b = bvRaw as Record<string, unknown>
    const violationCount =
      typeof b.violationCount === 'number' && Number.isFinite(b.violationCount)
        ? Math.max(0, Math.floor(b.violationCount))
        : 0
    const lastViolationTurn =
      typeof b.lastViolationTurn === 'number' && Number.isFinite(b.lastViolationTurn)
        ? Math.floor(b.lastViolationTurn)
        : -1
    const lastEvRaw = (b as { lastViolationEventSeq?: unknown }).lastViolationEventSeq
    const lastViolationEventSeq =
      typeof lastEvRaw === 'number' && Number.isFinite(lastEvRaw) ? Math.floor(lastEvRaw) : undefined
    const me = b.muteExpiresAt
    const muteExpiresAt =
      typeof me === 'number' && Number.isFinite(me) && me > 0 ? me : null
    botViolation = {
      violationCount,
      lastViolationTurn,
      ...(typeof lastViolationEventSeq === 'number' && lastViolationEventSeq >= 0
        ? { lastViolationEventSeq }
        : {}),
      muteExpiresAt,
    }
  }

  return {
    charId,
    groupNickname,
    role,
    isMuted: typeof m.isMuted === 'boolean' ? m.isMuted : false,
    warnings: typeof m.warnings === 'number' && Number.isFinite(m.warnings) ? Math.max(0, Math.floor(m.warnings)) : 0,
    botViolation,
  }
}

function normalizeGroupRobotRule(input: unknown): GroupRobotRule | null {
  const x = (input ?? {}) as Partial<GroupRobotRule>
  const words = Array.isArray(x.triggerWords)
    ? Array.from(
        new Set(
          (x.triggerWords as unknown[]).flatMap((w) => parseGroupRobotTriggerWordInput(String(w ?? ''))),
        ),
      ).slice(0, 32)
    : []
  if (!words.length) return null
  const action: GroupRobotRule['action'] = x.action === 'mute' ? 'mute' : 'warn'
  const warningText =
    typeof x.warningText === 'string' && x.warningText.trim() ? x.warningText.trim().slice(0, 500) : '请注意群规。'
  return { triggerWords: words, action, warningText }
}

function normalizeGroupChatRow(input: unknown): GroupChatRow | null {
  const r = (input ?? {}) as Partial<GroupChatRow> & { members?: unknown[]; memberIds?: unknown[] }
  if (typeof r.id !== 'string' || !r.id.trim()) return null
  const now = Date.now()
  const pid = typeof r.playerIdentityId === 'string' && r.playerIdentityId.trim() ? r.playerIdentityId.trim() : ''

  let members: GroupMember[] = []
  if (Array.isArray(r.members)) {
    members = (r.members as unknown[]).map(normalizeGroupMember).filter((x): x is GroupMember => !!x)
  }
  const legacyIds = Array.isArray(r.memberIds)
    ? (r.memberIds as unknown[]).filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim())
    : []
  if (!members.length && legacyIds.length) {
    members = legacyIds.map((cid, i) => ({
      charId: cid,
      groupNickname: cid,
      role: i === 0 ? ('owner' as const) : ('member' as const),
      isMuted: false,
      warnings: 0,
    }))
  }

  let robotRules: GroupRobotRule[] = []
  if (Array.isArray(r.robotRules)) {
    robotRules = (r.robotRules as unknown[]).map(normalizeGroupRobotRule).filter((x): x is GroupRobotRule => !!x)
  }

  const robotAvatarRaw = typeof r.robotAvatarUrl === 'string' ? r.robotAvatarUrl.trim() : ''
  const robotAvatarUrl = robotAvatarRaw ? robotAvatarRaw.slice(0, 500_000) : undefined

  const seqRaw = (r as { chatTurnSequence?: unknown }).chatTurnSequence
  const chatTurnSequence =
    typeof seqRaw === 'number' && Number.isFinite(seqRaw) ? Math.max(0, Math.floor(seqRaw)) : undefined
  const violSeqRaw = (r as { smartBotViolationSeq?: unknown }).smartBotViolationSeq
  const smartBotViolationSeq =
    typeof violSeqRaw === 'number' && Number.isFinite(violSeqRaw) ? Math.max(0, Math.floor(violSeqRaw)) : undefined
  const aliasesRaw = (r as { robotMentionAliases?: unknown }).robotMentionAliases
  const robotMentionAliases = Array.isArray(aliasesRaw)
    ? (aliasesRaw as unknown[]).map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, 16)
    : undefined

  return {
    id: r.id.trim(),
    playerIdentityId: pid,
    chatTurnSequence,
    smartBotViolationSeq,
    robotMentionAliases: robotMentionAliases?.length ? robotMentionAliases : undefined,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 64) : '群聊',
    remark: typeof r.remark === 'string' ? r.remark.trim().slice(0, 64) : '',
    avatar: typeof r.avatar === 'string' ? r.avatar : '',
    members,
    robotRules,
    robotAvatarUrl,
    announcement:
      typeof r.announcement === 'string' ? r.announcement.trim().slice(0, 2000) : undefined,
    backgroundUrl: typeof r.backgroundUrl === 'string' ? r.backgroundUrl : undefined,
    memberIds: legacyIds.length ? legacyIds : undefined,
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
    youCallThem: typeof r.youCallThem === 'string' ? r.youCallThem : '',
    theyCallYou: typeof r.theyCallYou === 'string' ? r.theyCallYou : '',
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
  const scopeRaw = m.memoryScope
  const memoryScope: CharacterMemory['memoryScope'] =
    scopeRaw === 'group' || scopeRaw === 'private' || scopeRaw === 'linked' || scopeRaw === 'meet'
      ? scopeRaw
      : undefined
  const linkedFromRaw = (m as { linkedFromCharacterId?: unknown }).linkedFromCharacterId
  const linkedFromCharacterId =
    typeof linkedFromRaw === 'string' && linkedFromRaw.trim()
      ? linkedFromRaw.trim().slice(0, 128)
      : undefined
  let involvedCharIds: string[] | undefined
  if (Array.isArray(m.involvedCharIds)) {
    involvedCharIds = (m.involvedCharIds as unknown[])
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .slice(0, 64)
    if (!involvedCharIds.length) involvedCharIds = undefined
  }
  const groupId =
    typeof m.groupId === 'string' && m.groupId.trim() ? m.groupId.trim().slice(0, 128) : undefined
  let memoryKeywords: string[] | undefined
  const kwRaw = (m as { memoryKeywords?: unknown }).memoryKeywords
  if (Array.isArray(kwRaw)) {
    memoryKeywords = (kwRaw as unknown[])
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
    if (!memoryKeywords.length) memoryKeywords = undefined
  } else if (typeof kwRaw === 'string' && kwRaw.trim()) {
    memoryKeywords = kwRaw
      .split(/[,，;；\n\r\t|]+/u)
      .map((x) => x.trim())
      .filter(Boolean)
    if (!memoryKeywords.length) memoryKeywords = undefined
  }
  const modeRaw = (m as { memoryTriggerMode?: unknown }).memoryTriggerMode
  const memoryTriggerMode: CharacterMemory['memoryTriggerMode'] =
    modeRaw === 'always' || modeRaw === 'keyword' ? modeRaw : undefined
  const catSan = trimMemoryTriggerText(
    typeof (m as { memoryTriggerCategory?: unknown }).memoryTriggerCategory === 'string'
      ? (m as { memoryTriggerCategory: string }).memoryTriggerCategory
      : '',
  )
  const preSan = trimMemoryTriggerText(
    typeof (m as { memoryTriggerPrecise?: unknown }).memoryTriggerPrecise === 'string'
      ? (m as { memoryTriggerPrecise: string }).memoryTriggerPrecise
      : '',
  )
  const emoSan = normalizeStoredMemoryEmotionNeedList((m as { memoryTriggerEmotionNeed?: unknown }).memoryTriggerEmotionNeed)
  let memoryEmbedding: number[] | undefined
  const embRaw = (m as { memoryEmbedding?: unknown }).memoryEmbedding
  if (Array.isArray(embRaw) && embRaw.length) {
    const arr: number[] = []
    for (const x of embRaw.slice(0, 4096)) {
      const n = typeof x === 'number' ? x : Number(x)
      if (!Number.isFinite(n)) continue
      arr.push(n)
    }
    if (arr.length >= 8) memoryEmbedding = arr
  }
  const memHashRaw = (m as { memoryEmbeddingHash?: unknown }).memoryEmbeddingHash
  const memoryEmbeddingHash =
    typeof memHashRaw === 'string' && memHashRaw.trim() ? memHashRaw.trim().slice(0, 128) : undefined
  const datingPlotRaw = (m as { datingLinkedSourcePlotId?: unknown }).datingLinkedSourcePlotId
  const datingLinkedSourcePlotId =
    typeof datingPlotRaw === 'string' && datingPlotRaw.trim()
      ? datingPlotRaw.trim().slice(0, 256)
      : undefined
  const srcAccRaw = (m as { sourceWechatAccountId?: unknown }).sourceWechatAccountId
  const sourceWechatAccountId =
    typeof srcAccRaw === 'string' && srcAccRaw.trim() ? srcAccRaw.trim().slice(0, 128) : undefined
  const srcSidRaw = (m as { sourceSessionPlayerIdentityId?: unknown }).sourceSessionPlayerIdentityId
  const sourceSessionPlayerIdentityId =
    typeof srcSidRaw === 'string' && srcSidRaw.trim()
      ? srcSidRaw.trim().slice(0, 128)
      : undefined
  const userPlaceholderBindings = Array.isArray(
    (m as { userPlaceholderBindings?: unknown }).userPlaceholderBindings,
  )
    ? ((m as { userPlaceholderBindings: unknown[] }).userPlaceholderBindings as unknown[])
        .map(normalizeWorldBookUserPlaceholderBinding)
        .filter((x): x is WorldBookUserPlaceholderBinding => !!x)
    : undefined
  return {
    id: m.id,
    characterId: m.characterId,
    content: typeof m.content === 'string' ? m.content : '',
    createdAt: typeof m.createdAt === 'number' ? m.createdAt : now,
    updatedAt: typeof m.updatedAt === 'number' ? m.updatedAt : now,
    isAutoGenerated: typeof m.isAutoGenerated === 'boolean' ? m.isAutoGenerated : false,
    memoryScope,
    ...(linkedFromCharacterId ? { linkedFromCharacterId } : {}),
    ...(datingLinkedSourcePlotId ? { datingLinkedSourcePlotId } : {}),
    groupId,
    involvedCharIds,
    memoryTriggerMode,
    memoryTriggerCategory: catSan,
    memoryTriggerPrecise: preSan,
    memoryTriggerEmotionNeed: emoSan,
    memoryKeywords,
    ...(sourceWechatAccountId ? { sourceWechatAccountId } : {}),
    ...(sourceSessionPlayerIdentityId ? { sourceSessionPlayerIdentityId } : {}),
    ...(userPlaceholderBindings?.length ? { userPlaceholderBindings } : {}),
    memoryEmbedding,
    memoryEmbeddingHash,
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
  const meetCursorRaw = r.meetSummaryCursorTimestampByCharacterId
  const meetSummaryCursorTimestampByCharacterId: Record<string, number> = {}
  if (meetCursorRaw && typeof meetCursorRaw === 'object' && !Array.isArray(meetCursorRaw)) {
    for (const [k, v] of Object.entries(meetCursorRaw as Record<string, unknown>)) {
      const kk = k.trim()
      if (!kk) continue
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        meetSummaryCursorTimestampByCharacterId[kk] = Math.floor(v)
      }
    }
  }
  const modeRaw = (r as { autoSummaryDefaultMemoryTriggerMode?: unknown }).autoSummaryDefaultMemoryTriggerMode
  const autoSummaryDefaultMemoryTriggerMode: MemorySettingsRow['autoSummaryDefaultMemoryTriggerMode'] =
    modeRaw === 'always' || modeRaw === 'keyword' ? modeRaw : undefined
  const memVecRaw = (r as { memoryVectorRecallEnabled?: unknown }).memoryVectorRecallEnabled
  const memoryVectorRecallEnabled: MemorySettingsRow['memoryVectorRecallEnabled'] =
    memVecRaw === false ? false : memVecRaw === true ? true : undefined
  const memModelRaw = (r as { memoryEmbeddingModelId?: unknown }).memoryEmbeddingModelId
  const memoryEmbeddingModelId: MemorySettingsRow['memoryEmbeddingModelId'] =
    typeof memModelRaw === 'string' && memModelRaw.trim() ? memModelRaw.trim().slice(0, 120) : undefined
  const memEmbedUrlRaw = (r as { memoryEmbeddingApiUrl?: unknown }).memoryEmbeddingApiUrl
  const memoryEmbeddingApiUrl: MemorySettingsRow['memoryEmbeddingApiUrl'] =
    typeof memEmbedUrlRaw === 'string' && memEmbedUrlRaw.trim() ? memEmbedUrlRaw.trim().slice(0, 512) : undefined
  const memEmbedKeyRaw = (r as { memoryEmbeddingApiKey?: unknown }).memoryEmbeddingApiKey
  const memoryEmbeddingApiKey: MemorySettingsRow['memoryEmbeddingApiKey'] =
    typeof memEmbedKeyRaw === 'string' && memEmbedKeyRaw.trim() ? memEmbedKeyRaw.trim().slice(0, 2048) : undefined
  const memDedicatedRaw = (r as { memoryEmbeddingUseDedicatedApi?: unknown }).memoryEmbeddingUseDedicatedApi
  const memoryEmbeddingUseDedicatedApi: MemorySettingsRow['memoryEmbeddingUseDedicatedApi'] =
    memDedicatedRaw === true
      ? true
      : memDedicatedRaw === false
        ? false
        : memoryEmbeddingApiUrl?.trim() || memoryEmbeddingApiKey?.trim()
          ? true
          : undefined
  const memCollRaw = (r as { memoryVectorCollection?: unknown }).memoryVectorCollection
  const memoryVectorCollection: MemorySettingsRow['memoryVectorCollection'] =
    typeof memCollRaw === 'string' && memCollRaw.trim() ? memCollRaw.trim().slice(0, 128) : undefined
  const linkedMemRaw = (r as { linkedMemoryAutoSummaryEnabled?: unknown }).linkedMemoryAutoSummaryEnabled
  const linkedMemoryAutoSummaryEnabled: MemorySettingsRow['linkedMemoryAutoSummaryEnabled'] =
    linkedMemRaw === false ? false : linkedMemRaw === true ? true : undefined
  const datingAutoRaw = (r as { datingAutoSummaryEnabled?: unknown }).datingAutoSummaryEnabled
  const datingAutoSummaryEnabled: MemorySettingsRow['datingAutoSummaryEnabled'] =
    datingAutoRaw === false ? false : datingAutoRaw === true ? true : undefined
  return {
    id: 'default',
    autoSummaryEnabled,
    autoSummaryInterval: n,
    autoSummaryDefaultMemoryTriggerMode,
    linkedMemoryAutoSummaryEnabled,
    datingAutoSummaryEnabled,
    memoryVectorRecallEnabled,
    memoryEmbeddingUseDedicatedApi,
    memoryEmbeddingModelId,
    memoryEmbeddingApiUrl,
    memoryEmbeddingApiKey,
    memoryVectorCollection,
    aiRoundCountByConversation:
      Object.keys(aiRoundCountByConversation).length > 0 ? aiRoundCountByConversation : undefined,
    summaryCursorTimestampByConversation:
      Object.keys(summaryCursorTimestampByConversation).length > 0 ? summaryCursorTimestampByConversation : undefined,
    datingPlotSummaryCursorByCharacterId:
      Object.keys(datingPlotSummaryCursorByCharacterId).length > 0 ? datingPlotSummaryCursorByCharacterId : undefined,
    meetSummaryCursorTimestampByCharacterId:
      Object.keys(meetSummaryCursorTimestampByCharacterId).length > 0
        ? meetSummaryCursorTimestampByCharacterId
        : undefined,
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
  const fromCallsToRaw = (r as { fromCallsTo?: unknown }).fromCallsTo
  return {
    id: typeof r.id === 'string' ? r.id : `rel-${now}-${Math.random().toString(36).slice(2, 8)}`,
    fromCharacterId: typeof r.fromCharacterId === 'string' ? r.fromCharacterId : '',
    toCharacterId: typeof r.toCharacterId === 'string' ? r.toCharacterId : '',
    relation: typeof r.relation === 'string' ? r.relation : '',
    fromPerspective: typeof r.fromPerspective === 'string' ? r.fromPerspective : '',
    toPerspective: typeof r.toPerspective === 'string' ? r.toPerspective : '',
    fromCallsTo: typeof fromCallsToRaw === 'string' ? fromCallsToRaw : '',
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
  /**
   * 「重新添加」验证阶段起始时间：仅展示 timestamp ≥ 该值的会话消息到「新的朋友」，避免删除前的私聊串入。
   * 缺省时回退为 {@link createdAt}。
   */
  verificationEpochMs?: number
  /**
   * 用户主动申请：裁决模型时仅读取 timestamp ≤ 该值的验证消息，避免等待期间用户追加内容影响输出。
   */
  adjudicationCutoffMs?: number
  /** 用户主动申请被拒后，在「新的朋友」列表展示红点，直至用户点开该条 */
  outcomeUnread?: boolean
  /** 最近一次后台裁决失败时的可读原因（展示在列表/详情，可重试） */
  adjudicationLastError?: string
  /** 被拒后的临时会话（与验证会话消息表独立） */
  tempChatThread?: Array<{ sender: 'user' | 'character'; text: string; time: number }>
  /** 关联的遇见邂逅 npc/角色 id（同一 characterId 时用于假面/微信身份对照） */
  meetLinkedNpcId?: string
  /** 发送申请时冻结的遇见对外档案（可与 vol11 匹配快照不同） */
  meetUserProfileAtRequest?: {
    capturedAt: number
    displayName: string
    intent: string
    bio: string
    orientation: string
    meetIntentionsPublic: string[]
  }
  /**
   * 用户主动添加时填写的通讯录备注（仅用于写入当前微信马甲 personaContacts，不写 Character.remark）。
   */
  contactRemarkAlias?: string
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
  const verificationEpochMsRaw = (r as { verificationEpochMs?: unknown }).verificationEpochMs
  const verificationEpochMs =
    typeof verificationEpochMsRaw === 'number' && Number.isFinite(verificationEpochMsRaw) && verificationEpochMsRaw > 0
      ? verificationEpochMsRaw
      : undefined
  const adjudicationCutoffMsRaw = (r as { adjudicationCutoffMs?: unknown }).adjudicationCutoffMs
  const adjudicationCutoffMs =
    typeof adjudicationCutoffMsRaw === 'number' && Number.isFinite(adjudicationCutoffMsRaw) && adjudicationCutoffMsRaw > 0
      ? adjudicationCutoffMsRaw
      : undefined
  const outcomeUnreadRaw = (r as { outcomeUnread?: unknown }).outcomeUnread
  const outcomeUnread = outcomeUnreadRaw === true ? true : outcomeUnreadRaw === false ? false : undefined
  const adjudicationLastErrorRaw = (r as { adjudicationLastError?: unknown }).adjudicationLastError
  const adjudicationLastError =
    typeof adjudicationLastErrorRaw === 'string' && adjudicationLastErrorRaw.trim()
      ? adjudicationLastErrorRaw.trim().slice(0, 500)
      : undefined
  const tempChatRaw = (r as { tempChatThread?: unknown }).tempChatThread
  const tempChatThread = Array.isArray(tempChatRaw)
    ? tempChatRaw
        .map((m) => {
          const item = m as { sender?: unknown; text?: unknown; time?: unknown }
          const sender = item.sender === 'user' || item.sender === 'character' ? item.sender : null
          const text = typeof item.text === 'string' ? item.text.trim().slice(0, 500) : ''
          const time = typeof item.time === 'number' && Number.isFinite(item.time) ? item.time : 0
          if (!sender || !text) return null
          return { sender, text, time }
        })
        .filter((x): x is { sender: 'user' | 'character'; text: string; time: number } => !!x)
        .slice(0, 80)
    : undefined
  const meetLinkedNpcIdRaw = (r as { meetLinkedNpcId?: unknown }).meetLinkedNpcId
  const meetLinkedNpcId =
    typeof meetLinkedNpcIdRaw === 'string' && meetLinkedNpcIdRaw.trim() ? meetLinkedNpcIdRaw.trim() : undefined
  const contactRemarkAliasRaw = (r as { contactRemarkAlias?: unknown }).contactRemarkAlias
  const contactRemarkAlias =
    typeof contactRemarkAliasRaw === 'string' && contactRemarkAliasRaw.trim()
      ? contactRemarkAliasRaw.trim().slice(0, 64)
      : undefined
  const meetProfileRaw = (r as { meetUserProfileAtRequest?: unknown }).meetUserProfileAtRequest
  let meetUserProfileAtRequest: FriendRequestRow['meetUserProfileAtRequest']
  if (meetProfileRaw && typeof meetProfileRaw === 'object') {
    const p = meetProfileRaw as FriendRequestRow['meetUserProfileAtRequest']
    const capturedAt = typeof p?.capturedAt === 'number' && Number.isFinite(p.capturedAt) ? p.capturedAt : now
    const intentions = Array.isArray(p?.meetIntentionsPublic)
      ? p!.meetIntentionsPublic.filter((x): x is string => typeof x === 'string').slice(0, 8)
      : []
    meetUserProfileAtRequest = {
      capturedAt,
      displayName: typeof p?.displayName === 'string' ? p.displayName.trim().slice(0, 64) : '',
      intent: typeof p?.intent === 'string' ? p.intent.trim().slice(0, 120) : '',
      bio: typeof p?.bio === 'string' ? p.bio.trim().slice(0, 800) : '',
      orientation: typeof p?.orientation === 'string' ? p.orientation.trim().slice(0, 80) : '',
      meetIntentionsPublic: intentions,
    }
  }
  return {
    id,
    characterId,
    playerIdentityId,
    source: typeof r.source === 'string' ? r.source : '',
    status,
    createdAt,
    updatedAt,
    ...(verificationEpochMs ? { verificationEpochMs } : {}),
    ...(adjudicationCutoffMs ? { adjudicationCutoffMs } : {}),
    ...(outcomeUnread === true ? { outcomeUnread: true } : outcomeUnread === false ? { outcomeUnread: false } : {}),
    ...(adjudicationLastError ? { adjudicationLastError } : {}),
    ...(tempChatThread?.length ? { tempChatThread } : {}),
    ...(meetLinkedNpcId ? { meetLinkedNpcId } : {}),
    ...(meetUserProfileAtRequest ? { meetUserProfileAtRequest } : {}),
    ...(contactRemarkAlias ? { contactRemarkAlias } : {}),
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
      if (!db.objectStoreNames.contains(GROUP_PSYCHE_STORE)) {
        db.createObjectStore(GROUP_PSYCHE_STORE, { keyPath: 'conversationId' })
      }
      /** 回收站：任意升级路径下只要缺失就创建（避免 v24 已升版但 store 未创建的静默失败） */
      if (!db.objectStoreNames.contains(INDEXED_TRASH_STORE)) {
        const tr = db.createObjectStore(INDEXED_TRASH_STORE, { keyPath: 'id' })
        tr.createIndex('expiresAt', 'expiresAt', { unique: false })
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
  private __indexedTrashSuspendDepth = 0

  isIndexedTrashSuspended(): boolean {
    return this.__indexedTrashSuspendDepth > 0
  }

  async runWithIndexedTrashSuspended<T>(fn: () => Promise<T>): Promise<T> {
    this.__indexedTrashSuspendDepth += 1
    try {
      return await fn()
    } finally {
      this.__indexedTrashSuspendDepth -= 1
    }
  }

  // -------- 本地回收站（IndexedDB 删除快照，5 天过期） --------

  async appendIndexedTrashEntry(
    partial: Omit<IndexedTrashEntry, 'id' | 'deletedAt' | 'expiresAt'>,
  ): Promise<string> {
    if (this.__indexedTrashSuspendDepth > 0) return ''
    const db0 = await openDb()
    if (!db0.objectStoreNames.contains(INDEXED_TRASH_STORE)) {
      db0.close()
      return ''
    }
    db0.close()
    const id = `trash-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const now = Date.now()
    const row: IndexedTrashEntry = {
      ...partial,
      id,
      deletedAt: now,
      expiresAt: now + INDEXED_TRASH_RETENTION_MS,
    }
    const db = await openDb()
    const tx = db.transaction(INDEXED_TRASH_STORE, 'readwrite')
    tx.objectStore(INDEXED_TRASH_STORE).put(row)
    await txDone(tx)
    db.close()
    emitIndexedTrashChanged()
    return id
  }

  async listIndexedTrashEntries(): Promise<IndexedTrashEntry[]> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(INDEXED_TRASH_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(INDEXED_TRASH_STORE, 'readonly')
    const req = tx.objectStore(INDEXED_TRASH_STORE).getAll()
    const raw = await new Promise<IndexedTrashEntry[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as IndexedTrashEntry[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('indexedTrash getAll'))
    })
    await txDone(tx)
    db.close()
    return raw.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  }

  async getIndexedTrashEntry(id: string): Promise<IndexedTrashEntry | null> {
    const tid = id.trim()
    if (!tid) return null
    const db = await openDb()
    if (!db.objectStoreNames.contains(INDEXED_TRASH_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(INDEXED_TRASH_STORE, 'readonly')
    const req = tx.objectStore(INDEXED_TRASH_STORE).get(tid)
    const row = await new Promise<IndexedTrashEntry | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as IndexedTrashEntry | undefined)
      req.onerror = () => reject(req.error ?? new Error('indexedTrash get'))
    })
    await txDone(tx)
    db.close()
    return row ?? null
  }

  async removeIndexedTrashEntry(id: string): Promise<void> {
    const tid = id.trim()
    if (!tid) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(INDEXED_TRASH_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(INDEXED_TRASH_STORE, 'readwrite')
    tx.objectStore(INDEXED_TRASH_STORE).delete(tid)
    await txDone(tx)
    db.close()
    emitIndexedTrashChanged()
  }

  /** 物理清除已过期的回收站条目，返回删除条数 */
  async purgeExpiredIndexedTrash(): Promise<number> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(INDEXED_TRASH_STORE)) {
      db.close()
      return 0
    }
    const tx = db.transaction(INDEXED_TRASH_STORE, 'readwrite')
    const store = tx.objectStore(INDEXED_TRASH_STORE)
    const idx = store.index('expiresAt')
    const now = Date.now()
    let removed = 0
    await new Promise<void>((resolve, reject) => {
      const req = idx.openCursor(IDBKeyRange.upperBound(now))
      req.onsuccess = () => {
        const cur = req.result
        if (cur) {
          cur.delete()
          removed += 1
          cur.continue()
        } else resolve()
      }
      req.onerror = () => reject(req.error ?? new Error('purge indexedTrash'))
    })
    await txDone(tx)
    db.close()
    if (removed) emitIndexedTrashChanged()
    return removed
  }

  async listAllChatConversationSettings(): Promise<ChatConversationSettingsRow[]> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHAT_CONV_SETTINGS_STORE, 'readonly')
    const req = tx.objectStore(CHAT_CONV_SETTINGS_STORE).getAll()
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('listAllChatConversationSettings'))
    })
    await txDone(tx)
    db.close()
    return raw.map(normalizeChatConversationSettingsRow).filter((x): x is ChatConversationSettingsRow => !!x)
  }

  async listAllNetworkGraphViews(): Promise<NetworkGraphViewRecord[]> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(GRAPH_VIEW_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(GRAPH_VIEW_STORE, 'readonly')
    const req = tx.objectStore(GRAPH_VIEW_STORE).getAll()
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('listAllNetworkGraphViews'))
    })
    await txDone(tx)
    db.close()
    const out: NetworkGraphViewRecord[] = []
    for (const x of raw) {
      const n = normalizeNetworkGraphView(x)
      if (n) out.push(n)
    }
    return out
  }

  async getRawPlayerLinksRow(
    rootCharacterId: string,
  ): Promise<{ rootCharacterId: string; links: PlayerNetworkLink[]; updatedAt: number } | null> {
    const rid = rootCharacterId.trim()
    if (!rid) return null
    const db = await openDb()
    if (!db.objectStoreNames.contains(PLAYER_LINKS_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(PLAYER_LINKS_STORE, 'readonly')
    const req = tx.objectStore(PLAYER_LINKS_STORE).get(rid)
    const row = await new Promise<PlayerLinksRecord | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as PlayerLinksRecord | undefined)
      req.onerror = () => reject(req.error ?? new Error('playerLinks get raw'))
    })
    await txDone(tx)
    db.close()
    if (!row || typeof row.rootCharacterId !== 'string') return null
    const now = Date.now()
    const links = Array.isArray(row.links) ? row.links.map((l) => normalizePlayerLink(l, now)) : []
    return { rootCharacterId: row.rootCharacterId, links, updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : now }
  }

  /**
   * 将会话下全部消息与 chatConversationSettings 迁到新 conversationKey（马甲隔离迁移用）。
   * @returns 迁移的消息条数
   */
  async rekeyWeChatConversation(params: {
    fromConversationKey: string
    toConversationKey: string
    sessionPlayerIdentityId: string
  }): Promise<number> {
    const from = params.fromConversationKey.trim()
    const to = params.toConversationKey.trim()
    const pid = params.sessionPlayerIdentityId.trim() || '__none__'
    if (!from || !to || from === to) return 0

    const msgs = await this.listWeChatChatMessagesByConversationKey(from)
    if (!msgs.length) return 0

    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return 0
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readwrite')
    const store = tx.objectStore(CHAT_MSG_STORE)
    for (const m of msgs) {
      const next = normalizeWeChatChatMessage({
        ...m,
        conversationKey: to,
        playerIdentityId: pid,
      })
      if (next) store.put(next)
    }
    await txDone(tx)
    const hasConvSettings = db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE)
    db.close()

    if (hasConvSettings) {
      const fromSt = await this.getChatConversationSettings(from)
      const toSt = await this.getChatConversationSettings(to)
      if (fromSt || toSt) {
        const db2 = await openDb()
        const tx2 = db2.transaction(CHAT_CONV_SETTINGS_STORE, 'readwrite')
        const css = tx2.objectStore(CHAT_CONV_SETTINGS_STORE)
        css.delete(from)
        const base = { ...(toSt ?? fromSt)!, conversationKey: to, playerIdentityId: pid, updatedAt: Date.now() }
        /** 分裂桶合并时勿把副桶的「仅 UI 隐藏」裁切带到主桶，避免历史像被删光 */
        if (toSt?.uiOnlyHiddenBeforeTimestamp) {
          base.uiOnlyHiddenBeforeTimestamp = toSt.uiOnlyHiddenBeforeTimestamp
        } else {
          delete base.uiOnlyHiddenBeforeTimestamp
        }
        css.put(base)
        await txDone(tx2)
        db2.close()
      }
    }

    const fromCursor = await this.getWechatReadCursor(from)
    const toCursor = await this.getWechatReadCursor(to)
    if (fromCursor > toCursor) {
      await this.setWechatReadCursor(to, fromCursor)
    }

    emitWeChatStorageChanged()
    return msgs.length
  }

  async listWeChatChatMessagesByConversationKey(conversationKey: string): Promise<WeChatChatMessage[]> {
    const k = conversationKey.trim()
    if (!k) return []
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const idx = tx.objectStore(CHAT_MSG_STORE).index('conversationKey')
    const req = idx.getAll(k)
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('listWeChatChatMessagesByConversationKey'))
    })
    await txDone(tx)
    db.close()
    return raw
      .map((x) => normalizeWeChatChatMessage(x))
      .filter((x): x is WeChatChatMessage => !!x)
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  /** 扫描全部聊天消息，收集去重后的 conversationKey（马甲隔离迁移用）。 */
  async listDistinctWeChatConversationKeysFromMessages(): Promise<string[]> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const store = tx.objectStore(CHAT_MSG_STORE)
    const all = await new Promise<unknown[]>((resolve, reject) => {
      const r = store.getAll()
      r.onsuccess = () => resolve((r.result as unknown[]) ?? [])
      r.onerror = () => reject(r.error ?? new Error('listDistinctWeChatConversationKeysFromMessages'))
    })
    await txDone(tx)
    db.close()
    const keys = new Set<string>()
    for (const raw of all) {
      const m = normalizeWeChatChatMessage(raw)
      const k = m?.conversationKey?.trim()
      if (k) keys.add(k)
    }
    return [...keys]
  }

  // -------- player identity --------

  /**
   * @param wechatAccountId 传入则仅返回该微信账号下的身份；不传则返回全部（内部迁移/清理用）
   */
  async listPlayerIdentities(wechatAccountId?: string): Promise<PlayerIdentity[]> {
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
    const all = res.map(normalizeCharacter).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    const acc = wechatAccountId?.trim()
    if (!acc) return all
    return all.filter((row) => row.wechatAccountId?.trim() === acc)
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

  /** 读取玩家身份；若指定微信账号且归属不一致则返回 null（防多账号串读） */
  async getPlayerIdentityForWechatAccount(
    id: string,
    wechatAccountId?: string | null,
  ): Promise<PlayerIdentity | null> {
    const row = await this.getPlayerIdentity(id)
    if (!row) return null
    const acc = wechatAccountId?.trim()
    if (!acc) return row
    const owner = row.wechatAccountId?.trim()
    if (!owner || owner !== acc) return null
    return row
  }

  async upsertPlayerIdentity(identity: PlayerIdentity): Promise<void> {
    const db = await openDb()
    const tx = db.transaction(IDENTITY_STORE, 'readwrite')
    tx.objectStore(IDENTITY_STORE).put(normalizeCharacter(identity))
    await txDone(tx)
    db.close()
  }

  async deletePlayerIdentity(id: string): Promise<void> {
    const pid = id.trim()
    if (!pid) return
    if (!this.isIndexedTrashSuspended()) {
      const identity = await this.getPlayerIdentity(pid)
      const rels = await this.listAllRelationships()
      const removedRels = rels.filter(
        (r) => r.isPlayerIdentity && (r.fromCharacterId === pid || r.toCharacterId === pid),
      )
      const currentId = await this.getCurrentIdentityId()
      await this.appendIndexedTrashEntry({
        kind: 'player-identity',
        title: `删除身份「${identity?.name?.trim() || pid}」`,
        summary: identity ? `${removedRels.length} 条身份关系` : '身份数据',
        payload: {
          identity,
          removedRelationships: removedRels,
          hadCurrentIdentity: currentId === pid,
        },
      })
    }
    const db = await openDb()
    const stores: string[] = [IDENTITY_STORE, REL_STORE, CONFIG_STORE]
    const tx = db.transaction(stores, 'readwrite')
    tx.objectStore(IDENTITY_STORE).delete(pid)

    // 清理身份相关关系
    const relStore = tx.objectStore(REL_STORE)
    const relReq = relStore.getAll()
    const rels = await new Promise<Relationship[]>((resolve, reject) => {
      relReq.onsuccess = () => resolve((relReq.result as Relationship[]) ?? [])
      relReq.onerror = () => reject(relReq.error ?? new Error('rel getAll'))
    })
    for (const r of rels) {
      if (r.isPlayerIdentity && (r.fromCharacterId === pid || r.toCharacterId === pid)) relStore.delete(r.id)
    }

    // 若删除的是当前身份，清空 currentIdentityId
    const cfgStore = tx.objectStore(CONFIG_STORE)
    const cfgReq = cfgStore.get('global')
    const cfg = await new Promise<Record<string, unknown> | null>((resolve) => {
      cfgReq.onsuccess = () => resolve((cfgReq.result as Record<string, unknown>) ?? null)
      cfgReq.onerror = () => resolve(null)
    })
    if (cfg && cfg.currentIdentityId === pid) {
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
          if (!m) continue
          const parsedPriv = parsePrivateWeChatConversationCharacterAndSession(m.conversationKey)
          const sessionInKey = parsedPriv?.sessionPlayerId ?? m.playerIdentityId
          if (sessionInKey !== fromPid && m.playerIdentityId !== fromPid) continue
          /** 群聊 NPC 气泡的 characterId 是真实角色 id，会话键须沿用原 wxgrp 键，禁止误用 wechatConversationKey(角色, …) 变成私聊键 */
          const oldCk = m.conversationKey.trim()
          const nextCk = (() => {
            if (isWechatGroupConversationKey(oldCk)) {
              const gid = parseGroupIdFromConversationKey(oldCk)
              return gid ? wechatGroupConversationKey(gid, toPid) : wechatConversationKey(m.characterId, toPid)
            }
            const parsed = parsePrivateWeChatConversationCharacterAndSession(oldCk)
            const peer = (parsed?.characterId ?? m.characterId).trim() || m.characterId
            return wechatConversationKey(peer, toPid)
          })()
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

  /**
   * 修复群聊消息被错误挂在「某角色私聊」conversationKey 下的数据（历史迁移 bug 等）。
   * - 玩家气泡：`characterId` 为群占位 `wxgrp:群id` 者应落在群键。
   * - 对方气泡：私聊键下不应出现与会话对方 id 不一致的 NPC（视为误入的群成员气泡），改写到同时包含该 NPC 与私聊对方的群。
   */
  async repairMisfiledWeChatMessagesAfterThreadMixup(playerIdentityId: string): Promise<number> {
    const pid = playerIdentityId.trim()
    if (!pid || pid === '__none__') return 0
    let fixed = 0
    let groups: GroupChatRow[] = []
    try {
      groups = await this.listGroupChatsForPlayerIdentity(pid)
    } catch {
      return 0
    }
    const db = await openDb()
    try {
      if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) return 0
      const tx = db.transaction(CHAT_MSG_STORE, 'readwrite')
      const store = tx.objectStore(CHAT_MSG_STORE)
      const all = await new Promise<unknown[]>((resolve, reject) => {
        const r = store.getAll()
        r.onsuccess = () => resolve((r.result as unknown[]) ?? [])
        r.onerror = () => reject(r.error ?? new Error('repairMisfiledWeChatMessagesAfterThreadMixup'))
      })
      for (const raw of all) {
        const m = normalizeWeChatChatMessage(raw)
        if (!m || m.playerIdentityId.trim() !== pid) continue
        const ck = m.conversationKey.trim()
        if (isWechatGroupConversationKey(ck)) continue
        const parsed = parsePrivateWeChatConversationCharacterAndSession(ck)
        if (!parsed) continue
        const peer = parsed.characterId.trim()
        if (!peer || peer === WECHAT_LUMI_PEER_CHARACTER_ID) continue
        let newKey: string | null = null
        if (m.type === 'player') {
          const gid = parseGroupIdFromGroupPeerCharacterId(m.characterId)
          if (gid) newKey = wechatGroupConversationKey(gid, pid)
        } else if (m.type === 'character') {
          const npcId = m.characterId.trim()
          if (!npcId || npcId === WECHAT_GROUP_BOT_CHARACTER_ID || npcId === peer) continue
          let candidates = groups.filter(
            (g) =>
              (g.members ?? []).some((mm) => mm.charId === peer) &&
              (g.members ?? []).some((mm) => mm.charId === npcId),
          )
          /** 导入/成员表与私聊 peer 不完全同步时：仍尝试把误入私聊键的 NPC 气泡迁回「含该 NPC」的群（取最近活跃） */
          if (candidates.length === 0) {
            candidates = groups.filter((g) => (g.members ?? []).some((mm) => mm.charId === npcId))
          }
          if (candidates.length === 0) continue
          const pick =
            candidates.length === 1
              ? candidates[0]!
              : [...candidates].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0]!
          newKey = wechatGroupConversationKey(pick.id.trim(), pid)
        }
        if (!newKey || newKey === ck) continue
        const moved = normalizeWeChatChatMessage({ ...m, conversationKey: newKey })
        if (!moved) continue
        store.put(moved)
        fixed += 1
      }
      await txDone(tx)
    } finally {
      db.close()
    }
    if (fixed) emitWeChatStorageChanged()
    return fixed
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

  async listCharactersForWechatAccount(wechatAccountId: string): Promise<Stored[]> {
    const acc = wechatAccountId.trim()
    if (!acc) return []
    const all = await this.listCharacters()
    return all.filter((c) => c.wechatAccountId?.trim() === acc)
  }

  async listRootCharactersForWechatAccount(wechatAccountId: string): Promise<Stored[]> {
    const rows = await this.listCharactersForWechatAccount(wechatAccountId)
    return rows.filter((c) => !c.generatedForCharacterId)
  }

  async listNpcsForWechatAccount(mainCharacterId: string, wechatAccountId: string): Promise<Stored[]> {
    const root = mainCharacterId.trim()
    const acc = wechatAccountId.trim()
    if (!root || !acc) return []
    return (await this.listCharactersForWechatAccount(acc)).filter((c) => c.generatedForCharacterId === root)
  }

  /** 主账号首次启动：为无 wechatAccountId 的历史人设补归属（不复制数据） */
  async attachOrphanCharactersToWechatAccount(wechatAccountId: string): Promise<void> {
    const acc = wechatAccountId.trim()
    if (!acc) return
    const all = await this.listCharacters()
    for (const row of all) {
      if (row.wechatAccountId?.trim()) continue
      await this.upsertCharacter(stampWechatAccountOwner(row, acc))
    }
  }

  /** 按各马甲通讯录引用为无归属旧人设补 wechatAccountId；未被任何通讯录引用时回落 bundle 首账号 */
  async attachOrphanCharactersByContactOwnership(bundle: {
    accounts: { accountId: string; personaContacts: { characterId: string }[] }[]
  }): Promise<void> {
    const ownerByChar = new Map<string, string>()
    for (const acc of bundle.accounts) {
      const aid = acc.accountId.trim()
      if (!aid) continue
      for (const c of acc.personaContacts) {
        const cid = c.characterId.trim()
        if (cid) ownerByChar.set(cid, aid)
      }
    }
    const fallback = bundle.accounts[0]?.accountId?.trim()
    const all = await this.listCharacters()
    for (const row of all) {
      if (row.wechatAccountId?.trim()) continue
      const owner = ownerByChar.get(row.id) || fallback
      if (!owner) continue
      await this.upsertCharacter(stampWechatAccountOwner(row, owner))
    }
  }

  /** 将挂在别名角色 id 上的长期记忆迁到全局 canonical（跨马甲共享记忆） */
  async migrateCharacterMemoriesAliasToCanonical(aliasToCanonical: Record<string, string>): Promise<number> {
    let moved = 0
    for (const [from, to] of Object.entries(aliasToCanonical)) {
      const src = from.trim()
      const dst = to.trim()
      if (!src || !dst || src === dst) continue
      const mems = await this.listCharacterMemoriesForCharacter(src)
      for (const m of mems) {
        await this.upsertCharacterMemory({ ...m, characterId: dst, updatedAt: Date.now() })
        moved++
      }
    }
    return moved
  }

  async deleteCharactersForWechatAccount(
    wechatAccountId: string,
    opts?: { preserveCanonicalCharacterIds?: ReadonlySet<string> },
  ): Promise<void> {
    const acc = wechatAccountId.trim()
    if (!acc) return
    const preserve = opts?.preserveCanonicalCharacterIds ?? new Set<string>()
    const roots = await this.listRootCharactersForWechatAccount(acc)
    for (const root of roots) {
      const canonical = await resolveCanonicalCharacterId(root.id)
      if (preserve.has(canonical)) continue
      await this.deleteCharacter(root.id)
      await unregisterGlobalWechatCharacterForCharacterId(canonical)
    }
  }

  /** 读取 IndexedDB 原始行，不跟随全局微信号 canonical 重定向 */
  async getCharacterWithoutCanonicalRedirect(id: string): Promise<Stored | null> {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.get(id.trim())
    const res = await new Promise<Stored | null>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as Stored) ?? null)
      req.onerror = () => reject(req.error ?? new Error('get failed'))
    })
    await txDone(tx)
    db.close()
    return res ? normalizeCharacter(res) : null
  }

  async getCharacter(id: string): Promise<Stored | null> {
    const canonicalId = await resolveCanonicalCharacterId(id)
    return await this.getCharacterWithoutCanonicalRedirect(canonicalId)
  }

  /**
   * 本账号可见的主角人设：自建 + 通讯录已添加的全局角色（共享微信号人设/长期记忆）。
   */
  async listRootCharactersAccessibleToWechatAccount(
    wechatAccountId: string,
    linkedCharacterIds: string[] = [],
  ): Promise<Stored[]> {
    const acc = wechatAccountId.trim()
    if (!acc) return []
    const owned = await this.listRootCharactersForWechatAccount(acc)
    const seen = new Set(owned.map((c) => c.id))
    const out = [...owned]

    for (const rawId of linkedCharacterIds) {
      const canonical = await resolveCanonicalCharacterId(rawId)
      if (!canonical || seen.has(canonical)) continue
      const ch = await this.getCharacterWithoutCanonicalRedirect(canonical)
      if (!ch || ch.generatedForCharacterId) continue
      seen.add(ch.id)
      out.push(ch)
    }

    return out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  }

  async listNpcsForAccessibleRoot(
    mainCharacterId: string,
    wechatAccountId: string,
    linkedCharacterIds: string[] = [],
  ): Promise<Stored[]> {
    const root = mainCharacterId.trim()
    const acc = wechatAccountId.trim()
    if (!root || !acc) return []
    const rootRow = await this.getCharacter(root)
    if (!rootRow) return []
    const linked = new Set(linkedCharacterIds.map((x) => x.trim()))
    const canAccess =
      characterBelongsToWechatAccount(rootRow, acc) || linked.has(root) || linked.has(rootRow.id)
    if (!canAccess) return []
    return this.listNpcsFor(root)
  }

  async upsertCharacter(c: Stored): Promise<void> {
    let next = normalizeCharacter(c)
    const prior = await this.getCharacterWithoutCanonicalRedirect(next.id)
    if (prior) {
      next = preserveCharacterBoundPlayerIdentity(prior, next)
    }
    const wx = next.wechatId?.trim()
    if (wx) {
      const { canonicalCharacterId, mergedAlias } = await registerGlobalWechatCharacter(
        wx,
        next.id,
        next.wechatAccountId,
      )
      if (mergedAlias && canonicalCharacterId !== next.id) {
        const existing = await this.getCharacterWithoutCanonicalRedirect(canonicalCharacterId)
        if (existing) {
          next = normalizeCharacter({
            ...existing,
            ...next,
            id: canonicalCharacterId,
            wechatAccountId: existing.wechatAccountId ?? next.wechatAccountId,
          })
          next = preserveCharacterBoundPlayerIdentity(existing, next)
        } else {
          next = { ...next, id: canonicalCharacterId }
        }
      }
    }

    const db = await openDb()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(next)
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

  /** 清除某会话在 memorySettings 中的自动总结轮数 / 游标（私聊键或群键 `wxgrp:…`） */
  async clearMemoryTracksForWeChatConversationKey(conversationKey: string): Promise<void> {
    const k = conversationKey.trim()
    if (!k) return
    try {
      const settings = await this.getMemorySettings()
      const aiMap = { ...(settings.aiRoundCountByConversation ?? {}) }
      const sumMap = { ...(settings.summaryCursorTimestampByConversation ?? {}) }
      let changed = false
      if (k in aiMap) {
        delete aiMap[k]
        changed = true
      }
      if (k in sumMap) {
        delete sumMap[k]
        changed = true
      }
      if (changed) {
        await this.putMemorySettings(
          {
            aiRoundCountByConversation: Object.keys(aiMap).length ? aiMap : undefined,
            summaryCursorTimestampByConversation: Object.keys(sumMap).length ? sumMap : undefined,
          },
          { emit: false },
        )
      }
    } catch {
      /* ignore */
    }
  }

  /** 删除群心语存档（key 为群占位 `wxgrp:群id`） */
  async deleteGroupPsycheByPeerCharacterId(peerCharacterId: string): Promise<void> {
    const cid = peerCharacterId.trim()
    if (!cid) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(GROUP_PSYCHE_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(GROUP_PSYCHE_STORE, 'readwrite')
    tx.objectStore(GROUP_PSYCHE_STORE).delete(cid)
    await txDone(tx)
    db.close()
  }

  /** 仅删除某会话下、发言者 id 落在集合内的消息（用于从混合群中剥离已删角色） */
  async deleteWeChatMessagesInConversationFromCharacterIds(
    conversationKey: string,
    characterIds: Set<string>,
  ): Promise<void> {
    const k = conversationKey.trim()
    if (!k || !characterIds.size) return
    const msgs = await this.listWeChatChatMessagesByConversationKey(k)
    const toDelete = msgs.filter((m) => characterIds.has(m.characterId.trim())).map((m) => m.id.trim()).filter(Boolean)
    if (!toDelete.length) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readwrite')
    const store = tx.objectStore(CHAT_MSG_STORE)
    for (const id of toDelete) store.delete(id)
    await txDone(tx)
    db.close()
  }

  /**
   * 删除人设/NPC 时：清理其参与的群聊——仅 NPC 均为被删 id 的群整表删除；
   * 否则从成员表与消息里剥离这些 id（无剩余 NPC 时仍解散群）。
   */
  async purgeGroupChatsTouchingDeletedCharacterIds(idsToRemove: Set<string>): Promise<void> {
    if (!idsToRemove.size) return
    const groups = await this.listGroupChats()
    for (const g of groups) {
      const gid = g.id?.trim()
      const pid = (g.playerIdentityId || '').trim()
      if (!gid || !pid) continue
      const members = g.members ?? []
      const npcMembers = members.filter(
        (m) =>
          m.charId.trim() &&
          m.charId !== WECHAT_GROUP_USER_CHAR_ID &&
          m.charId !== WECHAT_GROUP_BOT_CHARACTER_ID,
      )
      const touches = npcMembers.some((m) => idsToRemove.has(m.charId.trim()))
      if (!touches) continue

      const convKey = wechatGroupConversationKey(gid, pid)
      const allNpcRemoved =
        npcMembers.length > 0 && npcMembers.every((m) => idsToRemove.has(m.charId.trim()))

      if (allNpcRemoved) {
        await this.deleteGroupChat(gid, pid)
        continue
      }

      const nextMembers = members.filter((m) => !idsToRemove.has(m.charId.trim()))
      const nextNpc = nextMembers.filter(
        (m) =>
          m.charId.trim() &&
          m.charId !== WECHAT_GROUP_USER_CHAR_ID &&
          m.charId !== WECHAT_GROUP_BOT_CHARACTER_ID,
      )
      if (nextNpc.length === 0) {
        await this.deleteGroupChat(gid, pid)
        continue
      }

      await this.deleteWeChatMessagesInConversationFromCharacterIds(convKey, idsToRemove)
      const nextRow: GroupChatRow = {
        ...g,
        members: nextMembers,
        memberIds: nextMembers.map((m) => m.charId).filter(Boolean),
        updatedAt: Date.now(),
      }
      await this.putGroupChat(nextRow)
    }
  }

  async deleteCharacter(id: string): Promise<void> {
    const deleteId = await resolveCanonicalCharacterId(id)
    if (!this.isIndexedTrashSuspended()) {
      const snap = await buildCharacterFullTrashArchive(this as unknown as PersonaDbTrashSource, deleteId)
      if (snap) await this.appendIndexedTrashEntry(snap)
    }
    const npcs = await this.listNpcsFor(deleteId)
    const idsToRemove = new Set<string>([deleteId, ...npcs.map((n) => n.id)])
    await this.purgeGroupChatsTouchingDeletedCharacterIds(idsToRemove)
    const db = await openDb()
    const stores: string[] = [STORE, REL_STORE]
    if (db.objectStoreNames.contains(GRAPH_VIEW_STORE)) stores.push(GRAPH_VIEW_STORE)
    if (db.objectStoreNames.contains(CHAT_MSG_STORE)) stores.push(CHAT_MSG_STORE)
    if (db.objectStoreNames.contains(CHARACTER_MEMORIES_STORE)) stores.push(CHARACTER_MEMORIES_STORE)
    if (db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE)) stores.push(CHAT_CONV_SETTINGS_STORE)
    if (db.objectStoreNames.contains(CHARACTER_DANMAKU_STORE)) stores.push(CHARACTER_DANMAKU_STORE)
    /** 下文会访问 playerNetworkLinks；须在建事务时纳入 scope，否则会抛 object store was not found */
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
        if (row.rootCharacterId === deleteId || idsToRemove.has(row.perspectiveCharacterId)) gv.delete(row.id)
      }
    }
    if (db.objectStoreNames.contains(PLAYER_LINKS_STORE)) {
      tx.objectStore(PLAYER_LINKS_STORE).delete(deleteId)
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
    await unregisterGlobalWechatCharacterForCharacterId(deleteId)
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
  async deleteCharacterDataKeepNetworkRelationships(
    characterIds: string[],
    opts?: { preserveWeChatConversationKeys?: string[] },
  ): Promise<void> {
    if (!characterIds.length) return
    const idsToRemove = new Set<string>()
    for (const raw of characterIds.map((x) => x.trim()).filter(Boolean)) {
      idsToRemove.add(raw)
      try {
        const npcs = await this.listNpcsFor(raw)
        for (const n of npcs) {
          const nid = n.id?.trim()
          if (nid) idsToRemove.add(nid)
        }
      } catch {
        /* ignore */
      }
    }
    if (!idsToRemove.size) return

    const idsArr = [...idsToRemove]
    const preserveConv = new Set(
      (opts?.preserveWeChatConversationKeys ?? []).map((k) => k.trim()).filter(Boolean),
    )

    if (!this.isIndexedTrashSuspended()) {
      const messagesRaw = await this.listWeChatChatMessagesByCharacterIds(idsArr)
      const messages = messagesRaw.filter((m) => !preserveConv.has(m.conversationKey.trim()))
      const allMem = await this.listAllCharacterMemories()
      const memories = allMem.filter((m) => idsToRemove.has(m.characterId))
      const allGv = await this.listAllNetworkGraphViews()
      const graphViews = allGv.filter(
        (row) => idsToRemove.has(row.rootCharacterId) || idsToRemove.has(row.perspectiveCharacterId),
      )
      const allCs = await this.listAllChatConversationSettings()
      const conversationSettings = allCs.filter(
        (row) => idsToRemove.has(row.peerCharacterId) && !preserveConv.has(row.conversationKey.trim()),
      )
      const danmakuRows: CharacterDanmakuSettingsRow[] = []
      for (const cid of idsToRemove) {
        const d = await this.getCharacterDanmakuSettings(cid)
        if (d) danmakuRows.push(d)
      }
      const playerLinksRows: Array<{ rootCharacterId: string; links: PlayerNetworkLink[]; updatedAt: number }> = []
      for (const cid of idsToRemove) {
        const row = await this.getRawPlayerLinksRow(cid)
        if (row) playerLinksRows.push(row)
      }
      const heartWhispers: HeartWhisperRow[] = []
      for (const cid of idsToRemove) {
        const h = await this.getHeartWhisper(cid)
        if (h) heartWhispers.push(h)
      }
      const datingRaw = await this.getPhoneKv(WECHAT_DATING_ARCHIVES_KV_KEY)
      const datingArchiveEntries: Record<string, unknown> = {}
      if (datingRaw && typeof datingRaw === 'object' && !Array.isArray(datingRaw)) {
        const arch = datingRaw as Record<string, unknown>
        for (const rid of idsToRemove) {
          if (rid in arch) datingArchiveEntries[rid] = arch[rid]
        }
      }
      await this.appendIndexedTrashEntry({
        kind: 'character-soft',
        title: `清除 ${idsArr.length} 个角色的聊天记录与记忆`,
        summary: `${messages.length} 条消息 · ${memories.length} 条记忆`,
        payload: {
          characterIds: idsArr,
          messages,
          memories,
          graphViews,
          conversationSettings,
          danmakuRows,
          playerLinksRows,
          heartWhispers,
          datingArchiveEntries,
        },
      })
    }

    await this.runWithIndexedTrashSuspended(async () => {
      await this.purgeWechatDatingArtifactsAndMemoryTracksForCharacterIds(idsArr)

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
        if (!idsToRemove.has(msg.characterId)) continue
        if (preserveConv.has(msg.conversationKey.trim())) continue
        cms.delete(msg.id)
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
        if (row && idsToRemove.has(row.peerCharacterId)) {
          if (preserveConv.has(row.conversationKey.trim())) continue
          css.delete(row.conversationKey)
        }
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
    })
  }

  /**
   * 仅删除指定微信马甲下该角色的聊天与对应会话设置（`wxapriv:` / `wxagrp:` 键）。
   * 不删人设本体、长期记忆、关系网。
   */
  async deleteWeChatScopedDataForCharactersOnWechatAccount(
    characterIds: string[],
    wechatAccountId: string,
  ): Promise<void> {
    const acc = wechatAccountId.trim()
    if (!acc || !characterIds.length) return

    const idSet = new Set<string>()
    for (const raw of characterIds) {
      const id = raw.trim()
      if (id) idSet.add(id)
    }
    if (!idSet.size) return

    const db = await openDb()
    const stores: string[] = []
    if (db.objectStoreNames.contains(CHAT_MSG_STORE)) stores.push(CHAT_MSG_STORE)
    if (db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE)) stores.push(CHAT_CONV_SETTINGS_STORE)
    if (!stores.length) {
      db.close()
      return
    }

    const tx = db.transaction(stores, 'readwrite')

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
        if (!idSet.has(msg.characterId)) continue
        if (!conversationKeyBelongsToWechatAccount(msg.conversationKey, acc)) continue
        cms.delete(msg.id)
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
        if (!row || !idSet.has(row.peerCharacterId)) continue
        if (!conversationKeyBelongsToWechatAccount(row.conversationKey, acc)) continue
        css.delete(row.conversationKey)
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
      fromCallsTo: '',
      isPlayerIdentity: true,
    }
    const b: Relationship = {
      id: `rel-pi-${identityId}-${characterId}-b`,
      fromCharacterId: characterId,
      toCharacterId: identityId,
      relation: '联系人',
      fromPerspective: `${characterName}认识${identityName}，双方已建立联系。`,
      toPerspective: `${identityName}认识${characterName}，双方已建立联系。`,
      fromCallsTo: '',
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
    const nid = npcId.trim()
    if (!nid) return
    const existing = await this.getCharacter(nid)
    const rootId = existing?.generatedForCharacterId ?? ''
    if (!this.isIndexedTrashSuspended()) {
      let graphView: NetworkGraphViewRecord | null = null
      if (rootId) graphView = await this.getNetworkGraphView(rootId, nid)
      const linksBefore = rootId ? await this.getRawPlayerLinksRow(rootId) : null
      await this.appendIndexedTrashEntry({
        kind: 'npc-only',
        title: `删除人脉「${existing?.name?.trim() || nid}」`,
        summary: rootId ? `隶属于主角 ${rootId.slice(0, 8)}…` : '独立 NPC',
        payload: { npcId: nid, rootCharacterId: rootId, character: existing, graphView, playerLinksRow: linksBefore },
      })
    }
    await this.purgeGroupChatsTouchingDeletedCharacterIds(new Set([nid]))
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
      if (r.fromCharacterId === nid || r.toCharacterId === nid) relStore.delete(r.id)
    }
    charStore.delete(nid)
    if (db.objectStoreNames.contains(GRAPH_VIEW_STORE) && rootId) {
      tx.objectStore(GRAPH_VIEW_STORE).delete(graphViewId(rootId, nid))
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
          .filter((l) => l.characterId !== nid)
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
      /** 为 true 时不播放新消息提示音（如群系统灰条） */
      quiet?: boolean
    },
  ): Promise<void> {
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return
    }
    const { notifyPeerTitle, quiet, ...msgRow } = row
    const conversationKey =
      msgRow.conversationKey?.trim() || wechatConversationKey(msgRow.characterId, msgRow.playerIdentityId)
    const normalized = normalizeWeChatChatMessage({ ...msgRow, conversationKey })
    if (!normalized) return
    const tx = db.transaction(CHAT_MSG_STORE, 'readwrite')
    tx.objectStore(CHAT_MSG_STORE).put(normalized)
    await txDone(tx)
    db.close()
    const peerForMerge = (() => {
      if (isWechatGroupConversationKey(conversationKey)) {
        const gid = parseGroupIdFromConversationKey(conversationKey)
        return gid ? wechatGroupPeerCharacterId(gid) : normalized.characterId
      }
      return normalized.characterId
    })()
    await this.mergeConversationLastMessageTime({
      conversationKey,
      peerCharacterId: peerForMerge,
      playerIdentityId: normalized.playerIdentityId,
      messageTimestamp: normalized.timestamp,
    })
    if (normalized.type === 'character' && notifyPeerTitle?.trim()) {
      const st = await this.getChatConversationSettings(conversationKey)
      maybeNotifyWeChatCharacterMessage({
        conversationKey,
        peerDisplayName: notifyPeerTitle.trim(),
        preview: formatWeChatMessagesTabPreviewFromStoredMessageContent(normalized.content),
        isMuted: !!st?.isMuted,
      })
    }

    if (normalized.type === 'character' && !quiet) {
      await this.maybePlayWeChatNewMessageSound({
        conversationKey,
        peerCharacterId: normalized.characterId,
        playerIdentityId: normalized.playerIdentityId,
      })
    }

    // 「删除聊天」后会话从信息列表隐藏；任一方产生新消息后重新显示（与微信体验一致）
    const stUnhide = await this.getChatConversationSettings(conversationKey)
    if (stUnhide?.hiddenFromMessageList) {
      await this.upsertChatConversationSettings({
        conversationKey,
        peerCharacterId: stUnhide.peerCharacterId,
        playerIdentityId: stUnhide.playerIdentityId,
        hiddenFromMessageList: false,
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

  /** 回收站列表：用备注/微信昵称/姓名与头像展示对方，避免裸 id */
  private async resolveWeChatTrashPeerLabelAndAvatar(
    conversationKey: string,
    conv: ChatConversationSettingsRow | null,
  ): Promise<{ label: string; avatarUrl: string }> {
    const k = conversationKey.trim()
    if (isWechatGroupConversationKey(k)) {
      const gid = parseGroupIdFromConversationKey(k)
      if (gid) {
        const g = await this.getGroupChat(gid)
        const label = (g?.remark ?? g?.name ?? '').trim() || '群聊'
        const avatarUrl = (g?.avatar ?? '').trim()
        return { label, avatarUrl }
      }
    }
    let peerId = (conv?.peerCharacterId ?? '').trim()
    if (!peerId && k) {
      const idx = k.lastIndexOf('::')
      if (idx > 0) peerId = k.slice(0, idx).trim()
    }
    if (peerId === WECHAT_LUMI_PEER_CHARACTER_ID) {
      return { label: 'Lumi', avatarUrl: '' }
    }
    if (peerId.startsWith('wxgrp:')) {
      return { label: '群聊', avatarUrl: '' }
    }
    if (!peerId) {
      return { label: '会话', avatarUrl: '' }
    }
    const ch = await this.getCharacter(peerId)
    const label =
      ch?.remark?.trim() || ch?.wechatNickname?.trim() || ch?.name?.trim() || '已删除的角色'
    const avatarUrl = ch?.avatarUrl?.trim() ?? ''
    return { label, avatarUrl }
  }

  async deleteWeChatChatMessageById(id: string): Promise<void> {
    const tid = id.trim()
    if (!tid) return
    if (!this.isIndexedTrashSuspended()) {
      const prev = await this.getWeChatChatMessageById(tid)
      if (prev) {
        const ck =
          prev.conversationKey?.trim() || wechatConversationKey(prev.characterId, prev.playerIdentityId)
        const conv = await this.getChatConversationSettings(ck)
        const { label, avatarUrl } = await this.resolveWeChatTrashPeerLabelAndAvatar(ck, conv)
        await this.appendIndexedTrashEntry({
          kind: 'wechat-message',
          title: `与「${label}」的聊天消息`,
          summary: `${prev.content?.slice(0, 48) || '(空)'}`.trim(),
          peerDisplayName: label,
          peerAvatarUrl: avatarUrl,
          payload: { message: prev },
        })
      }
    }
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

  /**
   * 启动时从私聊记录恢复通讯录：收集指定会话身份下出现过消息的对端角色 id（去重）。
   * 单次全表扫描，仅应在启动/迁移路径调用。
   */
  async listPrivateChatPeerCharacterIdsForSessions(sessionPlayerIdentityIds: string[]): Promise<string[]> {
    return this.listPrivateChatPeerCharacterIdsForWechatAccount('', sessionPlayerIdentityIds, {
      includeLegacyKeys: true,
    })
  }

  /**
   * 按微信马甲 + 会话身份收集私聊对端角色 id。
   * `wechatAccountId` 为空时等同全表 legacy 扫描（仅迁移/单账号用）。
   */
  async listPrivateChatPeerCharacterIdsForWechatAccount(
    wechatAccountId: string,
    sessionPlayerIdentityIds: string[],
    opts?: { includeLegacyKeys?: boolean },
  ): Promise<string[]> {
    const acc = wechatAccountId.trim()
    const wanted = new Set(
      sessionPlayerIdentityIds.map((id) => (id.trim() || '__none__')).filter(Boolean),
    )
    if (!wanted.size) return []
    const includeLegacy = opts?.includeLegacyKeys !== false

    const db = await openDb()
    if (!db.objectStoreNames.contains(CHAT_MSG_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(CHAT_MSG_STORE, 'readonly')
    const req = tx.objectStore(CHAT_MSG_STORE).getAll()
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('listPrivateChatPeerCharacterIdsForWechatAccount'))
    })
    await txDone(tx)
    db.close()

    const peers = new Set<string>()
    for (const x of raw) {
      const m = normalizeWeChatChatMessage(x)
      if (!m) continue
      const key = m.conversationKey?.trim()
      if (!key || isWechatGroupConversationKey(key)) continue

      const scoped = parseWechatAccountPrivateConversationKey(key)
      if (scoped) {
        if (acc && scoped.wechatAccountId !== acc) continue
        if (!wanted.has(scoped.sessionPlayerId)) continue
        const peer = scoped.characterId.trim()
        if (peer) peers.add(peer)
        continue
      }

      if (acc && !includeLegacy) continue

      const parsed = parsePrivateWeChatConversationCharacterAndSession(key)
      if (!parsed || !wanted.has(parsed.sessionPlayerId)) continue
      const peer = parsed.characterId.trim()
      if (peer) peers.add(peer)
    }
    return [...peers]
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
    return this.listFriendRequestsForPlayerIdentityIds([pid], {
      pendingOnly: params.pendingOnly,
    })
  }

  /** 同一微信马甲下多聊天身份：合并查询「新的朋友」记录（按 id 去重）。 */
  async listFriendRequestsForPlayerIdentityIds(
    playerIdentityIds: Iterable<string>,
    opts?: { pendingOnly?: boolean },
  ): Promise<FriendRequestRow[]> {
    const ids = [...new Set([...playerIdentityIds].map((x) => x.trim()).filter((x) => x && x !== '__none__'))]
    if (!ids.length) return []
    const db = await openDb()
    if (!db.objectStoreNames.contains(FRIEND_REQUEST_STORE)) {
      db.close()
      return []
    }
    const tx = db.transaction(FRIEND_REQUEST_STORE, 'readonly')
    const store = tx.objectStore(FRIEND_REQUEST_STORE)
    const idx = store.index('playerIdentityId')
    const rawChunks = await Promise.all(
      ids.map(
        (pid) =>
          new Promise<unknown[]>((resolve, reject) => {
            const req = idx.getAll(IDBKeyRange.only(pid))
            req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
            req.onerror = () => reject(req.error ?? new Error('friendRequests getAll'))
          }),
      ),
    )
    await txDone(tx)
    db.close()
    const byId = new Map<string, FriendRequestRow>()
    for (const raw of rawChunks) {
      for (const x of raw) {
        const row = normalizeFriendRequestRow(x)
        if (row) byId.set(row.id, row)
      }
    }
    const rows = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
    const pendingOnly = opts?.pendingOnly ?? true
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

  async setFriendRequestStatus(
    requestId: string,
    status: FriendRequestRow['status'],
    patch?: Partial<Pick<FriendRequestRow, 'outcomeUnread' | 'adjudicationCutoffMs' | 'adjudicationLastError'>>,
  ): Promise<void> {
    const id = requestId.trim()
    if (!id) return
    const existing = await this.getFriendRequestById(id)
    if (!existing) return
    await this.upsertFriendRequest({
      ...existing,
      ...patch,
      status,
      updatedAt: Date.now(),
      ...(patch?.outcomeUnread === false ? { outcomeUnread: false } : {}),
    })
  }

  async clearFriendRequestOutcomeUnread(requestId: string): Promise<void> {
    const id = requestId.trim()
    if (!id) return
    const existing = await this.getFriendRequestById(id)
    if (!existing?.outcomeUnread) return
    await this.upsertFriendRequest({ ...existing, outcomeUnread: false, updatedAt: Date.now() })
  }

  /** 进入「新的朋友」时批量清除被拒结果红点 */
  async clearFriendRequestOutcomeUnreadForIdentity(playerIdentityId: string): Promise<void> {
    const pid = playerIdentityId.trim()
    if (!pid) return
    const rows = await this.listFriendRequests({ playerIdentityId: pid, pendingOnly: false })
    await Promise.all(rows.filter((r) => r.outcomeUnread).map((r) => this.clearFriendRequestOutcomeUnread(r.id)))
  }

  async deleteFriendRequestById(requestId: string): Promise<void> {
    const id = requestId.trim()
    if (!id) return
    if (!this.isIndexedTrashSuspended()) {
      const prev = await this.getFriendRequestById(id)
      if (prev) {
        await this.appendIndexedTrashEntry({
          kind: 'friend-request',
          title: `删除好友申请`,
          summary: `${prev.characterId} · ${prev.status}`,
          payload: { friendRequest: prev },
        })
      }
    }
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
    const interval = Math.max(1, Math.floor(settings.autoSummaryInterval))
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

  /** 约会触发的合并总结成功后调用：清零该会话「距下次自动总结」计数，避免与已并入总结的私聊轮数错位。 */
  async resetMemoryAiRoundCountForConversation(conversationKey: string): Promise<void> {
    const ck = conversationKey.trim()
    if (!ck) return
    const settings = await this.getMemorySettings()
    const map = { ...(settings.aiRoundCountByConversation ?? {}) }
    delete map[ck]
    await this.putMemorySettings(
      { aiRoundCountByConversation: Object.keys(map).length ? map : undefined },
      { emit: false },
    )
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

  /** 遇见临时会话：读取上次自动总结覆盖到的消息时间戳 */
  async getMeetSummaryCursorTimestamp(characterId: string): Promise<number | null> {
    const id = characterId.trim()
    if (!id) return null
    const settings = await this.getMemorySettings()
    const ts = settings.meetSummaryCursorTimestampByCharacterId?.[id]
    return typeof ts === 'number' && Number.isFinite(ts) && ts >= 0 ? ts : null
  }

  /** 遇见临时会话：写入自动总结游标（最近一次已总结到的消息时间戳闭区间右端） */
  async setMeetSummaryCursorTimestamp(characterId: string, timestamp: number): Promise<void> {
    const id = characterId.trim()
    if (!id || !Number.isFinite(timestamp) || timestamp < 0) return
    const settings = await this.getMemorySettings()
    const map = { ...(settings.meetSummaryCursorTimestampByCharacterId ?? {}) }
    map[id] = Math.floor(timestamp)
    await this.putMemorySettings({ meetSummaryCursorTimestampByCharacterId: map }, { emit: false })
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

  /**
   * 删除指定主角存档下、某一约会 AI 剧情轮次产生的自动关联记忆（用于「重新生成该段」时覆盖）。
   * 支持多个 `linkedFromCharacterId`：人脉子角色约会时，历史数据可能挂在存档根 id 或视角人设 id 上，需一并扫清。
   */
  async deleteAutoLinkedMemoriesForDatingRoundMulti(
    linkedFromCharacterIds: readonly string[],
    datingPlotId: string,
  ): Promise<void> {
    const ownerSet = new Set(linkedFromCharacterIds.map((x) => String(x ?? '').trim()).filter(Boolean))
    const pid = datingPlotId.trim()
    if (!ownerSet.size || !pid) return
    const all = await this.listAllCharacterMemories()
    for (const m of all) {
      if (m.memoryScope !== 'linked' || !m.isAutoGenerated) continue
      const mo = (m.linkedFromCharacterId || '').trim()
      if (!ownerSet.has(mo)) continue
      if (m.datingLinkedSourcePlotId === pid) {
        await this.deleteCharacterMemory(m.id)
        continue
      }
      for (const owner of ownerSet) {
        const prefix = `mem-dlk--${encodeURIComponent(owner)}--${encodeURIComponent(pid)}--`
        if (m.id.startsWith(prefix)) {
          await this.deleteCharacterMemory(m.id)
          break
        }
      }
    }
  }

  /**
   * 删除指定主角存档下、某一约会 AI 剧情轮次产生的自动关联记忆（用于「重新生成该段」时覆盖）。
   */
  async deleteAutoLinkedMemoriesForDatingRound(
    linkedFromCharacterId: string,
    datingPlotId: string,
  ): Promise<void> {
    const owner = linkedFromCharacterId.trim()
    if (!owner) return
    await this.deleteAutoLinkedMemoriesForDatingRoundMulti([owner], datingPlotId)
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
      .map((x) => {
        const trimmed = typeof x.conversationKey === 'string' ? x.conversationKey.trim() : ''
        const conversationKey = trimmed || wechatConversationKey(x.characterId, x.playerIdentityId)
        return normalizeWeChatChatMessage({
          ...x,
          conversationKey,
        })
      })
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
    const mid = id.trim()
    if (!mid) return
    if (!this.isIndexedTrashSuspended()) {
      const db0 = await openDb()
      if (db0.objectStoreNames.contains(CHARACTER_MEMORIES_STORE)) {
        const tx0 = db0.transaction(CHARACTER_MEMORIES_STORE, 'readonly')
        const req0 = tx0.objectStore(CHARACTER_MEMORIES_STORE).get(mid)
        const raw0 = await new Promise<unknown>((resolve, reject) => {
          req0.onsuccess = () => resolve(req0.result)
          req0.onerror = () => reject(req0.error)
        })
        await txDone(tx0)
        db0.close()
        const mem = normalizeCharacterMemory(raw0)
        if (mem) {
          await this.appendIndexedTrashEntry({
            kind: 'character-memory',
            title: `删除记忆`,
            summary: mem.content?.slice(0, 64) || mem.id,
            payload: { memory: mem },
          })
        }
      } else {
        db0.close()
      }
    }
    const db = await openDb()
    if (!db.objectStoreNames.contains(CHARACTER_MEMORIES_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(CHARACTER_MEMORIES_STORE, 'readwrite')
    tx.objectStore(CHARACTER_MEMORIES_STORE).delete(mid)
    await txDone(tx)
    db.close()
    emitWeChatStorageChanged()
  }

  /** 涉及某角色的群聊提炼记忆（memoryScope=group 且 involvedCharIds 含该 id） */
  async listGroupMemoriesInvolvingCharacter(characterId: string): Promise<CharacterMemory[]> {
    const cid = characterId.trim()
    if (!cid) return []
    const all = await this.listAllCharacterMemories()
    return all
      .filter(
        (m) =>
          m.memoryScope === 'group' &&
          Array.isArray(m.involvedCharIds) &&
          m.involvedCharIds.some((x) => x.trim() === cid),
      )
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  /**
   * 将记忆正文中的 `{{user}}` / `{{char}}` / `{{archive_char}}` / `{{id:人设id}}` 展开为显示名（与私聊注入一致）。
   */
  async expandMemoryListContentForPrompt(memories: CharacterMemory[], memoryOwnerId: string): Promise<string[]> {
    const owner = memoryOwnerId.trim()
    if (!memories.length) return []
    if (!owner) return memories.map((m) => m.content.trim())

    const anyPh = memories.some((m) => String(m.content ?? '').includes('{{'))
    if (!anyPh) return memories.map((m) => m.content.trim())

    const ownerRow = await this.getCharacter(owner)
    let playerIden: PlayerIdentity | null = null
    const boundPid = ownerRow?.playerIdentityId?.trim()
    if (boundPid && boundPid !== '__none__') {
      try {
        playerIden = await this.getPlayerIdentity(boundPid)
      } catch {
        playerIden = null
      }
    }
    let playerDisplayFallback = ''
    try {
      const cur = await this.getCurrentIdentity()
      if (cur) {
        playerDisplayFallback =
          String(cur.wechatNickname ?? '').trim() ||
          String(cur.name ?? '').trim() ||
          String(cur.remark ?? '').trim() ||
          ''
      }
    } catch {
      playerDisplayFallback = ''
    }
    const baseNames = resolveCharUserNamesForPrompt({
      character: ownerRow,
      playerIdentity: playerIden,
      playerDisplayName: playerDisplayFallback,
    })

    /** 人脉档案：主角 + 子角色 + 管理关系绑定的跨档案主角（供 {{id:…}} 展开） */
    let npcNetworkIdMap: Record<string, string> = {}
    let npcArchiveMainDisplayName: string | undefined
    const npcRootId = ownerRow?.generatedForCharacterId?.trim()
    if (npcRootId) {
      npcNetworkIdMap = await buildLinkedMemoryIdDisplayNameMap(npcRootId)
      npcArchiveMainDisplayName = npcNetworkIdMap[npcRootId]
    } else if (owner) {
      npcNetworkIdMap = await buildLinkedMemoryIdDisplayNameMap(owner)
    }

    const linkedRoots = new Set(
      memories
        .filter((m) => m.memoryScope === 'linked')
        .map((m) => (m.linkedFromCharacterId || '').trim())
        .filter(Boolean),
    )
    const groupInvolvedIds = new Set<string>()
    for (const m of memories) {
      if (m.memoryScope !== 'group' || !Array.isArray(m.involvedCharIds)) continue
      for (const x of m.involvedCharIds) {
        const id = String(x ?? '').trim()
        if (id) groupInvolvedIds.add(id)
      }
    }
    const groupPeerIdMap: Record<string, string> = {}
    for (const gcid of groupInvolvedIds) {
      try {
        const ch = await this.getCharacter(gcid)
        groupPeerIdMap[gcid] =
          String(ch?.name ?? ch?.wechatNickname ?? '').trim() || gcid.slice(0, 8)
      } catch {
        groupPeerIdMap[gcid] = gcid.slice(0, 8)
      }
    }

    const rootMeta = new Map<string, { archiveName: string; idMap: Record<string, string> }>()
    for (const rootId of linkedRoots) {
      const idMap = await buildLinkedMemoryIdDisplayNameMap(rootId)
      const archiveName = idMap[rootId] ?? characterDisplayNameForIdMap(null, rootId)
      rootMeta.set(rootId, { archiveName, idMap })
    }

    const ownerIdMap: Record<string, string> = { [owner]: baseNames.charName }

    const { expandWorldBookItemUserPlaceholders } = await import('../worldBookUserPlaceholderBindings')
    const {
      alignCharacterMemoryUserPlaceholders,
      memoryNeedsUserPlaceholderAlignment,
      resolveMemoryExpandUserName,
    } = await import('../memoryUserPlaceholderBindings')

    const expandedMemories = await Promise.all(
      memories.map(async (m) => {
        let raw = String(m.content ?? '').trim()
        if (!raw.includes('{{user')) {
          return { m, raw }
        }
        let bindings = m.userPlaceholderBindings
        if (memoryNeedsUserPlaceholderAlignment(m)) {
          const aligned = await alignCharacterMemoryUserPlaceholders(m)
          raw = aligned.content
          bindings = aligned.userPlaceholderBindings
        }
        let userBindCharacter = ownerRow
        if (m.memoryScope === 'linked') {
          const lr = (m.linkedFromCharacterId || '').trim() || ownerRow?.generatedForCharacterId?.trim() || ''
          if (lr) {
            try {
              userBindCharacter = (await this.getCharacter(lr)) ?? ownerRow
            } catch {
              userBindCharacter = ownerRow
            }
          }
        }
        raw = await expandWorldBookItemUserPlaceholders(raw, bindings, userBindCharacter)
        return { m, raw }
      }),
    )

    const allRawForIdResolve = expandedMemories.map((x) => x.raw)
    const globalIdMap = await resolveMissingIdPlaceholderDisplayNames(
      { ...npcNetworkIdMap, ...ownerIdMap, ...groupPeerIdMap },
      allRawForIdResolve,
    )

    return Promise.all(
      expandedMemories.map(async ({ m, raw }) => {
        if (!raw.includes('{{')) return raw
        const lr = (m.linkedFromCharacterId || '').trim()
        let archiveCharName: string | undefined
        let idToDisplayName: Record<string, string> | undefined
        if (m.memoryScope === 'linked' && lr && rootMeta.has(lr)) {
          const meta = rootMeta.get(lr)!
          archiveCharName = meta.archiveName
          idToDisplayName = { ...globalIdMap, ...meta.idMap, ...ownerIdMap }
        } else if (m.memoryScope === 'group') {
          idToDisplayName = { ...globalIdMap, ...ownerIdMap, ...groupPeerIdMap }
        } else {
          idToDisplayName = { ...globalIdMap, ...ownerIdMap, ...groupPeerIdMap }
          if (npcArchiveMainDisplayName) {
            archiveCharName = npcArchiveMainDisplayName
          } else if (ownerRow && !npcRootId) {
            archiveCharName = baseNames.charName
          }
        }
        idToDisplayName = await resolveMissingIdPlaceholderDisplayNames(idToDisplayName, [raw])
        const userName = await resolveMemoryExpandUserName(m, ownerRow, baseNames.userName)
        return expandLinkedMemoryPlaceholders(raw, {
          charName: baseNames.charName,
          userName,
          archiveCharName,
          idToDisplayName,
        })
      }),
    )
  }

  /**
   * 手动编辑记忆草稿：按与入库后相同的规则展开 `{{user}}` / `{{char}}` 等，供前端预览核对姓名。
   * 群聊 bucket 的 characterId 非真人设时，会用 involvedCharIds 中首位真实成员 id 作为展开视角（与列表展示一致）。
   */
  async expandMemoryDraftForPromptPreview(params: {
    content: string
    characterId: string
    memoryScope?: CharacterMemoryScope
    linkedFromCharacterId?: string | null
    involvedCharIds?: string[] | null
    userPlaceholderBindings?: import('./types').WorldBookUserPlaceholderBinding[] | null
    sourceWechatAccountId?: string | null
    sourceSessionPlayerIdentityId?: string | null
  }): Promise<string> {
    const cid = params.characterId.trim()
    const raw = String(params.content ?? '').trim()
    if (!cid || !raw.includes('{{')) return raw

    let expandOwnerId = cid
    if (params.memoryScope === 'group') {
      const ids = params.involvedCharIds ?? []
      const firstReal = ids.find(
        (x) =>
          x.trim() &&
          x.trim() !== WECHAT_GROUP_USER_CHAR_ID &&
          x.trim() !== WECHAT_GROUP_BOT_CHARACTER_ID,
      )
      expandOwnerId = firstReal?.trim() || cid
    }

    const now = Date.now()
    const scope = params.memoryScope ?? 'private'
    const lr = params.linkedFromCharacterId?.trim()
    const srcAcc = params.sourceWechatAccountId?.trim()
    const srcSid = params.sourceSessionPlayerIdentityId?.trim()
    const wbBindings = params.userPlaceholderBindings ?? undefined
    const synthetic: CharacterMemory = {
      id: '__draft-preview__',
      characterId: cid,
      content: raw,
      createdAt: now,
      updatedAt: now,
      isAutoGenerated: false,
      memoryScope: scope,
      ...(lr && scope === 'linked' ? { linkedFromCharacterId: lr } : {}),
      ...(params.involvedCharIds?.length ? { involvedCharIds: [...params.involvedCharIds] } : {}),
      ...(srcAcc ? { sourceWechatAccountId: srcAcc } : {}),
      ...(srcSid ? { sourceSessionPlayerIdentityId: srcSid } : {}),
      ...(wbBindings?.length ? { userPlaceholderBindings: wbBindings } : {}),
    }
    const [out] = await this.expandMemoryListContentForPrompt([synthetic], expandOwnerId)
    return (out ?? raw).trim()
  }

  /**
   * 人设编辑页（简介、世界书条目等）：与记忆条目相同的占位符展开规则，供 UI「发给模型的预览」。
   * `characterId` 须为 IndexedDB 中的人设 id（根人设或 NPC）。
   */
  async expandCharacterFieldPlaceholderPreview(
    content: string,
    characterId: string,
    opts?: { worldBookUserPlaceholderBindings?: import('./types').WorldBookUserPlaceholderBinding[] },
  ): Promise<string> {
    const cid = characterId.trim()
    let raw = String(content ?? '')
    const wbBindings = opts?.worldBookUserPlaceholderBindings
    if (raw.includes('{{user') || (wbBindings?.length ?? 0) > 0) {
      const { expandWorldBookItemUserPlaceholders } = await import('../worldBookUserPlaceholderBindings')
      raw = await expandWorldBookItemUserPlaceholders(raw, wbBindings)
    }
    if (!raw.includes('{{')) return raw
    const hasBareUser = /\{\{user\}\}/.test(raw) || /\{\{user:/.test(raw)
    if ((wbBindings?.length ?? 0) > 0 && !hasBareUser) {
      return this.expandMemoryDraftForPromptPreview({
        content: raw,
        characterId: cid,
        memoryScope: 'private',
      })
    }
    return this.expandMemoryDraftForPromptPreview({
      content: raw,
      characterId: cid,
      memoryScope: 'private',
    })
  }

  /** 拼成注入系统提示的【长期记忆】正文；含私聊 + 共同参与群聊的穿透合并；无条目时返回空串 */
  async formatCharacterMemoriesForPrompt(characterId: string): Promise<string> {
    const cid = characterId.trim()
    if (!cid) return ''

    const privRaw = await this.listCharacterMemoriesForCharacter(cid)
    const privateList = privRaw.filter(isCharacterOwnPrivateMemory).sort((a, b) => a.createdAt - b.createdAt)

    const groupList = await this.listGroupMemoriesInvolvingCharacter(cid)

    const groupIds = [...new Set(groupList.map((m) => m.groupId).filter((x): x is string => !!x?.trim()))]
    const groupNameById = new Map<string, string>()
    for (const gid of groupIds) {
      const g = await this.getGroupChat(gid.trim())
      groupNameById.set(gid.trim(), g?.name?.trim() || '群聊')
    }

    const privateContents = await this.expandMemoryListContentForPrompt(privateList, cid)
    const groupContents = await this.expandMemoryListContentForPrompt(groupList, cid)

    const chunks: string[] = []
    if (privateList.length) {
      chunks.push(
        `【与该角色的私聊长期记忆】\n${privateList.map((_, i) => `${i + 1}. ${privateContents[i]}`).join('\n')}`,
      )
    }
    if (groupList.length) {
      chunks.push(
        `【你们共同参与过的群聊中被提炼的长期记忆】\n${groupList
          .map((m, i) => {
            const gid = m.groupId?.trim()
            const gn = gid ? groupNameById.get(gid) ?? '群聊' : '群聊'
            return `${i + 1}. （群：${gn}）${groupContents[i]}`
          })
          .join('\n')}`,
      )
    }
    if (!chunks.length) return ''
    const body = chunks.join('\n\n')
    return `${body}\n\n（以上包含该角色与你的私聊记忆，以及你们共同参与的群聊记忆；请根据情境自然地回忆。）`
  }

  private static readonly MEMORY_PROMPT_LEGACY_UNTAGGED_MAX = 8

  /**
   * 供 AI 注入用：纳入「关键词命中」+ 可选「向量语义召回」+ 少量无关键词兜底，控制 token。
   * `relevanceText` 建议由最近气泡、用户末条输入、线下摘录尾部等拼接（调用方可用 `buildMemoryRelevanceHaystack`）。
   * 向量请求使用的 url/key：优先记忆设置里的「向量专用」项，缺省则回落到 `opts.apiConfig`（聊天 / chatCard）。
   */
  async formatCharacterMemoriesForPromptByRelevance(
    characterId: string,
    relevanceText: string,
    opts?: MemoryVectorRecallOpts | null,
  ): Promise<string> {
    const cid = characterId.trim()
    if (!cid) return ''
    const hay = String(relevanceText || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()

    const memorySettings = await this.getMemorySettings()
    const bucket = opts?.memoryBucket ?? 'own'

    const privRaw = await this.listCharacterMemoriesForCharacter(cid)
    const privateList =
      bucket === 'linked'
        ? privRaw.filter(isCharacterLinkedMemory)
        : privRaw.filter(isCharacterOwnPrivateMemory)
    const groupList = bucket === 'own' ? await this.listGroupMemoriesInvolvingCharacter(cid) : []

    const alwaysPrivate = privateList
      .filter((m) => isMemoryAlwaysTrigger(m))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MEMORY_ALWAYS_INJECT_CAP)
    const alwaysGroup = groupList
      .filter((m) => isMemoryAlwaysTrigger(m))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MEMORY_ALWAYS_INJECT_CAP)

    const pickKeywordHits = (list: CharacterMemory[]) =>
      hay.length >= 2 ? list.filter((m) => !isMemoryAlwaysTrigger(m) && memoryTriggerMatchesHaystack(m, hay)) : []

    const taggedPrivateHits = pickKeywordHits(privateList)
    const taggedGroupHits = pickKeywordHits(groupList)

    let vecExtraPrivate: CharacterMemory[] = []
    let vecExtraGroup: CharacterMemory[] = []
    let vectorUsed = false
    const embedCred = resolveEmbeddingApiCredentials(memorySettings, opts?.apiConfig ?? null)
    if (opts && isMemoryVectorRecallEnabled(memorySettings, opts) && embedCred) {
      const rawHay = String(relevanceText || '').trim()
      if (rawHay.length >= 10) {
        try {
          const modelId = resolveMemoryEmbeddingModelId(memorySettings, opts)
          const queryVec = await fetchEmbeddingVector(embedCred, rawHay, modelId)
          if (queryVec.length) {
            const union = [...privateList, ...groupList]
            await backfillMemoryEmbeddingsBestEffort({
              memories: union,
              upsert: (m) => this.upsertCharacterMemory(m),
              apiConfig: embedCred,
              modelId,
              queryDim: queryVec.length,
            })
            const privFresh = await this.listCharacterMemoriesForCharacter(cid)
            const groupFresh = await this.listGroupMemoriesInvolvingCharacter(cid)
            const privCandidates =
              bucket === 'linked'
                ? privFresh.filter(isCharacterLinkedMemory)
                : privFresh.filter(isCharacterOwnPrivateMemory)

            const exclP = new Set<string>([...alwaysPrivate, ...taggedPrivateHits].map((m) => m.id))
            vecExtraPrivate = pickMemoriesByVectorSimilarity({
              candidates: privCandidates,
              queryVec,
              topK: MEMORY_VECTOR_TOP_PRIVATE,
              minSim: MEMORY_VECTOR_MIN_SIM,
              excludeIds: exclP,
            })
            if (vecExtraPrivate.length) vectorUsed = true

            const exclG = new Set<string>([...alwaysGroup, ...taggedGroupHits].map((m) => m.id))
            vecExtraGroup = pickMemoriesByVectorSimilarity({
              candidates: groupFresh,
              queryVec,
              topK: MEMORY_VECTOR_TOP_GROUP,
              minSim: MEMORY_VECTOR_MIN_SIM,
              excludeIds: exclG,
            })
            if (vecExtraGroup.length) vectorUsed = true
          }
        } catch {
          /* 仅关键词 */
        }
      }
    }

    const legacyPrivate = privateList
      .filter((m) => !isMemoryAlwaysTrigger(m) && !memoryHasTriggerDimensions(m))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, PersonaDb.MEMORY_PROMPT_LEGACY_UNTAGGED_MAX)
    const legacyGroup = groupList
      .filter((m) => !isMemoryAlwaysTrigger(m) && !memoryHasTriggerDimensions(m))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, PersonaDb.MEMORY_PROMPT_LEGACY_UNTAGGED_MAX)

    const hasPrimaryPrivate = taggedPrivateHits.length || alwaysPrivate.length || vecExtraPrivate.length
    const privatePick = PersonaDb.mergeMemoriesForPromptPick(
      [...alwaysPrivate, ...taggedPrivateHits, ...vecExtraPrivate],
      hasPrimaryPrivate ? legacyPrivate.slice(0, 3) : legacyPrivate,
    )
    const groupTaggedUnion = new Map<string, CharacterMemory>()
    for (const m of [...alwaysGroup, ...taggedGroupHits, ...vecExtraGroup]) groupTaggedUnion.set(m.id, m)
    const hasPrimaryGroup = taggedGroupHits.length || alwaysGroup.length || vecExtraGroup.length
    const groupPick = PersonaDb.mergeMemoriesForPromptPick(
      [...groupTaggedUnion.values()],
      hasPrimaryGroup ? legacyGroup.slice(0, 3) : legacyGroup,
    )

    const groupIds = [...new Set(groupPick.map((m) => m.groupId).filter((x): x is string => !!x?.trim()))]
    const groupNameById = new Map<string, string>()
    for (const gid of groupIds) {
      const g = await this.getGroupChat(gid.trim())
      groupNameById.set(gid.trim(), g?.name?.trim() || '群聊')
    }

    const privateContentsPick = await this.expandMemoryListContentForPrompt(privatePick, cid)
    const groupContentsPick = await this.expandMemoryListContentForPrompt(groupPick, cid)

    const vectorTail = vectorUsed
      ? '以上含「始终触发」、关键词命中、向量语义召回及无触发词兜底。请按情境自然使用，勿机械复读。'
      : '以上含「始终触发」记忆、关键词命中项与少量无触发配置的旧数据兜底。请按情境自然使用，勿机械复读。'

    const lineScope = opts?.lineScope ?? null
    const chunks: string[] = []
    if (privatePick.length) {
      if (bucket === 'linked') {
        chunks.push(
          `【与该人脉角色的线下关联长期记忆（来自绑定主角约会剧情；与私聊自有记忆分轨注入）】\n${privatePick
            .map((_, i) => `${i + 1}. ${privateContentsPick[i]}`)
            .join('\n')}`,
        )
      } else if (lineScope?.wechatAccountId?.trim()) {
        const scopedBody = await formatPrivateMemoriesPromptWithLineScope({
          memories: privatePick,
          contents: privateContentsPick,
          scope: {
            wechatAccountId: lineScope.wechatAccountId.trim(),
            sessionPlayerIdentityId: lineScope.sessionPlayerIdentityId.trim() || '__none__',
          },
          vectorTail,
        })
        if (scopedBody.trim()) chunks.push(scopedBody)
      } else {
        chunks.push(
          `【与该角色的私聊长期记忆（关键词与向量语义筛选 + 少量无标签兜底）】\n${privatePick
            .map((_, i) => `${i + 1}. ${privateContentsPick[i]}`)
            .join('\n')}`,
        )
      }
    }
    if (groupPick.length) {
      chunks.push(
        `【你们共同参与过的群聊中被提炼的长期记忆（关键词与向量语义筛选 + 少量无标签兜底）】\n${groupPick
          .map((m, i) => {
            const gid = m.groupId?.trim()
            const gn = gid ? groupNameById.get(gid) ?? '群聊' : '群聊'
            return `${i + 1}. （群：${gn}）${groupContentsPick[i]}`
          })
          .join('\n')}`,
      )
    }
    if (!chunks.length) return ''
    const body = chunks.join('\n\n')
    if (bucket === 'linked') {
      return `${body}\n\n（${vectorTail}）`
    }
    if (lineScope?.wechatAccountId?.trim() && privatePick.length) {
      return body
    }
    return `${body}\n\n（${vectorTail}）`
  }

  /**
   * 思维溯源：拆出「关键词 / 始终命中」与「向量召回」条目（与 {@link formatCharacterMemoriesForPromptByRelevance} 同一套筛选）。
   */
  async getCharacterMemoryRelevanceTraceByRelevance(
    characterId: string,
    relevanceText: string,
    opts?: MemoryVectorRecallOpts | null,
  ): Promise<{
    keywordHits: Array<{
      keyword: string
      content: string
      sourceLineLabel: string
      lineRelation: MemoryLineRelation
    }>
    vectorRetrievals: Array<{
      relevanceScore: number
      content: string
      sourceLineLabel: string
      lineRelation: MemoryLineRelation
    }>
  }> {
    const cid = characterId.trim()
    if (!cid) return { keywordHits: [], vectorRetrievals: [] }
    const hay = String(relevanceText || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()

    const memorySettings = await this.getMemorySettings()
    const bucket = opts?.memoryBucket ?? 'own'

    const privRaw = await this.listCharacterMemoriesForCharacter(cid)
    const privateList =
      bucket === 'linked'
        ? privRaw.filter(isCharacterLinkedMemory)
        : privRaw.filter(isCharacterOwnPrivateMemory)
    const groupList = bucket === 'own' ? await this.listGroupMemoriesInvolvingCharacter(cid) : []

    const alwaysPrivate = privateList
      .filter((m) => isMemoryAlwaysTrigger(m))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MEMORY_ALWAYS_INJECT_CAP)
    const alwaysGroup = groupList
      .filter((m) => isMemoryAlwaysTrigger(m))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MEMORY_ALWAYS_INJECT_CAP)

    const pickKeywordHits = (list: CharacterMemory[]) =>
      hay.length >= 2 ? list.filter((m) => !isMemoryAlwaysTrigger(m) && memoryTriggerMatchesHaystack(m, hay)) : []

    const taggedPrivateHits = pickKeywordHits(privateList)
    const taggedGroupHits = pickKeywordHits(groupList)

    const labelForMemory = (m: CharacterMemory): string => {
      if (isMemoryAlwaysTrigger(m)) return '始终触发'
      const bits = [
        trimMemoryTriggerText(m.memoryTriggerPrecise),
        trimMemoryTriggerText(m.memoryTriggerCategory),
        ...(normalizeStoredMemoryEmotionNeedList(m.memoryTriggerEmotionNeed) ?? []).map((x) => trimMemoryTriggerText(x)),
        ...(String(m.memoryKeywords || '')
          .split(/[,，;；\n]+/)
          .map((x) => trimMemoryTriggerText(x))
          .filter(Boolean) as string[]),
      ].filter(Boolean)
      const u = [...new Set(bits)]
      return u.length ? u.slice(0, 6).join(' · ') : '关键词命中'
    }

    const kwMemoriesOrdered: CharacterMemory[] = []
    const seenKw = new Set<string>()
    for (const m of [...alwaysPrivate, ...alwaysGroup, ...taggedPrivateHits, ...taggedGroupHits]) {
      const k = `${labelForMemory(m)}::${m.id}`
      if (seenKw.has(k)) continue
      seenKw.add(k)
      kwMemoriesOrdered.push(m)
    }
    const kwExpanded = await this.expandMemoryListContentForPrompt(kwMemoriesOrdered, cid)
    const lineScope = opts?.lineScope ?? null
    const enrichTraceMeta = async (m: CharacterMemory) => {
      let sourceLineLabel = await formatMemorySourceLineLabelFromMemory(m)
      if (m.memoryScope === 'group' && m.groupId?.trim()) {
        const g = await this.getGroupChat(m.groupId.trim())
        sourceLineLabel = `群聊 · ${g?.name?.trim() || m.groupId.trim()}`
      }
      return {
        sourceLineLabel,
        lineRelation: resolveMemoryLineRelation(m, lineScope),
      }
    }
    const keywordHits = await Promise.all(
      kwMemoriesOrdered.map(async (m, i) => ({
        keyword: labelForMemory(m),
        content: kwExpanded[i] ?? m.content.trim(),
        ...(await enrichTraceMeta(m)),
      })),
    )

    const vectorRetrievals: Array<{
      relevanceScore: number
      content: string
      sourceLineLabel: string
      lineRelation: MemoryLineRelation
    }> = []
    const embedCred = resolveEmbeddingApiCredentials(memorySettings, opts?.apiConfig ?? null)
    if (opts && isMemoryVectorRecallEnabled(memorySettings, opts) && embedCred) {
      const rawHay = String(relevanceText || '').trim()
      if (rawHay.length >= 10) {
        try {
          const modelId = resolveMemoryEmbeddingModelId(memorySettings, opts)
          const queryVec = await fetchEmbeddingVector(embedCred, rawHay, modelId)
          if (queryVec.length) {
            const union = [...privateList, ...groupList]
            await backfillMemoryEmbeddingsBestEffort({
              memories: union,
              upsert: (m) => this.upsertCharacterMemory(m),
              apiConfig: embedCred,
              modelId,
              queryDim: queryVec.length,
            })
            const privFresh = await this.listCharacterMemoriesForCharacter(cid)
            const groupFresh = await this.listGroupMemoriesInvolvingCharacter(cid)
            const privCandidates =
              bucket === 'linked'
                ? privFresh.filter(isCharacterLinkedMemory)
                : privFresh.filter(isCharacterOwnPrivateMemory)

            const exclP = new Set<string>([...alwaysPrivate, ...taggedPrivateHits].map((m) => m.id))
            const scoredP = pickMemoriesByVectorSimilarityScored({
              candidates: privCandidates,
              queryVec,
              topK: MEMORY_VECTOR_TOP_PRIVATE,
              minSim: MEMORY_VECTOR_MIN_SIM,
              excludeIds: exclP,
            })

            const exclG = new Set<string>([...alwaysGroup, ...taggedGroupHits].map((m) => m.id))
            const scoredG = pickMemoriesByVectorSimilarityScored({
              candidates: groupFresh,
              queryVec,
              topK: MEMORY_VECTOR_TOP_GROUP,
              minSim: MEMORY_VECTOR_MIN_SIM,
              excludeIds: exclG,
            })
            const vecMemoriesCollected: CharacterMemory[] = []
            for (const { memory } of scoredP) vecMemoriesCollected.push(memory)
            for (const { memory } of scoredG) vecMemoriesCollected.push(memory)
            const vecSeen = new Set<string>()
            const vecUnique = vecMemoriesCollected.filter((mem) => {
              if (vecSeen.has(mem.id)) return false
              vecSeen.add(mem.id)
              return true
            })
            const vecExp = await this.expandMemoryListContentForPrompt(vecUnique, cid)
            const vecExpById = new Map(vecUnique.map((mem, i) => [mem.id, vecExp[i] ?? mem.content.trim()]))
            for (const { memory, score } of scoredP) {
              vectorRetrievals.push({
                relevanceScore: score,
                content: vecExpById.get(memory.id) ?? memory.content.trim(),
                ...(await enrichTraceMeta(memory)),
              })
            }
            for (const { memory, score } of scoredG) {
              vectorRetrievals.push({
                relevanceScore: score,
                content: vecExpById.get(memory.id) ?? memory.content.trim(),
                ...(await enrichTraceMeta(memory)),
              })
            }
          }
        } catch {
          /* 无向量数据 */
        }
      }
    }

    vectorRetrievals.sort((a, b) => b.relevanceScore - a.relevanceScore)
    return { keywordHits, vectorRetrievals }
  }

  private static mergeMemoriesForPromptPick(matches: CharacterMemory[], legacy: CharacterMemory[]): CharacterMemory[] {
    const seen = new Set<string>()
    const out: CharacterMemory[] = []
    for (const m of [...matches, ...legacy]) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      out.push(m)
    }
    return out.sort((a, b) => a.createdAt - b.createdAt)
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
    if (!this.isIndexedTrashSuspended()) {
      const snapshot = await this.getWorldBackground(id)
      if (snapshot) {
        const chars = await this.listCharacters()
        const identities = await this.listPlayerIdentities()
        const touchedChars = chars.filter((c) => c.worldBackgroundId === id).map((c) => ({ ...c }))
        const touchedIds = identities.filter((p) => p.worldBackgroundId === id).map((p) => ({ ...p }))
        await this.appendIndexedTrashEntry({
          kind: 'world-background',
          title: `删除世界「${snapshot.name?.trim() || id}」`,
          summary: `将 ${touchedChars.length + touchedIds.length} 个档案切回默认预设`,
          payload: {
            worldBackground: snapshot,
            touchedCharacters: touchedChars,
            touchedIdentities: touchedIds,
          },
        })
      }
    }
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
    const k = key.trim()
    if (!k) return
    if (!this.isIndexedTrashSuspended()) {
      const prev = await this.getPhoneKv(k)
      if (prev !== null && prev !== undefined) {
        await this.appendIndexedTrashEntry({
          kind: 'phone-kv',
          title: `删除键「${k.slice(0, 40)}」`,
          summary: typeof prev === 'object' ? 'JSON 数据' : String(prev).slice(0, 48),
          payload: { key: k, value: prev },
        })
      }
    }
    const db = await openDb()
    if (!db.objectStoreNames.contains(PHONE_KV_STORE)) {
      db.close()
      return
    }
    const tx = db.transaction(PHONE_KV_STORE, 'readwrite')
    tx.objectStore(PHONE_KV_STORE).delete(k)
    await txDone(tx)
    db.close()
  }

  /**
   * 记录「刚从哪一群切到该 NPC 私聊」，供私聊 prompt 优先注入该群近期/未总结摘录（{@link getPrivateChatAnchorGroupId}）。
   * 键按「人设 id + 私聊会话所用玩家身份段」区分，与 {@link resolvePrivateChatSessionPlayerIdentityId} 一致。
   */
  async setPrivateChatAnchorGroupId(
    characterId: string,
    sessionPlayerIdentityId: string,
    groupId: string,
  ): Promise<void> {
    const cid = characterId.trim()
    const pid = sessionPlayerIdentityId.trim()
    const gid = groupId.trim()
    if (!cid || !pid || pid === '__none__' || !gid) return
    let g: GroupChatRow | null = null
    try {
      g = await this.getGroupChat(gid)
    } catch {
      return
    }
    if (!g || !(g.members ?? []).some((m) => m.charId.trim() === cid)) return
    await this.setPhoneKv(`${WX_PRIVATE_ANCHOR_GROUP_KV_PREFIX}${cid}::${pid}`, {
      groupId: gid,
      setAtMs: Date.now(),
    })
  }

  /** 读取并校验 TTL、群内是否仍有该 NPC；无效则删键并返回 null */
  async getPrivateChatAnchorGroupId(characterId: string, sessionPlayerIdentityId: string): Promise<string | null> {
    const cid = characterId.trim()
    const pid = sessionPlayerIdentityId.trim()
    if (!cid || !pid || pid === '__none__') return null
    const key = `${WX_PRIVATE_ANCHOR_GROUP_KV_PREFIX}${cid}::${pid}`
    const raw = await this.getPhoneKv(key)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null
    }
    const o = raw as { groupId?: unknown; setAtMs?: unknown }
    const gid = typeof o.groupId === 'string' ? o.groupId.trim() : ''
    const ts = typeof o.setAtMs === 'number' && Number.isFinite(o.setAtMs) ? o.setAtMs : 0
    if (!gid || Date.now() - ts > WX_PRIVATE_ANCHOR_GROUP_TTL_MS) {
      await this.deletePhoneKv(key)
      return null
    }
    try {
      const g = await this.getGroupChat(gid)
      if (!g || !(g.members ?? []).some((m) => m.charId.trim() === cid)) {
        await this.deletePhoneKv(key)
        return null
      }
    } catch {
      await this.deletePhoneKv(key)
      return null
    }
    return gid
  }

  /**
   * 记录「刚从与该 NPC 的私聊进入本群」，供群聊系统提示优先注入该成员私聊近期/未总结摘录（{@link getGroupChatAnchorPrivatePeerCharacterId}）。
   * 键为「群 id + 本群会话所用玩家身份段」（与群消息 `conversationKey` 所用 identity 一致）。
   */
  async setGroupChatAnchorPrivatePeerCharacterId(
    groupId: string,
    playerIdentityIdForGroupKey: string,
    peerCharacterId: string,
  ): Promise<void> {
    const gid = groupId.trim()
    const pid = playerIdentityIdForGroupKey.trim()
    const cid = peerCharacterId.trim()
    if (!gid || !pid || pid === '__none__' || !cid || cid === WECHAT_LUMI_PEER_CHARACTER_ID) return
    let g: GroupChatRow | null = null
    try {
      g = await this.getGroupChat(gid)
    } catch {
      return
    }
    if (!g || !(g.members ?? []).some((m) => m.charId.trim() === cid)) return
    await this.setPhoneKv(`${WX_GROUP_ANCHOR_PRIVATE_PEER_KV_PREFIX}${gid}::${pid}`, {
      peerCharacterId: cid,
      setAtMs: Date.now(),
    })
  }

  /** 读取并校验 TTL、该成员是否仍在群内；无效则删键并返回 null */
  async getGroupChatAnchorPrivatePeerCharacterId(
    groupId: string,
    playerIdentityIdForGroupKey: string,
  ): Promise<string | null> {
    const gid = groupId.trim()
    const pid = playerIdentityIdForGroupKey.trim()
    if (!gid || !pid || pid === '__none__') return null
    const key = `${WX_GROUP_ANCHOR_PRIVATE_PEER_KV_PREFIX}${gid}::${pid}`
    const raw = await this.getPhoneKv(key)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null
    }
    const o = raw as { peerCharacterId?: unknown; setAtMs?: unknown }
    const cid = typeof o.peerCharacterId === 'string' ? o.peerCharacterId.trim() : ''
    const ts = typeof o.setAtMs === 'number' && Number.isFinite(o.setAtMs) ? o.setAtMs : 0
    if (!cid || Date.now() - ts > WX_PRIVATE_ANCHOR_GROUP_TTL_MS) {
      await this.deletePhoneKv(key)
      return null
    }
    try {
      const g = await this.getGroupChat(gid)
      if (!g || !(g.members ?? []).some((m) => m.charId.trim() === cid)) {
        await this.deletePhoneKv(key)
        return null
      }
    } catch {
      await this.deletePhoneKv(key)
      return null
    }
    return cid
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

  async getGroupPsyche(conversationId: string): Promise<GroupPsycheRow | null> {
    const cid = conversationId.trim()
    if (!cid) return null
    const db = await openDb()
    if (!db.objectStoreNames.contains(GROUP_PSYCHE_STORE)) {
      db.close()
      return null
    }
    const tx = db.transaction(GROUP_PSYCHE_STORE, 'readonly')
    const req = tx.objectStore(GROUP_PSYCHE_STORE).get(cid)
    const res = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('getGroupPsyche'))
    })
    await txDone(tx)
    db.close()
    return normalizeGroupPsycheRow(res)
  }

  async putGroupPsyche(conversationId: string, archive: GroupPsycheArchive): Promise<void> {
    const cid = conversationId.trim()
    if (!cid) return
    const db = await openDb()
    if (!db.objectStoreNames.contains(GROUP_PSYCHE_STORE)) {
      db.close()
      return
    }
    const row = normalizeGroupPsycheRow({
      conversationId: cid,
      archive,
      updatedAt: Date.now(),
    })
    if (!row) return
    const tx = db.transaction(GROUP_PSYCHE_STORE, 'readwrite')
    tx.objectStore(GROUP_PSYCHE_STORE).put(row)
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
      /** 为 true 时移除「仅 UI 隐藏」时间戳（与不传该字段不同） */
      clearUiOnlyHiddenBeforeTimestamp?: boolean
      /** 为 true 时移除「好友验证分隔」同意时间戳 */
      clearFriendRequestAcceptedAt?: boolean
    } & Partial<
      Pick<
        ChatConversationSettingsRow,
        | 'isPinned'
        | 'isMuted'
        | 'hiddenFromMessageList'
        | 'notifyEnabled'
        | 'showThinkingChain'
        | 'isDanmakuMode'
        | 'showGroupMemberNicknameInChat'
        | 'showGroupRankBadgesInChat'
        | 'chatBackground'
        | 'lastMessageTime'
        | 'uiOnlyHiddenBeforeTimestamp'
        | 'friendRequestAcceptedAtMs'
      >
    >,
  ): Promise<void> {
    const existing = await this.getChatConversationSettings(params.conversationKey)
    const now = Date.now()
    let uiOnlyHiddenBeforeTimestamp: number | undefined
    if (params.clearUiOnlyHiddenBeforeTimestamp) {
      uiOnlyHiddenBeforeTimestamp = undefined
    } else if (
      typeof params.uiOnlyHiddenBeforeTimestamp === 'number' &&
      Number.isFinite(params.uiOnlyHiddenBeforeTimestamp) &&
      params.uiOnlyHiddenBeforeTimestamp > 0
    ) {
      uiOnlyHiddenBeforeTimestamp = params.uiOnlyHiddenBeforeTimestamp
    } else {
      uiOnlyHiddenBeforeTimestamp = existing?.uiOnlyHiddenBeforeTimestamp
    }
    let friendRequestAcceptedAtMs: number | undefined
    if (params.clearFriendRequestAcceptedAt) {
      friendRequestAcceptedAtMs = undefined
    } else if (
      typeof params.friendRequestAcceptedAtMs === 'number' &&
      Number.isFinite(params.friendRequestAcceptedAtMs) &&
      params.friendRequestAcceptedAtMs > 0
    ) {
      friendRequestAcceptedAtMs = params.friendRequestAcceptedAtMs
    } else {
      friendRequestAcceptedAtMs = existing?.friendRequestAcceptedAtMs
    }
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
      showGroupMemberNicknameInChat:
        params.showGroupMemberNicknameInChat ?? existing?.showGroupMemberNicknameInChat ?? true,
      showGroupRankBadgesInChat:
        params.showGroupRankBadgesInChat ?? existing?.showGroupRankBadgesInChat ?? false,
      chatBackground: params.chatBackground ?? existing?.chatBackground ?? '',
      lastMessageTime: params.lastMessageTime ?? existing?.lastMessageTime ?? 0,
      updatedAt: now,
      ...(typeof uiOnlyHiddenBeforeTimestamp === 'number' &&
      Number.isFinite(uiOnlyHiddenBeforeTimestamp) &&
      uiOnlyHiddenBeforeTimestamp > 0
        ? { uiOnlyHiddenBeforeTimestamp }
        : {}),
      ...(typeof friendRequestAcceptedAtMs === 'number' &&
      Number.isFinite(friendRequestAcceptedAtMs) &&
      friendRequestAcceptedAtMs > 0
        ? { friendRequestAcceptedAtMs }
        : {}),
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
    if (peer && peer !== WECHAT_LUMI_PEER_CHARACTER_ID && !peer.startsWith('wxgrp:')) {
      const ch = await this.getCharacter(peer)
      if (ch) {
        const cMerged = Math.max(ch.lastMessageTime ?? 0, merged)
        if (cMerged !== (ch.lastMessageTime ?? 0)) {
          await this.upsertCharacter({ ...ch, lastMessageTime: cMerged })
        }
      }
    }
  }

  /**
   * 清空本地消息后：将该会话标为「不在信息列表显示」，直至 {@link appendWeChatChatMessage} 写入新消息。
   * （与左滑「不显示」共用 `hiddenFromMessageList`，避免删记录后仍占一排「点击开始聊天」。）
   */
  private async markConversationHiddenAfterHistoryCleared(
    conversationKey: string,
    existing: ChatConversationSettingsRow | null,
  ): Promise<void> {
    const k = conversationKey.trim()
    if (!k) return
    if (existing) {
      await this.upsertChatConversationSettings({
        conversationKey: k,
        peerCharacterId: existing.peerCharacterId,
        playerIdentityId: existing.playerIdentityId,
        hiddenFromMessageList: true,
        clearUiOnlyHiddenBeforeTimestamp: true,
        clearFriendRequestAcceptedAt: true,
      })
      return
    }
    if (isWechatGroupConversationKey(k)) {
      const gid = parseGroupIdFromConversationKey(k)
      const idx = k.lastIndexOf('::')
      const pid = idx >= 0 ? k.slice(idx + 2).trim() : ''
      if (gid && pid) {
        await this.upsertChatConversationSettings({
          conversationKey: k,
          peerCharacterId: wechatGroupPeerCharacterId(gid),
          playerIdentityId: pid,
          hiddenFromMessageList: true,
          clearUiOnlyHiddenBeforeTimestamp: true,
          clearFriendRequestAcceptedAt: true,
        })
      }
    } else {
      const idx = k.lastIndexOf('::')
      if (idx > 0) {
        const peer = k.slice(0, idx).trim()
        const pid = k.slice(idx + 2).trim()
        if (peer && pid) {
          await this.upsertChatConversationSettings({
            conversationKey: k,
            peerCharacterId: peer,
            playerIdentityId: pid,
            hiddenFromMessageList: true,
            clearUiOnlyHiddenBeforeTimestamp: true,
            clearFriendRequestAcceptedAt: true,
          })
        }
      }
    }
  }

  /**
   * 仅从聊天界面「清空」展示：本地消息不删；AI 仍按完整历史转写。
   * 时间戳 ≤ 写入时刻的泡泡在界面隐藏，新消息照常显示。
   * 与「彻底删除」一致写入回收站快照（payload.uiClearOnly），恢复时仅撤销界面隐藏、不重复插入消息。
   */
  async hideWeChatConversationHistoryFromUiKeepAiContext(conversationKey: string): Promise<void> {
    const k = conversationKey.trim()
    if (!k) return
    const msgs = await this.listWeChatChatMessagesByConversationKey(k)
    const convBefore = await this.getChatConversationSettings(k)
    if (!this.isIndexedTrashSuspended()) {
      const { label, avatarUrl } = await this.resolveWeChatTrashPeerLabelAndAvatar(k, convBefore)
      await this.appendIndexedTrashEntry({
        kind: 'wechat-conversation',
        title: `与「${label}」的聊天记录`,
        summary: msgs.length
          ? `界面已清空 · ${msgs.length} 条仍保留于本地（可供 AI 参考）`
          : '会话界面已清空（无消息）',
        peerDisplayName: label,
        peerAvatarUrl: avatarUrl,
        payload: {
          conversationKey: k,
          messages: msgs,
          conversationSettings: convBefore,
          uiClearOnly: true as const,
        },
      })
    }
    const existing = convBefore
    const cut = Date.now()
    if (existing) {
      await this.upsertChatConversationSettings({
        conversationKey: k,
        peerCharacterId: existing.peerCharacterId,
        playerIdentityId: existing.playerIdentityId,
        hiddenFromMessageList: true,
        uiOnlyHiddenBeforeTimestamp: cut,
        clearFriendRequestAcceptedAt: true,
      })
      return
    }
    if (isWechatGroupConversationKey(k)) {
      const gid = parseGroupIdFromConversationKey(k)
      const idx = k.lastIndexOf('::')
      const pid = idx >= 0 ? k.slice(idx + 2).trim() : ''
      if (gid && pid) {
        await this.upsertChatConversationSettings({
          conversationKey: k,
          peerCharacterId: wechatGroupPeerCharacterId(gid),
          playerIdentityId: pid,
          hiddenFromMessageList: true,
          uiOnlyHiddenBeforeTimestamp: cut,
          clearFriendRequestAcceptedAt: true,
        })
      }
    } else {
      const idx = k.lastIndexOf('::')
      if (idx > 0) {
        const peer = k.slice(0, idx).trim()
        const pid = k.slice(idx + 2).trim()
        if (peer && pid) {
          await this.upsertChatConversationSettings({
            conversationKey: k,
            peerCharacterId: peer,
            playerIdentityId: pid,
            hiddenFromMessageList: true,
            uiOnlyHiddenBeforeTimestamp: cut,
            clearFriendRequestAcceptedAt: true,
          })
        }
      }
    }
  }

  async deleteAllWeChatMessagesForConversation(conversationKey: string): Promise<void> {
    const k = conversationKey.trim()
    if (!k) return
    const msgs = await this.listWeChatChatMessagesByConversationKey(k)
    const conv = await this.getChatConversationSettings(k)
    if (!this.isIndexedTrashSuspended()) {
      const { label, avatarUrl } = await this.resolveWeChatTrashPeerLabelAndAvatar(k, conv)
      await this.appendIndexedTrashEntry({
        kind: 'wechat-conversation',
        title: `与「${label}」的聊天记录`,
        summary: msgs.length ? `已删除 ${msgs.length} 条消息` : '会话已清空（无消息）',
        peerDisplayName: label,
        peerAvatarUrl: avatarUrl,
        payload: { conversationKey: k, messages: msgs, conversationSettings: conv },
      })
    }
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
    await this.markConversationHiddenAfterHistoryCleared(k, conv)
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

  async listGroupChatsForPlayerIdentity(playerIdentityId: string): Promise<GroupChatRow[]> {
    const pid = playerIdentityId.trim()
    if (!pid) return []
    const all = await this.listGroupChats()
    return all.filter((g) => (g.playerIdentityId || '').trim() === pid)
  }

  /** 解散并删除本地消息与会话设置（当前身份下） */
  async deleteGroupChat(groupId: string, playerIdentityId: string): Promise<void> {
    const gid = groupId.trim()
    const pid = playerIdentityId.trim()
    if (!gid || !pid) return
    const convKey = wechatGroupConversationKey(gid, pid)
    if (!this.isIndexedTrashSuspended()) {
      const group = await this.getGroupChat(gid)
      const conv = await this.getChatConversationSettings(convKey)
      const msgs = await this.listWeChatChatMessagesByConversationKey(convKey)
      const gLabel = (group?.remark ?? group?.name ?? '').trim() || '群聊'
      const gAvatar = (group?.avatar ?? '').trim()
      await this.appendIndexedTrashEntry({
        kind: 'group-chat',
        title: `群聊「${gLabel}」`,
        summary: `${msgs.length} 条消息`,
        peerDisplayName: gLabel,
        peerAvatarUrl: gAvatar,
        payload: {
          groupId: gid,
          playerIdentityId: pid,
          conversationKey: convKey,
          group,
          conversationSettings: conv,
          messages: msgs,
        },
      })
    }
    await this.runWithIndexedTrashSuspended(async () => {
      await this.deleteAllWeChatMessagesForConversation(convKey)
      const db = await openDb()
      if (db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE) && db.objectStoreNames.contains(GROUP_CHATS_STORE)) {
        const tx = db.transaction([CHAT_CONV_SETTINGS_STORE, GROUP_CHATS_STORE], 'readwrite')
        tx.objectStore(CHAT_CONV_SETTINGS_STORE).delete(convKey)
        tx.objectStore(GROUP_CHATS_STORE).delete(gid)
        await txDone(tx)
      } else if (db.objectStoreNames.contains(GROUP_CHATS_STORE)) {
        const tx = db.transaction(GROUP_CHATS_STORE, 'readwrite')
        tx.objectStore(GROUP_CHATS_STORE).delete(gid)
        await txDone(tx)
      }
      db.close()
      emitWeChatStorageChanged()
    })
    const peerId = wechatGroupPeerCharacterId(gid)
    await this.clearMemoryTracksForWeChatConversationKey(convKey)
    await this.deleteGroupPsycheByPeerCharacterId(peerId)
    try {
      const bucketId = groupMemoryBucketCharacterId(gid)
      const mems = await this.listCharacterMemoriesForCharacter(bucketId)
      for (const m of mems) await this.deleteCharacterMemory(m.id)
    } catch {
      /* ignore */
    }
    try {
      await this.deletePhoneKv(`busy-conv:${convKey}`)
    } catch {
      /* ignore */
    }
    try {
      await this.deletePhoneKv(`wechat-dm-bullets-v1:${convKey}`)
    } catch {
      /* ignore */
    }
    emitWeChatStorageChanged()
  }

  /** 仅移除当前用户并清空会话（仍保留群与他人数据可供扩展；此处等同删除会话记录） */
  async leaveGroupChat(groupId: string, playerIdentityId: string): Promise<void> {
    await this.deleteGroupChat(groupId, playerIdentityId)
  }

  /**
   * 多账号场景：仅抹除指定微信马甲的会话/身份数据，保留其他马甲与世界底座。
   */
  async eraseWeChatBundleAccount(params: {
    wechatAccountId: string
    sessionIdentityIds: string[]
    preserveCanonicalCharacterIds?: ReadonlySet<string>
  }): Promise<void> {
    const acc = params.wechatAccountId.trim()
    if (!acc) return

    const identityIdSet = new Set<string>()
    for (const raw of params.sessionIdentityIds) {
      const id = raw.trim()
      if (id) identityIdSet.add(id)
    }

    const ownedIdentities = await this.listPlayerIdentities(acc)
    for (const row of ownedIdentities) identityIdSet.add(row.id)

    const identityIds = [...identityIdSet]
    const preserve = params.preserveCanonicalCharacterIds

    if (!identityIds.length) {
      await this.deleteCharactersForWechatAccount(acc, { preserveCanonicalCharacterIds: preserve })
      return
    }

    const pidSet = new Set(identityIds)

    await this.deletePhoneKv(`wechat-imported-bundle-archives-v1:${acc}`)

    await this.runWithIndexedTrashSuspended(async () => {
      await this.deleteCharactersForWechatAccount(acc, { preserveCanonicalCharacterIds: preserve })
      for (const pid of identityIds) {
        const groups = await this.listGroupChatsForPlayerIdentity(pid)
        for (const g of groups) {
          await this.deleteGroupChat(g.id, pid)
        }
        const friendRows = await this.listFriendRequests({ playerIdentityId: pid, pendingOnly: false })
        for (const fr of friendRows) await this.deleteFriendRequestById(fr.id)
      }

      const db = await openDb()
      try {
        if (db.objectStoreNames.contains(CHAT_MSG_STORE)) {
          const tx = db.transaction(CHAT_MSG_STORE, 'readwrite')
          const store = tx.objectStore(CHAT_MSG_STORE)
          const all = await new Promise<unknown[]>((resolve, reject) => {
            const r = store.getAll()
            r.onsuccess = () => resolve((r.result as unknown[]) ?? [])
            r.onerror = () => reject(r.error ?? new Error('eraseWeChatBundleAccount: messages'))
          })
          for (const raw of all) {
            const m = normalizeWeChatChatMessage(raw)
            if (!m || !pidSet.has(m.playerIdentityId.trim())) continue
            store.delete(m.id)
          }
          await txDone(tx)
        }

        if (db.objectStoreNames.contains(CHAT_CONV_SETTINGS_STORE)) {
          const tx = db.transaction(CHAT_CONV_SETTINGS_STORE, 'readwrite')
          const store = tx.objectStore(CHAT_CONV_SETTINGS_STORE)
          const all = await new Promise<ChatConversationSettingsRow[]>((resolve, reject) => {
            const r = store.getAll()
            r.onsuccess = () => resolve((r.result as ChatConversationSettingsRow[]) ?? [])
            r.onerror = () => reject(r.error ?? new Error('eraseWeChatBundleAccount: conv settings'))
          })
          for (const row of all) {
            const ck = String(row.conversationKey ?? '').trim()
            if (!ck) continue
            if (isWechatGroupConversationKey(ck)) {
              if (identityIds.some((pid) => ck.endsWith(`::${pid}`))) store.delete(ck)
              continue
            }
            const parsed = parsePrivateWeChatConversationCharacterAndSession(ck)
            if (parsed && pidSet.has(parsed.sessionPlayerId)) store.delete(ck)
          }
          await txDone(tx)
        }
      } finally {
        db.close()
      }

      for (const row of ownedIdentities) {
        await this.deletePlayerIdentity(row.id)
      }
      for (const pid of identityIds) {
        if (!pid.startsWith('wx-slot-')) continue
        const slot = await this.getPlayerIdentity(pid)
        if (slot) await this.deletePlayerIdentity(pid)
      }
    })

    emitWeChatStorageChanged()
  }

  /**
   * 深度注销：抹除本机当前微信账号相关的全部 IndexedDB 业务数据（人设、聊天、玩家身份、记忆、群聊、回收站等），
   * 并清理 phoneKv 中微信域键值。不删除手机全局主题 / API 配置（`lumi-phone-custom-v3` 等）。
   */
  async eraseWeChatAccountCompletely(): Promise<void> {
    await this.runWithIndexedTrashSuspended(async () => {
      const db = await openDb()
      const storesToClear = [
        STORE,
        IDENTITY_STORE,
        REL_STORE,
        GRAPH_VIEW_STORE,
        PLAYER_LINKS_STORE,
        CONFIG_STORE,
        CHAT_MSG_STORE,
        MEMORY_SETTINGS_STORE,
        CHARACTER_MEMORIES_STORE,
        CHAT_THEME_STORE,
        CHAT_CONV_SETTINGS_STORE,
        GROUP_CHATS_STORE,
        FRIEND_REQUEST_STORE,
        GLOBAL_SETTINGS_STORE,
        CHARACTER_DANMAKU_STORE,
        CHARACTER_NOTIFY_STORE,
        CHARACTER_BUSY_STORE,
        CHARACTER_TIME_STORE,
        FAVORITES_STORE,
        HEART_WHISPER_STORE,
        GROUP_PSYCHE_STORE,
        INDEXED_TRASH_STORE,
        WORLD_BG_STORE,
      ] as const

      const phoneKeysToDelete: string[] = []
      if (db.objectStoreNames.contains(PHONE_KV_STORE)) {
        const readTx = db.transaction(PHONE_KV_STORE, 'readonly')
        const store = readTx.objectStore(PHONE_KV_STORE)
        const rows = await new Promise<{ key: string }[]>((resolve, reject) => {
          const req = store.getAll()
          req.onsuccess = () => {
            const raw = (req.result as { key?: string }[]) ?? []
            resolve(raw.map((r) => ({ key: String(r.key ?? '').trim() })).filter((r) => r.key))
          }
          req.onerror = () => reject(req.error ?? new Error('eraseWeChatAccount: list phoneKv'))
        })
        await txDone(readTx)
        for (const row of rows) {
          if (shouldErasePhoneKvKeyForWeChatAccount(row.key)) phoneKeysToDelete.push(row.key)
        }
        for (const k of [WECHAT_USER_PROFILE_KV_KEY, WECHAT_USER_PROFILE_KV_KEY_LEGACY]) {
          if (!phoneKeysToDelete.includes(k)) phoneKeysToDelete.push(k)
        }
      }

      const txStores = [
        ...storesToClear.filter((n) => db.objectStoreNames.contains(n)),
        ...(phoneKeysToDelete.length && db.objectStoreNames.contains(PHONE_KV_STORE) ? [PHONE_KV_STORE] : []),
      ]
      if (txStores.length) {
        const tx = db.transaction(txStores, 'readwrite')
        for (const name of storesToClear) {
          if (!db.objectStoreNames.contains(name)) continue
          tx.objectStore(name).clear()
        }
        if (phoneKeysToDelete.length && db.objectStoreNames.contains(PHONE_KV_STORE)) {
          const pk = tx.objectStore(PHONE_KV_STORE)
          for (const k of phoneKeysToDelete) pk.delete(k)
        }
        if (db.objectStoreNames.contains(WORLD_BG_STORE)) {
          const wbs = tx.objectStore(WORLD_BG_STORE)
          for (const w of buildPresetWorldBackgrounds()) {
            wbs.put(normalizeWorldBackground(w))
          }
        }
        await txDone(tx)
      }
      db.close()
    })

    clearWeChatAccountLegacyLocalStorage()
    emitWeChatStorageChanged()
    emitWeChatAccountDeepErased()
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
