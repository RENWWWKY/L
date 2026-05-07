import { stripWechatGroupEventNoticePrefix } from './groupChatEventNotice'
import { findGroupMember } from './groupChatUtils'
import type { GroupChatRow, WeChatChatMessage } from './newFriendsPersona/types'
import { personaDb } from './newFriendsPersona/idb'
import {
  parseGroupIdFromConversationKey,
  WECHAT_GROUP_BOT_CHARACTER_ID,
  wechatConversationKey,
  wechatGroupConversationKey,
} from './wechatConversationKey'

/** 未总结聊天摘录单块汉字硬顶（默认入参仍较小；约会等可传入更大 maxChars） */
const UNSUMMARIZED_BLOCK_CHAR_HARD_MAX = 500_000

/** 合并多段文本供「关键词长期记忆」命中；规范空白并小写拉丁字母。 */
export function buildMemoryRelevanceHaystack(parts: Array<string | undefined | null>): string {
  return String(
    parts
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase(),
  )
}

function clipOneLine(s: string, max = 220): string {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function formatPrivateLineUnsummarized(m: WeChatChatMessage): string | null {
  if (m.isRecalled) return null
  let raw = stripWechatGroupEventNoticePrefix(String(m.content ?? '')).trim()
  if (m.redPacket) raw = raw || '[红包]'
  if (m.transfer) raw = raw || '[转账]'
  if (m.callStatus) raw = raw || '[通话]'
  if (m.images?.length) raw = raw ? `${raw} [图片]` : '[图片]'
  if (m.voice) {
    const vt = m.voice.transcriptText?.trim() || raw || ''
    raw = vt ? `（语音）${vt}` : '（语音）'
  }
  if (!raw) return null
  const who = m.type === 'player' ? '用户' : '对方'
  return `- [私聊・${who}] ${clipOneLine(raw)}`
}

function formatGroupLineUnsummarized(m: WeChatChatMessage, group: GroupChatRow | null, npcCharacterId?: string): string | null {
  if (m.isRecalled) return null
  const gidLabel = (group?.name || '').trim() || '群聊'
  let raw = stripWechatGroupEventNoticePrefix(String(m.content ?? '')).trim()
  const extMuted = m.ext?.mutedMessageVisibleToModeratorsOnly === true
  if (extMuted) {
    return `- [群「${gidLabel}」·（禁言未展示）]（该条在群内未公开展示）`
  }
  if (m.redPacket) raw = raw || '[红包]'
  if (m.transfer) raw = raw || '[转账]'
  if (m.callStatus) raw = raw || '[通话]'
  if (m.images?.length) raw = raw ? `${raw} [图片]` : '[图片]'
  if (m.voice) {
    const vt = m.voice.transcriptText?.trim() || raw || ''
    raw = vt ? `（语音）${vt}` : '（语音）'
  }
  if (!raw) return null

  let who: string
  if (m.type === 'player') {
    who = '用户'
  } else {
    const c = m.characterId?.trim() || ''
    if (c === WECHAT_GROUP_BOT_CHARACTER_ID) who = '群管家'
    else if (npcCharacterId && c === npcCharacterId) who = '你'
    else if (group) {
      const mem = findGroupMember(group, c)
      who = (mem?.groupNickname || '').trim() || c.slice(0, 12)
    } else {
      who = c.slice(0, 12)
    }
  }
  return `- [群「${gidLabel}」·${who}] ${clipOneLine(raw)}`
}

/**
 * 自上次自动总结游标之后、尚未写入长期记忆的私聊消息摘录（本地拼接，不调模型）。
 */
export async function formatUnsummarizedPrivateChatBlock(params: {
  conversationKey: string
  maxMessages?: number
  maxChars?: number
}): Promise<string> {
  const ck = params.conversationKey.trim()
  if (!ck) return ''
  const cursor = await personaDb.getMemorySummaryCursorTimestamp(ck)
  const fromTs = (cursor ?? 0) + 1
  const lim = Math.max(1, Math.min(500, Math.floor(params.maxMessages ?? 120)))
  const rows = await personaDb.listWeChatChatMessagesFromTimestampAsc({
    conversationKey: ck,
    fromTimestampInclusive: fromTs,
    limit: lim,
  })
  if (!rows.length) return ''
  const lines: string[] = []
  for (const m of rows) {
    const line = formatPrivateLineUnsummarized(m)
    if (line) lines.push(line)
  }
  if (!lines.length) return ''
  let body = lines.join('\n')
  const charCap = Math.max(400, Math.min(UNSUMMARIZED_BLOCK_CHAR_HARD_MAX, Math.floor(params.maxChars ?? 3200)))
  if (body.length > charCap) {
    const parts = body.split('\n')
    while (parts.join('\n').length > charCap && parts.length > 4) parts.shift()
    body = parts.join('\n')
    if (body.length > charCap) body = `${body.slice(-charCap)}\n…（更早未总结私聊已截断）`
  }
  return `${body}\n（↑ 尚未经自动总结写入长期记忆的私聊片段；若与上文气泡重叠，以衔接「总结空白期」为主。）`
}

/**
 * 当前群会话：游标之后尚未写入群聊长期总结的本地消息摘录。
 */
export async function formatUnsummarizedCurrentGroupChatBlock(params: {
  groupId: string
  playerIdentityId: string
  group: GroupChatRow | null
  maxMessages?: number
  maxChars?: number
}): Promise<string> {
  const gid = params.groupId.trim()
  const pid = params.playerIdentityId.trim()
  if (!gid || !pid || pid === '__none__') return ''
  const ck = wechatGroupConversationKey(gid, pid)
  const cursor = await personaDb.getMemorySummaryCursorTimestamp(ck)
  const fromTs = (cursor ?? 0) + 1
  const lim = Math.max(1, Math.min(500, Math.floor(params.maxMessages ?? 120)))
  const rows = await personaDb.listWeChatChatMessagesFromTimestampAsc({
    conversationKey: ck,
    fromTimestampInclusive: fromTs,
    limit: lim,
  })
  if (!rows.length) return ''
  const lines: string[] = []
  for (const m of rows) {
    const line = formatGroupLineUnsummarized(m, params.group, undefined)
    if (line) lines.push(line)
  }
  if (!lines.length) return ''
  let body = lines.join('\n')
  const charCap = Math.max(400, Math.min(UNSUMMARIZED_BLOCK_CHAR_HARD_MAX, Math.floor(params.maxChars ?? 3600)))
  if (body.length > charCap) {
    const parts = body.split('\n')
    while (parts.join('\n').length > charCap && parts.length > 4) parts.shift()
    body = parts.join('\n')
    if (body.length > charCap) body = `${body.slice(-charCap)}\n…（更早未总结群聊已截断）`
  }
  return `${body}\n（↑ 本群尚未经自动总结落库的长期记忆材料；与气泡历史可能部分重叠。）`
}

/**
 * 私聊侧：该 NPC 与用户共同参与的各群中，游标之后未总结的群消息合并摘录。
 */
export async function buildNpcGroupChatsUnsummarizedDigestForPrivatePrompt(params: {
  npcCharacterId: string
  sessionPlayerIdentityId: string
  boundPlayerIdentityId?: string | null | undefined
  maxMessagesPerGroup?: number
  charCap?: number
}): Promise<string> {
  const npcId = params.npcCharacterId.trim()
  if (!npcId) return ''

  const sid = params.sessionPlayerIdentityId.trim()
  const bid = params.boundPlayerIdentityId?.trim()
  const boundDiffersSession =
    !!bid && bid !== '__none__' && !!sid && sid !== '__none__' && bid !== sid
  const pid = boundDiffersSession ? bid! : sid
  if (!pid || pid === '__none__') return ''

  let groups: GroupChatRow[] = []
  try {
    groups = await personaDb.listGroupChatsForPlayerIdentity(pid)
  } catch {
    return ''
  }
  const relevant = groups.filter((g) => (g.members ?? []).some((m) => m.charId === npcId))
  if (!relevant.length) return ''

  const groupById = new Map(relevant.map((g) => [g.id.trim(), g]))
  const perLim = Math.max(8, Math.min(120, Math.floor(params.maxMessagesPerGroup ?? 60)))
  const merged: WeChatChatMessage[] = []
  for (const g of relevant) {
    const ck = wechatGroupConversationKey(g.id, pid)
    try {
      const cursor = await personaDb.getMemorySummaryCursorTimestamp(ck)
      const fromTs = (cursor ?? 0) + 1
      const batch = await personaDb.listWeChatChatMessagesFromTimestampAsc({
        conversationKey: ck,
        fromTimestampInclusive: fromTs,
        limit: perLim,
      })
      merged.push(...batch)
    } catch {
      /* ignore */
    }
  }
  if (!merged.length) return ''

  const sorted = merged.sort((a, b) => a.timestamp - b.timestamp)
  const lines: string[] = []
  for (const m of sorted) {
    const gkey = parseGroupIdFromConversationKey(m.conversationKey)
    const g = gkey ? groupById.get(gkey) ?? null : null
    const line = formatGroupLineUnsummarized(m, g, npcId)
    if (line) lines.push(line)
  }
  if (!lines.length) return ''

  let body = lines.join('\n')
  const charCap = Math.max(800, Math.min(UNSUMMARIZED_BLOCK_CHAR_HARD_MAX, Math.floor(params.charCap ?? 4200)))
  if (body.length > charCap) {
    const parts = body.split('\n')
    while (parts.join('\n').length > charCap && parts.length > 8) parts.shift()
    body = parts.join('\n')
    if (body.length > charCap) body = `${body.slice(-charCap)}\n…（更早未总结群聊已截断）`
  }
  return `${body}\n（↑ 各群「自动总结游标」之后尚未落库为长期记忆的片段；私聊回复时请承接群内语境。）`
}

/**
 * 群聊多角色：某位 NPC 与用户私聊（可能含绑定身份会话）中、游标后尚未总结的合并摘录。
 */
export async function formatUnsummarizedPrivateDigestForGroupMember(params: {
  npcCharacterId: string
  sessionPlayerIdentityId: string
  boundPlayerIdentityId?: string | null | undefined
  maxMessagesPerKey?: number
  charCap?: number
}): Promise<string> {
  const cid = params.npcCharacterId.trim()
  if (!cid) return ''

  const keys = new Set<string>()
  const sid = params.sessionPlayerIdentityId.trim()
  const bid = params.boundPlayerIdentityId?.trim()
  const boundDiffersSession =
    !!bid && bid !== '__none__' && !!sid && sid !== '__none__' && bid !== sid

  if (boundDiffersSession) {
    keys.add(wechatConversationKey(cid, bid))
  } else {
    if (sid && sid !== '__none__') keys.add(wechatConversationKey(cid, sid))
    if (bid && bid !== '__none__' && bid !== sid) keys.add(wechatConversationKey(cid, bid))
  }

  if (!keys.size) return ''

  const perLim = Math.max(4, Math.min(120, Math.floor(params.maxMessagesPerKey ?? 48)))
  const merged = new Map<string, WeChatChatMessage>()
  for (const ck of keys) {
    try {
      const cursor = await personaDb.getMemorySummaryCursorTimestamp(ck)
      const fromTs = (cursor ?? 0) + 1
      const batch = await personaDb.listWeChatChatMessagesFromTimestampAsc({
        conversationKey: ck,
        fromTimestampInclusive: fromTs,
        limit: perLim,
      })
      for (const m of batch) merged.set(m.id, m)
    } catch {
      /* ignore */
    }
  }
  if (!merged.size) return ''

  const sorted = [...merged.values()].sort((a, b) => a.timestamp - b.timestamp)
  const lines: string[] = []
  for (const m of sorted) {
    const line = formatPrivateLineUnsummarized(m)
    if (line) lines.push(line)
  }
  if (!lines.length) return ''

  let body = lines.join('\n')
  const charCap = Math.max(400, Math.min(UNSUMMARIZED_BLOCK_CHAR_HARD_MAX, Math.floor(params.charCap ?? 2800)))
  if (body.length > charCap) {
    const parts = body.split('\n')
    while (parts.join('\n').length > charCap && parts.length > 4) parts.shift()
    body = parts.join('\n')
    if (body.length > charCap) body = `${body.slice(-charCap)}\n…（更早未总结私聊已截断）`
  }
  return `${body}\n（↑ 与该用户私聊中尚未写入长期记忆的片段；**仅本角色视角**知晓，勿在群内当众宣读私密细节。）`
}
