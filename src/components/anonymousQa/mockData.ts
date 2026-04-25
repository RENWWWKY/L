import type { DirectedQuestionRecord, MockContact, Question } from './types'

const AV = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=96&q=80'
const AV2 = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=96&q=80'
const AV3 = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=96&q=80'

export const MOCK_QNA_CONTACTS: MockContact[] = [
  { id: 'self', remarkName: '我', avatarUrl: AV2 },
  { id: 'c-1', remarkName: '祁墨衍', avatarUrl: AV },
  { id: 'c-2', remarkName: '林雾', avatarUrl: AV2 },
  { id: 'c-3', remarkName: '简宁', avatarUrl: AV3 },
]

export const MOCK_DIRECTED_RECORDS: DirectedQuestionRecord[] = [
  {
    id: 'dir-1-a',
    questionId: 'q-directed-1',
    targetUserId: 'self',
    targetDisplayName: '我',
    read: false,
  },
  {
    id: 'dir-1-b',
    questionId: 'q-directed-1',
    targetUserId: 'c-1',
    targetDisplayName: '祁墨衍',
    read: true,
  },
]

export const MOCK_QUESTIONS: Question[] = [
  {
    id: 'q-1',
    body: '如果明天世界只剩下最后一小时，你会把这句话留给谁？',
    visibility: 'public',
    createdAt: Date.now() - 3600_000,
    askerDisplayName: '匿名',
    topAnswerSnippet: {
      authorName: '路过网友',
      isAnonymous: true,
      text: '留给那个我还没勇气开口的人。',
      likeCount: 428,
    },
    answers: [
      {
        id: 'a-1-1',
        createdAt: Date.now() - 3300_000,
        authorId: 'u1',
        authorName: '路过网友',
        isAnonymous: true,
        content: '留给那个我还没勇气开口的人。',
        likeCount: 428,
        dislikeCount: 12,
        replies: [
          {
            id: 'r-1',
            createdAt: Date.now() - 3200_000,
            authorId: 'u2',
            authorName: '匿名',
            isAnonymous: true,
            content: '我也是。',
            likeCount: 0,
            dislikeCount: 0,
            children: [],
          },
        ],
      },
      {
        id: 'a-1-2',
        createdAt: Date.now() - 3000_000,
        authorId: 'u3',
        authorName: '夜航船',
        isAnonymous: true,
        content: '留给父母。别的都可以慢慢想。',
        likeCount: 201,
        dislikeCount: 4,
        replies: [],
      },
    ],
  },
  {
    id: 'q-2',
    body: '你相信「一见钟情」还是「日久生情」？为什么。',
    visibility: 'public',
    createdAt: Date.now() - 86400_000 * 2,
    topAnswerSnippet: {
      authorName: '纸鸢',
      isAnonymous: true,
      text: '日久生情更像我的人生节奏；一见钟情像电影预告片。',
      likeCount: 312,
    },
    answers: [
      {
        id: 'a-2-1',
        createdAt: Date.now() - 86400_000 * 2 + 3600_000,
        authorId: 'u4',
        authorName: '纸鸢',
        isAnonymous: true,
        content: '日久生情更像我的人生节奏；一见钟情像电影预告片。',
        likeCount: 312,
        dislikeCount: 8,
        replies: [
          {
            id: 'r-2-1',
            createdAt: Date.now() - 86400_000 * 2 + 4200_000,
            authorId: 'u5',
            authorName: '匿名',
            isAnonymous: true,
            content: '说得太准了。',
            likeCount: 0,
            dislikeCount: 0,
            children: [],
          },
          {
            id: 'r-2-2',
            createdAt: Date.now() - 86400_000 * 2 + 5100_000,
            authorId: 'u6',
            authorName: '匿名',
            isAnonymous: true,
            replyToName: '纸鸢',
            content: '预告片也会让人买票进场啊。',
            likeCount: 0,
            dislikeCount: 0,
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: 'q-directed-1',
    body: '有些话想当面说，却怕打扰你。你现在……方便听我说吗？',
    visibility: 'directed',
    targetUserIds: ['self', 'c-1'],
    targetDisplayNames: ['我', '祁墨衍'],
    createdAt: Date.now() - 7200_000,
    askerDisplayName: '匿名',
    unreadForCurrentUser: true,
    topAnswerSnippet: undefined,
    answers: [],
  },
]

/** 个人主页各 tab 对应的帖子 id（mock） */
export const MOCK_PROFILE_LISTS: Record<string, string[]> = {
  received: ['q-directed-1'],
  asked: ['q-1'],
  answered: ['q-1', 'q-2'],
  liked: ['q-2'],
  commented: ['q-1'],
}
