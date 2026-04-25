export type QuestionVisibility = 'public' | 'directed'

/** 定向提问：每条记录仅对应答主可见；多选答主 = N 条独立记录（前端 mock 用同一问题文案 + 不同 id） */
export type DirectedQuestionRecord = {
  id: string
  questionId: string
  targetUserId: string
  targetDisplayName: string
  read: boolean
}

export type QnAReply = {
  id: string
  createdAt?: number
  authorId: string
  authorName: string
  authorAvatarUrl?: string
  /** 定向帖答主回复时强制公开身份 */
  isAnonymous: boolean
  content: string
  likeCount: number
  dislikeCount: number
  replyToName?: string
  /** 预留嵌套 */
  children: QnAReply[]
}

export type QnAAnswer = {
  id: string
  createdAt?: number
  authorId: string
  authorName: string
  authorAvatarUrl?: string
  isAnonymous: boolean
  content: string
  likeCount: number
  dislikeCount: number
  replies: QnAReply[]
}

export type Question = {
  id: string
  body: string
  visibility: QuestionVisibility
  isContact?: boolean
  authorMask?: string
  /** 定向：答主 id 列表（展示用）；实际业务为 N 条 directed 记录 */
  targetUserIds?: string[]
  targetDisplayNames?: string[]
  createdAt: number
  askerDisplayName?: string
  /** 首页卡片：点赞最高的一条回答摘要 */
  topAnswerSnippet?: {
    authorName: string
    isAnonymous: boolean
    avatarUrl?: string
    text: string
    likeCount: number
  }
  answers: QnAAnswer[]
  /** 我收到的未读（mock） */
  unreadForCurrentUser?: boolean
}

export type QnAProfileTab =
  | 'received'
  | 'asked'
  | 'answered'
  | 'liked'
  | 'commented'

export type MockContact = {
  id: string
  remarkName: string
  avatarUrl?: string
}
