import { personaDb } from '../wechat/newFriendsPersona/idb'
import { LUMI_MEET_KV_KEY } from './constants'
import { migrateLumiMeetPersisted } from './meetMigrate'
import type { EncounterNPC, LumiMeetPersistedState } from './meetTypes'

export async function loadMeetPersisted(): Promise<LumiMeetPersistedState | null> {
  try {
    const raw = await personaDb.getPhoneKv(LUMI_MEET_KV_KEY)
    if (!raw) return null
    return migrateLumiMeetPersisted(raw)
  } catch {
    return null
  }
}

export function findMeetNpcInPersist(
  meet: LumiMeetPersistedState,
  characterId: string,
): EncounterNPC | null {
  const cid = characterId.trim()
  if (!cid) return null
  return meet.npcs.find((n) => n.id === cid) ?? null
}

export function isMeetFriendRequestSource(source: string | undefined | null): boolean {
  return String(source ?? '').includes('遇见')
}
