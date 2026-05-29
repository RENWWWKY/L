export const PROFILE_MOCK = {
  user: {
    nickname: '林星晚',
    avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=lin',
    neteaseLevel: 8,
    following: 42,
    followers: 1028,
    totalListenHours: 1240,
  },
  bondData: {
    topCharacter: null,
    recentVibe: '微醺 / R&B',
  },
  musicAssets: {
    likedSongs: {
      count: 1205,
      cover: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5294b?w=300&q=80',
    },
    createdPlaylists: [
      {
        id: 1,
        title: '晚安电台',
        count: 45,
        cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
      },
    ],
    savedPlaylists: [
      {
        id: 2,
        title: '落日飞车合集',
        count: 28,
        cover: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&q=80',
      },
    ],
  },
  notes: [
    {
      id: 101,
      content: '这首歌的贝斯前奏一响，就想起了那天在天台上的风...',
      song: { title: 'City Ruins', artist: 'Keiichi Okabe' },
      likes: 34,
      time: '2天前',
    },
  ],
} as const
