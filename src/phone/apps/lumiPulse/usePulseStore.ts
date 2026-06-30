import { create } from 'zustand'

import { personaDb } from '../wechat/newFriendsPersona/idb'
import { DEFAULT_PULSE_ROOT, LUMI_PULSE_KV_KEY } from './constants'
import type {
  PulseAccountData,
  PulseComment,
  PulseDmThread,
  PulseInteraction,
  PulsePersistedRoot,
  PulsePovId,
  PulsePost,
  PulseProfileStats,
  PulseTrendingTopic,
} from './pulseTypes'
import { defaultProfileStats, emptyPulseAccountData } from './pulseTypes'

type PulseStore = {
  hydrated: boolean
  currentAccountId: string | null
  /** 当前登录视角 — 所有读写必须依赖此字段 */
  currentPOVId: PulsePovId | null
  root: PulsePersistedRoot

  bindAccount: (accountId: string | null | undefined) => Promise<void>
  setCurrentPOVId: (povId: PulsePovId | null) => void
  logoutPov: () => void

  getAccountData: () => PulseAccountData
  getProfileStats: (povId?: PulsePovId | null) => PulseProfileStats
  getPostsForDiscover: () => PulsePost[]
  getComments: (postId: string) => PulseComment[]
  getTrending: () => PulseTrendingTopic[]
  getInteractions: () => PulseInteraction[]
  getDmThreads: () => PulseDmThread[]

  publishPost: (input: {
    authorPovId: PulsePovId
    authorName: string
    authorAvatarUrl?: string
    content: string
    trendingTopicId?: string
    isAiGenerated?: boolean
    verified?: boolean
    imageUrls?: string[]
  }) => string
  toggleLike: (postId: string) => void
  addComment: (input: {
    postId: string
    authorPovId: PulsePovId
    authorName: string
    authorAvatarUrl?: string
    content: string
    parentId?: string
    isAiGenerated?: boolean
  }) => string
  setTrending: (topics: PulseTrendingTopic[], forPovId: PulsePovId) => void
  pushInteractions: (items: Omit<PulseInteraction, 'id' | 'read'>[], povId: PulsePovId) => void
  replaceDmThreads: (threads: PulseDmThread[], povId: PulsePovId) => void
  markDmThreadRead: (threadId: string) => void
  markInteractionsRead: () => void
  appendAiPosts: (
    rows: Array<{ authorName: string; content: string }>,
    authorPovId: PulsePovId,
  ) => void
  appendAiComments: (postId: string, comments: PulseComment[]) => void
  bumpProfileStats: (povId: PulsePovId, patch: Partial<PulseProfileStats>) => void
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

function schedulePersist(root: PulsePersistedRoot) {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    void personaDb.setPhoneKv(LUMI_PULSE_KV_KEY, root)
  }, 280)
}

function ensureAccount(root: PulsePersistedRoot, accountId: string): PulseAccountData {
  const existing = root.byAccount[accountId]
  if (existing) return existing
  const next = emptyPulseAccountData()
  root.byAccount[accountId] = next
  return next
}

function patchAccount(
  root: PulsePersistedRoot,
  accountId: string,
  recipe: (draft: PulseAccountData) => PulseAccountData,
): PulsePersistedRoot {
  const acc = ensureAccount(root, accountId)
  return {
    ...root,
    byAccount: {
      ...root.byAccount,
      [accountId]: recipe(acc),
    },
  }
}

export const usePulseStore = create<PulseStore>((set, get) => ({
  hydrated: false,
  currentAccountId: null,
  currentPOVId: null,
  root: DEFAULT_PULSE_ROOT,

  async bindAccount(accountId) {
    const acc = accountId?.trim() || null
    if (acc === get().currentAccountId && get().hydrated) return

    let root: PulsePersistedRoot = DEFAULT_PULSE_ROOT
    try {
      const raw = await personaDb.getPhoneKv(LUMI_PULSE_KV_KEY)
      if (raw && typeof raw === 'object' && (raw as PulsePersistedRoot).version === 1) {
        root = raw as PulsePersistedRoot
      }
    } catch (e) {
      console.warn('[LumiPulse] hydrate failed', e)
    }

    const lastPov = acc ? root.byAccount[acc]?.lastPovId ?? null : null
    set({
      hydrated: true,
      currentAccountId: acc,
      root,
      currentPOVId: lastPov,
    })
  },

  setCurrentPOVId(povId) {
    const { currentAccountId, root } = get()
    if (!currentAccountId || !povId) {
      set({ currentPOVId: povId })
      return
    }
    const nextRoot = patchAccount(root, currentAccountId, (draft) => ({
      ...draft,
      lastPovId: povId,
    }))
    set({ currentPOVId: povId, root: nextRoot })
    schedulePersist(nextRoot)
  },

  logoutPov() {
    get().setCurrentPOVId(null)
  },

  getAccountData() {
    const { currentAccountId, root } = get()
    if (!currentAccountId) return emptyPulseAccountData()
    return ensureAccount(root, currentAccountId)
  },

  getProfileStats(povId) {
    const id = povId ?? get().currentPOVId
    if (!id) return defaultProfileStats()
    const data = get().getAccountData()
    return data.profileStatsByPov[id] ?? defaultProfileStats()
  },

  getPostsForDiscover() {
    return [...get().getAccountData().posts].sort((a, b) => b.createdAt - a.createdAt)
  },

  getComments(postId) {
    return get().getAccountData().commentsByPostId[postId] ?? []
  },

  getTrending() {
    return [...get().getAccountData().trending].sort((a, b) => a.rank - b.rank)
  },

  getInteractions() {
    const pov = get().currentPOVId
    if (!pov) return []
    const rows = get().getAccountData().interactionsByPov[pov] ?? []
    return [...rows].sort((a, b) => b.createdAt - a.createdAt)
  },

  getDmThreads() {
    const pov = get().currentPOVId
    if (!pov) return []
    const rows = get().getAccountData().dmThreadsByPov[pov] ?? []
    return [...rows].sort((a, b) => b.lastAt - a.lastAt)
  },

  publishPost(input) {
    const { currentAccountId, root } = get()
    if (!currentAccountId) return ''
    const id = `pp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const post: PulsePost = {
      id,
      authorPovId: input.authorPovId,
      authorName: input.authorName,
      authorAvatarUrl: input.authorAvatarUrl,
      content: input.content.trim(),
      createdAt: Date.now(),
      likeCount: 0,
      commentCount: 0,
      repostCount: 0,
      likedByPovIds: [],
      isAiGenerated: input.isAiGenerated,
      trendingTopicId: input.trendingTopicId,
      verified: input.verified ?? input.authorPovId.startsWith('char:'),
      imageUrls: input.imageUrls?.length ? input.imageUrls : undefined,
    }
    const nextRoot = patchAccount(root, currentAccountId, (draft) => ({
      ...draft,
      posts: [post, ...draft.posts],
    }))
    set({ root: nextRoot })
    schedulePersist(nextRoot)
    return id
  },

  toggleLike(postId) {
    const pov = get().currentPOVId
    const { currentAccountId, root } = get()
    if (!pov || !currentAccountId) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => ({
      ...draft,
      posts: draft.posts.map((p) => {
        if (p.id !== postId) return p
        const liked = p.likedByPovIds.includes(pov)
        const likedByPovIds = liked
          ? p.likedByPovIds.filter((x) => x !== pov)
          : [...p.likedByPovIds, pov]
        return {
          ...p,
          likedByPovIds,
          likeCount: Math.max(0, p.likeCount + (liked ? -1 : 1)),
        }
      }),
    }))
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  addComment(input) {
    const { currentAccountId, root } = get()
    if (!currentAccountId) return ''
    const id = `pc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const comment: PulseComment = {
      id,
      postId: input.postId,
      authorPovId: input.authorPovId,
      authorName: input.authorName,
      authorAvatarUrl: input.authorAvatarUrl,
      content: input.content.trim(),
      createdAt: Date.now(),
      parentId: input.parentId,
      isAiGenerated: input.isAiGenerated,
    }
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const list = draft.commentsByPostId[input.postId] ?? []
      return {
        ...draft,
        commentsByPostId: {
          ...draft.commentsByPostId,
          [input.postId]: [...list, comment],
        },
        posts: draft.posts.map((p) =>
          p.id === input.postId ? { ...p, commentCount: p.commentCount + 1 } : p,
        ),
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
    return id
  },

  setTrending(topics, forPovId) {
    const { currentAccountId, root } = get()
    if (!currentAccountId) return
    const ranked = topics.map((t, i) => ({
      ...t,
      rank: i + 1,
      generatedForPovId: forPovId,
    }))
    const nextRoot = patchAccount(root, currentAccountId, (draft) => ({
      ...draft,
      trending: ranked,
    }))
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  pushInteractions(items, povId) {
    const { currentAccountId, root } = get()
    if (!currentAccountId || !items.length) return
    const stamped = items.map((it) => ({
      ...it,
      id: `pi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      read: false,
    }))
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const prev = draft.interactionsByPov[povId] ?? []
      return {
        ...draft,
        interactionsByPov: {
          ...draft.interactionsByPov,
          [povId]: [...stamped, ...prev].slice(0, 80),
        },
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  replaceDmThreads(threads, povId) {
    const { currentAccountId, root } = get()
    if (!currentAccountId) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => ({
      ...draft,
      dmThreadsByPov: {
        ...draft.dmThreadsByPov,
        [povId]: threads,
      },
    }))
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  markDmThreadRead(threadId) {
    const pov = get().currentPOVId
    const { currentAccountId, root } = get()
    if (!pov || !currentAccountId) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const list = draft.dmThreadsByPov[pov] ?? []
      return {
        ...draft,
        dmThreadsByPov: {
          ...draft.dmThreadsByPov,
          [pov]: list.map((t) => (t.id === threadId ? { ...t, unread: 0 } : t)),
        },
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  markInteractionsRead() {
    const pov = get().currentPOVId
    const { currentAccountId, root } = get()
    if (!pov || !currentAccountId) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const list = draft.interactionsByPov[pov] ?? []
      return {
        ...draft,
        interactionsByPov: {
          ...draft.interactionsByPov,
          [pov]: list.map((it) => ({ ...it, read: true })),
        },
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  appendAiPosts(rows, authorPovId) {
    for (const row of rows) {
      get().publishPost({
        authorPovId: `ai:${row.authorName}`,
        authorName: row.authorName,
        content: row.content,
        isAiGenerated: true,
      })
    }
    void authorPovId
  },

  appendAiComments(postId, comments) {
    const { currentAccountId, root } = get()
    if (!currentAccountId) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const list = draft.commentsByPostId[postId] ?? []
      return {
        ...draft,
        commentsByPostId: {
          ...draft.commentsByPostId,
          [postId]: [...list, ...comments],
        },
        posts: draft.posts.map((p) =>
          p.id === postId ? { ...p, commentCount: p.commentCount + comments.length } : p,
        ),
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  bumpProfileStats(povId, patch) {
    const { currentAccountId, root } = get()
    if (!currentAccountId) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const prev = draft.profileStatsByPov[povId] ?? defaultProfileStats()
      return {
        ...draft,
        profileStatsByPov: {
          ...draft.profileStatsByPov,
          [povId]: { ...prev, ...patch },
        },
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },
}))
