import type { PulseAccountData, PulsePersistedRoot, PulsePovId, PulseWorldData } from './pulseTypes'
import { emptyPulseWorldData, isPulseWorldPovId } from './pulseTypes'

const LEGACY_WORLD_KEY = '_legacy'

/** 合并两个世界数据块（迁移 / 吸收旧数据） */
function mergeWorldData(a: PulseWorldData, b: PulseWorldData): PulseWorldData {
  return {
    posts: [...b.posts, ...a.posts],
    commentsByPostId: { ...b.commentsByPostId, ...a.commentsByPostId },
    trending: a.trending.length ? a.trending : b.trending,
  }
}

/** v1 账号级 posts/trending → 各世界独立存储 */
export function migratePulseAccountData(acc: PulseAccountData): PulseAccountData {
  const worldByPov: Record<string, PulseWorldData> = { ...(acc.worldByPov ?? {}) }

  const legacyPosts = acc.posts ?? []
  const legacyComments = acc.commentsByPostId ?? {}
  const legacyTrending = acc.trending ?? []
  const hasLegacy =
    legacyPosts.length > 0 ||
    legacyTrending.length > 0 ||
    Object.keys(legacyComments).length > 0

  if (hasLegacy) {
    const targetPov =
      acc.lastPovId && isPulseWorldPovId(acc.lastPovId) ? acc.lastPovId : LEGACY_WORLD_KEY
    const existing = worldByPov[targetPov] ?? emptyPulseWorldData()
    worldByPov[targetPov] = mergeWorldData(existing, {
      posts: legacyPosts,
      commentsByPostId: legacyComments,
      trending: legacyTrending,
    })
  }

  for (const key of Object.keys(worldByPov)) {
    const slice = worldByPov[key]!
    worldByPov[key] = {
      posts: slice.posts ?? [],
      commentsByPostId: slice.commentsByPostId ?? {},
      trending: slice.trending ?? [],
    }
  }

  return {
    lastPovId: acc.lastPovId,
    profileStatsByPov: acc.profileStatsByPov ?? {},
    followingByPov: acc.followingByPov ?? {},
    worldByPov,
    interactionsByPov: acc.interactionsByPov ?? {},
    dmThreadsByPov: acc.dmThreadsByPov ?? {},
  }
}

export function migratePulseRoot(root: PulsePersistedRoot): PulsePersistedRoot {
  const byAccount: Record<string, PulseAccountData> = {}
  for (const [accId, acc] of Object.entries(root.byAccount ?? {})) {
    byAccount[accId] = migratePulseAccountData(acc as PulseAccountData)
  }
  return { ...root, byAccount }
}

/** 首次进入某世界时，把未分配旧数据并入该世界 */
export function absorbLegacyWorldIntoPov(
  acc: PulseAccountData,
  povId: PulsePovId,
): PulseAccountData | null {
  const legacy = acc.worldByPov[LEGACY_WORLD_KEY]
  if (!legacy) return null
  const current = acc.worldByPov[povId] ?? emptyPulseWorldData()
  const { [LEGACY_WORLD_KEY]: _removed, ...rest } = acc.worldByPov
  return {
    ...acc,
    worldByPov: {
      ...rest,
      [povId]: mergeWorldData(current, legacy),
    },
  }
}

/** 只读占位：selector 缺省回退须稳定引用，避免 useSyncExternalStore 死循环 */
const EMPTY_WORLD_READ_FALLBACK: PulseWorldData = emptyPulseWorldData()

export function getWorldSlice(acc: PulseAccountData, povId: string): PulseWorldData {
  return acc.worldByPov[povId] ?? EMPTY_WORLD_READ_FALLBACK
}
