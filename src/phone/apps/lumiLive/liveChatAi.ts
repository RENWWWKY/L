import type { ApiConfig } from '../api/types'
import { openAiCompatibleChat } from '../wechat/newFriendsPersona/ai'
import type { LivePersonaSnapshot } from './livePersonaContext'
import {
  mockStreamerLineFromContext,
  pickNaturalFanBatch,
  pickHostIdleLine,
  type LiveChatContext,
} from './liveChatContext'
import { isLiveChatApiReady } from './sceneAi'
import type { LiveDanmakuStyle, LiveRoom, StreamerEvent } from './types'

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

const FALLBACK_NICKS = [
  '静默观客',
  '铂金旁听',
  '夜色访客',
  '窗边的人',
  '低饱和听众',
  '未署名',
  '云端席位',
  '迟到的观众',
  '呼吸同步',
  '银线留声',
] as const

/** 系统/批次口吻，绝不允许出现在观众弹幕里 */
export function looksLikeMetaDanmaku(text: string): boolean {
  return /上一批|下一批|那批|这批|批次|接他上|接用户|楼[上]?那批|主播上一|刚那批|用户那批/.test(
    text,
  )
}

function extractJson(raw: string): unknown {
  const t = raw.trim()
  if (!t) return null
  try {
    return JSON.parse(t)
  } catch {
    const a = t.indexOf('{')
    const b = t.lastIndexOf('}')
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1))
      } catch {
        // continue
      }
    }
    const c = t.indexOf('[')
    const d = t.lastIndexOf(']')
    if (c >= 0 && d > c) {
      try {
        return JSON.parse(t.slice(c, d + 1))
      } catch {
        return null
      }
    }
  }
  return null
}

function personaBrief(persona?: LivePersonaSnapshot | null, room?: LiveRoom): string {
  if (persona) {
    return [
      persona.displayName ? `主播：${persona.displayName}` : '',
      persona.speakableTone ? `口吻：${clip(persona.speakableTone, 40)}` : '',
      persona.baseSummary ? clip(persona.baseSummary, 160) : '',
    ]
      .filter(Boolean)
      .join('\n')
  }
  return room ? `主播：${room.hostName}；${clip(room.personaBrief, 120)}` : ''
}

/** 给模型看的上下文：不要诱导它输出「上一批」字样 */
function ctxBlockForModel(ctx: LiveChatContext): string {
  const users = ctx.lastUserBatch.length ? ctx.lastUserBatch : ctx.pendingUserBatch
  return [
    users.length
      ? `有人刚说过：${users.map((t) => `「${clip(t, 20)}」`).join('、')}`
      : '暂无用户发言',
    ctx.lastFanBatch.length
      ? `弹幕区近期：${ctx.lastFanBatch.map((t) => `「${clip(t, 18)}」`).join('、')}`
      : '弹幕区较安静',
    ctx.lastHostBatch.length
      ? `主播刚说过：${ctx.lastHostBatch.map((t) => `「${clip(t, 20)}」`).join('、')}`
      : '主播暂无口述',
  ].join('\n')
}

const STYLE_HINT: Record<LiveDanmakuStyle, string> = {
  restrained: '克制冷淡、私密连线感，少起哄',
  fangirl: '花痴应援，夸夸但不喧闹',
  quiet: '短句、低声旁听',
  sarcastic: '淡淡吐槽围观',
}

async function chatJson(
  cfg: ApiConfig,
  system: string,
  user: string,
  useJsonFormat: boolean,
): Promise<string> {
  return openAiCompatibleChat(
    cfg,
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    {
      temperature: 0.9,
      max_tokens: 420,
      ...(useJsonFormat ? { response_format: 'json_object' as const } : {}),
    },
  )
}

/** 用 API 生成一批网友弹幕；失败回落「自然口语」本地库（不再含「上一批」） */
export async function generateFanDanmakuBatch(params: {
  count: number
  style: LiveDanmakuStyle
  room: LiveRoom
  ctx: LiveChatContext
  persona?: LivePersonaSnapshot | null
  apiConfig?: ApiConfig | null
}): Promise<Array<{ nick: string; text: string }>> {
  const count = Math.max(1, Math.min(5, Math.round(params.count)))
  const fallback = () =>
    pickNaturalFanBatch({
      count,
      style: params.style,
      ctx: params.ctx,
    })

  if (!isLiveChatApiReady(params.apiConfig)) return fallback()

  const system = `你是直播间观众弹幕生成器。只输出 JSON：{"items":[{"nick":"昵称","text":"弹幕"}]}。
硬性要求：
- 正好 ${count} 条
- 昵称 2～6 个中文网名，勿用主播名
- 弹幕一句中文，≤20 字，像真人观众随口说，风格「${STYLE_HINT[params.style]}」
- 可以呼应刚才听到的内容，但必须像真人聊天
- 严禁出现：上一批、那批、这批、批次、接他、接用户、楼上等系统/编剧口吻
- 勿复读世界书标题，勿出现 {{user}}/{{char}}
- 不要解释、不要 markdown`

  const user = [
    `房间：${params.room.title}`,
    personaBrief(params.persona, params.room),
    ctxBlockForModel(params.ctx),
    `请生成 ${count} 条观众弹幕。`,
  ]
    .filter(Boolean)
    .join('\n')

  const cfg = params.apiConfig!
  for (const useJson of [false, true] as const) {
    try {
      const raw = await chatJson(cfg, system, user, useJson)
      const parsed = extractJson(raw)
      const rows =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as { items?: unknown }).items
          : parsed
      if (!Array.isArray(rows) || !rows.length) continue
      const out: Array<{ nick: string; text: string }> = []
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue
        const o = row as Record<string, unknown>
        const nick = clip(String(o.nick ?? o.name ?? ''), 8)
        const text = clip(String(o.text ?? o.content ?? ''), 28)
        if (!text || looksLikeMetaDanmaku(text)) continue
        out.push({
          nick: nick || FALLBACK_NICKS[out.length % FALLBACK_NICKS.length]!,
          text,
        })
        if (out.length >= count) break
      }
      if (out.length) return out
    } catch {
      // try next mode
    }
  }
  return fallback()
}

function describeEvent(ev: StreamerEvent): string {
  switch (ev.type) {
    case 'enter':
      return '用户刚进入直播间，请用主播口吻说一句开场（淡、克制）。'
    case 'danmaku':
      return `用户发了弹幕「${clip(ev.text, 40)}」，请主播回应一句。`
    case 'gift':
      return `用户打赏了「${ev.giftName}」（¥${ev.priceYuan}），请主播淡淡致谢一句。`
    case 'fan_prompt':
      return `弹幕区有人说「${clip(ev.text, 40)}」，请主播随意接一句（可很短）。`
    default:
      return '请主播随意说一句在线闲聊。'
  }
}

/** 主播一句口述：优先 API，失败回落自然口语 mock（无「上一批」） */
export async function generateHostLine(params: {
  room: LiveRoom
  event: StreamerEvent
  ctx: LiveChatContext
  persona?: LivePersonaSnapshot | null
  apiConfig?: ApiConfig | null
}): Promise<string> {
  const fallback = () =>
    mockStreamerLineFromContext({
      room: params.room,
      event: params.event,
      ctx: params.ctx,
      persona: params.persona,
    })

  if (!isLiveChatApiReady(params.apiConfig)) return fallback()

  const name = params.persona?.displayName?.trim() || params.room.hostName
  const system = `你是直播主播「${name}」，正在浮光连麦。只输出一句口语中文（不要引号、不要 JSON），≤36 字。
要求：克制私密、像真人；可参考上下文，但严禁说「上一批 / 那批 / 批次」等系统话；禁止世界书条目标题与 {{user}}/{{char}}。`

  const user = [
    describeEvent(params.event),
    personaBrief(params.persona, params.room),
    ctxBlockForModel(params.ctx),
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const raw = await openAiCompatibleChat(
      params.apiConfig!,
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { temperature: 0.85, max_tokens: 80 },
    )
    const line = clip(raw.replace(/^["「]|["」]$/g, '').trim(), 42)
    if (!line || looksLikeMetaDanmaku(line)) return fallback()
    return line
  } catch {
    return fallback()
  }
}

export async function generateHostIdleLine(params: {
  room: LiveRoom
  ctx: LiveChatContext
  persona?: LivePersonaSnapshot | null
  apiConfig?: ApiConfig | null
}): Promise<string> {
  if (!isLiveChatApiReady(params.apiConfig)) {
    return pickHostIdleLine(params.ctx, params.persona)
  }
  const name = params.persona?.displayName?.trim() || params.room.hostName
  try {
    const raw = await openAiCompatibleChat(
      params.apiConfig!,
      [
        {
          role: 'system',
          content: `你是直播主播「${name}」。输出一句极短在线自言自语（中文，≤28 字，无引号）。克制。严禁「上一批/那批/批次」。禁止世界书条目标题与 {{user}}/{{char}}。`,
        },
        {
          role: 'user',
          content: `${personaBrief(params.persona, params.room)}\n${ctxBlockForModel(params.ctx)}\n请说一句。`,
        },
      ],
      { temperature: 0.9, max_tokens: 60 },
    )
    const t = clip(raw.replace(/^["「]|["」]$/g, '').trim(), 36)
    if (!t || looksLikeMetaDanmaku(t)) return pickHostIdleLine(params.ctx, params.persona)
    return t
  } catch {
    return pickHostIdleLine(params.ctx, params.persona)
  }
}
