import type { ApiConfig } from '../../api/types'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character, WeChatGomokuSessionPayload, WeChatMiniGameInvitePayload } from '../newFriendsPersona/types'
import { formatCharacterMemoriesForPromptInjection } from '../memory/formatCharacterMemoriesForPromptInjection'
import type { MemoryVectorRecallOpts } from '../memory/memoryVectorRecall'
import { buildCharacterCard, buildWorldBookTextForPrompt } from '../wechatChatAi'
import {
  clampGomokuDifficultyLevel,
  GOMOKU_DIFFICULTY_DEFAULT,
  type GomokuDifficultyLevel,
} from './games/gomokuDifficulty'
import type { GomokuReactionKey } from './gomokuSituation'

export type GomokuReactionBank = Partial<Record<GomokuReactionKey, string[]>>

export type GomokuSessionSetup = {
  bank: GomokuReactionBank
  difficulty: GomokuDifficultyLevel
  thinkDelayMinMs: number
  thinkDelayMaxMs: number
  gameStartLines: string[]
}

const LINES_PER_KEY = 5

/** 预生成库缺键时的兜底（旧局或未产出该键时仍能出对口反应） */
const GOMOKU_BUILTIN_FALLBACK_LINES: Partial<Record<GomokuReactionKey, string[]>> = {
  playerBlockFour: ['你把我四连堵了？', '……算你眼尖。', '哼，阻我干嘛。', '行，继续。', '别高兴太早。'],
  playerBlockWin: ['……差一点就五连了。', '你算得挺快啊。', '这步挡得真准。', '没完呢。', '再来。'],
}

export function buildDefaultGomokuSessionSetup(): GomokuSessionSetup {
  return {
    bank: {},
    difficulty: GOMOKU_DIFFICULTY_DEFAULT,
    thinkDelayMinMs: 2000,
    thinkDelayMaxMs: 8000,
    gameStartLines: [],
  }
}

const REMATCH_LINE_RE =
  /再来|下一盘|下一局|下盘|再玩|再战|上局|刚才那局|刚才那盘|上一把|再开一局|还要再来|要不要再来/i

/** 对局进行中不应出现的「约再战 / 评价上一局」类措辞 */
export function isGomokuPostGameOnlyLine(line: string): boolean {
  return REMATCH_LINE_RE.test(line.trim())
}

export function pickGomokuReaction(
  bank: GomokuReactionBank,
  key: GomokuReactionKey,
  opts?: { allowPostGameLines?: boolean },
): string | null {
  const allowPostGameLines =
    opts?.allowPostGameLines ?? (key === 'win' || key === 'lose' || key === 'draw')
  const pool = bank[key]?.filter(
    (line) => allowPostGameLines || !isGomokuPostGameOnlyLine(line),
  )
  if (!pool?.length) return null
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}

/** 同一局面优先抽未展示过的句，5 句轮换后再重复 */
export function pickGomokuReactionVariety(
  bank: GomokuReactionBank,
  key: GomokuReactionKey,
  usedLines: Set<string>,
  opts?: { allowPostGameLines?: boolean },
): string | null {
  const allowPostGameLines =
    opts?.allowPostGameLines ?? (key === 'win' || key === 'lose' || key === 'draw')
  let pool = bank[key]?.filter(
    (line) => allowPostGameLines || !isGomokuPostGameOnlyLine(line),
  )
  if (!pool?.length) {
    pool = GOMOKU_BUILTIN_FALLBACK_LINES[key]?.filter(
      (line) => allowPostGameLines || !isGomokuPostGameOnlyLine(line),
    )
  }
  if (!pool?.length) return null
  let candidates = pool.filter((line) => !usedLines.has(line))
  if (!candidates.length) {
    usedLines.clear()
    candidates = pool
  }
  const line = candidates[Math.floor(Math.random() * candidates.length)] ?? null
  if (line) usedLines.add(line)
  return line
}

export function pickGomokuGameStartLine(setup: GomokuSessionSetup): string | null {
  const lines = setup.gameStartLines
  if (!lines.length) return null
  const pool = lines.filter((line) => !isGomokuPostGameOnlyLine(line))
  const pickFrom = pool.length ? pool : lines
  return pickFrom[Math.floor(Math.random() * pickFrom.length)] ?? pickFrom[0] ?? null
}

/** @deprecated 思考场景请用 pickGomokuReaction(bank, 'thinking') 随机抽 1 条 */
export function pickGomokuThinkingLines(bank: GomokuReactionBank, _count = 1): string[] {
  const line = pickGomokuReaction(bank, 'thinking')
  return line ? [line] : []
}

export function pickGomokuGameStartLineVariety(
  setup: GomokuSessionSetup,
  usedLines: Set<string>,
): string | null {
  const lines = setup.gameStartLines.filter((line) => !isGomokuPostGameOnlyLine(line))
  const pickFrom = lines.length ? lines : setup.gameStartLines
  if (!pickFrom.length) return null
  let candidates = pickFrom.filter((line) => !usedLines.has(line))
  if (!candidates.length) {
    usedLines.clear()
    candidates = pickFrom
  }
  const line = candidates[Math.floor(Math.random() * candidates.length)] ?? null
  if (line) usedLines.add(line)
  return line
}

const PREGEN_KEYS: GomokuReactionKey[] = [
  'blockFour',
  'blockWin',
  'playerBlockFour',
  'playerBlockWin',
  'aiOpenFour',
  'aiOpenThree',
  'playerOpenFour',
  'playerMove',
  'brilliant',
  'routine',
  'thinking',
  'firstMove',
  'charFirstMove',
  'drawPlayerFirst',
  'drawCharFirst',
  'win',
  'lose',
  'draw',
]

const KEY_LABELS: Record<GomokuReactionKey, string> = {
  blockFour: '堵住玩家四连威胁',
  blockWin: '挡住玩家即将五连',
  playerBlockFour: '玩家堵住了角色的四连威胁',
  playerBlockWin: '玩家挡住了角色即将五连',
  aiOpenFour: '自己形成四连威胁',
  aiOpenThree: '自己形成三连',
  playerOpenFour: '玩家形成四连威胁',
  playerMove: '玩家普通落子后的即时反应',
  brilliant: '妙手/绝杀',
  routine: '普通落子',
  thinking: '落子前思考时的碎碎念（随机 1 句）',
  firstMove: '玩家先手时，棋盘上的第一颗子刚落下',
  charFirstMove: '角色先手时，角色刚落下第一颗子',
  drawPlayerFirst: '抽取先手结果揭晓：用户先手（此时尚未落任何棋子）',
  drawCharFirst: '抽取先手结果揭晓：角色先手（此时尚未落任何棋子）',
  win: '本局刚结束，角色获胜',
  lose: '本局刚结束，角色落败',
  draw: '本局刚结束，和棋',
}

export const GOMOKU_PREGEN_REACTION_KEYS_DOC = PREGEN_KEYS.join(', ')

const GOMOKU_PREGEN_WORLD_BOOK_MAX_CHARS = Number.MAX_SAFE_INTEGER

export async function loadGomokuChatContext(conversationKey: string, peerName: string): Promise<string> {
  const ck = conversationKey.trim()
  if (!ck) return ''
  try {
    const rows = await personaDb.listWeChatChatMessagesRecent({ conversationKey: ck, limit: 16 })
    return [...rows]
      .reverse()
      .map((m) => {
        const who = m.type === 'player' ? '我' : peerName || '对方'
        const body = String(m.content ?? '').trim().slice(0, 200)
        return body ? `${who}：${body}` : ''
      })
      .filter(Boolean)
      .join('\n')
  } catch {
    return ''
  }
}

export type GomokuPregenPromptContext = {
  chatContext: string
  worldBookText: string
  longTermMemoryText: string
  relevanceHay: string
}

export async function loadGomokuPregenPromptContext(params: {
  characterId: string
  character?: Character | null
  conversationKey?: string
  peerDisplayName?: string
  api: ApiConfig | null
  lineScope?: MemoryVectorRecallOpts['lineScope']
}): Promise<GomokuPregenPromptContext> {
  const cid = params.characterId.trim()
  const ck = params.conversationKey?.trim() ?? ''
  const peerName = params.peerDisplayName?.trim() || '对方'
  const character = params.character ?? (cid ? await personaDb.getCharacter(cid) : null)
  const chatContext = await loadGomokuChatContext(ck, peerName || character?.name || '对方')
  const worldBookText = character
    ? await buildWorldBookTextForPrompt(character, GOMOKU_PREGEN_WORLD_BOOK_MAX_CHARS)
    : ''
  const relevanceHay = [chatContext, worldBookText, character?.name, '五子棋', '小游戏'].filter(Boolean).join('\n')
  let longTermMemoryText = ''
  if (cid && relevanceHay.trim()) {
    try {
      longTermMemoryText = (
        await formatCharacterMemoriesForPromptInjection(cid, relevanceHay, {
          apiConfig:
            params.api?.apiUrl?.trim() && params.api?.apiKey?.trim() ? params.api : null,
          conversationKey: ck || null,
          lineScope: params.lineScope ?? null,
        })
      ).trim()
    } catch {
      longTermMemoryText = ''
    }
  }
  return { chatContext, worldBookText, longTermMemoryText, relevanceHay }
}

export function hasGomokuSessionReactionContent(setup: GomokuSessionSetup): boolean {
  if (setup.gameStartLines.length > 0) return true
  return PREGEN_KEYS.some((key) => (setup.bank[key]?.length ?? 0) > 0)
}

export async function ensureGomokuSessionOnInvitePayload(
  invite: WeChatMiniGameInvitePayload,
  opts: {
    api: ApiConfig | null
    characterId: string
    character?: Character | null
    conversationKey?: string
    peerDisplayName?: string
    lineScope?: MemoryVectorRecallOpts['lineScope']
  },
): Promise<WeChatMiniGameInvitePayload> {
  if (invite.gameType !== 'gomoku') return invite
  if (invite.gomokuSession) {
    const existing = gomokuSessionSetupFromPayload(invite.gomokuSession)
    if (hasGomokuSessionReactionContent(existing)) return invite
  }
  const cid = opts.characterId.trim()
  if (!cid) return invite
  const character = opts.character ?? (await personaDb.getCharacter(cid))
  const ctx = await loadGomokuPregenPromptContext({
    characterId: cid,
    character,
    conversationKey: opts.conversationKey,
    peerDisplayName: opts.peerDisplayName ?? character?.name,
    api: opts.api,
    lineScope: opts.lineScope,
  })
  const setup = await pregenerateGomokuSessionSetup({
    api: opts.api,
    character,
    chatContext: ctx.chatContext,
    worldBookText: ctx.worldBookText,
    longTermMemoryText: ctx.longTermMemoryText,
  })
  if (!hasGomokuSessionReactionContent(setup)) return invite
  return { ...invite, gomokuSession: gomokuSessionSetupToPayload(setup) }
}

export const GOMOKU_REACTION_SITUATION_RULES = `
【每条对白必须严格对应当前局面，禁止串台】
- gameStartLines：仅在棋盘刚打开、**双方都还没落任何一子**时使用；可轻松开场，**禁止**提及「上一局/刚才/再来一局/输赢结果/你的走法/这步棋」。
- firstMove：仅当**玩家先手**且第一颗子刚落下；可接「你先手」，**禁止**评价具体走法。
- charFirstMove：仅当**角色先手**且角色刚落下第一颗子；**禁止**说「你先手/轮到你下」。
- drawPlayerFirst：抽取先手动画结束、**用户拿到先手**时；此时尚未落子，可说「你先手/请吧」，**禁止**评价走法或提再战。
- drawCharFirst：抽取先手动画结束、**角色拿到先手**时；此时尚未落子，可说「我先来/我先手」，**禁止**说「轮到你下」。
- playerMove / playerOpenFour / playerBlockFour / playerBlockWin：仅当**玩家刚刚落完这一手**后立刻说；只能回应**这一手**，禁止「太 predictable/早猜到了」式上帝视角，禁止提再战。
- playerBlockFour：玩家刚堵住了**你的**活四/冲四；可表达意外、不服或重新评估，禁止说成是你堵玩家。
- playerBlockWin：玩家刚挡下了**你**的成五点；可表达惋惜、惊讶，禁止说成是你挡玩家。
- blockFour / blockWin / aiOpenFour / aiOpenThree / brilliant / routine：仅当**角色刚落完这一手**后说，描述当前棋盘，禁止提上一局。
- thinking：角色正在算当前这一步时使用；禁止提结果或再战。
- win / lose / draw：**只在整盘棋刚结束**时使用；此时才允许「下盘再来/下盘见」类收束。
- 近期私聊里若出现「再来一把/刚才那局」，**不得**写进 playerMove、thinking、gameStartLines；那些是上一段对话，不是棋盘上的事件。
`.trim()

function normalizeLines(raw: unknown, max = 40): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.replace(/^["「『]|["」』]$/g, '').trim().slice(0, max))
    .filter(Boolean)
    .slice(0, LINES_PER_KEY)
}

function clampThinkDelayMs(minSec: unknown, maxSec: unknown): { minMs: number; maxMs: number } {
  let min = typeof minSec === 'number' && Number.isFinite(minSec) ? minSec : 2
  let max = typeof maxSec === 'number' && Number.isFinite(maxSec) ? maxSec : 8
  min = Math.max(1, Math.min(10, min))
  max = Math.max(1, Math.min(10, max))
  if (min > max) [min, max] = [max, min]
  return { minMs: Math.round(min * 1000), maxMs: Math.round(max * 1000) }
}

/** 五子棋难度与对局台词的人设/上下文裁决说明（邀约接受与开局预生成共用） */
export const GOMOKU_DIFFICULTY_PERSONA_GUIDE = `
【五子棋 difficulty 与人设】
- difficulty 为 1～5 的整数，仅写在 JSON 内，禁止出现在任何可见对白。
- **默认取 3（正常对局）**：多数角色按正常实力下，不必刻意加难或放水。
- **可适当提高到 4～5**：人设或上下文表明角色是五子棋/棋类高手、脑子特别灵光、有这方面爱好或争胜心强，且**本局没有故意让用户的意图**。
- **可降到 1～2（放水）**：角色有意让用户赢或提供情绪价值时。放水不等于敷衍——也可能是「商务局」式陪玩：用户连输、急躁、丧气时，角色先安慰、鼓励再来一把，本局适度放水。
- 是否放水须结合**近期私聊**与关系判断；无明确信号时按人设正常下（一般 3），不要无故极端。

【放水时的台词原则（lose / win / gameStartLines 等）】
- 用户赢后（角色 lose 类台词）：**不要直接承认「我让着你 / 故意放水 / 商务局」**，除非人设本就口无遮拦、会直说——默认会伤用户自尊。
- 主打情绪价值：夸用户下得好、进步大、这盘思路清晰、终于抓住我的破绽等，让用户感到被尊重、被看见。
- 用户事后追问「是不是故意让我」：口语仍优先肯定用户实力，可轻描淡写带过，**不要戳破**「刚才就是放水」——除非人设规定必须诚实。
- 角色赢（win 类台词）：按人设正常反应；若本局在放水却仍赢了，语气也不要居高临下。
`.trim()

/**
 * 开局一次性：结合人设与近期聊天，生成各局面 5 句台词 + 本局难度 + 思考延迟区间。
 */
export async function pregenerateGomokuSessionSetup(params: {
  api: ApiConfig | null
  character: Character | null
  characterId?: string
  conversationKey?: string
  peerDisplayName?: string
  lineScope?: MemoryVectorRecallOpts['lineScope']
  chatContext?: string
  worldBookText?: string
  longTermMemoryText?: string
}): Promise<GomokuSessionSetup> {
  const fallback = buildDefaultGomokuSessionSetup()
  const { api, character } = params
  if (!api?.apiUrl?.trim() || !api.apiKey?.trim() || !api.modelId?.trim()) return fallback

  let chatContext = params.chatContext
  let worldBookText = params.worldBookText
  let longTermMemoryText = params.longTermMemoryText
  const cid = params.characterId?.trim() || character?.id?.trim() || ''
  if (cid && (chatContext === undefined || worldBookText === undefined || longTermMemoryText === undefined)) {
    const ctx = await loadGomokuPregenPromptContext({
      characterId: cid,
      character,
      conversationKey: params.conversationKey,
      peerDisplayName: params.peerDisplayName ?? character?.name,
      api,
      lineScope: params.lineScope,
    })
    chatContext = chatContext ?? ctx.chatContext
    worldBookText = worldBookText ?? ctx.worldBookText
    longTermMemoryText = longTermMemoryText ?? ctx.longTermMemoryText
  }

  const persona = buildCharacterCard(character, { bioMaxChars: 320 })
  const situationList = PREGEN_KEYS.map((k) => `- ${k}: ${KEY_LABELS[k]}`).join('\n')
  const contextBlock = chatContext?.trim()
    ? `【近期私聊上下文（判断关系、是否放水/加难、用户是否连输需情绪价值）】\n${chatContext.trim().slice(0, 2400)}`
    : '【近期私聊上下文】（无摘录，仅依据人设推断；默认正常难度 3）'
  const worldBookBlock = worldBookText?.trim()
    ? `【世界书设定（角色背景与世界观参考）】\n${worldBookText.trim()}`
    : ''
  const memoryBlock = longTermMemoryText?.trim()
    ? `【长期记忆（向量召回，与当前话题相关片段）】\n【向量召回·已发生硬规则】下列均为已发生历史；禁止复述事情经过，仅可回溯提起。\n${longTermMemoryText.trim().slice(0, 3200)}`
    : ''

  const system = [
    '你是微信聊天中的角色，将与用户下五子棋。请结合人设、世界书、长期记忆与近期聊天，一次性输出本局配置 JSON。',
    persona ? `【人设】\n${persona}` : '【人设】克制、偶尔毒舌的伴玩者。',
    worldBookBlock,
    memoryBlock,
    contextBlock,
    '【需生成的局面台词】每种局面写 5 句不同对白（8～24 字，口语化，符合人设与上下文）：',
    situationList,
    GOMOKU_REACTION_SITUATION_RULES,
  ]
    .filter(Boolean)
    .join('\n')

  const user = [
    '请输出一个 JSON 对象，字段如下：',
    '- difficulty: 整数 1～5',
    '- thinkDelayMinSec / thinkDelayMaxSec: 每步落子前思考秒数区间，1～10，min≤max',
    '- gameStartLines: 开局进入棋盘前角色反应，5 句不同对白',
    '- reactions: 对象，键为局面英文名，值为 5 句字符串数组',
    GOMOKU_DIFFICULTY_PERSONA_GUIDE,
    GOMOKU_REACTION_SITUATION_RULES,
    'difficulty 仅作为 JSON 数值字段，禁止在 gameStartLines、reactions 各句对白或任何可见文案里提及难度、等级、放水、全力、商务局等。',
    '只返回 JSON，不要 markdown，不要解释。',
  ].join('\n\n')

  try {
    const endpoint = api.apiUrl.trim().replace(/\/+$/, '')
    const url = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/v1/chat/completions`
    const res = await fetch(url, {
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
        temperature: 0.9,
        max_tokens: 2200,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) return fallback
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return fallback
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    return parseGomokuSessionSetupFromModelJson(parsed)
  } catch {
    return fallback
  }
}

/** 将模型 JSON（或邀约接受指令内嵌对象）解析为对局配置 */
export function parseGomokuSessionSetupFromModelJson(parsed: Record<string, unknown>): GomokuSessionSetup {
  const merged: GomokuReactionBank = {}
  const reactions =
    parsed.reactions && typeof parsed.reactions === 'object' && !Array.isArray(parsed.reactions)
      ? (parsed.reactions as Record<string, unknown>)
      : parsed
  for (const key of PREGEN_KEYS) {
    const lines = normalizeLines(reactions[key] ?? parsed[key])
    if (lines.length) merged[key] = lines
  }

  const gameStartLines = normalizeLines(parsed.gameStartLines, 48)
  const { minMs, maxMs } = clampThinkDelayMs(parsed.thinkDelayMinSec, parsed.thinkDelayMaxSec)

  return {
    bank: merged,
    difficulty: clampGomokuDifficultyLevel(parsed.difficulty),
    thinkDelayMinMs: minMs,
    thinkDelayMaxMs: maxMs,
    gameStartLines,
  }
}

export function gomokuSessionSetupToPayload(setup: GomokuSessionSetup): WeChatGomokuSessionPayload {
  const bank: Record<string, string[]> = {}
  for (const key of PREGEN_KEYS) {
    const lines = setup.bank[key]
    if (lines?.length) bank[key] = [...lines]
  }
  return {
    difficulty: setup.difficulty,
    thinkDelayMinMs: setup.thinkDelayMinMs,
    thinkDelayMaxMs: setup.thinkDelayMaxMs,
    gameStartLines: setup.gameStartLines.length ? [...setup.gameStartLines] : [],
    bank,
  }
}

export function gomokuSessionSetupFromPayload(payload: WeChatGomokuSessionPayload): GomokuSessionSetup {
  const defaults = buildDefaultGomokuSessionSetup()
  const bank: GomokuReactionBank = {}
  for (const key of PREGEN_KEYS) {
    const lines = normalizeLines(payload.bank?.[key])
    if (lines.length) bank[key] = lines
  }
  const gameStartLines = normalizeLines(payload.gameStartLines, 48)
  const minMs =
    typeof payload.thinkDelayMinMs === 'number' && Number.isFinite(payload.thinkDelayMinMs)
      ? Math.max(1000, Math.min(10000, Math.round(payload.thinkDelayMinMs)))
      : defaults.thinkDelayMinMs
  const maxMs =
    typeof payload.thinkDelayMaxMs === 'number' && Number.isFinite(payload.thinkDelayMaxMs)
      ? Math.max(1000, Math.min(10000, Math.round(payload.thinkDelayMaxMs)))
      : defaults.thinkDelayMaxMs
  return {
    bank,
    difficulty: clampGomokuDifficultyLevel(payload.difficulty),
    thinkDelayMinMs: Math.min(minMs, maxMs),
    thinkDelayMaxMs: Math.max(minMs, maxMs),
    gameStartLines,
  }
}

/** @deprecated 使用 {@link pregenerateGomokuSessionSetup} */
export async function pregenerateGomokuReactionBank(params: {
  api: ApiConfig | null
  character: Character | null
}): Promise<GomokuReactionBank> {
  const setup = await pregenerateGomokuSessionSetup(params)
  return setup.bank
}

/** 角色接受游戏邀约时的短回复 */
export const GAME_INVITE_ACCEPT_LINES = [
  '好啊，来！',
  '五子棋？放马过来。',
  '行，陪你下一盘。',
  '来吧，我不会手下留情。',
  '可以，现在开始？',
]

export function pickGameInviteAcceptLine(): string {
  const lines = GAME_INVITE_ACCEPT_LINES
  return lines[Math.floor(Math.random() * lines.length)] ?? '好啊，来！'
}
