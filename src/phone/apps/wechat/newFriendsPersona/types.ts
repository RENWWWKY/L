import { LEGACY_TERRAIN_ALIASES } from './worldMapCatalog'

export type Gender = 'male' | 'female' | 'other'

export type WorldBookPriority = 'before' | 'after'

/** 历史存档字段；已全部改用正文占位符 {{char}}/{{user}}，读库时保留兼容 */
export type WorldBookPronounGuide = 'default' | 'user_as_i' | 'third_person'

/** 世界书正文 `{{user}}` 按出现顺序对应的绑定（界面只显示 {{user}}，账号/身份藏此处）。 */
export type WorldBookUserPlaceholderBinding = {
  wechatAccountId: string
  playerIdentityId: string
  /** 缓存：微信号 · 扮演「…」 */
  lineLabel?: string
  /** 缓存：展示名，预览/注入用 */
  displayName?: string
}

export type WorldBookItem = {
  id: string
  name: string
  enabled: boolean
  priority: WorldBookPriority
  keywords: string
  content: string
  updatedAt: number
  collapsed?: boolean
  /** 与正文中从左到右每个 `{{user}}` 一一对应 */
  userPlaceholderBindings?: WorldBookUserPlaceholderBinding[]
  /** @deprecated 已废弃；请用正文中的 {{char}} / {{user}} */
  pronounGuide?: WorldBookPronounGuide
}

export type WorldBook = {
  id: string
  name: string
  enabled: boolean
  items: WorldBookItem[]
  collapsed?: boolean
}

export type ScheduleTableStyle = {
  headerStyle: 'dark' | 'light' | 'none'
  borderStyle: 'solid' | 'dashed' | 'none'
  rowHeight: 'compact' | 'normal' | 'loose'
}

export type TableCellStyle = {
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  highlight: boolean
  align: 'left' | 'center' | 'right'
}

export type TableCell = {
  content: string
  style: TableCellStyle
  colspan: number
  rowspan: number
}

export type ScheduleTable = {
  id: string
  name: string
  headers: string[]
  rows: TableCell[][]
  columnWidths: number[]
  rowHeights: number[]
  style: ScheduleTableStyle
  createdAt: number
  updatedAt: number
}

/** 角色关联的玩家扮演身份及其归属微信账号（多号分线） */
export type PlayerIdentityLinkMeta = {
  playerIdentityId: string
  wechatAccountId: string
}

export type Character = {
  id: string
  createdAt: number
  updatedAt: number
  name: string
  gender: Gender
  age: number | null
  height?: string
  weight?: string
  birthdayMD: string // MM-DD
  zodiac: string
  identity: string
  mbti?: string
  bio?: string
  motto?: string
  /** 角色侧开场白：每行一个气泡消息 */
  openingLines?: string
  avatarUrl?: string // dataURL or url
  /** 微信昵称（可与「姓名」独立） */
  wechatNickname?: string
  /** 微信号（自定义展示用） */
  wechatId?: string
  /** 微信「我」/资料卡个性签名（与 motto 独立） */
  wechatSignature?: string
  /** 微信资料地区（留空则资料卡不展示具体地区文案） */
  wechatRegion?: string
  /** 微信朋友圈顶部背景图（dataURL 或 http(s) URL） */
  momentsCoverUrl?: string
  worldBooks: WorldBook[]
  /** 关联的世界背景 id（IndexedDB `worldBackgrounds`，缺省为预设「现代都市」） */
  worldBackgroundId?: string
  /** 世界背景是否启用到 AI 提示词（关闭时不注入世界背景） */
  worldBackgroundEnabled?: boolean
  /** 归属的微信账号 id（多账号隔离；仅在该账号下可见/可选用） */
  wechatAccountId?: string
  /** 创建该角色时选择的玩家身份 id（来自 playerIdentities 表） */
  playerIdentityId?: string
  /** IndexedDB 归一化：玩家身份行在 characters 表中的标记 */
  isPlayerIdentity?: boolean
  /** 额外关联的玩家身份（多马甲扮演 / 小号加好友后绑定） */
  linkedPlayerIdentityIds?: string[]
  /** 各关联马甲归属的微信账号 id（与 linkedPlayerIdentityIds 对应，供提示词/UI） */
  playerIdentityLinkMeta?: PlayerIdentityLinkMeta[]
  /** 若存在：该角色为「人脉生成」的 NPC，归属此主角 id */
  generatedForCharacterId?: string
  /** NPC 展示：兴趣（约 3 个） */
  interests?: string[]
  /** NPC 展示：雷点（约 2 个） */
  painPoints?: string[]
  /** 未读条数（可与会话读游标推导同步；默认 0） */
  unreadCount?: number
  /**
   * 以下字段与「会话级」设置重复时，以 IndexedDB `chatConversationSettings` 为准（含 Lumi 等非 characters 表会话）。
   * 保留于 Character 仅作类型扩展与潜在同步。
   */
  isPinned?: boolean
  /** 最后一条消息时间戳（与会话设置同步，用于列表排序） */
  lastMessageTime?: number
  isMuted?: boolean
  isDanmakuMode?: boolean
  chatBackground?: string
  /** 联系人备注名；为空时资料卡/通讯录回退到微信昵称或姓名 */
  remark?: string
  /** 资料设置：星标朋友 */
  isStarred?: boolean
  /** 资料设置：是否加入黑名单 */
  isBlocked?: boolean
  /** 资料设置：朋友圈权限 */
  momentsPermission?: {
    /** true = 不让他看我朋友圈 */
    blocked: boolean
  }
  /** 身份/角色日程表：供 AI 生成回复参考（优先级与长期记忆一致） */
  schedule?: ScheduleTable
}

/** 单会话聊天偏好（IndexedDB `chatConversationSettings`，主键 conversationKey） */
export type ChatConversationSettingsRow = {
  conversationKey: string
  peerCharacterId: string
  playerIdentityId: string
  isPinned: boolean
  isMuted: boolean
  /** 信息页列表中隐藏该会话（仍可从通讯录进入聊天） */
  hiddenFromMessageList: boolean
  /**
   * 仅影响聊天界面展示：时间戳 ≤ 该值的本地消息在气泡列表中隐藏，但仍参与 AI 上下文转写。
   * 彻底删除聊天记录时应清除该字段。
   */
  uiOnlyHiddenBeforeTimestamp?: number
  /** 会话级通知提醒开关（仅在全局通知模式下使用；按角色模式下由角色表驱动并与聊天信息页同步） */
  notifyEnabled: boolean
  /** 是否在回复中输出可见思维链（关闭可节省 token） */
  showThinkingChain: boolean
  isDanmakuMode: boolean
  /** 群聊：是否在消息头像旁显示发送者群昵称（默认开启） */
  showGroupMemberNicknameInChat: boolean
  /** 群聊：是否在发言者头像左上角显示群主/管理员头衔（默认关闭） */
  showGroupRankBadgesInChat: boolean
  /** 聊天背景图 URL 或 dataURL，空为默认 */
  chatBackground: string
  /** 角色每轮至少发 1 条表情包的目标概率 0–100；缺省 = 不覆写系统协议 */
  stickerRoundTriggerPercent?: number
  /** 角色每轮至少发 1 条语音的目标概率 0–100；缺省 = 不覆写系统协议（语音默认约 30%） */
  voiceRoundTriggerPercent?: number
  /** 最后一条消息时间戳，用于会话列表排序（与消息表同步更新） */
  lastMessageTime: number
  updatedAt: number
  /**
   * 同意好友申请的时刻（毫秒）。私聊界面据此在验证期记录与加回后的聊天之间插入「以上为验证消息」系统条（仅 UI）。
   * 彻底清空聊天记录时应清除该字段。
   */
  friendRequestAcceptedAtMs?: number
}

export type NotificationAudioConfig =
  | { type: 'default'; defaultKey: 'notify2' | 'lai' }
  | { type: 'custom'; customAudioBase64: string; customAudioName: string; customAudioMime: string }

export type WeChatTimeMode = 'system' | 'custom'

/**
 * 微信内“当前时间”的来源配置。
 * - `system`：直接使用设备本地时间。
 * - `custom`：以 `customBaseTime` 为起点，按倍率从 `customAnchorRealTime` 开始流逝。
 */
export type WeChatTimeConfig = {
  mode: WeChatTimeMode
  customBaseTime: number
  customAnchorRealTime: number
  timeMultiplier: number
}

/** 微信全局设置（IndexedDB `globalSettings`，主键 id固定为 global） */
export type WeChatGlobalSettingsRow = {
  id: 'global'
  /** 通知总开关：控制所有会话是否播放提醒音 */
  notificationEnabled: boolean
  /** 通知配置模式：全局统一 / 按角色单独 */
  notificationMode: 'global' | 'character'
  /** 全局音频配置 */
  globalAudio: NotificationAudioConfig
  /** 忙碌总开关 */
  busyEnabled: boolean
  /** 忙碌配置模式：全局统一 / 按角色单独 */
  busyMode: 'global' | 'character'
  /** 全局忙碌配置 */
  globalBusyConfig: {
    maxDuration: number
    triggerProbability: number
    customScenarios: string[]
  }
  /** 全局聊天时间流逝配置 */
  globalTimeConfig: WeChatTimeConfig
  /** 全局统一 / 按角色单独 */
  danmakuScopeMode: 'global' | 'character'
  /** 生成弹幕时是否与主对话一致：读长期记忆、世界背景、完整上下文 */
  danmakuUseMemory: boolean
  /** 单次模型调用生成的弹幕条数，1～20 */
  danmakuGenerateCount: number
  /** 弹幕字号 px，12～24 */
  danmakuFontSize: number
  /** #RRGGBB */
  danmakuColor: string
  /** 0.3 ~ 1 */
  danmakuOpacity: number
  /** 单条弹幕横向飘过所需秒数，约 5～15，越大越慢 */
  danmakuScrollDurationSec: number
  danmakuPosition: 'top' | 'middle' | 'bottom' | 'random'
  /** 同屏轨道密度：稀少 / 正常 / 密集 */
  danmakuDensity: 'sparse' | 'normal' | 'dense'
  /** 无边框 / 浅灰底 / 白底圆角 */
  danmakuStyle: 'none' | 'gray' | 'white'
  /** 自定义弹幕生成规则（留空则用代码内置通用提示词） */
  danmakuCustomPrompt: string
  theme: 'light' | 'dark'
  createdAt: number
}

export type CharacterBusySettingsRow = {
  characterId: string
  enabled: boolean
  maxDuration: number
  triggerProbability: number
  customScenarios: string[]
  isBusy: boolean
  busyReason: string
  busyStartTime: number
  busyEndTime: number
  busyDurationMinutes: number
  busyMessages: WeChatChatMessage[]
  updatedAt: number
}

/** 按角色的时间配置覆盖（IndexedDB `characterTimeSettings`，主键 characterId） */
export type CharacterTimeSettingsRow = {
  characterId: string
  config: WeChatTimeConfig
  updatedAt: number
}

/** 按角色的通知设置覆盖（IndexedDB `characterNotificationSettings`，主键 characterId） */
export type CharacterNotificationSettingsRow = {
  characterId: string
  /** 该角色通知提醒开关（按角色模式下与聊天信息页同步） */
  notificationEnabled: boolean
  audio:
    | { type: 'global' }
    | { type: 'custom'; customAudioBase64: string; customAudioName: string; customAudioMime: string }
  updatedAt: number
}

/** 按角色的弹幕样式覆盖（IndexedDB `characterDanmakuSettings`，主键 characterId） */
export type CharacterDanmakuSettingsRow = {
  characterId: string
  /** false 时该角色不显示弹幕（仅在与全局 scope=character 同时存在记录时生效） */
  enabled: boolean
  useMemory: boolean
  generateCount: number
  fontSize: number
  color: string
  opacity: number
  /** 单条弹幕横向飘过所需秒数，约 5～15 */
  scrollDurationSec: number
  position: 'top' | 'middle' | 'bottom' | 'random'
  density: 'sparse' | 'normal' | 'dense'
  style: 'none' | 'gray' | 'white'
  /** 按角色覆盖弹幕规则；留空则沿用全局 `danmakuCustomPrompt` */
  customPrompt: string
  updatedAt: number
}

export type GroupMemberRole = 'owner' | 'admin' | 'member'

/** 群助手违禁巡检：两轮内连犯 → 禁言；间距优先用 {@link GroupMemberBotViolationRecord.lastViolationEventSeq} 与 {@link GroupChatRow.smartBotViolationSeq}（与群内普通发言轮次脱钩） */
export type GroupMemberBotViolationRecord = {
  violationCount: number
  /** 兼容旧数据：曾为 `chatTurnSequence`；新逻辑下与 `lastViolationEventSeq` 一并写入 */
  lastViolationTurn: number
  /** 最近一次触发违禁时的 `GroupChatRow.smartBotViolationSeq`（有则优先用于「两轮」间距） */
  lastViolationEventSeq?: number
  /** 群助手自动禁言解封时间；到期后由客户端清理 */
  muteExpiresAt: number | null
}

export type GroupMember = {
  charId: string
  /** 群内专属称呼（本群昵称），可与通讯录微信昵称完全不同 */
  groupNickname: string
  role: GroupMemberRole
  isMuted: boolean
  warnings: number
  /** 群助手智能巡检累计状态（与管理员手动禁言 `isMuted` 独立，展示层合并判定） */
  botViolation?: GroupMemberBotViolationRecord
}

export type GroupRobotRule = {
  triggerWords: string[]
  action: 'warn' | 'mute'
  warningText: string
}

/** 群聊（IndexedDB `groupChats`） */
export type GroupChatRow = {
  id: string
  /** 所属玩家身份（群数据按身份隔离） */
  playerIdentityId: string
  /** 群内发言轮次序号（用户每条发送、每名 NPC 每条气泡各 +1） */
  chatTurnSequence?: number
  /** 仅随「群助手违禁落库」递增，用于两次违禁是否相邻（与普通发言轮次脱钩，避免中间插话导致永远不禁言） */
  smartBotViolationSeq?: number
  /** @ 唤醒群助手时的别名（默认仍匹配 群管家/群助手） */
  robotMentionAliases?: string[]
  name: string
  /** 仅自己可见的列表备注名 */
  remark: string
  avatar: string
  members: GroupMember[]
  robotRules: GroupRobotRule[]
  /** 群管家/群机器人在本群消息中的头像；未设置时使用内置默认图 */
  robotAvatarUrl?: string
  /** 群公告正文；全员可见，仅群主可改（客户端与群主角色指令） */
  announcement?: string
  backgroundUrl?: string
  createdAt: number
  updatedAt: number
  /** 兼容旧版：仅有 id 列表 */
  memberIds?: string[]
}

/** 长期记忆来源：私聊 / 群聊 / 约会关联 / 遇见临时邂逅 */
export type CharacterMemoryScope = 'private' | 'group' | 'linked' | 'meet'

/** 记忆注入方式：始终进参考 vs 仅关键词命中时注入 */
export type CharacterMemoryTriggerMode = 'always' | 'keyword'

/** 角色长期记忆（IndexedDB `characterMemories`） */
export type CharacterMemory = {
  id: string
  /** 私聊：真实角色 id；群聊桶：`groupMemoryBucketCharacterId(groupId)` */
  characterId: string
  content: string
  createdAt: number
  updatedAt: number
  isAutoGenerated: boolean
  /** 缺省视为 private，兼容旧数据 */
  memoryScope?: CharacterMemoryScope
  /** memoryScope === 'linked' 时：线下剧情存档归属的主角人设 id（人脉 NPC 的 generatedForCharacterId） */
  linkedFromCharacterId?: string
  /** 自动关联记忆：来自约会哪一段 AI 剧情（plot id），用于同轮重新生成时覆盖旧条目 */
  datingLinkedSourcePlotId?: string
  /** memoryScope === 'group' 时的群 id */
  groupId?: string
  /** 群聊记忆涉及的角色 id（用于检索与私聊/线下穿透） */
  involvedCharIds?: string[]
  /**
   * `always`：每轮参考均注入（仍受条数上限约束）；`keyword`：仅命中下方触发词时注入。
   * 未设置：兼容旧数据——无三维度且无 memoryKeywords 时走「无标签兜底」；否则视为关键词模式。
   */
  memoryTriggerMode?: CharacterMemoryTriggerMode
  /** 大分类触发词；用户手写不限字数，自动总结 JSON 会按模型提示约束为 ≤5 字 */
  memoryTriggerCategory?: string
  /** 精准匹配词；用户手写不限字数，自动总结会约束为 ≤10 字 */
  memoryTriggerPrecise?: string
  /** 情绪/需求侧触发词列表；用户手写不限条数/长度，自动总结会约束为最多 5 条、每条 ≤12 字 */
  memoryTriggerEmotionNeed?: string[]
  /**
   * 附加匹配词（任一命中即参考）；与三维度并列参与匹配。
   * 逗号/分号/换行分隔均可入库时解析。
   */
  memoryKeywords?: string[]
  /** 自动总结来源：写入时所在的微信账号（多号分线） */
  sourceWechatAccountId?: string
  /** 自动总结来源：写入时会话扮演身份 id */
  sourceSessionPlayerIdentityId?: string
  /** 与正文中从左到右每个 `{{user}}` 一一对应（同世界书；总结绑定来源线） */
  userPlaceholderBindings?: WorldBookUserPlaceholderBinding[]
  /** OpenAI 兼容 embedding，用于向量语义召回（与关键词并存） */
  memoryEmbedding?: number[]
  /** 与 `memoryEmbedding` 对应的 `buildMemoryEmbedText` 内容哈希，正文或触发词变更后需重算向量 */
  memoryEmbeddingHash?: string
}

/** 全局记忆设置（IndexedDB `memorySettings`，主键 id 固定为 `default`） */
export type MemorySettingsRow = {
  id: 'default'
  /** 自动总结总开关：关闭后仅支持手动总结 */
  autoSummaryEnabled: boolean
  autoSummaryInterval: number
  /**
   * 自动总结写入「新记忆」时的默认 `memoryTriggerMode`；缺省为 `keyword`。
   * 不论此项为何，入库时仍会写入模型提炼的 category / precise / emotion_need，并合并写入 `memoryKeywords` 备份，便于日后从「始终触发」改为「关键词触发」时不丢词。
   */
  autoSummaryDefaultMemoryTriggerMode?: CharacterMemoryTriggerMode
  /** 各会话自上次自动总结以来已完成的「AI 回复轮」计数 */
  aiRoundCountByConversation?: Record<string, number>
  /** 各会话最近一次自动总结覆盖到的消息时间戳（闭区间右端） */
  summaryCursorTimestampByConversation?: Record<string, number>
  /**
   * 各角色「约会线下剧情」plot：最近一次自动总结覆盖到的时间戳（闭区间右端）。
   * 与微信消息游标独立；与 `aiRoundCountByConversation` 共用同一计数阈值。
   */
  datingPlotSummaryCursorByCharacterId?: Record<string, number>
  /**
   * 各角色「遇见 App 临时会话」消息：最近一次自动总结覆盖到的时间戳（闭区间右端）。
   * 与私聊/约会游标独立；加好友导入微信后通常推进至会话最大 ts，避免与已入库 `[遇见]` 记忆重复总结。
   */
  meetSummaryCursorTimestampByCharacterId?: Record<string, number>
  /**
   * 是否把合并自动总结里的「关联记忆」（人脉 NPC 的 `[关联线下]` 条目）写入数据库。
   * 显式 `false` 关闭；缺省为开启。关闭后仍可与约会/合并总结同一请求生成正文，仅不落库关联条。
   */
  linkedMemoryAutoSummaryEnabled?: boolean
  /**
   * 约会线下每段剧情是否触发合并自动总结（与微信私聊「间隔轮数」无关）。
   * 显式 `false` 关闭后，仅在与该角色微信聊满间隔轮数时才跑合并总结；缺省为开启。
   */
  datingAutoSummaryEnabled?: boolean
  /**
   * 遇见 App 临时会话是否触发自动总结（与微信私聊设置独立；写入的记忆仍共用同一长期记忆库）。
   * 显式 `false` 关闭；缺省为开启。
   */
  meetAutoSummaryEnabled?: boolean
  /**
   * 遇见 App 自动总结间隔轮数（NPC 文字回复）；未设置时回退为 {@link autoSummaryInterval}。
   */
  meetAutoSummaryInterval?: number
  /** 各会话（与私聊 storage 键一致）自上次遇见自动总结以来已完成的 NPC 回复轮数 */
  meetAiRoundCountByConversation?: Record<string, number>
  /**
   * 长期记忆向量语义召回：显式 `false` 关闭；缺省为开启（仍需聊天 API 里配置有效 url+key 才会实际请求 embedding）。
   */
  memoryVectorRecallEnabled?: boolean
  /**
   * 是否启用向量召回专用 API（地址/密钥）；显式 `false` 时仅用聊天主接口。
   * 若本地曾保存过专用 url/key 且无显式 `false`，读取时兼容为 `true`。
   */
  memoryEmbeddingUseDedicatedApi?: boolean
  /** 覆盖默认 `text-embedding-3-small`（须与当前 API 兼容） */
  memoryEmbeddingModelId?: string
  /**
   * 向量召回专用 API 根地址（OpenAI 兼容，将请求 `…/v1/embeddings`）。
   * 留空则使用当前「聊天 / chatCard」里的 apiUrl。
   */
  memoryEmbeddingApiUrl?: string
  /**
   * 向量召回专用 API Key；留空则使用聊天 apiKey。
   * 可与 `memoryEmbeddingApiUrl` 组合：只填其一则另一项回落到主配置。
   */
  memoryEmbeddingApiKey?: string
  /** 外部向量库集合 / 命名空间（UI：记忆切片簇） */
  memoryVectorCollection?: string
}

/** 微信私聊持久化消息（IndexedDB `chatMessages`） */
export type WeChatReplyToMeta = {
  /** 被引用消息 ID */
  messageId: string
  /** 被引用消息发送者昵称（备注/昵称） */
  senderName: string
  /** 被引用消息内容快照（文本或“[图片]”） */
  content: string
  /** 被引用消息是否为用户发送 */
  isUser: boolean
}

/** 微信红包消息附加结构（持久化于 chatMessages） */
export type WeChatRedPacketPayload = {
  packetId: string
  amountYuan: number
  remark: string
  /** 接收方拆开后为 true，列表气泡可展示金额 */
  opened: boolean
  /** 过期未领（可选，由业务层写入） */
  expired?: boolean
}

/** Lumi 转账消息：状态与金额存于 localStorage，此处仅存关联 id */
export type WeChatTransferPayload = {
  transferId: string
}

export type WeChatCallStatusPayload = {
  /** 发起方视角的最终状态 */
  status: 'rejected' | 'no_answer' | 'duration'
  /** status=duration 时存在 */
  durationSec?: number
}

export type WeChatVoicePayload = {
  durationSec: number
  emotionAnalyzed?: boolean
  emotionLabel?: string
  /** 语音合成脚本（允许包含 () 与 <...> 控制片段），用于后续 TTS */
  ttsScript?: string
  audioUrl?: string
  transcriptText?: string
}

/** 同频共听邀约 / 回应卡片（持久化于 chatMessages.musicSync） */
export type WeChatMusicSyncInvitePayload = {
  kind: 'music_invite'
  inviteId: string
  trackId: number
  trackTitle: string
  trackArtist: string
  coverUrl: string
}

export type WeChatMusicSyncAcceptPayload = {
  kind: 'music_accept'
  inviteId: string
  replyText: string
  /** 对应邀约曲目的封面（与 music_invite 一致） */
  coverUrl?: string
  trackTitle?: string
  trackArtist?: string
}

export type WeChatMusicSyncDeclinePayload = {
  kind: 'music_decline'
  inviteId: string
  replyText: string
}

export type WeChatMusicSyncPayload =
  | WeChatMusicSyncInvitePayload
  | WeChatMusicSyncAcceptPayload
  | WeChatMusicSyncDeclinePayload

export type WeChatChatMessage = {
  id: string
  characterId: string
  playerIdentityId: string
  type: 'player' | 'character'
  content: string
  /** 可见思维链（开启开关时由模型返回，默认折叠展示） */
  thinking?: string
  /** 红包消息：与 content 并存，便于渲染与检索 */
  redPacket?: WeChatRedPacketPayload
  /** Lumi 转账：与 content 并存 */
  transfer?: WeChatTransferPayload
  /** 通话状态气泡：与 content 并存 */
  callStatus?: WeChatCallStatusPayload
  /** 语音消息：与 content 并存 */
  voice?: WeChatVoicePayload
  /** 同频共听邀约 / 接受 / 拒绝卡片 */
  musicSync?: WeChatMusicSyncPayload
  /** 图片消息：纯图片时 content 允许为空串 */
  images?: { base64: string; type: WeChatImageMime }[]
  /** 是否收藏 */
  isFavorite?: boolean
  /** 引用消息结构化快照（兼容旧版 string id） */
  replyTo?: WeChatReplyToMeta
  /** 撤回后保留原始内容快照（用于撤回记录查看） */
  originalContent?: string
  /** 消息是否已撤回 */
  isRecalled?: boolean
  /** 撤回时间戳 */
  recallTimestamp?: number
  /** 发起撤回的身份（群主/管理员代撤回他人消息为 `moderator`） */
  recalledBy?: 'player' | 'character' | 'moderator'
  timestamp: number
  isRead: boolean
  /** `${characterId}::${playerIdentityId}`，便于索引 */
  conversationKey: string
  /** 为 true 时不触发新消息提示音等（程序化系统条等） */
  quiet?: boolean
  /** 扩展展示/群助手管线（IndexedDB 透传） */
  ext?: {
    /** 群助手程序化回复：黑底白字高冷风 */
    groupBotDarkBubble?: boolean
    /** 居中浅灰系统条（违禁屏蔽提示等） */
    centerSystemStrip?: boolean
    /** 与 centerSystemStrip 配套：被拦截的原文，用于点击查看 */
    shieldedMessageContent?: string
    /** 禁言隐藏系统条：与 shieldedMessageContent 配套；仅群主/管理员可点「查看」 */
    muteSuppressStrip?: boolean
    /**
     * 禁言期间仍生成的角色发言：原文落库；聊天气泡侧全员不展示，配套系统灰条供群主/管理员点「查看」。
     */
    mutedMessageVisibleToModeratorsOnly?: boolean
  }
}

export type WeChatImageMime = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

/** 聊天记录全文搜索索引行（仅 id / 内容 / 时间 / 类型） */
export type WeChatMessageSearchIndexRow = Pick<WeChatChatMessage, 'id' | 'content' | 'timestamp' | 'type'>

/** 收藏（IndexedDB `favorites`） */
export type Favorite = {
  id: string
  messageId: string
  characterId: string
  content: string
  timestamp: number
  createdAt: number
}

export type HeartWhisper = {
  timestamp: string
  location: string
  action: string
  outfit: string
  innerThoughts: string
  userImpression: string
}

/**
 * 群聊心语弹窗：单名 NPC 的物理状态与内心档案（与模型 JSON 字段一一对应后写入 UI）。
 * clothing / posture / monologue / impressionOnUser 为展示层命名。
 */
export type CharacterPsyche = {
  charId: string
  avatarUrl: string
  name: string
  location: string
  clothing: string
  posture: string
  monologue: string
  impressionOnUser: string
}

/** 一群聊会话一次生成的心语快照（IndexedDB `groupPsyche`，主键 conversationId） */
export type GroupPsycheArchive = {
  timestamp: string
  characters: CharacterPsyche[]
}

export type GroupPsycheRow = {
  /** 与 `wechatGroupPeerCharacterId(groupId)` 一致 */
  conversationId: string
  archive: GroupPsycheArchive
  updatedAt: number
}

/** 按角色覆盖存储的心语（IndexedDB `heartWhispers`，主键 characterId） */
export type HeartWhisperRow = {
  characterId: string
  data: HeartWhisper
  updatedAt: number
}

/** 玩家身份：结构与 Character 一致，存储于 playerIdentities 表 */
export type PlayerIdentity = Character

export type Relationship = {
  id: string
  fromCharacterId: string
  toCharacterId: string
  /** 关系名称：箭头 from→to 中间显示；语义为「to 是 from 的 relation」 */
  relation: string
  fromPerspective: string
  toPerspective: string
  /** 起点如何称呼终点（当面常用，短）；与 relation 不同：侧重「叫什么」 */
  fromCallsTo: string
  /** 标识该关系是否是「玩家身份 ↔ 角色」的绑定关系 */
  isPlayerIdentity?: boolean
}

/** 人脉关系图：某主角下、以某角色为视角中心的画布状态（IndexedDB） */
export type NetworkGraphViewRecord = {
  id: string
  /** 编辑页所属主角（归属人脉的根角色） */
  rootCharacterId: string
  /** 当前居中/视角中心的角色 id */
  perspectiveCharacterId: string
  scale: number
  pan: { x: number; y: number }
  positions: Record<string, { x: number; y: number }>
  updatedAt: number
}

/** 世界背景：十二维预设多选 + 自定义规则行 */
export type WorldBackgroundDimensionKey =
  | 'worldType'
  | 'era'
  | 'technology'
  | 'supernatural'
  | 'geography'
  | 'politics'
  | 'society'
  | 'economy'
  | 'religion'
  | 'races'
  | 'conflicts'
  | 'rules'

export type WorldBackgroundSettings = {
  worldType: string[]
  era: string[]
  technology: string[]
  supernatural: string[]
  geography: string[]
  politics: string[]
  society: string[]
  economy: string[]
  religion: string[]
  races: string[]
  conflicts: string[]
  rules: string[]
  /** 自定义规则，多条 */
  customRuleLines: string[]
}

/**
 * 世界地图地貌 / 区域类型 id（`worldMapCatalog` 中英 snake_case；旧版短枚举会通过加载时映射兼容）。
 */
export type MapTerrainType = string

export type WorldMapCanvasBg = {
  mode: 'solid' | 'gradient'
  solidColor: string
  gradientFrom: string
  gradientTo: string
  gradientAngle: number
}

export type WorldMapRegionGeom =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { kind: 'polygon'; points: [number, number][] }

/** 地图板块：地貌色块 / 可编辑形状 */
export type WorldMapRegion = {
  id: string
  terrainType: MapTerrainType
  name: string
  /** 覆盖默认地貌色；空则跟随类型默认色 */
  colorOverride?: string
  zIndex: number
  geometry: WorldMapRegionGeom
}

/** 世界地图标记（兼容：x/y 为 0–100%；新数据用 worldX/worldY 世界坐标） */
export type WorldMapMarker = {
  id: string
  name: string
  type: string
  description: string
  x: number
  y: number
  worldX?: number
  worldY?: number
}

export type WorldMapData = {
  imageUrl: string
  markers: WorldMapMarker[]
  /** 画布底色（无图或作为底图下的底色） */
  canvasBg?: WorldMapCanvasBg
  /** 地貌板块 */
  regions?: WorldMapRegion[]
  /** 按地貌类型覆盖默认配色 */
  terrainColorOverrides?: Partial<Record<string, string>>
  /**
   * 坐标系版本：1 = 旧版 2000 m 边长；2 = 10 万 m 边长大画布。缺省视为 1，加载时自动升维到 2。
   */
  mapSchemaVersion?: 1 | 2
}

/** 当前逻辑画布正方形边长（m），坐标可视为米 */
export const WORLD_MAP_UNITS = 100_000
/** 旧版画布边长（m），用于迁移 */
export const LEGACY_WORLD_MAP_UNITS = 2000

export type TimelineEventImportance = 'normal' | 'important' | 'critical'

export type TimelineEvent = {
  id: string
  /** 年份，必填；负数表示公元前（如 -221 = 公元前221年） */
  year: number
  /** 月份 1–12；null 表示未指定 */
  month: number | null
  /** 日 1–31；null 表示未指定（需先有月份） */
  day: number | null
  /**
   * 兼容旧数据的展示文案；新数据可在保存时与年月日同步
   */
  time?: string
  title: string
  importance: TimelineEventImportance
  description: string
  createdAt: number
}

/** 用于排序：数值越大表示日历上越「晚」（越新）；同月无日按 1 日、无月按 1 月 1 日 */
export function timelineSortKey(e: TimelineEvent): number {
  const y = Number.isFinite(e.year) ? e.year : -9_999_999
  const m = e.month != null && e.month >= 1 && e.month <= 12 ? e.month : 1
  const d = e.day != null && e.day >= 1 && e.day <= 31 ? e.day : 1
  return y * 10_000 + m * 100 + d
}

/** 展示用：如「2025年3月」「公元前221年」 */
export function formatTimelineEventDate(e: Pick<TimelineEvent, 'year' | 'month' | 'day' | 'time'>): string {
  if (Number.isFinite(e.year)) {
    const y = e.year
    let head = ''
    if (y < 0) head = `公元前${Math.abs(y)}年`
    else head = `${y}年`
    if (e.month != null && e.month >= 1 && e.month <= 12) {
      head += `${e.month}月`
      if (e.day != null && e.day >= 1 && e.day <= 31) head += `${e.day}日`
    }
    return head
  }
  const legacy = typeof e.time === 'string' ? e.time.trim() : ''
  return legacy || '未填时间'
}

export type WorldBackground = {
  id: string
  name: string
  description: string
  isPreset: boolean
  settings: WorldBackgroundSettings
  /** 世界地图：底图 + 标记点 */
  map: WorldMapData
  /** 垂直时间线事件 */
  timeline: TimelineEvent[]
  createdAt: number
  updatedAt: number
}

const DEFAULT_MAP_CANVAS_BG: WorldMapCanvasBg = {
  mode: 'solid',
  solidColor: '#b8dce8',
  gradientFrom: '#c9e8f2',
  gradientTo: '#e8f6fb',
  gradientAngle: 135,
}

export function emptyWorldMap(): WorldMapData {
  return {
    imageUrl: '',
    markers: [],
    canvasBg: { ...DEFAULT_MAP_CANVAS_BG },
    regions: [],
    terrainColorOverrides: {},
    mapSchemaVersion: 2,
  }
}

export function cloneWorldMapData(m: WorldMapData | undefined): WorldMapData {
  const src = normalizeWorldMapData(m ?? emptyWorldMap())
  const now = Date.now()
  return {
    ...src,
    mapSchemaVersion: 2,
    canvasBg: src.canvasBg ? { ...src.canvasBg } : { ...DEFAULT_MAP_CANVAS_BG },
    terrainColorOverrides: src.terrainColorOverrides ? { ...src.terrainColorOverrides } : {},
    regions: (src.regions ?? []).map((r, i) => ({
      ...r,
      id: `rg-${now}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      geometry:
        r.geometry.kind === 'polygon'
          ? { kind: 'polygon', points: r.geometry.points.map((p) => [p[0], p[1]] as [number, number]) }
          : { ...r.geometry },
    })),
    markers: src.markers.map((mk, i) => ({
      ...mk,
      id: `mk-${now}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    })),
  }
}

function clamp01pct(n: number): number {
  if (!Number.isFinite(n)) return 50
  return Math.min(100, Math.max(0, n))
}

function scaleRegionGeometry(g: WorldMapRegionGeom, s: number): WorldMapRegionGeom {
  if (g.kind === 'rect') {
    return {
      kind: 'rect',
      x: g.x * s,
      y: g.y * s,
      w: g.w * s,
      h: g.h * s,
      r: g.r !== undefined ? g.r * s : undefined,
    }
  }
  return {
    kind: 'polygon',
    points: g.points.map(([px, py]) => [px * s, py * s] as [number, number]),
  }
}

/** 归一化地图数据并补齐世界坐标，兼容旧存档 */
export function normalizeWorldMapData(m: Partial<WorldMapData>): WorldMapData {
  const base = emptyWorldMap()
  const W = WORLD_MAP_UNITS
  const L = LEGACY_WORLD_MAP_UNITS
  const schemaIn = m.mapSchemaVersion === 2 ? 2 : 1

  const markersRaw = Array.isArray(m.markers) ? m.markers : []
  let markers: WorldMapMarker[] = markersRaw.map((mk) => {
    const x = clamp01pct(typeof mk.x === 'number' ? mk.x : 50)
    const y = clamp01pct(typeof mk.y === 'number' ? mk.y : 50)
    const span = schemaIn === 2 ? W : L
    const worldX =
      typeof mk.worldX === 'number' && Number.isFinite(mk.worldX) ? mk.worldX : (x / 100) * span
    const worldY =
      typeof mk.worldY === 'number' && Number.isFinite(mk.worldY) ? mk.worldY : (y / 100) * span
    return {
      id: typeof mk.id === 'string' ? mk.id : `mk-${Date.now()}`,
      name: typeof mk.name === 'string' ? mk.name : '',
      type: typeof mk.type === 'string' ? mk.type : '其他',
      description: typeof mk.description === 'string' ? mk.description : '',
      x,
      y,
      worldX,
      worldY,
    }
  })

  const regionsRaw = Array.isArray(m.regions) ? m.regions : []
  let regions: WorldMapRegion[] = regionsRaw
    .filter((r) => r && typeof r === 'object')
    .map((r) => normalizeRegion(r as WorldMapRegion))

  /** 旧版 2000 m 画布 → 10 万 m：坐标整体 ×(W/L) */
  if (schemaIn !== 2) {
    const s = W / L
    markers = markers.map((mk) => {
      const wx = (mk.worldX ?? 0) * s
      const wy = (mk.worldY ?? 0) * s
      return { ...mk, worldX: wx, worldY: wy, x: (wx / W) * 100, y: (wy / W) * 100 }
    })
    regions = regions.map((r) => ({
      ...r,
      geometry: scaleRegionGeometry(r.geometry, s),
    }))
  }

  markers = markers.map((mk) => {
    const wx =
      typeof mk.worldX === 'number' && Number.isFinite(mk.worldX) ? mk.worldX : (mk.x / 100) * W
    const wy =
      typeof mk.worldY === 'number' && Number.isFinite(mk.worldY) ? mk.worldY : (mk.y / 100) * W
    return { ...mk, worldX: wx, worldY: wy, x: (wx / W) * 100, y: (wy / W) * 100 }
  })

  const canvasBg: WorldMapCanvasBg =
    m.canvasBg && typeof m.canvasBg === 'object'
      ? {
          mode: (m.canvasBg.mode === 'gradient' ? 'gradient' : 'solid') as WorldMapCanvasBg['mode'],
          solidColor: typeof m.canvasBg.solidColor === 'string' ? m.canvasBg.solidColor : base.canvasBg!.solidColor,
          gradientFrom:
            typeof m.canvasBg.gradientFrom === 'string' ? m.canvasBg.gradientFrom : base.canvasBg!.gradientFrom,
          gradientTo: typeof m.canvasBg.gradientTo === 'string' ? m.canvasBg.gradientTo : base.canvasBg!.gradientTo,
          gradientAngle:
            typeof m.canvasBg.gradientAngle === 'number' ? m.canvasBg.gradientAngle : base.canvasBg!.gradientAngle,
        }
      : { ...DEFAULT_MAP_CANVAS_BG }

  const terrainColorOverrides =
    m.terrainColorOverrides && typeof m.terrainColorOverrides === 'object'
      ? { ...(m.terrainColorOverrides as Partial<Record<string, string>>) }
      : {}

  return {
    imageUrl: typeof m.imageUrl === 'string' ? m.imageUrl : '',
    markers,
    canvasBg,
    regions,
    terrainColorOverrides,
    mapSchemaVersion: 2,
  }
}

function normalizeRegion(r: WorldMapRegion): WorldMapRegion {
  const id = typeof r.id === 'string' ? r.id : `rg-${Date.now()}`
  let rawTerrain = typeof r.terrainType === 'string' ? r.terrainType.trim() : ''
  if (!rawTerrain) rawTerrain = 'land_plain_grass'
  const terrainType = (LEGACY_TERRAIN_ALIASES[rawTerrain] ?? rawTerrain) as MapTerrainType
  const zIndex = typeof r.zIndex === 'number' && Number.isFinite(r.zIndex) ? Math.round(r.zIndex) : 0
  const name = typeof r.name === 'string' ? r.name : ''
  const colorOverride = typeof r.colorOverride === 'string' ? r.colorOverride : undefined
  let geometry: WorldMapRegionGeom
  if (r.geometry?.kind === 'polygon' && Array.isArray(r.geometry.points)) {
    const pts = r.geometry.points
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map((p) => [Number(p[0]) || 0, Number(p[1]) || 0] as [number, number])
    geometry =
      pts.length >= 3 ? { kind: 'polygon', points: pts } : { kind: 'rect', x: 0, y: 0, w: 80, h: 80, r: 4 }
  } else if (r.geometry?.kind === 'rect') {
    const g = r.geometry
    geometry = {
      kind: 'rect',
      x: Number(g.x) || 0,
      y: Number(g.y) || 0,
      w: Math.max(4, Number(g.w) || 40),
      h: Math.max(4, Number(g.h) || 40),
      r: typeof g.r === 'number' ? g.r : undefined,
    }
  } else {
    geometry = { kind: 'rect', x: 0, y: 0, w: 80, h: 80, r: 4 }
  }
  return { id, terrainType, name, colorOverride, zIndex, geometry }
}

export function cloneTimelineEvents(events: TimelineEvent[] | undefined): TimelineEvent[] {
  const list = events ?? []
  const now = Date.now()
  return list.map((e, i) => ({
    ...e,
    id: `tl-${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: typeof e.createdAt === 'number' ? e.createdAt : now,
    year: typeof e.year === 'number' && Number.isFinite(e.year) ? e.year : new Date(now).getFullYear(),
    month: e.month != null && e.month >= 1 && e.month <= 12 ? e.month : null,
    day: e.day != null && e.day >= 1 && e.day <= 31 ? e.day : null,
  }))
}

export function emptyWorldBackgroundSettings(): WorldBackgroundSettings {
  return {
    worldType: [],
    era: [],
    technology: [],
    supernatural: [],
    geography: [],
    politics: [],
    society: [],
    economy: [],
    religion: [],
    races: [],
    conflicts: [],
    rules: [],
    customRuleLines: [],
  }
}

/** 深拷贝设定（用于从预设复制为自定义世界） */
export function cloneWorldBackgroundSettings(s: WorldBackgroundSettings): WorldBackgroundSettings {
  return {
    worldType: [...s.worldType],
    era: [...s.era],
    technology: [...s.technology],
    supernatural: [...s.supernatural],
    geography: [...s.geography],
    politics: [...s.politics],
    society: [...s.society],
    economy: [...s.economy],
    religion: [...s.religion],
    races: [...s.races],
    conflicts: [...s.conflicts],
    rules: [...s.rules],
    customRuleLines: [...(s.customRuleLines ?? [])],
  }
}

/** 操作者「你」与图中某角色（主角或 NPC）的双向关系，仅存 IndexedDB，不进 relationships 表 */
export type PlayerNetworkLink = {
  id: string
  characterId: string
  /** 你→对方 连线中间词；由用户填写，AI 不生成 */
  relationYouToThem: string
  /** 对方→你 连线中间词；AI 可预填，用户可改 */
  relationThemToYou: string
  /** 【你看对方】描述；由用户填写，AI 不生成 */
  youSeeThem: string
  /** 【对方看你】描述；AI 生成 */
  theySeeYou: string
  /** 你如何称呼对方（口语/备注）；**仅用户填写**，AI 人脉生成不得写入 */
  youCallThem: string
  /** 对方如何称呼你；人脉 AI 生成时可预填，用户可改 */
  theyCallYou: string
}

