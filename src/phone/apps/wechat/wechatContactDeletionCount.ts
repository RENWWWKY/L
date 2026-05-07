import { personaDb } from './newFriendsPersona/idb'

const KV_KEY = 'wechat-contact-deletion-count-v1'

type CountMap = Record<string, number>

function compositeKey(characterId: string, sessionPlayerIdentityId: string): string {
  return `${characterId.trim()}::${sessionPlayerIdentityId.trim() || '__none__'}`
}

export async function getContactDeletionCount(
  characterId: string,
  sessionPlayerIdentityId: string,
): Promise<number> {
  const raw = await personaDb.getPhoneKv(KV_KEY)
  const map = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as CountMap) : {}
  const v = map[compositeKey(characterId, sessionPlayerIdentityId)]
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}

/** 用户完成一次「删除该联系人」流程后调用，返回更新后的累计次数（含本次）。 */
export async function incrementContactDeletionCount(
  characterId: string,
  sessionPlayerIdentityId: string,
): Promise<number> {
  const raw = await personaDb.getPhoneKv(KV_KEY)
  const map: CountMap = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as CountMap) } : {}
  const k = compositeKey(characterId, sessionPlayerIdentityId)
  const prev = typeof map[k] === 'number' && Number.isFinite(map[k]) ? Math.max(0, Math.floor(map[k]!)) : 0
  const next = prev + 1
  map[k] = next
  await personaDb.setPhoneKv(KV_KEY, map)
  return next
}
