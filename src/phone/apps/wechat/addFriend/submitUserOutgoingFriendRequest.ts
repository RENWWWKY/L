import { personaDb, emitWeChatStorageChanged } from '../newFriendsPersona/idb'
import { resolveAccountScopedPrivateConversationKey } from '../wechatAccountPrivateChatStorage'
import { resolveOutgoingFriendRequestPlayerIdentityId } from '../wechatCharacterPlayerIdentity'
import { emitFriendRequestAdjudicationReset } from './friendRequestAdjudicationReset'
import {
  isFriendRequestAdjudicationInFlight,
  waitFriendRequestAdjudicationIdle,
} from './friendRequestAdjudicationInFlight'
import { sanitizeFriendRequestPlainText } from './friendRequestPlainText'

const OUTGOING_SUBMIT_MIN_GAP_MS = 2500
const lastOutgoingSubmitAtByRequestId = new Map<string, number>()

export const USER_OUTGOING_FRIEND_REQUEST_SOURCE = '添加朋友 · 你发起的申请'

export type SubmitUserOutgoingFriendRequestMeetProfile = {
  capturedAt: number
  displayName: string
  intent: string
  bio: string
  orientation: string
  meetIntentionsPublic: string[]
}

export type SubmitUserOutgoingFriendRequestParams = {
  characterId: string
  /** 用户选择的微信玩家身份（会话/裁决用） */
  playerIdentityId?: string
  /** 当前微信马甲 id（聊天记录按号隔离） */
  wechatAccountId?: string
  verificationMessage: string
  alias?: string
  hideMyMoments?: boolean
  hideTheirMoments?: boolean
  /** 来自遇见邂逅时写入，用于后续假面/微信对照 */
  meetLinkedNpcId?: string
  meetUserProfileAtRequest?: SubmitUserOutgoingFriendRequestMeetProfile
}

export type SubmitUserOutgoingFriendRequestResult = {
  requestId: string
  characterId: string
  verificationEpochMs: number
}

/** 用户主动添加：写入「新的朋友」+ 验证会话首条（用户方） */
export async function submitUserOutgoingFriendRequest(
  params: SubmitUserOutgoingFriendRequestParams,
): Promise<SubmitUserOutgoingFriendRequestResult> {
  const characterId = params.characterId.trim()
  if (!characterId) throw new Error('缺少角色 id')

  const ch = await personaDb.getCharacter(characterId)
  if (!ch) throw new Error('未找到该角色，无法发送好友申请')

  const pid =
    resolveOutgoingFriendRequestPlayerIdentityId(ch, params.playerIdentityId) ||
    (await personaDb.getCurrentIdentityId()).trim()
  if (!pid || pid === '__none__') {
    throw new Error('未找到微信玩家身份，无法发送好友申请')
  }

  const verificationEpochMs = Date.now()
  const requestId = `fr-${pid}-${characterId}`

  if (isFriendRequestAdjudicationInFlight(requestId)) {
    throw new Error('对方正在处理上一封好友申请，请稍候再试')
  }
  await waitFriendRequestAdjudicationIdle(requestId, 10_000)

  const lastSubmit = lastOutgoingSubmitAtByRequestId.get(requestId) ?? 0
  if (verificationEpochMs - lastSubmit < OUTGOING_SUBMIT_MIN_GAP_MS) {
    throw new Error('请勿频繁重复发送申请，请稍候再试')
  }
  lastOutgoingSubmitAtByRequestId.set(requestId, verificationEpochMs)

  const verificationMessage =
    sanitizeFriendRequestPlainText(params.verificationMessage) ||
    sanitizeFriendRequestPlainText(`我是${params.alias?.trim() || '新朋友'}`) ||
    '你好，想加你为好友。'

  const prev = await personaDb.getFriendRequestById(requestId)
  emitFriendRequestAdjudicationReset(requestId)
  const contactRemarkAlias = params.alias?.trim().slice(0, 64) || undefined
  await personaDb.upsertFriendRequest({
    id: requestId,
    characterId,
    playerIdentityId: pid,
    source: USER_OUTGOING_FRIEND_REQUEST_SOURCE,
    status: 'pending',
    createdAt: prev?.createdAt ?? verificationEpochMs,
    updatedAt: verificationEpochMs,
    verificationEpochMs,
    /** 裁决冻结验证对话上界（含本条用户验证消息） */
    adjudicationCutoffMs: verificationEpochMs + 1,
    adjudicationLastError: '',
    tempChatThread: [],
    outcomeUnread: false,
    ...(contactRemarkAlias ? { contactRemarkAlias } : {}),
    ...(params.meetLinkedNpcId?.trim() ? { meetLinkedNpcId: params.meetLinkedNpcId.trim() } : {}),
    ...(params.meetUserProfileAtRequest ? { meetUserProfileAtRequest: params.meetUserProfileAtRequest } : {}),
  })

  const sessionPid = pid
  const convKey = await resolveAccountScopedPrivateConversationKey({
    wechatAccountId: params.wechatAccountId,
    characterId,
    appSessionPlayerIdentityId: sessionPid,
  })
  await personaDb.appendWeChatChatMessage({
    id: `${requestId}-user-${verificationEpochMs}-${Math.random().toString(36).slice(2, 7)}`,
    characterId,
    playerIdentityId: sessionPid,
    type: 'player',
    content: verificationMessage,
    timestamp: verificationEpochMs,
    isRead: true,
    conversationKey: convKey,
  })
  await personaDb.markWeChatConversationUnread(convKey)
  emitWeChatStorageChanged()

  return { requestId, characterId, verificationEpochMs }
}

export function isUserInitiatedFriendRequestSource(source: string | undefined | null): boolean {
  const s = String(source ?? '').trim()
  return s.includes('你发起的申请') || s.includes('你发起')
}
