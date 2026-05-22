import { canonicalPublicImagePath, resolvePublicImageUrl } from '../../publicAssetUrl'
import { pickRandomWechatDefaultAvatar } from '../apps/wechat/wechatDefaultAvatars'

/** 微信头像等：仅解析 `avatarUrl`，不使用 MBTI 图 */
export function resolveCharacterAvatarUrl(params: { avatarUrl?: string | null }): string {
  const raw = params.avatarUrl?.trim() || ''
  if (!raw) return ''
  const canon = canonicalPublicImagePath(raw)
  if (canon.startsWith('/image/') || canon.startsWith('data:') || canon.startsWith('blob:')) {
    return resolvePublicImageUrl(canon)
  }
  if (/^https?:\/\//i.test(canon)) return canon
  if (raw.includes('/assets/') || /localhost|127\.0\.0\.1/i.test(raw)) {
    return pickRandomWechatDefaultAvatar()
  }
  return resolvePublicImageUrl(raw)
}

/** 人设包导入：修复不可移植的 Vite /assets 等，保留原微信头像路径 */
export function repairCharacterAvatarForBundleImport(ch: { avatarUrl?: string }): string {
  const raw = ch.avatarUrl?.trim() || ''
  const canon = canonicalPublicImagePath(raw)
  if (canon.startsWith('/image/') || canon.startsWith('data:') || canon.startsWith('blob:')) return canon
  if (/^https?:\/\//i.test(canon)) return canon
  const fallback = canonicalPublicImagePath(pickRandomWechatDefaultAvatar())
  return fallback.startsWith('/image/') ? fallback : ''
}
