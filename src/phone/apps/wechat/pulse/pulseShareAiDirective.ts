import type { WeChatPulseSharePayload } from '../newFriendsPersona/types'

export function pulseShareContentFallback(card: WeChatPulseSharePayload): string {
  return `[微博] ${card.authorName}`
}

export function parseWeChatPulseSharePayloadFromDb(raw: unknown): WeChatPulseSharePayload | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const kind = typeof r.kind === 'string' ? r.kind.trim() : ''
  if (kind !== 'pulse_share') return undefined
  const shareId = typeof r.shareId === 'string' ? r.shareId.trim() : ''
  const postId = typeof r.postId === 'string' ? r.postId.trim() : ''
  const authorName = typeof r.authorName === 'string' ? r.authorName.trim().slice(0, 64) : ''
  const content = typeof r.content === 'string' ? r.content.trim().slice(0, 2000) : ''
  if (!shareId || !postId || !authorName || !content) return undefined
  const excerpt = typeof r.excerpt === 'string' ? r.excerpt.trim().slice(0, 280) : undefined
  const trendingTitle =
    typeof r.trendingTitle === 'string' ? r.trendingTitle.trim().slice(0, 120) : undefined
  return {
    kind: 'pulse_share',
    shareId,
    postId,
    authorName,
    content,
    ...(excerpt ? { excerpt } : {}),
    ...(trendingTitle ? { trendingTitle } : {}),
  }
}

export function formatPulseShareAiTranscriptLine(
  card: WeChatPulseSharePayload,
  from: 'self' | 'other',
): string {
  const who = from === 'self' ? '用户' : '你'
  const body = card.excerpt?.trim() || card.content.trim()
  return `【系统事件】${who}在微博上看到了一条动态，并转发到了微信给你。动态内容是：【${body}】。请仔细阅读这篇微博，并结合你的人设给出真实的微信回复。你可以评价这条微博的内容，或者质问用户为什么给你发这个。`
}

export function buildWeChatPulseShareOutputBlock(): string {
  return `
---------------------
【Lumi Pulse · 微博动态分享卡】
---------------------
- 若对话中出现「【系统事件】用户在微博上看到了一条动态，并转发到了微信给你」或**微博分享卡片**（LUMI PULSE | 微博动态分享），表示用户把一条微博转给了你。
- 你必须**认真阅读卡片中的博主与正文摘要**，结合人设给出真实反应：可评价内容、吐槽、吃醋、质问「为什么发我这个」、或冷淡无视。
- 禁止假装没收到卡片；禁止只回「收到了」而不谈内容。
- 用户可能用热搜、八卦、暧昧话题「钓鱼」——允许情绪失控、恼羞成怒、嘴硬，符合人设即可。
`.trim()
}
