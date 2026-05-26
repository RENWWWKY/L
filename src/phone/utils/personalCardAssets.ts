import { canonicalPublicImagePath, resolvePublicImageUrl } from '../../publicAssetUrl'
import {
  DEFAULT_PERSONAL_CARD_BG_PATH,
  DEFAULT_PERSONAL_CARD_BG_URL,
} from '../types'

export function resolvePersonalCardBackgroundUrl(url?: string | null): string {
  const raw = url?.trim() || DEFAULT_PERSONAL_CARD_BG_PATH
  return resolvePublicImageUrl(raw) || DEFAULT_PERSONAL_CARD_BG_URL
}

export function normalizePersonalCardBackgroundForSave(raw: string): string {
  const t = raw.trim()
  if (!t) return DEFAULT_PERSONAL_CARD_BG_PATH
  if (t.startsWith('data:') || t.startsWith('blob:')) return t
  const canon = canonicalPublicImagePath(t)
  return canon || DEFAULT_PERSONAL_CARD_BG_PATH
}
