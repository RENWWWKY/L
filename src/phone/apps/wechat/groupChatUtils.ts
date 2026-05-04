import type { GroupChatRow, GroupMember, Relationship } from './newFriendsPersona/types'
import defaultGroupRobotAvatarUrl from '../../../../image/群聊机器人头像.png'
import { migrateLegacyRootPublicUrl } from '../../../publicAssetUrl'
import { WECHAT_GROUP_BOT_CHARACTER_ID, WECHAT_GROUP_USER_CHAR_ID } from './wechatConversationKey'

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

function pickRandomSubset(ids: string[], n: number): string[] {
  if (n <= 0 || !ids.length) return []
  const copy = [...ids]
  shuffleInPlace(copy)
  return copy.slice(0, Math.min(n, copy.length))
}

/** 单次用户侧触发下，最多接力多少次 AI（避免超大群一次调用上百次） */
export const GROUP_CHAT_MAX_AI_RESPONDERS_PER_USER_BATCH = 12

/** 无 @ 时：按 rotation 轮换窗口；在人数不超过上限时尽量 **全员** 出场接力，便于群内互怼讨论 */
function pickRotatedResponderWindow(charIds: string[], rotation: number): string[] {
  if (!charIds.length) return []
  const sorted = [...new Set(charIds.map((x) => x.trim()).filter(Boolean))].sort()
  if (!sorted.length) return []
  const nn = sorted.length
  const cap = GROUP_CHAT_MAX_AI_RESPONDERS_PER_USER_BATCH
  const want = nn <= 1 ? 1 : nn <= cap ? nn : cap
  const start = Math.max(0, rotation) % nn
  const window: string[] = []
  for (let i = 0; i < want; i += 1) {
    window.push(sorted[(start + i) % nn]!)
  }
  shuffleInPlace(window)
  return window
}

/**
 * 仅 @ 了部分人时，在群内仍有其他可用 AI 的情况下补足出场人数，避免整轮只有一人连发。
 * 保持 `primary` 中顺序（@ 命中顺序优先），后面追加的成员由轮换窗口挑选。
 */
function padGroupResponderQueue(primary: string[], poolAll: string[], rotation: number, minTotal: number): string[] {
  const out = primary.filter((id, i, arr) => id.trim() && arr.indexOf(id) === i)
  if (poolAll.length < 2 || minTotal <= 1) return out.length ? out : primary
  let rot = Math.max(0, rotation)
  while (out.length < Math.min(minTotal, poolAll.length)) {
    const pool = poolAll.filter((id) => !out.includes(id))
    if (!pool.length) break
    const w = pickRotatedResponderWindow(pool, rot)
    const next = w[0]
    if (!next) break
    out.push(next)
    rot += 1
  }
  return out
}

/** 从用户消息解析 @，生成本轮应答的角色 charId 队列（不含用户） */
export function buildGroupAiResponderQueue(params: {
  group: GroupChatRow
  userMessage: string
  /** 无 @ 时轮换起点，每发一条用户消息递增（如 `ref += queue.length`） */
  rotation?: number
}): string[] {
  const members = params.group.members.filter((m) => m.charId !== WECHAT_GROUP_USER_CHAR_ID && !m.isMuted)
  const charIds = members.map((m) => m.charId)
  if (!charIds.length) return []

  const text = params.userMessage.trim()
  const rotation = Math.max(0, Math.floor(params.rotation ?? 0))
  if (/@所有人\b/u.test(text) || /@All\b/i.test(text)) {
    return shuffleInPlace([...charIds])
  }

  const rawMentions = [...text.matchAll(/@([^\s@]{1,32})/gu)].map((m) => m[1]!.trim()).filter(Boolean)
  if (rawMentions.length) {
    const out: string[] = []
    for (const token of rawMentions) {
      const hit =
        members.find((m) => m.groupNickname === token) ||
        members.find((m) => m.charId === token) ||
        members.find((m) => m.groupNickname.includes(token))
      if (hit && !out.includes(hit.charId)) out.push(hit.charId)
    }
    const base = out.length ? out : pickRandomSubset(charIds, Math.min(2, charIds.length))
    /** @ 场景：在保证 @ 顺序在前的前提下，尽量垫满可出场人数（上限同 BATCH），形成多人讨论 */
    const mentionFloor =
      charIds.length <= 1 ? 1 : Math.min(charIds.length, GROUP_CHAT_MAX_AI_RESPONDERS_PER_USER_BATCH)
    return padGroupResponderQueue(base, charIds, rotation, mentionFloor)
  }

  return pickRotatedResponderWindow(charIds, rotation)
}

export function findGroupMember(group: GroupChatRow | null, charId: string): GroupMember | null {
  if (!group) return null
  const id = charId.trim()
  return group.members.find((m) => m.charId === id) ?? null
}

export function userIsGroupOwner(group: GroupChatRow | null): boolean {
  const u = findGroupMember(group, WECHAT_GROUP_USER_CHAR_ID)
  return u?.role === 'owner'
}

export function userIsGroupAdminOrOwner(group: GroupChatRow | null): boolean {
  const u = findGroupMember(group, WECHAT_GROUP_USER_CHAR_ID)
  return u?.role === 'owner' || u?.role === 'admin'
}

/** 当前是否存在「群主」且群主不是用户占位（即 NPC 任群主） */
export function npcCharacterIsGroupOwner(group: GroupChatRow | null): boolean {
  const o = group?.members?.find((m) => m.role === 'owner')
  return !!o && o.charId !== WECHAT_GROUP_USER_CHAR_ID
}

/**
 * 本市是否具备【群主】级客户端操作：编辑群公告、转让群主、解散群聊、代改他人本群昵称、任命/撤销管理员等
 * （**不含**群机器人敏感词规则编辑——该项与管理员共享，见 {@link userCanEditGroupRobotTriggerRulesInClient}；**不含**群头像）。
 * **仅**当用户占位在成员表中的 `role === 'owner'` 时为 true（普通成员不因「NPC 为群主」而获得代管权限）。
 */
export function userCanAccessGroupOwnerLevelInClient(group: GroupChatRow | null): boolean {
  return userIsGroupOwner(group)
}

/** 群机器人「触发词 / 警告与禁言规则」及群管家头像编辑：**群主或管理员**；任意成员可进入页内查看列表。 */
export function userCanEditGroupRobotTriggerRulesInClient(group: GroupChatRow | null): boolean {
  return userCanAccessGroupAdminLevelInClient(group)
}

/**
 * 本市是否具备【群管理员】级操作：改群名、踢人、禁言、@所有人、**群机器人敏感词规则编辑**等
 * （**不含**群公告、他人本群昵称、任命管理员、转让群主、解散；**不含**群头像）。
 * **仅**当用户占位为群主或管理员（`role === 'owner' | 'admin'`）；普通成员不可使用上述管理项。
 */
export function userCanAccessGroupAdminLevelInClient(group: GroupChatRow | null): boolean {
  return userIsGroupAdminOrOwner(group)
}

/**
 * 与 {@link userCanAccessGroupAdminLevelInClient} 相同（群管理页、禁言、管理员开关等）。
 * @deprecated 新代码请优先使用 `userCanAccessGroupAdminLevelInClient`。
 */
export function userCanAccessGroupMemberModeration(group: GroupChatRow | null): boolean {
  return userCanAccessGroupAdminLevelInClient(group)
}

/** 文本是否包含 @所有人（与群聊解析一致） */
export function textMentionsGroupEveryone(text: string): boolean {
  const t = String(text ?? '').trim()
  return /@所有人\b/u.test(t) || /@All\b/i.test(t)
}

/**
 * 解析群机器人「触发词」输入：支持 `|`、中英文逗号、分号等分隔多条。
 * 若整段打成 `祁, 卫` 会拆成 `祁` 与 `卫`，避免被当成需连续出现的字面串。
 */
export function parseGroupRobotTriggerWordInput(raw: string): string[] {
  return Array.from(
    new Set(
      String(raw ?? '')
        .split(/[|｜,，;；\s\n]+/u)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ).slice(0, 32)
}

/** 触发词 -> 警告 / 禁言（返回 null 表示未命中） */
export function matchGroupRobotRules(
  text: string,
  rules: GroupChatRow['robotRules'],
): GroupChatRow['robotRules'][number] | null {
  const t = text.trim()
  if (!t || !rules?.length) return null
  for (const rule of rules) {
    for (const w of rule.triggerWords) {
      const needle = String(w ?? '').trim()
      if (!needle) continue
      try {
        if (new RegExp(needle, 'iu').test(t)) return rule
      } catch {
        if (t.includes(needle)) return rule
      }
    }
  }
  return null
}

export function formatGroupRobotSystemContent(hit: GroupChatRow['robotRules'][number]): string {
  return `[群管家] ${hit.warningText.trim() || '请注意发言规范。'}`
}

export function isGroupBotMessage(characterId: string): boolean {
  return characterId.trim() === WECHAT_GROUP_BOT_CHARACTER_ID
}

/** 群管家默认头像（仓库 `image/群聊机器人头像.png`，经打包为稳定 URL） */
export const DEFAULT_GROUP_ROBOT_AVATAR_URL = defaultGroupRobotAvatarUrl

/** 解析群管家在聊天中应显示的头像地址（未配置或空串时使用 {@link DEFAULT_GROUP_ROBOT_AVATAR_URL}） */
export function resolveGroupRobotAvatarDisplayUrl(group: Pick<GroupChatRow, 'robotAvatarUrl'> | null | undefined): string {
  const u = group?.robotAvatarUrl?.trim()
  if (!u) return defaultGroupRobotAvatarUrl
  if (u.startsWith('data:') || /^https?:\/\//i.test(u)) return u
  return migrateLegacyRootPublicUrl(u)
}

/**
 * 两名角色是否在人脉中存在「角色↔角色」关系边（不含玩家身份↔角色的 `isPlayerIdentity` 绑定）。
 * 有则视为彼此可掌握对方人设本名等；无则群聊侧仅应以本群昵称 / 微信昵称互称。
 */
export function pairHasCharacterToCharacterRelationship(rels: readonly Relationship[], a: string, b: string): boolean {
  const ca = a.trim()
  const cb = b.trim()
  if (!ca || !cb || ca === cb) return true
  for (const r of rels) {
    if (r.isPlayerIdentity) continue
    if (
      (r.fromCharacterId === ca && r.toCharacterId === cb) ||
      (r.fromCharacterId === cb && r.toCharacterId === ca)
    ) {
      return true
    }
  }
  return false
}

/**
 * 生成「互不知本名」的成员对列表文案（供群聊 AI 系统提示）；行内用本群昵称指代。
 */
export function buildGroupStrangerPairDisplayLines(
  npcCharIds: string[],
  groupMembers: readonly GroupMember[],
  rels: readonly Relationship[],
): string[] {
  const ids = [...new Set(npcCharIds.map((x) => x.trim()).filter(Boolean))].sort()
  const groupNick = (cid: string) => {
    const m = groupMembers.find((x) => x.charId === cid)
    return (m?.groupNickname || '').trim() || cid.slice(0, 8)
  }
  const out: string[] = []
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const A = ids[i]!
      const B = ids[j]!
      if (pairHasCharacterToCharacterRelationship(rels, A, B)) continue
      out.push(`- 「${groupNick(A)}」与「${groupNick(B)}」`)
    }
  }
  return out
}

/** 新建群：用户为群主，成员含 `WECHAT_GROUP_USER_CHAR_ID` 与若干角色 id（去重） */
export function buildNewGroupChatRow(params: {
  id: string
  playerIdentityId: string
  name: string
  playerDisplayName: string
  characterIds: string[]
  /** 每个角色的群昵称（用于初始化） */
  nickByCharacterId: Record<string, string>
}): GroupChatRow {
  const now = Date.now()
  const pid = params.playerIdentityId.trim()
  const ids = Array.from(new Set(params.characterIds.map((x) => x.trim()).filter(Boolean)))
  const members: GroupMember[] = [
    {
      charId: WECHAT_GROUP_USER_CHAR_ID,
      groupNickname: params.playerDisplayName.trim().slice(0, 32) || '我',
      role: 'owner',
      isMuted: false,
      warnings: 0,
    },
    ...ids.map(
      (cid): GroupMember => ({
        charId: cid,
        groupNickname: (params.nickByCharacterId[cid] ?? cid).trim().slice(0, 32) || cid,
        role: 'member',
        isMuted: false,
        warnings: 0,
      }),
    ),
  ]
  return {
    id: params.id.trim(),
    playerIdentityId: pid,
    name: params.name.trim().slice(0, 64) || '群聊',
    remark: '',
    avatar: '',
    members,
    robotRules: [],
    announcement: '',
    createdAt: now,
    updatedAt: now,
  }
}
