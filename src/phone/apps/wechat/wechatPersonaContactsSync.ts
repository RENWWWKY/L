import type { WeChatPersonaContact } from '../../types'
import { resolveCharacterAvatarUrl } from '../../utils/characterAvatarUrl'
import { countWeChatPersonaCoreStoreRecords } from '../dataArchive/scanWeChatPersonaIndexedDb'
import { personaDb, pullPhoneKvWithLocalStorageLegacy } from './newFriendsPersona/idb'
import type { Character } from './newFriendsPersona/types'
import { characterBelongsToWechatAccount } from './wechatAccountScope'
import { cloneAccount, findAccountById, loadAccountsBundle, resolveAccountSessionIdentityId } from './wechatAccountPersistence'
import type { UserAccount, WechatAccountsBundle } from './wechatAccountTypes'
import { resolveCanonicalCharacterId } from './wechatGlobalCharacterRegistry'
import {
  excludeUserAccountFromPersonaContacts,
} from './wechatPersonaContactsSelfFilter'

export { excludeUserAccountFromPersonaContacts } from './wechatPersonaContactsSelfFilter'

export const PHONE_CUSTOMIZATION_KV_KEY = 'lumi-phone-custom-v4'

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

/** 内存通讯录是 bundle 通讯录的真子集 → 用户主动删除过联系人，修复时勿从 bundle 回填。 */
export function memoryContactsReflectUserRemovalFrom(
  memory: readonly WeChatPersonaContact[],
  bundleContacts: readonly WeChatPersonaContact[],
): boolean {
  const bundleIds = new Set(bundleContacts.map((c) => c.characterId.trim()).filter(Boolean))
  const memoryIds = memory.map((c) => c.characterId.trim()).filter(Boolean)
  if (memoryIds.length > bundleIds.size) return false
  if (!memoryIds.every((id) => bundleIds.has(id))) return false
  return memoryIds.length < bundleIds.size
}

/** 从手机外观 KV 读取通讯录（避免与 Customization 水合竞态）。 */
export async function loadCustomizationPersonaContactsFromKv(): Promise<WeChatPersonaContact[]> {
  try {
    const raw = await pullPhoneKvWithLocalStorageLegacy(PHONE_CUSTOMIZATION_KV_KEY, [
      PHONE_CUSTOMIZATION_KV_KEY,
      'lumi-phone-custom-v3',
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

export function isCharacterInPersonaContacts(
  contacts: readonly WeChatPersonaContact[],
  characterId: string,
): boolean {
  const id = characterId.trim()
  if (!id) return false
  return contacts.some((c) => c.characterId.trim() === id)
}

export type PersonaContactSyncPromptCopy = {
  title: string
  message: string
  confirmText: string
}

/** 人设保存后询问是否同步/加入通讯录的文案 */
export function personaContactSyncPromptCopy(
  inContacts: boolean,
  isNpc: boolean,
): PersonaContactSyncPromptCopy {
  if (inContacts) {
    return {
      title: '同步到通讯录？',
      message: '该角色已在微信通讯录中。是否用当前人设资料（头像、备注名等）更新通讯录展示？',
      confirmText: '同步更新',
    }
  }
  return {
    title: '加入通讯录？',
    message: isNpc
      ? '该角色尚未加入微信通讯录。是否将当前角色单独加入通讯录？（批量加入主角与全部 NPC 请在列表页点击「生成微信通讯录联系人」）'
      : '该角色尚未加入微信通讯录。是否现在加入并展示当前头像与备注名？（一并加入人脉 NPC 请在列表页点击「生成微信通讯录联系人」）',
    confirmText: '加入通讯录',
  }
}

/** 马甲隔离 + 剔除当前微信账号本人。 */
export async function filterPersonaContactsForWechatAccount(
  contacts: readonly WeChatPersonaContact[],
  account: UserAccount,
  primaryWechatAccountId?: string | null,
): Promise<WeChatPersonaContact[]> {
  const scoped = await filterPersonaContactsToWechatAccount(
    contacts,
    account.accountId,
    primaryWechatAccountId,
  )
  return excludeUserAccountFromPersonaContacts(scoped, account)
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
      const filtered = await filterPersonaContactsForWechatAccount(a.personaContacts, a, primaryId)
      if (!personaContactsEqual(a.personaContacts, filtered)) changed = true
      return { ...cloneAccount(a), personaContacts: filtered }
    }),
  )
  return changed ? { ...bundle, accounts } : bundle
}

/**
 * 剔除归属其它微信账号的人设；仅保留 wechatAccountId 与当前账号一致的角色。
 */
export async function filterPersonaContactsToWechatAccount(
  contacts: readonly WeChatPersonaContact[],
  wechatAccountId: string,
  primaryWechatAccountId?: string | null,
): Promise<WeChatPersonaContact[]> {
  const acc = wechatAccountId.trim()
  void primaryWechatAccountId
  if (!acc) return contacts.map((c) => ({ ...c }))

  const out: WeChatPersonaContact[] = []
  for (const c of contacts) {
    const cid = c.characterId.trim()
    if (!cid) continue
    const canon = (await resolveCanonicalCharacterId(cid)) || cid
    const ch = await personaDb.getCharacter(canon)
    if (!ch) continue
    if (!characterBelongsToWechatAccount(ch, acc)) continue
    out.push({ ...c, characterId: canon })
  }
  return out
}

/** 合并 KV / 内存 / bundle，并写回指定账号的 personaContacts（不自动从私聊或人设库补条目）。 */
export async function reconcileAccountPersonaContacts(params: {
  bundle: WechatAccountsBundle
  account: UserAccount
  sessionPlayerIdentityId: string
  fromCustomizationKv?: WeChatPersonaContact[]
  fromInMemory?: WeChatPersonaContact[]
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

  merged = await filterPersonaContactsForWechatAccount(merged, params.account, primaryId)
  merged = await enrichPersonaContactsAvatarsFromCharacters(merged)
  merged = await excludeUserAccountFromPersonaContacts(merged, params.account)

  const nextBundle = bundleWithAccountPersonaContacts(params.bundle, params.account.accountId, merged)
  return { bundle: nextBundle, contacts: merged }
}

/**
 * 切回前台 / 内存与 IndexedDB 不一致时：重读 bundle，合并已有通讯录快照。
 * 若 IndexedDB 核心表已空，则无法恢复聊天内容，仅能拉回 bundle 里残留的通讯录快照。
 * 不会从私聊或人设库自动补通讯录条目。
 */
export async function repairWeChatSessionPersistence(params: {
  bundle: WechatAccountsBundle | null
  activeAccountId: string
  inMemoryContacts: readonly WeChatPersonaContact[]
}): Promise<{
  bundle: WechatAccountsBundle
  contacts: WeChatPersonaContact[]
  repaired: boolean
}> {
  const accId = params.activeAccountId.trim()
  let bundle = (await loadAccountsBundle()) ?? params.bundle
  if (!bundle?.accounts.length) {
    return {
      bundle: bundle ?? { accounts: [], currentAccountId: '' },
      contacts: params.inMemoryContacts.map((c) => ({ ...c })),
      repaired: false,
    }
  }

  const active = findAccountById(bundle, bundle.currentAccountId.trim() || accId)
  if (!active) {
    return { bundle, contacts: params.inMemoryContacts.map((c) => ({ ...c })), repaired: false }
  }

  const memory = params.inMemoryContacts.map((c) => ({ ...c }))
  const core = await countWeChatPersonaCoreStoreRecords()
  const idbHasCore = core.characters > 0 || core.chatMessages > 0
  const bundleHasContacts = active.personaContacts.length > 0
  const primaryId = bundle.accounts[0]?.accountId
  const userRemovedSubset = memoryContactsReflectUserRemovalFrom(memory, active.personaContacts)

  if (userRemovedSubset) {
    const filtered = await filterPersonaContactsForWechatAccount(memory, active, primaryId)
    const scoped = await excludeUserAccountFromPersonaContacts(filtered, active)
    const nextBundle = bundleWithAccountPersonaContacts(bundle, active.accountId, scoped)
    if (personaContactsEqual(memory, scoped) && personaContactsEqual(active.personaContacts, scoped)) {
      return { bundle, contacts: scoped, repaired: false }
    }
    return { bundle: nextBundle, contacts: scoped, repaired: true }
  }

  if (!idbHasCore) {
    if (!memory.length && bundleHasContacts) {
      return { bundle, contacts: memory, repaired: false }
    }
    return { bundle, contacts: memory, repaired: false }
  }

  const sessionId = resolveAccountSessionIdentityId(active)
  const reconciled = await reconcileAccountPersonaContacts({
    bundle,
    account: active,
    sessionPlayerIdentityId: sessionId,
    fromInMemory: memory,
  })

  if (personaContactsEqual(memory, reconciled.contacts)) {
    return { bundle, contacts: memory, repaired: false }
  }

  return { bundle: reconciled.bundle, contacts: reconciled.contacts, repaired: true }
}

/** @deprecated 使用 {@link repairWeChatSessionPersistence} */
export async function recoverWeChatPersistenceAfterTabResume(params: {
  bundle: WechatAccountsBundle
  activeAccountId: string
}): Promise<{ bundle: WechatAccountsBundle; contacts: WeChatPersonaContact[]; didRecover: boolean }> {
  const r = await repairWeChatSessionPersistence({
    bundle: params.bundle,
    activeAccountId: params.activeAccountId,
    inMemoryContacts: [],
  })
  return { bundle: r.bundle, contacts: r.contacts, didRecover: r.repaired }
}
