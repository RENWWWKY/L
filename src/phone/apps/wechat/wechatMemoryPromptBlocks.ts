import { stripWechatGroupEventNoticePrefix } from './groupChatEventNotice'
import { findGroupMember } from './groupChatUtils'
import type { GroupChatRow, WeChatChatMessage } from './newFriendsPersona/types'
import { isMeetImportedWeChatMessageId } from '../lumiMeet/meetMemoryConstants'
import { personaDb } from './newFriendsPersona/idb'
import {
  formatSystemRecordTime,
  resolveMessageSystemRecordedAtMs,
} from './wechatCrossChannelTimeline'
import {
  parseGroupIdFromConversationKey,
  WECHAT_GROUP_BOT_CHARACTER_ID,
  wechatConversationKey,
  wechatGroupConversationKey,
} from './wechatConversationKey'

/** 未总结聊天摘录单块汉字硬顶（默认入参仍较小；约会等可传入更大 maxChars） */
const UNSUMMARIZED_BLOCK_CHAR_HARD_MAX = 500_000

/** 与自动总结 gather / 模型输入共用：单次最多纳入的游标后消息条数 */
export const MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT = 500
/** 与自动总结模型输入、私聊 prompt「尚未总结」块共用（超出时优先保留更早未总结段，下次总结继续） */
export const MEMORY_UNSUMMARIZED_BLOCK_CHAR_CAP = 12_000

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

function resolveUnsummarizedFromTimestamp(
  memoryCursorTs: number | null,
  minMessageTimestamp?: number,
): number {
  const memFloor = (memoryCursorTs ?? 0) + 1
  const extraFloor =
    typeof minMessageTimestamp === 'number' && Number.isFinite(minMessageTimestamp)
      ? minMessageTimestamp + 1
      : 0
  return Math.max(memFloor, extraFloor)
}

function formatWechatUnsummarizedLineTime(m: Pick<WeChatChatMessage, 'timestamp' | 'systemRecordedAt'>): string {
  return formatSystemRecordTime(resolveMessageSystemRecordedAtMs(m))
}

export function formatPrivateLineUnsummarized(
  m: WeChatChatMessage,
  opts?: { includeTimestamp?: boolean },
): string | null {
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
  const timePrefix =
    opts?.includeTimestamp && m.timestamp
      ? `[${formatWechatUnsummarizedLineTime(m)}] `
      : ''
  return `- ${timePrefix}[私聊・${who}] ${clipOneLine(raw)}`
}

/**
 * 群消息写入「私聊侧」摘录时的说话人标签。
 * 禁用「你」指代当前私聊 NPC：模型易把「你」误解成真人用户，造成「把 NPC 群发言当成用户说的」。
 */
export function formatGroupSpeakerLabelForPrivateContext(
  m: WeChatChatMessage,
  group: GroupChatRow | null,
  /** 当前私聊会话对方的人设 characterId；仅在注入私聊 prompt 时传入 */
  privatePeerNpcCharacterId?: string,
): string {
  if (m.type === 'player') return '用户'
  const c = m.characterId?.trim() || ''
  if (c === WECHAT_GROUP_BOT_CHARACTER_ID) return '群管家'
  const peer = privatePeerNpcCharacterId?.trim()
  if (peer && c === peer) {
    const nick = group ? (findGroupMember(group, c)?.groupNickname || '').trim() : ''
    return nick ? `对方角色·${nick}` : '对方角色（私聊对象）'
  }
  if (group) {
    const mem = findGroupMember(group, c)
    return (mem?.groupNickname || '').trim() || c.slice(0, 12)
  }
  return c.slice(0, 12)
}

function formatGroupLineUnsummarized(
  m: WeChatChatMessage,
  group: GroupChatRow | null,
  npcCharacterId?: string,
  opts?: { includeTimestamp?: boolean },
): string | null {
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

  const who = formatGroupSpeakerLabelForPrivateContext(m, group, npcCharacterId)
  const timePrefix =
    opts?.includeTimestamp && m.timestamp
      ? `[${formatWechatUnsummarizedLineTime(m)}] `
      : ''
  return `- ${timePrefix}[群「${gidLabel}」·${who}] ${clipOneLine(raw)}`
}

/**
 * 自上次自动总结游标之后、尚未写入长期记忆的私聊消息摘录（本地拼接，不调模型）。
 */
export async function formatUnsummarizedPrivateChatBlock(params: {
  conversationKey: string
  maxMessages?: number
  maxChars?: number
  /** 晚于记忆游标时，再抬高下限（约会：仅贴上一轮线下 AI 之后的线上段） */
  minMessageTimestamp?: number
  /** 为每条前缀公历系统落库时刻（真实生成/发送钟点，非剧情时间） */
  includeMessageTimestamps?: boolean
  /** 超长时保留较新消息（约会注入默认 true） */
  clipPreferRecent?: boolean
  /** 替换默认块尾说明 */
  footerNote?: string
}): Promise<string> {
  const ck = params.conversationKey.trim()
  if (!ck) return ''
  const cursor = await personaDb.getMemorySummaryCursorTimestamp(ck)
  const fromTs = resolveUnsummarizedFromTimestamp(cursor, params.minMessageTimestamp)
  const lim = Math.max(
    1,
    Math.min(MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT, Math.floor(params.maxMessages ?? MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT)),
  )
  const rows = await personaDb.listWeChatChatMessagesFromTimestampAsc({
    conversationKey: ck,
    fromTimestampInclusive: fromTs,
    limit: lim,
  })
  if (!rows.length) return ''
  const includeTs = params.includeMessageTimestamps === true
  const lines: string[] = []
  for (const m of rows) {
    if (isMeetImportedWeChatMessageId(m.id)) continue
    const line = formatPrivateLineUnsummarized(m, { includeTimestamp: includeTs })
    if (line) lines.push(line)
  }
  if (!lines.length) return ''
  let body = lines.join('\n')
  const charCap = Math.max(
    400,
    Math.min(UNSUMMARIZED_BLOCK_CHAR_HARD_MAX, Math.floor(params.maxChars ?? MEMORY_UNSUMMARIZED_BLOCK_CHAR_CAP)),
  )
  if (body.length > charCap) {
    const parts = body.split('\n')
    const preferRecent = params.clipPreferRecent === true
    while (parts.join('\n').length > charCap && parts.length > 4) {
      if (preferRecent) parts.shift()
      else parts.pop()
    }
    body = parts.join('\n')
    const truncNote = preferRecent ? '更早未总结私聊已截断' : '更晚未总结私聊下次总结继续'
    if (body.length > charCap) {
      body = preferRecent
        ? `${body.slice(-charCap)}\n…（${truncNote}）`
        : `${body.slice(0, charCap)}\n…（${truncNote}）`
    }
  }
  const footer =
    params.footerNote?.trim() ||
    `（↑ 尚未经自动总结写入长期记忆的私聊片段；若与上文气泡重叠，以衔接「总结空白期」为主。）`
  return `${body}\n${footer}`
}

/**
 * 游标后无未总结私聊时：按角色聚合最近私聊气泡，供线下剧情承接口吻（与 ChatRoom 近期参考同源思路）。
 */
export async function formatRecentPrivateChatReferenceByCharacter(params: {
  characterId: string
  maxMessages?: number
  maxChars?: number
}): Promise<string> {
  const cid = params.characterId.trim()
  if (!cid) return ''
  const lim = Math.max(1, Math.min(120, Math.floor(params.maxMessages ?? 48)))
  const rows = await personaDb.listWeChatChatMessagesRecentByCharacter({ characterId: cid, limit: lim })
  if (!rows.length) return ''
  const lines: string[] = []
  for (const m of rows) {
    if (isMeetImportedWeChatMessageId(m.id)) continue
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
    if (body.length > charCap) body = `${body.slice(-charCap)}\n…（更早私聊已截断）`
  }
  return `${body}\n（↑ 近期私聊参考（本地消息摘录）；游标后暂无未总结片段时兜底，供线下剧情承接口吻与事实。）`
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
  const lim = Math.max(
    1,
    Math.min(MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT, Math.floor(params.maxMessages ?? MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT)),
  )
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
  /** 与 {@link buildNpcGroupChatsRecentDigestForPrivatePrompt} 同源：优先铺该群未总结片段 */
  anchorGroupId?: string | null | undefined
  maxMessagesPerGroup?: number
  charCap?: number
  minMessageTimestamp?: number
  includeMessageTimestamps?: boolean
  groupFooterNote?: string
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
  const charCapTotal = Math.max(800, Math.min(UNSUMMARIZED_BLOCK_CHAR_HARD_MAX, Math.floor(params.charCap ?? 4200)))
  const includeTs = params.includeMessageTimestamps === true
  const groupLineOpts = { includeTimestamp: includeTs }
  const defaultGroupFooter =
    params.groupFooterNote?.trim() ||
    `（↑ 各群「自动总结游标」之后尚未落库为长期记忆的片段；私聊回复时请承接群内语境。）\n【说话人｜勿混淆】前缀「用户」仅指真人玩家本人；「对方角色·某某」表示**当前私聊对象（会话对方角色）**在该群的发言，**不是**用户。**禁止**把对方角色在群里的原话误当成用户说的（例如不可写「你刚才在群里嚷着吃火锅」若实为对方角色发的）。其他群成员仅用群内昵称标注。\n`

  const anchorGid = params.anchorGroupId?.trim()
  if (anchorGid) {
    const anchorRow = relevant.find((g) => g.id.trim() === anchorGid)
    if (anchorRow && (anchorRow.members ?? []).some((m) => m.charId.trim() === npcId)) {
      const anchorCk = wechatGroupConversationKey(anchorGid, pid)
      let anchorBatch: WeChatChatMessage[] = []
      try {
        const cursor = await personaDb.getMemorySummaryCursorTimestamp(anchorCk)
        const fromTs = resolveUnsummarizedFromTimestamp(cursor, params.minMessageTimestamp)
        anchorBatch = await personaDb.listWeChatChatMessagesFromTimestampAsc({
          conversationKey: anchorCk,
          fromTimestampInclusive: fromTs,
          limit: perLim,
        })
      } catch {
        anchorBatch = []
      }
      const anchorLines: string[] = []
      for (const m of anchorBatch.sort((a, b) => a.timestamp - b.timestamp)) {
        const line = formatGroupLineUnsummarized(m, anchorRow, npcId, groupLineOpts)
        if (line) anchorLines.push(line)
      }
      const merged: WeChatChatMessage[] = []
      for (const g of relevant) {
        if (g.id.trim() === anchorGid) continue
        const ck = wechatGroupConversationKey(g.id, pid)
        try {
          const cursor = await personaDb.getMemorySummaryCursorTimestamp(ck)
          const fromTs = resolveUnsummarizedFromTimestamp(cursor, params.minMessageTimestamp)
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
      const otherLines: string[] = []
      for (const m of merged.sort((a, b) => a.timestamp - b.timestamp)) {
        const gkey = parseGroupIdFromConversationKey(m.conversationKey)
        const g = gkey ? groupById.get(gkey) ?? null : null
        const line = formatGroupLineUnsummarized(m, g, npcId, groupLineOpts)
        if (line) otherLines.push(line)
      }

      const anchorBudget = Math.floor(charCapTotal * 0.72)
      let anchorBody = anchorLines.join('\n')
      if (anchorBody.length > anchorBudget) {
        const parts = anchorBody.split('\n')
        while (parts.join('\n').length > anchorBudget && parts.length > 4) parts.shift()
        anchorBody = parts.join('\n')
        if (anchorBody.length > anchorBudget) anchorBody = `${anchorBody.slice(-anchorBudget)}\n…（该群未总结片段已截断）`
      }
      let rest = otherLines.join('\n')
      const restBudget = charCapTotal - anchorBody.length - 80
      if (rest.length > restBudget && restBudget > 200) {
        const parts = rest.split('\n')
        while (parts.join('\n').length > restBudget && parts.length > 4) parts.shift()
        rest = parts.join('\n')
        if (rest.length > restBudget) rest = `${rest.slice(-restBudget)}\n…（其它群未总结已截断）`
      } else if (restBudget <= 200) {
        rest = ''
      }

      const gname = (anchorRow.remark || anchorRow.name || '').trim() || '该群'
      const chunks: string[] = []
      if (anchorBody.trim()) {
        chunks.push(
          `【优先：群「${gname}」内、自动总结游标之后尚未落库的长期记忆材料】\n${anchorBody.trim()}`,
        )
      }
      if (rest.trim()) {
        chunks.push(`【其它共同群·未总结节选】\n${rest.trim()}`)
      }
      if (!chunks.length) return ''
      let body = chunks.join('\n\n')
      if (body.length > charCapTotal) {
        body = `${body.slice(0, charCapTotal)}\n…（总长已截断）`
      }
      return `${body}\n（↑ 含你们离开群聊前该群的未总结片段；私聊回复时请承接群内语境。）\n【说话人｜勿混淆】前缀「用户」仅指真人玩家本人；「对方角色·某某」表示**当前私聊对象（会话对方角色）**在该群的发言，**不是**用户。**禁止**把对方角色在群里的原话误当成用户说的。其他群成员仅用群内昵称标注。\n`
    }
  }

  const merged: WeChatChatMessage[] = []
  for (const g of relevant) {
    const ck = wechatGroupConversationKey(g.id, pid)
    try {
      const cursor = await personaDb.getMemorySummaryCursorTimestamp(ck)
      const fromTs = resolveUnsummarizedFromTimestamp(cursor, params.minMessageTimestamp)
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
    const line = formatGroupLineUnsummarized(m, g, npcId, groupLineOpts)
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
  return `${body}\n${defaultGroupFooter}`
}

/**
 * 群聊多角色：某位 NPC 与用户私聊（可能含绑定身份会话）中、游标后尚未总结的合并摘录。
 */
export async function formatUnsummarizedPrivateDigestForGroupMember(params: {
  npcCharacterId: string
  sessionPlayerIdentityId: string
  boundPlayerIdentityId?: string | null | undefined
  /** 与 {@link buildNpcPrivateChatDigestForGroupPrompt} 的 anchorPrivateBoost 同源 */
  anchorPrivateBoost?: boolean
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

  const boost = params.anchorPrivateBoost === true
  const baseLim = Math.max(4, Math.min(120, Math.floor(params.maxMessagesPerKey ?? 48)))
  const perLim = boost ? Math.min(120, Math.floor(baseLim * 1.35)) : baseLim
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
  const baseCap = Math.max(400, Math.min(UNSUMMARIZED_BLOCK_CHAR_HARD_MAX, Math.floor(params.charCap ?? 2800)))
  const charCap = boost ? Math.min(UNSUMMARIZED_BLOCK_CHAR_HARD_MAX, Math.floor(baseCap * 1.45)) : baseCap
  if (body.length > charCap) {
    const parts = body.split('\n')
    while (parts.join('\n').length > charCap && parts.length > 4) parts.shift()
    body = parts.join('\n')
    if (body.length > charCap) body = `${body.slice(-charCap)}\n…（更早未总结私聊已截断）`
  }
  return `${body}\n（↑ 与该用户私聊中尚未写入长期记忆的片段；**仅本角色视角**知晓，勿在群内当众宣读私密细节。）`
}
