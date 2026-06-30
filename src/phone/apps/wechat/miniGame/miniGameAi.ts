/**
 * 游乐空间 · LLM 伴玩反应层（仅情绪价值，不参与游戏逻辑）
 */

import type { ApiConfig } from '../../api/types'
import type { Character } from '../newFriendsPersona/types'
import { buildCharacterCard } from '../wechatChatAi'
import type { GameEventType, MiniGameType } from './types'
import { getGameDisplayName } from './gameCatalog'

const EVENT_LABELS: Record<GameEventType, string> = {
  combo: '连击/消除',
  crisis: '危机/快输了',
  gameOver: '游戏结束',
  opponentMove: '对手妙棋',
  milestone: '里程碑',
  win: '胜利',
  lose: '失败',
}

export async function fetchGameReaction(params: {
  api: ApiConfig | null
  character: Character | null
  gameType: MiniGameType
  eventType: GameEventType
  eventDetail?: string
  score?: number
}): Promise<string | null> {
  const { api, character, gameType, eventType, eventDetail, score } = params
  if (!api?.apiUrl?.trim() || !api.apiKey?.trim() || !api.modelId?.trim()) return null

  const gameName = getGameDisplayName(gameType)
  const eventLabel = EVENT_LABELS[eventType]
  const persona = buildCharacterCard(character, { bioMaxChars: 280 })

  const system = [
    '你是微信聊天中的角色，正在旁观或参与用户的小游戏对局。',
    persona ? `【你的人设】\n${persona}` : '【人设】高冷、克制、偶尔毒舌的伴玩者。',
    '规则：',
    `- 用户正在玩「${gameName}」。`,
    `- 刚刚触发事件：${eventLabel}${eventDetail ? `（${eventDetail}）` : ''}${typeof score === 'number' ? `，当前分数 ${score}` : ''}。`,
    '- 结合你的人设（高冷/毒舌/爹系等），给出不超过20个字的一句评价或指导。',
    '- 直接返回一句中文对白，不要引号、不要前缀、不要解释。',
  ].join('\n')

  const user = '请给出你的伴玩反应。'

  try {
    const base = api.apiUrl.trim().replace(/\/+$/, '')
    const endpoint = base.endsWith('/chat/completions') ? base : `${base}/v1/chat/completions`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${api.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: api.modelId.trim(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.88,
        max_tokens: 60,
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
    return raw.replace(/^["「『]|["」』]$/g, '').slice(0, 40) || null
  } catch {
    return null
  }
}
