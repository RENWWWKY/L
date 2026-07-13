import type { NsfwPoseLibraryEntry, NsfwPoseLibraryVariant } from './nsfwPoseLibraryTypes'

const VARIANT_BLOCK_RE = /(?:\(([^)]*)\)\s*)?image###([\s\S]*?)###/gi

function normalizeEntryKeys(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((k) => String(k ?? '').trim()).filter(Boolean)
  }
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()]
  return []
}

function parseVariantsFromContent(content: string): NsfwPoseLibraryVariant[] {
  const text = String(content ?? '').trim()
  if (!text) return []

  const variants: NsfwPoseLibraryVariant[] = []
  for (const m of text.matchAll(new RegExp(VARIANT_BLOCK_RE.source, 'gi'))) {
    const label = (m[1] ?? '默认').trim() || '默认'
    const tags = String(m[2] ?? '')
      .replace(/\s+/g, ' ')
      .replace(/,{2,}/g, ',')
      .trim()
    if (tags) variants.push({ label, tags })
  }
  return variants
}

function parseRawEntry(raw: unknown): NsfwPoseLibraryEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const keys = normalizeEntryKeys(o.key ?? o.keys)
  const content = typeof o.content === 'string' ? o.content : ''
  const variants = parseVariantsFromContent(content)
  if (!keys.length || !variants.length) return null
  return { keys, variants }
}

/** 解析 ST 酒馆世界书 JSON（entries 数组或单文件多 entry） */
export function parseNsfwPoseLibraryDocument(raw: unknown): NsfwPoseLibraryEntry[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map(parseRawEntry).filter((e): e is NsfwPoseLibraryEntry => e != null)
  }
  if (typeof raw !== 'object') return []
  const o = raw as Record<string, unknown>
  const entries = o.entries
  if (Array.isArray(entries)) {
    return entries.map(parseRawEntry).filter((e): e is NsfwPoseLibraryEntry => e != null)
  }
  const single = parseRawEntry(raw)
  return single ? [single] : []
}

export function pickNsfwPoseLibraryVariant(
  entry: NsfwPoseLibraryEntry,
): NsfwPoseLibraryVariant | null {
  if (!entry.variants.length) return null
  const preferred =
    entry.variants.find((v) => /默认|default/i.test(v.label)) ?? entry.variants[0]
  return preferred ?? null
}
