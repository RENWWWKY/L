import {
  parseNsfwPoseLibraryDocument,
  pickNsfwPoseLibraryVariant,
} from './nsfwPoseLibraryParse'
import type { NsfwPoseLibraryEntry } from './nsfwPoseLibraryTypes'

const poseJsonModules = import.meta.glob('./data/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

let cachedEntries: NsfwPoseLibraryEntry[] | null = null

export function loadNsfwPoseLibraryEntries(): NsfwPoseLibraryEntry[] {
  if (cachedEntries) return cachedEntries
  const merged: NsfwPoseLibraryEntry[] = []
  for (const doc of Object.values(poseJsonModules)) {
    merged.push(...parseNsfwPoseLibraryDocument(doc))
  }
  cachedEntries = merged
  return merged
}

function scoreEntry(entry: NsfwPoseLibraryEntry, query: string): number {
  const q = query.toLowerCase()
  let score = 0
  for (const key of entry.keys) {
    const k = key.trim()
    if (!k) continue
    if (q.includes(k.toLowerCase())) score += k.length + 4
    else if (k.length >= 2 && new RegExp(escapeRegExp(k), 'i').test(query)) score += k.length
  }
  return score
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 按聊天上下文关键词召回姿势库条目（selective 式，无命中则空） */
export function recallNsfwPoseLibraryEntries(
  query: string,
  maxEntries = 2,
): Array<{ entry: NsfwPoseLibraryEntry; variantTags: string; matchedKey: string }> {
  const q = String(query ?? '').trim()
  if (!q) return []

  const catalog = loadNsfwPoseLibraryEntries()
  if (!catalog.length) return []

  const ranked = catalog
    .map((entry) => ({ entry, score: scoreEntry(entry, q) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, maxEntries))

  const out: Array<{ entry: NsfwPoseLibraryEntry; variantTags: string; matchedKey: string }> = []
  for (const row of ranked) {
    const variant = pickNsfwPoseLibraryVariant(row.entry)
    if (!variant?.tags.trim()) continue
    const matchedKey =
      row.entry.keys.find((k) => q.toLowerCase().includes(k.toLowerCase())) ??
      row.entry.keys[0] ??
      ''
    out.push({
      entry: row.entry,
      variantTags: variant.tags.trim(),
      matchedKey,
    })
  }
  return out
}
