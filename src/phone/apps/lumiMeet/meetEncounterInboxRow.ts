import { formatWeChatMessagesTabPreviewFromStoredMessageContent } from '../wechat/wechatThreadPreviewText'
import { resolveMeetMessageDisplay } from './meetMessageQuote'
import type { EncounterNPC, LumiMeetPersistedState, MeetChatMessage } from './meetTypes'

const MEET_INBOX_NPC_STATUSES: EncounterNPC['status'][] = ['matched', 'wechat_added']

/** 时间戳最大的一条（会话列表预览与排序） */
export function pickLastMeetThreadMessage(thread: MeetChatMessage[]): MeetChatMessage | undefined {
  if (!thread.length) return undefined
  return thread.reduce((a, b) => (a.ts >= b.ts ? a : b))
}

/**
 * 与微信「信息」列表一致：末条正文经 `formatWeChatMessagesTabPreviewFromStoredMessageContent`，最长约 48 字。
 */
export function formatMeetEncounterListPreview(msg: MeetChatMessage | undefined, peerNickname: string): string {
  const nick = peerNickname.trim() || '对方'
  if (!msg) return `点击开始与 ${nick} 聊天`
  if (msg.kind === 'wechat_swap_card') return '[互换名片]'
  if (msg.kind === 'meet_echo_reveal') return '[灵魂盲盒·已揭晓]'
  if (msg.kind === 'meet_truth_mirror_record') return '[交换真心话]'
  if (msg.kind === 'meet_truth_mirror_char_request') return '[对方邀约 · 交换真心话]'
  if (msg.kind === 'meet_truth_mirror_user_response') {
    return msg.meetTruthMirrorUserResponse?.outcome === 'accepted' ? '[你已应允真心话]' : '[你已暂缓真心话]'
  }
  if (msg.kind === 'meet_contract_user_request') return '[缔结契约 · 请求]'
  if (msg.kind === 'meet_contract_npc_status') return '[缔结契约 · 判定]'
  if (msg.kind === 'meet_contract_char_request') return '[对方邀约 · 交换联络]'
  if (msg.kind === 'meet_contract_user_response') {
    return msg.meetContractStatus?.outcome === 'accepted' ? '[你已应允互换]' : '[你已暂缓互换]'
  }
  const pv = formatWeChatMessagesTabPreviewFromStoredMessageContent(resolveMeetMessageDisplay(msg).text)
  const line = (pv.split(/\r?\n/)[0] ?? '').trim()
  if (!line) return msg.role === 'user' ? '[图片]' : '对方发来一条消息'
  return line.slice(0, 48) + (line.length > 48 ? '…' : '')
}

/** 与 `WeChatApp` 内 `buildOne` 一致：有末条时用该消息本地时间的 HH:MM */
export function formatMeetEncounterListTime(ts: number | undefined): string {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return '—'
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 未读：对方消息且时间戳晚于已读水位（与微信私聊未读计数语义一致，仅计 npc） */
export function countUnreadMeetEncounterThread(thread: MeetChatMessage[], lastReadTs: number | undefined): number {
  const cutoff = lastReadTs ?? 0
  return thread.filter((m) => m.role === 'npc' && m.ts > cutoff).length
}

/** 消息页全部会话未读之和（与 `EncounterChats` 各行角标累加一致） */
export function countTotalMeetInboxUnread(
  state: Pick<LumiMeetPersistedState, 'npcs' | 'chatThreads' | 'meetInboxLastReadTsByNpcId'>,
): number {
  let total = 0
  for (const n of state.npcs) {
    if (!MEET_INBOX_NPC_STATUSES.includes(n.status)) continue
    total += countUnreadMeetEncounterThread(
      state.chatThreads[n.id] ?? [],
      state.meetInboxLastReadTsByNpcId[n.id],
    )
  }
  return total
}
