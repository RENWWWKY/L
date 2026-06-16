import { personaDb } from '../newFriendsPersona/idb'
import type { Character, MemorySettingsRow } from '../newFriendsPersona/types'
import { findAccountById, loadAccountsBundle } from '../wechatAccountPersistence'
import { parsePrivateWeChatConversationCharacterAndSession } from '../wechatConversationKey'
import {
  buildWechatSelfContactExclusionContext,
  isCharacterUserAccountSelf,
} from '../wechatPersonaContactsSelfFilter'

export type AutoSummaryIntervalScope = 'global' | 'per_character'

export function normalizeAutoSummaryInterval(raw: unknown, fallback = 10): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(1, Math.min(100, Math.floor(raw)))
  }
  return fallback
}

export function resolveAutoSummaryIntervalScope(settings: MemorySettingsRow): AutoSummaryIntervalScope {
  return settings.autoSummaryIntervalScope === 'per_character' ? 'per_character' : 'global'
}

export function resolveGlobalAutoSummaryInterval(settings: MemorySettingsRow): number {
  return normalizeAutoSummaryInterval(settings.autoSummaryInterval)
}

export function resolveAutoSummaryIntervalForCharacter(
  settings: MemorySettingsRow,
  characterId: string | null | undefined,
): number {
  const global = resolveGlobalAutoSummaryInterval(settings)
  if (resolveAutoSummaryIntervalScope(settings) !== 'per_character') return global
  const cid = characterId?.trim()
  if (!cid) return global
  const custom = settings.autoSummaryIntervalByCharacterId?.[cid]
  if (typeof custom === 'number' && Number.isFinite(custom)) {
    return normalizeAutoSummaryInterval(custom, global)
  }
  return global
}

export function resolveAutoSummaryIntervalForConversationKey(
  settings: MemorySettingsRow,
  conversationKey: string,
): number {
  const parsed = parsePrivateWeChatConversationCharacterAndSession(conversationKey)
  if (parsed?.characterId) {
    return resolveAutoSummaryIntervalForCharacter(settings, parsed.characterId)
  }
  return resolveGlobalAutoSummaryInterval(settings)
}

/** 仅私聊 AI 主角可配置总结间隔：排除玩家身份、人脉 NPC、账号本人人设。 */
export function isAutoSummaryIntervalEligibleCharacter(
  ch: Character,
  excludedIdentityIds: ReadonlySet<string>,
): boolean {
  const id = ch.id?.trim()
  if (!id) return false
  if (ch.generatedForCharacterId?.trim()) return false
  if (ch.isPlayerIdentity) return false
  if (excludedIdentityIds.has(id)) return false
  return true
}

export async function loadAutoSummaryIntervalCharacterCandidates(
  wechatAccountId?: string | null,
): Promise<Character[]> {
  const acc = wechatAccountId?.trim() ?? ''
  const excluded = new Set<string>()

  for (const row of await personaDb.listPlayerIdentities(acc || undefined)) {
    const id = row.id?.trim()
    if (id) excluded.add(id)
  }

  if (acc) {
    const bundle = await loadAccountsBundle()
    const account = bundle ? findAccountById(bundle, acc) : null
    if (account) {
      const base = account.baseIdentityId?.trim()
      const session = account.sessionPlayerIdentityId?.trim()
      if (base) excluded.add(base)
      if (session) excluded.add(session)
    }
  }

  const rows = acc
    ? await personaDb.listRootCharactersForWechatAccount(acc)
    : await personaDb.listRootCharacters()

  let eligible = rows.filter((ch) => isAutoSummaryIntervalEligibleCharacter(ch, excluded))

  if (acc) {
    const bundle = await loadAccountsBundle()
    const account = bundle ? findAccountById(bundle, acc) : null
    if (account) {
      const ctx = await buildWechatSelfContactExclusionContext(account)
      eligible = eligible.filter((ch) => !isCharacterUserAccountSelf(ch, ctx))
    }
  }

  return eligible
}
