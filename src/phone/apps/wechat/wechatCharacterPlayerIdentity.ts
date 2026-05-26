import type { Character, PlayerIdentity, PlayerIdentityLinkMeta } from './newFriendsPersona/types'
import type { FriendRequestRow } from './newFriendsPersona/idb'
import { personaDb } from './newFriendsPersona/idb'
import {
  isSecondaryWechatAccountInBundle,
  loadAccountsBundle,
  resolveAccountSessionIdentityId,
} from './wechatAccountPersistence'
import { identityBelongsToWechatAccount } from './wechatAccountScope'
import { wechatAccountPrivateConversationKey } from './wechatConversationKey'

/** 微信马甲注册时分配的隔离槽位 id，不出现在「我的身份」列表，无展示名。 */
export function isWechatAccountSessionSlotIdentityId(id: string | null | undefined): boolean {
  const s = id?.trim()
  return !!s && s.startsWith('wx-slot-')
}

export function formatPlayerIdentityDisplayName(
  identity: Pick<PlayerIdentity, 'name' | 'wechatNickname'> | null | undefined,
  identityId?: string | null,
): string {
  const nick = identity?.wechatNickname?.trim()
  const name = identity?.name?.trim()
  if (nick || name) return nick || name || '未命名身份'
  if (isWechatAccountSessionSlotIdentityId(identityId)) return '微信账号槽位'
  return '未命名身份'
}

/** 角色列表「绑定身份」展示：含本号身份列表 + 各角色主/关联绑定（可跨号查档）。 */
export async function buildIdentityDisplayNameMapForCharacters(
  wechatAccountId: string,
  characters: Array<{
    playerIdentityId?: string
    linkedPlayerIdentityIds?: string[]
  }>,
): Promise<Record<string, string>> {
  const acc = wechatAccountId.trim()
  const map: Record<string, string> = {}
  if (acc) {
    for (const row of await personaDb.listPlayerIdentities(acc)) {
      const id = row.id?.trim()
      if (id) map[id] = formatPlayerIdentityDisplayName(row, id)
    }
  }
  const extra = new Set<string>()
  for (const c of characters) {
    const bid = c.playerIdentityId?.trim()
    if (bid && !map[bid]) extra.add(bid)
    for (const lid of getCharacterLinkedPlayerIdentityIds(c)) {
      if (!map[lid]) extra.add(lid)
    }
  }
  await Promise.all(
    [...extra].map(async (id) => {
      const row = await personaDb.getPlayerIdentity(id)
      map[id] = formatPlayerIdentityDisplayName(row, id)
    }),
  )
  return map
}

/** 当前会话扮演档 ≠ 角色档案主绑定（副绑定马甲线）。 */
export function isNonPrimaryBindingSession(
  character: { playerIdentityId?: string; linkedPlayerIdentityIds?: string[] } | null | undefined,
  sessionPlayerIdentityId: string | null | undefined,
): boolean {
  const primary = getCharacterBoundPlayerIdentityId(character)
  const session = sessionPlayerIdentityId?.trim()
  if (!primary || !session || session === '__none__') return false
  return session !== primary
}

/** 角色人设上「主」绑定玩家身份（跨马甲共享，首次加好友/人设绑定）。 */
export function getCharacterBoundPlayerIdentityId(
  character: { playerIdentityId?: string; linkedPlayerIdentityIds?: string[] } | null | undefined,
): string | null {
  const id = character?.playerIdentityId?.trim()
  if (!id || id === '__none__') return null
  return id
}

export { buildCharacterBoundIdentityReferenceForStrangerContact } from './wechatContactIdentityPrompt'

/** 主绑定 + 额外关联身份（多马甲/多扮演档）。 */
export function getCharacterLinkedPlayerIdentityIds(
  character: { playerIdentityId?: string; linkedPlayerIdentityIds?: string[] } | null | undefined,
): string[] {
  const out = new Set<string>()
  const primary = getCharacterBoundPlayerIdentityId(character)
  if (primary) out.add(primary)
  const extra = character?.linkedPlayerIdentityIds
  if (Array.isArray(extra)) {
    for (const raw of extra) {
      const id = typeof raw === 'string' ? raw.trim() : ''
      if (id && id !== '__none__') out.add(id)
    }
  }
  return [...out]
}

/**
 * 副绑定（UI / 分线）：仅保留与主绑定归属**不同微信账号**的扮演身份。
 * 同一微信号下的多个「我的身份」马甲不计入副绑定，绑定信息页只展示主绑定即可。
 */
export function getCharacterCrossAccountLinkedPlayerIdentityIds(
  character: {
    playerIdentityId?: string
    linkedPlayerIdentityIds?: string[]
    playerIdentityLinkMeta?: PlayerIdentityLinkMeta[]
  } | null | undefined,
  accountIdForIdentityId: (identityId: string) => string,
): string[] {
  const primary = getCharacterBoundPlayerIdentityId(character)
  if (!primary) return []
  const primaryAcc = accountIdForIdentityId(primary).trim()
  const candidates = getCharacterLinkedPlayerIdentityIds(character).filter((id) => id !== primary)
  if (!primaryAcc) {
    return candidates.filter((id) => {
      const acc = accountIdForIdentityId(id).trim()
      return !!acc
    })
  }
  return candidates.filter((id) => accountIdForIdentityId(id).trim() !== primaryAcc)
}

export function isPlayerIdentityLinkedToCharacter(
  character: { playerIdentityId?: string; linkedPlayerIdentityIds?: string[] } | null | undefined,
  playerIdentityId: string | null | undefined,
): boolean {
  const pid = playerIdentityId?.trim()
  if (!pid || pid === '__none__') return false
  return getCharacterLinkedPlayerIdentityIds(character).includes(pid)
}

/**
 * 私聊会话身份段（同步回退）：角色已主绑定身份时固定用该档；
 * 未绑定时才用当前 App 所选身份（新建身份不会覆盖既有角色绑定）。
 */
export function resolvePrivateChatSessionPlayerIdentityId(
  characterRow: { playerIdentityId?: string; linkedPlayerIdentityIds?: string[] } | null | undefined,
  appPlayerIdentityId: string | null | undefined,
): string {
  const bound = getCharacterBoundPlayerIdentityId(characterRow)
  if (bound) return bound
  const app = appPlayerIdentityId?.trim()
  if (app && app !== '__none__') return app
  return '__none__'
}

/**
 * 打开私聊/入账时解析会话身份：仅在**该角色主绑定 + 关联身份**中，
 * 选已有真实聊天记录（timestamp > 0）的档；无记录时回退主绑定，避免新建全局身份空仓抢线。
 */
export async function resolveActivePrivateChatSessionPlayerIdentityId(params: {
  characterId: string
  wechatAccountId: string | null | undefined
  appPlayerIdentityId: string | null | undefined
}): Promise<string> {
  const cid = params.characterId.trim()
  if (!cid) return '__none__'
  const app = params.appPlayerIdentityId?.trim() || '__none__'
  const acc = params.wechatAccountId?.trim()
  const ch = await personaDb.getCharacter(cid)
  const bound = getCharacterBoundPlayerIdentityId(ch)

  if (acc) {
    const candidates = new Set<string>()
    for (const lid of getCharacterLinkedPlayerIdentityIds(ch)) {
      if (!lid || lid === '__none__') continue
      const row = await personaDb.getPlayerIdentity(lid)
      if (row && !identityBelongsToWechatAccount(row, acc)) continue
      candidates.add(lid)
    }

    const fallbackSid = bound || (app !== '__none__' ? app : '__none__')
    let bestSid = fallbackSid
    let bestTs = -1
    for (const sid of candidates) {
      const key = wechatAccountPrivateConversationKey(acc, cid, sid)
      const recent = await personaDb.listWeChatChatMessagesRecent({ conversationKey: key, limit: 1 })
      const ts = recent[recent.length - 1]?.timestamp ?? 0
      if (ts > bestTs) {
        bestTs = ts
        bestSid = sid
      }
    }
    if (bestTs > 0 && bestSid && bestSid !== '__none__') return bestSid

    for (const sid of candidates) {
      if (!sid || sid === '__none__') continue
      const fr = await personaDb.getFriendRequestById(`fr-${sid}-${cid}`)
      if (fr && (fr.status === 'pending' || fr.status === 'accepted')) return sid
    }
  }

  return resolvePrivateChatSessionPlayerIdentityId(ch, app)
}

/** 用户主动加好友：使用表单所选身份，不因角色已有主绑定而强制改号。 */
export function resolveOutgoingFriendRequestPlayerIdentityId(
  _character: { playerIdentityId?: string } | null | undefined,
  selectedPlayerIdentityId: string | null | undefined,
): string {
  const sel = selectedPlayerIdentityId?.trim()
  if (sel && sel !== '__none__') return sel
  return ''
}

/** 私聊 AI 提示词用：优先会话身份，无绑定时回退主绑定。 */
export function resolvePrivateChatPromptPlayerIdentityId(
  character: { playerIdentityId?: string; linkedPlayerIdentityIds?: string[] } | null | undefined,
  appSessionPlayerIdentityId: string | null | undefined,
): string {
  const session = appSessionPlayerIdentityId?.trim()
  if (session && session !== '__none__') return session
  const bound = getCharacterBoundPlayerIdentityId(character)
  if (bound) return bound
  return '__none__'
}

export function playerIdentityBasicsFingerprint(identity: PlayerIdentity | null | undefined): string {
  if (!identity) return ''
  const parts = [
    identity.name?.trim(),
    identity.gender,
    identity.wechatNickname?.trim(),
    identity.birthdayMD?.trim(),
    identity.identity?.trim(),
    identity.mbti?.trim(),
  ]
  return parts.map((p) => (p ?? '').toLowerCase()).join('|')
}

export async function arePlayerIdentitiesBasicsEquivalent(
  identityIdA: string,
  identityIdB: string,
): Promise<boolean> {
  const a = identityIdA.trim()
  const b = identityIdB.trim()
  if (!a || !b || a === b) return a === b && a !== '__none__'
  const [rowA, rowB] = await Promise.all([personaDb.getPlayerIdentity(a), personaDb.getPlayerIdentity(b)])
  const fa = playerIdentityBasicsFingerprint(rowA)
  const fb = playerIdentityBasicsFingerprint(rowB)
  return !!fa && fa === fb
}

/**
 * 私聊发消息：小号 / 非主绑定档仅注入微信「我」页基础资料，不注入玩家身份世界书（与遇见转微信一致）。
 */
export async function shouldUseWechatHomeProfileOnlyForPrivateChat(params: {
  character: { playerIdentityId?: string; linkedPlayerIdentityIds?: string[] } | null | undefined
  sessionPlayerIdentityId: string
  /** 当前微信马甲；与主绑定身份归属马甲不一致时仅暴露「我」页资料 */
  wechatAccountId?: string | null
}): Promise<boolean> {
  const session = params.sessionPlayerIdentityId.trim()
  if (!session || session === '__none__') return false

  const primary = getCharacterBoundPlayerIdentityId(params.character)
  /** 副绑定/关联马甲线：一律只给微信「我」页，禁止注入该马甲完整身份卡（避免与主绑定混淆） */
  if (primary && session !== primary) {
    return true
  }

  const acc = params.wechatAccountId?.trim()
  const bundle = await loadAccountsBundle()
  if (isSecondaryWechatAccountInBundle(bundle, acc)) {
    if (primary) {
      const boundRow = await personaDb.getPlayerIdentity(primary)
      const boundAcc = boundRow?.wechatAccountId?.trim()
      if (!boundAcc || boundAcc !== acc) return true
    } else {
      return true
    }
  }

  if (primary && session === primary && acc) {
    const boundRow = await personaDb.getPlayerIdentity(primary)
    const boundAcc = boundRow?.wechatAccountId?.trim()
    if (boundAcc && boundAcc !== acc) return true
  }

  return false
}

function upsertPlayerIdentityLinkMeta(
  existing: PlayerIdentityLinkMeta[] | undefined,
  playerIdentityId: string,
  wechatAccountId: string,
): PlayerIdentityLinkMeta[] {
  const pid = playerIdentityId.trim()
  const acc = wechatAccountId.trim()
  if (!pid || !acc) return existing ?? []
  const meta = [...(existing ?? [])]
  const i = meta.findIndex((m) => m.playerIdentityId === pid)
  const row = { playerIdentityId: pid, wechatAccountId: acc }
  if (i >= 0) meta[i] = row
  else meta.push(row)
  return meta
}

/** 合并人设绑定：保留主绑定，将新身份写入 linked 列表，并记录归属微信账号。 */
export function mergeCharacterPlayerIdentityLink(
  existing: {
    playerIdentityId?: string
    linkedPlayerIdentityIds?: string[]
    playerIdentityLinkMeta?: PlayerIdentityLinkMeta[]
  } | null | undefined,
  linkIdentityId: string,
  linkWechatAccountId?: string | null,
): Pick<Character, 'playerIdentityId' | 'linkedPlayerIdentityIds' | 'playerIdentityLinkMeta'> {
  const link = linkIdentityId.trim()
  if (!link || link === '__none__') return {}
  const primary = getCharacterBoundPlayerIdentityId(existing)
  const linked = getCharacterLinkedPlayerIdentityIds(existing)
  const acc = linkWechatAccountId?.trim()
  let meta = existing?.playerIdentityLinkMeta
  if (acc) meta = upsertPlayerIdentityLinkMeta(meta, link, acc)
  if (!primary) {
    return {
      playerIdentityId: link,
      linkedPlayerIdentityIds: linked.filter((x) => x !== link),
      ...(meta?.length ? { playerIdentityLinkMeta: meta } : {}),
    }
  }
  if (linked.includes(link)) {
    return meta?.length ? { playerIdentityLinkMeta: meta } : {}
  }
  return {
    playerIdentityId: primary,
    linkedPlayerIdentityIds: [...linked, link],
    ...(meta?.length ? { playerIdentityLinkMeta: meta } : {}),
  }
}

/** 当前微信马甲可见的会话身份 id（槽位 + 本号「我的身份」列表）。 */
export async function collectWechatAccountPlayerIdentityIds(
  wechatAccountId: string | null | undefined,
): Promise<string[]> {
  const acc = wechatAccountId?.trim()
  const out = new Set<string>()
  if (acc) {
    for (const row of await personaDb.listPlayerIdentities(acc)) {
      const id = row.id?.trim()
      if (id && id !== '__none__') out.add(id)
    }
    const bundle = await loadAccountsBundle()
    const account = bundle?.accounts.find((a) => a.accountId === acc)
    if (account) {
      const slot = resolveAccountSessionIdentityId(account).trim()
      if (slot && slot !== '__none__') out.add(slot)
    }
  }
  const cur = (await personaDb.getCurrentIdentityId()).trim()
  if (cur && cur !== '__none__') out.add(cur)
  return [...out]
}

/** 「新的朋友」列表：按马甲下全部聊天身份聚合，避免小号申请记在大号身份下时列表为空。 */
export async function listFriendRequestsForWechatAccount(
  wechatAccountId: string | null | undefined,
  opts?: { pendingOnly?: boolean },
): Promise<FriendRequestRow[]> {
  const ids = await collectWechatAccountPlayerIdentityIds(wechatAccountId)
  return personaDb.listFriendRequestsForPlayerIdentityIds(ids, opts)
}

export async function linkCharacterPlayerIdentityBinding(
  characterId: string,
  playerIdentityId: string,
  linkWechatAccountId?: string | null,
): Promise<void> {
  const cid = characterId.trim()
  const link = playerIdentityId.trim()
  if (!cid || !link || link === '__none__') return
  const ch = await personaDb.getCharacter(cid)
  if (!ch) return
  const primary = getCharacterBoundPlayerIdentityId(ch)
  if (primary && (await arePlayerIdentitiesBasicsEquivalent(link, primary))) {
    return
  }
  let acc = linkWechatAccountId?.trim()
  if (!acc) {
    const row = await personaDb.getPlayerIdentity(link)
    acc = row?.wechatAccountId?.trim()
  }
  const patch = mergeCharacterPlayerIdentityLink(ch, link, acc)
  if (!Object.keys(patch).length) return
  await personaDb.upsertCharacter({ ...ch, ...patch, updatedAt: Date.now() })
}

function identityHasDisplayName(identity: Pick<PlayerIdentity, 'name' | 'wechatNickname'> | null | undefined): boolean {
  return !!(identity?.wechatNickname?.trim() || identity?.name?.trim())
}

/** 可用于世界书 {{user}} 绑定的具名扮演身份（非微信槽位、非空名）。 */
export function isNamedPlayerIdentity(
  identity: Pick<PlayerIdentity, 'name' | 'wechatNickname'> | null | undefined,
  identityId?: string | null,
): boolean {
  if (isWechatAccountSessionSlotIdentityId(identityId)) return false
  return identityHasDisplayName(identity)
}

/** 修复：主绑定误为 wx-slot，但 linked 里已有具名身份时，提升为主绑定（列表展示用）。 */
export async function repairCharacterSlotPrimaryBindingFromLinked(characterId: string): Promise<boolean> {
  const cid = characterId.trim()
  if (!cid) return false
  const ch = await personaDb.getCharacter(cid)
  if (!ch) return false
  const primary = getCharacterBoundPlayerIdentityId(ch)
  if (!isWechatAccountSessionSlotIdentityId(primary)) return false

  const bundle = await loadAccountsBundle()
  const primaryAccId = bundle?.accounts[0]?.accountId?.trim() || ''

  let promoteId: string | null = null
  for (const lid of getCharacterLinkedPlayerIdentityIds(ch)) {
    if (isWechatAccountSessionSlotIdentityId(lid)) continue
    const row = await personaDb.getPlayerIdentity(lid)
    if (!row || !identityHasDisplayName(row)) continue
    if (primaryAccId && identityBelongsToWechatAccount(row, primaryAccId)) {
      promoteId = lid
      break
    }
    if (!promoteId) promoteId = lid
  }
  if (!promoteId) return false

  const linked = getCharacterLinkedPlayerIdentityIds(ch)
    .filter((id) => id !== promoteId && !isWechatAccountSessionSlotIdentityId(id))
  if (primary && primary !== promoteId && !linked.includes(primary)) linked.push(primary)

  await personaDb.upsertCharacter({
    ...ch,
    playerIdentityId: promoteId,
    linkedPlayerIdentityIds: linked,
    updatedAt: Date.now(),
  })
  return true
}

/** 用户主动加好友通过后：将申请所选身份写入绑定；若当前主绑定仅为微信槽位或无展示名，则提升为本次所选身份。 */
export async function linkCharacterPlayerIdentityFromAcceptedFriendRequest(
  characterId: string,
  requestPlayerIdentityId: string,
  acceptWechatAccountId?: string | null,
): Promise<void> {
  const link = requestPlayerIdentityId.trim()
  if (!link || link === '__none__') return
  const ch = await personaDb.getCharacter(characterId.trim())
  if (!ch) return

  const primary = getCharacterBoundPlayerIdentityId(ch)
  const [primaryRow, linkRow] = await Promise.all([
    primary ? personaDb.getPlayerIdentity(primary) : Promise.resolve(null),
    personaDb.getPlayerIdentity(link),
  ])

  const bundle = await loadAccountsBundle()
  const linkAcc = linkRow?.wechatAccountId?.trim() || ''
  const secondaryAccept =
    !!bundle && !!linkAcc && isSecondaryWechatAccountInBundle(bundle, linkAcc)
  const primaryIsReal =
    !!primary &&
    !isWechatAccountSessionSlotIdentityId(primary) &&
    !!primaryRow &&
    identityHasDisplayName(primaryRow)

  const acceptAcc = acceptWechatAccountId?.trim() || linkAcc

  if (secondaryAccept && primaryIsReal) {
    await linkCharacterPlayerIdentityBinding(characterId, link, acceptAcc)
    return
  }

  const mainAccId = bundle?.accounts[0]?.accountId?.trim() || ''
  if (mainAccId && linkAcc && linkAcc !== mainAccId && primaryIsReal) {
    await linkCharacterPlayerIdentityBinding(characterId, link, acceptAcc)
    return
  }

  const shouldPromoteToPrimary =
    !primary ||
    isWechatAccountSessionSlotIdentityId(primary) ||
    !primaryRow ||
    (!identityHasDisplayName(primaryRow) && identityHasDisplayName(linkRow))

  if (!shouldPromoteToPrimary) {
    await linkCharacterPlayerIdentityBinding(characterId, link, acceptAcc)
    return
  }

  const linked = getCharacterLinkedPlayerIdentityIds(ch)
    .filter((id) => id !== link && !isWechatAccountSessionSlotIdentityId(id))
  if (primary && primary !== link && !isWechatAccountSessionSlotIdentityId(primary) && !linked.includes(primary)) {
    linked.push(primary)
  }

  let meta = ch.playerIdentityLinkMeta
  if (acceptAcc) meta = upsertPlayerIdentityLinkMeta(meta, link, acceptAcc)
  if (primary && acceptAcc) {
    const primaryAcc = (await personaDb.getPlayerIdentity(primary))?.wechatAccountId?.trim()
    if (primaryAcc) meta = upsertPlayerIdentityLinkMeta(meta, primary, primaryAcc)
  }

  await personaDb.upsertCharacter({
    ...ch,
    playerIdentityId: link,
    linkedPlayerIdentityIds: linked,
    ...(meta?.length ? { playerIdentityLinkMeta: meta } : {}),
    updatedAt: Date.now(),
  })
}

/** 从各马甲档案补全 playerIdentityLinkMeta（旧存档迁移）。 */
export async function backfillCharacterPlayerIdentityLinkMeta(characterId: string): Promise<boolean> {
  const cid = characterId.trim()
  if (!cid) return false
  const ch = await personaDb.getCharacter(cid)
  if (!ch) return false
  const ids = new Set<string>()
  const primary = getCharacterBoundPlayerIdentityId(ch)
  if (primary) ids.add(primary)
  for (const lid of getCharacterLinkedPlayerIdentityIds(ch)) ids.add(lid)
  let meta = ch.playerIdentityLinkMeta
  let changed = false
  for (const pid of ids) {
    if (meta?.some((m) => m.playerIdentityId === pid)) continue
    const row = await personaDb.getPlayerIdentity(pid)
    const acc = row?.wechatAccountId?.trim()
    if (!acc) continue
    meta = upsertPlayerIdentityLinkMeta(meta, pid, acc)
    changed = true
  }
  if (!changed) return false
  await personaDb.upsertCharacter({
    ...ch,
    playerIdentityLinkMeta: meta,
    updatedAt: Date.now(),
  })
  return true
}

/** upsert 时保留主绑定；若传入新身份则并入 linked，不覆盖主档。 */
export function preserveCharacterBoundPlayerIdentity<T extends {
  playerIdentityId?: string
  linkedPlayerIdentityIds?: string[]
}>(
  existing: { playerIdentityId?: string; linkedPlayerIdentityIds?: string[] } | null | undefined,
  next: T,
): T {
  const bound = getCharacterBoundPlayerIdentityId(existing)
  if (!bound) return next
  const incoming = next.playerIdentityId?.trim()
  if (!incoming || incoming === '__none__' || incoming === bound) {
    return { ...next, playerIdentityId: bound }
  }
  const linked = getCharacterLinkedPlayerIdentityIds(existing)
  const nextLinked = linked.includes(incoming) ? linked : [...linked, incoming]
  return {
    ...next,
    playerIdentityId: bound,
    linkedPlayerIdentityIds: nextLinked.filter((id) => id !== bound),
  }
}
