import { memoryTextMatchesQuery } from './memorySearchFilter'
import type { CharacterMemory } from '../newFriendsPersona/types'
import { matchesMemoryArchiveAccount } from './memoryArchiveAccountScope'
import type {
  MemoryCharacterRosterItem,
  MemoryEntry,
  MemorySceneTag,
  MemoryTypeFilterId,
} from './memoryArchiveTypes'

export function sortMemoryEntriesByRecency(entries: MemoryEntry[]): MemoryEntry[] {
  return [...entries].sort((a, b) => b.timestamp - a.timestamp)
}

export function isLinkedMemoryEntry(entry: MemoryEntry): boolean {
  return entry.memoryScope === 'linked' || entry.tags.includes('关联线下')
}

export function matchesMemoryTypeFilters(
  entry: MemoryEntry,
  filters: ReadonlySet<MemoryTypeFilterId>,
): boolean {
  if (filters.size === 0) return true
  return [...filters].some((filter) => {
    if (filter === 'linked') return isLinkedMemoryEntry(entry)
    return entry.tags.includes(filter)
  })
}

export function filterMemoryEntries(params: {
  entries: MemoryEntry[]
  rawById: Map<string, CharacterMemory>
  accountId: string
  primaryAccountId: string | null
  charId: string | 'all'
  searchQuery: string
  typeFilters?: ReadonlySet<MemoryTypeFilterId>
}): MemoryEntry[] {
  const { entries, rawById, accountId, primaryAccountId, charId, searchQuery, typeFilters } = params
  const q = searchQuery.trim()
  return entries.filter((e) => {
    if (!matchesMemoryArchiveAccount(e, accountId, primaryAccountId)) return false
    const raw = rawById.get(e.id)
    if (typeFilters && typeFilters.size > 0 && !matchesMemoryTypeFilters(e, typeFilters)) {
      return false
    }
    if (charId !== 'all' && e.charId !== charId) return false
    if (!q) return true
    if (raw) return memoryTextMatchesQuery(raw, q)
    const hay = [
      e.content,
      e.charDisplayName,
      e.groupDisplayName ?? '',
      ...e.tags,
      ...(e.triggerKeywords ?? []),
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q.toLowerCase())
  })
}

export function filterAndSortMemoryEntries(
  params: Parameters<typeof filterMemoryEntries>[0],
): MemoryEntry[] {
  return sortMemoryEntriesByRecency(filterMemoryEntries(params))
}

export function buildCharacterFocusRoster(entries: MemoryEntry[]): Array<{
  charId: string
  displayName: string
  avatarUrl?: string
  count: number
}> {
  return buildCharacterRoster(entries).map(({ charId, displayName, avatarUrl, memoryCount }) => ({
    charId,
    displayName,
    avatarUrl,
    count: memoryCount,
  }))
}

export function buildCharacterRoster(
  entries: MemoryEntry[],
  opts?: {
    realNameByCharId?: Map<string, string>
    remarkByCharId?: Map<string, string>
  },
): MemoryCharacterRosterItem[] {
  const map = new Map<
    string,
    {
      displayName: string
      wechatRemarkName?: string
      avatarUrl?: string
      memoryCount: number
      sceneTags: Set<MemorySceneTag>
      hasLinked: boolean
      hasOwn: boolean
    }
  >()
  for (const e of entries) {
    const realName = opts?.realNameByCharId?.get(e.charId)?.trim() || e.charDisplayName
    const remark = opts?.remarkByCharId?.get(e.charId)?.trim()
    const prev = map.get(e.charId)
    const linked = isLinkedMemoryEntry(e)
    const own = !linked
    if (prev) {
      prev.memoryCount += 1
      for (const t of e.tags) prev.sceneTags.add(t)
      if (linked) prev.hasLinked = true
      if (own) prev.hasOwn = true
    } else {
      map.set(e.charId, {
        displayName: realName,
        wechatRemarkName: remark && remark !== realName ? remark : undefined,
        avatarUrl: e.charAvatarUrl,
        memoryCount: 1,
        sceneTags: new Set(e.tags),
        hasLinked: linked,
        hasOwn: own,
      })
    }
  }
  return [...map.entries()]
    .map(([charId, v]) => ({
      charId,
      displayName: v.displayName,
      ...(v.wechatRemarkName ? { wechatRemarkName: v.wechatRemarkName } : {}),
      avatarUrl: v.avatarUrl,
      memoryCount: v.memoryCount,
      sceneTags: [...v.sceneTags],
      hasLinked: v.hasLinked,
      hasOwn: v.hasOwn,
    }))
    .sort((a, b) => b.memoryCount - a.memoryCount || a.displayName.localeCompare(b.displayName, 'zh-CN'))
}

export function rosterMatchesSearch(item: MemoryCharacterRosterItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (item.displayName.toLowerCase().includes(q)) return true
  if (item.wechatRemarkName?.toLowerCase().includes(q)) return true
  return item.sceneTags.some((t) => t.toLowerCase().includes(q))
}

/** 角色详情页：展示信息不随「查看账号」筛选消失（无该账号记忆时仍停留详情页） */
export function resolveDetailCharacterInfo(
  charId: string,
  allEntries: MemoryEntry[],
  accountId: string,
  primaryAccountId: string | null,
  fallback?: { displayName?: string; avatarUrl?: string; wechatRemarkName?: string },
  realNameByCharId?: Map<string, string>,
): MemoryCharacterRosterItem {
  const entriesForChar = allEntries.filter((e) => e.charId === charId)
  const accountEntries = entriesForChar.filter((e) =>
    matchesMemoryArchiveAccount(e, accountId, primaryAccountId),
  )
  const ref = entriesForChar[0] ?? accountEntries[0]
  const realName =
    realNameByCharId?.get(charId)?.trim() ||
    ref?.charDisplayName?.trim() ||
    fallback?.displayName?.trim() ||
    charId.slice(0, 8)
  const remark = fallback?.wechatRemarkName?.trim()
  const sceneTags = new Set<MemorySceneTag>()
  let hasLinked = false
  let hasOwn = false
  for (const e of accountEntries) {
    const linked = isLinkedMemoryEntry(e)
    if (linked) hasLinked = true
    else hasOwn = true
    for (const t of e.tags) sceneTags.add(t)
  }
  return {
    charId,
    displayName: realName,
    ...(remark && remark !== realName ? { wechatRemarkName: remark } : {}),
    avatarUrl: ref?.charAvatarUrl ?? fallback?.avatarUrl,
    memoryCount: accountEntries.length,
    sceneTags: [...sceneTags],
    hasLinked,
    hasOwn,
  }
}
