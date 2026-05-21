import { meetMessageToContextNarrative } from './meetEncounterTranscript'
import {
  meetQuoteSenderDisplayName,
  resolveMeetMessageDisplay,
  type MeetQuoteParticipantLabels,
} from './meetMessageQuote'
import type { MeetChatMessage, MeetReplyToMeta } from './meetTypes'

/** 注入模型「最近对话」的条数上限（含口语气泡与【契约/真心话】等叙述行） */
export const MEET_PROMPT_CONTEXT_MAX_LINES = 32

export type MeetNpcOutboundBubble = {
  text: string
  replyTo?: MeetReplyToMeta
}

/** 可被 [引用:消息ID] 指向的临时会话消息 */
export function isMeetQuotableMessage(m: MeetChatMessage): boolean {
  if (m.kind) return false
  if (m.images?.[0]?.base64?.trim()) return true
  const raw = m.content.replace(/\u200b/g, '').trim()
  return raw.length > 0
}

/** 引用条 / replyTo 快照用的正文预览 */
export function meetMessagePlainPreview(m: MeetChatMessage): string {
  if (m.kind === 'wechat_swap_card') return '[互换名片]'
  if (m.kind === 'meet_echo_reveal') return '[灵魂盲盒·已揭晓]'
  if (m.kind === 'meet_truth_mirror_record') return '[交换真心话]'
  if (m.kind === 'meet_truth_mirror_char_request') return '[对方邀约 · 交换真心话]'
  if (m.kind === 'meet_truth_mirror_user_response') return '[交换真心话 · 用户回应]'
  if (m.kind === 'meet_contract_user_request') return '[缔结契约 · 请求]'
  if (m.kind === 'meet_contract_npc_status') return '[缔结契约 · 判定]'
  if (m.kind === 'meet_contract_char_request') return '[对方邀约 · 交换联络]'
  if (m.kind === 'meet_contract_user_response') return '[缔结契约 · 用户回应]'
  if (m.kind === 'meet_music_share') return '[同频共听]'
  if (m.kind === 'meet_system') return m.content.trim() || '[系统提示]'
  if (m.images?.[0]?.base64?.trim()) {
    const cap = m.content.replace(/\u200b/g, '').trim()
    return cap ? `[图片] ${cap.slice(0, 80)}` : '[图片]'
  }
  const snap = resolveMeetMessageDisplay(m).text.replace(/\u200b/g, '').trim()
  return snap || '…'
}

export function buildMeetReplyMetaFromMessageId(
  thread: MeetChatMessage[],
  messageId: string,
  labels: MeetQuoteParticipantLabels,
): MeetReplyToMeta | null {
  const id = messageId.trim()
  if (!id) return null
  const target = thread.find((m) => m.id === id)
  if (!target || !isMeetQuotableMessage(target)) return null
  const isUser = target.role === 'user'
  return {
    messageId: target.id,
    senderName: meetQuoteSenderDisplayName(isUser, labels),
    content: meetMessagePlainPreview(target).slice(0, 300),
    isUser,
  }
}

/** 解析模型单行中的 [引用:消息ID]（与微信私聊 ChatRoom.parseReplyMarker 一致） */
export function parseMeetReplyMarker(raw: string): { replyMessageId?: string; text: string } {
  const line = String(raw ?? '')
    .replace(/\s*(?:\[消息ID[:：][^\]]+\]|【消息ID[:：][^】]+】)\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (!line) return { text: '' }

  const inline = line.match(/^\[引用[:：]([^\]]+)\]\s*(.*)$/s)
  if (inline) {
    return {
      replyMessageId: inline[1]?.trim() || undefined,
      text: (inline[2] ?? '').trim(),
    }
  }
  const pure = line.match(/^\[引用[:：]([^\]]+)\]$/)
  if (pure) return { replyMessageId: pure[1]?.trim() || undefined, text: '' }

  const legacyHeader = line.match(
    /^\[引用回复\]\s*本条正在回复[:：]\s*消息ID\s*[=：:]\s*([^;；\s]+)\s*[;；]?\s*([\s\S]*)$/,
  )
  if (legacyHeader) {
    const replyMessageId = legacyHeader[1]?.trim() || undefined
    const tail = (legacyHeader[2] ?? '').trim()
    const text = tail
      .replace(/^(?:发送者\s*[=：:]\s*[^;；\n]+[;；]?\s*)+/u, '')
      .replace(/^(?:原文\s*[=：:]\s*[^;；\n]+[;；]?\s*)+/u, '')
      .trim()
    return { replyMessageId, text }
  }

  return { text: line }
}

/**
 * 将模型多行正文规划为气泡（引用协议与微信私聊一致）：
 * - `[引用:id]` 仅挂到**下一条有正文**的气泡，不单独成条
 * - 末尾孤儿引用标记丢弃
 */
export function planMeetNpcOutboundBubbles(
  bubbleLines: string[],
  thread: MeetChatMessage[],
  labels: MeetQuoteParticipantLabels,
): MeetNpcOutboundBubble[] {
  const out: MeetNpcOutboundBubble[] = []
  let pendingReplyMessageId: string | undefined

  for (const raw of bubbleLines) {
    const { replyMessageId, text } = parseMeetReplyMarker(raw)
    if (replyMessageId) {
      pendingReplyMessageId = replyMessageId
    }
    const body = text.trim()
    if (!body) continue

    const replyTo = pendingReplyMessageId
      ? buildMeetReplyMetaFromMessageId(thread, pendingReplyMessageId, labels) ?? undefined
      : undefined
    pendingReplyMessageId = undefined

    out.push({
      text: body,
      ...(replyTo ? { replyTo } : {}),
    })
  }

  return out
}

/** 供模型读历史：带消息 ID 的会话行 */
export function meetThreadToPromptLines(
  thread: MeetChatMessage[],
  labels: MeetQuoteParticipantLabels,
  max = MEET_PROMPT_CONTEXT_MAX_LINES,
): string[] {
  const speakerLabels = { user: labels.userNickname, npc: labels.npcNickname }
  const lines: string[] = []
  for (const m of thread) {
    const narrative = meetMessageToContextNarrative(m, speakerLabels)
    if (narrative) {
      lines.push(narrative)
      continue
    }
    if (!isMeetQuotableMessage(m)) continue
    const role = m.role === 'user' ? labels.userNickname : labels.npcNickname
    const body = resolveMeetMessageDisplay(m, labels).text.replace(/\u200b/g, '').trim()
    if (!body) continue
    let line = `${role}[消息ID:${m.id}] ${body}`
    if (m.replyTo?.messageId) {
      line += `\n[引用回复] 本条正在回复：消息ID=${m.replyTo.messageId}；发送者=${m.replyTo.senderName}；原文=${m.replyTo.content}`
    }
    lines.push(line)
  }
  return lines.slice(-max)
}
