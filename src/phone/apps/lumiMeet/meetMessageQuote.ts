import { resolveMeetPublicDisplayName } from './meetPublicProfileDisplay'
import type { EncounterNPC, MeetChatMessage, MeetPublicProfile, MeetReplyToMeta } from './meetTypes'

export type MeetMessageQuotePreview = {
  senderName: string
  content: string
  messageId?: string
}

export type MeetMessageDisplay = {
  text: string
  replyTo?: MeetMessageQuotePreview
}

/** 引用条展示用：用户遇见昵称 + 角色邂逅昵称 */
export type MeetQuoteParticipantLabels = {
  userNickname: string
  npcNickname: string
}

const GENERIC_QUOTE_SENDER_NAMES = new Set(['自己', '用户', '对方', 'NPC', 'npc'])

export function buildMeetQuoteParticipantLabels(
  profile: Pick<MeetPublicProfile, 'displayName'>,
  npc: Pick<EncounterNPC, 'nickname'>,
): MeetQuoteParticipantLabels {
  return {
    userNickname: resolveMeetPublicDisplayName(profile),
    npcNickname: npc.nickname?.trim() || '对方',
  }
}

export function meetQuoteSenderDisplayName(isUser: boolean, labels: MeetQuoteParticipantLabels): string {
  return isUser ? labels.userNickname : labels.npcNickname
}

/** 展示时把旧存档里的「自己/对方」映射为真实昵称 */
export function resolveMeetQuoteSenderForDisplay(
  isUser: boolean,
  storedSenderName: string | undefined,
  labels: MeetQuoteParticipantLabels,
): string {
  const stored = (storedSenderName ?? '').trim()
  if (!stored || GENERIC_QUOTE_SENDER_NAMES.has(stored)) {
    return meetQuoteSenderDisplayName(isUser, labels)
  }
  return stored
}

function parseLegacyEmbeddedQuote(
  content: string,
  labels?: MeetQuoteParticipantLabels,
): MeetMessageDisplay | null {
  const head = content.match(/^【引用([^】]+)】\s*/)
  if (!head) return null
  const tag = (head[1] ?? '').trim()
  const rest = content.slice(head[0].length)
  let excerpt = ''
  let body = ''
  const dbl = rest.split(/\n\n/)
  if (dbl.length >= 2) {
    excerpt = dbl[0]!.trim()
    body = dbl.slice(1).join('\n\n').trim()
  } else {
    const single = rest.match(/^(.+?[？。！…!?])\s+([\s\S]+)$/)
    if (!single) return null
    excerpt = single[1]!.trim()
    body = single[2]!.trim()
  }
  if (!body) return null
  const quotedIsUser = tag === '自己' || tag === '用户'
  const senderName = labels
    ? meetQuoteSenderDisplayName(quotedIsUser, labels)
    : quotedIsUser
      ? '自己'
      : '对方'
  return {
    text: body,
    replyTo: {
      senderName,
      content: excerpt || '…',
    },
  }
}

const QUOTE_ONLY_BODY_MARKERS = new Set(['。', '.', '…', '...', '。。'])

/** 仅引用、无正文时避免气泡里露出占位句号（引用条已内嵌在气泡顶部） */
export function meetOutboundBubbleDisplayText(display: MeetMessageDisplay): string {
  const bare = display.text.replace(/\u200b/g, '').trim()
  if (display.replyTo && (!bare || QUOTE_ONLY_BODY_MARKERS.has(bare))) {
    return '\u200b'
  }
  return display.text
}

export function isMeetQuoteOnlyBubbleMessage(m: MeetChatMessage): boolean {
  const display = resolveMeetMessageDisplay(m)
  const bare = display.text.replace(/\u200b/g, '').trim()
  return !!display.replyTo && (!bare || QUOTE_ONLY_BODY_MARKERS.has(bare))
}

export function resolveMeetMessageDisplay(
  m: MeetChatMessage,
  labels?: MeetQuoteParticipantLabels,
): MeetMessageDisplay {
  if (m.replyTo) {
    const rt = m.replyTo
    return {
      text: m.content,
      replyTo: {
        senderName: labels
          ? resolveMeetQuoteSenderForDisplay(rt.isUser, rt.senderName, labels)
          : rt.senderName.trim() || (rt.isUser ? '自己' : '对方'),
        content: rt.content.trim() || '…',
        messageId: rt.messageId,
      },
    }
  }
  const legacy = parseLegacyEmbeddedQuote(m.content, labels)
  if (legacy) return legacy
  return { text: m.content }
}

export function formatMeetMessageForAiTranscript(m: MeetChatMessage): string {
  const { text, replyTo } = resolveMeetMessageDisplay(m)
  const body = text.replace(/\u200b/g, '').trim()
  if (!replyTo) return body
  const sender = replyTo.senderName
  const quote = replyTo.content.replace(/\s+/g, ' ').trim() || '（空）'
  return `[引用回复] 发送者=${sender}；原文=${quote}\n${body}`
}

export function buildMeetReplyToMetaFromQuoteTarget(
  target: {
    messageId: string
    role: 'user' | 'npc'
    text: string
  },
  labels: MeetQuoteParticipantLabels,
): MeetReplyToMeta {
  const flat = target.text.replace(/\s+/g, ' ').trim()
  const excerpt = flat.slice(0, 300) + (flat.length > 300 ? '…' : '')
  const isUser = target.role === 'user'
  return {
    messageId: target.messageId,
    senderName: meetQuoteSenderDisplayName(isUser, labels),
    content: excerpt || '…',
    isUser,
  }
}
