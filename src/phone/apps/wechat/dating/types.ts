import type { StoryTimelineSummaryDelta } from '../memory/storyTimelineTypes'

export type DateMode = 'normal' | 'vn'
export type NarrativePerspective = 'first' | 'second' | 'third'
/** 剧情 AI 目标正文字数（汉字）：与 DatingStoryPage、generateDatingAi 共用 */
export const DATING_AI_LENGTH_TARGET_MIN = 60
/** UI 可设上限；模型正文约落在目标的 88%～118%（不含思维链 / VN 语音参数） */
export const DATING_AI_LENGTH_TARGET_MAX = 10_000

export function clampDatingLengthTargetChars(raw: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 500
  return Math.max(
    DATING_AI_LENGTH_TARGET_MIN,
    Math.min(DATING_AI_LENGTH_TARGET_MAX, Math.round(n)),
  )
}

/** 平行事件 / IF 线面板：允许 1～上限任意整数，编辑时不强制 60 下限 */
export function parsePlotDimensionLengthTarget(raw: number | string, fallback = 500): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.min(DATING_AI_LENGTH_TARGET_MAX, Math.round(n)))
}
/** 送入约会剧情模型的上下文预算（词符/token；仍受 API/模型实际上限） */
export const DATING_AI_MAX_CONTEXT_TOKENS = 200_000

/** 剧情续写单次 completion 最大回复（词符/token；仍受所选模型/API 限制） */
export const DATING_AI_MAX_OUTPUT_TOKENS = 30_000

/**
 * 参考资料汉字总预算（按 {@link DATING_AI_MAX_CONTEXT_TOKENS} 估算，预留 system/思维链指令）。
 * 各段独立裁剪，合计可接近该预算。
 */
export const DATING_AI_REFERENCE_TOTAL_CHAR_BUDGET = 150_000

/**
 * 长期记忆 / 尚未总结·私聊 / 群聊 等按段软上限。
 */
export const DATING_AI_REFERENCE_SECTION_CHAR_CAP = 30_000

/** 「尚未总结·线下剧情」正文摘录软上限（游标后全文） */
export const DATING_AI_OFFLINE_UNSUMMARIZED_CHAR_CAP = 80_000

/** 「最近剧情」「场景人物线索」注入软上限 */
export const DATING_AI_HISTORY_PROMPT_MAX = 60_000

export const DATING_AI_SCENE_HINTS_PROMPT_MAX = 20_000

export type NarrativeGenOptions = {
  /** 期望字数（大概值，非硬性） */
  lengthTargetChars?: number
  autoUserReaction?: boolean
  /** 文风描述，与 referenceSnippet 一并注入 system 侧补充（见 datingStylePrompt） */
  stylePrompt?: string
  /** 参考片段，模仿句式与节奏 */
  referenceSnippet?: string
  /** 剧情分支：选中卡片后的续写执导（仅当轮注入 user 侧一次） */
  branchContinuationHint?: string
  /** 导演模式：玩家输入为下一段生成指引（尚未发生），须当场展开演出；关闭则视为既成事实 */
  directorMode?: boolean
  /** 本轮玩家指定出场的人脉角色 id（输入框展示姓名，模型侧按 id 注入） */
  presentNetworkCharacterIds?: string[]
  /** 本轮发送时同轮生成平行事件（覆盖 archive 默认时可传） */
  generateParallelOnSend?: boolean
  /** 本轮发送时同轮生成 IF 线 */
  generateIfLineOnSend?: boolean
}

export type PlotItemType = 'player' | 'ai'

export type PlotImageItem = {
  id: string
  prompt: string
  url: string
  addedAt: number
}

export type DatingCardBgMode = 'solid' | 'gradient' | 'image'

export type DatingCardStyle = {
  /** 是否显示卡片内容（不影响返回/菜单键） */
  showContent: boolean
  /** 字体颜色（同时用于返回/菜单图标） */
  textColor: string
  /** 背景模式 */
  bgMode: DatingCardBgMode
  /** 纯色 */
  solidColor: string
  /** 渐变 */
  gradientFrom: string
  gradientTo: string
  gradientAngle: number
  /** 图片（URL 或 dataURL） */
  imageUrl: string
  /** 毛玻璃 */
  glass: boolean
  /** 毛玻璃强度（px） */
  glassBlur: number
  /** 背景不透明度 0-1（只影响背景层） */
  bgOpacity: number
  /** 标签样式 */
  tagBgMode: DatingCardBgMode
  tagSolidColor: string
  tagGradientFrom: string
  tagGradientTo: string
  tagGradientAngle: number
  tagImageUrl: string
  tagBgOpacity: number
  tagTextColor: string
  /** 圆角（px），999 表示胶囊 */
  tagRadius: number
}

export type CharacterInfo = {
  id: string
  avatarUrl: string
  realName: string
  pinyin: string
  age: number
  heightCm: number
  weightKg: number
  zodiac: string
  /** 生日：月+日，如 3-14 / 03-14 */
  birthdayMD: string
  /** 座右铭 */
  motto: string
  /** 顶部身份卡样式 */
  cardStyle?: Partial<DatingCardStyle>
  identityTags: string[]
  signature: string
  prompt: string
}

/** 本段 AI 剧情曾成功写入的「尾声延展」补丁：重新生成时用于把人设条目恢复为补丁前正文，避免新稿被当轮覆写牵着走 */
export type WorldBookAfterRevertEntry = {
  worldBookId: string
  itemId: string
  /** 应用该轮补丁前该条目的正文（空串表示当时为空） */
  contentBefore: string
  /**
   * 该轮补丁成功写入后的正文（与模型 newContent 对齐）。
   * 重新生成时：若人设里当前正文与此不一致，视为用户已手改或后续剧情已覆盖，**跳过**本条回滚，以当前库为准。
   */
  contentAfterPatch?: string
}

export type PlotItem = {
  id: string
  type: PlotItemType
  content: string
  /**
   * 系统落库墙钟（后台时序 / 游标；不对用户展示）。
   * 与剧情时间字段分离。
   */
  timestamp: number
  /** 显式系统落库时间；缺省回退 timestamp */
  systemRecordedAt?: number
  /** 剧情日（故事内，用户可见） */
  storyDay?: string
  /** 剧情时段/时刻（用户可见） */
  storyTime?: string
  /** 剧情时间展示文案 */
  storyTimeLabel?: string
  highlightText?: string
  /** 剧情配图（穿插在剧情卡片中展示） */
  plotImages?: PlotImageItem[]
  /** 完整思维链（`<thinking>...</thinking>` 内原文；兼容旧存档 `<logicpass>`，供折叠查看） */
  logicPass?: string
  /** 旧版：仅一行规划摘要，兼容历史存档 */
  planSummary?: string
  /** 仅 AI 条：每次「重新回复」追加一条，不覆盖旧稿 */
  versions?: string[]
  /** 与 `versions` 等长时，各版对应的思维链文本 */
  versionLogicPasses?: (string | undefined)[]
  /** 与 `versions` 等长时，各版对应的剧情时间轴 JSON 增量展示文本 */
  versionTimelineSnapshots?: (string | undefined)[]
  /** 与 `versions` 等长时，各版对应的 timeline JSON 增量（重建 IndexedDB 行表用） */
  versionTimelineDeltas?: (StoryTimelineSummaryDelta | undefined)[]
  /** 当前展示版本对应的剧情时间轴表（折叠面板） */
  timelineSnapshot?: string
  /** 当前展示版本对应的 timeline JSON 增量 */
  timelineDelta?: StoryTimelineSummaryDelta
  /** 当前展示版本下标，默认指向最新 */
  currentVersionIndex?: number
  /**
   * 本条 AI 最近一次**成功落库**的尾声延展补丁所对应的「补丁前」快照；仅用于重新生成时恢复人设。
   * 若最近一次完成本条时模型未提交补丁，则为 undefined。
   */
  worldBookAfterRevertEntries?: WorldBookAfterRevertEntry[]
  /**
   * @deprecated 待办台账已下线；旧档可能仍有此字段，读写时忽略。
   */
  todoLedgerBefore?: import('../memory/storyTimelineTypes').StoryTimelineTodoEntry[]
  /** 平行事件：与锚点同刻、异场景的切片（不影响主线 canon） */
  parallelEvent?: PlotDimensionArtifact
  /** IF 线：从锚点分歧的假设分支（不影响主线 canon） */
  ifLine?: PlotDimensionArtifact
}

/** 剧情卡片「平行事件 / IF 线」生成结果 */
export type PlotDimensionKind = 'parallel' | 'if'

export type PlotDimensionArtifact = {
  content: string
  writingGuide: string
  lengthTargetChars: number
  updatedAt: number
  /** 平行事件写入剧情摘要表时的结构化 delta（非原文） */
  timelineDelta?: import('../memory/storyTimelineTypes').StoryTimelineSummaryDelta
}

export type BranchOption = {
  id: string
  content: string
  nextPrompt: string
  /** 模型分支风格：顺水推舟 / 趣味性 / 转折性 / 恶搞性 */
  styleLabel?: string
}

export type CharacterArchive = {
  characterId: string
  plots: PlotItem[]
  currentProgress: number
  modePreference: DateMode
  /** 上帝视角：旁白推进，不直接对「你」说话、不与玩家互动 */
  godPerspective: boolean
  /**
   * 主角色不在场：本轮只写玩家与 NPC/人脉互动，约会主角色不得出场。
   * 与上帝视角互斥（开启其一会自动关闭另一）。
   */
  mainCharacterOffstage?: boolean
  branchEnabled: boolean
  /** 线下普通模式：是否在每轮 AI 剧情后生成弹幕（走弹幕接口与全局/角色弹幕配置） */
  offlineDanmakuEnabled?: boolean
  /** VN 模式：禁用语音合成/播放（省 token + 省请求） */
  vnVoiceDisabled?: boolean
  /** 导演模式：输入为下一段剧情指引（尚未发生）；关闭则视为既成事实。普通模式与 VN 共用 */
  directorMode?: boolean
  /** 抢话：允许 AI 代写玩家当轮言行；关闭则不抢话。普通模式与 VN 共用 */
  autoUserReaction?: boolean
  /** 发送剧情时同轮一并生成平行事件（写入卡片 + 时间轴摘要） */
  generateParallelOnSend?: boolean
  /** 发送剧情时同轮一并生成 IF 线（仅卡片阅读，不进 prompt） */
  generateIfLineOnSend?: boolean
  lastDateAt: number | null
  pendingBranches: BranchOption[]
  branchNodeHistory: number[]
  /** 选中分支卡片后、待发送时注入续写执导（发送后清空） */
  branchContinuationHint?: string
  /** 线下/VN 剧情生成：目标正文字数（汉字），与界面「目标字数」同步落盘，避免切换角色后仍用默认 500 */
  datingLengthTargetChars?: number
  /** 剧情生成后是否穿插剧情配图 */
  plotImageGenEnabled?: boolean
  /** 每轮剧情配图张数范围 */
  plotImageCountMin?: number
  plotImageCountMax?: number
}

export type ArchivesStore = Record<string, CharacterArchive>

