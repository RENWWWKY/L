export type PulseTab = 'home' | 'discover' | 'inbox' | 'profile'

export type PulseHomeSegment = 'following' | 'recommended'

export type PulseProfileSegment = 'posts' | 'media' | 'liked'

/** 世界锚点：`char:{characterId}`（主要角色）；历史数据可能含 `player:{identityId}` */
export type PulsePovId = string

export type PulseTrendingTag = '爆' | '新' | '热'

export type PulsePost = {
  id: string
  authorPovId: PulsePovId
  authorName: string
  authorAvatarUrl?: string
  content: string
  createdAt: number
  likeCount: number
  commentCount: number
  repostCount: number
  likedByPovIds: string[]
  isAiGenerated?: boolean
  trendingTopicId?: string
  /** 展示认证 V 标（主要角色 / 热搜帖） */
  verified?: boolean
  imageUrls?: string[]
  /** 发布时附带的位置标签 */
  locationLabel?: string
}

export type PulseComment = {
  id: string
  postId: string
  authorPovId: PulsePovId
  authorName: string
  authorAvatarUrl?: string
  content: string
  createdAt: number
  parentId?: string
  isAiGenerated?: boolean
}

export type PulseTrendingTopic = {
  id: string
  rank: number
  title: string
  tag?: PulseTrendingTag
  excerpt?: string
  postCount?: number
  createdAt: number
  generatedForPovId?: PulsePovId
}

export type PulseInteraction = {
  id: string
  type: 'like' | 'comment' | 'repost' | 'follow' | 'mention'
  fromName: string
  fromAvatarUrl?: string
  postId?: string
  postSnippet?: string
  content?: string
  createdAt: number
  read: boolean
}

export type PulseDmMessage = {
  id: string
  fromFan: boolean
  content: string
  createdAt: number
}

export type PulseDmThread = {
  id: string
  fanName: string
  fanAvatarUrl?: string
  lastMessage: string
  lastAt: number
  unread: number
  messages: PulseDmMessage[]
}

export type PulseProfileStats = {
  following: number
  followers: number
  likesReceived: number
  /** AI 按人设生成的个人简介 */
  bio?: string
}

/** 关注列表中的用户 */
export type PulseFollowingUser = {
  povId: PulsePovId
  name: string
  avatarUrl?: string
  bio?: string
  verified?: boolean
}

/** AI 生成个人主页：单条动态及互动 */
export type PulseGeneratedProfilePost = {
  content: string
  likeCount: number
  commentCount: number
  repostCount: number
  comments: Array<{ authorName: string; content: string }>
}

/** AI 生成个人主页完整包 */
export type PulseGeneratedProfileBundle = {
  profileStats: PulseProfileStats
  posts: PulseGeneratedProfilePost[]
  followingUsers: Array<{ name: string; bio?: string }>
}

/** 单个世界（主要角色）内的微博数据 */
export type PulseWorldData = {
  posts: PulsePost[]
  commentsByPostId: Record<string, PulseComment[]>
  trending: PulseTrendingTopic[]
}

export type PulseAccountData = {
  lastPovId?: PulsePovId
  profileStatsByPov: Record<string, PulseProfileStats>
  /** 各角色 POV 的关注列表 */
  followingByPov: Record<string, PulseFollowingUser[]>
  /** 各世界完全隔离：动态流 / 评论 / 热搜 */
  worldByPov: Record<string, PulseWorldData>
  interactionsByPov: Record<string, PulseInteraction[]>
  dmThreadsByPov: Record<string, PulseDmThread[]>
  /** @deprecated v1 旧版全局数据，hydrate 时迁移至 worldByPov */
  posts?: PulsePost[]
  commentsByPostId?: Record<string, PulseComment[]>
  trending?: PulseTrendingTopic[]
}

export type PulsePersistedRoot = {
  version: 1
  byAccount: Record<string, PulseAccountData>
}

export type PulsePovOption = {
  povId: PulsePovId
  /** 主要角色名 */
  label: string
  /** 关联世界背景名，如「现代都市」 */
  worldName: string
  avatarUrl?: string
  kind: 'char'
  rawId: string
}

export function toPlayerPovId(identityId: string): PulsePovId {
  return `player:${identityId.trim()}`
}

export function toCharPovId(characterId: string): PulsePovId {
  return `char:${characterId.trim()}`
}

/** 是否为有效「世界」锚点（仅主要角色 char:） */
export function isPulseWorldPovId(povId: string | null | undefined): boolean {
  const parsed = povId ? parsePulsePovId(povId) : null
  return parsed?.kind === 'char'
}

export function parsePulsePovId(povId: string): { kind: 'player' | 'char'; rawId: string } | null {
  const t = povId.trim()
  if (t.startsWith('player:')) {
    const rawId = t.slice('player:'.length).trim()
    return rawId ? { kind: 'player', rawId } : null
  }
  if (t.startsWith('char:')) {
    const rawId = t.slice('char:'.length).trim()
    return rawId ? { kind: 'char', rawId } : null
  }
  return null
}

export function emptyPulseWorldData(): PulseWorldData {
  return {
    posts: [],
    commentsByPostId: {},
    trending: [],
  }
}

export function emptyPulseAccountData(): PulseAccountData {
  return {
    profileStatsByPov: {},
    followingByPov: {},
    worldByPov: {},
    interactionsByPov: {},
    dmThreadsByPov: {},
  }
}

export function defaultProfileStats(): PulseProfileStats {
  return { following: 0, followers: 0, likesReceived: 0 }
}

export function formatPulseCount(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
