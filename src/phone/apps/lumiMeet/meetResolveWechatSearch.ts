import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { Character } from '../wechat/newFriendsPersona/types'
import {
  normalizeRegistryWechatId,
  resolveCanonicalCharacterIdByWechatId,
} from '../wechat/wechatGlobalCharacterRegistry'
import type { EncounterNPC, LumiMeetPersistedState } from './meetTypes'
import { loadMeetPersisted } from './meetPersistLoad'
import { upsertMeetNpcAsCharacter } from './syncMeetNpcToWechat'

function normWechatQuery(q: string): string {
  return q.trim().toLowerCase()
}

function meetNpcWechatFromThreads(meet: LumiMeetPersistedState, npcId: string): string {
  const threads = meet.chatThreads[npcId] ?? []
  for (let i = threads.length - 1; i >= 0; i--) {
    const row = threads[i]
    if (!row) continue
    if (row.kind === 'meet_contract_npc_status' && row.meetContractStatus?.charWechatId?.trim()) {
      return row.meetContractStatus.charWechatId.trim()
    }
    if (row.kind === 'wechat_swap_card' && row.swapCard?.charWechatId?.trim()) {
      return row.swapCard.charWechatId.trim()
    }
  }
  return ''
}

function findMeetNpcByWechatId(meet: LumiMeetPersistedState, q: string): EncounterNPC | null {
  const hit = meet.npcs.find((n) => (n.wechatId || '').trim().toLowerCase() === q)
  if (hit) return hit
  for (const n of meet.npcs) {
    const fromThread = meetNpcWechatFromThreads(meet, n.id).toLowerCase()
    if (fromThread === q) return { ...n, wechatId: meetNpcWechatFromThreads(meet, n.id) }
  }
  return null
}

/**
 * 微信「添加朋友」搜索：全局微信号注册表 → 本账号人设 → 遇见回填。
 * 命中全局角色时返回 canonical 人设（记忆共享）；是否入通讯录由 UI 决定。
 */
export async function resolveCharacterByWechatSearchQuery(
  query: string,
  opts?: { wechatAccountId?: string | null },
): Promise<Character | null> {
  const q = normWechatQuery(query)
  if (!q) return null

  const canonicalId = await resolveCanonicalCharacterIdByWechatId(q)
  if (canonicalId) {
    const globalHit = await personaDb.getCharacter(canonicalId)
    if (globalHit) return globalHit
  }

  const acc = opts?.wechatAccountId?.trim()
  const scoped = acc ? await personaDb.listCharactersForWechatAccount(acc) : await personaDb.listCharacters()
  const direct = scoped.find((c) => normalizeRegistryWechatId(c.wechatId || '') === q)
  if (direct) return direct

  const meet = await loadMeetPersisted()
  if (!meet) return null

  const npc = findMeetNpcByWechatId(meet, q)
  if (!npc) return null

  const wx = (npc.wechatId || '').trim()
  if (!wx) return null

  const existingCanonical = await resolveCanonicalCharacterIdByWechatId(wx)
  if (existingCanonical) {
    const existing = await personaDb.getCharacter(existingCanonical)
    if (existing) return existing
  }

  return upsertMeetNpcAsCharacter(npc, wx, {
    bindPlayerIdentityId: meet.meetProfile.baseWeChatIdentityId,
    ownerWechatAccountId: acc,
  })
}
