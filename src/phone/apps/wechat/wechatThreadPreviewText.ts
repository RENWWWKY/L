/**
 * 须与 `groupChatEventNotice.ts` 内 `WECHAT_GROUP_EVENT_NOTICE_PREFIX` 保持一致（本文件不 import 该模块，避免与 idb 循环依赖）。
 */
const WECHAT_GROUP_EVENT_NOTICE_PREFIX = '__WX_GRP_EVT__:'

function stripGroupEventNoticePrefixLocal(raw: string): string {
  const s = String(raw ?? '')
  const t = s.trimStart()
  if (t.startsWith(WECHAT_GROUP_EVENT_NOTICE_PREFIX)) return t.slice(WECHAT_GROUP_EVENT_NOTICE_PREFIX.length)
  return s
}

/** 聊天协议：表情包/表情行（含 `[表情包]引用名`），预览统一显示为 `[动画表情]` */
export function isWeChatStickerPreviewContent(content: string): boolean {
  const pc = stripGroupEventNoticePrefixLocal(String(content ?? '').trim()).trim()
  if (!pc) return false
  const firstLine = (pc.split(/\r?\n/)[0] ?? '').trim()
  return firstLine.startsWith('[表情包]') || firstLine.startsWith('[表情]')
}

/**
 * 微信「信息」会话列表、新消息通知摘要等：去掉群系统灰条前缀后，若以 `[表情包]` / `[表情]` 协议开头则统一显示 `[动画表情]`，不暴露引用名。
 */
export function formatWeChatMessagesTabPreviewFromStoredMessageContent(content: string): string {
  if (isWeChatStickerPreviewContent(content)) return '[动画表情]'
  const pc = stripGroupEventNoticePrefixLocal(String(content ?? '').trim()).trim()
  if (!pc) return pc
  return pc
}

type NotifyPreviewMessage = {
  content: string
  voice?: { durationSec?: number; transcriptText?: string } | null
  images?: unknown[] | null
  redPacket?: unknown | null
  transfer?: unknown | null
  musicSync?: unknown | null
  listenCommentShare?: unknown | null
  listenProfileShare?: unknown | null
  listenTrackShare?: unknown | null
  locationShare?: unknown | null
  takeoutOrder?: unknown | null
  pulseShare?: unknown | null
  sharedRecord?: unknown | null
  chatHistory?: unknown | null
}

/** 微信「信息」会话列表末条预览（与通知摘要规则一致） */
export function formatWeChatMessagesTabPreviewFromStoredMessage(msg: NotifyPreviewMessage): string {
  return formatWeChatNotifyPreviewFromStoredMessage(msg)
}

/** 系统通知栏摘要：语音显示为 `[语音]X"`（X=秒数） */
export function formatWeChatNotifyPreviewFromStoredMessage(msg: NotifyPreviewMessage): string {
  if (msg.voice) {
    const sec = Math.max(1, Math.round(msg.voice.durationSec || 1))
    return `[语音]${sec}"`
  }
  const pc = stripGroupEventNoticePrefixLocal(String(msg.content ?? '').trim()).trim()
  const firstLine = (pc.split(/\r?\n/)[0] ?? '').trim()
  if (firstLine.startsWith('[语音]')) {
    const voiceDurationMatch = /\[语音\](\d+)/.exec(firstLine)
    const sec = voiceDurationMatch ? Number(voiceDurationMatch[1]) : 1
    return `[语音]${Math.max(1, Math.round(sec))}"`
  }
  if (msg.transfer) return '[转账]'
  if (msg.listenCommentShare) return '[分享评论]'
  if (msg.listenProfileShare) return '[分享主页]'
  if (msg.listenTrackShare) return '[分享音乐]'
  if (msg.locationShare) return '[位置]'
  if (msg.takeoutOrder) return '[外卖]'
  if (msg.pulseShare) return '[微博]'
  if (msg.sharedRecord) return '[收藏]'
  if (msg.chatHistory) return '[聊天记录]'
  if (msg.musicSync) return '[音乐]'
  if (msg.redPacket) return '[红包]'
  if (isWeChatStickerPreviewContent(msg.content)) return '[动画表情]'
  if (msg.images?.length) return '[图片]'
  return formatWeChatMessagesTabPreviewFromStoredMessageContent(msg.content)
}
