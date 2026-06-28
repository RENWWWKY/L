import type { MemorySettingsRow } from '../newFriendsPersona/types'



/** 每轮尾声延展判断默认常开（无单独开关）；仅「自动总结」总开关关闭时不跑。 */

export function isWorldBookAfterPerRoundSyncEnabled(settings: MemorySettingsRow): boolean {

  return settings.autoSummaryEnabled !== false

}


