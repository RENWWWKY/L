/**
 * 金牌经纪人模拟器 — LLM 衔接层
 * 剧情续写、热搜生成、艺人聊天均通过此模块对接后端大模型。
 */

import type { Artist, ChatMessage, HotSearchType } from './agentTypes'
import { PRESET_ROSTER } from './agentPresets'

export interface StoryContinuationResult {
  lines: string[]
  choices?: Array<{ label: string; effectsHint?: string }>
}

export interface HotSearchAiItem {
  keyword: string
  heat: number
  type: HotSearchType
  artistId?: string
}

export interface ChatAiResult {
  text: string
  affectionDelta?: number
}

/** 主线剧情：根据玩家选择续写下一段 */
export async function fetchAIStoryContinuation(params: {
  chapterId: string
  sceneId: string
  choiceLabel: string
}): Promise<StoryContinuationResult | null> {
  // TODO: 对接后端 LLM — POST /api/idol-producer/story
  void params
  return null
}

/** 热搜榜：根据艺人状态与剧情 hint 生成词条 */
export async function fetchAIHotSearch(params: {
  artists: Artist[]
  hint?: string
}): Promise<HotSearchAiItem[]> {
  // TODO: 对接后端 LLM — POST /api/idol-producer/hot-search
  const { artists, hint } = params
  const artist = artists[Math.floor(Math.random() * artists.length)] ?? PRESET_ROSTER[0]

  const negative = hint?.includes('吻') || hint?.includes('密会') || Math.random() < 0.35

  if (negative) {
    return [
      {
        keyword: hint ? `# ${hint} #` : `# ${artist.name}假戏真做 #`,
        heat: 99,
        type: 'negative',
        artistId: artist.id,
      },
      {
        keyword: `# ${artist.name}新剧演技炸裂 #`,
        heat: 82,
        type: 'positive',
        artistId: artist.id,
      },
      {
        keyword: '# 经纪公司连夜公关 #',
        heat: 71,
        type: 'negative',
      },
    ]
  }

  return [
    {
      keyword: `# ${artist.name}深夜发文 #`,
      heat: 94,
      type: 'positive',
      artistId: artist.id,
    },
    {
      keyword: hint ? `# ${hint} #` : '# 金牌经纪人上位 #',
      heat: 86,
      type: 'positive',
    },
    {
      keyword: '# 暑期档神仙阵容 #',
      heat: 78,
      type: 'positive',
    },
  ]
}

/** 线上联络：艺人人设实时回复 */
export async function fetchAIChatReply(params: {
  artist: Artist
  transcript: ChatMessage[]
}): Promise<ChatAiResult> {
  // TODO: 对接 wechatChatAi.requestWeChatPeerReplyBubbles 或专用经纪人 API
  const { transcript } = params
  const artistName = params.artist.name
  const lastUser = [...transcript].reverse().find((m) => m.role === 'user')
  const userText = lastUser?.content ?? ''

  const fallbacks = [
    `……你发的「${userText.slice(0, 12)}」我看到了。今晚收工后再说？`,
    `${artistName}，你总是挑我最忙的时候找我。`,
    '嗯。有你盯着，我反而安心一点。',
    '别熬夜了。……我也是说给自己听的。',
  ]

  const text = fallbacks[Math.floor(Math.random() * fallbacks.length)]
  return { text, affectionDelta: userText.length > 8 ? 2 : 1 }
}
