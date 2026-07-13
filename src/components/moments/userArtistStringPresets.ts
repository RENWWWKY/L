export type UserArtistStringPreset = {
  id: string
  label: string
  value: string
}

const MAX_USER_ARTIST_STRING_PRESETS = 32

export function normalizeUserArtistStringPresets(raw: unknown): UserArtistStringPreset[] {
  if (!Array.isArray(raw)) return []
  const out: UserArtistStringPreset[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const value = String(row.value ?? '').trim()
    if (!value) continue
    const norm = normalizeArtistStringValue(value)
    if (seen.has(norm)) continue
    seen.add(norm)
    const label = String(row.label ?? '').trim() || value.slice(0, 24)
    const id =
      typeof row.id === 'string' && row.id.trim()
        ? row.id.trim()
        : `uasp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    out.push({ id, label, value })
    if (out.length >= MAX_USER_ARTIST_STRING_PRESETS) break
  }
  return out
}

export function normalizeArtistStringValue(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function appendArtistStringReference(current: string, insert: string): string {
  const next = insert.trim()
  if (!next) return current.trim()
  const cur = current.trim()
  if (!cur) return next
  const curNorm = normalizeArtistStringValue(cur)
  const nextNorm = normalizeArtistStringValue(next)
  if (curNorm.includes(nextNorm)) return cur
  const sep = /[,\s]$/.test(cur) ? ' ' : ', '
  return `${cur}${sep}${next}`
}

export function upsertUserArtistStringPreset(
  presets: UserArtistStringPreset[],
  input: { label: string; value: string },
): UserArtistStringPreset[] {
  const value = input.value.trim()
  if (!value) return presets
  const label = input.label.trim() || value.slice(0, 24)
  const norm = normalizeArtistStringValue(value)
  const existingIdx = presets.findIndex((p) => normalizeArtistStringValue(p.value) === norm)
  if (existingIdx >= 0) {
    const next = [...presets]
    next[existingIdx] = { ...next[existingIdx]!, label, value }
    return next
  }
  const row: UserArtistStringPreset = {
    id: `uasp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label,
    value,
  }
  return [row, ...presets].slice(0, MAX_USER_ARTIST_STRING_PRESETS)
}

export function removeUserArtistStringPreset(
  presets: UserArtistStringPreset[],
  id: string,
): UserArtistStringPreset[] {
  const target = id.trim()
  if (!target) return presets
  return presets.filter((p) => p.id !== target)
}
