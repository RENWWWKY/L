export type PulseTab = 'home' | 'discover' | 'inbox' | 'profile'

export type PulseHomeSegment = 'following' | 'recommended'

export type PulseProfileSegment = 'posts' | 'media' | 'liked'

/** `player:{identityId}` 或 `char:{characterId}` */
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
  type: 'like' | 'comment' | 'repost' | 'follow'
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
}

export type PulseAccountData = {
  lastPovId?: PulsePovId
  profileStatsByPov: Record<string, PulseProfileStats>
  posts: PulsePost[]
  commentsByPostId: Record<string, PulseComment[]>
  trending: PulseTrendingTopic[]
  interactionsByPov: Record<string, PulseInteraction[]>
  dmThreadsByPov: Record<string, PulseDmThread[]>
}

export type PulsePersistedRoot = {
  version: 1
  byAccount: Record<string, PulseAccountData>
}

export type PulsePovOption = {
  povId: PulsePovId
  label: string
  avatarUrl?: string
  kind: 'player' | 'char'
  rawId: string
}

export function toPlayerPovId(identityId: string): PulsePovId {
  return `player:${identityId.trim()}`
}

export function toCharPovId(characterId: string): PulsePovId {
  return `char:${characterId.trim()}`
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

export function emptyPulseAccountData(): PulseAccountData {
  return {
    profileStatsByPov: {},
    posts: [],
    commentsByPostId: {},
    trending: [],
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
