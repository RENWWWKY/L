import type { WeChatListenCommentSharePayload } from '../../phone/apps/wechat/newFriendsPersona/types'

export const LISTEN_TOGETHER_OPEN_COMMENTS_EVENT = 'listen-together:open-comments'

export type ListenTogetherCommentsOpenDetail = {
  targetType: 'song' | 'playlist'
  targetId: number
  targetTitle: string
  targetArtist?: string
  targetCover?: string
}

export function listenCommentShareToOpenDetail(
  data: WeChatListenCommentSharePayload,
): ListenTogetherCommentsOpenDetail {
  return {
    targetType: data.targetType,
    targetId: data.targetId,
    targetTitle: data.targetTitle,
    targetArtist: data.targetArtist,
    targetCover: data.targetCover,
  }
}

/** 从任意应用（如微信聊天）唤起听一听评论区叠层 */
export function requestOpenListenTogetherComments(detail: ListenTogetherCommentsOpenDetail): void {
  if (!detail.targetId || !detail.targetTitle.trim()) return
  window.dispatchEvent(
    new CustomEvent<ListenTogetherCommentsOpenDetail>(LISTEN_TOGETHER_OPEN_COMMENTS_EVENT, {
      detail,
    }),
  )
}

export function requestOpenListenCommentShareCard(data: WeChatListenCommentSharePayload): void {
  requestOpenListenTogetherComments(listenCommentShareToOpenDetail(data))
}
