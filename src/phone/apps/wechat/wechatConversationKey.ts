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

/**
 * 私聊在 IndexedDB 中使用的身份段：与 ChatRoom 的 `chatRouteIdentityId` 一致——
 * 优先角色表绑定的 `playerIdentityId`，否则为当前 App 选用身份；皆无则为 `__none__`。
 */
export function resolvePrivateChatSessionPlayerIdentityId(
  characterRow: { playerIdentityId?: string } | null | undefined,
  appPlayerIdentityId: string | null | undefined,
): string {
  const bound = characterRow?.playerIdentityId?.trim()
  if (bound) return bound
  const app = appPlayerIdentityId?.trim()
  if (app) return app
  return '__none__'
}

export function resolvePrivateWeChatConversationKey(
  characterId: string,
  characterRow: { playerIdentityId?: string } | null | undefined,
  appPlayerIdentityId: string | null | undefined,
): string {
  const sid = resolvePrivateChatSessionPlayerIdentityId(characterRow, appPlayerIdentityId)
  return wechatConversationKey(characterId.trim(), sid)
}

/** 与会话设置 `peerCharacterId` 一致：群聊占位 id，避免与真实角色 id 冲突 */
export function wechatGroupPeerCharacterId(groupId: string): string {
  return `${GROUP_CONV_PREFIX}${groupId.trim()}`
}

export function wechatGroupConversationKey(groupId: string, playerIdentityId: string): string {
  const gid = groupId.trim()
  const pid = playerIdentityId.trim() || '__none__'
  return `${GROUP_CONV_PREFIX}${gid}::${pid}`
}

export function isWechatGroupConversationKey(conversationKey: string): boolean {
  return conversationKey.trim().startsWith(GROUP_CONV_PREFIX)
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
