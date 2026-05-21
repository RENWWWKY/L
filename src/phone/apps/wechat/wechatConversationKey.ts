import { resolvePrivateChatSessionPlayerIdentityId } from './wechatCharacterPlayerIdentity'

/**
 * 与通讯录内置 Lumi 联系人 id 一致。
 * Lumi 小助手的聊天记录**始终**使用该 id 存 IndexedDB，与具体人设角色 id 无关，避免与「角色私聊」串会话。
 */
export const WECHAT_LUMI_PEER_CHARACTER_ID = 'wechat-lumi-assistant'

/** 群成员表里表示「当前用户」的 charId（非 IndexedDB 角色 id） */
export const WECHAT_GROUP_USER_CHAR_ID = '__wx_group_user__'

/** 群聊系统通知 / 机器人消息的 characterId */
export const WECHAT_GROUP_BOT_CHARACTER_ID = '__wx_group_bot__'

const GROUP_CONV_PREFIX = 'wxgrp:'

/** 私聊 IndexedDB 键：按微信马甲隔离（`wxapriv:{accountId}::{characterId}::{sessionPid}`） */
export const WX_ACCOUNT_PRIVATE_CONV_PREFIX = 'wxapriv:'

/** 群聊 IndexedDB 键：按微信马甲隔离（`wxagrp:{accountId}::{groupId}::{sessionPid}`） */
export const WX_ACCOUNT_GROUP_CONV_PREFIX = 'wxagrp:'

/** IndexedDB 群聊长期记忆行的占位 characterId 前缀（与真实角色 id 区分） */
const GROUP_MEMORY_BUCKET_PREFIX = '__wx_grp_mem__::'

export function groupMemoryBucketCharacterId(groupId: string): string {
  return `${GROUP_MEMORY_BUCKET_PREFIX}${groupId.trim()}`
}

export function parseGroupIdFromMemoryBucketCharacterId(characterId: string): string | null {
  const c = characterId.trim()
  if (!c.startsWith(GROUP_MEMORY_BUCKET_PREFIX)) return null
  const gid = c.slice(GROUP_MEMORY_BUCKET_PREFIX.length).trim()
  return gid || null
}

export function wechatConversationKey(characterId: string, playerIdentityId: string): string {
  const pid = playerIdentityId.trim() || '__none__'
  return `${characterId}::${pid}`
}

export function isWechatAccountPrivateConversationKey(conversationKey: string): boolean {
  return conversationKey.trim().startsWith(WX_ACCOUNT_PRIVATE_CONV_PREFIX)
}

export function wechatAccountPrivateConversationKey(
  wechatAccountId: string,
  characterId: string,
  appSessionPlayerIdentityId: string,
): string {
  const acc = wechatAccountId.trim()
  const cid = characterId.trim()
  const pid = appSessionPlayerIdentityId.trim() || '__none__'
  return `${WX_ACCOUNT_PRIVATE_CONV_PREFIX}${acc}::${cid}::${pid}`
}

/** 会话键是否属于指定微信马甲（仅 `wxapriv:` / `wxagrp:` 前缀键；无马甲旧键返回 false）。 */
export function conversationKeyBelongsToWechatAccount(
  conversationKey: string,
  wechatAccountId: string,
): boolean {
  const k = conversationKey.trim()
  const acc = wechatAccountId.trim()
  if (!k || !acc) return false
  const priv = parseWechatAccountPrivateConversationKey(k)
  if (priv) return priv.wechatAccountId === acc
  const grp = parseWechatAccountGroupConversationKey(k)
  if (grp) return grp.wechatAccountId === acc
  return false
}

export function parseWechatAccountPrivateConversationKey(conversationKey: string): {
  wechatAccountId: string
  characterId: string
  sessionPlayerId: string
} | null {
  const k = conversationKey.trim()
  if (!isWechatAccountPrivateConversationKey(k)) return null
  const rest = k.slice(WX_ACCOUNT_PRIVATE_CONV_PREFIX.length)
  const parts = rest.split('::')
  if (parts.length < 3) return null
  const sessionPlayerId = (parts.pop() || '__none__').trim() || '__none__'
  const characterId = (parts.pop() || '').trim()
  const wechatAccountId = parts.join('::').trim()
  if (!wechatAccountId || !characterId) return null
  return { wechatAccountId, characterId, sessionPlayerId }
}

export function isWechatAccountGroupConversationKey(conversationKey: string): boolean {
  return conversationKey.trim().startsWith(WX_ACCOUNT_GROUP_CONV_PREFIX)
}

export function wechatAccountGroupConversationKey(
  wechatAccountId: string,
  groupId: string,
  appSessionPlayerIdentityId: string,
): string {
  const acc = wechatAccountId.trim()
  const gid = groupId.trim()
  const pid = appSessionPlayerIdentityId.trim() || '__none__'
  return `${WX_ACCOUNT_GROUP_CONV_PREFIX}${acc}::${gid}::${pid}`
}

export function parseWechatAccountGroupConversationKey(conversationKey: string): {
  wechatAccountId: string
  groupId: string
  sessionPlayerId: string
} | null {
  const k = conversationKey.trim()
  if (!isWechatAccountGroupConversationKey(k)) return null
  const rest = k.slice(WX_ACCOUNT_GROUP_CONV_PREFIX.length)
  const parts = rest.split('::')
  if (parts.length < 3) return null
  const sessionPlayerId = (parts.pop() || '__none__').trim() || '__none__'
  const groupId = (parts.pop() || '').trim()
  const wechatAccountId = parts.join('::').trim()
  if (!wechatAccountId || !groupId) return null
  return { wechatAccountId, groupId, sessionPlayerId }
}

/**
 * 私聊消息/会话设置存储键：仅按「当前马甲 + 本号会话身份」，**不**使用角色全局绑定身份，
 * 避免大号/小号聊天记录互相串线。AI 提示词仍用 {@link resolvePrivateChatSessionPlayerIdentityId}。
 */
export function resolvePrivateWeChatStorageConversationKey(
  characterId: string,
  wechatAccountId: string | null | undefined,
  appSessionPlayerIdentityId: string | null | undefined,
): string {
  const cid = characterId.trim()
  const pid = appSessionPlayerIdentityId?.trim() || '__none__'
  const acc = wechatAccountId?.trim()
  if (acc && cid) return wechatAccountPrivateConversationKey(acc, cid, pid)
  return wechatConversationKey(cid, pid)
}

export function resolveGroupWeChatStorageConversationKey(
  groupId: string,
  wechatAccountId: string | null | undefined,
  appSessionPlayerIdentityId: string | null | undefined,
): string {
  const gid = groupId.trim()
  const pid = appSessionPlayerIdentityId?.trim() || '__none__'
  const acc = wechatAccountId?.trim()
  if (acc && gid) return wechatAccountGroupConversationKey(acc, gid, pid)
  return wechatGroupConversationKey(gid, pid)
}

/**
 * 从私聊 `conversationKey`（`characterId::sessionPlayerId`）拆出两端；群聊键返回 null。
 * `characterId` 中若含 `::` 则按**最后一次** `::` 分割（与 {@link wechatConversationKey} 拼接规则一致）。
 */
export function parsePrivateWeChatConversationCharacterAndSession(conversationKey: string): {
  characterId: string
  sessionPlayerId: string
} | null {
  const k = conversationKey.trim()
  if (!k || isWechatGroupConversationKey(k)) return null
  const scoped = parseWechatAccountPrivateConversationKey(k)
  if (scoped) {
    return { characterId: scoped.characterId, sessionPlayerId: scoped.sessionPlayerId }
  }
  const idx = k.lastIndexOf('::')
  if (idx <= 0) return null
  const characterId = k.slice(0, idx).trim()
  const sessionPlayerId = (k.slice(idx + 2).trim() || '__none__').trim()
  if (!characterId) return null
  return { characterId, sessionPlayerId }
}

export { resolvePrivateChatSessionPlayerIdentityId } from './wechatCharacterPlayerIdentity'

/** @deprecated 存储请用 {@link resolvePrivateWeChatStorageConversationKey}；此函数保留给未传马甲的旧调用。 */
export function resolvePrivateWeChatConversationKey(
  characterId: string,
  characterRow: { playerIdentityId?: string } | null | undefined,
  appPlayerIdentityId: string | null | undefined,
  wechatAccountId?: string | null,
): string {
  if (wechatAccountId?.trim()) {
    return resolvePrivateWeChatStorageConversationKey(
      characterId,
      wechatAccountId,
      appPlayerIdentityId,
    )
  }
  const sid = resolvePrivateChatSessionPlayerIdentityId(characterRow, appPlayerIdentityId)
  return wechatConversationKey(characterId.trim(), sid)
}

/** 与会话设置 `peerCharacterId` 一致：群聊占位 id，避免与真实角色 id 冲突 */
export function wechatGroupPeerCharacterId(groupId: string): string {
  return `${GROUP_CONV_PREFIX}${groupId.trim()}`
}

/** 从群占位 `characterId`（`wxgrp:群id`）还原群 id；非占位则返回 null */
export function parseGroupIdFromGroupPeerCharacterId(peerCharacterId: string): string | null {
  const c = peerCharacterId.trim()
  if (!c.startsWith(GROUP_CONV_PREFIX)) return null
  const gid = c.slice(GROUP_CONV_PREFIX.length).trim()
  return gid || null
}

export function wechatGroupConversationKey(groupId: string, playerIdentityId: string): string {
  const gid = groupId.trim()
  const pid = playerIdentityId.trim() || '__none__'
  return `${GROUP_CONV_PREFIX}${gid}::${pid}`
}

export function isWechatGroupConversationKey(conversationKey: string): boolean {
  const k = conversationKey.trim()
  return k.startsWith(GROUP_CONV_PREFIX) || k.startsWith(WX_ACCOUNT_GROUP_CONV_PREFIX)
}

export function parseGroupIdFromConversationKey(conversationKey: string): string | null {
  const k = conversationKey.trim()
  if (!k.startsWith(GROUP_CONV_PREFIX)) return null
  const rest = k.slice(GROUP_CONV_PREFIX.length)
  const idx = rest.lastIndexOf('::')
  if (idx <= 0) return null
  const gid = rest.slice(0, idx).trim()
  return gid || null
}
