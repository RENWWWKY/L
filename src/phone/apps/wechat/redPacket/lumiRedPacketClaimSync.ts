import type { WeChatRedPacketPayload } from '../newFriendsPersona/types'

export type ChatMsgWithRedPacket = {
  id: string
  from: 'self' | 'other'
  text?: string
  redPacket?: WeChatRedPacketPayload
}

/** 用户是否在请你（助手）帮忙领取 / 拆开其红包 */
export function userAsksAssistantToClaimRedPacket(userLine: string): boolean {
  const t = userLine.trim()
  if (!t || !/红包/.test(t)) return false
  if (/(不要|別|别|勿|不用|无需|算了|千万).{0,8}(领|领取|收|拆|开)/i.test(t)) return false
  if (!/(领|领取|收|拆|开)/i.test(t)) return false
  return (
    /(你|帮我|替我|请|麻烦).{0,10}(领|领取|收|拆|开)/i.test(t) ||
    /领.{0,6}一下.{0,12}红包/i.test(t) ||
    /领.{0,12}红包/i.test(t) ||
    /领取.{0,14}红包/i.test(t) ||
    /(拆|开).{0,8}红包/i.test(t)
  )
}

/** Lumi 回复是否表达「已替你领 / 已收下」等完成态（用于同步 opened） */
export function lumiReplyClaimsRedPacketOpened(replyJoined: string): boolean {
  const t = replyJoined.replace(/\s+/g, '')
  if (!t) return false
  if (/(领不了|不能领|无法领|还没领|尚未领|没领到|领不到|领不了|别领了|不要领|无法拆|点不了|你自己点)/i.test(t)) return false
  /**
   * 必须与「领/拆红包」强相关；禁止单独用「收到」「收下」作子串匹配（否则大量日常对白误触，
   * 导致同轮每条台词后都追加一条「领取了你的红包」系统条）。
   */
  if (
    /(已|已经)(领取|领完|领到|领了|拆开|拆啦|打开|点开)/.test(t) ||
    /领好(了|咯|啦|惹)/.test(t) ||
    /(帮你|替你|代你)领(了|好|完)?/.test(t) ||
    /领取(了|好|完)/.test(t) ||
    /领了|领完|领过(咯|了|啦)|领好(咯|啦)/.test(t) ||
    /(拆|开)(了|啦|咯|好)?红包/.test(t) ||
    /红包.{0,6}(拆|开|领)(了|啦|咯)?/.test(t) ||
    /收到(啦|了|咯|惹)|已收到|已经收到|心意收到/.test(t) ||
    /收下(了|啦|咯|惹)/.test(t) ||
    /谢谢.{0,6}红包/.test(t) ||
    /替你收/.test(t) ||
    /我领(了|好|完)?|我收好(了|咯|啦)?/.test(t)
  ) {
    return true
  }
  return false
}

/** 会话中最近一条本人发出且未拆的红包消息 id */
export function findLatestUnopenedSelfRedPacketId(msgs: ChatMsgWithRedPacket[]): string | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m.from !== 'self') continue
    const rp = m.redPacket
    if (!rp || rp.opened || rp.expired) continue
    return m.id
  }
  return null
}

/** 从最近到较早，收集己方纯文本气泡（不含红包结构化字段时的占位），用于意图判定 */
export function recentSelfPlainTextLines(msgs: ChatMsgWithRedPacket[], maxLines = 10): string[] {
  const out: string[] = []
  for (let i = msgs.length - 1; i >= 0 && out.length < maxLines; i--) {
    const m = msgs[i]
    if (m.from !== 'self') continue
    const t = (m.text ?? '').trim()
    if (t) out.push(t)
  }
  return out
}

/**
 * 是否可与 Lumi 的「已代领」话术联动写 opened：
 * - 明确请你领红包；或
 * - 明显的测试/追问语境（如「再来一个我测试一下」），且不包含拒绝领拆。
 */
export function userIntentAllowsLumiRedPacketClaimSync(recentSelfLines: string[]): boolean {
  for (const line of recentSelfLines) {
    if (userAsksAssistantToClaimRedPacket(line)) return true
    const t = line.trim()
    if (!t) continue
    if (/(不要|別|别|勿|不用).{0,8}(领|领取|拆|收|开)/i.test(t)) continue
    if (
      /(再来)?一个|试一下|试试|测试一下|测一下|我测|领好没|领了没|收下没|搞定|好了没/i.test(t)
    ) {
      return true
    }
  }
  return false
}
