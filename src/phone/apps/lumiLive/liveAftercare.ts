import { emitWeChatStorageChanged, personaDb } from '../wechat/newFriendsPersona/idb'
import { resolveAccountScopedPrivateConversationKey } from '../wechat/wechatAccountPrivateChatStorage'
import {
  findAccountById,
  loadAccountsBundle,
  resolveAccountSessionIdentityId,
} from '../wechat/wechatAccountPersistence'
import type { LiveGift } from './types'

/** 打赏后的「台下」私聊余波：角色冷淡吐槽（跨应用反差） */
export async function sendLiveSponsorshipAftercare(params: {
  characterId: string
  gift: LiveGift
}): Promise<boolean> {
  const characterId = params.characterId.trim()
  if (!characterId) return false

  try {
    const bundle = await loadAccountsBundle()
    if (!bundle) return false
    const account = findAccountById(bundle, bundle.currentAccountId)
    if (!account) return false
    const playerIdentityId = resolveAccountSessionIdentityId(account).trim()
    if (!playerIdentityId || playerIdentityId === '__none__') return false

    const conversationKey = await resolveAccountScopedPrivateConversationKey({
      wechatAccountId: account.accountId,
      characterId,
      appSessionPlayerIdentityId: playerIdentityId,
    })

    const lines = [
      `刚才在直播间乱花什么钱？嫌余额太多了？「${params.gift.ceremonyLabel}」……下次别这样。`,
      `直播间那点赞助我看见了。用不着，听见了没。`,
      `你送「${params.gift.ceremonyLabel}」的样子挺显眼。回来私聊再说，别在外面丢人。`,
    ]
    const content = lines[Math.floor(Math.random() * lines.length)]!

    const nowMs = Date.now() + 2500
    await personaDb.appendWeChatChatMessage({
      id: `wxm-${nowMs}-live-${Math.random().toString(36).slice(2, 8)}`,
      characterId,
      playerIdentityId,
      type: 'character',
      content,
      timestamp: nowMs,
      isRead: false,
      conversationKey,
      notifyPeerTitle: undefined,
    })
    emitWeChatStorageChanged()
    return true
  } catch {
    return false
  }
}
