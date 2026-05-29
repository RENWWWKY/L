export type QnACommentAuthorType = 'user' | 'author' | 'character'

/** 主评下的回复（玩家 / 答主 / 羁绊角色） */
export type QnAThreadReply = {
  id: string
  createdAt: number
  authorType: QnACommentAuthorType
  authorName: string
  authorAvatar: string
  authorCharacterId?: string
  relationLabel?: string
  replyToName?: string
  content: string
  /** 玩家评论选择匿名：UI 不展示微信昵称/头像，AI 不可见身份档案 */
  isAnonymous?: boolean
  /** 延时解锁（与羁绊回响相同机制，不用组件 setTimeout） */
  visibleAt?: number
}

/** 顶层评论（玩家 / 答主 / 羁绊角色） */
export type QnAThreadComment = {
  id: string
  createdAt: number
  authorType?: QnACommentAuthorType
  authorName: string
  authorAvatar: string
  authorCharacterId?: string
  relationLabel?: string
  content: string
  /** 玩家一级评论匿名 */
  isAnonymous?: boolean
  replies: QnAThreadReply[]
  /** 一级评论延时解锁（与 replies.visibleAt 独立） */
  visibleAt?: number
  /** 由首次定向提问 AI 围观生成 */
  fromBondEcho?: boolean
}

/** 共同好友延时围观评论（绝对时间戳解锁，不依赖组件 setTimeout） */
export type DelayedComment = {
  id: string
  authorName: string
  authorAvatar: string
  authorCharacterId?: string
  /** 人脉网内与答主的关系标签（如「知己 · 观察对象」） */
  relationLabel?: string
  content: string
  delayInSeconds: number
  /** Date.now() + delayInSeconds * 1000，写入时一次算死 */
  visibleAt: number
  /** 展示用时间（通常 = visibleAt） */
  createdAt?: number
}

/** 定向提问 · 角色主回答 + 延时围观流 */
export type QnADirectedPost = {
  id: string
  question: string
  targetCharacterId: string
  targetCharacterName: string
  /** 答主头像（写入时从通讯录快照） */
  targetCharacterAvatar?: string
  targetContactId: string
  characterAnswer: string
  createdAt: number
  comments: DelayedComment[]
  /** 玩家深度互动评论树 */
  threadComments?: QnAThreadComment[]
}

export type QnADirectedPostsSnapshot = {
  posts: Record<string, QnADirectedPost>
  /** 全局时钟 tick，供 useSyncExternalStore 刷新可见评论 */
  now: number
}
