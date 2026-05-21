import { deriveMeetMottoFromPersona } from './comprehensivePersona'
import { DESTINY_FADED_PLACEHOLDER } from './meetDestinyArchive'
import type { EncounterMemory, EncounterNPC } from './meetTypes'

/** 邂逅残卷预览卡正文：角色座右铭 */
export function resolveDestinyArchiveCardMotto(
  npc: EncounterNPC | null,
  memory: EncounterMemory,
): string {
  if (memory.matchType === 'faded') {
    const mot = npc?.motto?.trim() || (npc?.comprehensivePersona ? deriveMeetMottoFromPersona(npc.comprehensivePersona) : '')
    if (mot) return mot
    return DESTINY_FADED_PLACEHOLDER
  }
  const fromNpc = npc?.motto?.trim()
  if (fromNpc) return fromNpc
  if (npc?.comprehensivePersona) return deriveMeetMottoFromPersona(npc.comprehensivePersona)
  return '走慢一点，也认真一点。'
}
