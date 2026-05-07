import type { WeChatChatMessage } from '../wechat/newFriendsPersona/types'
import type { IndexedTrashEntry } from './indexedTrashTypes'

/** 从回收站条目中取出可展示的聊天消息（按时间升序） */
export function extractTrashChatMessages(entry: IndexedTrashEntry): WeChatChatMessage[] | null {
  if (entry.kind === 'wechat-message') {
    const p = entry.payload as { message?: WeChatChatMessage }
    return p.message ? [p.message] : null
  }
  if (entry.kind === 'wechat-conversation' || entry.kind === 'group-chat') {
    const p = entry.payload as { messages?: WeChatChatMessage[] }
    if (!Array.isArray(p.messages)) return null
    return [...p.messages].sort((a, b) => a.timestamp - b.timestamp)
  }
  return null
}

export function formatTrashMessageTime(ts: number): string {
  const d = new Date(ts)
  const mo = d.getMonth() + 1
  const day = d.getDate()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${mo}/${day} ${h}:${m}`
}

export function formatTrashMessageBody(m: WeChatChatMessage): string {
  if (m.isRecalled) {
    const orig = (m.originalContent || '').trim()
    return orig ? `（已撤回）${orig}` : '（已撤回）'
  }
  if (m.redPacket) {
    const r = m.redPacket
    const t = typeof r.remark === 'string' ? r.remark.trim() : ''
    return t ? `［红包］${t}` : '［红包］'
  }
  if (m.transfer) return '［转账］'
  if (m.voice) {
    const tx = m.voice.transcriptText?.trim()
    return tx ? `［语音］${tx}` : '［语音］'
  }
  if (m.images?.length) {
    const t = (m.content || '').trim()
    return t || `［图片 ×${m.images.length}］`
  }
  if (m.callStatus) return '［通话］'
  const t = (m.content || '').trim()
  return t || '（无文字）'
}

export function senderLabelForTrashMessage(m: WeChatChatMessage, isGroup: boolean): string {
  if (m.type === 'player') return '我'
  return isGroup ? '角色' : '对方'
}
