import { personaDb } from './newFriendsPersona/idb'
import { normalizeAccountsBundle, WECHAT_ACCOUNTS_BUNDLE_KV_KEY } from './wechatAccountTypes'
import {
  collectCanonicalIdsPreservedAcrossAccounts,
  expandCanonicalIdSet,
  resolveCanonicalCharacterId,
} from './wechatGlobalCharacterRegistry'

/** 其它微信马甲通讯录仍引用该 canonical 角色 */
export async function isCharacterCanonicalPreservedOnOtherWechatAccounts(
  characterId: string,
  excludingWechatAccountId: string,
): Promise<boolean> {
  const acc = excludingWechatAccountId.trim()
  const canonical = (await resolveCanonicalCharacterId(characterId.trim())) || characterId.trim()
  if (!acc || !canonical) return false

  const bundle = normalizeAccountsBundle(await personaDb.getPhoneKv(WECHAT_ACCOUNTS_BUNDLE_KV_KEY))
  if (!bundle) return false

  const preserved = await expandCanonicalIdSet(collectCanonicalIdsPreservedAcrossAccounts(bundle, acc))
  return preserved.has(canonical)
}

/**
 * 资料卡「删除联系人」后的数据清理（不含通讯录 UI / 好友申请文案）。
 * - 告知对方：仅按用户选择处理聊天记录，不碰长期记忆；
 * - 不告知对方：清运行数据但保留人设；多账号时仅动当前马甲。
 */
export async function applyWechatContactRemovalDataClear(params: {
  characterId: string
  wechatAccountId: string
  playerIdentityId: string
  notifyPeer: boolean
  chatHistoryMode: 'hard' | 'soft'
  conversationKey?: string | null
}): Promise<{ preservedOnOtherAccounts: boolean }> {
  const characterId = params.characterId.trim()
  const wechatAccountId = params.wechatAccountId.trim()
  const playerIdentityId = params.playerIdentityId.trim()
  const convKey = params.conversationKey?.trim() || ''

  if (!characterId || !wechatAccountId) {
    return { preservedOnOtherAccounts: false }
  }

  const preservedOnOtherAccounts = await isCharacterCanonicalPreservedOnOtherWechatAccounts(
    characterId,
    wechatAccountId,
  )

  if (params.notifyPeer) {
    if (convKey) {
      if (params.chatHistoryMode === 'hard') {
        await personaDb.deleteAllWeChatMessagesForConversation(convKey)
      } else {
        await personaDb.hideWeChatConversationHistoryFromUiKeepAiContext(convKey)
      }
    }
    return { preservedOnOtherAccounts }
  }

  if (preservedOnOtherAccounts) {
    if (params.chatHistoryMode === 'soft' && convKey) {
      await personaDb.hideWeChatConversationHistoryFromUiKeepAiContext(convKey)
    } else {
      await personaDb.deleteWeChatScopedDataForCharactersOnWechatAccount([characterId], wechatAccountId)
    }
    if (playerIdentityId) {
      await personaDb.deletePlayerIdentityRelationshipsForIdentityAndCharacterIds(playerIdentityId, [characterId])
    }
    return { preservedOnOtherAccounts }
  }

  if (params.chatHistoryMode === 'soft' && convKey) {
    await personaDb.hideWeChatConversationHistoryFromUiKeepAiContext(convKey)
    await personaDb.deleteCharacterDataKeepNetworkRelationships([characterId], {
      preserveWeChatConversationKeys: [convKey],
    })
  } else {
    await personaDb.deleteCharacterDataKeepNetworkRelationships([characterId])
  }
  await personaDb.deletePlayerIdentityRelationshipsTouchingCharacterIds([characterId])

  return { preservedOnOtherAccounts }
}
