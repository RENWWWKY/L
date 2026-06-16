export type ListenNoteAuthor = {
  name: string
  type: 'character' | 'user'
  avatar: string
  relationLabel?: string
}

export type ListenAttachedMusic = {
  title: string
  artist: string
  cover: string
  /** 网易云歌曲 id，有值时可调用 /song/url/v1 播放 */
  songId?: number
  /** 主唱歌手 id，用于跳转歌手页 */
  artistId?: number
}

export type ListenFeedNote = {
  id: string
  author: ListenNoteAuthor
  time: string
  content: string
  attachedMusic: ListenAttachedMusic
  stats: { likes: number; comments: number }
}

export const NOTES_FEED_MOCK: { notes: ListenFeedNote[] } = {
  notes: [
    {
      id: 'post_2',
      author: {
        name: '林星晚',
        type: 'user',
        avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=lin',
      },
      time: '2小时前',
      content:
        '终于结束了漫长的一天。只有坂本龙一的琴声能安抚此刻的疲惫了，今晚就不想那么多了，晚安各位。 🌙',
      attachedMusic: {
        title: 'Merry Christmas Mr. Lawrence',
        artist: 'Ryuichi Sakamoto',
        cover: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=300&q=80',
      },
      stats: { likes: 45, comments: 5 },
    },
    {
      id: 'post_3',
      author: {
        name: '屿岸',
        type: 'character',
        relationLabel: '知己',
        avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=yuan',
      },
      time: '昨天',
      content:
        '偶然听到的独立乐队，主唱的咬字有些做作，但编曲出乎意料的有趣。某人应该会喜欢这种奇奇怪怪的调子。',
      attachedMusic: {
        title: '微醺暗恋期',
        artist: '某独立乐队',
        cover: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5294b?w=300&q=80',
      },
      stats: { likes: 89, comments: 14 },
    },
  ],
}
