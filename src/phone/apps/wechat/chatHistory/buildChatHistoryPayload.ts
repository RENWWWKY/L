import type { WeChatChatMessage, WeChatChatHistoryPayload, WeChatForwardedMessageItem } from '../newFriendsPersona/types'
import { buildForwardedMessageFromChat } from './normalizeForwardedMessageItem'

export const LEGACY_MERGE_FORWARD_PREFIX = '__wx_merge_forward__:' as const

export function messageContentSummary(m: WeChatChatMessage): string {
  if (m.isRecalled) return '该消息已撤回'
  if (m.sharedRecord) return `[收藏] ${m.sharedRecord.contentSummary}`.trim()
  if (m.chatHistory) return `[聊天记录] ${m.chatHistory.title}`.trim()
  if (m.voice) {
    const t = m.voice.transcriptText?.trim() || m.content?.trim()
    return t ? `[语音] ${t}` : '[语音]'
  }
  if (m.images?.length) return '[图片]'
  if (m.redPacket) return `[红包] ${(m.redPacket.remark ?? '').trim() || '红包'}`.trim()
  if (m.transfer) return '[转账]'
  if (m.callStatus) return '[通话]'
  if (m.musicSync) return '[音乐]'
  if (m.listenCommentShare) return `[分享评论] ${m.listenCommentShare.targetTitle}`
  if (m.listenProfileShare) return `[分享主页] ${m.listenProfileShare.displayName}`
  if (m.listenTrackShare) {
    const prefix = m.listenTrackShare.targetType === 'song' ? '[分享单曲]' : '[分享歌单]'
    return `${prefix} ${m.listenTrackShare.targetTitle}`
  }
  if (m.pulseShare) return `[微博] ${m.pulseShare.authorName}`
  const text = (m.content ?? '').trim()
  if (text.startsWith(LEGACY_MERGE_FORWARD_PREFIX)) return '[聊天记录]'
  return text || '...'
}

export function buildChatHistoryPayloadFromMessages(params: {
  messages: WeChatChatMessage[]
  userName: string
  peerName: string
  peerCharacterId?: string
}): WeChatChatHistoryPayload {
  const userName = params.userName.trim() || '我'
  const peerName = params.peerName.trim() || '对方'
  const peerCharacterId = params.peerCharacterId?.trim() || undefined
  const sorted = [...params.messages].sort((a, b) => a.timestamp - b.timestamp)
  const messages: WeChatForwardedMessageItem[] = sorted.map((m) =>
    buildForwardedMessageFromChat({
      message: m,
      userName,
      peerName,
      peerCharacterId,
    }),
  )
  return {
    kind: 'chat_history',
    title: `${userName} 和 ${peerName} 的聊天记录`,
    messages,
    participants: {
      a: { kind: 'player', displayName: userName },
      b: {
        kind: 'character',
        displayName: peerName,
        ...(peerCharacterId ? { characterId: peerCharacterId } : {}),
      },
    },
  }
}

export function chatHistoryPreviewLines(payload: WeChatChatHistoryPayload, max = 4): string[] {
  return payload.messages.slice(0, max).map((m) => {
    const name = m.senderName.trim() || '未知'
    const body = m.content.trim() || '...'
    const line = `${name}: ${body}`
    return line.length > 36 ? `${line.slice(0, 35)}…` : line
  })
}

/** 兼容旧版 content 前缀合并转发 */
export function parseLegacyMergeForwardContent(content: string): WeChatChatHistoryPayload | null {
  const raw = String(content ?? '').trim()
  if (!raw.startsWith(LEGACY_MERGE_FORWARD_PREFIX)) return null
  try {
    const parsed = JSON.parse(raw.slice(LEGACY_MERGE_FORWARD_PREFIX.length)) as {
      title?: unknown
      previewLines?: unknown
      messageList?: unknown
    }
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '聊天记录'
    const list = Array.isArray(parsed.messageList) ? parsed.messageList : []
    const userName = title.includes(' 和 ') ? title.split(' 和 ')[0]?.trim() || '我' : '我'
    const peerName = title.includes(' 和 ') ? title.split(' 和 ')[1]?.replace(/的聊天记录$/, '').trim() || '对方' : '对方'
    const messages = list
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const row = item as { type?: unknown; content?: unknown; timestamp?: unknown }
        const senderName = row.type === 'player' ? userName : peerName
        const contentText = typeof row.content === 'string' ? row.content.trim() : ''
        const tsRaw = typeof row.timestamp === 'number' ? row.timestamp : Number(row.timestamp)
        const timestamp = Number.isFinite(tsRaw) ? Math.floor(tsRaw) : undefined
        if (!contentText) return null
        const msg: WeChatForwardedMessageItem = {
          senderName,
          content: contentText.slice(0, 500),
        }
        if (timestamp !== undefined) msg.timestamp = timestamp
        return msg
      })
      .filter((x): x is WeChatForwardedMessageItem => x !== null)
    if (messages.length) {
      return { kind: 'chat_history', title, messages }
    }
    const previewLines = Array.isArray(parsed.previewLines)
      ? parsed.previewLines.filter((x): x is string => typeof x === 'string')
      : []
    if (previewLines.length) {
      return {
        kind: 'chat_history',
        title,
        messages: previewLines.map((line) => {
          const idx = line.indexOf('：')
          if (idx > 0) {
            return { senderName: line.slice(0, idx).trim(), content: line.slice(idx + 1).trim() }
          }
          return { senderName: '未知', content: line.trim() }
        }),
      }
    }
    return { kind: 'chat_history', title, messages: [] }
  } catch {
    return null
  }
}

export function resolveChatHistoryFromStoredMessage(
  m: Pick<WeChatChatMessage, 'chatHistory' | 'content'>,
): WeChatChatHistoryPayload | null {
  if (m.chatHistory?.kind === 'chat_history' && m.chatHistory.title.trim()) {
    return m.chatHistory
  }
  return parseLegacyMergeForwardContent(m.content ?? '')
}
