import type { WeChatChatMessage } from './newFriendsPersona/types'
import { personaDb } from './newFriendsPersona/idb'
import { stripWechatGroupEventNoticePrefix } from './groupChatEventNotice'
import { wechatConversationKey } from './wechatConversationKey'

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

  const perKeyLimit = 80
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
  const cap = Math.max(8, Math.min(80, Math.floor(params.messageCap ?? 42)))
  const tail = sorted.slice(-cap)

  const lines: string[] = []
  for (const m of tail) {
    const line = formatPrivateMsgLine(m)
    if (line) lines.push(line)
  }
  if (!lines.length) return ''

  let body = lines.join('\n')
  const charCap = Math.max(800, Math.min(12000, Math.floor(params.charCap ?? 3800)))
  if (body.length > charCap) {
    const parts = body.split('\n')
    while (parts.join('\n').length > charCap && parts.length > 6) parts.shift()
    body = parts.join('\n')
    if (body.length > charCap) body = `${body.slice(-charCap)}\n…（更早私聊已截断）`
  }

  return `${body}\n（↑ 时间顺序由旧到新；编群聊时须承接其中约定与情绪，勿当成从未私聊过。）`
}
