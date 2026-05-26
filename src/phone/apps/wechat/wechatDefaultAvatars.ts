import { DEFAULT_PUBLIC_AVATAR_PATH, DEFAULT_PUBLIC_AVATAR_URL } from '../../types'
import { resolvePublicImageUrl } from '../../../publicAssetUrl'

const globModules = import.meta.glob('../../../../image/随机网友头像/*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const GLOB_POOL = Object.values(globModules).filter(Boolean)

const STATIC_POOL = [
  resolvePublicImageUrl(DEFAULT_PUBLIC_AVATAR_PATH),
  DEFAULT_PUBLIC_AVATAR_URL,
]

export function listWechatDefaultAvatarUrls(): string[] {
  if (GLOB_POOL.length > 0) return GLOB_POOL
  return STATIC_POOL
}

export function pickRandomWechatDefaultAvatar(): string {
  const pool = listWechatDefaultAvatarUrls()
  return pool[Math.floor(Math.random() * pool.length)] ?? DEFAULT_PUBLIC_AVATAR_URL
}

/** 注册页初始展示：规范路径（展示处需 resolvePublicImageUrl / resolveCharacterAvatarUrl） */
export function getDefaultWechatRegistrationAvatar(): string {
  return DEFAULT_PUBLIC_AVATAR_PATH
}

export function normalizeAvatarUrlInput(raw: string): string {
  return String(raw ?? '').trim()
}

export function isPlausibleAvatarUrl(url: string): boolean {
  const t = url.trim()
  if (!t) return false
  if (t.startsWith('data:image/')) return true
  return /^https?:\/\/.+/i.test(t)
}
