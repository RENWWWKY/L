import { useMemo } from 'react'

import type { PulseComment, PulseDmThread, PulseInteraction, PulsePost, PulseProfileStats, PulseTrendingTopic } from './pulseTypes'
import { defaultProfileStats } from './pulseTypes'
import { usePulseStore } from './usePulseStore'

const EMPTY_POSTS: PulsePost[] = []
const EMPTY_COMMENTS: PulseComment[] = []
const EMPTY_TRENDING: PulseTrendingTopic[] = []
const EMPTY_INTERACTIONS: PulseInteraction[] = []
const EMPTY_DM_THREADS: PulseDmThread[] = []
const DEFAULT_PROFILE_STATS = defaultProfileStats()

function selectAccountPosts(state: ReturnType<typeof usePulseStore.getState>): PulsePost[] {
  const acc = state.currentAccountId
  if (!acc) return EMPTY_POSTS
  return state.root.byAccount[acc]?.posts ?? EMPTY_POSTS
}

export function usePulseDiscoverPosts(): PulsePost[] {
  const posts = usePulseStore(selectAccountPosts)
  return useMemo(() => [...posts].sort((a, b) => b.createdAt - a.createdAt), [posts])
}

/** 首页：关注 = 他人动态；推荐 = 全站 */
export function usePulseHomePosts(
  segment: 'following' | 'recommended',
  currentPovId: string,
): PulsePost[] {
  const posts = usePulseDiscoverPosts()
  return useMemo(() => {
    if (segment === 'recommended') return posts
    return posts.filter((p) => p.authorPovId !== currentPovId)
  }, [posts, segment, currentPovId])
}

export function usePulsePostsByAuthor(authorPovId: string): PulsePost[] {
  const posts = usePulseDiscoverPosts()
  return useMemo(
    () => posts.filter((p) => p.authorPovId === authorPovId),
    [posts, authorPovId],
  )
}

export function usePulseLikedPosts(currentPovId: string): PulsePost[] {
  const posts = usePulseDiscoverPosts()
  return useMemo(
    () => posts.filter((p) => p.likedByPovIds.includes(currentPovId)),
    [posts, currentPovId],
  )
}

export function usePulseMediaPosts(authorPovId: string): PulsePost[] {
  const posts = usePulsePostsByAuthor(authorPovId)
  return useMemo(() => posts.filter((p) => (p.imageUrls?.length ?? 0) > 0), [posts])
}

export function usePulsePostComments(postId: string): PulseComment[] {
  return usePulseStore((s) => {
    const acc = s.currentAccountId
    if (!acc) return EMPTY_COMMENTS
    return s.root.byAccount[acc]?.commentsByPostId[postId] ?? EMPTY_COMMENTS
  })
}

export function usePulseTrendingTopics(): PulseTrendingTopic[] {
  const trending = usePulseStore((s) => {
    const acc = s.currentAccountId
    if (!acc) return EMPTY_TRENDING
    return s.root.byAccount[acc]?.trending ?? EMPTY_TRENDING
  })
  return useMemo(() => [...trending].sort((a, b) => a.rank - b.rank), [trending])
}

export function usePulseInteractions(): PulseInteraction[] {
  const rows = usePulseStore((s) => {
    const acc = s.currentAccountId
    const pov = s.currentPOVId
    if (!acc || !pov) return EMPTY_INTERACTIONS
    return s.root.byAccount[acc]?.interactionsByPov[pov] ?? EMPTY_INTERACTIONS
  })
  return useMemo(() => [...rows].sort((a, b) => b.createdAt - a.createdAt), [rows])
}

export function usePulseDmThreads(): PulseDmThread[] {
  const rows = usePulseStore((s) => {
    const acc = s.currentAccountId
    const pov = s.currentPOVId
    if (!acc || !pov) return EMPTY_DM_THREADS
    return s.root.byAccount[acc]?.dmThreadsByPov[pov] ?? EMPTY_DM_THREADS
  })
  return useMemo(() => [...rows].sort((a, b) => b.lastAt - a.lastAt), [rows])
}

export function usePulseProfileStats(povId: string | null | undefined): PulseProfileStats {
  return usePulseStore((s) => {
    const acc = s.currentAccountId
    const id = povId ?? s.currentPOVId
    if (!acc || !id) return DEFAULT_PROFILE_STATS
    return s.root.byAccount[acc]?.profileStatsByPov[id] ?? DEFAULT_PROFILE_STATS
  })
}
