import { personaDb } from '../wechat/newFriendsPersona/idb'
import {
  isWechatProfileComplete,
  normalizeWechatProfile,
  WECHAT_USER_PROFILE_KV_KEY,
} from '../wechat/wechatProfileTypes'
import { normalizeAccountsBundle, WECHAT_ACCOUNTS_BUNDLE_KV_KEY } from '../wechat/wechatAccountTypes'

/** 遇见「联络绑定」可选的微信账号（来自主微信多账号 bundle 或单账号 legacy） */
export type MeetWechatAccountOption = {
  /** 稳定主键（bundle 内 accountId） */
  key: string
  /** 与 playerIdentity.wechatAccountId 对齐，用于按号拉取身份列表 */
  accountId: string
  wechatId: string
  nickname: string
  avatarUrl: string
}

/** 从主微信已注册账号拉取可选列表 */
export async function listMeetSelectableWechatAccounts(): Promise<MeetWechatAccountOption[]> {
  const bundleRaw = await personaDb.getPhoneKv(WECHAT_ACCOUNTS_BUNDLE_KV_KEY)
  const bundle = normalizeAccountsBundle(bundleRaw)
  if (bundle?.accounts.length) {
    return bundle.accounts.map((a) => ({
      key: a.accountId,
      accountId: a.accountId,
      wechatId: a.wechatId.trim(),
      nickname: a.nickname.trim() || '微信用户',
      avatarUrl: a.avatarUrl.trim(),
    }))
  }

  const raw = await personaDb.getPhoneKv(WECHAT_USER_PROFILE_KV_KEY)
  const profile = normalizeWechatProfile(raw)
  if (!profile || !isWechatProfileComplete(profile)) return []
  const wechatId = profile.wechatId.trim()
  return [
    {
      key: wechatId,
      accountId: '',
      wechatId,
      nickname: profile.nickname.trim() || '微信用户',
      avatarUrl: profile.avatarUrl.trim(),
    },
  ]
}

export function findMeetWechatAccount(
  accounts: MeetWechatAccountOption[],
  wechatId: string | undefined | null,
): MeetWechatAccountOption | null {
  const id = wechatId?.trim() ?? ''
  if (!id) return null
  return accounts.find((a) => a.wechatId === id) ?? null
}
