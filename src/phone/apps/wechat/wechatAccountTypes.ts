import type { WeChatPersonaContact } from '../../types'
import {
  isWechatProfileComplete,
  normalizeWechatProfile,
  type WechatProfile,
} from './wechatProfileTypes'

export interface UserAccount {
  accountId: string
  wechatId: string
  nickname: string
  avatarUrl: string
  password: string
  gender?: WechatProfile['gender']
  signature?: string
  /** 绑定的底层玩家身份 / 世界书 */
  baseIdentityId: string
  /** 本账号在「我的身份」中选用的玩家身份 id（会话/聊天隔离指针） */
  sessionPlayerIdentityId?: string
  lastActive: number
  personaContacts: WeChatPersonaContact[]
}

export type WechatAccountsBundle = {
  accounts: UserAccount[]
  currentAccountId: string
}

export const WECHAT_ACCOUNTS_BUNDLE_KV_KEY = 'wechat-accounts-bundle-v1'

export function accountToProfile(account: UserAccount): WechatProfile {
  return {
    avatarUrl: account.avatarUrl,
    nickname: account.nickname,
    wechatId: account.wechatId,
    password: account.password,
    gender: account.gender,
    signature: account.signature,
  }
}

export function profileToAccountDraft(
  profile: WechatProfile,
  baseIdentityId: string,
  personaContacts: WeChatPersonaContact[] = [],
): UserAccount {
  const normalized = normalizeWechatProfile(profile)
  if (!normalized || !isWechatProfileComplete(normalized)) {
    throw new Error('incomplete wechat profile')
  }
  return {
    accountId: `wx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    wechatId: normalized.wechatId,
    nickname: normalized.nickname,
    avatarUrl: normalized.avatarUrl,
    password: normalized.password,
    gender: normalized.gender,
    signature: normalized.signature,
    baseIdentityId,
    sessionPlayerIdentityId: undefined,
    lastActive: Date.now(),
    personaContacts,
  }
}

export function normalizeUserAccount(raw: unknown): UserAccount | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const profile = normalizeWechatProfile({
    avatarUrl: o.avatarUrl,
    nickname: o.nickname,
    wechatId: o.wechatId,
    password: o.password,
    gender: o.gender,
    signature: o.signature,
  })
  if (!profile || !isWechatProfileComplete(profile)) return null
  const accountId = typeof o.accountId === 'string' ? o.accountId.trim() : ''
  const baseIdentityId = typeof o.baseIdentityId === 'string' ? o.baseIdentityId.trim() : ''
  if (!accountId || !baseIdentityId) return null
  const lastActive = typeof o.lastActive === 'number' && Number.isFinite(o.lastActive) ? o.lastActive : Date.now()
  const sessionPlayerIdentityId =
    typeof o.sessionPlayerIdentityId === 'string' && o.sessionPlayerIdentityId.trim()
      ? o.sessionPlayerIdentityId.trim()
      : undefined
  const personaContacts = Array.isArray(o.personaContacts)
    ? (o.personaContacts as WeChatPersonaContact[]).filter(
        (c) => c && typeof c.characterId === 'string' && typeof c.remarkName === 'string',
      )
    : []
  return {
    accountId,
    ...profile,
    baseIdentityId,
    sessionPlayerIdentityId,
    lastActive,
    personaContacts,
  }
}

export function normalizeAccountsBundle(raw: unknown): WechatAccountsBundle | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const accountsRaw = Array.isArray(o.accounts) ? o.accounts : []
  const accounts = accountsRaw.map(normalizeUserAccount).filter((a): a is UserAccount => !!a)
  if (!accounts.length) return null
  const currentAccountId = typeof o.currentAccountId === 'string' ? o.currentAccountId.trim() : ''
  const current = accounts.find((a) => a.accountId === currentAccountId)?.accountId ?? accounts[0]!.accountId
  return { accounts, currentAccountId: current }
}
