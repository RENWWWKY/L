import type { ApiConfig } from '../api/types'
import { sanitizeFriendRequestPlainText } from '../wechat/addFriend/friendRequestPlainText'
import { personaDb, emitWeChatStorageChanged } from '../wechat/newFriendsPersona/idb'
import { resolvePrivateWeChatConversationKey } from '../wechat/wechatConversationKey'
import { aiMeetCharOutgoingFriendRequestGreeting } from './lumiMeetAi'
import { resolveMeetWeChatPlayerIdentityId } from './meetResolveWeChatPlayerIdentityId'
import { upsertMeetNpcAsCharacter } from './syncMeetNpcToWechat'
import { resolveMeetPublicDisplayName } from './meetPublicProfileDisplay'
import type { EncounterNPC, MeetPublicProfile } from './meetTypes'

function randomLmWechatId(): string {
  const s = Math.random().toString(36).slice(2, 10)
  return `Lm_${s}`
}

export type MeetContractFriendRequestDeps = {
  upsertNpc: (npc: EncounterNPC) => void
}

/**
 * 角色倾向先加你：写入人设库 +「新的朋友」待验证与首条验证消息。
 * **不会**写入微信通讯录；用户同意验证后由微信侧 `resolveNewFriendRequest` 入库。
 * 验证打招呼由模型按人设生成，**禁止**复制遇见临时会话口播。
 */
export async function meetApplyCharAddUserCovenant(params: {
  apiConfig: ApiConfig | null
  npc: EncounterNPC
  userProfile: MeetPublicProfile
  /** 与遇见档案 / 微信当前身份对齐 */
  playerIdentityId?: string
  deps: MeetContractFriendRequestDeps
}): Promise<{ wechatIdUsed: string }> {
  const pid = await resolveMeetWeChatPlayerIdentityId(params.playerIdentityId)
  if (!pid) {
    throw new Error('未找到微信玩家身份，无法写入新的朋友')
  }

  let wxId = params.npc.wechatId?.trim()
  if (!wxId) {
    wxId = randomLmWechatId()
    params.deps.upsertNpc({ ...params.npc, wechatId: wxId })
  }

  const npcNext = { ...params.npc, wechatId: wxId }
  await upsertMeetNpcAsCharacter(npcNext, wxId, {
    bindPlayerIdentityId: params.userProfile.baseWeChatIdentityId,
  })

  const ch = await personaDb.getCharacter(npcNext.id)
  const nick =
    ch?.remark?.trim() || ch?.wechatNickname?.trim() || ch?.name?.trim() || npcNext.nickname

  const playerIdentity = await personaDb.getPlayerIdentity(pid)
  const peerWeChatDisplayName =
    resolveMeetPublicDisplayName(params.userProfile) ||
    playerIdentity?.wechatNickname?.trim() ||
    playerIdentity?.name?.trim() ||
    '你'

  const greetingRaw = await aiMeetCharOutgoingFriendRequestGreeting({
    apiConfig: params.apiConfig,
    npc: npcNext,
    userProfile: params.userProfile,
    peerWeChatDisplayName,
  })
  const firstMessage =
    sanitizeFriendRequestPlainText(greetingRaw) || `你好～我是遇见里的${nick}，通过一下呀`

  const verificationEpochMs = Date.now()
  const requestId = `fr-${pid}-${npcNext.id}`

  await personaDb.upsertFriendRequest({
    id: requestId,
    characterId: npcNext.id,
    playerIdentityId: pid,
    source: '遇见 · 缔结契约',
    status: 'pending',
    createdAt: verificationEpochMs,
    updatedAt: verificationEpochMs,
    verificationEpochMs,
    meetLinkedNpcId: npcNext.id,
    meetUserProfileAtRequest: npcNext.meetUserProfileAtMatch,
  })

  const convKey = resolvePrivateWeChatConversationKey(npcNext.id, ch, pid)
  await personaDb.appendWeChatChatMessage({
    id: `${requestId}-cov-${verificationEpochMs}-${Math.random().toString(36).slice(2, 7)}`,
    characterId: npcNext.id,
    playerIdentityId: pid,
    type: 'character',
    content: firstMessage,
    timestamp: verificationEpochMs,
    isRead: false,
    conversationKey: convKey,
    notifyPeerTitle: nick,
  })
  await personaDb.markWeChatConversationUnread(convKey)
  emitWeChatStorageChanged()
  return { wechatIdUsed: wxId }
}
