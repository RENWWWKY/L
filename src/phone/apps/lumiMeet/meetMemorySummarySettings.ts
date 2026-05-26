import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { MemorySettingsRow } from '../wechat/newFriendsPersona/types'

export type MemoryAiRoundCountChannel = 'wechat' | 'meet'

export function resolveMeetAutoSummaryEnabled(settings: MemorySettingsRow): boolean {
  return settings.meetAutoSummaryEnabled !== false
}

/** 遇见独立间隔；未单独设置时与微信间隔相同（便于迁移，之后可各自调整）。 */
export function resolveMeetAutoSummaryInterval(settings: MemorySettingsRow): number {
  const raw = settings.meetAutoSummaryInterval
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(1, Math.min(100, Math.floor(raw)))
  }
  const fallback =
    typeof settings.autoSummaryInterval === 'number' && Number.isFinite(settings.autoSummaryInterval)
      ? Math.floor(settings.autoSummaryInterval)
      : 10
  return Math.max(1, fallback)
}

export async function rollbackMemoryAiRoundCountForChannel(
  conversationKey: string,
  channel: MemoryAiRoundCountChannel,
): Promise<void> {
  if (channel === 'meet') {
    await personaDb.rollbackMeetMemoryAiRoundCountForRetry(conversationKey)
    return
  }
  await personaDb.rollbackMemoryAiRoundCountForRetry(conversationKey)
}

export async function resetMemoryAiRoundCountForChannel(
  conversationKey: string,
  channel: MemoryAiRoundCountChannel,
): Promise<void> {
  if (channel === 'meet') {
    await personaDb.resetMeetMemoryAiRoundCountForConversation(conversationKey)
    return
  }
  await personaDb.resetMemoryAiRoundCountForConversation(conversationKey)
}
