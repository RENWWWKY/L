import { create } from 'zustand'

import { personaDb } from '../wechat/newFriendsPersona/idb'
import { DEFAULT_PULSE_ROOT, LUMI_PULSE_KV_KEY } from './constants'
import { resolvePulseAuthorAvatarForPersist, pickStablePulseNetizenAvatarPath } from './pulseNetizenAvatar'
import type {
  PulseAccountData,
  PulseComment,
  PulseDmThread,
  PulseFollowingUser,
  PulseGeneratedProfileBundle,
  PulseInteraction,
  PulsePersistedRoot,
  PulsePovId,
  PulsePost,
  PulseProfileStats,
  PulseTrendingTopic,
  PulseWorldData,
} from './pulseTypes'
import { defaultProfileStats, emptyPulseAccountData, emptyPulseWorldData, isPulseWorldPovId, toPlayerPovId } from './pulseTypes'
import {
  absorbLegacyWorldIntoPov,
  getWorldSlice,
  migratePulseRoot,
} from './pulseWorldData'
import { findAccountById, loadAccountsBundle, resolveAccountSessionIdentityId } from '../wechat/wechatAccountPersistence'

type PulseStore = {
  hydrated: boolean
  currentAccountId: string | null
  /** 当前浏览的世界锚点（主要角色 char:）— 决定动态流 / 热搜等内容域 */
  currentPOVId: PulsePovId | null
  /** 当前登录的微博账号（玩家 player:）— 发帖 / 点赞 / 个人主页 / 消息 */
  currentPlayerPovId: PulsePovId | null
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
    locationLabel?: string
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
  markInteractionsReadByType: (type: PulseInteraction['type']) => void
  appendAiPosts: (
    rows: Array<{ authorName: string; content: string }>,
    authorPovId: PulsePovId,
  ) => void
  appendAiComments: (postId: string, comments: PulseComment[]) => void
  bumpProfileStats: (povId: PulsePovId, patch: Partial<PulseProfileStats>) => void
  /** 写入 AI 生成的个人主页数据（统计、动态、评论、消息互动） */
  applyGeneratedProfileBundle: (input: {
    povId: PulsePovId
    authorName: string
    authorAvatarUrl?: string
    bundle: PulseGeneratedProfileBundle
  }) => void
  /** 为尚无头像的 AI 网友帖/评补全并持久化随机网友头像 */
  ensurePostDetailAvatars: (postId: string) => void
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

/** 在当前世界数据块上 patch */
function patchWorld(
  root: PulsePersistedRoot,
  accountId: string,
  povId: PulsePovId,
  recipe: (draft: PulseWorldData) => PulseWorldData,
): PulsePersistedRoot {
  return patchAccount(root, accountId, (draft) => {
    const prev = draft.worldByPov[povId] ?? emptyPulseWorldData()
    return {
      ...draft,
      worldByPov: {
        ...draft.worldByPov,
        [povId]: recipe(prev),
      },
    }
  })
}

function requirePulseSession(): {
  worldId: PulsePovId
  playerPovId: PulsePovId
  accountId: string
  root: PulsePersistedRoot
} | null {
  const { currentPOVId, currentPlayerPovId, currentAccountId, root } = usePulseStore.getState()
  if (!currentAccountId || !currentPOVId || !currentPlayerPovId || !isPulseWorldPovId(currentPOVId)) {
    return null
  }
  return { worldId: currentPOVId, playerPovId: currentPlayerPovId, accountId: currentAccountId, root }
}

/** @deprecated 使用 requirePulseSession */
function requireWorldPov(): { pov: PulsePovId; accountId: string; root: PulsePersistedRoot } | null {
  const session = requirePulseSession()
  if (!session) return null
  return { pov: session.worldId, accountId: session.accountId, root: session.root }
}

export const usePulseStore = create<PulseStore>((set, get) => ({
  hydrated: false,
  currentAccountId: null,
  currentPOVId: null,
  currentPlayerPovId: null,
  root: DEFAULT_PULSE_ROOT,

  async bindAccount(accountId) {
    const acc = accountId?.trim() || null
    if (acc === get().currentAccountId && get().hydrated) return

    let playerPovId: PulsePovId | null = null
    if (acc) {
      const bundle = await loadAccountsBundle()
      const account = bundle ? findAccountById(bundle, acc) : null
      if (account) {
        const rawId = resolveAccountSessionIdentityId(account).trim()
        if (rawId && rawId !== '__none__') {
          playerPovId = toPlayerPovId(rawId)
        }
      }
    }

    let root: PulsePersistedRoot = DEFAULT_PULSE_ROOT
    let shouldPersistMigration = false
    try {
      const raw = await personaDb.getPhoneKv(LUMI_PULSE_KV_KEY)
      if (raw && typeof raw === 'object' && (raw as PulsePersistedRoot).version === 1) {
        const loaded = raw as PulsePersistedRoot
        shouldPersistMigration = Object.values(loaded.byAccount ?? {}).some((acc) => {
          const row = acc as PulseAccountData
          return (
            (row.posts?.length ?? 0) > 0 ||
            (row.trending?.length ?? 0) > 0 ||
            Object.keys(row.commentsByPostId ?? {}).length > 0
          )
        })
        root = migratePulseRoot(loaded)
      }
    } catch (e) {
      console.warn('[LumiPulse] hydrate failed', e)
    }

    const savedPov = acc ? root.byAccount[acc]?.lastPovId ?? null : null
    let lastPov = isPulseWorldPovId(savedPov) ? savedPov : null

    if (acc && lastPov) {
      const accountData = ensureAccount(root, acc)
      const absorbed = absorbLegacyWorldIntoPov(accountData, lastPov)
      if (absorbed) {
        root = patchAccount(root, acc, () => absorbed)
        schedulePersist(root)
      }
    }

    set({
      hydrated: true,
      currentAccountId: acc,
      root,
      currentPOVId: lastPov,
      currentPlayerPovId: playerPovId,
    })

    if (shouldPersistMigration) {
      schedulePersist(root)
    }
  },

  setCurrentPOVId(povId) {
    const { currentAccountId, root } = get()
    const worldPov = isPulseWorldPovId(povId) ? povId : null
    if (!currentAccountId || !worldPov) {
      set({ currentPOVId: worldPov })
      return
    }

    let nextRoot = patchAccount(root, currentAccountId, (draft) => ({
      ...draft,
      lastPovId: worldPov,
    }))

    const absorbed = absorbLegacyWorldIntoPov(
      nextRoot.byAccount[currentAccountId]!,
      worldPov,
    )
    if (absorbed) {
      nextRoot = patchAccount(nextRoot, currentAccountId, () => absorbed)
    }

    set({ currentPOVId: worldPov, root: nextRoot })
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
    const id = povId ?? get().currentPlayerPovId ?? get().currentPOVId
    if (!id) return defaultProfileStats()
    const data = get().getAccountData()
    return data.profileStatsByPov[id] ?? defaultProfileStats()
  },

  getPostsForDiscover() {
    const ctx = requireWorldPov()
    if (!ctx) return []
    const world = getWorldSlice(ctx.root.byAccount[ctx.accountId]!, ctx.pov)
    return [...world.posts].sort((a, b) => b.createdAt - a.createdAt)
  },

  getComments(postId) {
    const ctx = requireWorldPov()
    if (!ctx) return []
    const world = getWorldSlice(ctx.root.byAccount[ctx.accountId]!, ctx.pov)
    return world.commentsByPostId[postId] ?? []
  },

  getTrending() {
    const ctx = requireWorldPov()
    if (!ctx) return []
    const world = getWorldSlice(ctx.root.byAccount[ctx.accountId]!, ctx.pov)
    return [...world.trending].sort((a, b) => a.rank - b.rank)
  },

  getInteractions() {
    const player = get().currentPlayerPovId
    if (!player) return []
    const rows = get().getAccountData().interactionsByPov[player] ?? []
    return [...rows].sort((a, b) => b.createdAt - a.createdAt)
  },

  getDmThreads() {
    const player = get().currentPlayerPovId
    if (!player) return []
    const rows = get().getAccountData().dmThreadsByPov[player] ?? []
    return [...rows].sort((a, b) => b.lastAt - a.lastAt)
  },

  publishPost(input) {
    const ctx = requireWorldPov()
    if (!ctx) return ''
    const id = `pp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const post: PulsePost = {
      id,
      authorPovId: input.authorPovId,
      authorName: input.authorName,
      authorAvatarUrl: resolvePulseAuthorAvatarForPersist(
        input.authorPovId,
        input.authorName,
        input.authorAvatarUrl,
        input.isAiGenerated,
      ),
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
      locationLabel: input.locationLabel?.trim() || undefined,
    }
    const nextRoot = patchWorld(ctx.root, ctx.accountId, ctx.pov, (draft) => ({
      ...draft,
      posts: [post, ...draft.posts],
    }))
    set({ root: nextRoot })
    schedulePersist(nextRoot)
    return id
  },

  toggleLike(postId) {
    const ctx = requirePulseSession()
    if (!ctx) return
    const nextRoot = patchWorld(ctx.root, ctx.accountId, ctx.worldId, (draft) => ({
      ...draft,
      posts: draft.posts.map((p) => {
        if (p.id !== postId) return p
        const liked = p.likedByPovIds.includes(ctx.playerPovId)
        const likedByPovIds = liked
          ? p.likedByPovIds.filter((x) => x !== ctx.playerPovId)
          : [...p.likedByPovIds, ctx.playerPovId]
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
    const ctx = requireWorldPov()
    if (!ctx) return ''
    const id = `pc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const comment: PulseComment = {
      id,
      postId: input.postId,
      authorPovId: input.authorPovId,
      authorName: input.authorName,
      authorAvatarUrl: resolvePulseAuthorAvatarForPersist(
        input.authorPovId,
        input.authorName,
        input.authorAvatarUrl,
        input.isAiGenerated,
      ),
      content: input.content.trim(),
      createdAt: Date.now(),
      parentId: input.parentId,
      isAiGenerated: input.isAiGenerated,
    }
    const nextRoot = patchWorld(ctx.root, ctx.accountId, ctx.pov, (draft) => {
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
    if (!currentAccountId || !isPulseWorldPovId(forPovId)) return
    const ranked = topics.map((t, i) => ({
      ...t,
      rank: i + 1,
      generatedForPovId: forPovId,
    }))
    const nextRoot = patchWorld(root, currentAccountId, forPovId, (draft) => ({
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
    const player = get().currentPlayerPovId
    const { currentAccountId, root } = get()
    if (!player || !currentAccountId) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const list = draft.dmThreadsByPov[player] ?? []
      return {
        ...draft,
        dmThreadsByPov: {
          ...draft.dmThreadsByPov,
          [player]: list.map((t) => (t.id === threadId ? { ...t, unread: 0 } : t)),
        },
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  markInteractionsRead() {
    const player = get().currentPlayerPovId
    const { currentAccountId, root } = get()
    if (!player || !currentAccountId) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const list = draft.interactionsByPov[player] ?? []
      return {
        ...draft,
        interactionsByPov: {
          ...draft.interactionsByPov,
          [player]: list.map((it) => ({ ...it, read: true })),
        },
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  markInteractionsReadByType(type) {
    const player = get().currentPlayerPovId
    const { currentAccountId, root } = get()
    if (!player || !currentAccountId) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const list = draft.interactionsByPov[player] ?? []
      return {
        ...draft,
        interactionsByPov: {
          ...draft.interactionsByPov,
          [player]: list.map((it) => (it.type === type ? { ...it, read: true } : it)),
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
    const ctx = requireWorldPov()
    if (!ctx) return
    const nextRoot = patchWorld(ctx.root, ctx.accountId, ctx.pov, (draft) => {
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

  applyGeneratedProfileBundle(input) {
    const { currentAccountId, root } = get()
    const pov = input.povId.trim()
    if (!currentAccountId || !isPulseWorldPovId(pov)) return

    const now = Date.now()
    const newPosts: PulsePost[] = []
    const commentsByPostId: Record<string, PulseComment[]> = {}
    const interactionItems: Omit<PulseInteraction, 'id' | 'read'>[] = []

    input.bundle.posts.forEach((row, index) => {
      const postId = `pp-gen-${now}-${index}-${Math.random().toString(36).slice(2, 6)}`
      const createdAt = now - (input.bundle.posts.length - index) * 86_400_000 - index * 120_000

      newPosts.push({
        id: postId,
        authorPovId: pov,
        authorName: input.authorName,
        authorAvatarUrl: input.authorAvatarUrl,
        content: row.content,
        createdAt,
        likeCount: row.likeCount,
        commentCount: row.commentCount,
        repostCount: row.repostCount,
        likedByPovIds: [],
        verified: true,
        isAiGenerated: true,
      })

      const snippet = row.content.slice(0, 48)
      const builtComments: PulseComment[] = row.comments.map((c, ci) => ({
        id: `pc-gen-${postId}-${ci}`,
        postId,
        authorPovId: `ai:${c.authorName}`,
        authorName: c.authorName,
        authorAvatarUrl: resolvePulseAuthorAvatarForPersist(
          `ai:${c.authorName}`,
          c.authorName,
          undefined,
          true,
        ),
        content: c.content,
        createdAt: createdAt + (ci + 1) * 45_000,
        isAiGenerated: true,
      }))
      commentsByPostId[postId] = builtComments

      for (const c of builtComments) {
        interactionItems.push({
          type: 'comment',
          fromName: c.authorName,
          fromAvatarUrl: c.authorAvatarUrl,
          postId,
          postSnippet: snippet,
          content: c.content,
          createdAt: c.createdAt,
        })
      }
      if (row.repostCount > 0) {
        const fromName = builtComments[0]?.authorName ?? '网友'
        interactionItems.push({
          type: 'repost',
          fromName,
          postId,
          postSnippet: snippet,
          createdAt: createdAt + 60_000,
        })
      }
      if (row.likeCount > 0) {
        const fromName = builtComments[1]?.authorName ?? builtComments[0]?.authorName ?? '路人'
        interactionItems.push({
          type: 'like',
          fromName,
          postId,
          postSnippet: snippet,
          createdAt: createdAt + 90_000,
        })
      }
    })

    let nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const followingRows: PulseFollowingUser[] = input.bundle.followingUsers.map((u) => {
        const povId = `ai:${u.name}` as PulsePovId
        return {
          povId,
          name: u.name,
          bio: u.bio,
          avatarUrl: pickStablePulseNetizenAvatarPath(povId),
          verified: false,
        }
      })
      return {
        ...draft,
        profileStatsByPov: {
          ...draft.profileStatsByPov,
          [pov]: { ...input.bundle.profileStats },
        },
        followingByPov: {
          ...draft.followingByPov,
          [pov]: followingRows,
        },
      }
    })

    nextRoot = patchWorld(nextRoot, currentAccountId, pov, (draft) => {
      const mergedComments = { ...draft.commentsByPostId }
      for (const [pid, list] of Object.entries(commentsByPostId)) {
        mergedComments[pid] = list
      }
      return {
        ...draft,
        posts: [...newPosts, ...draft.posts],
        commentsByPostId: mergedComments,
      }
    })

    if (interactionItems.length) {
      const stamped = interactionItems.map((it) => ({
        ...it,
        id: `pi-${now}-${Math.random().toString(36).slice(2, 6)}`,
        read: false,
      }))
      nextRoot = patchAccount(nextRoot, currentAccountId, (draft) => {
        const prev = draft.interactionsByPov[pov] ?? []
        return {
          ...draft,
          interactionsByPov: {
            ...draft.interactionsByPov,
            [pov]: [...stamped, ...prev].slice(0, 80),
          },
        }
      })
    }

    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  ensurePostDetailAvatars(postId) {
    const ctx = requireWorldPov()
    if (!ctx) return
    const pid = postId.trim()
    if (!pid) return

    const world = getWorldSlice(ctx.root.byAccount[ctx.accountId]!, ctx.pov)
    let postsChanged = false
    const posts = world.posts.map((p) => {
      if (p.id !== pid || p.authorAvatarUrl?.trim()) return p
      const nextUrl = resolvePulseAuthorAvatarForPersist(
        p.authorPovId,
        p.authorName,
        p.authorAvatarUrl,
        p.isAiGenerated,
      )
      if (!nextUrl) return p
      postsChanged = true
      return { ...p, authorAvatarUrl: nextUrl }
    })

    const commentList = world.commentsByPostId[pid] ?? []
    let commentsChanged = false
    const nextComments = commentList.map((c) => {
      if (c.authorAvatarUrl?.trim()) return c
      const nextUrl = resolvePulseAuthorAvatarForPersist(
        c.authorPovId,
        c.authorName,
        c.authorAvatarUrl,
        c.isAiGenerated,
      )
      if (!nextUrl) return c
      commentsChanged = true
      return { ...c, authorAvatarUrl: nextUrl }
    })

    if (!postsChanged && !commentsChanged) return

    const nextRoot = patchWorld(ctx.root, ctx.accountId, ctx.pov, (draft) => ({
      ...draft,
      posts: postsChanged ? posts : draft.posts,
      commentsByPostId: commentsChanged
        ? { ...draft.commentsByPostId, [pid]: nextComments }
        : draft.commentsByPostId,
    }))
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },
}))
