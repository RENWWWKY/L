import { DEFAULT_PUBLIC_AVATAR_URL } from '../../types'
import { publicAssetUrl } from '../../../publicAssetUrl'

const globModules = import.meta.glob('../../../../image/随机网友头像/*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const GLOB_POOL = Object.values(globModules).filter(Boolean)

const STATIC_POOL = [
  DEFAULT_PUBLIC_AVATAR_URL,
  publicAssetUrl('/image/个人名片默认头像1.png'),
]

export function listWechatDefaultAvatarUrls(): string[] {
  if (GLOB_POOL.length > 0) return GLOB_POOL
  return STATIC_POOL
}

export function pickRandomWechatDefaultAvatar(): string {
  const pool = listWechatDefaultAvatarUrls()
  return pool[Math.floor(Math.random() * pool.length)] ?? DEFAULT_PUBLIC_AVATAR_URL
}

/** 注册页初始展示：固定默认头像（用户可本地上传或填 URL 覆盖） */
export function getDefaultWechatRegistrationAvatar(): string {
  return DEFAULT_PUBLIC_AVATAR_URL
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
