import { personaDb } from './newFriendsPersona/idb'
import { normalizeAccountsBundle, WECHAT_ACCOUNTS_BUNDLE_KV_KEY } from './wechatAccountTypes'
import { resolveAccountSessionIdentityId } from './wechatAccountPersistence'
import {
  arePlayerIdentitiesBasicsEquivalent,
  getCharacterBoundPlayerIdentityId,
  isWechatAccountSessionSlotIdentityId,
} from './wechatCharacterPlayerIdentity'
import {
  isWechatAccountGroupConversationKey,
  isWechatAccountPrivateConversationKey,
  isWechatGroupConversationKey,
  parseGroupIdFromConversationKey,
  parsePrivateWeChatConversationCharacterAndSession,
  parseWechatAccountGroupConversationKey,
  parseWechatAccountPrivateConversationKey,
  resolveGroupWeChatStorageConversationKey,
  resolvePrivateWeChatStorageConversationKey,
  wechatConversationKey,
} from './wechatConversationKey'

const LEGACY_GROUP_CONV_PREFIX = 'wxgrp:'

/** 把已写入错误马甲前缀的会话迁回身份归属微信号（修复切换马甲时的历史误迁移）。 */
async function repairMisplacedAccountScopedConversations(primaryWechatAccountId: string): Promise<number> {
  const primary = primaryWechatAccountId.trim()
  if (!primary) return 0
  const keys = await personaDb.listDistinctWeChatConversationKeysFromMessages()
  let total = 0

  for (const rawKey of keys) {
    const k = rawKey.trim()
    if (!k) continue

    const scopedPriv = parseWechatAccountPrivateConversationKey(k)
    if (scopedPriv) {
      const owner = await resolveLegacyConversationOwnerWechatAccountId(
        scopedPriv.sessionPlayerId,
        primary,
      )
      if (!owner || owner === scopedPriv.wechatAccountId) continue
      const target = resolvePrivateWeChatStorageConversationKey(
        scopedPriv.characterId,
        owner,
        scopedPriv.sessionPlayerId,
      )
      if (target === k) continue
      total += await personaDb.rekeyWeChatConversation({
        fromConversationKey: k,
        toConversationKey: target,
        sessionPlayerIdentityId: scopedPriv.sessionPlayerId,
      })
      continue
    }

    const scopedGrp = parseWechatAccountGroupConversationKey(k)
    if (scopedGrp) {
      const owner = await resolveLegacyConversationOwnerWechatAccountId(scopedGrp.sessionPlayerId, primary)
      if (!owner || owner === scopedGrp.wechatAccountId) continue
      const target = resolveGroupWeChatStorageConversationKey(
        scopedGrp.groupId,
        owner,
        scopedGrp.sessionPlayerId,
      )
      if (target === k) continue
      total += await personaDb.rekeyWeChatConversation({
        fromConversationKey: k,
        toConversationKey: target,
        sessionPlayerIdentityId: scopedGrp.sessionPlayerId,
      })
    }
  }

  return total
}

/**
 * 会话键里的 sessionPlayerId 归属哪个微信马甲。
 * wx-slot / baseIdentityId 须对照 bundle，禁止无脑回落主号（否则小号聊天记录会被迁到大号键下）。
 */
export async function resolveWechatAccountIdForSessionPlayerIdentity(
  sessionPlayerId: string,
  primaryWechatAccountId: string,
): Promise<string | null> {
  const primary = primaryWechatAccountId.trim()
  const pid = sessionPlayerId.trim() || '__none__'
  if (pid === '__none__') return primary || null

  const bundle = normalizeAccountsBundle(await personaDb.getPhoneKv(WECHAT_ACCOUNTS_BUNDLE_KV_KEY))
  if (bundle?.accounts.length) {
    for (const a of bundle.accounts) {
      const accId = a.accountId.trim()
      if (!accId) continue
      const session = resolveAccountSessionIdentityId(a)
      const base = a.baseIdentityId.trim()
      if (pid === session || pid === base || a.sessionPlayerIdentityId?.trim() === pid) {
        return accId
      }
    }
  }

  try {
    const row = await personaDb.getPlayerIdentity(pid)
    const owner = row?.wechatAccountId?.trim()
    if (owner) return owner
  } catch {
    /* ignore */
  }

  if (isWechatAccountSessionSlotIdentityId(pid)) return null
  return null
}

/** 无 `wxapriv:` 前缀的旧私聊/群聊键应迁入哪个微信马甲（按身份归属，避免切小号时搬走大号记录）。 */
async function resolveLegacyConversationOwnerWechatAccountId(
  sessionPlayerId: string,
  primaryWechatAccountId: string,
): Promise<string | null> {
  return resolveWechatAccountIdForSessionPlayerIdentity(sessionPlayerId, primaryWechatAccountId)
}

function parseLegacyGroupConversationSession(conversationKey: string): {
  groupId: string
  sessionPlayerId: string
} | null {
  const k = conversationKey.trim()
  if (!k.startsWith(LEGACY_GROUP_CONV_PREFIX) || isWechatAccountGroupConversationKey(k)) return null
  const rest = k.slice(LEGACY_GROUP_CONV_PREFIX.length)
  const idx = rest.lastIndexOf('::')
  if (idx <= 0) return null
  const groupId = rest.slice(0, idx).trim()
  const sessionPlayerId = (rest.slice(idx + 2).trim() || '__none__').trim()
  if (!groupId) return null
  return { groupId, sessionPlayerId }
}

/** 是否允许把档案主绑定档的旧会话键并入当前 pid（同一人重复档 / 同 id），禁止因 linked 马甲合并。 */
async function mayMergeBoundSessionIntoPid(
  bound: string | null,
  pid: string,
  wechatAccountId: string,
): Promise<boolean> {
  if (!bound || bound === '__none__' || !pid || pid === '__none__') return false
  if (bound === pid) return true
  if (!(await arePlayerIdentitiesBasicsEquivalent(bound, pid))) return false
  const acc = wechatAccountId.trim()
  if (!acc) return false
  const [boundOwner, pidOwner] = await Promise.all([
    resolveWechatAccountIdForSessionPlayerIdentity(bound, acc),
    resolveWechatAccountIdForSessionPlayerIdentity(pid, acc),
  ])
  return boundOwner === acc && pidOwner === acc
}

/** 无马甲前缀的旧键只允许迁入其 session 身份归属的微信账号，禁止跨号搬走。 */
async function legacyPrivateKeyOwnedByWechatAccount(
  legacyKey: string,
  wechatAccountId: string,
): Promise<boolean> {
  const acc = wechatAccountId.trim()
  if (!acc) return false
  const parsed = parsePrivateWeChatConversationCharacterAndSession(legacyKey)
  if (!parsed) return false
  const owner = await resolveWechatAccountIdForSessionPlayerIdentity(parsed.sessionPlayerId, acc)
  return owner === acc
}

/** 将旧版（无马甲前缀 / 误用全局绑定身份）私聊会话迁入当前微信账号隔离键。 */
export async function ensureAccountScopedPrivateConversation(params: {
  wechatAccountId: string
  characterId: string
  appSessionPlayerIdentityId: string
}): Promise<string> {
  const acc = params.wechatAccountId.trim()
  const cid = params.characterId.trim()
  const pid = params.appSessionPlayerIdentityId.trim() || '__none__'
  if (!acc || !cid) {
    return wechatConversationKey(cid, pid)
  }

  const newKey = resolvePrivateWeChatStorageConversationKey(cid, acc, pid)
  const ch = await personaDb.getCharacter(cid)
  const bound = getCharacterBoundPlayerIdentityId(ch)
  const mergeBound = await mayMergeBoundSessionIntoPid(bound, pid, acc)

  const legacyKeys = new Set<string>()
  const legacySession = wechatConversationKey(cid, pid)
  if (legacySession !== newKey) legacyKeys.add(legacySession)
  if (bound && bound !== pid && mergeBound) {
    legacyKeys.add(wechatConversationKey(cid, bound))
  }

  for (const oldKey of legacyKeys) {
    if (isWechatAccountPrivateConversationKey(oldKey)) continue
    if (!(await legacyPrivateKeyOwnedByWechatAccount(oldKey, acc))) continue
    await personaDb.rekeyWeChatConversation({
      fromConversationKey: oldKey,
      toConversationKey: newKey,
      sessionPlayerIdentityId: pid,
    })
  }

  // 同马甲、同角色：仅合并 __none__ 或未选身份残留；不同 linked 马甲会话键互不相并
  const scopedKeys = await personaDb.listDistinctWeChatConversationKeysFromMessages()
  for (const k of scopedKeys) {
    const parsed = parseWechatAccountPrivateConversationKey(k)
    if (!parsed || parsed.wechatAccountId !== acc || parsed.characterId !== cid) continue
    if (parsed.sessionPlayerId === pid) continue
    const other = parsed.sessionPlayerId
    const mergeOther =
      other === '__none__' || (other === pid) || (!!bound && other === bound && mergeBound)
    if (!mergeOther) continue
    await personaDb.rekeyWeChatConversation({
      fromConversationKey: k,
      toConversationKey: newKey,
      sessionPlayerIdentityId: pid,
    })
  }

  return newKey
}

/** 群聊会话按马甲隔离（与私聊一致，避免同 playerIdentity 段串线）。 */
export async function ensureAccountScopedGroupConversation(params: {
  wechatAccountId: string
  groupId: string
  appSessionPlayerIdentityId: string
}): Promise<string> {
  const acc = params.wechatAccountId.trim()
  const gid = params.groupId.trim()
  const pid = params.appSessionPlayerIdentityId.trim() || '__none__'
  if (!acc || !gid) {
    return resolveGroupWeChatStorageConversationKey(gid, null, pid)
  }

  const newKey = resolveGroupWeChatStorageConversationKey(gid, acc, pid)
  const oldPlain = `wxgrp:${gid}::${pid}`
  if (oldPlain !== newKey) {
    await personaDb.rekeyWeChatConversation({
      fromConversationKey: oldPlain,
      toConversationKey: newKey,
      sessionPlayerIdentityId: pid,
    })
  }

  const scopedKeys = await personaDb.listDistinctWeChatConversationKeysFromMessages()
  for (const k of scopedKeys) {
    const parsed = parseWechatAccountGroupConversationKey(k)
    if (!parsed || parsed.wechatAccountId !== acc || parsed.groupId !== gid) continue
    if (parsed.sessionPlayerId === pid) continue
    await personaDb.rekeyWeChatConversation({
      fromConversationKey: k,
      toConversationKey: newKey,
      sessionPlayerIdentityId: pid,
    })
  }

  return newKey
}

/**
 * 切换马甲时：仅把**归属当前微信号**且仍为旧格式的会话键迁入 `wxapriv:` / `wxagrp:`。
 * 必须保留键内的 sessionPlayerId，禁止合并到「当前槽位身份」，否则大号/小号记录会串线或丢失。
 */
export async function migrateAllLegacyWeChatConversationsToAccountScope(params: {
  wechatAccountId: string
  appSessionPlayerIdentityId: string
}): Promise<number> {
  const acc = params.wechatAccountId.trim()
  const sessionPid = params.appSessionPlayerIdentityId.trim()
  if (!acc || !sessionPid || sessionPid === '__none__') return 0

  const bundle = normalizeAccountsBundle(await personaDb.getPhoneKv(WECHAT_ACCOUNTS_BUNDLE_KV_KEY))
  const primaryAcc = bundle?.accounts[0]?.accountId?.trim() || acc

  let total = await repairMisplacedAccountScopedConversations(primaryAcc)

  const keys = await personaDb.listDistinctWeChatConversationKeysFromMessages()

  for (const rawKey of keys) {
    const k = rawKey.trim()
    if (!k) continue

    const scopedPriv = parseWechatAccountPrivateConversationKey(k)
    if (scopedPriv) {
      if (scopedPriv.wechatAccountId !== acc) continue
      const target = resolvePrivateWeChatStorageConversationKey(
        scopedPriv.characterId,
        acc,
        scopedPriv.sessionPlayerId,
      )
      if (target === k) continue
      total += await personaDb.rekeyWeChatConversation({
        fromConversationKey: k,
        toConversationKey: target,
        sessionPlayerIdentityId: scopedPriv.sessionPlayerId,
      })
      continue
    }

    const scopedGrp = parseWechatAccountGroupConversationKey(k)
    if (scopedGrp) {
      if (scopedGrp.wechatAccountId !== acc) continue
      const target = resolveGroupWeChatStorageConversationKey(
        scopedGrp.groupId,
        acc,
        scopedGrp.sessionPlayerId,
      )
      if (target === k) continue
      total += await personaDb.rekeyWeChatConversation({
        fromConversationKey: k,
        toConversationKey: target,
        sessionPlayerIdentityId: scopedGrp.sessionPlayerId,
      })
      continue
    }

    const legacyGrp = parseLegacyGroupConversationSession(k)
    if (legacyGrp) {
      const ownerAcc = await resolveLegacyConversationOwnerWechatAccountId(
        legacyGrp.sessionPlayerId,
        primaryAcc,
      )
      if (!ownerAcc || ownerAcc !== acc) continue
      const target = resolveGroupWeChatStorageConversationKey(
        legacyGrp.groupId,
        acc,
        legacyGrp.sessionPlayerId,
      )
      if (target === k) continue
      total += await personaDb.rekeyWeChatConversation({
        fromConversationKey: k,
        toConversationKey: target,
        sessionPlayerIdentityId: legacyGrp.sessionPlayerId,
      })
      continue
    }

    const priv = parsePrivateWeChatConversationCharacterAndSession(k)
    if (!priv) continue
    const ownerAcc = await resolveLegacyConversationOwnerWechatAccountId(priv.sessionPlayerId, primaryAcc)
    if (!ownerAcc || ownerAcc !== acc) continue
    const target = resolvePrivateWeChatStorageConversationKey(priv.characterId, acc, priv.sessionPlayerId)
    if (target === k) continue
    total += await personaDb.rekeyWeChatConversation({
      fromConversationKey: k,
      toConversationKey: target,
      sessionPlayerIdentityId: priv.sessionPlayerId,
    })
  }

  return total
}

export async function resolveAccountScopedPrivateConversationKey(params: {
  wechatAccountId: string | null | undefined
  characterId: string
  appSessionPlayerIdentityId: string
}): Promise<string> {
  const acc = params.wechatAccountId?.trim()
  const cid = params.characterId.trim()
  const pid = params.appSessionPlayerIdentityId.trim() || '__none__'
  if (acc && cid) {
    return ensureAccountScopedPrivateConversation({
      wechatAccountId: acc,
      characterId: cid,
      appSessionPlayerIdentityId: pid,
    })
  }
  return resolvePrivateWeChatStorageConversationKey(cid, null, pid)
}

export async function resolveAccountScopedGroupConversationKey(params: {
  wechatAccountId: string | null | undefined
  groupId: string
  appSessionPlayerIdentityId: string
}): Promise<string> {
  const acc = params.wechatAccountId?.trim()
  const gid = params.groupId.trim()
  const pid = params.appSessionPlayerIdentityId.trim() || '__none__'
  if (acc && gid) {
    return ensureAccountScopedGroupConversation({
      wechatAccountId: acc,
      groupId: gid,
      appSessionPlayerIdentityId: pid,
    })
  }
  return resolveGroupWeChatStorageConversationKey(gid, null, pid)
}
