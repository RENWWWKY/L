import { loadResolvedApiConfig } from '../../../../phone/apps/api/loadResolvedApiConfig'
import type { ApiConfig } from '../../../../phone/apps/api/types'
import { openAiCompatibleChat } from '../../../../phone/apps/wechat/newFriendsPersona/ai'

import { buildNpcDirectorBriefs } from './jbsDiscussRoleBriefs'
import {
  enrichDiscussBeatActions,
  normalizeDiscussBeat,
  type JbsDiscussNpcReply,
} from './jbsDiscussBeatActions'
import { mergeDiscussBubbleMessages } from './jbsDiscussBubbleSplit'
import { parseDiscussAiRoot } from './jbsDiscussJsonParse'
import {
  buildDiscussPressureHints,
  formatDiscussTranscriptLine,
  getNpcRoster,
  getPublicClueSummaries,
  type PublicDiscussRound,
  type YuyePlayerRole,
} from './jbsPublicDiscuss'
import type { JBSChatMessage } from './jbsFlowTypes'

export type { JbsDiscussNpcReply } from './jbsDiscussBeatActions'

export type JbsDiscussAiResult = {
  replies: JbsDiscussNpcReply[]
}

/** 讨论 AI 生成失败（含可读原因） */
export class JbsDiscussGenerationError extends Error {
  readonly reason: string

  constructor(reason: string) {
    super(`讨论生成失败：${reason}`)
    this.name = 'JbsDiscussGenerationError'
    this.reason = reason
  }
}

type ParseDiscussResult = {
  replies: JbsDiscussNpcReply[]
  failReason?: string
}

const SNIPPET_MAX = 120

function clipSnippet(raw: string): string {
  const t = raw.replace(/\s+/g, ' ').trim()
  if (!t) return '（空）'
  return t.length <= SNIPPET_MAX ? t : `${t.slice(0, SNIPPET_MAX)}…`
}

/** 单次模型输出：建议最少 beat 数（无上限，模型输出多少就播多少） */
export const DISCUSS_BEATS_MIN = 6
/** 本轮至少几名 NPC 参与接话 */
export const DISCUSS_NPC_SPEAKERS_MIN = 2

/** 讨论气泡露出间隔（毫秒） */
export const DISCUSS_BUBBLE_DELAY_MIN_MS = 1000
export const DISCUSS_BUBBLE_DELAY_MAX_MS = 2000

export function nextDiscussBubbleDelayMs(): number {
  return (
    DISCUSS_BUBBLE_DELAY_MIN_MS +
    Math.floor(Math.random() * (DISCUSS_BUBBLE_DELAY_MAX_MS - DISCUSS_BUBBLE_DELAY_MIN_MS + 1))
  )
}

const ROUND_RULES: Record<PublicDiscussRound, string> = {
  1: '围绕时间线、离席动线、酒窖刷卡、C杠2 未登记香槟、副卡失败展开对质。',
  2: '结合第二批线索追问矛盾点；可更尖锐，但仍不得凭空捏造物证。',
  3: '最后一轮集中讨论，推动各人说清关键空白，语气可疲惫、锋利。',
}

function pushBeat(
  rec: Record<string, unknown>,
  allowed: Set<string>,
  replies: JbsDiscussNpcReply[],
  rejectedSpeakers: Set<string>,
  stats: { empty: number },
): void {
  const speaker = String(rec.speaker ?? '').trim()
  const line = String(rec.line ?? rec.text ?? '').trim()
  const action = String(rec.action ?? '').trim() || undefined
  if (!speaker || !line) {
    if (speaker && !line) stats.empty += 1
    return
  }
  if (!allowed.has(speaker)) {
    rejectedSpeakers.add(speaker)
    return
  }
  replies.push(normalizeDiscussBeat({ speaker, line, action }, replies.length))
}

function finalizeDiscussReplies(replies: JbsDiscussNpcReply[]): JbsDiscussNpcReply[] {
  return enrichDiscussBeatActions(replies)
}

function parseDiscussAiJson(raw: string, allowedSpeakers: string[]): ParseDiscussResult {
  const stats = { empty: 0 }
  const trimmed = raw.trim()
  if (!trimmed) {
    return { replies: [], failReason: '模型返回内容为空，请重试或更换模型。' }
  }

  const root = parseDiscussAiRoot(trimmed)
  if (!root) {
    return {
      replies: [],
      failReason: `JSON 解析失败，片段：${clipSnippet(trimmed)}`,
    }
  }

  const allowed = new Set(allowedSpeakers)
  const replies: JbsDiscussNpcReply[] = []
  const rejectedSpeakers = new Set<string>()
  let emptyLineTurns = 0

  const beatsRaw = root.beats
  if (Array.isArray(beatsRaw)) {
    if (beatsRaw.length === 0) {
      return { replies: [], failReason: 'JSON 中 beats 数组为空。' }
    }
    for (const item of beatsRaw) {
      if (!item || typeof item !== 'object') continue
      pushBeat(item as Record<string, unknown>, allowed, replies, rejectedSpeakers, stats)
    }
    if (replies.length > 0) {
      return { replies: finalizeDiscussReplies(replies) }
    }
    return {
      replies: [],
      failReason: buildParseFailReason(
        allowedSpeakers,
        rejectedSpeakers,
        stats.empty + emptyLineTurns,
        'beats',
      ),
    }
  }

  const consumeTurn = (rec: Record<string, unknown>) => {
    const speaker = String(rec.speaker ?? '').trim()
    const action = String(rec.action ?? '').trim() || undefined
    const before = replies.length
    const linesRaw = rec.lines
    if (Array.isArray(linesRaw)) {
      for (let i = 0; i < linesRaw.length; i += 1) {
        const line = String(linesRaw[i] ?? '').trim()
        if (!line || !allowed.has(speaker)) continue
        replies.push(
          normalizeDiscussBeat(
            {
              speaker,
              line,
              action: i === 0 ? action : undefined,
            },
            replies.length,
          ),
        )
      }
    } else {
      pushBeat(rec, allowed, replies, rejectedSpeakers, stats)
    }
    if (speaker && replies.length === before) {
      if (!allowed.has(speaker)) rejectedSpeakers.add(speaker)
      else emptyLineTurns += 1
    }
  }

  const turnsRaw = root.turns ?? root.speakers
  if (Array.isArray(turnsRaw)) {
    if (turnsRaw.length === 0) {
      return { replies: [], failReason: 'JSON 中 turns 数组为空。' }
    }
    for (const item of turnsRaw) {
      if (!item || typeof item !== 'object') continue
      consumeTurn(item as Record<string, unknown>)
    }
    if (replies.length > 0) {
      return { replies: finalizeDiscussReplies(replies) }
    }
    return {
      replies: [],
      failReason: buildParseFailReason(allowedSpeakers, rejectedSpeakers, emptyLineTurns, 'turns'),
    }
  }

  const repliesRaw = root.replies
  if (!Array.isArray(repliesRaw)) {
    return {
      replies: [],
      failReason: 'JSON 缺少 beats / turns 字段，或格式不符合约定。',
    }
  }

  if (repliesRaw.length === 0) {
    return { replies: [], failReason: 'JSON 中 replies 数组为空。' }
  }

  for (const item of repliesRaw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    if (rec.line || rec.text) {
      pushBeat(rec, allowed, replies, rejectedSpeakers, stats)
    } else {
      consumeTurn(rec)
    }
  }

  if (replies.length > 0) {
    return { replies: finalizeDiscussReplies(replies) }
  }

  return {
    replies: [],
    failReason: buildParseFailReason(allowedSpeakers, rejectedSpeakers, emptyLineTurns, 'replies'),
  }
}

function buildParseFailReason(
  allowedSpeakers: string[],
  rejectedSpeakers: Set<string>,
  emptyEntries: number,
  field: 'beats' | 'turns' | 'replies',
): string {
  const parts: string[] = [`未能从 ${field} 解析出有效 NPC 台词。`]
  if (rejectedSpeakers.size > 0) {
    parts.push(
      `speaker 不在本桌 NPC（${allowedSpeakers.join('、')}）内：${[...rejectedSpeakers].join('、')}。`,
    )
  }
  if (emptyEntries > 0) {
    parts.push('部分条目 line 为空或全是空白。')
  }
  if (rejectedSpeakers.size === 0 && emptyEntries === 0) {
    parts.push('请确认输出为 beats 数组，每项含 speaker 与 line（可选 action）。')
  }
  return parts.join('')
}

const INTER_NPC_RULES = [
  '【穿插对白 · beat 级语义，UI 自动切气泡】',
  `- 必须用 **beats** 数组：按时间顺序排列；**条数不设上限**，讨论需要多长就输出多长（至少 ${DISCUSS_BEATS_MIN} 条）；每条 line 写完整自然口语。`,
  '- **穿插**：不同 NPC 宜交替出现，像「A → B → C → B」；NPC 互问互驳为主。',
  '- 客户端会把每条 line/action 按整句优先拆成聊天气泡；勿为凑条数写极短 beat。',
  '- **action 旁白（硬性）**：除最后 1 条 beat 外，每条 beat 必须含非空 action 字段；action 写第三人称神态/语气/小动作，UI 会以居中旁白宽条展示，再展示对白气泡。',
  '- action 与 line 必须分字段输出；不要写「旁白：」前缀，不要引号，不要重复 line 台词。',
  '- 玩家上一句只是引子；不要整轮都在回答玩家；不要替玩家角色发言。',
].join('\n')

const OUTPUT_EXAMPLE = JSON.stringify(
  {
    beats: [
      {
        speaker: '沈知意',
        action: '指尖在杯沿停了一瞬，语气仍温',
        line: '19:43 那次副卡失败，是谁在试门？',
      },
      { speaker: '陆景川', action: '抬眼，声音压得很低', line: '不是我。' },
      { speaker: '苏晚晴', action: '眉梢微挑，似笑非笑', line: '不是陆景川？真的假的？' },
      {
        speaker: '陆景川',
        action: '目光扫过程予安，仍压着火气',
        line: '我说了，真的不是我。',
      },
      { speaker: '程予安', action: '文件夹合上，声线平', line: '两次刷卡在我这，试门那张副卡不是我的主卡。' },
      { speaker: '沈知意', action: '文件夹边沿被指腹摩过，语气仍温', line: '那就把监控缺的那段和刷卡记录并在一起看。' },
      { speaker: '苏晚晴', action: '端杯未饮，语气淡', line: '可以并看，但别只追着离席的人问。' },
      {
        speaker: '程予安',
        action: '视线落向陆景川',
        line: '陆景川，证词写你 19:45 离席——你那边怎么对？',
      },
    ],
  },
  null,
  0,
)

function buildDiscussSystemPrompt(params: {
  scriptTitle: string
  round: PublicDiscussRound
  playerRoleName: string
  npcRoles: YuyePlayerRole[]
  publicClues: string[]
  openingContext?: string
}): string {
  const npcBriefs = buildNpcDirectorBriefs(params.npcRoles, params.round)
  const clueBlock =
    params.publicClues.length > 0
      ? params.publicClues.join('\n')
      : '（暂无已公开线索）'

  return [
    `你是剧本杀《${params.scriptTitle}》公开讨论环节的「NPC 导演」。`,
    `当前为${ROUND_RULES[params.round]}`,
    `玩家真人扮演：${params.playerRoleName}。另外三名 NPC 由你操控：${params.npcRoles.join('、')}。`,
    '',
    '【已公开线索】',
    clueBlock,
    '',
    '【各 NPC 角色边界】',
    npcBriefs,
    '',
    INTER_NPC_RULES,
    '',
    '【扮演规则】',
    '- 每名 NPC 均已知悉自己当幕【本幕任务】（见上方角色边界），发言时按任务推进，但 line 须口语化、不可照念条目。',
    `- beats 至少 ${DISCUSS_BEATS_MIN} 条，**不设上限**；三名 NPC 均可参与，按讨论自然延展。`,
    '- 每条 beat 一条 line；action 与 line 分字段；UI 先旁白后面再对白气泡。',
    '- 每个 NPC 保持人设与保密边界；不得剧透真凶、不得编造与已公开线索冲突的物证。',
    '- 阅读 transcript 判断施压程度；未反复集火前不宜明显露馅（见角色边界表演规则）。',
    '- 不要替玩家角色发言，不要输出 markdown。',
    params.openingContext?.trim()
      ? `\n【本轮开场白摘要】\n${params.openingContext.trim()}`
      : '',
    '',
    '【输出格式】仅输出 JSON：',
    OUTPUT_EXAMPLE,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildDiscussTranscript(
  messages: JBSChatMessage[],
  playerRoleName: string,
): string {
  const merged = mergeDiscussBubbleMessages(messages)
  const lines = merged
    .map((m) => formatDiscussTranscriptLine(m, playerRoleName))
    .filter((l): l is string => !!l)
  return lines.length > 0 ? lines.join('\n') : '（讨论尚未开始）'
}

export async function requestJbsDiscussNpcReplies(params: {
  apiConfig?: ApiConfig | null
  scriptTitle: string
  round: PublicDiscussRound
  playerRoleName: string
  messages: JBSChatMessage[]
  openingContext?: string
  collectedClueIds: string[]
  scriptId: string
}): Promise<JbsDiscussAiResult> {
  const cfg = params.apiConfig ?? (await loadResolvedApiConfig('chatCard'))
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    throw new JbsDiscussGenerationError(
      '未配置 AI API，请在「API 预设」中填写接口地址、Key 与聊天模型（chatCard）。',
    )
  }

  const npcRoles = getNpcRoster(params.playerRoleName)
  const transcript = buildDiscussTranscript(params.messages, params.playerRoleName)
  const publicClues = getPublicClueSummaries(params.scriptId, params.collectedClueIds)
  const pressureHints = buildDiscussPressureHints(
    params.messages,
    params.playerRoleName,
    npcRoles,
  )

  const system = buildDiscussSystemPrompt({
    scriptTitle: params.scriptTitle,
    round: params.round,
    playerRoleName: params.playerRoleName,
    npcRoles,
    publicClues,
    openingContext: params.openingContext,
  })

  const text = await openAiCompatibleChat(
    cfg,
    [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          `【讨论记录】\n${transcript}`,
          pressureHints,
          `请输出 beats：至少 ${DISCUSS_BEATS_MIN} 条穿插对白，**条数不设上限**；每条须含 action 旁白 + line 台词（最后 1 条可省略 action）；三名 NPC 交替接话、互问互驳。本桌 NPC：${npcRoles.join('、')}。`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
    { temperature: 0.78, response_format: 'json_object' },
  ).catch((err: unknown) => {
    const detail = err instanceof Error ? err.message : String(err)
    throw new JbsDiscussGenerationError(`模型请求异常：${detail}`)
  })

  const parsed = parseDiscussAiJson(text, npcRoles)
  if (parsed.replies.length === 0) {
    throw new JbsDiscussGenerationError(parsed.failReason ?? '未解析到有效 NPC 接话。')
  }
  return { replies: parsed.replies }
}

export async function loadJbsDiscussApiConfig(): Promise<ApiConfig | null> {
  return loadResolvedApiConfig('chatCard')
}
