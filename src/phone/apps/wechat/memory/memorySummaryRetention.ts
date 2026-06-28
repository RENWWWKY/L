import type { WeChatChatMessage } from '../newFriendsPersona/types'
import type { MeetChatMessage } from '../../lumiMeet/meetTypes'

/** 线下剧情窗口切分用的最小字段 */
export type DatingPlotRetentionItem = {
  type: string
  timestamp?: number
}

/**
 * 最近上下文参考：最近若干 **AI 回复轮**（不含用户单独计轮；窗口内保留其间用户输入）。
 * 与「游标上下文（待总结）」分离，仅后台注入模型，不进思维溯源。
 */
export const MEMORY_RECENT_AI_ROUNDS_REFERENCE = 6

/** 游标后「尚未总结·线下剧情」注入 prompt / 思维溯源：最近 N 轮 AI 剧情（含其间玩家输入）。 */
export const MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS = 2

/** @deprecated 使用 {@link MEMORY_RECENT_AI_ROUNDS_REFERENCE} */
export const MEMORY_POST_SUMMARY_RETAIN_AI_ROUNDS = MEMORY_RECENT_AI_ROUNDS_REFERENCE

function selectRecentAiRoundWindowSorted<T>(
  items: readonly T[],
  countAiRound: (item: T) => boolean,
  retainAiRounds: number,
): T[] {
  if (!items.length) return []
  let aiCount = 0
  let splitIdx = items.length
  for (let i = items.length - 1; i >= 0; i--) {
    if (countAiRound(items[i]!)) aiCount++
    if (aiCount >= retainAiRounds) {
      splitIdx = i
      break
    }
  }
  return items.slice(splitIdx)
}

/** 私聊：最近 N 轮角色回复及其间的用户消息（全量历史，不受总结游标限制）。 */
export function selectRecentWeChatMessagesAiRoundWindow(
  messages: readonly WeChatChatMessage[],
  retainAiRounds = MEMORY_RECENT_AI_ROUNDS_REFERENCE,
): WeChatChatMessage[] {
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp)
  return selectRecentAiRoundWindowSorted(
    sorted,
    (m) => m.type === 'character' && !m.isRecalled,
    retainAiRounds,
  )
}

/** 线下剧情：最近 N 条 AI 剧情及其间的玩家输入。 */
export function selectRecentDatingPlotsAiRoundWindow<T extends DatingPlotRetentionItem>(
  plots: readonly T[],
  retainAiRounds = MEMORY_RECENT_AI_ROUNDS_REFERENCE,
): T[] {
  const sorted = [...plots].sort((a, b) => (a.timestamp ?? 1) - (b.timestamp ?? 1))
  return selectRecentAiRoundWindowSorted(sorted, (p) => p.type === 'ai', retainAiRounds)
}

/** 遇见：最近 N 轮 NPC 回复及其间的用户消息。 */
export function selectRecentMeetMessagesAiRoundWindow(
  messages: readonly MeetChatMessage[],
  retainAiRounds = MEMORY_RECENT_AI_ROUNDS_REFERENCE,
): MeetChatMessage[] {
  const sorted = [...messages].sort((a, b) => a.ts - b.ts)
  return selectRecentAiRoundWindowSorted(sorted, (m) => m.role === 'npc', retainAiRounds)
}
