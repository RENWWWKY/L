import type { MemorySettingsRow } from '../newFriendsPersona/types'

/** 线下约会推剧情：每轮写摘要表 + 关联 fan-out（随「自动总结」常开，无单独开关）。 */
export function isOfflineDatingRowPerRoundMode(settings: MemorySettingsRow): boolean {
  return settings.autoSummaryEnabled !== false
}

/** 约会推剧情时给人脉配角写关联摘要（随「自动总结」常开，无单独开关）。 */
export function isLinkedMemoryAutoSummaryEnabled(settings: MemorySettingsRow): boolean {
  return settings.autoSummaryEnabled !== false
}

/** @deprecated 请用 {@link isOfflineDatingRowPerRoundMode} */
export function isMemoryRowPerRoundMode(settings: MemorySettingsRow): boolean {
  return isOfflineDatingRowPerRoundMode(settings)
}

/** 微信私聊 / 群聊 / 遇见：固定间隔 prose + 游标后原文注入，不走每轮摘要表。 */
export function isWeChatOnlineRowPerRoundMode(_settings: MemorySettingsRow): boolean {
  return false
}

export function isMeetRowPerRoundMode(_settings: MemorySettingsRow): boolean {
  return false
}
