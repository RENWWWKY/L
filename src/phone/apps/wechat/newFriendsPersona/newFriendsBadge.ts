import type { FriendRequest } from './friendRequestTypes'

/** 通讯录「新的朋友」入口角标：已通过不计数；待处理看会话未读；被拒看 outcomeUnread */
export function countNewFriendsBadge(requests: FriendRequest[]): number {
  return requests.filter((r) => {
    if (r.status === 'accepted') return false
    if (r.outcomeUnread) return true
    return r.status === 'pending' && !!r.unread
  }).length
}
