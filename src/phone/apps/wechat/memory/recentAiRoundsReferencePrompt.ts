import { personaDb } from '../newFriendsPersona/idb'
import { buildOfflinePlotsFullText } from '../dating/loadOfflineDatingPlotsForWechatPrompt'
import { loadDatingPlotsFromKv } from '../unifiedMemoryAutoSummary'
import { resolveOfflineDatingArchiveContext } from '../dating/offlineDatingArchiveResolve'
import {
  MEMORY_RECENT_AI_ROUNDS_REFERENCE,
  selectRecentDatingPlotsAiRoundWindow,
  selectRecentMeetMessagesAiRoundWindow,
  selectRecentWeChatMessagesAiRoundWindow,
} from './memorySummaryRetention'
import { formatPrivateLineUnsummarized } from '../wechatMemoryPromptBlocks'
import { isMeetImportedWeChatMessageId } from '../../lumiMeet/meetMemoryConstants'
import { loadMeetPersisted } from '../../lumiMeet/meetPersistLoad'
import { formatMeetLineUnsummarized } from '../../lumiMeet/meetMemoryPromptBlocks'

const RECENT_REF_CHAR_CAP = 12_000

function clipBodyFromStart(body: string, charCap: number): string {
  if (body.length <= charCap) return body
  return `${body.slice(0, charCap)}\n…（最近上下文参考已截断）`
}

/**
 * 后台注入：最近 AI 轮私聊摘录（不受总结游标限制；可能已写入长期记忆）。
 */
export async function formatRecentAiRoundsPrivateChatReferenceBlock(params: {
  conversationKey: string
  maxChars?: number
}): Promise<string> {
  const ck = params.conversationKey.trim()
  if (!ck) return ''
  const rows = await personaDb.listWeChatChatMessagesRecent({ conversationKey: ck, limit: 240 })
  const window = selectRecentWeChatMessagesAiRoundWindow(
    rows.filter((m) => !isMeetImportedWeChatMessageId(m.id)),
  )
  if (!window.length) return ''
  const lines: string[] = []
  for (const m of window) {
    const line = formatPrivateLineUnsummarized(m)
    if (line) lines.push(line)
  }
  if (!lines.length) return ''
  const body = clipBodyFromStart(lines.join('\n'), Math.floor(params.maxChars ?? RECENT_REF_CHAR_CAP))
  return (
    `【最近私聊原文参考（最近 ${MEMORY_RECENT_AI_ROUNDS_REFERENCE} 轮角色回复及其间用户输入；可能已写入长期记忆，仅供承接口吻，**非**待总结游标材料）】\n` +
    `${body}`
  )
}

/** 按角色聚合的私聊最近参考（约会页等无固定 conversationKey 时）。 */
export async function formatRecentAiRoundsPrivateChatByCharacter(params: {
  characterId: string
  maxChars?: number
}): Promise<string> {
  const cid = params.characterId.trim()
  if (!cid) return ''
  const rows = await personaDb.listWeChatChatMessagesRecentByCharacter({ characterId: cid, limit: 240 })
  const window = selectRecentWeChatMessagesAiRoundWindow(
    rows.filter((m) => !isMeetImportedWeChatMessageId(m.id)),
  )
  if (!window.length) return ''
  const lines: string[] = []
  for (const m of window) {
    const line = formatPrivateLineUnsummarized(m)
    if (line) lines.push(line)
  }
  if (!lines.length) return ''
  const body = clipBodyFromStart(lines.join('\n'), Math.floor(params.maxChars ?? RECENT_REF_CHAR_CAP))
  return (
    `【最近私聊原文参考（最近 ${MEMORY_RECENT_AI_ROUNDS_REFERENCE} 轮角色回复及其间用户输入；可能已写入长期记忆，仅供承接口吻，**非**待总结游标材料）】\n` +
    `${body}`
  )
}

function formatRecentOfflinePlotsAiRoundsBody(params: {
  plots: import('../unifiedMemoryAutoSummary').DatingPlotSnapshotItem[]
  borrowed: boolean
  rootName: string
  peerLabel: string
  maxChars?: number
}): string {
  const window = selectRecentDatingPlotsAiRoundWindow(params.plots)
  if (!window.length) return ''
  const body = buildOfflinePlotsFullText({
    plots: window,
    plotCursorMin: -1,
    borrowed: params.borrowed,
    rootName: params.rootName,
    peerLabel: params.peerLabel,
    maxChars: Math.floor(params.maxChars ?? RECENT_REF_CHAR_CAP),
  }).trim()
  if (!body) return ''
  return (
    `【最近线下剧情参考（最近 ${MEMORY_RECENT_AI_ROUNDS_REFERENCE} 轮 AI 剧情及其间玩家输入；可能已写入长期记忆，仅供承接口吻，**非**待总结游标材料）】\n\n` +
    body
  )
}

/** 后台注入：最近 AI 轮线下剧情（全量 plot，不受 plot 总结游标限制）。 */
export async function formatRecentOfflinePlotsAiRoundsReference(
  characterId: string | null | undefined,
  peerDisplayName?: string | null,
  maxChars?: number,
  /** 与当前 UI / 本轮 generate 同源的快照；传入时不再读 KV，避免删改后仍注入旧稿。 */
  plotsSnapshot?: import('../unifiedMemoryAutoSummary').DatingPlotSnapshotItem[] | null,
): Promise<string> {
  const cid = characterId?.trim()
  if (!cid) return ''
  try {
    const ctx = await resolveOfflineDatingArchiveContext(cid)
    if (!ctx) return ''
    const plots =
      plotsSnapshot != null
        ? plotsSnapshot
        : await loadDatingPlotsFromKv(ctx.archiveCharacterId)
    const borrowed = ctx.perspectiveCharacterId !== ctx.archiveCharacterId
    const peerLabel = peerDisplayName?.trim() || (ctx.perspective?.name ?? '').trim() || '对方'
    return formatRecentOfflinePlotsAiRoundsBody({
      plots,
      borrowed,
      rootName: (ctx.archiveOwner?.name ?? '').trim() || '主角',
      peerLabel,
      maxChars,
    })
  } catch {
    return ''
  }
}

/** 后台注入：最近 AI 轮遇见临时会话摘录。 */
export async function formatRecentMeetAiRoundsReferenceBlock(params: {
  characterId: string
  maxChars?: number
}): Promise<string> {
  const cid = params.characterId.trim()
  if (!cid) return ''
  const meet = await loadMeetPersisted()
  const thread = meet?.chatThreads[cid] ?? []
  if (!thread.length) return ''
  const window = selectRecentMeetMessagesAiRoundWindow(thread)
  if (!window.length) return ''
  const lines: string[] = []
  for (const m of window) {
    const line = formatMeetLineUnsummarized(m)
    if (line) lines.push(line)
  }
  if (!lines.length) return ''
  const body = clipBodyFromStart(lines.join('\n'), Math.floor(params.maxChars ?? RECENT_REF_CHAR_CAP))
  return (
    `【最近遇见原文参考（最近 ${MEMORY_RECENT_AI_ROUNDS_REFERENCE} 轮 NPC 回复及其间用户输入；可能已写入长期记忆，仅供承接口吻，**非**待总结游标材料）】\n` +
    `${body}`
  )
}
