import type { GroupChatRow, WeChatChatMessage } from './newFriendsPersona/types'
import { personaDb } from './newFriendsPersona/idb'
import { stripWechatGroupEventNoticePrefix } from './groupChatEventNotice'
import { formatGroupSpeakerLabelForPrivateContext } from './wechatMemoryPromptBlocks'
import {
  parseGroupIdFromConversationKey,
  wechatConversationKey,
  wechatGroupConversationKey,
} from './wechatConversationKey'

function clipOneLine(s: string, max = 220): string {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function formatPrivateMsgLine(m: WeChatChatMessage): string | null {
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
  const who = m.type === 'player' ? '用户' : '你'
  return `- [私聊・${who}] ${clipOneLine(raw)}`
}

/**
 * 从本地 IndexedDB 拉取该 NPC 与用户在不同玩家身份下的私聊近期消息，合并去重后拼成注入群聊系统提示的摘录。
 * （群会话 transcript 不含私聊；仅靠记忆条目容易「忘了刚才私聊说过什么」。）
 */
export async function buildNpcPrivateChatDigestForGroupPrompt(params: {
  npcCharacterId: string
  sessionPlayerIdentityId: string
  boundPlayerIdentityId?: string | null | undefined
  /** 用户刚从与该 NPC 的私聊进入本群：加大摘录量，减少「转群就失忆」 */
  anchorPrivateBoost?: boolean
  messageCap?: number
  charCap?: number
}): Promise<string> {
  const cid = params.npcCharacterId.trim()
  if (!cid) return ''

  const keys = new Set<string>()
  const sid = params.sessionPlayerIdentityId.trim()
  const bid = params.boundPlayerIdentityId?.trim()
  /** 与会话档不一致的绑定：私聊摘录只用绑定档会话，避免「会话档」里对用户的叫法混进该角色的群认知 */
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
  const perKeyLimit = boost ? 120 : 80
  const merged = new Map<string, WeChatChatMessage>()
  for (const ck of keys) {
    try {
      const batch = await personaDb.listWeChatChatMessagesRecent({
        conversationKey: ck,
        limit: perKeyLimit,
      })
      for (const m of batch) merged.set(m.id, m)
    } catch {
      /* ignore */
    }
  }
  if (!merged.size) return ''

  const sorted = [...merged.values()].sort((a, b) => a.timestamp - b.timestamp)
  const cap = boost
    ? Math.max(12, Math.min(96, Math.floor(params.messageCap ?? 56)))
    : Math.max(8, Math.min(80, Math.floor(params.messageCap ?? 42)))
  const tail = sorted.slice(-cap)

  const lines: string[] = []
  for (const m of tail) {
    const line = formatPrivateMsgLine(m)
    if (line) lines.push(line)
  }
  if (!lines.length) return ''

  let body = lines.join('\n')
  const charCap = boost
    ? Math.max(1200, Math.min(14000, Math.floor(params.charCap ?? 5200)))
    : Math.max(800, Math.min(12000, Math.floor(params.charCap ?? 3800)))
  if (body.length > charCap) {
    const parts = body.split('\n')
    while (parts.join('\n').length > charCap && parts.length > 6) parts.shift()
    body = parts.join('\n')
    if (body.length > charCap) body = `${body.slice(-charCap)}\n…（更早私聊已截断）`
  }

  const tailHint = boost
    ? '（↑ 含用户刚离开私聊前的近期私聊；**本角色在群内须承接**，勿装作私聊未发生；仍勿当众宣读不宜公开的细节。）'
    : '（↑ 时间顺序由旧到新；编群聊时须承接其中约定与情绪，勿当成从未私聊过。）'

  return `${body}\n${tailHint}`
}

function formatGroupMsgLineForPrivateDigest(
  m: WeChatChatMessage,
  group: GroupChatRow | null,
  npcCharacterId: string,
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
  return `- [群「${gidLabel}」·${who}] ${clipOneLine(raw)}`
}

/**
 * 从本地 IndexedDB 拉取该 NPC 与当前用户**共同参与**的群聊之近期消息，合并后由调用方注入私聊 system 的**独立区块**（与线下剧情参考同级，**不经过模型、不额外请求**）。
 * 默认合并各群后取时间上最近约 `messageCap` 条（默认 50），与已落库的长期记忆总结互补。
 */
export async function buildNpcGroupChatsRecentDigestForPrivatePrompt(params: {
  npcCharacterId: string
  sessionPlayerIdentityId: string
  boundPlayerIdentityId?: string | null | undefined
  /** 若刚从该群切到私聊，优先只摘录此群近期消息，避免被其它更活跃群「顶掉」 */
  anchorGroupId?: string | null | undefined
  messageCap?: number
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

  const anchorGid = params.anchorGroupId?.trim()
  if (anchorGid) {
    const anchorRow = relevant.find((g) => g.id.trim() === anchorGid)
    if (anchorRow && (anchorRow.members ?? []).some((m) => m.charId.trim() === npcId)) {
      const ck = wechatGroupConversationKey(anchorGid, pid)
      let batch: WeChatChatMessage[] = []
      try {
        batch = await personaDb.listWeChatChatMessagesRecent({
          conversationKey: ck,
          limit: 100,
        })
      } catch {
        batch = []
      }
      const cap = Math.max(20, Math.min(120, Math.floor(params.messageCap ?? 50)))
      const sorted = [...batch].sort((a, b) => a.timestamp - b.timestamp)
      const tail = sorted.slice(-cap)
      const lines: string[] = []
      for (const m of tail) {
        const line = formatGroupMsgLineForPrivateDigest(m, anchorRow, npcId)
        if (line) lines.push(line)
      }
      if (lines.length) {
        let body = lines.join('\n')
        const charCap = Math.max(900, Math.min(12000, Math.floor(params.charCap ?? 4500)))
        if (body.length > charCap) {
          const parts = body.split('\n')
          while (parts.join('\n').length > charCap && parts.length > 8) parts.shift()
          body = parts.join('\n')
          if (body.length > charCap) body = `${body.slice(-charCap)}\n…（更早群聊已截断）`
        }
        const gname = (anchorRow.remark || anchorRow.name || '').trim() || '该群'
        return `${body}\n（↑ 为你们离开群聊前，在群「${gname}」内的近期摘录，时间由旧到新；私聊请**优先**承接该群语境，勿假装群内未聊过。）\n【说话人｜勿混淆】前缀「用户」仅指真人玩家；「对方角色·某某」为当前私聊对象在该群的发言。**禁止**把对方角色在群里的台词误当成用户说的。\n`
      }
    }
  }

  const groupById = new Map(relevant.map((g) => [g.id.trim(), g]))
  const perKeyLimit = 50
  const merged = new Map<string, WeChatChatMessage>()
  for (const g of relevant) {
    const ck = wechatGroupConversationKey(g.id, pid)
    try {
      const batch = await personaDb.listWeChatChatMessagesRecent({
        conversationKey: ck,
        limit: perKeyLimit,
      })
      for (const m of batch) merged.set(m.id, m)
    } catch {
      /* ignore */
    }
  }
  if (!merged.size) return ''

  const sorted = [...merged.values()].sort((a, b) => a.timestamp - b.timestamp)
  const cap = Math.max(12, Math.min(100, Math.floor(params.messageCap ?? 50)))
  const tail = sorted.slice(-cap)

  const lines: string[] = []
  for (const m of tail) {
    const gkey = parseGroupIdFromConversationKey(m.conversationKey)
    const g = gkey ? groupById.get(gkey) ?? null : null
    const line = formatGroupMsgLineForPrivateDigest(m, g, npcId)
    if (line) lines.push(line)
  }
  if (!lines.length) return ''

  let body = lines.join('\n')
  const charCap = Math.max(900, Math.min(12000, Math.floor(params.charCap ?? 4500)))
  if (body.length > charCap) {
    const parts = body.split('\n')
    while (parts.join('\n').length > charCap && parts.length > 8) parts.shift()
    body = parts.join('\n')
    if (body.length > charCap) body = `${body.slice(-charCap)}\n…（更早群聊已截断）`
  }

  return `${body}\n（↑ 为你们共同参与过的群聊近期摘录，时间由旧到新；私聊承接时请自然记得群中语境，勿假装群聊未发生。）\n【说话人｜勿混淆】前缀「用户」仅指真人玩家；「对方角色·某某」为当前私聊对象在该群的发言。**禁止**把对方角色在群里的台词误当成用户说的。\n`
}
