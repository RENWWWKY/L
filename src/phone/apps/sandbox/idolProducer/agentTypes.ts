/** 金牌经纪人模拟器 — 核心类型 */

export type ArtistStatKey = 'vocal' | 'acting' | 'variety' | 'charm'

export interface ArtistStats {
  vocal: number
  acting: number
  variety: number
  charm: number
}

export interface ArtistMetrics {
  fans: number
  commercialValue: number
  affection: number
}

export interface Artist {
  id: string
  name: string
  avatar: string
  tags: string[]
  stats: ArtistStats
  metrics: ArtistMetrics
  /** 关联微信人设 characterId，用于线上联络与 ChatRoom 偏置 */
  characterId?: string
  /** 人设简述，供 LLM 聊天与剧情 */
  personaSummary?: string
}

export type HotSearchType = 'positive' | 'negative'

export interface HotSearchItem {
  id: string
  rank: number
  keyword: string
  heat: number
  type: HotSearchType
  /** 关联艺人 id，用于粉丝波动 */
  artistId?: string
  /** 负面热搜每秒粉丝流失 */
  fanDrainPerSec?: number
  createdAt: number
}

export interface StoryChoice {
  id: string
  label: string
  effects: ChoiceEffects
}

export interface ChoiceEffects {
  budget?: number
  reputation?: number
  affection?: number
  artistId?: string
  /** 触发后续热搜生成 */
  triggerHotSearch?: boolean
  hotSearchHint?: string
}

export interface StoryScene {
  id: string
  background?: string
  lines: string[]
  choices?: StoryChoice[]
  /** 无选项时自动进入下一场景 */
  nextSceneId?: string
}

export interface StoryChapter {
  id: string
  title: string
  scenes: StoryScene[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'artist'
  content: string
  ts: number
}

export type TrainType = 'vocal' | 'acting' | 'variety'

export interface TrainConfig {
  type: TrainType
  label: string
  cost: number
  statKey: ArtistStatKey
  delta: number
  flavor: string
}

export interface StatDeltaEvent {
  id: string
  label: string
  value: string
  tone: 'gain' | 'loss' | 'neutral'
  x: number
  y: number
}

export interface AgencyState {
  budget: number
  reputation: number
  artists: Artist[]
  unlockedArtists: Artist[]
  hotSearches: HotSearchItem[]
  storyChapterId: string
  storySceneId: string
  storyLineIndex: number
  selectedArtistId: string | null
  chatThreads: Record<string, ChatMessage[]>
  /** 专属约会已解锁艺人 */
  dateUnlockedArtistIds: string[]
  lastHotSearchTick: number
  /** 承接通告体力 */
  stamina: number
}

export type AgentTab = 'story' | 'artists' | 'operations'

export const STAT_LABELS: Record<ArtistStatKey, string> = {
  vocal: '唱功',
  acting: '演技',
  variety: '综艺感',
  charm: '魅力',
}

export const RECRUIT_COST = 8000
export const DATE_AFFECTION_THRESHOLD = 55
export const GIG_STAMINA_COST = 1
export const MAX_STAMINA = 3
