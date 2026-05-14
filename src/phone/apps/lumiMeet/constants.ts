import type { LumiMeetPersistedState, RadarFilters, SquarePostStyle } from './meetTypes'

export { pickMeetAvatar, buildMeetAvatarExclusion, type MeetAvatarExclusion } from './meetAvatarPool'

export const LUMI_MEET_KV_KEY = 'lumi-meet-persist-v1'

/** 雷达「调校中」最短展示时间（毫秒），避免离线/秒回时像没点在生成） */
export const MEET_RADAR_SEARCH_MIN_UI_MS = 1600

/** 重逢：missed 角色距上次相遇满此时长后才可再次被雷达抽到（毫秒） */
export const MEET_REUNION_COOLDOWN_MS = 24 * 60 * 60 * 1000

/** 雷达抽取：重逢宿命池的概率（其余走 AI 新角色） */
export const MEET_REUNION_ROLL_P = 0.3

/** 广场生成帖子的风格文案（中文主导 + 英文点缀） */
export const SQUARE_STYLE_LABELS: Record<
  SquarePostStyle,
  { zh: string; en: string; hint: string }
> = {
  comedy: { zh: '搞笑吐槽', en: 'COMEDY', hint: '轻松玩梗、自嘲与脑洞' },
  emo: { zh: '深夜独白', en: 'EMO', hint: '孤独感与情绪碎片' },
  serious: { zh: '硬核交友', en: 'REAL', hint: '认真写下筛选条件与底线' },
  buddy: { zh: '寻找搭子', en: 'CREW', hint: '运动、看展、自习等同频邀约' },
}

export const DEFAULT_RADAR_FILTERS: RadarFilters = {
  gender: 'any',
  purpose: 'love',
  keywords: '',
  orientationPreferences: [],
  ageMin: 22,
  ageMax: 38,
  meetIntentions: ['romance'],
}

export const DEFAULT_MEET_STATE: LumiMeetPersistedState = {
  version: 4,
  npcs: [],
  squarePosts: [],
  chatThreads: {},
  intimacyByNpcId: {},
  encounterSwapByNpcId: {},
  meetProfile: {
    displayName: '',
    intent: '认真相处，慢慢来',
    bio: '',
    orientation: '不限',
  },
  radarFilters: { ...DEFAULT_RADAR_FILTERS },
  rewindChargesRemaining: 24,
}

