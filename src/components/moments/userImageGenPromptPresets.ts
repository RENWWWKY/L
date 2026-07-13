import {
  normalizeUserArtistStringPresets,
  type UserArtistStringPreset,
} from './userArtistStringPresets'

export type UserImageGenPromptPreset = {
  id: string
  label: string
  positive: string
  negative: string
}

const MAX_USER_IMAGE_GEN_PROMPT_PRESETS = 32

export function normalizeUserImageGenPromptPresets(raw: unknown): UserImageGenPromptPreset[] {
  if (!Array.isArray(raw)) return []
  const out: UserImageGenPromptPreset[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const positive = String(row.positive ?? row.value ?? '').trim()
    const negative = String(row.negative ?? '').trim()
    if (!positive && !negative) continue
    const key = `${positive.toLowerCase()}|${negative.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    const label =
      String(row.label ?? '').trim() ||
      positive.slice(0, 20) ||
      negative.slice(0, 20) ||
      '未命名预设'
    const id =
      typeof row.id === 'string' && row.id.trim()
        ? row.id.trim()
        : `uigp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    out.push({ id, label, positive, negative })
    if (out.length >= MAX_USER_IMAGE_GEN_PROMPT_PRESETS) break
  }
  return out
}

/** 兼容旧版仅保存画师串 / 仅正面词的预设列表 */
export function migrateLegacyImageGenPromptPresets(raw: {
  savedImageGenPromptPresets?: unknown
  savedArtistStringPresets?: unknown
  savedExtraPositivePromptPresets?: unknown
}): UserImageGenPromptPreset[] {
  const unified = normalizeUserImageGenPromptPresets(raw.savedImageGenPromptPresets)
  if (unified.length) return unified

  const legacyPositive = [
    ...normalizeUserArtistStringPresets(raw.savedArtistStringPresets),
    ...normalizeUserArtistStringPresets(raw.savedExtraPositivePromptPresets),
  ]
  return normalizeUserImageGenPromptPresets(
    legacyPositive.map((p: UserArtistStringPreset) => ({
      id: p.id,
      label: p.label,
      positive: p.value,
      negative: '',
    })),
  )
}

export function upsertUserImageGenPromptPreset(
  presets: UserImageGenPromptPreset[],
  input: { label: string; positive: string; negative: string },
): UserImageGenPromptPreset[] {
  const positive = input.positive.trim()
  const negative = input.negative.trim()
  if (!positive && !negative) return presets
  const label = input.label.trim() || positive.slice(0, 20) || negative.slice(0, 20) || '未命名预设'
  const key = `${positive.toLowerCase()}|${negative.toLowerCase()}`
  const existingIdx = presets.findIndex(
    (p) => `${p.positive.trim().toLowerCase()}|${p.negative.trim().toLowerCase()}` === key,
  )
  if (existingIdx >= 0) {
    const next = [...presets]
    next[existingIdx] = { ...next[existingIdx]!, label, positive, negative }
    return next
  }
  const row: UserImageGenPromptPreset = {
    id: `uigp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label,
    positive,
    negative,
  }
  return [row, ...presets].slice(0, MAX_USER_IMAGE_GEN_PROMPT_PRESETS)
}

export function removeUserImageGenPromptPreset(
  presets: UserImageGenPromptPreset[],
  id: string,
): UserImageGenPromptPreset[] {
  const target = id.trim()
  if (!target) return presets
  return presets.filter((p) => p.id !== target)
}
