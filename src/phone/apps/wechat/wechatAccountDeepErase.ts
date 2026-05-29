import { WECHAT_USER_PROFILE_KV_KEY, WECHAT_USER_PROFILE_KV_KEY_LEGACY } from './wechatProfileTypes'

/** phoneKv / localStorage：深度注销时清理的键前缀（不含手机全局主题、API 配置等） */
export const WECHAT_ACCOUNT_DEEP_ERASE_KV_PREFIXES = [
  'wechat-',
  'wx-',
  'wx_',
  'lumi-meet-',
  'busy-conv:',
  'checkPhone.',
] as const

const WECHAT_ACCOUNT_DEEP_ERASE_KV_EXACT = [
  WECHAT_USER_PROFILE_KV_KEY,
  WECHAT_USER_PROFILE_KV_KEY_LEGACY,
  'wx_recent_forwards_v1',
  'lumi-lore-archive-v1',
] as const

/** 约会等模块曾写入 localStorage 的 legacy 键 */
const WECHAT_ACCOUNT_DEEP_ERASE_LOCAL_STORAGE_KEYS = [
  'wechat-dating-archives-v1',
  'wechat-dating-characters-v1',
  'wechat-sticker-center-v1',
  'lumi-lore-archive-v1',
  'anonymous-qna-v2',
  'anonymous-qna-directed-posts-v1',
] as const

export function shouldErasePhoneKvKeyForWeChatAccount(key: string): boolean {
  const k = key.trim()
  if (!k) return false
  if ((WECHAT_ACCOUNT_DEEP_ERASE_KV_EXACT as readonly string[]).includes(k)) return true
  if (k.startsWith('wx-pv-anchor-grp:')) return true
  if (k.startsWith('wx-grp-anchor-pv:')) return true
  return WECHAT_ACCOUNT_DEEP_ERASE_KV_PREFIXES.some((p) => k.startsWith(p))
}

export const WECHAT_ACCOUNT_DEEP_ERASED_EVENT = 'wechat-account-deep-erased'

export function emitWeChatAccountDeepErased(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(WECHAT_ACCOUNT_DEEP_ERASED_EVENT))
}

export function clearWeChatAccountLegacyLocalStorage(): void {
  if (typeof localStorage === 'undefined') return
  try {
    for (const k of WECHAT_ACCOUNT_DEEP_ERASE_LOCAL_STORAGE_KEYS) {
      localStorage.removeItem(k)
    }
  } catch {
    // ignore
  }
}
