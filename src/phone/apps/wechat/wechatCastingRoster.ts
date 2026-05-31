import type { WeChatPersonaContact } from '../../types'
import { loadAccountsBundle } from './wechatAccountPersistence'
import { resolveCanonicalCharacterId } from './wechatGlobalCharacterRegistry'
import {
  excludeUserAccountFromPersonaContacts,
  filterPersonaContactsForWechatAccount,
  isWechatMultiAccountBundle,
} from './wechatPersonaContactsSync'

async function ingestCanonicalContactIds(
  contacts: readonly WeChatPersonaContact[],
  out: Set<string>,
): Promise<void> {
  for (const c of contacts) {
    const raw = c.characterId.trim()
    if (!raw) continue
    out.add((await resolveCanonicalCharacterId(raw)) || raw)
  }
}

/**
 * 声纹 Casting：汇总微信应用内**所有马甲**通讯录中的角色 canonical id（去重）。
 * 无 bundle 时回落到当前内存通讯录。
 */
export async function loadCanonicalCastingCharacterIds(
  fallbackInMemoryContacts: readonly WeChatPersonaContact[],
): Promise<Set<string>> {
  const canon = new Set<string>()
  const bundle = await loadAccountsBundle()

  if (!bundle?.accounts.length) {
    await ingestCanonicalContactIds(fallbackInMemoryContacts, canon)
    return canon
  }

  const primaryId = bundle.accounts[0]?.accountId

  if (isWechatMultiAccountBundle(bundle)) {
    for (const acc of bundle.accounts) {
      const filtered = await filterPersonaContactsForWechatAccount(acc.personaContacts, acc, primaryId)
      const scoped = await excludeUserAccountFromPersonaContacts(filtered, acc)
      await ingestCanonicalContactIds(scoped, canon)
    }
    return canon
  }

  const active =
    bundle.accounts.find((a) => a.accountId === bundle.currentAccountId.trim()) ?? bundle.accounts[0]
  if (!active) {
    await ingestCanonicalContactIds(fallbackInMemoryContacts, canon)
    return canon
  }

  const filtered = await filterPersonaContactsForWechatAccount(active.personaContacts, active, primaryId)
  const scoped = await excludeUserAccountFromPersonaContacts(filtered, active)
  await ingestCanonicalContactIds(scoped, canon)

  // 单账号：内存里刚写入、bundle 尚未落盘时，合并当前快照避免 Casting 短暂滞后
  await ingestCanonicalContactIds(fallbackInMemoryContacts, canon)
  return canon
}
