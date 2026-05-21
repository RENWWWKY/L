/** Lumi Meet · 遇见 —— 数据模型 */

import type { ComprehensivePersona } from './comprehensivePersona'
import { isMeetProfilePlaceholder } from './comprehensivePersona'

export type { ComprehensivePersona } from './comprehensivePersona'

/** orbiting：雷达上待决策（生成后展示中）；missed：错过或双向失败；matched：已进入消息；wechat_added：已转入主微信 */
export type EncounterStatus = 'orbiting' | 'missed' | 'matched' | 'wechat_added'

/** 邂逅记忆 · 宿命类型 */
export type EncounterMatchType = 'resonated' | 'reconnected' | 'faded'

/** 邂逅记忆手札（Destiny Archive）单条 */
export type EncounterMemory = {
  id: string
  charId: string
  avatarUrl: string
  nickname: string
  matchType: EncounterMatchType
  /** 雷达/擦肩累计交汇次数 */
  matchAttempts: number
  /** 临时会话 AI 自动总结正文（不含来源标签） */
  aiSummary: string
  /** 用户手记 */
  customMemo?: string
  timestamp: number
  /** 用户手动新建（非仅由 NPC 同步） */
  isManual?: boolean
}

/** 按角色累计的邂逅元数据（用于判定 resonated / reconnected） */
export type DestinyArchiveCharMeta = {
  matchAttempts: number
  everMissed: boolean
  /** 最近一次成功匹配是否来自重逢池 */
  lastMatchWasReunion?: boolean
}

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
   * 匹配成功瞬间冻结的「遇见对外档案」快照（写入人设 vol11；供后续微信私聊对照假面/真身）。
   */
  meetUserProfileAtMatch?: MeetUserProfileSnapshot
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
  /** 缔结契约：NPC 已同意交换（CONNECT 显示已缔结并永久禁用） */
  covenantAgreed?: boolean
  /** 已向模型展示过的遇见「社交假面」头像 URL/dataURL（变更头像后会重新注入） */
  userAvatarVisionSeenUrl?: string
}

export type MeetImageMime = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export type MeetChatMessageKind =
  | 'text'
  | 'wechat_swap_card'
  | 'meet_system'
  | 'meet_music_share'
  | 'meet_echo_reveal'
  | 'meet_truth_mirror_record'
  | 'meet_truth_mirror_char_request'
  | 'meet_truth_mirror_user_response'
  | 'meet_contract_user_request'
  | 'meet_contract_npc_status'
  | 'meet_contract_char_request'
  | 'meet_contract_user_response'

export type MeetChatSwapCardPayload = {
  charWechatId: string
  userWechatId: string
  /** 角色附言 / 加好友提示 */
  note: string
}

/** 临时会话 · 同频共听（唱片卡展示） */
export type MeetMusicSharePayload = {
  title: string
  artist?: string
  artworkUrl?: string
  /** 曲库检索来源（可后续替换为网易云等） */
  catalog?: string
}

/** 临时会话 · 灵魂盲盒揭晓 */
export type MeetEchoRevealPayload = {
  question: string
  userAnswer: string
  npcAnswer: string
}

/** 临时会话 · 交换真心话归档（TRUTH 双盲） */
export type MeetTruthMirrorRecordPayload = {
  question: string
  userAnswer: string
  npcAnswer: string
}

/** 临时会话 · 缔结契约：交换判定 / 用户回应 */
export type MeetContractStatusPayload = {
  outcome: 'accepted' | 'rejected'
  actionType: 'char_add_user' | 'user_add_char' | 'none'
  charWechatId?: string
}

/** 角色主动发起的交换申请（待用户点选） */
export type MeetContractCharRequestPayload = {
  /** 用户已回应后设为 true，卡片仅作历史展示 */
  resolved?: boolean
}

/** 角色主动发起的「交换真心话」邀约（待用户同意/拒绝） */
export type MeetTruthMirrorCharRequestPayload = {
  resolved?: boolean
}

/** 用户对真心话邀约的回应 */
export type MeetTruthMirrorUserResponsePayload = {
  outcome: 'accepted' | 'declined'
}

/** 临时会话引用快照（展示名固定为「对方」/「自己」） */
export type MeetReplyToMeta = {
  messageId: string
  senderName: string
  content: string
  isUser: boolean
}

export type MeetChatMessage = {
  id: string
  role: 'user' | 'npc'
  content: string
  ts: number
  replyTo?: MeetReplyToMeta
  /** 用户发送的图片（与微信私聊一致，存 base64；模型支持 vision 时可识图） */
  images?: { base64: string; type: MeetImageMime }[]
  kind?: MeetChatMessageKind
  swapCard?: MeetChatSwapCardPayload
  musicShare?: MeetMusicSharePayload
  echoReveal?: MeetEchoRevealPayload
  truthMirrorRecord?: MeetTruthMirrorRecordPayload
  meetTruthMirrorCharRequest?: MeetTruthMirrorCharRequestPayload
  meetTruthMirrorUserResponse?: MeetTruthMirrorUserResponsePayload
  meetContractStatus?: MeetContractStatusPayload
  meetContractCharRequest?: MeetContractCharRequestPayload
}

/** 交友意向（多选）；与 legacy `purpose` 同步维护供旧逻辑兼容 */
export type MeetMatchIntention = 'romance' | 'platonic' | 'soulmate' | 'casual'

/** 匹配成功 / 发好友申请时冻结的遇见「对外假面」档案（不含底层微信身份 id） */
export type MeetUserProfileSnapshot = {
  capturedAt: number
  displayName: string
  intent: string
  bio: string
  orientation: string
  meetIntentionsPublic: MeetMatchIntention[]
}

/**
 * 遇见对外档案（与主微信身份刻意隔离；可蓄意与底层锚定冲突以触发剧情）。
 * `displayName` 即遇见独立昵称；`meetAvatarUrl` / `chatBackground` 为 dataURL 或 http(s)。
 */
export type MeetPublicProfile = {
  /** 遇见对外展示昵称（与手机名片、微信「我」页独立；空时 UI 显示默认「Lumi Meet」） */
  displayName: string
  /** 交友意向摘要（兼容旧逻辑；建议与 meetIntentionsPublic 同步维护） */
  intent: string
  /** 自我介绍 */
  bio: string
  /** 本人取向文案（假面侧；可与底层锚定矛盾） */
  orientation: string
  /** 遇见独立头像（dataURL / URL）；空则聊天室不显示己方头像图 */
  meetAvatarUrl: string
  /**
   * 交换联络方式时向 NPC 展示的你的微信号（微信「我」页外的独立配置）。
   */
  contactWechatId: string
  /**
   * 添加匹配角色为微信好友时绑定的玩家身份 id（IndexedDB playerIdentities）；
   * 在「03 CONTACT | 联络绑定」页配置。
   */
  baseWeChatIdentityId: string
  /** 遇见侧多选交友意向（假面） */
  meetIntentionsPublic: MeetMatchIntention[]
  /** 临时会话聊天室背景（9:16 裁切后写入） */
  chatBackground: string
  /** 伪造「暗中关注者」累计人数 */
  secretAdmirers: number
  /** 上次在本页触发统计刷新（毫秒）；用于离线小时增量 */
  lastCheckTime: number
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
  /** v5：邂逅记忆手札；v4：星轨筛选扩展 */
  version: 5
  npcs: EncounterNPC[]
  squarePosts: SquarePost[]
  /** npcId → 临时会话消息 */
  chatThreads: Record<string, MeetChatMessage[]>
  /**
   * 临时会话列表「已读」水位：该 npc 线程中 ts ≤ 此值的对方消息视为已读（用于未读角标；进入会话时更新）。
   */
  meetInboxLastReadTsByNpcId: Record<string, number>
  /** 情感共鸣 / 好感度 0–100（UI 显示为 RESONANCE） */
  intimacyByNpcId: Record<string, number>
  /** npcId → 互换微信流程状态与玩家微信号缓存 */
  encounterSwapByNpcId: Record<string, EncounterSwapMeta>
  meetProfile: MeetPublicProfile
  radarFilters: RadarFilters
  /** 「擦肩而过」主动回溯剩余次数（纯前端持久化） */
  rewindChargesRemaining: number
  /** 临时会话高亮引导是否已完成（含跳过） */
  encounterChatCoachCompleted?: boolean
  /** 灵魂侧写（世界书预览）高亮引导是否已完成（含跳过） */
  worldbookShelfCoachCompleted?: boolean
  /** 遇见 App 主界面新手引导是否已完成（含跳过） */
  meetAppCoachCompleted?: boolean
  /** 邂逅记忆手札 */
  destinyArchive?: EncounterMemory[]
  /** 邂逅记忆 · 按角色交汇统计 */
  destinyArchiveMetaByCharId?: Record<string, DestinyArchiveCharMeta>
}

/** 界面展示「对方」真实姓名：优先顶层 realName → 九维 base.realName → 网名 */
export function resolveMeetNpcPeerRealName(npc: EncounterNPC): string {
  const top = npc.realName?.trim()
  if (top) return top
  const nine = npc.comprehensivePersona?.base?.realName?.trim()
  if (nine && !isMeetProfilePlaceholder(nine)) return nine
  const nick = npc.nickname?.trim()
  return nick || '对方'
}

/** 世界书占位符替换用：仅真实姓名（无网名回落），缺省则只依赖网名参与 {{char}} 替换 */
export function resolveMeetNpcCharRealNameForLore(npc: EncounterNPC): string | undefined {
  const top = npc.realName?.trim()
  if (top) return top
  const nine = npc.comprehensivePersona?.base?.realName?.trim()
  if (nine && !isMeetProfilePlaceholder(nine)) return nine
  return undefined
}
