export type TempChatMessage = {
  sender: 'user' | 'character'
  text: string
  time: number
}

export interface VerificationMsg {
  id: string
  sender: 'character' | 'user'
  content: string
  timestamp: string
  timestampMs?: number
}

export interface FriendRequest {
  id: string
  /** 对方角色 id */
  targetCharId: string
  direction: 'inbound' | 'outbound'
  /** 最初验证消息摘录 */
  verificationMsg: string
  avatar: string
  nickname: string
  source: string
  status: 'pending' | 'accepted' | 'declined'
  messages: VerificationMsg[]
  tempChatThread?: TempChatMessage[]
  unread?: boolean
  /** @deprecated 使用 targetCharId */
  characterId?: string
  requestTimeMs?: number
  /** @deprecated 使用 direction === 'outbound' */
  userInitiated?: boolean
  outcomeUnread?: boolean
  adjudicationLastError?: string
}
