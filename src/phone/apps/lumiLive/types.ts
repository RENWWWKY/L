export type LiveGiftId = 'americano' | 'letter' | 'stardust'

export type LiveGift = {
  id: LiveGiftId
  name: string
  priceYuan: number
  ceremonyLabel: string
  blurb: string
}

export type LiveRoomHostKind = 'character' | 'npc'

export type LiveRoom = {
  id: string
  hostKind: LiveRoomHostKind
  characterId?: string
  hostName: string
  avatarUrl: string
  coverUrl: string
  videoUrl?: string
  title: string
  viewerCount: number
  personaBrief: string
}

export type LiveChatLine = {
  id: string
  nick: string
  text: string
  kind: 'fan' | 'user' | 'host' | 'system'
  at: number
}

export type SponsorshipCeremonyPayload = {
  id: string
  userNick: string
  hostName: string
  giftLabel: string
}

export type StreamerEvent =
  | { type: 'enter' }
  | { type: 'danmaku'; text: string }
  | { type: 'gift'; giftName: string; priceYuan: number }
  | { type: 'fan_prompt'; text: string }

export type LiveDanmakuStyle = 'restrained' | 'fangirl' | 'quiet' | 'sarcastic'

/** 画面时间轴节拍：场景描述 / 对白 / 动作 */
export type LiveSceneBeatKind = 'scene' | 'dialogue' | 'action'

export type LiveSceneBeat = {
  id: string
  kind: LiveSceneBeatKind
  /** 相对场景起点的毫秒 */
  atMs: number
  endMs: number
  text: string
}

export type LiveScenePlayback = {
  id: string
  triggerText: string
  hostName: string
  durationMs: number
  beats: LiveSceneBeat[]
}

export type LiveRoomSettings = {
  backgroundUrl: string
  danmakuBatchCount: number
  danmakuStyle: LiveDanmakuStyle
  /** 每次「反应」生成的直播画面时长（秒） */
  sceneDurationSec: number
}

export const DEFAULT_LIVE_ROOM_SETTINGS: LiveRoomSettings = {
  backgroundUrl: '',
  danmakuBatchCount: 1,
  danmakuStyle: 'restrained',
  sceneDurationSec: 12,
}

export const LIVE_SCENE_DURATION_OPTIONS = [8, 12, 16, 24, 32] as const

export const LIVE_DANMAKU_STYLE_OPTIONS: Array<{
  id: LiveDanmakuStyle
  label: string
  blurb: string
}> = [
  { id: 'restrained', label: '克制冷淡', blurb: '私密连线感，少起哄' },
  { id: 'fangirl', label: '花痴应援', blurb: '偏激动的夸夸与占位' },
  { id: 'quiet', label: '安静旁听', blurb: '短句、低声、少打扰' },
  { id: 'sarcastic', label: '毒舌围观', blurb: '淡淡吐槽，不喧闹' },
]

export const LIVE_SCENE_BEAT_LABEL: Record<LiveSceneBeatKind, string> = {
  scene: '画面',
  dialogue: '对白',
  action: '动作',
}
