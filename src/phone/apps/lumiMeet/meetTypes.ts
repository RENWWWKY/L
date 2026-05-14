/** Lumi Meet · 遇见 —— 数据模型 */

import type { ComprehensivePersona } from './comprehensivePersona'

export type { ComprehensivePersona } from './comprehensivePersona'

/** orbiting：雷达上待决策（生成后展示中）；missed：错过或双向失败；matched：已进入消息；wechat_added：已转入主微信 */
export type EncounterStatus = 'orbiting' | 'missed' | 'matched' | 'wechat_added'

export type EncounterNPC = {
  id: string
  avatarUrl: string
  /** 社交昵称 / 网名（卡片与通讯录展示；对标微信 wechatNickname） */
  nickname: string
  /** 真实姓名（对标微信 Character.name；默认仅在档案与同步人设库时使用） */
  realName?: string
  /** 年龄（岁），与 comprehensive.base.info 首句年龄一致 */
  ageYears?: number
  birthdayMD?: string
  /** 身高（厘米），数字字符串；同步至微信人设 height */
  heightCm?: string
  weightKg?: string
  zodiac?: string
  /** 职业/身份短标签；同步至微信人设 identity */
  occupation?: string
  /** 座右铭；同步 Character.motto（与个性签名 wechatSignature 区分） */
  motto?: string
  /** 四字母 MBTI；缺省从九维 core.mbti 解析 */
  mbti?: string
  gender: string
  orientation: string
  /** 列表/会话摘要（与九维 comprehensive 一致时的短陈述） */
  persona: string
  /** 九维立体人格；历史数据可为空 */
  comprehensivePersona?: ComprehensivePersona
  status: EncounterStatus
  /** 上次在雷达上「相遇」的时间戳（错过 / 重逢展示 / 匹配失败均更新，用于重逢冷却） */
  lastEncounterTime: number
  /** AI 预生成或交换时锁定的微信号（字母数字下划线） */
  wechatId?: string
  /**
   * 生成邂逅时由同一次人设请求一并产出：用户点「心动」时 NPC 是否会双向接住。
   * 有值则客户端不再单独调用匹配裁判模型；旧存档 / 重逢无此字段时退回本地或单次裁判。
   */
  mutualSpark?: boolean
  /**
   * 邂逅生成来源：`api` = 模型 JSON；`offline` = 本地兜底（未配置 API 或请求/解析失败）。
   * 重逢捞出旧卡时通常无此字段。
   */
  generationSource?: 'offline' | 'api'
}

export type SquarePostStyle =
  | 'comedy'
  | 'emo'
  | 'serious'
  | 'buddy'

export type SquarePost = {
  id: string
  authorAlias: string
  body: string
  style: SquarePostStyle
  createdAt: number
}

export type WechatSwapStatus = 'none' | 'available' | 'user_requested' | 'char_requested' | 'swapped'

/** 临时会话 · 微信互换流程（按 npcId） */
export type EncounterSwapMeta = {
  wechatSwapStatus: WechatSwapStatus
  /** 用户在本流程中填写的微信号（与角色互换展示用） */
  userWechatId: string
  /** 模型最近一次给出的互换附言候选（结业卡片可引用） */
  pendingSwapNote?: string
}

export type MeetChatMessageKind = 'text' | 'wechat_swap_card'

export type MeetChatSwapCardPayload = {
  charWechatId: string
  userWechatId: string
  /** 角色附言 / 加好友提示 */
  note: string
}

export type MeetChatMessage = {
  id: string
  role: 'user' | 'npc'
  content: string
  ts: number
  kind?: MeetChatMessageKind
  swapCard?: MeetChatSwapCardPayload
}

export type MeetPublicProfile = {
  /** 展示昵称（可与手机名片独立） */
  displayName: string
  /** 交友意向摘要 */
  intent: string
  /** 自我介绍 */
  bio: string
  /** 本人取向文案 */
  orientation: string
}

/** 择偶时对「对方性取向」标签的偏好（多选；空数组表示不限） */
export type MeetOrientationPreference =
  | 'hetero'
  | 'homo'
  | 'bi_pan'
  | 'ace'
  | 'aro'
  | 'demi'
  | 'queer_fluid'
  | 'poly_open'

/** 交友意向（多选）；与 legacy `purpose` 同步维护供旧逻辑兼容 */
export type MeetMatchIntention = 'romance' | 'platonic' | 'soulmate' | 'casual'

export type RadarFilters = {
  gender: 'male' | 'female' | 'any'
  /** 兼容旧版生成链路：由 `meetIntentions` 在 UI 确认时写回 */
  purpose: 'love' | 'friend' | 'buddy'
  keywords: string
  orientationPreferences: MeetOrientationPreference[]
  ageMin: number
  ageMax: number
  meetIntentions: MeetMatchIntention[]
}

export type LumiMeetPersistedState = {
  /** v4：星轨匹配筛选维度扩展（取向 / 年龄 / 意向多选） */
  version: 4
  npcs: EncounterNPC[]
  squarePosts: SquarePost[]
  /** npcId → 临时会话消息 */
  chatThreads: Record<string, MeetChatMessage[]>
  /** 情感共鸣 / 好感度 0–100（UI 显示为 RESONANCE） */
  intimacyByNpcId: Record<string, number>
  /** npcId → 互换微信流程状态与玩家微信号缓存 */
  encounterSwapByNpcId: Record<string, EncounterSwapMeta>
  meetProfile: MeetPublicProfile
  radarFilters: RadarFilters
  /** 「擦肩而过」主动回溯剩余次数（纯前端持久化） */
  rewindChargesRemaining: number
}
