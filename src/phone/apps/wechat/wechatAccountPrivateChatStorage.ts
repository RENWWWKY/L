import { personaDb } from './newFriendsPersona/idb'
import { normalizeAccountsBundle, WECHAT_ACCOUNTS_BUNDLE_KV_KEY } from './wechatAccountTypes'
import { resolveAccountSessionIdentityId } from './wechatAccountPersistence'
import {
  arePlayerIdentitiesBasicsEquivalent,
  collectWechatAccountPlayerIdentityIds,
  getCharacterBoundPlayerIdentityId,
  isWechatAccountSessionSlotIdentityId,
} from './wechatCharacterPlayerIdentity'
import {
  isWechatAccountGroupConversationKey,
  isWechatAccountPrivateConversationKey,
  parsePrivateWeChatConversationCharacterAndSession,
  parseWechatAccountGroupConversationKey,
  parseWechatAccountPrivateConversationKey,
  resolveGroupWeChatStorageConversationKey,
  resolvePrivateWeChatStorageConversationKey,
  wechatAccountPrivateConversationKey,
  wechatConversationKey,
} from './wechatConversationKey'
import { resolveActivePrivateChatSessionPlayerIdentityId } from './wechatCharacterPlayerIdentity'

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

/** 同马甲、同角色：是否将另一 session 桶并入当前 pid（含老用户 wx-slot 与旧身份分裂桶）。 */
async function shouldMergeOtherPrivateSessionIntoPid(
  other: string,
  pid: string,
  wechatAccountId: string,
  bound: string | null,
  mergeBound: boolean,
): Promise<boolean> {
  if (!other || other === '__none__' || other === pid) return true
  if (!!bound && other === bound && mergeBound) return true
  const acc = wechatAccountId.trim()
  if (!acc) return false
  const owner = await resolveWechatAccountIdForSessionPlayerIdentity(other, acc)
  if (owner !== acc) return false
  if (isWechatAccountSessionSlotIdentityId(other)) return true
  if (await mayMergeBoundSessionIntoPid(other, pid, acc)) return true
  const pool = await collectWechatAccountPlayerIdentityIds(acc)
  return pool.includes(other)
}

/** 列出本马甲 + 角色在库中可能出现的全部私聊 conversationKey（含旧格式，用于已读/恢复）。 */
export async function listPrivateConversationKeysForAccountCharacter(params: {
  wechatAccountId: string
  characterId: string
}): Promise<string[]> {
  const acc = params.wechatAccountId.trim()
  const cid = params.characterId.trim()
  if (!acc || !cid) return []
  const out = new Set<string>()
  const keys = await personaDb.listDistinctWeChatConversationKeysFromMessages()
  for (const raw of keys) {
    const k = raw.trim()
    if (!k) continue
    const scoped = parseWechatAccountPrivateConversationKey(k)
    if (scoped?.wechatAccountId === acc && scoped.characterId === cid) {
      out.add(k)
      continue
    }
    if (isWechatAccountPrivateConversationKey(k)) continue
    const leg = parsePrivateWeChatConversationCharacterAndSession(k)
    if (!leg || leg.characterId !== cid) continue
    const owner = await resolveWechatAccountIdForSessionPlayerIdentity(leg.sessionPlayerId, acc)
    if (owner === acc) out.add(k)
  }
  return [...out]
}

/**
 * 信息列表未读：同一马甲 + 角色可能分裂在多个 conversationKey（聊天室会话身份 vs 列表解析身份），需汇总全部桶。
 */
export async function countUnreadPrivateMessagesForAccountCharacter(params: {
  wechatAccountId: string
  characterId: string
  appSessionPlayerIdentityId: string
  fallbackConversationKey?: string
}): Promise<number> {
  const acc = params.wechatAccountId.trim()
  const cid = params.characterId.trim()
  const pid = params.appSessionPlayerIdentityId.trim() || '__none__'
  if (!acc || !cid) {
    const fb = params.fallbackConversationKey?.trim()
    return fb ? personaDb.countUnreadWeChatCharacterMessages(fb) : 0
  }
  const keys = new Set(
    await listPrivateConversationKeysForAccountCharacter({ wechatAccountId: acc, characterId: cid }),
  )
  const canonical = await ensureAccountScopedPrivateConversation({
    wechatAccountId: acc,
    characterId: cid,
    appSessionPlayerIdentityId: pid,
  })
  keys.add(canonical)
  const fb = params.fallbackConversationKey?.trim()
  if (fb) keys.add(fb)
  let total = 0
  for (const k of keys) {
    total += await personaDb.countUnreadWeChatCharacterMessages(k)
  }
  return total
}

/**
 * 进入聊天室后：合并分裂桶并把所有相关键标为已读（修复列表红点与聊天室键不一致）。
 */
export async function markPrivateChatConversationReadForAccountCharacter(params: {
  wechatAccountId: string
  characterId: string
  appSessionPlayerIdentityId: string
}): Promise<string> {
  const acc = params.wechatAccountId.trim()
  const cid = params.characterId.trim()
  const pid = params.appSessionPlayerIdentityId.trim() || '__none__'
  const canonical = acc
    ? await ensureAccountScopedPrivateConversation({
        wechatAccountId: acc,
        characterId: cid,
        appSessionPlayerIdentityId: pid,
      })
    : resolvePrivateWeChatStorageConversationKey(cid, null, pid)

  const keys = await listPrivateConversationKeysForAccountCharacter({ wechatAccountId: acc, characterId: cid })
  for (const k of keys) {
    await personaDb.markWeChatConversationReadToLatest(k)
  }
  await personaDb.markWeChatConversationReadToLatest(canonical)
  return canonical
}

/**
 * 启动/切号时：把本马甲下因升级分裂到多个 session 桶的私聊史合并回 canonical（数据仍在 IndexedDB，可自动恢复）。
 */
export async function repairSplitPrivateChatHistoriesForWechatAccount(wechatAccountId: string): Promise<number> {
  const acc = wechatAccountId.trim()
  if (!acc) return 0
  const bundle = normalizeAccountsBundle(await personaDb.getPhoneKv(WECHAT_ACCOUNTS_BUNDLE_KV_KEY))
  const account = bundle?.accounts.find((a) => a.accountId === acc)
  const appPid = account ? resolveAccountSessionIdentityId(account) : (await personaDb.getCurrentIdentityId()).trim()

  const keys = await personaDb.listDistinctWeChatConversationKeysFromMessages()
  const charIds = new Set<string>()
  for (const raw of keys) {
    const k = raw.trim()
    if (!k) continue
    const scoped = parseWechatAccountPrivateConversationKey(k)
    if (scoped?.wechatAccountId === acc) {
      charIds.add(scoped.characterId)
      continue
    }
    if (isWechatAccountPrivateConversationKey(k)) continue
    const leg = parsePrivateWeChatConversationCharacterAndSession(k)
    if (!leg) continue
    const owner = await resolveWechatAccountIdForSessionPlayerIdentity(leg.sessionPlayerId, acc)
    if (owner === acc) charIds.add(leg.characterId)
  }

  let n = 0
  for (const cid of charIds) {
    if (!cid) continue
    const sid = await resolveActivePrivateChatSessionPlayerIdentityId({
      characterId: cid,
      wechatAccountId: acc,
      appPlayerIdentityId: appPid || '__none__',
    })
    await ensureAccountScopedPrivateConversation({
      wechatAccountId: acc,
      characterId: cid,
      appSessionPlayerIdentityId: sid,
    })
    n += 1
  }
  return n
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
  /** 老用户升级：转账/红包曾写入马甲槽位 id，而聊天室按 resolveActivePrivateChatSessionPlayerIdentityId 用旧身份读库 */
  for (const sid of await collectWechatAccountPlayerIdentityIds(acc)) {
    if (!sid || sid === '__none__' || sid === pid) continue
    const owner = await resolveWechatAccountIdForSessionPlayerIdentity(sid, acc)
    if (owner !== acc) continue
    if (sid === bound && mergeBound) {
      legacyKeys.add(wechatConversationKey(cid, sid))
      continue
    }
    if (await mayMergeBoundSessionIntoPid(sid, pid, acc)) {
      legacyKeys.add(wechatConversationKey(cid, sid))
      continue
    }
    if (isWechatAccountSessionSlotIdentityId(sid)) {
      legacyKeys.add(wechatConversationKey(cid, sid))
    }
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

  const scopedKeys = await personaDb.listDistinctWeChatConversationKeysFromMessages()
  for (const k of scopedKeys) {
    const parsed = parseWechatAccountPrivateConversationKey(k)
    if (!parsed || parsed.wechatAccountId !== acc || parsed.characterId !== cid) continue
    if (parsed.sessionPlayerId === pid) continue
    if (!(await shouldMergeOtherPrivateSessionIntoPid(parsed.sessionPlayerId, pid, acc, bound, mergeBound))) {
      continue
    }
    await personaDb.rekeyWeChatConversation({
      fromConversationKey: k,
      toConversationKey: newKey,
      sessionPlayerIdentityId: pid,
    })
  }

  for (const sid of await collectWechatAccountPlayerIdentityIds(acc)) {
    if (!sid || sid === '__none__') continue
    const scoped = wechatAccountPrivateConversationKey(acc, cid, sid)
    if (scoped === newKey) continue
    const recent = await personaDb.listWeChatChatMessagesRecent({ conversationKey: scoped, limit: 1 })
    if (!recent.length) continue
    if (!(await shouldMergeOtherPrivateSessionIntoPid(sid, pid, acc, bound, mergeBound))) continue
    await personaDb.rekeyWeChatConversation({
      fromConversationKey: scoped,
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

/** 私聊落库键：与 ChatRoom 一致走马甲隔离，并顺带合并误入的旧格式键。 */
export async function resolvePrivateChatMessageStorageKey(params: {
  wechatAccountId: string | null | undefined
  characterId: string
  appSessionPlayerIdentityId: string
}): Promise<string> {
  const acc = params.wechatAccountId?.trim()
  const cid = params.characterId.trim()
  const pid = params.appSessionPlayerIdentityId.trim() || '__none__'
  if (!cid) return wechatConversationKey('', pid)
  if (acc) {
    return ensureAccountScopedPrivateConversation({
      wechatAccountId: acc,
      characterId: cid,
      appSessionPlayerIdentityId: pid,
    })
  }
  return resolvePrivateWeChatStorageConversationKey(cid, null, pid)
}

/** 红包/转账/亲情卡等从聊天子页写入消息时的会话键（私聊 / 群聊）。 */
export async function resolveWalletChatMessageStorageKey(params: {
  wechatAccountId: string | null | undefined
  groupId?: string | null
  peerCharacterId: string
  appSessionPlayerIdentityId: string
}): Promise<string> {
  const gid = params.groupId?.trim()
  const pid = params.appSessionPlayerIdentityId.trim() || '__none__'
  const acc = params.wechatAccountId?.trim()
  if (gid) {
    if (acc) {
      return ensureAccountScopedGroupConversation({
        wechatAccountId: acc,
        groupId: gid,
        appSessionPlayerIdentityId: pid,
      })
    }
    return resolveGroupWeChatStorageConversationKey(gid, null, pid)
  }
  return resolvePrivateChatMessageStorageKey({
    wechatAccountId: acc,
    characterId: params.peerCharacterId.trim(),
    appSessionPlayerIdentityId: pid,
  })
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
