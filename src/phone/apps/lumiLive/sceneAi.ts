import type { ApiConfig } from '../api/types'
import { openAiCompatibleChat } from '../wechat/newFriendsPersona/ai'
import type { LivePersonaSnapshot } from './livePersonaContext'
import { buildMockLiveScene } from './sceneMock'
import type { LiveRoom, LiveSceneBeat, LiveSceneBeatKind, LiveScenePlayback } from './types'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

export function isLiveChatApiReady(cfg?: ApiConfig | null): boolean {
  return Boolean(cfg?.apiUrl?.trim() && cfg?.apiKey?.trim() && cfg?.modelId?.trim())
}

function normalizeKind(raw: unknown): LiveSceneBeatKind | null {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'scene' || s === '画面' || s === '旁白') return 'scene'
  if (s === 'dialogue' || s === '对白' || s === 'dialog' || s === '台词') return 'dialogue'
  if (s === 'action' || s === '动作') return 'action'
  return null
}

function extractJsonArray(raw: string): unknown[] | null {
  const t = raw.trim()
  if (!t) return null
  try {
    const parsed = JSON.parse(t) as unknown
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object') {
      const o = parsed as Record<string, unknown>
      if (Array.isArray(o.beats)) return o.beats
      if (Array.isArray(o.items)) return o.items
      if (Array.isArray(o.data)) return o.data
    }
  } catch {
    // fall through
  }
  const start = t.indexOf('[')
  const end = t.lastIndexOf(']')
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(t.slice(start, end + 1)) as unknown
      if (Array.isArray(parsed)) return parsed
    } catch {
      return null
    }
  }
  return null
}

function beatsFromModel(raw: string, durationMs: number): LiveSceneBeat[] | null {
  const rows = extractJsonArray(raw)
  if (!rows?.length) return null
  const cleaned: Array<{ kind: LiveSceneBeatKind; text: string }> = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const kind = normalizeKind(o.kind ?? o.type ?? o.tag)
    const text = clip(String(o.text ?? o.content ?? o.line ?? ''), 72)
    if (!kind || !text) continue
    cleaned.push({ kind, text })
  }
  if (cleaned.length < 2) return null

  const n = Math.min(10, Math.max(cleaned.length, 2))
  const list = cleaned.slice(0, n)
  const slot = durationMs / list.length
  return list.map((b, i) => ({
    id: uid(`beat-${i}`),
    kind: b.kind,
    atMs: Math.round(i * slot),
    endMs: i === list.length - 1 ? durationMs : Math.round((i + 1) * slot),
    text: b.text,
  }))
}

function buildPersonaBlock(persona?: LivePersonaSnapshot | null): string {
  if (!persona) return ''
  const parts = [
    persona.baseSummary ? `基础：${clip(persona.baseSummary, 220)}` : '',
    persona.prologueSummary ? `序言：${clip(persona.prologueSummary, 180)}` : '',
    persona.epilogueSummary ? `尾声延展：${clip(persona.epilogueSummary, 180)}` : '',
    persona.speakableTone ? `口吻：${clip(persona.speakableTone, 40)}` : '',
  ].filter(Boolean)
  return parts.join('\n')
}

async function callSceneModel(cfg: ApiConfig, system: string, user: string, useJsonFormat: boolean) {
  return openAiCompatibleChat(
    cfg,
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    {
      temperature: 0.85,
      max_tokens: 1000,
      ...(useJsonFormat ? { response_format: 'json_object' as const } : {}),
    },
  )
}

/**
 * 用聊天 API 生成「画面 / 对白 / 动作」时间轴（不生图）。
 * 仅在完全未配置 API 时用本地兜底；已配置却失败会带上 error。
 */
export async function generateLiveScenePlayback(params: {
  room: LiveRoom
  userText: string
  durationMs: number
  recentUserBatch?: string[]
  recentFanBatch?: string[]
  recentHostBatch?: string[]
  persona?: LivePersonaSnapshot | null
  apiConfig?: ApiConfig | null
}): Promise<{ scene: LiveScenePlayback; viaApi: boolean; error?: string }> {
  const durationMs = Math.max(6000, Math.min(60000, Math.round(params.durationMs)))
  const hostName = params.persona?.displayName?.trim() || params.room.hostName
  const userText = params.userText.trim() || '开场'
  const fallback = () =>
    buildMockLiveScene({
      room: params.room,
      userText,
      durationMs,
      recentUserBatch: params.recentUserBatch,
      recentFanBatch: params.recentFanBatch,
      recentHostBatch: params.recentHostBatch,
      persona: params.persona,
    })

  if (!isLiveChatApiReady(params.apiConfig)) {
    return {
      scene: fallback(),
      viaApi: false,
      error: '未配置聊天 API（请在 API 设置里填写地址 / Key / 模型）',
    }
  }

  const personaBlock = buildPersonaBlock(params.persona)
  const userBatch = (params.recentUserBatch ?? []).map((t) => clip(t, 24)).filter(Boolean)
  const fanBatch = (params.recentFanBatch ?? []).map((t) => clip(t, 20)).filter(Boolean)
  const hostBatch = (params.recentHostBatch ?? []).map((t) => clip(t, 24)).filter(Boolean)

  const system = `你是「浮光直播」的画面时间轴编剧。为拟真连麦直播生成字幕时间轴（不生图）。
只输出一个 JSON 对象：{"beats":[{"kind":"scene"|"dialogue"|"action","text":"..."},...]}
规则：
- scene=旁白/镜头环境（中文一句，≤36字）
- action=主播神情或肢体动作（中文一句，≤28字）
- dialogue=主播口述，可用「」（中文一句，≤28字）
- 共 5～8 项，scene/action/dialogue 交错
- 克制私密，贴合人设；禁止世界书条目标题、禁止 {{user}}/{{char}}
- 禁止出现「上一批」「那批」「批次」等系统话术`

  const user = [
    `主播：${hostName}`,
    `房间标题：${params.room.title}`,
    `目标时长：约 ${Math.round(durationMs / 1000)} 秒`,
    `触发：${userText}`,
    userBatch.length ? `观众刚说的话（仅供理解气氛，勿在文案里写「上一批」）：${userBatch.map((t) => `「${t}」`).join('、')}` : '',
    fanBatch.length ? `弹幕区近期内容（同上）：${fanBatch.map((t) => `「${t}」`).join('、')}` : '',
    hostBatch.length ? `主播刚说过（同上）：${hostBatch.map((t) => `「${t}」`).join('、')}` : '',
    personaBlock ? `人设参考：\n${personaBlock}` : `人设摘要：${clip(params.room.personaBrief, 160)}`,
    `请输出 {"beats":[...]}。`,
  ]
    .filter(Boolean)
    .join('\n')

  const cfg = params.apiConfig!
  let lastErr = ''
  // 先不强制 response_format（不少中转不支持），再试 json_object
  for (const useJson of [false, true] as const) {
    try {
      const raw = await callSceneModel(cfg, system, user, useJson)
      const beats = beatsFromModel(raw, durationMs)
      if (beats?.length) {
        return {
          scene: {
            id: uid('scene'),
            triggerText: userText,
            hostName,
            durationMs,
            beats,
          },
          viaApi: true,
        }
      }
      lastErr = '模型返回无法解析为画面节拍'
    } catch (e) {
      lastErr = e instanceof Error ? e.message : '画面 API 请求失败'
    }
  }

  return {
    scene: fallback(),
    viaApi: false,
    error: lastErr || '画面生成失败',
  }
}
