import { personaDb } from '../wechat/newFriendsPersona/idb'
import { meetMessageToContextNarrative } from './meetEncounterTranscript'
import { formatMeetMessageForAiTranscript } from './meetMessageQuote'
import { loadMeetPersisted } from './meetPersistLoad'
import type { MeetChatMessage } from './meetTypes'

const UNSUMMARIZED_MEET_CHAR_HARD_MAX = 500_000

function clipOneLine(s: string, max = 220): string {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function formatMeetLineUnsummarized(m: MeetChatMessage): string | null {
  const narrative = meetMessageToContextNarrative(m, { user: '用户', npc: '对方' })
  if (narrative) {
    const idx = narrative.indexOf('：')
    const who = idx > 0 ? narrative.slice(0, idx) : m.role === 'user' ? '用户' : '对方'
    const body = idx > 0 ? narrative.slice(idx + 1).trim() : narrative
    if (!body) return null
    return `- [遇见・${who}] ${clipOneLine(body)}`
  }
  const raw = formatMeetMessageForAiTranscript(m).trim()
  if (!raw) return null
  const who = m.role === 'user' ? '用户' : '对方'
  return `- [遇见・${who}] ${clipOneLine(raw)}`
}

/**
 * 自遇见自动总结游标之后、尚未写入长期记忆的临时会话摘录（本地拼接，不调模型）。
 * 与 {@link formatUnsummarizedPrivateChatBlock} 对称，供微信私聊 / 合并总结注入。
 */
export async function formatUnsummarizedMeetChatBlock(params: {
  characterId: string
  maxMessages?: number
  maxChars?: number
}): Promise<string> {
  const cid = params.characterId.trim()
  if (!cid) return ''

  const cursor = await personaDb.getMeetSummaryCursorTimestamp(cid)
  const fromTs = (cursor ?? 0) + 1
  const lim = Math.max(1, Math.min(500, Math.floor(params.maxMessages ?? 120)))

  const meet = await loadMeetPersisted()
  const thread = meet?.chatThreads[cid] ?? []
  if (!thread.length) return ''

  const rows = thread
    .filter((m) => {
      const ts = typeof m.ts === 'number' && Number.isFinite(m.ts) && m.ts > 0 ? m.ts : 1
      return ts >= fromTs
    })
    .sort((a, b) => a.ts - b.ts)
    .slice(-lim)

  if (!rows.length) return ''

  const lines: string[] = []
  for (const m of rows) {
    const line = formatMeetLineUnsummarized(m)
    if (line) lines.push(line)
  }
  if (!lines.length) return ''

  let body = lines.join('\n')
  const charCap = Math.max(400, Math.min(UNSUMMARIZED_MEET_CHAR_HARD_MAX, Math.floor(params.maxChars ?? 3200)))
  if (body.length > charCap) {
    const parts = body.split('\n')
    while (parts.join('\n').length > charCap && parts.length > 4) parts.shift()
    body = parts.join('\n')
    if (body.length > charCap) body = `${body.slice(-charCap)}\n…（更早未总结遇见片段已截断）`
  }
  return `${body}\n（↑ 尚未经自动总结写入长期记忆的「遇见」临时会话片段；与微信私聊未总结摘录一并参与后续合并总结。）`
}
