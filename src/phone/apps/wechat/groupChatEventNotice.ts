import type { GroupMember } from './newFriendsPersona/types'
import { emitWeChatStorageChanged, personaDb } from './newFriendsPersona/idb'
import { uid } from './newFriendsPersona/utils'
import { WECHAT_GROUP_BOT_CHARACTER_ID, WECHAT_GROUP_USER_CHAR_ID, wechatGroupConversationKey } from './wechatConversationKey'

/** 群系统通知文案中的成员展示名：仅用本群昵称 `groupNickname`；空时用户占位为「我」，其余为 charId */
export function groupNoticeMemberNickname(member: GroupMember | undefined): string {
  if (!member) return '…'
  let gn = (member.groupNickname || '').trim()
  /** 历史数据曾把占位 id 误写入昵称字段 */
  if (gn === WECHAT_GROUP_USER_CHAR_ID) gn = ''
  if (gn) return gn
  if (member.charId === WECHAT_GROUP_USER_CHAR_ID) return '我'
  return member.charId.trim() || '…'
}

/** 写入 chatMessages；ChatRoom 识别后按撤回条样式居中展示 */
export const WECHAT_GROUP_EVENT_NOTICE_PREFIX = '__WX_GRP_EVT__:'

export function formatWechatGroupEventNoticeContent(displayText: string): string {
  return `${WECHAT_GROUP_EVENT_NOTICE_PREFIX}${displayText.trim()}`
}

export function stripWechatGroupEventNoticePrefix(content: string): string {
  const raw = String(content ?? '')
  const t = raw.trimStart()
  if (t.startsWith(WECHAT_GROUP_EVENT_NOTICE_PREFIX)) return t.slice(WECHAT_GROUP_EVENT_NOTICE_PREFIX.length)
  return raw
}

export function isWechatGroupEventNoticeContent(content: string): boolean {
  return String(content ?? '').trimStart().startsWith(WECHAT_GROUP_EVENT_NOTICE_PREFIX)
}

/** 在群会话追加一条「系统通知条」（与撤回条同款样式）；`quiet` 避免提示音 */
export async function appendGroupChatEventNotice(params: {
  groupId: string
  playerIdentityId: string
  displayText: string
}): Promise<void> {
  const gid = params.groupId.trim()
  const pid = params.playerIdentityId.trim()
  if (!gid || !pid) return
  const body = params.displayText.trim()
  if (!body) return
  const ck = wechatGroupConversationKey(gid, pid)
  await personaDb.appendWeChatChatMessage({
    id: uid('wxge'),
    characterId: WECHAT_GROUP_BOT_CHARACTER_ID,
    playerIdentityId: pid,
    type: 'character',
    content: formatWechatGroupEventNoticeContent(body),
    timestamp: Date.now(),
    isRead: true,
    conversationKey: ck,
    quiet: true,
  })
  emitWeChatStorageChanged()
}
