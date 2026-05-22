/** 剧本杀馆 · 古典藏书阁 */

export type JubenshaShelfCategory = 'tears' | 'suspense' | 'casual' | 'horror'

export type JubenshaTag = '情感' | '恐怖' | '机制' | '推理' | '古风' | '现代'

export type JubenshaComment = {
  id: string
  authorName: string
  characterId?: string
  body: string
  createdAtIso: string
  isMarginalia?: boolean
}

export type JubenshaRoleBrief = {
  name: string
  gender: '男' | '女'
  blurb: string
  /** 档案页「表面身份」短标 */
  publicIdentity?: string
  /** 角色立绘占位（URL） */
  portraitUrl?: string
  /** 角色个人剧本封面（入局抽牌 / 翻书） */
  roleScriptCoverUrl?: string
}

export type JubenshaScript = {
  id: string
  title: string
  subtitle?: string
  shelfCategory: JubenshaShelfCategory
  tags: JubenshaTag[]
  /** 推理难度 Logic 1–5 */
  logicDifficulty: number
  /** 情感深度 Tears 1–5 */
  tearsDepth: number
  playerCount: number
  maleCount: number
  femaleCount: number
  durationMinutes: number
  coverImageUrl?: string
  loreIntro: string
  roles: JubenshaRoleBrief[]
  comments: JubenshaComment[]
}

export type RoleHistoryEntry = {
  id: string
  roleName: string
  scriptId: string
  scriptTitle: string
}

export type JubenshaAchievement = {
  id: string
  scriptId: string
  scriptTitle: string
  label: string
  unlockedAtIso: string
}

export type JubenshaCompanion = {
  characterId: string
  sharedHours: number
  scriptsPlayedTogether: number
}

/** 玩家推理手记 · 游玩档案 */
export type PlayRecord = {
  totalPlayMinutes: number
  scriptsCompleted: number
  endingsUnlocked: number
  achievements: JubenshaAchievement[]
  companions: JubenshaCompanion[]
  roleHistory: RoleHistoryEntry[]
  completedScriptIds: string[]
}

/** @deprecated 使用 PlayRecord */
export type JubenshaRecord = PlayRecord

export type JubenshaContactRef = {
  id: string
  characterId: string
  remarkName: string
  avatarUrl?: string
}

export type ShelfConfig = {
  id: JubenshaShelfCategory
  labelZh: string
  labelEn: string
  watermark: string
}
