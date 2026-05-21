import { memoryTextMatchesQuery } from './memorySearchFilter'
import type { CharacterMemory } from '../newFriendsPersona/types'
import { isCharacterLinkedMemory } from './memoryCharacterScope'
import type { MemoryArchiveKind, MemoryEntry, MemorySourceIdentity } from './memoryArchiveTypes'

export function filterMemoryEntries(params: {
  entries: MemoryEntry[]
  rawById: Map<string, CharacterMemory>
  source: MemorySourceIdentity
  kind: MemoryArchiveKind
  charId: string | 'all'
  searchQuery: string
}): MemoryEntry[] {
  const { entries, rawById, source, kind, charId, searchQuery } = params
  const q = searchQuery.trim()
  return entries.filter((e) => {
    if (e.sourceIdentity !== source) return false
    const raw = rawById.get(e.id)
    if (kind === 'linked') {
      if (!raw || !isCharacterLinkedMemory(raw)) return false
    } else if (raw && isCharacterLinkedMemory(raw)) {
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

export function buildCharacterFocusRoster(entries: MemoryEntry[]): Array<{
  charId: string
  displayName: string
  avatarUrl?: string
  count: number
}> {
  const map = new Map<string, { displayName: string; avatarUrl?: string; count: number }>()
  for (const e of entries) {
    const prev = map.get(e.charId)
    if (prev) {
      prev.count += 1
    } else {
      map.set(e.charId, {
        displayName: e.charDisplayName,
        avatarUrl: e.charAvatarUrl,
        count: 1,
      })
    }
  }
  return [...map.entries()]
    .map(([charId, v]) => ({ charId, ...v }))
    .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName, 'zh-CN'))
}
