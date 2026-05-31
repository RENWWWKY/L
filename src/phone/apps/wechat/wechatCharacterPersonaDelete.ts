import { personaDb } from './newFriendsPersona/idb'
import { characterBelongsToWechatAccount } from './wechatAccountScope'
import { normalizeAccountsBundle, WECHAT_ACCOUNTS_BUNDLE_KV_KEY } from './wechatAccountTypes'
import {
  collectCanonicalIdsPreservedAcrossAccounts,
  expandCanonicalIdSet,
  resolveCanonicalCharacterId,
  unregisterGlobalWechatCharacterForCharacterId,
} from './wechatGlobalCharacterRegistry'
import { pruneCharacterVoiceMappings } from '../voiceprint/characterVoiceMapStorage'

export type CharacterPersonaDeleteMode = 'full' | 'detached-from-account'

/**
 * 从当前微信马甲删除角色人设：
 * - 其它马甲通讯录仍引用同一 canonical → 只摘本号联系人与本号聊天记录；
 * - 人设归属其它马甲 → 同上，不删全局档案；
 * - 仅本号使用且归属本号 → 完整 deleteCharacter。
 */
export async function deleteCharacterPersonaForWechatAccount(params: {
  characterId: string
  wechatAccountId: string
}): Promise<CharacterPersonaDeleteMode> {
  const acc = params.wechatAccountId.trim()
  const canonical = await resolveCanonicalCharacterId(params.characterId.trim())
  if (!acc || !canonical) throw new Error('缺少微信账号或角色 id')

  const ch = await personaDb.getCharacterWithoutCanonicalRedirect(canonical)
  if (!ch) return 'detached-from-account'

  const bundle = normalizeAccountsBundle(await personaDb.getPhoneKv(WECHAT_ACCOUNTS_BUNDLE_KV_KEY))
  const preservedElsewhere = bundle
    ? await expandCanonicalIdSet(collectCanonicalIdsPreservedAcrossAccounts(bundle, acc))
    : new Set<string>()

  const ownedHere = characterBelongsToWechatAccount(ch, acc)
  const usedOnOtherAccounts = preservedElsewhere.has(canonical)

  const idsToClean = new Set<string>([canonical])
  for (const n of await personaDb.listNpcsForWechatAccount(canonical, acc)) {
    if (n.id?.trim()) idsToClean.add(n.id.trim())
  }

  await personaDb.deleteWeChatScopedDataForCharactersOnWechatAccount([...idsToClean], acc)

  if (usedOnOtherAccounts || !ownedHere) {
    const { recordUserWeChatDataClear } = await import('./wechatDataInventory')
    await recordUserWeChatDataClear('delete_character_scoped', {
      wechatAccountId: acc,
      characterId: canonical,
    })
    return 'detached-from-account'
  }

  for (const id of idsToClean) {
    await personaDb.deleteCharacter(id)
    await unregisterGlobalWechatCharacterForCharacterId(id)
  }
  pruneCharacterVoiceMappings([...idsToClean])
  const { recordUserWeChatDataClear } = await import('./wechatDataInventory')
  await recordUserWeChatDataClear('delete_character_persona', {
    wechatAccountId: acc,
    characterId: canonical,
  })
  return 'full'
}
