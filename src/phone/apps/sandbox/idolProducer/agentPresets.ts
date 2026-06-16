import type { AgencyState, Artist, StoryChapter, TrainConfig } from './agentTypes'

function artist(
  id: string,
  name: string,
  tags: string[],
  stats: Artist['stats'],
  metrics: Partial<Artist['metrics']> = {},
  personaSummary?: string,
): Artist {
  return {
    id,
    name,
    avatar: '',
    tags,
    stats,
    metrics: {
      fans: metrics.fans ?? 12000,
      commercialValue: metrics.commercialValue ?? 45,
      affection: metrics.affection ?? 20,
    },
    personaSummary,
  }
}

export const PRESET_ROSTER: Artist[] = [
  artist(
    'a-linyuan',
    '林远',
    ['冰山影帝', '禁欲系'],
    { vocal: 62, acting: 92, variety: 38, charm: 88 },
    { fans: 280000, commercialValue: 78, affection: 35 },
    '三金影帝候选人，镜头外沉默寡言，对经纪人格外克制却会在深夜发很长语音。',
  ),
  artist(
    'a-xiawei',
    '夏薇',
    ['傲娇主唱', '舞台女王'],
    { vocal: 95, acting: 55, variety: 72, charm: 90 },
    { fans: 420000, commercialValue: 85, affection: 28 },
    '顶流女团出身，嘴硬心软，讨厌被安排但会偷偷记住经纪人的喜好。',
  ),
]

export const PRESET_SCOUT_POOL: Artist[] = [
  artist(
    'scout-zhou',
    '周予安',
    ['新人练习生', '潜力股'],
    { vocal: 78, acting: 60, variety: 65, charm: 70 },
    { fans: 3200, commercialValue: 22, affection: 15 },
    '选秀遗珠，眼神干净，渴望被看见。',
  ),
  artist(
    'scout-chen',
    '陈暮',
    ['地下rapper', '反差萌'],
    { vocal: 70, acting: 48, variety: 88, charm: 74 },
    { fans: 8900, commercialValue: 30, affection: 18 },
    '地下舞台出身，台上张扬台下社恐。',
  ),
  artist(
    'scout-ye',
    '叶知秋',
    ['古典舞者', '清冷美人'],
    { vocal: 55, acting: 72, variety: 50, charm: 86 },
    { fans: 15000, commercialValue: 40, affection: 22 },
    '国家舞团退役，对娱乐圈规则半懂半疑。',
  ),
]

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 'ch-prologue',
    title: '序章 · 临危受命',
    scenes: [
      {
        id: 'sc-1',
        lines: [
          '暴雨敲打着摩天大楼的落地窗，霓虹在雨幕里晕染成一片暧昧的粉。',
          '你推开总裁办公室的门，桌上放着一份烫金合约——「金牌经纪人」四个字，像一枚尚未拆封的戒指。',
          '「公司今年只给你三个月。」秘书低声说，「旗下艺人要么翻红，要么解约。」',
          '你望向窗外，这座城市从不睡觉，而你的故事，从今夜开始。',
        ],
        choices: [
          {
            id: 'c-bold',
            label: '当众宣布全面改革，立下军令状',
            effects: { reputation: 8, budget: -3000 },
          },
          {
            id: 'c-calm',
            label: '先私下摸底艺人状况，稳扎稳打',
            effects: { reputation: 3, affection: 5, artistId: 'a-linyuan' },
          },
          {
            id: 'c-scout',
            label: '立刻启动新人寻访计划',
            effects: { budget: -5000, triggerHotSearch: true, hotSearchHint: '神秘新经纪人深夜加班' },
          },
        ],
      },
      {
        id: 'sc-2',
        lines: [
          '散会后，走廊尽头传来压低的争吵声。',
          '林远靠在窗边，领带松了一半，眼底是藏不住的疲惫。',
          '「又是吻戏？」他抬眼看你，语气淡得像在讨论天气，「合约里没写我可以拒绝。」',
          '狗仔的闪光灯在楼下若隐若现——显然，消息已经走漏了。',
        ],
        choices: [
          {
            id: 'c-block',
            label: '替他挡住狗仔，护他离开',
            effects: { budget: -5000, affection: 10, artistId: 'a-linyuan', triggerHotSearch: true, hotSearchHint: '影帝深夜护经纪人' },
          },
          {
            id: 'c-contract',
            label: '搬出合约条款，公事公办',
            effects: { reputation: 5, affection: -5, artistId: 'a-linyuan' },
          },
          {
            id: 'c-negotiate',
            label: '承诺帮他谈改剧本，争取亲密戏删减',
            effects: { budget: -2000, affection: 8, artistId: 'a-linyuan' },
          },
        ],
      },
    ],
  },
]

export const TRAIN_CONFIGS: TrainConfig[] = [
  {
    type: 'vocal',
    label: '声乐课',
    cost: 2000,
    statKey: 'vocal',
    delta: 10,
    flavor: '录音棚里，他一遍遍哼唱同一个音节，直到喉结微颤也不肯停。',
  },
  {
    type: 'acting',
    label: '表演课',
    cost: 2500,
    statKey: 'acting',
    delta: 10,
    flavor: '镜前练习时，他忽然看向你，眼神里多了某种不属于剧本的东西。',
  },
  {
    type: 'variety',
    label: '形体课',
    cost: 1800,
    statKey: 'variety',
    delta: 10,
    flavor: '汗湿的练习室、节拍与笑声交织——他难得露出了少年气的 grin。',
  },
]

export const DATE_STORY_PRESETS: Record<string, { title: string; lines: string[] }> = {
  'a-linyuan': {
    title: '深夜兜风',
    lines: [
      '他摇下车窗，城市的风灌进来，带着雨后青草的气息。',
      '「你知道我为什么接那部戏吗？」他目视前方，声音很轻。',
      '「因为编剧写了一句——主角只有在车里才会说真话。」',
      '红灯亮起。他侧过头，目光落在你脸上，比任何镜头都近。',
      '「而我现在，想说的也是真话。」',
    ],
  },
  'a-xiawei': {
    title: '剧组探班',
    lines: [
      '片场的喧嚣在她靠近时忽然安静了半拍。',
      '她递过来一杯冰美式，杯壁上凝着水珠，像某种小心翼翼的示好。',
      '「别以为我是特意等你的。」她别过脸，耳尖却红了。',
      '「只是……今天的戏，想让你第一个看到。」',
    ],
  },
}

export function buildInitialAgencyState(): AgencyState {
  const firstChapter = STORY_CHAPTERS[0]
  const firstScene = firstChapter.scenes[0]
  return {
    budget: 120000,
    reputation: 42,
    artists: [...PRESET_ROSTER],
    unlockedArtists: shuffleScoutPool(),
    hotSearches: buildInitialHotSearches(),
    storyChapterId: firstChapter.id,
    storySceneId: firstScene.id,
    storyLineIndex: 0,
    selectedArtistId: PRESET_ROSTER[0]?.id ?? null,
    chatThreads: {},
    dateUnlockedArtistIds: [],
    lastHotSearchTick: Date.now(),
    stamina: 3,
  }
}

/** 扩展 stamina 到 AgencyState - I need to add it to types */
function shuffleScoutPool(): Artist[] {
  const pool = [...PRESET_SCOUT_POOL]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 3)
}

function buildInitialHotSearches(): AgencyState['hotSearches'] {
  return [
    {
      id: 'hs-1',
      rank: 1,
      keyword: '盛夏档综艺阵容官宣',
      heat: 98,
      type: 'positive',
      createdAt: Date.now(),
    },
    {
      id: 'hs-2',
      rank: 2,
      keyword: '林远新剧路透',
      heat: 87,
      type: 'positive',
      artistId: 'a-linyuan',
      createdAt: Date.now(),
    },
    {
      id: 'hs-3',
      rank: 3,
      keyword: '某顶流恋情瓜',
      heat: 76,
      type: 'negative',
      createdAt: Date.now(),
    },
  ]
}

export function randomScoutCandidate(): Artist {
  const templates = PRESET_SCOUT_POOL
  const base = templates[Math.floor(Math.random() * templates.length)]
  const variance = () => Math.floor(Math.random() * 12) - 6
  return {
    ...base,
    id: `scout-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    stats: {
      vocal: clampStat(base.stats.vocal + variance()),
      acting: clampStat(base.stats.acting + variance()),
      variety: clampStat(base.stats.variety + variance()),
      charm: clampStat(base.stats.charm + variance()),
    },
    metrics: {
      fans: Math.max(500, base.metrics.fans + Math.floor(Math.random() * 5000)),
      commercialValue: clampStat(base.metrics.commercialValue + variance()),
      affection: 10 + Math.floor(Math.random() * 15),
    },
  }
}

function clampStat(n: number) {
  return Math.max(20, Math.min(99, n))
}
