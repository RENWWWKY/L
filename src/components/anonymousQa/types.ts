export type QuestionVisibility = 'public' | 'directed'

/** 定向提问：每条记录仅对应答主可见；多选答主 = N 条独立记录 */
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
  /** 来自通讯录好友的匿名提问时绑定的人设 id */
  contactCharacterId?: string
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
  /** 我收到的未读 */
  unreadForCurrentUser?: boolean
  /** 定向 AI 双输出帖（与 qnaDirectedStore 同 id） */
  directedAiPostId?: string
  targetCharacterId?: string
}

export type QnAProfileTab =
  | 'received'
  | 'asked'
  | 'answered'
  | 'liked'
  | 'commented'

export type MockContact = {
  id: string
  /** 微信通讯录展示名：有备注用备注，无备注用微信昵称（与评论区 UI 一致） */
  remarkName: string
  avatarUrl?: string
  /** 微信人脉 NPC：有则跟帖/提问可走角色人设与记忆 */
  characterId?: string
}
