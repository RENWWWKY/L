/**
 * 红包收发记录列表行类型。数据由 `buildRedPacketHistoryLists` 从 IndexedDB 消息聚合生成。
 */
export type RedPacketHistoryStatus = 'Opened' | 'Expired' | 'Pending'

export type RedPacketHistoryRow = {
  id: string
  /** 列表主标题：收到页为发送方；发出页为接收方角色名 */
  peerLabel: string
  peerAvatarUrl?: string
  /** 展示用时间文案 */
  timeLabel: string
  amountYuan: number
  status: RedPacketHistoryStatus
}
