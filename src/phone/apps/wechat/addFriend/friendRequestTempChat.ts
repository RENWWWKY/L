import type { FriendRequest, TempChatMessage } from '../newFriendsPersona/friendRequestTypes'
import { personaDb, emitWeChatStorageChanged } from '../newFriendsPersona/idb'
import type { FriendRequestRow } from '../newFriendsPersona/idb'
import {
  splitFriendRequestReplyLines,
  stripFriendRequestDecisionBlock,
} from './friendRequestDecisionParse'
import { appendPostAcceptFriendGreetingMessages } from './friendRequestAdjudication'
import { sanitizeFriendRequestPlainText } from './friendRequestPlainText'

export function buildRejectionTempChatBias(userInput: string): string {
  const quoted = sanitizeFriendRequestPlainText(userInput) || '（空）'
  return (
    '【系统状态】你刚刚拒绝了用户的微信好友申请。用户正在通过「临时会话」向你发送消息：【' +
    quoted +
    '】。请基于你拒绝他的原因（如高冷、防备、生气或傲娇）进行回复。如果你被用户的发言打动或说服，你可以选择重新同意添加好友。\n' +
    '若决定重新同意加好友，必须在全部输出最开头严格输出：\n' +
    '<friend_request_response>\n' +
    '  <decision>accept</decision>\n' +
    '  <post_accept_greeting>\n' +
    '    重新通过后的第一句\n' +
    '  </post_accept_greeting>\n' +
    '</friend_request_response>\n' +
    '- decision 仅 accept 或 decline；accept 时 post_accept_greeting 必填 1~3 行；decline 时 post_accept_greeting 为空。\n' +
    '2) XML 之后写 1~4 行口语回复，每行一条；禁止 Markdown、禁止括号动作描写。'
  )
}

export function tempChatThreadFromRow(row: FriendRequestRow | null | undefined): TempChatMessage[] {
  const raw = (row as { tempChatThread?: unknown } | null | undefined)?.tempChatThread
  if (!Array.isArray(raw)) return []
  return raw
    .map((m) => {
      const item = m as { sender?: unknown; text?: unknown; time?: unknown }
      const sender = item.sender === 'user' || item.sender === 'character' ? item.sender : null
      const text = sanitizeFriendRequestPlainText(String(item.text ?? ''))
      const time = typeof item.time === 'number' && Number.isFinite(item.time) ? item.time : 0
      if (!sender || !text) return null
      return { sender, text, time } satisfies TempChatMessage
    })
    .filter((x): x is TempChatMessage => !!x)
}

export async function appendFriendRequestTempChatMessage(
  requestId: string,
  message: TempChatMessage,
): Promise<FriendRequestRow | null> {
  const existing = await personaDb.getFriendRequestById(requestId)
  if (!existing) return null
  const thread = [...tempChatThreadFromRow(existing), message]
  await personaDb.upsertFriendRequest({
    ...existing,
    tempChatThread: thread,
    updatedAt: Date.now(),
  })
  emitWeChatStorageChanged()
  return personaDb.getFriendRequestById(requestId)
}

export type RunFriendRequestTempChatReplyParams = {
  requestId: string
  characterId: string
  tempThread: TempChatMessage[]
  buildFriendRequestAiReply: (params: {
    characterId: string
    messages: FriendRequest['messages']
    replyBias?: string
  }) => Promise<{ bubbles: string[]; nickname: string; avatar: string }>
  applyAccept: (requestId: string) => Promise<number | undefined>
}

export async function runFriendRequestTempChatReply(
  params: RunFriendRequestTempChatReplyParams,
): Promise<void> {
  const lastUser = [...params.tempThread].reverse().find((m) => m.sender === 'user')
  if (!lastUser?.text.trim()) return

  const transcriptMessages: FriendRequest['messages'] = params.tempThread.map((m, i) => ({
    id: `temp-${i}-${m.time}`,
    sender: m.sender === 'user' ? 'user' : 'character',
    content: m.text,
    timestamp: '',
    timestampMs: m.time,
  }))

  const ai = await params.buildFriendRequestAiReply({
    characterId: params.characterId,
    messages: transcriptMessages,
    replyBias: buildRejectionTempChatBias(lastUser.text),
  })

  const rawJoined = ai.bubbles.join('\n')
  const { parsed, bodyForBubbles } = stripFriendRequestDecisionBlock(rawJoined)
  const replyLines = splitFriendRequestReplyLines(
    bodyForBubbles,
    parsed?.postAcceptGreetingLines ?? [],
  )
    .map((x) => sanitizeFriendRequestPlainText(x))
    .filter(Boolean)
    .slice(0, 4)

  const now = Date.now()
  for (let i = 0; i < replyLines.length; i += 1) {
    const text = replyLines[i]!
    await appendFriendRequestTempChatMessage(params.requestId, {
      sender: 'character',
      text,
      time: now + 1 + i * 120,
    })
  }

  if (parsed?.decision === 'accept') {
    const acceptedAtMs = await params.applyAccept(params.requestId)
    if (acceptedAtMs != null && parsed.postAcceptGreetingLines.length) {
      const fr = await personaDb.getFriendRequestById(params.requestId)
      const pid = fr?.playerIdentityId?.trim() || ''
      if (pid) {
        await appendPostAcceptFriendGreetingMessages({
          characterId: params.characterId,
          playerIdentityId: pid,
          greetingLines: parsed.postAcceptGreetingLines,
          acceptedAtMs,
          nickname: ai.nickname,
        })
      }
    }
  }
}
