import type { WeChatChatMessage } from '../newFriendsPersona/types'
import type { RedPacketHistoryRow } from './redPacketHistoryTypes'

/** 红包记录列表：固定为「年月日 + 时分」，例如 2026年4月15日 14:30 */
export function formatRedPacketHistoryDateTime(ts: number): string {
  const d = new Date(ts)
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * 将 IndexedDB 中的红包消息拆成「收到 / 发出」两组，并解析对方昵称与头像。
 */
export function buildRedPacketHistoryLists(
  msgs: WeChatChatMessage[],
  resolvePeer: (characterId: string) => { remarkName: string; avatarUrl?: string },
): { received: RedPacketHistoryRow[]; sent: RedPacketHistoryRow[] } {
  const byTime = (a: WeChatChatMessage, b: WeChatChatMessage) => b.timestamp - a.timestamp
  const receivedMsgs = msgs.filter((m) => m.redPacket && m.type === 'character').sort(byTime)
  const sentMsgs = msgs.filter((m) => m.redPacket && m.type === 'player').sort(byTime)
  const mapRow = (m: WeChatChatMessage): RedPacketHistoryRow => {
    const rp = m.redPacket!
    const peer = resolvePeer(m.characterId)
    return {
      id: m.id,
      peerLabel: peer.remarkName,
      peerAvatarUrl: peer.avatarUrl,
      timeLabel: formatRedPacketHistoryDateTime(m.timestamp),
      amountYuan: rp.amountYuan,
      status: rp.opened ? 'Opened' : 'Pending',
    }
  }
  return {
    received: receivedMsgs.map(mapRow),
    sent: sentMsgs.map(mapRow),
  }
}
