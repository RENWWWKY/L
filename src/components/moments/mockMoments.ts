export type MomentComment = {
  id: string
  author: string
  content: string
  replyTo?: string
}

export type MomentItemModel = {
  id: string
  authorName: string
  authorAvatar: string
  content: string
  images?: string[]
  location?: string
  timestamp: number
  likes?: string[]
  comments?: MomentComment[]
}

const A1 = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80'
const A2 = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80'
const A3 = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80'
const C1 = 'https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=1400&q=80'
const I = [
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1519999482648-25049ddd37b1?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1521292270410-a8c4d716d518?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80',
]

export const momentsCoverImage = C1
const now = Date.now()
const minute = 60 * 1000
const hour = 60 * minute
const day = 24 * hour
const lastMonth = new Date()
lastMonth.setMonth(lastMonth.getMonth() - 1)
lastMonth.setDate(15)
lastMonth.setHours(16, 20, 0, 0)
const lastYear = new Date()
lastYear.setFullYear(lastYear.getFullYear() - 1)
lastYear.setMonth(11)
lastYear.setDate(1)
lastYear.setHours(9, 30, 0, 0)

export const mockMoments: MomentItemModel[] = [
  {
    id: 'm-1',
    authorName: '林雾',
    authorAvatar: A1,
    content:
      '今天把所有通知都关掉了两小时，只留窗边的风声。原来安静不是空白，而是把自己重新放回生活。',
    timestamp: now - 30 * 1000,
    likes: ['简宁', '许知', '程远'],
    comments: [
      { id: 'c-1-1', author: '简宁', content: '这段话写得太舒服了。' },
      { id: 'c-1-2', author: '程远', content: '你终于休息了，值得点赞。' },
    ],
  },
  {
    id: 'm-2',
    authorName: '沈言',
    authorAvatar: A2,
    content:
      '午后散步偶遇这束光，像电影结尾那一秒。今天就先慢一点，给自己留点呼吸感。',
    images: [I[0]],
    location: '上海市·徐汇区·衡山路',
    timestamp: now - day - 2 * hour,
    likes: ['林雾', '白叙'],
    comments: [{ id: 'c-2-1', author: '白叙', content: '这张构图很干净。' }],
  },
  {
    id: 'm-3',
    authorName: '白叙',
    authorAvatar: A3,
    content:
      '四帧碎片，拼出一整个傍晚。风很轻，云也很慢，街边的灯刚好亮起来。',
    images: [I[1], I[2], I[3], I[4]],
    timestamp: lastMonth.getTime(),
    likes: ['林雾'],
    comments: [{ id: 'c-3-1', author: '林雾', content: '像一本会呼吸的画册。' }],
  },
  {
    id: 'm-4',
    authorName: '许知',
    authorAvatar: A1,
    content:
      '九宫格记录一场不赶时间的周末。每一帧都很普通，但拼在一起就有了生活的纹理。\n\n长文测试：想把最近发生的小事都记下来。比如清晨的地铁并不拥挤，咖啡店的玻璃反光里有一只路过的猫，傍晚在桥边站了很久才决定回家。可能没有什么宏大的意义，但这些细碎时刻让我确认，日子确实在慢慢变好。',
    images: I,
    location: '杭州市·西湖区·杨公堤',
    timestamp: lastYear.getTime(),
    likes: ['林雾', '沈言', '白叙', '简宁', '程远', '顾川'],
    comments: [
      { id: 'c-4-1', author: '林雾', content: '这组照片太有呼吸感了。' },
      { id: 'c-4-2', author: '沈言', content: '最后一张山脊线绝了。' },
      { id: 'c-4-3', author: '简宁', replyTo: '沈言', content: '我也最喜欢那张！' },
      { id: 'c-4-4', author: '程远', content: '文案和画面都很稳。' },
      { id: 'c-4-5', author: '顾川', replyTo: '许知', content: '下次拍摄带上我。' },
    ],
  },
  {
    id: 'm-5',
    authorName: '简宁',
    authorAvatar: A2,
    content: '记录今天会议后的整理笔记，先把节奏拉慢，再把事情做好。',
    timestamp: now - 3 * hour,
    likes: ['林雾'],
  },
]
