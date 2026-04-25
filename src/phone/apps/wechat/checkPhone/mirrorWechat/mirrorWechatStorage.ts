import { personaDb } from '../../newFriendsPersona/idb'
import type { MirrorWeChatState } from './types'

const MIRROR_WX_KV_PREFIX = 'checkPhone.mirrorWeChat.v1:'

function storageKeyParts(characterId: string, playerIdentityId: string) {
  const cid = String(characterId || 'unknown').trim() || 'unknown'
  const pid = String(playerIdentityId || 'none').trim() || 'none'
  return `${MIRROR_WX_KV_PREFIX}${cid}:${pid}`
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** 与运行时一致的结构校验，防本地脏数据 */
export function normalizeMirrorWeChatState(raw: unknown): MirrorWeChatState | null {
  if (!isRecord(raw)) return null
  if (!Array.isArray(raw.contacts) || !Array.isArray(raw.moments) || !Array.isArray(raw.bills) || !Array.isArray(raw.affectionCards)) {
    return null
  }
  const last = raw.lastGeneratedAt
  const lastGeneratedAt: Record<string, number> = {}
  if (isRecord(last)) {
    for (const [k, v] of Object.entries(last)) {
      if (typeof v === 'number' && !Number.isNaN(v)) lastGeneratedAt[k] = v
    }
  }
  let profile: MirrorWeChatState['profile'] = null
  if (raw.profile !== null && isRecord(raw.profile)) {
    const nick = raw.profile.nickname
    if (typeof nick === 'string' && nick.trim()) {
      profile = {
        nickname: nick.trim(),
        signature: typeof raw.profile.signature === 'string' ? raw.profile.signature : '',
        avatarUrl: typeof raw.profile.avatarUrl === 'string' ? raw.profile.avatarUrl : undefined,
      }
    }
  }
  return {
    profile,
    contacts: raw.contacts as MirrorWeChatState['contacts'],
    moments: raw.moments as MirrorWeChatState['moments'],
    bills: raw.bills as MirrorWeChatState['bills'],
    affectionCards: raw.affectionCards as MirrorWeChatState['affectionCards'],
    lastGeneratedAt: lastGeneratedAt as MirrorWeChatState['lastGeneratedAt'],
  }
}

export async function loadMirrorWeChatState(
  characterId: string,
  playerIdentityId: string,
): Promise<MirrorWeChatState | null> {
  const key = storageKeyParts(characterId, playerIdentityId)
  try {
    const raw = await personaDb.getPhoneKv(key)
    return normalizeMirrorWeChatState(raw)
  } catch (e) {
    console.warn('读取查手机镜像微信缓存失败:', e)
    return null
  }
}

export async function saveMirrorWeChatState(
  characterId: string,
  playerIdentityId: string,
  state: MirrorWeChatState,
): Promise<void> {
  const key = storageKeyParts(characterId, playerIdentityId)
  try {
    await personaDb.setPhoneKv(key, state)
  } catch (e) {
    console.warn('写入查手机镜像微信缓存失败:', e)
  }
}
