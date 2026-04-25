export type DateMode = 'normal' | 'vn'
export type NarrativePerspective = 'first' | 'second' | 'third'
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
}

export type PlotItemType = 'player' | 'ai'

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

export type PlotItem = {
  id: string
  type: PlotItemType
  content: string
  timestamp: number
  highlightText?: string
  /** 完整思维链（`<thinking>...</thinking>` 内原文；兼容旧存档 `<logicpass>`，供折叠查看） */
  logicPass?: string
  /** 旧版：仅一行规划摘要，兼容历史存档 */
  planSummary?: string
  /** 仅 AI 条：每次「重新回复」追加一条，不覆盖旧稿 */
  versions?: string[]
  /** 与 `versions` 等长时，各版对应的思维链文本 */
  versionLogicPasses?: (string | undefined)[]
  /** 当前展示版本下标，默认指向最新 */
  currentVersionIndex?: number
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
  branchEnabled: boolean
  lastDateAt: number | null
  pendingBranches: BranchOption[]
  branchNodeHistory: number[]
  /** 选中分支卡片后、待发送时注入续写执导（发送后清空） */
  branchContinuationHint?: string
}

