import type { WeChatPersonaContact } from '../../types'
import { personaDb } from './newFriendsPersona/idb'
import { uid } from './newFriendsPersona/utils'
import {
  accountToProfile,
  normalizeAccountsBundle,
  normalizeUserAccount,
  profileToAccountDraft,
  WECHAT_ACCOUNTS_BUNDLE_KV_KEY,
  type UserAccount,
  type WechatAccountsBundle,
} from './wechatAccountTypes'
import {
  isWechatProfileComplete,
  normalizeWechatProfile,
  WECHAT_USER_PROFILE_KV_KEY,
  type WechatProfile,
} from './wechatProfileTypes'
import { migrateAllLegacyWeChatConversationsToAccountScope } from './wechatAccountPrivateChatStorage'
import { stampWechatAccountOwner } from './wechatAccountScope'
import type { PlayerIdentity } from './newFriendsPersona/types'

export async function loadAccountsBundle(): Promise<WechatAccountsBundle | null> {
  const raw = await personaDb.getPhoneKv(WECHAT_ACCOUNTS_BUNDLE_KV_KEY)
  return normalizeAccountsBundle(raw)
}

/** 是否为 bundle 中首个（主）马甲之外的其它微信号 */
export function isSecondaryWechatAccountInBundle(
  bundle: WechatAccountsBundle | null | undefined,
  wechatAccountId: string | null | undefined,
): boolean {
  const acc = wechatAccountId?.trim()
  if (!acc || !bundle || bundle.accounts.length <= 1) return false
  const primaryId = bundle.accounts[0]?.accountId?.trim()
  return !!primaryId && primaryId !== acc
}

export async function saveAccountsBundle(bundle: WechatAccountsBundle): Promise<void> {
  await personaDb.setPhoneKv(WECHAT_ACCOUNTS_BUNDLE_KV_KEY, bundle)
  const active = bundle.accounts.find((a) => a.accountId === bundle.currentAccountId)
  if (active) {
    await personaDb.setPhoneKv(WECHAT_USER_PROFILE_KV_KEY, accountToProfile(active))
  }
}

/**
 * 微信账号专用的会话隔离槽位 id（写入 currentIdentityId / conversationKey）。
 * 不调用 upsertPlayerIdentity，不会出现在「我的身份 / 身份创建」列表。
 */
export function allocateWechatAccountIdentitySlot(): string {
  return `wx-slot-${uid()}`
}

export async function migrateLegacyProfileToBundle(
  legacy: WechatProfile,
  personaContacts: WeChatPersonaContact[],
): Promise<WechatAccountsBundle> {
  const existing = await loadAccountsBundle()
  if (existing) return existing

  const baseIdentityId = allocateWechatAccountIdentitySlot()

  const account = profileToAccountDraft(legacy, baseIdentityId, personaContacts)
  const bundle: WechatAccountsBundle = {
    accounts: [account],
    currentAccountId: account.accountId,
  }
  await saveAccountsBundle(bundle)
  await attachOrphanPlayerIdentitiesToWechatAccount(account.accountId)
  await personaDb.setCurrentIdentityId(baseIdentityId)
  await personaDb.migrateWeChatDataFromNonePlayerIdentity(baseIdentityId)
  await migrateAllLegacyWeChatConversationsToAccountScope({
    wechatAccountId: account.accountId,
    appSessionPlayerIdentityId: baseIdentityId,
  })
  return bundle
}

/** 将无归属标记的历史身份挂到指定微信账号（仅补标，不复制） */
export async function attachOrphanPlayerIdentitiesToWechatAccount(wechatAccountId: string): Promise<void> {
  const acc = wechatAccountId.trim()
  if (!acc) return
  const all = await personaDb.listPlayerIdentities()
  for (const row of all) {
    if (row.wechatAccountId?.trim()) continue
    await personaDb.upsertPlayerIdentity(stampWechatAccountOwner(row as PlayerIdentity, acc))
  }
}

/** 将无归属标记的历史角色人设挂到指定微信账号（仅主账号启动时补标一次） */
export async function attachOrphanCharactersToWechatAccount(wechatAccountId: string): Promise<void> {
  await personaDb.attachOrphanCharactersToWechatAccount(wechatAccountId)
}

/** 多账号：按各马甲通讯录归属补标无 wechatAccountId 的旧人设；无引用时回落主账号 */
export async function attachOrphanCharactersByContactOwnership(bundle: WechatAccountsBundle): Promise<void> {
  await personaDb.attachOrphanCharactersByContactOwnership(bundle)
}

export function resolveAccountSessionIdentityId(account: UserAccount): string {
  return account.sessionPlayerIdentityId?.trim() || account.baseIdentityId.trim()
}

export function findAccountById(bundle: WechatAccountsBundle, accountId: string): UserAccount | null {
  return bundle.accounts.find((a) => a.accountId === accountId) ?? null
}

export function upsertAccountInBundle(
  bundle: WechatAccountsBundle,
  account: UserAccount,
): WechatAccountsBundle {
  const rest = bundle.accounts.filter((a) => a.accountId !== account.accountId)
  return {
    accounts: [...rest, account],
    currentAccountId: bundle.currentAccountId,
  }
}

export async function loadLegacyProfileOnly(): Promise<WechatProfile | null> {
  const raw = await personaDb.getPhoneKv(WECHAT_USER_PROFILE_KV_KEY)
  const normalized = normalizeWechatProfile(raw)
  if (normalized && isWechatProfileComplete(normalized)) return normalized
  return null
}

export function cloneAccount(account: UserAccount): UserAccount {
  return {
    ...account,
    personaContacts: account.personaContacts.map((c) => ({ ...c })),
  }
}

export function normalizeAccountList(raw: unknown): UserAccount[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeUserAccount).filter((a): a is UserAccount => !!a)
}
