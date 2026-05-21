import { useSyncExternalStore } from 'react'

import { uid } from '../newFriendsPersona/utils'

/**
 * 用户本人在「主微信」中发出的好友申请快照（非查手机镜像会话）。
 * 写入后交由 UI 展示「待回应」；后续后台巡检可提取 verificationMessage，
 * 结合角色人设由大模型判定：秒通过 / 延迟通过 / 拒绝，并驱动私聊首句等。
 */
export type OutgoingFriendPendingRequest = {
  id: string
  characterId: string
  verificationMessage: string
  alias: string
  hideMyMoments: boolean
  hideTheirMoments: boolean
  createdAtIso: string
}

let pendingRequests: OutgoingFriendPendingRequest[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function getOutgoingPendingFriendRequests(): OutgoingFriendPendingRequest[] {
  return pendingRequests
}

export function subscribeOutgoingPendingFriendRequests(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

export function pushOutgoingFriendRequest(
  payload: Omit<OutgoingFriendPendingRequest, 'id' | 'createdAtIso'> & {
    id?: string
    createdAtIso?: string
  },
): OutgoingFriendPendingRequest {
  const id = payload.id?.trim() || uid('wx-ofr')
  const createdAtIso = payload.createdAtIso ?? new Date().toISOString()
  const next: OutgoingFriendPendingRequest = {
    id,
    characterId: payload.characterId,
    verificationMessage: payload.verificationMessage,
    alias: payload.alias,
    hideMyMoments: payload.hideMyMoments,
    hideTheirMoments: payload.hideTheirMoments,
    createdAtIso,
  }
  pendingRequests = [...pendingRequests.filter((r) => r.characterId !== payload.characterId), next]
  emit()
  return next
}

/** 对外习惯命名：与产品文案「联系人 / 通讯录」心智一致 */
export function useContactsStore(): { pendingRequests: OutgoingFriendPendingRequest[] } {
  const pendingRequestsSnapshot = useSyncExternalStore(
    subscribeOutgoingPendingFriendRequests,
    getOutgoingPendingFriendRequests,
    getOutgoingPendingFriendRequests,
  )
  return { pendingRequests: pendingRequestsSnapshot }
}
