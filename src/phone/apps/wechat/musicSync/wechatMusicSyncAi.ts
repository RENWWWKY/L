import type { WeChatMusicSyncInvitePayload } from '../newFriendsPersona/types'

export const MUSIC_SYNC_AWAITING_REPLY_SESSION_KEY = 'lumi-music-sync-awaiting-reply'

export const MUSIC_SYNC_AWAITING_REPLY_EVENT = 'wechat:music-sync-awaiting-reply'

export type MusicSyncAwaitingReplyPayload = {
  conversationKey: string
  characterId: string
  inviteId: string
}

export function markMusicSyncAwaitingReply(payload: MusicSyncAwaitingReplyPayload): void {
  const conversationKey = payload.conversationKey.trim()
  const characterId = payload.characterId.trim()
  const inviteId = payload.inviteId.trim()
  if (!conversationKey || !characterId || !inviteId) return
  const body: MusicSyncAwaitingReplyPayload = { conversationKey, characterId, inviteId }
  try {
    sessionStorage.setItem(MUSIC_SYNC_AWAITING_REPLY_SESSION_KEY, JSON.stringify(body))
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent<MusicSyncAwaitingReplyPayload>(MUSIC_SYNC_AWAITING_REPLY_EVENT, { detail: body }),
  )
}

export function peekMusicSyncAwaitingReply(conversationKey: string): MusicSyncAwaitingReplyPayload | null {
  try {
    const raw = sessionStorage.getItem(MUSIC_SYNC_AWAITING_REPLY_SESSION_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as MusicSyncAwaitingReplyPayload
    if (p.conversationKey?.trim() !== conversationKey.trim()) return null
    if (!p.inviteId?.trim() || !p.characterId?.trim()) return null
    return {
      conversationKey: p.conversationKey.trim(),
      characterId: p.characterId.trim(),
      inviteId: p.inviteId.trim(),
    }
  } catch {
    return null
  }
}

export function consumeMusicSyncAwaitingReply(conversationKey: string): MusicSyncAwaitingReplyPayload | null {
  const p = peekMusicSyncAwaitingReply(conversationKey)
  if (!p) return null
  try {
    sessionStorage.removeItem(MUSIC_SYNC_AWAITING_REPLY_SESSION_KEY)
  } catch {
    // ignore
  }
  return p
}

export function formatMusicSyncInviteTranscriptLine(
  messageId: string,
  data: WeChatMusicSyncInvitePayload,
): string {
  const artist = data.trackArtist?.trim() || '未知歌手'
  const mid = messageId.trim() || data.inviteId
  return `（用户向你发来音乐共听邀约：《${data.trackTitle}》— ${artist}；messageId=${mid}；inviteId=${data.inviteId}）`
}

export function parseMusicSyncIncomingActionDirective(
  raw: string,
): { kind: 'accept' | 'decline'; messageId?: string; replyText?: string } | null {
  const normalized = String(raw ?? '')
    .trim()
    .replace(/\r\n/g, '\n')
  const tryOne = (tag: string, kind: 'accept' | 'decline') => {
    const tagOnly = new RegExp(`^\\[${tag}\\]$`, 'i').exec(normalized)
    if (tagOnly) return { kind }

    const inline = new RegExp(`^\\[${tag}\\]\\s*(\\{[\\s\\S]*\\})$`, 'i').exec(normalized)
    if (!inline) return null
    try {
      const j = JSON.parse(inline[1]!) as { messageId?: unknown; inviteId?: unknown; replyText?: unknown }
      const messageId =
        (typeof j.messageId === 'string' ? j.messageId.trim() : '') ||
        (typeof j.inviteId === 'string' ? j.inviteId.trim() : '')
      const replyText = typeof j.replyText === 'string' ? j.replyText.trim().slice(0, 500) : ''
      return { kind, messageId: messageId || undefined, replyText: replyText || undefined }
    } catch {
      return { kind }
    }
  }
  return tryOne('MUSIC_SYNC_ACCEPT', 'accept') ?? tryOne('MUSIC_SYNC_DECLINE', 'decline')
}

/** 模型把指令行与 JSON 拆成两条气泡时，尝试合并解析 */
export function mergeMusicSyncDirectiveBubbleLines(currentLine: string, nextLine?: string): string {
  const current = String(currentLine ?? '').trim()
  const next = String(nextLine ?? '').trim()
  if (/^\[MUSIC_SYNC_(ACCEPT|DECLINE)\]$/i.test(current) && next.startsWith('{') && next.endsWith('}')) {
    return `${current}${next}`
  }
  return current
}

/** 不应作为角色口语气泡展示的指令残留行 */
export function isMusicSyncDirectiveArtifactLine(line: string): boolean {
  const t = String(line ?? '').trim()
  if (!t) return false
  if (parseMusicSyncIncomingActionDirective(t)) return true
  if (!t.startsWith('{') || !t.endsWith('}')) return false
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    if (!j || typeof j !== 'object' || Array.isArray(j)) return false
    const keys = Object.keys(j)
    if (keys.length === 0) return false
    return keys.every((k) => k === 'messageId' || k === 'inviteId' || k === 'replyText')
  } catch {
    return false
  }
}

export type MusicInviteMsgLike = {
  id: string
  from: 'self' | 'other'
  musicSync?: {
    kind: string
    inviteId: string
    trackTitle?: string
    trackArtist?: string
    coverUrl?: string
  }
}

export function hasMusicSyncResponseForInvite(msgs: readonly MusicInviteMsgLike[], inviteId: string): boolean {
  const id = inviteId.trim()
  if (!id) return false
  return msgs.some(
    (m) =>
      m.musicSync?.inviteId === id &&
      (m.musicSync.kind === 'music_accept' || m.musicSync.kind === 'music_decline'),
  )
}

export function resolveMusicSyncInviteCover(
  msgs: readonly MusicInviteMsgLike[],
  inviteId: string,
): string {
  const id = inviteId.trim()
  if (!id) return ''
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const ms = msgs[i]?.musicSync
    if (ms?.kind === 'music_invite' && ms.inviteId === id && ms.coverUrl?.trim()) {
      return ms.coverUrl.trim()
    }
  }
  return ''
}

export function findLatestPendingMusicInvite(
  msgs: readonly MusicInviteMsgLike[],
): { messageId: string; invite: WeChatMusicSyncInvitePayload } | null {
  const messageId = resolvePendingMusicInviteMessageId({ msgs })
  if (!messageId) return null
  const row = msgs.find((m) => m.id === messageId)
  if (!row?.musicSync || row.musicSync.kind !== 'music_invite') return null
  const invite = row.musicSync as WeChatMusicSyncInvitePayload
  return { messageId, invite }
}

/** 认领用户发出的、尚未被回应的最近一条共听邀约消息 id */
export function resolvePendingMusicInviteMessageId(params: {
  messageIdHint?: string
  msgs: readonly MusicInviteMsgLike[]
}): string | null {
  const hint = params.messageIdHint?.trim()
  const msgs = params.msgs
  const isPendingInvite = (m: MusicInviteMsgLike): boolean =>
    m.from === 'self' && m.musicSync?.kind === 'music_invite' && !!m.musicSync.inviteId.trim()

  const hintMatches = (m: MusicInviteMsgLike): boolean => {
    if (!hint) return false
    return m.id === hint || m.musicSync?.inviteId === hint
  }

  if (hint) {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]!
      if (!hintMatches(m)) continue
      if (!isPendingInvite(m)) return null
      if (hasMusicSyncResponseForInvite(msgs, m.musicSync!.inviteId)) return null
      return m.id
    }
    return null
  }

  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]!
    if (!isPendingInvite(m)) continue
    const inviteId = m.musicSync!.inviteId
    if (!hasMusicSyncResponseForInvite(msgs, inviteId)) return m.id
    return null
  }
  return null
}

/** 音乐共听邀约回合：强制模型输出决断指令的 replyBias */
export function buildMusicSyncInviteReplyBias(params: {
  messageId: string
  invite: WeChatMusicSyncInvitePayload
}): string {
  const artist = params.invite.trackArtist?.trim() || '未知歌手'
  return `[系统裁决·音乐共听] 用户刚向你发来音乐共听邀约：《${params.invite.trackTitle}》— ${artist}。
你必须在本轮回复中：
1) 先输出 1～4 行符合人设的口语对白（是否愿意一起听、对这首歌的看法等）；
2) 最后一行**必须单独占一行**输出以下指令之一（缺一不可）：
   - 愿意共听：\`[MUSIC_SYNC_ACCEPT]{"messageId":"${params.messageId}"}\`
   - 拒绝共听：\`[MUSIC_SYNC_DECLINE]{"messageId":"${params.messageId}"}\`
禁止只回复口语而不输出指令行；禁止在未输出 [MUSIC_SYNC_ACCEPT] 时假装已加入共听。`
}

/**
 * 模型未输出指令行时的兜底：根据角色本轮口语推断接受/拒绝。
 * 返回 null 表示无法判定，不自动生成卡片。
 */
export function adjudicateMusicSyncFromCharacterText(combinedText: string): 'accept' | 'decline' | null {
  const t = combinedText.trim()
  if (!t) return null

  const decline =
    /(?:没空|不想听|不听|拒绝|算了吧|自己听|不方便|下次吧|先不了|不要了|懒得|没兴趣|忙着呢|在忙|没心情|不太想|算了|免了|别了吧)/u.test(
      t,
    )
  const accept =
    /(?:一起听|陪你听|好啊|好呀|行啊|可以啊|没问题|来吧|就这首|放吧|听听|同步|陪你|我也想听|当然要|走起|马上到|等我一|马上听)/u.test(
      t,
    )

  if (decline && !accept) return 'decline'
  if (accept) return 'accept'
  if (/(?:这首|这首歌|曲子|歌名|旋律|歌词|文艺|品味|居然.*首)/u.test(t) && !decline) return 'accept'
  if (/(?:心跳|频率|波长)/u.test(t) && !decline) return 'accept'
  return null
}

export const WECHAT_MUSIC_SYNC_INVITE_OUTPUT_BLOCK = `
---------------------
【用户发来的音乐共听邀约（同频共听）】
---------------------
- 会话里若出现「（用户向你发来音乐共听邀约：《曲名》— 歌手…）」或用户刚发来音乐共听卡片，表示对方想与你**同步收听同一首歌**。
- 你必须结合人设、好感、当下是否方便、对这首歌的态度，**自主决定接受或拒绝**；不要无脑答应，也不要无视邀约。
- **接受**时：先输出 1～3 行自然口语（如附和品味、愿意陪听、调侃一句等），再**单独占一行**输出机器指令（与口语分条，勿塞进同一行）：
  - \`[MUSIC_SYNC_ACCEPT]{}\` 或 \`[MUSIC_SYNC_ACCEPT]{"messageId":"邀约消息id","replyText":"与上文口语一致或略收束的一句"}\`
  - \`messageId\` 可省略：以本会话里用户发出的、最近一条仍未回应的共听邀约为准。
  - \`replyText\` 可省略：客户端会尽量用你本轮已发出的口语；仍建议填写一句收束语供卡片展示。
- **拒绝**时：先有冷淡/抱歉/忙/不合口味等口语（符合人设），再单独一行：
  - \`[MUSIC_SYNC_DECLINE]{}\` 或 \`[MUSIC_SYNC_DECLINE]{"messageId":"…","replyText":"…"}\`
- **禁止**用普通文字假装「已加入一起听」却不输出对应指令行；**不写指令则界面不会建立共听**。
- 指令行只表示你对**用户发来的邀约**的决断，不能用来向用户发起共听（用户侧从音乐面板发起）。
`.trim()
