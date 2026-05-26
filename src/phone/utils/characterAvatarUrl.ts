import { canonicalPublicImagePath, resolvePublicImageUrl } from '../../publicAssetUrl'
import { pickRandomWechatDefaultAvatar } from '../apps/wechat/wechatDefaultAvatars'
import { DEFAULT_PUBLIC_AVATAR_PATH } from '../types'

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

/** 个人资料展示（「我」、编辑资料预览等） */
export function resolveProfileAvatarPreviewUrl(avatarUrl?: string | null): string {
  const raw = avatarUrl?.trim() || DEFAULT_PUBLIC_AVATAR_PATH
  return (
    resolveCharacterAvatarUrl({ avatarUrl: raw }) ||
    resolveCharacterAvatarUrl({ avatarUrl: DEFAULT_PUBLIC_AVATAR_PATH })
  )
}

/** 保存个人资料头像：规范路径 / data URL，空则回默认 */
export function normalizeProfileAvatarForSave(raw: string): string {
  const t = raw.trim()
  if (!t) return DEFAULT_PUBLIC_AVATAR_PATH
  if (t.startsWith('data:') || t.startsWith('blob:')) return t
  const canon = canonicalPublicImagePath(t)
  if (canon) return canon
  if (/^https?:\/\//i.test(t)) return t
  return DEFAULT_PUBLIC_AVATAR_PATH
}

/** 通讯录 / 信息列表：优先联系人快照，回退人设库头像 */
export function resolveWeChatContactAvatarUrl(
  contactAvatarUrl?: string | null,
  characterAvatarUrl?: string | null,
): string {
  return resolveCharacterAvatarUrl({
    avatarUrl: contactAvatarUrl?.trim() || characterAvatarUrl?.trim() || '',
  })
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
