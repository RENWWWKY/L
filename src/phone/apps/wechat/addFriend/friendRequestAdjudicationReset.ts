export const FRIEND_REQUEST_ADJUDICATION_RESET_EVENT = 'wechat-friend-request-adjudication-reset'

export type FriendRequestAdjudicationResetDetail = {
  requestId: string
}

/** 重新发送申请 / 用户点「重新请求对方处理」前：通知 WeChatApp 清掉卡死的裁决 in-flight 状态 */
export function emitFriendRequestAdjudicationReset(requestId: string): void {
  const id = requestId.trim()
  if (!id || typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<FriendRequestAdjudicationResetDetail>(FRIEND_REQUEST_ADJUDICATION_RESET_EVENT, {
      detail: { requestId: id },
    }),
  )
}
