import type { WeChatPersonaContact } from '../../types'
import { resolveCharacterAvatarUrl } from '../../utils/characterAvatarUrl'
import { personaDb, pullPhoneKvWithLocalStorageLegacy } from './newFriendsPersona/idb'
import type { Character } from './newFriendsPersona/types'
import { characterAccessibleToWechatAccount } from './wechatAccountScope'
import { cloneAccount } from './wechatAccountPersistence'
import type { UserAccount, WechatAccountsBundle } from './wechatAccountTypes'
import { WECHAT_LUMI_PEER_CHARACTER_ID } from './wechatConversationKey'
import { resolveCanonicalCharacterId } from './wechatGlobalCharacterRegistry'

export const PHONE_CUSTOMIZATION_KV_KEY = 'lumi-phone-custom-v3'

function normalizeWeChatPersonaContacts(v: unknown): WeChatPersonaContact[] {
  if (!Array.isArray(v)) return []
  const out: WeChatPersonaContact[] = []
  for (const it of v) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const characterId = typeof o.characterId === 'string' ? o.characterId.trim() : ''
    const remarkName = typeof o.remarkName === 'string' ? o.remarkName.trim() : ''
    const id =
      typeof o.id === 'string' && o.id.trim()
        ? o.id.trim()
        : characterId
          ? `persona-${characterId}`
          : ''
    const avatarUrl = typeof o.avatarUrl === 'string' ? o.avatarUrl.trim() : ''
    if (!characterId || !remarkName) continue
    out.push({
      id,
      characterId,
      remarkName: remarkName.slice(0, 64),
      avatarUrl: avatarUrl.length > 400_000 ? '' : avatarUrl || undefined,
      isStarred: typeof o.isStarred === 'boolean' ? o.isStarred : false,
    })
  }
  return out
}

/** 按 characterId 合并通讯录；后出现的条目可补全头像/星标/备注。 */
export function mergeWeChatPersonaContacts(
  primary: readonly WeChatPersonaContact[],
  ...extras: readonly (readonly WeChatPersonaContact[])[]
): WeChatPersonaContact[] {
  const byChar = new Map<string, WeChatPersonaContact>()
  const ingest = (list: readonly WeChatPersonaContact[]) => {
    for (const c of list) {
      const cid = c.characterId.trim()
      if (!cid) continue
      const prev = byChar.get(cid)
      if (!prev) {
        byChar.set(cid, { ...c, characterId: cid })
        continue
      }
      const pick =
        (!prev.avatarUrl && c.avatarUrl) ||
        (c.isStarred && !prev.isStarred) ||
        c.remarkName.length > prev.remarkName.length
          ? { ...prev, ...c, characterId: cid }
          : { ...c, ...prev, characterId: cid }
      byChar.set(cid, pick)
    }
  }
  ingest(primary)
  for (const list of extras) ingest(list)
  return [...byChar.values()]
}

export function personaContactsFingerprint(contacts: readonly WeChatPersonaContact[]): string {
  return [...contacts]
    .map((c) => `${c.characterId}\t${c.remarkName}\t${c.avatarUrl ?? ''}\t${c.isStarred ? 1 : 0}`)
    .sort()
    .join('\n')
}

export function personaContactsEqual(
  a: readonly WeChatPersonaContact[],
  b: readonly WeChatPersonaContact[],
): boolean {
  return personaContactsFingerprint(a) === personaContactsFingerprint(b)
}

/** 从手机外观 KV 读取通讯录（避免与 Customization 水合竞态）。 */
export async function loadCustomizationPersonaContactsFromKv(): Promise<WeChatPersonaContact[]> {
  try {
    const raw = await pullPhoneKvWithLocalStorageLegacy(PHONE_CUSTOMIZATION_KV_KEY, [
      PHONE_CUSTOMIZATION_KV_KEY,
      'lumi-phone-custom-v2',
      'lumi-phone-custom-v1',
    ])
    if (!raw || typeof raw !== 'object') return []
    return normalizeWeChatPersonaContacts((raw as { wechatPersonaContacts?: unknown }).wechatPersonaContacts)
  } catch {
    return []
  }
}

export function bundleWithAccountPersonaContacts(
  bundle: WechatAccountsBundle,
  accountId: string,
  contacts: WeChatPersonaContact[],
): WechatAccountsBundle {
  const snap = contacts.map((c) => ({ ...c }))
  return {
    ...bundle,
    accounts: bundle.accounts.map((a) =>
      a.accountId === accountId ? { ...cloneAccount(a), personaContacts: snap } : cloneAccount(a),
    ),
  }
}

export function defaultPersonaContactRemarkFromCharacter(ch: Character): string {
  return (ch.remark?.trim() || ch.wechatNickname?.trim() || ch.name || '未命名').slice(0, 64)
}

export function contactEntryFromCharacter(
  ch: Character,
  opts?: { remarkName?: string | null },
): WeChatPersonaContact {
  const cid = ch.id.trim()
  const userRemark = opts?.remarkName?.trim()
  const avatarCanon = ch.avatarUrl?.trim() || undefined
  return {
    id: `persona-${cid}`,
    characterId: cid,
    remarkName: userRemark ? userRemark.slice(0, 64) : defaultPersonaContactRemarkFromCharacter(ch),
    avatarUrl: avatarCanon,
    isStarred: !!ch.isStarred,
  }
}

/** 通讯录缺头像时从人设库补全（导入旧包后常见） */
export async function enrichPersonaContactsAvatarsFromCharacters(
  contacts: readonly WeChatPersonaContact[],
): Promise<WeChatPersonaContact[]> {
  const out: WeChatPersonaContact[] = []
  for (const c of contacts) {
    if (c.avatarUrl?.trim()) {
      out.push(c)
      continue
    }
    const ch = await personaDb.getCharacter(c.characterId)
    const avatarUrl = ch?.avatarUrl?.trim()
    out.push(avatarUrl ? { ...c, avatarUrl } : c)
  }
  return out
}

/** 展示用：解析通讯录条目的本地 / 远程头像 URL */
export function resolvePersonaContactAvatarForDisplay(
  contact: Pick<WeChatPersonaContact, 'avatarUrl'>,
  characterAvatarUrl?: string | null,
): string {
  return resolveCharacterAvatarUrl({
    avatarUrl: contact.avatarUrl?.trim() || characterAvatarUrl?.trim() || '',
  })
}

/** 加好友通过等场景：强制用本次写入的 remarkName 覆盖合并结果（避免 merge 因「较短」不更新）。 */
export function applyIncomingPersonaContactRemarkOverrides(
  merged: readonly WeChatPersonaContact[],
  incoming: readonly WeChatPersonaContact[],
): WeChatPersonaContact[] {
  const byChar = new Map<string, string>()
  for (const c of incoming) {
    const cid = c.characterId.trim()
    const rn = c.remarkName.trim()
    if (cid && rn) byChar.set(cid, rn.slice(0, 64))
  }
  if (!byChar.size) return merged.map((c) => ({ ...c }))
  return merged.map((c) => {
    const rn = byChar.get(c.characterId.trim())
    return rn ? { ...c, remarkName: rn } : { ...c }
  })
}

/**
 * 启动兜底：本身份下有私聊记录、但通讯录缺失的角色，从人设库补一条。
 */
export async function recoverPersonaContactsFromPrivateChats(params: {
  sessionPlayerIdentityIds: string[]
  wechatAccountId: string
  primaryWechatAccountId?: string | null
  existing: WeChatPersonaContact[]
}): Promise<WeChatPersonaContact[]> {
  const acc = params.wechatAccountId.trim()
  if (!acc) return params.existing

  const primary = params.primaryWechatAccountId?.trim() || acc
  const peerIds = await personaDb.listPrivateChatPeerCharacterIdsForWechatAccount(
    acc,
    params.sessionPlayerIdentityIds,
    { includeLegacyKeys: primary === acc },
  )
  if (!peerIds.length) return params.existing

  const linked = new Set<string>()
  for (const id of params.existing.map((c) => c.characterId)) {
    const canon = await resolveCanonicalCharacterId(id)
    if (canon) linked.add(canon)
  }

  const additions: WeChatPersonaContact[] = []
  for (const rawPeer of peerIds) {
    if (rawPeer === WECHAT_LUMI_PEER_CHARACTER_ID) continue
    const canon = (await resolveCanonicalCharacterId(rawPeer)) || rawPeer.trim()
    if (!canon || linked.has(canon)) continue
    const ch = await personaDb.getCharacter(canon)
    if (!ch || !characterAccessibleToWechatAccount(ch, acc, linked)) continue
    linked.add(canon)
    additions.push(contactEntryFromCharacter(ch))
  }

  if (!additions.length) return params.existing
  return mergeWeChatPersonaContacts(params.existing, additions)
}

export function isWechatMultiAccountBundle(bundle: WechatAccountsBundle): boolean {
  return bundle.accounts.length > 1
}

/** 多账号：清理各马甲 bundle 里误写入的其它号通讯录/人设引用。 */
export async function repairMultiAccountPersonaContactsBundle(
  bundle: WechatAccountsBundle,
): Promise<WechatAccountsBundle> {
  if (!isWechatMultiAccountBundle(bundle)) return bundle
  const primaryId = bundle.accounts[0]?.accountId
  let changed = false
  const accounts = await Promise.all(
    bundle.accounts.map(async (a) => {
      const filtered = await filterPersonaContactsToWechatAccount(a.personaContacts, a.accountId, primaryId)
      if (!personaContactsEqual(a.personaContacts, filtered)) changed = true
      return { ...cloneAccount(a), personaContacts: filtered }
    }),
  )
  return changed ? { ...bundle, accounts } : bundle
}

/**
 * 剔除归属其它微信马甲的人设；无 wechatAccountId 的孤儿仅保留在主账号通讯录。
 */
export async function filterPersonaContactsToWechatAccount(
  contacts: readonly WeChatPersonaContact[],
  wechatAccountId: string,
  primaryWechatAccountId?: string | null,
): Promise<WeChatPersonaContact[]> {
  const acc = wechatAccountId.trim()
  void primaryWechatAccountId
  if (!acc) return contacts.map((c) => ({ ...c }))

  const linkedCanon = new Set<string>()
  for (const c of contacts) {
    const cid = c.characterId.trim()
    if (!cid) continue
    linkedCanon.add((await resolveCanonicalCharacterId(cid)) || cid)
  }

  const out: WeChatPersonaContact[] = []
  for (const c of contacts) {
    const cid = c.characterId.trim()
    if (!cid) continue
    const canon = (await resolveCanonicalCharacterId(cid)) || cid
    const ch = await personaDb.getCharacter(canon)
    if (!ch) continue
    if (!characterAccessibleToWechatAccount(ch, acc, linkedCanon)) continue
    out.push({ ...c, characterId: canon })
  }
  return out
}

/** 合并 KV / 内存 / bundle，并写回指定账号的 personaContacts。 */
export async function reconcileAccountPersonaContacts(params: {
  bundle: WechatAccountsBundle
  account: UserAccount
  sessionPlayerIdentityId: string
  fromCustomizationKv?: WeChatPersonaContact[]
  fromInMemory?: WeChatPersonaContact[]
  recoverFromChats?: boolean
}): Promise<{ bundle: WechatAccountsBundle; contacts: WeChatPersonaContact[] }> {
  const multi = isWechatMultiAccountBundle(params.bundle)
  const primaryId = params.bundle.accounts[0]?.accountId

  let merged: WeChatPersonaContact[]
  if (multi) {
    merged = params.account.personaContacts.map((c) => ({ ...c }))
  } else {
    const kv = params.fromCustomizationKv ?? (await loadCustomizationPersonaContactsFromKv())
    const memory = params.fromInMemory ?? []
    merged = mergeWeChatPersonaContacts(params.account.personaContacts, kv, memory)
  }

  merged = await filterPersonaContactsToWechatAccount(merged, params.account.accountId, primaryId)

  if (params.recoverFromChats !== false) {
    const sessionIds = multi
      ? [params.sessionPlayerIdentityId.trim(), params.account.baseIdentityId.trim()].filter(
          (id, i, arr) => id && arr.indexOf(id) === i,
        )
      : [
          params.sessionPlayerIdentityId.trim(),
          params.account.baseIdentityId.trim(),
          '__none__',
        ].filter((id, i, arr) => id && arr.indexOf(id) === i)

    merged = await recoverPersonaContactsFromPrivateChats({
      sessionPlayerIdentityIds: sessionIds,
      wechatAccountId: params.account.accountId,
      primaryWechatAccountId: primaryId,
      existing: merged,
    })
  }

  merged = await enrichPersonaContactsAvatarsFromCharacters(merged)

  const nextBundle = bundleWithAccountPersonaContacts(params.bundle, params.account.accountId, merged)
  return { bundle: nextBundle, contacts: merged }
}
