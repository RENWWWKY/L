import type { WeChatBubbleTheme } from '../../types'
import type { LumiMeetPersistedState, RadarFilters, SquarePostStyle } from './meetTypes'

export { pickMeetAvatar, buildMeetAvatarExclusion, type MeetAvatarExclusion } from './meetAvatarPool'

export const LUMI_MEET_KV_KEY = 'lumi-meet-persist-v1'

/** 广场 Tab 暂用「开发中」占位；改 false 恢复 DiscoverFeed 完整功能 */
export const MEET_SQUARE_UNDER_DEV = true

/** 默认背景文件名（仓库根目录 `image/` 与构建产物 `dist/image/` 一致；开发期由 Vite 中间件提供） */
export const MEET_DEFAULT_ENCOUNTER_CHAT_FILENAME = '遇见应用默认临时聊天室背景.png'

/**
 * 与 `vite.config` 的 `base` 拼接，避免子路径部署（如 `/Lumi-Phone/`）时写死 `/image/...` 导致 404。
 */
export function resolveMeetDefaultEncounterChatBgUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  const b = base.endsWith('/') ? base : `${base}/`
  return `${b}image/${MEET_DEFAULT_ENCOUNTER_CHAT_FILENAME}`
}

/** 持久化字段 → 实际请求 URL；空串或历史错误路径回退到默认 */
export function resolveMeetEncounterChatBackgroundUrl(stored?: string | null): string {
  const t = (stored ?? '').trim()
  if (!t) return resolveMeetDefaultEncounterChatBgUrl()
  const legacyRoot = `/image/${MEET_DEFAULT_ENCOUNTER_CHAT_FILENAME}`
  if (t === legacyRoot) return resolveMeetDefaultEncounterChatBgUrl()
  return t
}

/** @deprecated 请用 resolveMeetDefaultEncounterChatBgUrl；保留别名避免散落字面量 */
export const MEET_DEFAULT_ENCOUNTER_CHAT_BG = resolveMeetDefaultEncounterChatBgUrl()

/**
 * 遇见临时会话 · 默认气泡（仅 EncounterChatRoom 使用，不改动微信全局主题）
 * 双方均为柔和浅金；己方略深以便区分。
 */
export const MEET_ENCOUNTER_BUBBLE_THEME: WeChatBubbleTheme = {
  selfBubbleBg: '#F0E2BC',
  otherBubbleBg: '#FAF3E6',
  selfBubbleRadiusPx: 18,
  otherBubbleRadiusPx: 18,
  showAvatar: true,
  avatarRadiusPx: 10,
  showBubbleTail: false,
  mergeConsecutiveAvatarGroup: true,
}

/** 浅金气泡上的正文色（暖棕，保证可读） */
export const MEET_ENCOUNTER_BUBBLE_TEXT = {
  self: '#5A4A36',
  other: '#5A4A36',
} as const

/** 雷达「调校中」最短展示时间（毫秒），避免离线/秒回时像没点在生成） */
export const MEET_RADAR_SEARCH_MIN_UI_MS = 1600

/** 重逢：missed 角色距上次相遇满此时长后才可再次被雷达抽到（毫秒） */
export const MEET_REUNION_COOLDOWN_MS = 24 * 60 * 60 * 1000

/** 雷达抽取：重逢宿命池的概率（其余走 AI 新角色） */
export const MEET_REUNION_ROLL_P = 0.3

/** 广场生成帖子的风格文案（中文主导 + 英文点缀） */
export const SQUARE_STYLE_LABELS: Record<
  SquarePostStyle,
  { zh: string; en: string; hint: string }
> = {
  comedy: { zh: '搞笑吐槽', en: 'COMEDY', hint: '轻松玩梗、自嘲与脑洞' },
  emo: { zh: '深夜独白', en: 'EMO', hint: '孤独感与情绪碎片' },
  serious: { zh: '硬核交友', en: 'REAL', hint: '认真写下筛选条件与底线' },
  buddy: { zh: '寻找搭子', en: 'CREW', hint: '运动、看展、自习等同频邀约' },
}

export const DEFAULT_RADAR_FILTERS: RadarFilters = {
  gender: 'any',
  purpose: 'love',
  keywords: '',
  orientationPreferences: [],
  ageMin: 22,
  ageMax: 38,
  meetIntentions: ['romance'],
}

export const DEFAULT_MEET_STATE: LumiMeetPersistedState = {
  version: 5,
  npcs: [],
  squarePosts: [],
  chatThreads: {},
  meetInboxLastReadTsByNpcId: {},
  intimacyByNpcId: {},
  encounterSwapByNpcId: {},
  meetProfile: {
    displayName: 'Lumi Meet',
    intent: '浪漫邂逅',
    bio: '',
    orientation: '异性恋 (Hetero)',
    meetAvatarUrl: '',
    contactWechatId: '',
    baseWeChatIdentityId: '',
    meetIntentionsPublic: ['romance'],
    chatBackground: MEET_DEFAULT_ENCOUNTER_CHAT_BG,
    secretAdmirers: 14,
    lastCheckTime: Date.now(),
  },
  radarFilters: { ...DEFAULT_RADAR_FILTERS },
  rewindChargesRemaining: 24,
  destinyArchive: [],
  destinyArchiveMetaByCharId: {},
}

