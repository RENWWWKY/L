import { personaDb } from './newFriendsPersona/idb'
import type { Character } from './newFriendsPersona/types'
import type { WeChatPersonaContact } from '../../types'
import type { UserAccount } from './wechatAccountTypes'
import { normalizeRegistryWechatId, resolveCanonicalCharacterId } from './wechatGlobalCharacterRegistry'

/** 当前微信账号「本人」标识：玩家身份 id、槽位 id、与账号相同的微信号等 */
export type WechatSelfContactExclusionContext = {
  accountWechatIdNorm: string
  blockedCharacterIds: Set<string>
}

export async function buildWechatSelfContactExclusionContext(
  account: UserAccount,
): Promise<WechatSelfContactExclusionContext> {
  const blockedCharacterIds = new Set<string>()

  const base = account.baseIdentityId?.trim()
  if (base) blockedCharacterIds.add(base)

  const session = account.sessionPlayerIdentityId?.trim()
  if (session) blockedCharacterIds.add(session)

  for (const row of await personaDb.listPlayerIdentities(account.accountId)) {
    const id = row.id?.trim()
    if (id) blockedCharacterIds.add(id)
  }

  return {
    accountWechatIdNorm: normalizeRegistryWechatId(account.wechatId),
    blockedCharacterIds,
  }
}

export function isCharacterUserAccountSelf(
  ch: Character,
  ctx: WechatSelfContactExclusionContext,
): boolean {
  if (ch.isPlayerIdentity) return true

  const cid = ch.id.trim()
  if (cid && ctx.blockedCharacterIds.has(cid)) return true

  const wx = normalizeRegistryWechatId(ch.wechatId || '')
  if (wx && ctx.accountWechatIdNorm && wx === ctx.accountWechatIdNorm) return true

  return false
}

export async function isPersonaContactUserAccountSelf(
  contact: Pick<WeChatPersonaContact, 'characterId'>,
  account: UserAccount,
  ctx?: WechatSelfContactExclusionContext,
): Promise<boolean> {
  const exclusion = ctx ?? (await buildWechatSelfContactExclusionContext(account))
  const rawId = contact.characterId.trim()
  if (!rawId) return false

  const canon = (await resolveCanonicalCharacterId(rawId)) || rawId
  if (exclusion.blockedCharacterIds.has(canon) || exclusion.blockedCharacterIds.has(rawId)) {
    return true
  }

  const ch = await personaDb.getCharacter(canon)
  if (!ch) return false
  return isCharacterUserAccountSelf(ch, exclusion)
}

/** 从通讯录条目剔除当前微信账号本人（玩家身份 / 同微信号人设 / 槽位 id）。 */
export async function excludeUserAccountFromPersonaContacts(
  contacts: readonly WeChatPersonaContact[],
  account: UserAccount,
  ctx?: WechatSelfContactExclusionContext,
): Promise<WeChatPersonaContact[]> {
  const exclusion = ctx ?? (await buildWechatSelfContactExclusionContext(account))
  const out: WeChatPersonaContact[] = []

  for (const c of contacts) {
    const rawId = c.characterId.trim()
    if (!rawId) continue

    const canon = (await resolveCanonicalCharacterId(rawId)) || rawId
    if (exclusion.blockedCharacterIds.has(canon) || exclusion.blockedCharacterIds.has(rawId)) {
      continue
    }

    const ch = await personaDb.getCharacter(canon)
    if (ch && isCharacterUserAccountSelf(ch, exclusion)) continue

    out.push(canon !== c.characterId ? { ...c, characterId: canon } : { ...c })
  }

  return out
}
