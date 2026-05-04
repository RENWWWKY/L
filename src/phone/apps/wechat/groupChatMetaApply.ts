import { appendGroupChatEventNotice, groupNoticeMemberNickname } from './groupChatEventNotice'
import { findGroupMember } from './groupChatUtils'
import { personaDb } from './newFriendsPersona/idb'
import type { GroupChatRow } from './newFriendsPersona/types'
import type { WeChatGroupMetaAction } from './groupChatModelMeta'
import { WECHAT_GROUP_BOT_CHARACTER_ID } from './wechatConversationKey'

/**
 * 将模型输出的群元数据指令落库：更新群名、群公告、管理员职务、成员本群昵称等，并追加与群信息页一致的系统灰条。
 */
export async function applyWeChatGroupMetaFromModel(params: {
  groupId: string
  playerIdentityId: string
  action: WeChatGroupMetaAction
  /** 写回内存中的群快照（如 ChatRoom 的 groupDocRef） */
  onGroupUpdated?: (g: GroupChatRow) => void
}): Promise<void> {
  const gid = params.groupId.trim()
  const pid = params.playerIdentityId.trim()
  if (!gid || !pid) return

  const g0 = await personaDb.getGroupChat(gid)
  if (!g0) return

  if (params.action.type === 'group_announcement') {
    const actorId = params.action.actorCharacterId.trim()
    const text = params.action.text.trim().slice(0, 2000)
    const actorMem = findGroupMember(g0, actorId)
    if (!actorMem || actorMem.role !== 'owner') return
    if (text === (g0.announcement ?? '').trim()) return
    const actorLabel = actorMem.groupNickname?.trim() || '群主'
    const next: GroupChatRow = { ...g0, announcement: text, updatedAt: Date.now() }
    await personaDb.putGroupChat(next)
    params.onGroupUpdated?.(next)
    await appendGroupChatEventNotice({
      groupId: gid,
      playerIdentityId: pid,
      displayText: `${actorLabel}修改了新的群公告内容`,
    })
    return
  }

  if (params.action.type === 'group_title') {
    const actorId = params.action.actorCharacterId.trim()
    const newTitle = params.action.title.trim().slice(0, 64)
    if (!newTitle || newTitle === g0.name) return
    const actorMem = findGroupMember(g0, actorId)
    if (!actorMem || (actorMem.role !== 'owner' && actorMem.role !== 'admin')) return
    const actorLabel = actorMem.groupNickname?.trim() || '群成员'
    const safe = newTitle.replace(/"/g, "'")
    const next: GroupChatRow = { ...g0, name: newTitle, updatedAt: Date.now() }
    await personaDb.putGroupChat(next)
    params.onGroupUpdated?.(next)
    await appendGroupChatEventNotice({
      groupId: gid,
      playerIdentityId: pid,
      displayText: `${actorLabel}更换了群聊名称为"${safe}"`,
    })
    return
  }

  if (params.action.type === 'group_admin_role') {
    const actorId = params.action.actorCharacterId.trim()
    const targetId = params.action.targetCharacterId.trim()
    const toRole = params.action.toRole
    if (!actorId || !targetId) return
    if (targetId === WECHAT_GROUP_BOT_CHARACTER_ID) return
    const actorMem = findGroupMember(g0, actorId)
    const targetMem = findGroupMember(g0, targetId)
    if (!actorMem || !targetMem || actorMem.role !== 'owner') return
    if (targetMem.role === 'owner') return
    if (toRole === 'admin') {
      if (targetMem.role === 'admin') return
      if (targetMem.role !== 'member') return
    } else {
      if (targetMem.role !== 'admin') return
    }
    const members = g0.members.map((m) => {
      if (m.charId !== targetId || m.role === 'owner') return m
      return { ...m, role: toRole === 'admin' ? 'admin' : 'member' }
    })
    const next: GroupChatRow = { ...g0, members, updatedAt: Date.now() }
    await personaDb.putGroupChat(next)
    params.onGroupUpdated?.(next)
    const actorLabel = groupNoticeMemberNickname(actorMem)
    const targetLabel = groupNoticeMemberNickname(targetMem)
    const displayText =
      toRole === 'admin' ? `${actorLabel}设置${targetLabel}为群管理` : `${actorLabel}撤销了${targetLabel}的群管理`
    await appendGroupChatEventNotice({
      groupId: gid,
      playerIdentityId: pid,
      displayText,
    })
    return
  }

  if (params.action.type !== 'member_nick') return

  const cid = params.action.characterId.trim()
  const newNick = params.action.nickname.trim().slice(0, 32)
  if (!cid || !newNick) return
  const mem = findGroupMember(g0, cid)
  if (!mem || newNick === (mem.groupNickname || '').trim()) return
  const oldLabel = (mem.groupNickname || '').trim() || '群成员'
  const members = g0.members.map((m) => (m.charId === cid ? { ...m, groupNickname: newNick } : m))
  const next: GroupChatRow = { ...g0, members, updatedAt: Date.now() }
  await personaDb.putGroupChat(next)
  params.onGroupUpdated?.(next)
  const safeNick = newNick.replace(/"/g, "'")
  await appendGroupChatEventNotice({
    groupId: gid,
    playerIdentityId: pid,
    displayText: `${oldLabel}更改了自己的群昵称为"${safeNick}"`,
  })
}
