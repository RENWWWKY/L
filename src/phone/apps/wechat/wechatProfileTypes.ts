export interface WechatProfile {
  avatarUrl: string
  /** 必填：微信昵称 */
  nickname: string
  /** 必填：微信号（字母与数字） */
  wechatId: string
  /** 必填：登录密码（至少 6 位，字母与数字） */
  password: string
  gender?: 'male' | 'female' | 'hidden'
  signature?: string
}

/** 当前生效的微信身份 KV（仅完成注册页后写入；不自动迁移旧数据） */
export const WECHAT_USER_PROFILE_KV_KEY = 'wechat-user-profile-v2'

/** 上一版 KV，启动时清理以便老用户重新走注册（不触碰聊天 IndexedDB） */
export const WECHAT_USER_PROFILE_KV_KEY_LEGACY = 'wechat-user-profile-v1'

export function isWechatProfileComplete(profile: WechatProfile | null | undefined): boolean {
  if (!profile) return false
  return (
    profile.nickname.trim().length > 0 &&
    profile.wechatId.trim().length > 0 &&
    profile.avatarUrl.trim().length > 0 &&
    isWechatPasswordValid(profile.password)
  )
}

/** 密码输入：仅保留大小写字母与数字 */
export function normalizeWechatPasswordInput(raw: string): string {
  return String(raw ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 32)
}

export function isWechatPasswordValid(password: string): boolean {
  const t = password.trim()
  return t.length >= 6 && /^[a-zA-Z0-9]+$/.test(t)
}

export function wechatPasswordsMatch(password: string, confirm: string): boolean {
  return password.length > 0 && password === confirm
}

/** 微信号输入：仅保留字母与数字 */
export function normalizeWechatIdInput(raw: string): string {
  return String(raw ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 20)
}

export function isWechatIdValid(id: string): boolean {
  const t = id.trim()
  return t.length >= 4 && /^[a-zA-Z0-9]+$/.test(t)
}

export function mapWechatProfileGenderToCharacter(
  g: WechatProfile['gender'],
): 'male' | 'female' | 'other' {
  if (g === 'male') return 'male'
  if (g === 'female') return 'female'
  return 'other'
}

export function mapCharacterGenderToWechatProfile(
  g: 'male' | 'female' | 'other' | undefined,
): WechatProfile['gender'] {
  if (g === 'male') return 'male'
  if (g === 'female') return 'female'
  return 'hidden'
}

function normalizeGender(raw: unknown): WechatProfile['gender'] | undefined {
  if (raw === 'male' || raw === 'female' || raw === 'hidden') return raw
  return undefined
}

export function normalizeWechatProfile(raw: unknown): WechatProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const nickname = typeof o.nickname === 'string' ? o.nickname.trim() : ''
  const wechatId = typeof o.wechatId === 'string' ? normalizeWechatIdInput(o.wechatId) : ''
  const avatarUrl = typeof o.avatarUrl === 'string' ? o.avatarUrl.trim() : ''
  const password =
    typeof o.password === 'string' ? normalizeWechatPasswordInput(o.password) : ''
  if (!nickname && !wechatId && !avatarUrl && !password) return null
  return {
    avatarUrl,
    nickname,
    wechatId,
    password,
    gender: normalizeGender(o.gender),
    signature: typeof o.signature === 'string' ? o.signature.trim() : undefined,
  }
}
