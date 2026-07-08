import { resolveCharacterAvatarUrl } from '../../utils/characterAvatarUrl'
import type { Character, CharacterAppearanceRefImage, CharacterAppearanceRefKind } from './newFriendsPersona/types'

export const APPEARANCE_REF_IMAGES_MAX = 8
export const APPEARANCE_REF_NOTE_MAX = 500

export const APPEARANCE_REF_KIND_ORDER: CharacterAppearanceRefKind[] = [
  'face',
  'half',
  'side',
  'full',
  'other',
]

export const APPEARANCE_REF_KIND_LABELS: Record<CharacterAppearanceRefKind, string> = {
  face: '面部/大头',
  half: '半身',
  side: '侧面',
  full: '全身',
  other: '其他',
}

export const APPEARANCE_REF_KIND_PROMPT_LABELS: Record<CharacterAppearanceRefKind, string> = {
  face: 'face and head close-up',
  half: 'half-body portrait',
  side: 'side profile',
  full: 'full-body',
  other: 'additional view',
}

function newAppearanceRefId(): string {
  return `aref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function normalizeKind(raw: unknown): CharacterAppearanceRefKind {
  if (raw === 'face' || raw === 'half' || raw === 'full' || raw === 'side' || raw === 'other') return raw
  return 'other'
}

function normalizeEntry(raw: unknown): CharacterAppearanceRefImage | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const url = typeof o.url === 'string' ? o.url.trim() : ''
  if (!url) return null
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : newAppearanceRefId()
  const addedAt =
    typeof o.addedAt === 'number' && Number.isFinite(o.addedAt) ? Math.floor(o.addedAt) : Date.now()
  return {
    id,
    url,
    kind: normalizeKind(o.kind),
    addedAt,
  }
}

/** 读库：合并 legacy 单张 appearanceRefUrl，按类型排序 */
export function parseCharacterAppearanceRefImages(
  rawImages: unknown,
  legacyUrl?: string,
): CharacterAppearanceRefImage[] {
  const out: CharacterAppearanceRefImage[] = []
  const seen = new Set<string>()

  if (Array.isArray(rawImages)) {
    for (const row of rawImages) {
      const entry = normalizeEntry(row)
      if (!entry || seen.has(entry.url)) continue
      seen.add(entry.url)
      out.push(entry)
      if (out.length >= APPEARANCE_REF_IMAGES_MAX) break
    }
  }

  const legacy = legacyUrl?.trim()
  if (legacy && !seen.has(legacy)) {
    out.unshift({ id: newAppearanceRefId(), url: legacy, kind: 'face', addedAt: Date.now() })
  }

  return sortAppearanceRefImages(out).slice(0, APPEARANCE_REF_IMAGES_MAX)
}

export function sortAppearanceRefImages(
  images: CharacterAppearanceRefImage[],
): CharacterAppearanceRefImage[] {
  return [...images].sort((a, b) => {
    const ai = APPEARANCE_REF_KIND_ORDER.indexOf(a.kind)
    const bi = APPEARANCE_REF_KIND_ORDER.indexOf(b.kind)
    if (ai !== bi) return ai - bi
    return (a.addedAt ?? 0) - (b.addedAt ?? 0)
  })
}

export function getCharacterAppearanceRefImages(character: Character | null | undefined): CharacterAppearanceRefImage[] {
  if (!character) return []
  return parseCharacterAppearanceRefImages(character.appearanceRefImages, character.appearanceRefUrl)
}

export function resolveCharacterAppearanceRefUrls(character: Character | null | undefined): string[] {
  return getCharacterAppearanceRefImages(character)
    .map((item) => resolveCharacterAvatarUrl({ avatarUrl: item.url }) || item.url.trim())
    .filter(Boolean)
}

/** 写库：同步 legacy 单字段，便于旧逻辑/导出兼容 */
export function withAppearanceRefImagesSaved(
  character: Character,
  images: CharacterAppearanceRefImage[],
): Character {
  const sorted = sortAppearanceRefImages(images).slice(0, APPEARANCE_REF_IMAGES_MAX)
  const primary = sorted[0]?.url?.trim()
  return {
    ...character,
    appearanceRefImages: sorted.length ? sorted : undefined,
    appearanceRefUrl: primary || undefined,
    updatedAt: Date.now(),
  }
}

export function normalizeAppearanceRefNote(raw: unknown): string | undefined {
  const t = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : ''
  if (!t) return undefined
  return t.slice(0, APPEARANCE_REF_NOTE_MAX)
}

export function withAppearanceRefNoteSaved(character: Character, note: string): Character {
  const normalized = normalizeAppearanceRefNote(note)
  return {
    ...character,
    appearanceRefNote: normalized,
    updatedAt: Date.now(),
  }
}
