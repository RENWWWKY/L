import type { ApiConfig } from '../api/types'
import type { Character, HeartWhisper, PlayerIdentity, ScheduleTable } from './newFriendsPersona/types'
import { openAiCompatibleChat, openAiCompatibleChatAny, type OpenAiCompatibleMessage } from './newFriendsPersona/ai'
import { LUMI_ASSISTANT_SYSTEM_PROMPT } from './lumiAssistantPrompt'
import { WECHAT_REPLY_OUTPUT_APPENDIX, WECHAT_THINKING_CHAIN_APPENDIX } from './wechatReplyOutputPrompt'
import { WECHAT_ROLEPLAY_SYSTEM_PROMPT } from './wechatChatPrompt'
import { buildStickerCatalogPromptBlock } from './stickers/stickerStore'
import { WECHAT_HEART_WHISPER_SYSTEM_PROMPT } from './wechatHeartWhisperPrompt'
import { logConsole } from './consoleLogger'
import { VOICE_CALL_SYSTEM_PROMPT } from './voiceCall/voiceCallSystemPrompt'
import { VOICE_CALL_DECISION_SYSTEM_PROMPT } from './voiceCall/callDecisionSystemPrompt'

export type WeChatChatPromptMode = 'lumi-assistant' | 'persona'
export type BusyRuntimeContext = {
  enabled: boolean
  isBusy: boolean
  remainingMinutes: number
  reason: string
  maxDuration: number
  customScenarios: string[]
  busyMessages: Array<{ id: string; content: string; timestamp: number }>
}

const WORLD_BOOK_MAX_CHARS = 6000
export const WECHAT_HISTORY_MAX_MESSAGES = 50

export type ChatTranscriptTurn = { id?: string; from: 'self' | 'other'; text: string }

/** 与微信私聊共用：按启用世界书拼成提示词文本；`maxChars` 用于约会页等需收紧总长度的场景。 */
export function buildWorldBookText(character: Character | null, maxChars: number = WORLD_BOOK_MAX_CHARS): string {
  if (!character) return ''
  const parts = character.worldBooks
    .filter((w) => w.enabled)
    .map((w) => {
      const lines = w.items
        .filter((it) => it.enabled && String(it.content || '').trim())
        .map(
          (it) =>
            `- [${it.priority === 'before' ? '聊天之前' : '聊天之后'}] ${it.name}：${String(it.content).trim()}`,
        )
        .join('\n')
      return lines ? `《${w.name}》\n${lines}` : ''
    })
    .filter(Boolean)
  const raw = parts.join('\n\n')
  const cap = Math.max(200, maxChars)
  if (raw.length <= cap) return raw
  return `${raw.slice(0, cap)}\n\n（以下世界书内容因长度已截断…）`
}

export function buildCharacterCard(character: Character | null): string {
  if (!character) return ''
  const c = character
  const bits = [
    `姓名/常用称呼：${c.name || '未命名'}`,
    `性别：${c.gender || '未知'}`,
    typeof c.age === 'number' ? `年龄：${c.age}` : '',
    c.birthdayMD ? `生日：${c.birthdayMD}` : '',
    c.zodiac ? `星座：${c.zodiac}` : '',
    c.identity ? `身份：${c.identity}` : '',
    c.mbti ? `MBTI：${c.mbti}` : '',
    c.wechatNickname ? `微信昵称：${c.wechatNickname}` : '',
    c.wechatSignature ? `微信签名：${c.wechatSignature}` : '',
    c.wechatRegion ? `微信地区：${c.wechatRegion}` : '',
  ].filter(Boolean)
  return bits.join('\n')
}

function buildPlayerIdentitySection(playerIdentity: PlayerIdentity | null): string {
  if (!playerIdentity) return ''
  const card = buildCharacterCard(playerIdentity)
  const wb = buildWorldBookText(playerIdentity)
  let s = `\n\n---\n【玩家身份档案】\n${card}\n`
  if (wb.trim()) s += `\n---\n【玩家身份世界书】\n${wb}\n`
  return s
}

function buildLongTermMemorySection(notes?: string): string {
  const body = notes?.trim() || '（暂无长期记忆模块入库数据，仅根据最近对话与人设推断。）'
  return `\n\n---\n【长期记忆】\n${body}\n`
}

function buildScheduleSection(params: { playerIdentity: ScheduleTable | null; character: ScheduleTable | null }): string {
  const chunks: string[] = []
  if (params.playerIdentity) {
    chunks.push(`【用户的日程安排】\n${safeScheduleJson(params.playerIdentity)}`)
  }
  if (params.character) {
    chunks.push(`【角色的日程安排】\n${safeScheduleJson(params.character)}`)
  }
  if (!chunks.length) return ''
  return `\n\n---\n${chunks.join('\n\n')}\n`
}

function safeScheduleJson(s: ScheduleTable): string {
  try {
    return JSON.stringify(s, null, 2)
  } catch {
    return '{"error":"schedule_stringify_failed"}'
  }
}

export function buildSystemContent(params: {
  character: Character | null
  playerIdentity: PlayerIdentity | null
  playerDisplayName: string
  promptMode: WeChatChatPromptMode
  longTermMemoryNotes?: string
  /** 角色关联的世界背景（优先于通用扮演，次于世界书条目） */
  worldBackgroundPrompt?: string
  /** 约会页最近若干条线下剧情正文（与微信同一角色时间线）；由调用方拉取 */
  offlineDatingPlotsContext?: string
  /** 当前轮次的回复偏向（仅本轮生效） */
  replyBias?: string
}): string {
  const player = params.playerDisplayName.trim() || '朋友'
  const peerLine = `\n\n---\n【会话对方】对方的微信资料名或备注可能显示为：${player}。请用自然称呼，不要机械重复全名除非语境需要。\n`
  const mem = buildLongTermMemorySection(params.longTermMemoryNotes)
  const offlinePlots = params.offlineDatingPlotsContext?.trim()
    ? `\n\n---\n${params.offlineDatingPlotsContext.trim()}\n`
    : ''
  const replyBias = params.replyBias?.trim() ? `\n\n---\n【本轮回复偏向（最高优先级）】\n${params.replyBias.trim()}\n` : ''
  const schedule = buildScheduleSection({
    playerIdentity: (params.playerIdentity?.schedule as ScheduleTable | undefined) ?? null,
    character: (params.character?.schedule as ScheduleTable | undefined) ?? null,
  })
  const pi = buildPlayerIdentitySection(params.playerIdentity)

  if (params.promptMode === 'lumi-assistant') {
    return `${LUMI_ASSISTANT_SYSTEM_PROMPT}${mem}${offlinePlots}${replyBias}${schedule}${pi}${peerLine}`
  }

  const wb = buildWorldBookText(params.character)
  const card = buildCharacterCard(params.character)
  const wbg = params.worldBackgroundPrompt?.trim()
  let extra = ''
  if (params.character) {
    extra += `\n\n---\n【角色档案摘要】\n${card}\n`
    if (wbg) {
      extra += `\n---\n【世界背景（优先于通用扮演铁则；若与下方世界书冲突，以世界书为准）】\n${wbg}\n`
    }
    if (wb.trim()) {
      extra += `\n---\n【世界书条目（最高优先级设定；条目间若有冲突以最新或标注为准）】\n${wb}\n`
    }
  } else {
    extra += `\n\n---\n【当前状态】未绑定完整人设档案（无世界书）。请以友善、有分寸的微信好友身份交谈，仍须遵守上述通用铁则，且绝不暴露非人类身份。\n`
  }

  return `${WECHAT_ROLEPLAY_SYSTEM_PROMPT}${mem}${offlinePlots}${replyBias}${schedule}${pi}${extra}${peerLine}`
}

function transcriptToMessages(turns: ChatTranscriptTurn[]): OpenAiCompatibleMessage[] {
  const tail = turns.slice(-WECHAT_HISTORY_MAX_MESSAGES)
  const out: OpenAiCompatibleMessage[] = []
  for (const t of tail) {
    const content = String(t.text || '').trim()
    if (!content) continue
    const idPrefix = t.id?.trim() ? `[消息ID:${t.id.trim()}] ` : ''
    out.push({
      role: t.from === 'self' ? 'user' : 'assistant',
      content: `${idPrefix}${content}`,
    })
  }
  return out
}

/** 去掉模型偶发的 markdown 代码围栏 */
function stripAssistantFence(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function stripMessageIdMeta(line: string): string {
  return line
    .replace(/^\s*(?:\[消息ID[:：][^\]]+\]|【消息ID[:：][^】]+】)\s*/g, '')
    .trim()
}

function splitSingleLineWechatBubble(line: string): string[] {
  const src = line.trim()
  if (!src) return []
  // 短句不拆，避免过度切分。
  if (src.length <= 26) return [src]

  const parts = src
    .split(/(?<=[。！？；!?]|……)\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length <= 1) return [src]

  const out: string[] = []
  let acc = ''
  for (const p of parts) {
    const next = acc ? `${acc}${p}` : p
    if (next.length <= 24) {
      acc = next
      continue
    }
    if (acc) out.push(acc)
    acc = p
  }
  if (acc) out.push(acc)
  return out.length ? out : [src]
}

function logWeChatAiReplyDebug(tag: string, raw: string, bubbles: string[]) {
  const compactRaw = String(raw ?? '')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
  const previewRaw = compactRaw.length > 1200 ? `${compactRaw.slice(0, 1200)}...<truncated>` : compactRaw
  const lines = bubbles.map((b, i) => `${i + 1}. ${b}`).join(' | ')
  logConsole('ai', `[${tag}] 原始输出(raw): ${previewRaw || '<empty>'}`)
  logConsole('ai', `[${tag}] 解析气泡(count=${bubbles.length}): ${lines || '<empty>'}`)
}

function extractThinkingBlock(raw: string): { visible: string; thinking?: string } {
  const src = String(raw ?? '')
  // 兼容常见写法：<thinking>、<think>、```thinking fenced block
  const tagMatch = src.match(/<(thinking|think)\b[^>]*>([\s\S]*?)<\/\1>/i)
  if (tagMatch) {
    const thinking = String(tagMatch[2] ?? '').trim()
    const visible = src.replace(tagMatch[0], '').trim()
    return { visible, thinking: thinking || undefined }
  }
  const fencedMatch = src.match(/```(?:thinking|think|analysis)\s*([\s\S]*?)```/i)
  if (fencedMatch) {
    const thinking = String(fencedMatch[1] ?? '').trim()
    const visible = src.replace(fencedMatch[0], '').trim()
    return { visible, thinking: thinking || undefined }
  }
  return { visible: src }
}

export type WeChatPeerReplyResult = {
  bubbles: string[]
  thinking?: string
}

const FORCE_VISIBLE_THINKING_APPENDIX = `
【强制可见思维链（兼容前端折叠展示）】
- 你必须把思维过程直接输出在正文里，并使用如下标签严格包裹：
<thinking>
...你的思维过程...
</thinking>
- 然后再输出最终给用户可见的聊天正文。
- 不要省略 thinking 标签，不要改写标签名称，不要用其他格式替代。
`.trim()

/**
 * 微信对方回复：**仅**按模型原文换行拆成多条气泡；不解析 JSON、不按句号/字数强拆。
 * 若模型整段无换行，则只有一条气泡——须靠提示词让模型多行输出。
 */
export function parseWeChatPeerPlainReply(raw: string): string[] {
  return parseWeChatPeerReplyWithThinking(raw).bubbles
}

export function parseWeChatPeerReplyWithThinking(raw: string): WeChatPeerReplyResult {
  const t0 = stripAssistantFence(raw)
  if (!t0) return { bubbles: [] }
  const { visible, thinking } = extractThinkingBlock(t0)
  const t = visible.trim()
  if (!t) return { bubbles: [], thinking }
  const lines = t
    .split(/\r?\n/)
    .map((s) => stripMessageIdMeta(s))
    .filter((s) => s.length > 0)
  const bubbles = lines.length !== 1 ? lines : splitSingleLineWechatBubble(lines[0]!)
  return { bubbles, thinking }
}

/** @deprecated 请使用 `parseWeChatPeerPlainReply` */
export const parsePersonaWeChatPlainReply = parseWeChatPeerPlainReply

/**
 * 根据当前聊天记录请求对方回复，解析为多条气泡（纯文本换行；与模型输出一致）。
 */
export async function requestWeChatPeerReplyBubbles(params: {
  apiConfig: ApiConfig | null
  character: Character | null
  playerIdentity: PlayerIdentity | null
  playerDisplayName: string
  transcript: ChatTranscriptTurn[]
  promptMode: WeChatChatPromptMode
  longTermMemoryNotes?: string
  worldBackgroundPrompt?: string
  offlineDatingPlotsContext?: string
  replyBias?: string
  busyContext?: BusyRuntimeContext
  includeThinkingChain?: boolean
}): Promise<WeChatPeerReplyResult> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    throw new Error('未配置 AI API')
  }

  const base = buildSystemContent({
    character: params.character,
    playerIdentity: params.playerIdentity,
    playerDisplayName: params.playerDisplayName,
    promptMode: params.promptMode,
    longTermMemoryNotes: params.longTermMemoryNotes,
    worldBackgroundPrompt: params.worldBackgroundPrompt,
    offlineDatingPlotsContext: params.offlineDatingPlotsContext,
    replyBias: params.replyBias,
  })
  const isLumi = params.promptMode === 'lumi-assistant'
  const busyPrefix = params.busyContext
    ? `【角色忙碌模式规则】
你现在拥有自主进入忙碌状态的能力，请严格遵守：
- 当「角色是否忙碌：是」时，只能输出一行：[BUSY]{"reason":"你正在忙的事情","duration":预计分钟数}
- 当「角色是否忙碌：否」时，可依据触发概率/场景/日程决定是否进入忙碌；若决定忙碌，也只能输出上面的 BUSY 格式
- 严禁用普通聊天句子表达忙碌（如“等我五分钟”“我先忙一下”）；这类意图必须改为 BUSY 指令输出
- 当「忙碌期间用户发送的消息」不为空时，请正常生成一条统一回复并说明刚忙完（此时不要再输出 BUSY）
- 忙碌期间不要回复用户正常内容
- duration 必须是 1~最大忙碌时长 的整数分钟

【当前状态】
角色是否忙碌：${params.busyContext.isBusy ? '是' : '否'}
是否剩余忙碌时间：${Math.max(0, Math.round(params.busyContext.remainingMinutes))} 分钟
忙碌原因：${params.busyContext.reason || '无'}
最大忙碌时长：${params.busyContext.maxDuration} 分钟
自定义忙碌场景：${params.busyContext.customScenarios.join('、') || '无'}
忙碌期间用户发送的消息：${JSON.stringify(params.busyContext.busyMessages)}`
    : ''
  const stickerCat = buildStickerCatalogPromptBlock()
  const system = `${busyPrefix ? `${busyPrefix}\n\n` : ''}${base}\n\n${WECHAT_REPLY_OUTPUT_APPENDIX}${
    params.includeThinkingChain ? `\n\n${WECHAT_THINKING_CHAIN_APPENDIX}` : ''
  }\n\n${stickerCat}`

  const history = transcriptToMessages(params.transcript)
  const messages: OpenAiCompatibleMessage[] = [{ role: 'system', content: system }, ...history]

  let text = await openAiCompatibleChat(cfg, messages, {
    temperature: isLumi ? 0.62 : 0.82,
    max_tokens: isLumi ? 1200 : 2048,
  })
  let parsed = parseWeChatPeerReplyWithThinking(text)
  // 某些“thinking 模型/代理”会隐藏推理字段，不放在可见 content；开启开关时做一次强制可见重试。
  if (params.includeThinkingChain && !params.busyContext?.isBusy && !parsed.thinking) {
    const retryMessages: OpenAiCompatibleMessage[] = [
      { role: 'system', content: `${system}\n\n${FORCE_VISIBLE_THINKING_APPENDIX}` },
      ...history,
    ]
    text = await openAiCompatibleChat(cfg, retryMessages, {
      temperature: isLumi ? 0.62 : 0.82,
      max_tokens: isLumi ? 1400 : 2600,
    })
    parsed = parseWeChatPeerReplyWithThinking(text)
  }
  const bubbles = parsed.bubbles
  logWeChatAiReplyDebug('text', text, bubbles)
  return { bubbles: bubbles.length ? bubbles : ['收到。'], thinking: parsed.thinking }
}

/**
 * 语音通话：获取一段“口语化”回复文本（不走聊天输出协议）。
 * 注意：语音通话允许括号环境音；详见 VOICE_CALL_SYSTEM_PROMPT 的优先级声明。
 */
export async function requestWeChatVoiceCallReplyText(params: {
  apiConfig: ApiConfig | null
  character: Character | null
  playerIdentity: PlayerIdentity | null
  playerDisplayName: string
  transcript: ChatTranscriptTurn[]
  promptMode: WeChatChatPromptMode
  longTermMemoryNotes?: string
  worldBackgroundPrompt?: string
  offlineDatingPlotsContext?: string
}): Promise<string> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    throw new Error('未配置 AI API')
  }
  const base = buildSystemContent({
    character: params.character,
    playerIdentity: params.playerIdentity,
    playerDisplayName: params.playerDisplayName,
    promptMode: params.promptMode,
    longTermMemoryNotes: params.longTermMemoryNotes,
    worldBackgroundPrompt: params.worldBackgroundPrompt,
    offlineDatingPlotsContext: params.offlineDatingPlotsContext,
  })
  const system = `${base}\n\n---\n【语音通话场景规则】\n${VOICE_CALL_SYSTEM_PROMPT}\n`
  const history = transcriptToMessages(params.transcript)
  const messages: OpenAiCompatibleMessage[] = [{ role: 'system', content: system }, ...history]
  const text = await openAiCompatibleChat(cfg, messages, {
    temperature: params.promptMode === 'lumi-assistant' ? 0.55 : 0.78,
    max_tokens: 800,
  })
  const cleaned = stripAssistantFence(text)
  return cleaned.trim() || '…'
}

export type VoiceCallDecision = {
  decision: 'ACCEPT' | 'REJECT' | 'NO_ANSWER'
  internal_thought?: string
  opening?: string
}

function safeParseDecisionJson(raw: string): VoiceCallDecision | null {
  const s = stripAssistantFence(String(raw ?? '')).trim()
  if (!s) return null
  try {
    const obj = JSON.parse(s) as unknown
    if (!obj || typeof obj !== 'object') return null
    const rec = obj as Record<string, unknown>
    const decision = rec.decision
    if (decision !== 'ACCEPT' && decision !== 'REJECT' && decision !== 'NO_ANSWER') return null
    const internal_thought = typeof rec.internal_thought === 'string' ? rec.internal_thought : undefined
    const opening = typeof rec.opening === 'string' ? String(rec.opening).trim().slice(0, 120) : undefined
    return { decision, internal_thought, opening }
  } catch {
    return null
  }
}

/** 呼叫决策：返回 ACCEPT/REJECT/NO_ANSWER 的 JSON 结果。 */
export async function requestWeChatVoiceCallDecision(params: {
  apiConfig: ApiConfig | null
  character: Character | null
  playerIdentity: PlayerIdentity | null
  playerDisplayName: string
  transcript: ChatTranscriptTurn[]
  promptMode: WeChatChatPromptMode
  longTermMemoryNotes?: string
  worldBackgroundPrompt?: string
  offlineDatingPlotsContext?: string
}): Promise<VoiceCallDecision> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    return { decision: 'NO_ANSWER', internal_thought: '未配置 API' }
  }
  const base = buildSystemContent({
    character: params.character,
    playerIdentity: params.playerIdentity,
    playerDisplayName: params.playerDisplayName,
    promptMode: params.promptMode,
    longTermMemoryNotes: params.longTermMemoryNotes,
    worldBackgroundPrompt: params.worldBackgroundPrompt,
    offlineDatingPlotsContext: params.offlineDatingPlotsContext,
  })
  const system = `${base}\n\n---\n【呼叫接听决策】\n${VOICE_CALL_DECISION_SYSTEM_PROMPT}\n`
  const history = transcriptToMessages(params.transcript)
  const messages: OpenAiCompatibleMessage[] = [{ role: 'system', content: system }, ...history]
  const text = await openAiCompatibleChat(cfg, messages, {
    temperature: 0.4,
    max_tokens: 280,
  })
  const parsed = safeParseDecisionJson(text)
  if (parsed) return parsed
  // 容错：无法解析时按未应答处理，避免误触进入通话
  return { decision: 'NO_ANSWER', internal_thought: '解析失败' }
}

const WECHAT_IMAGE_REPLY_APPENDIX = `
现在我发送了一张图片，请你以[角色姓名]的身份，结合我们之前的对话和记忆，对这张图片做出自然的反应。
不要像机器人一样客观描述图片，要像真人聊天一样表达你的感受、疑问或评论。
硬性要求（必须遵守）：
- 你必须基于图片内容说出至少 2 个「具体可核对」的细节（例如：人物/物体、环境、文字、颜色、动作、构图等）。禁止只说“看到了/收到啦/不错哦”这种空话。
- 你必须给出 1 句带情绪/立场的反应（喜欢、惊讶、担心、好奇、吐槽都可以，但要贴合场景）。
- 你必须提出至少 1 个自然的追问或下一步建议，让对话继续。
- 如果你实际上没有收到图片内容、无法看图或看不清：必须直接说明“我没看到图/看不清”，并引导我用文字描述或重发；严禁假装看到了。
- 回复请用**换行分隔**：每一行一条微信气泡（与日常聊天相同），不要整段挤在一行。
例如（仅示例禁止照搬，照搬罚款十亿美元）：
- 美食照片："哇看起来好好吃！你在哪里吃的呀？"
- 自拍："今天这件衣服很适合你，很好看"
- 风景照："这个地方好美，是你今天去的吗？"
- 宠物照："好可爱的小猫！它叫什么名字？"
`.trim()

const WECHAT_STICKER_IMAGE_REPLY_APPENDIX = `
用户发来的是一张**表情包**（聊天小图），用来更形象地表达当下心情或态度，**没有**其它隐含任务或深层谜语。
请你以[角色姓名]的身份自然接话，像微信真人一样回应这份心情。
硬性要求（必须遵守）：
- **不要**像评图一样逐像素长描，**不要**罗列大量琐碎视觉细节，**不要**写长段「解读表情包含义」；把它当成对方的心情标点即可。
- 用 **1～2 句**口语接住心情（可带 **1 个**轻追问），把对话推进下去即可。
- 若你能从画面里轻点 **1 个**不夸张的细节来承接（可选），不要超过 **1 句**、不要堆砌。
- 若实际上没有收到图片、无法看图或看不清：必须直接说明「没看清/没收到」，引导对方用文字说一句；严禁假装看懂了细节。
- 回复请用**换行分隔**：每一行一条微信气泡，不要整段挤在一行。
`.trim()

/**
 * 图片消息：优先尝试走多模态（vision）格式；若模型/接口不支持，则仍走文本调用让模型自己说明“看不见图片”。
 */
export async function requestWeChatPeerReplyBubblesWithImage(params: {
  apiConfig: ApiConfig | null
  character: Character | null
  playerIdentity: PlayerIdentity | null
  playerDisplayName: string
  transcript: ChatTranscriptTurn[]
  promptMode: WeChatChatPromptMode
  imageBase64: string
  imageMime: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  /** 用户侧为表情包消息时走较短接话协议，避免过度评图 */
  userImageIsSticker?: boolean
  longTermMemoryNotes?: string
  worldBackgroundPrompt?: string
  offlineDatingPlotsContext?: string
  replyBias?: string
  busyContext?: BusyRuntimeContext
  includeThinkingChain?: boolean
}): Promise<WeChatPeerReplyResult> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    throw new Error('未配置 AI API')
  }
  const base = buildSystemContent({
    character: params.character,
    playerIdentity: params.playerIdentity,
    playerDisplayName: params.playerDisplayName,
    promptMode: params.promptMode,
    longTermMemoryNotes: params.longTermMemoryNotes,
    worldBackgroundPrompt: params.worldBackgroundPrompt,
    offlineDatingPlotsContext: params.offlineDatingPlotsContext,
    replyBias: params.replyBias,
  })
  const isLumi = params.promptMode === 'lumi-assistant'
  const roleName = params.character?.name?.trim() || (isLumi ? 'Lumi' : '对方')
  const imgRules = (params.userImageIsSticker ? WECHAT_STICKER_IMAGE_REPLY_APPENDIX : WECHAT_IMAGE_REPLY_APPENDIX).replace(
    /\[角色姓名\]/g,
    roleName,
  )
  const busyPrefix = params.busyContext
    ? `【角色忙碌模式规则】
- 忙碌时只能输出：[BUSY]{"reason":"你正在忙的事情","duration":预计分钟数}
- 不要输出“等我五分钟”这类普通句子来表示忙碌
- 当系统给出忙碌期间消息时，生成统一回复，不要 BUSY 指令

【当前状态】
角色是否忙碌：${params.busyContext.isBusy ? '是' : '否'}
是否剩余忙碌时间：${Math.max(0, Math.round(params.busyContext.remainingMinutes))} 分钟
忙碌原因：${params.busyContext.reason || '无'}
最大忙碌时长：${params.busyContext.maxDuration} 分钟
自定义忙碌场景：${params.busyContext.customScenarios.join('、') || '无'}
忙碌期间用户发送的消息：${JSON.stringify(params.busyContext.busyMessages)}`
    : ''
  const stickerCat = buildStickerCatalogPromptBlock()
  const system = `${busyPrefix ? `${busyPrefix}\n\n` : ''}${base}\n\n---\n【图片消息附加要求】\n${imgRules}\n\n${WECHAT_REPLY_OUTPUT_APPENDIX}${
    params.includeThinkingChain ? `\n\n${WECHAT_THINKING_CHAIN_APPENDIX}` : ''
  }\n\n${stickerCat}`

  const history = transcriptToMessages(params.transcript)

  // vision user message: text + dataURL image
  const dataUrl = `data:${params.imageMime};base64,${params.imageBase64}`
  const visionUserText = params.userImageIsSticker ? '（我发来了一张表情包）' : '（我发来了一张图片）'
  logConsole(
    'ai',
    `图片多模态请求：apiUrl=${cfg.apiUrl} modelId=${cfg.modelId} mime=${params.imageMime} b64Len=${params.imageBase64.length}`,
  )
  const visionMessages: unknown[] = [
    { role: 'system', content: system },
    ...history,
    {
      role: 'user',
      content: [
        { type: 'text', text: visionUserText },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ]

  try {
    const text = await openAiCompatibleChatAny(cfg, visionMessages, {
      temperature: isLumi ? 0.62 : 0.82,
      max_tokens: isLumi ? 1200 : 2048,
    })
    const p0 = parseWeChatPeerReplyWithThinking(text)
    const b0 = p0.bubbles
    logWeChatAiReplyDebug('vision-main', text, b0)
    return { bubbles: b0.length ? b0 : ['收到。'], thinking: p0.thinking }
  } catch {
    logConsole(
      'ai',
      `图片多模态调用失败：apiUrl=${cfg.apiUrl} modelId=${cfg.modelId}（将尝试兼容变体与回退）`,
    )
    // 兼容少数“伪 OpenAI”实现：对 image_url 字段或 content parts 结构要求不同。
    // 在彻底回退到纯文本前，尝试两种常见变体，尽量让用户在同一套 API 下也能看图回复。
    const tryAlt = async (messages: unknown[]) => {
      const text = await openAiCompatibleChatAny(cfg, messages, {
        temperature: isLumi ? 0.62 : 0.82,
        max_tokens: isLumi ? 1200 : 2048,
      })
      const p1 = parseWeChatPeerReplyWithThinking(text)
      const b1 = p1.bubbles
      logWeChatAiReplyDebug('vision-alt', text, b1)
      return { bubbles: b1.length ? b1 : ['收到。'], thinking: p1.thinking }
    }
    try {
      // 变体 1：image_url 直接为字符串
      const alt1: unknown[] = [
        { role: 'system', content: system },
        ...history,
        {
          role: 'user',
          content: [
            { type: 'text', text: visionUserText },
            { type: 'image_url', image_url: dataUrl },
          ],
        },
      ]
      return await tryAlt(alt1)
    } catch {
      logConsole('ai', '图片多模态调用失败：兼容变体1也失败')
      // ignore and continue
    }
    try {
      // 变体 2：部分实现使用 url 字段而非 image_url 包裹
      const alt2: unknown[] = [
        { role: 'system', content: system },
        ...history,
        {
          role: 'user',
          content: [
            { type: 'text', text: visionUserText },
            { type: 'image_url', url: dataUrl },
          ],
        },
      ]
      return await tryAlt(alt2)
    } catch {
      logConsole('ai', '图片多模态调用失败：兼容变体2也失败，进入纯文本回退')
      // ignore and fallback
    }

    // 回退：仍交给模型输出“看不见图片”，不做本地兜底文案
    const fallbackMessages: OpenAiCompatibleMessage[] = [
      { role: 'system', content: system },
      ...history,
      {
        role: 'user',
        content:
          '我刚发了一张图片，但你的当前模型/接口可能不支持看图。请你用自然的微信聊天语气说明你看不见图片，并引导我用文字描述或换一种方式发给你。',
      },
    ]
    const text = await openAiCompatibleChat(cfg, fallbackMessages, {
      temperature: isLumi ? 0.62 : 0.82,
      max_tokens: isLumi ? 900 : 768,
    })
    const p2 = parseWeChatPeerReplyWithThinking(text.trim() ? text : '收到。')
    const b2 = p2.bubbles
    logWeChatAiReplyDebug('vision-fallback-text', text, b2)
    return { bubbles: b2.length ? b2 : [text.trim() || '收到。'], thinking: p2.thinking }
  }
}

/**
 * 根据当前聊天记录请求对方（助手）的单条文本回复（兼容旧逻辑）。
 */
export async function requestWeChatPeerReply(params: {
  apiConfig: ApiConfig | null
  character: Character | null
  playerIdentity?: PlayerIdentity | null
  playerDisplayName: string
  transcript: ChatTranscriptTurn[]
  longTermMemoryNotes?: string
  worldBackgroundPrompt?: string
  offlineDatingPlotsContext?: string
  /** 默认 `persona`；与微信里 Lumi 未绑人设时使用 `lumi-assistant`。 */
  promptMode?: WeChatChatPromptMode
}): Promise<string> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    throw new Error('未配置 AI API')
  }

  const promptMode = params.promptMode ?? 'persona'
  const system = buildSystemContent({
    character: params.character,
    playerIdentity: params.playerIdentity ?? null,
    playerDisplayName: params.playerDisplayName,
    promptMode,
    longTermMemoryNotes: params.longTermMemoryNotes,
    worldBackgroundPrompt: params.worldBackgroundPrompt,
    offlineDatingPlotsContext: params.offlineDatingPlotsContext,
  })
  const history = transcriptToMessages(params.transcript)
  const messages: OpenAiCompatibleMessage[] = [{ role: 'system', content: system }, ...history]

  const isLumi = promptMode === 'lumi-assistant'
  const text = await openAiCompatibleChat(cfg, messages, {
    temperature: isLumi ? 0.62 : 0.78,
    max_tokens: isLumi ? 900 : 768,
  })
  const cleaned = text.replace(/^\s*【[^】]+】\s*/g, '').trim()
  return cleaned || text.trim()
}

function parseHeartWhisperJson(text: string): Omit<HeartWhisper, 'timestamp'> {
  const raw = stripAssistantFence(text)
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  const jsonText = start >= 0 && end > start ? raw.slice(start, end + 1) : raw
  const j = JSON.parse(jsonText) as {
    location?: unknown
    action?: unknown
    outfit?: unknown
    inner_thoughts?: unknown
    view_on_user?: unknown
  }
  const txt = (v: unknown) => String(v ?? '').trim()
  return {
    location: txt(j.location),
    action: txt(j.action),
    outfit: txt(j.outfit),
    innerThoughts: txt(j.inner_thoughts),
    userImpression: txt(j.view_on_user),
  }
}

function formatHeartWhisperTimestamp(ts: number): string {
  const d = new Date(ts)
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function resolveUserPronoun(playerIdentity: PlayerIdentity | null): '他' | '她' {
  return playerIdentity?.gender === 'female' ? '她' : '他'
}

function normalizeUserImpressionPronoun(text: string, pronoun: '他' | '她'): string {
  const src = String(text ?? '').trim()
  if (!src) return ''
  return src.replace(/ta/gi, pronoun).replace(/ＴＡ/gi, pronoun)
}

export async function requestWeChatHeartWhisper(params: {
  apiConfig: ApiConfig | null
  character: Character | null
  playerIdentity: PlayerIdentity | null
  playerDisplayName: string
  transcript: ChatTranscriptTurn[]
  promptMode: WeChatChatPromptMode
  nowMs?: number
  longTermMemoryNotes?: string
  worldBackgroundPrompt?: string
  offlineDatingPlotsContext?: string
}): Promise<HeartWhisper> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    throw new Error('未配置 AI API')
  }
  const base = buildSystemContent({
    character: params.character,
    playerIdentity: params.playerIdentity,
    playerDisplayName: params.playerDisplayName,
    promptMode: params.promptMode,
    longTermMemoryNotes: params.longTermMemoryNotes,
    worldBackgroundPrompt: params.worldBackgroundPrompt,
    offlineDatingPlotsContext: params.offlineDatingPlotsContext,
  })
  const history = transcriptToMessages(params.transcript.slice(-24))
  const userPronoun = resolveUserPronoun(params.playerIdentity)
  const messages: OpenAiCompatibleMessage[] = [
    {
      role: 'system',
      content: `${base}\n\n---\n【心语生成规则】\n${WECHAT_HEART_WHISPER_SYSTEM_PROMPT}\n\n【本轮代词约束】\n在 view_on_user 字段里，用户必须被称为“${userPronoun}”，禁止出现 ta/TA/Ta。`,
    },
    ...history,
    { role: 'user', content: '请基于刚刚最后一轮对话，输出心语 JSON。' },
  ]
  const text = await openAiCompatibleChat(cfg, messages, { temperature: 0.78, max_tokens: 900 })
  const parsed = parseHeartWhisperJson(text)
  const nowMs = typeof params.nowMs === 'number' && Number.isFinite(params.nowMs) ? params.nowMs : Date.now()
  return {
    timestamp: formatHeartWhisperTimestamp(nowMs),
    location: parsed.location || '未知地点',
    action: parsed.action || '轻轻调整了坐姿',
    outfit: parsed.outfit || '日常便装',
    innerThoughts: parsed.innerThoughts || '这会儿脑子里还在反复想刚才的对话细节。',
    userImpression:
      normalizeUserImpressionPronoun(parsed.userImpression, userPronoun) ||
      `${userPronoun}的表达很直接，让我愿意继续认真回应。`,
  }
}

const MEMORY_SUMMARY_SYSTEM = `
你是「长期记忆」提取助手。根据用户给出的“本次未总结片段”对话摘录，写出一条可长期沿用的记忆条目。
要求：
- 必须使用第一人称“我”，并且站在用户视角叙述（像“我…他/她…”）。
- 只总结本次提供的片段，禁止混入历史记忆、禁止补写片段外剧情。
- 只阐述可从聊天文本直接核对的事实：谁说了什么、确认了什么、约定了什么、结果怎样。
- 禁止写“我怎么想/我觉得/我感到”等主观心理活动；禁止写角色未在聊天里明确表达的心理活动。
- 禁止推断、脑补、升华、鸡汤、文学化修辞、官话套话、空泛评价。
- 口语化、具体、可回忆，像正常备忘，不要写成分析报告。
- 禁止升华、禁止鸡汤、禁止文学化修辞、禁止官话套话、禁止空泛评价。
- 不要写「用户说」「对方说」「本轮总结」等元话语。
- 长度以 60～180 字为宜（信息很少时可更短），只输出一段正文，不要标题、序号、引号或 Markdown。
`.trim()

/**
 * 根据近期对话生成一条长期记忆文本（供自动总结入库）。
 */
export async function requestWeChatMemorySummary(params: {
  apiConfig: ApiConfig | null
  transcript: ChatTranscriptTurn[]
}): Promise<string> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    throw new Error('未配置 AI API')
  }
  const tail = params.transcript.slice(-40)
  const lines = tail
    .map((t) => `${t.from === 'self' ? '我' : '对方'}：${String(t.text || '').trim()}`)
    .filter((s) => s.length > 3)
  const userBlock = lines.length ? lines.join('\n') : '（无有效对话）'
  const messages: OpenAiCompatibleMessage[] = [
    { role: 'system', content: MEMORY_SUMMARY_SYSTEM },
    {
      role: 'user',
      content: `以下是“尚未总结”的对话摘录，请仅基于这段内容生成一条长期记忆：\n\n${userBlock}`,
    },
  ]
  const text = await openAiCompatibleChat(cfg, messages, {
    temperature: 0.35,
    max_tokens: 512,
  })
  return text.replace(/^\s*【[^】]+】\s*/g, '').trim()
}

const UNIFIED_MEMORY_SUMMARY_SYSTEM = `
你是「长期记忆」提取助手。用户会提供两段材料：「线上聊天摘录」与「线下约会剧情摘录」，任一段可能为「（无）」。
要求：
- 必须使用第一人称“我”，站在用户视角叙述（像“我…他/她…”），把线上与线下里**实际发生**的信息合成一条连贯备忘。
- 只总结本次材料中可直接核对的事实：谁说了什么、做了什么、约定了什么、场景与结果；禁止混入材料外的剧情。
- 禁止写“我怎么想/我觉得/我感到”等主观心理；禁止推断角色未说出口的心理。
- 若某一栏为「（无）」，不要编造该栏内容；另一栏有内容则正常总结。
- 口语化、具体、可回忆；长度以 60～200 字为宜（信息很少时可更短）。
- 只输出一段正文，不要标题、序号、引号或 Markdown。
- 不要在正文里自行添加「[线上]」「[线下]」等来源标签（程序会统一加前缀）。
`.trim()

/**
 * 微信线上 + 约会线下 合并自动总结（入库前由调用方加 [线上]/[线下] 前缀）。
 */
export async function requestUnifiedMemorySummary(params: {
  apiConfig: ApiConfig | null
  onlineTranscript: ChatTranscriptTurn[]
  offlineTextBlock: string
}): Promise<string> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    throw new Error('未配置 AI API')
  }
  const tail = params.onlineTranscript.slice(-40)
  const onlineLines = tail
    .map((t) => `${t.from === 'self' ? '我' : '对方'}：${String(t.text || '').trim()}`)
    .filter((s) => s.length > 3)
  const onlineBlock = onlineLines.length ? onlineLines.join('\n') : '（无）'
  let offlineBlock = String(params.offlineTextBlock || '').trim()
  if (!offlineBlock) offlineBlock = '（无）'
  if (offlineBlock.length > 8000) offlineBlock = `${offlineBlock.slice(0, 8000)}\n\n（以下线下摘录因长度已截断）`
  const messages: OpenAiCompatibleMessage[] = [
    { role: 'system', content: UNIFIED_MEMORY_SUMMARY_SYSTEM },
    {
      role: 'user',
      content:
        `以下是「尚未总结」的材料，请仅基于这些内容生成一条长期记忆：\n\n` +
        `【线上聊天摘录】\n${onlineBlock}\n\n` +
        `【线下约会剧情摘录】\n${offlineBlock}`,
    },
  ]
  const text = await openAiCompatibleChat(cfg, messages, {
    temperature: 0.35,
    max_tokens: 640,
  })
  return text
    .replace(/^\s*【[^】]+】\s*/g, '')
    .replace(/^\s*(\[线上\]|\[线下\])+\s*/g, '')
    .trim()
}

const SCHEDULE_AI_TABLE_SYSTEM = `
请根据用户的要求，生成一个结构化的日程表数据。
输出格式必须是纯 JSON，不要任何多余文字。
JSON 格式如下：
{
"headers": ["表头 1", "表头 2", "表头 3"],
"rows": [
["单元格 1 内容", "单元格 2 内容", "单元格 3 内容"],
["单元格 4 内容", "单元格 5 内容", "单元格 6 内容"]
]
}
`.trim()

function parseScheduleTableJson(text: string): { headers: string[]; rows: string[][] } {
  const stripFence = (s: string) =>
    s
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

  const t = stripFence(text)
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  const raw = start >= 0 && end > start ? t.slice(start, end + 1) : t
  const j = JSON.parse(raw) as { headers?: unknown; rows?: unknown }
  const headers = Array.isArray(j.headers)
    ? j.headers.map((x) => String(x ?? '').trim()).filter(Boolean)
    : []
  const rows = Array.isArray(j.rows)
    ? j.rows
        .filter((r): r is unknown[] => Array.isArray(r))
        .map((r) => r.map((x) => String(x ?? '')))
    : []
  if (!headers.length) throw new Error('AI 未返回 headers')
  if (!rows.length) throw new Error('AI 未返回 rows')
  return { headers: headers.slice(0, 24), rows: rows.slice(0, 120) }
}

export async function requestScheduleTableFromAi(params: {
  apiConfig: ApiConfig | null
  userRequirement: string
}): Promise<{ headers: string[]; rows: string[][] }> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    throw new Error('未配置 AI API')
  }
  const messages: OpenAiCompatibleMessage[] = [
    { role: 'system', content: SCHEDULE_AI_TABLE_SYSTEM },
    { role: 'user', content: params.userRequirement.trim() },
  ]
  const text = await openAiCompatibleChat(cfg, messages, { temperature: 0.4, max_tokens: 1400 })
  return parseScheduleTableJson(text)
}

/** 综艺弹幕：先锁输出形态，再写风格，便于模型遵守行数与零废话。 */
const DANMAKU_VARIETY_SHOW_RULES = `
【你的身份】综艺节目直播弹幕里的真人网友：恋爱综/真人秀/聊天向，极度口语、有情绪，像边看边打字。

【输出铁则｜必须遵守】
1. 只输出弹幕正文：每行一条，行与行之间仅换行分隔；不要序号、不要标题、不要「弹幕」「第x条」等标签、不要代码块或 Markdown。
2. 行数由用户本轮消息里的数字决定；尽量凑满该行数；仅当对话信息极少时才允许少几行，但绝不能多过该行数。
3. 单条以 8～22 个汉字为主（可含少量标点），要具体、有梗或情绪，拒绝空洞水评（如单独一个「哈哈哈」「666」除非和上文强相关）。

【怎么写】
- 结合完整对话脉络与系统已给出的设定/记忆（若有）来吐槽，不要只盯最后一句话，避免突兀。
- 系统会给出【弹幕参考｜须贴合人设】：必须结合其中「聊天角色（对方）」与「用户（玩家）」档案吐嘈；自称、嗑点、称呼与气质须与档案一致，勿编造矛盾设定；未绑档案处用中性口吻、勿默认性别。
- 允许：共情、磕糖、尖叫、毒舌、无语、适度玩梗与抽象。
- 禁止：人身侮辱、黄暴、恶意攻击、引战、复述剧情当弹幕。

【语感参考｜勿照抄整句，模仿口气即可】
“谁懂啊！”“甜晕了…”“吃醋了吃醋了！！”“刚是不是表白了？”“木愣子一样我真服了”“搞什么鸡毛？赶紧上啊！”“不想看这种无聊场面”“他急了他急了”“这都能忍？换我早炸了”“细节控狂喜”“哈哈哈尬住了”“救命别太暧昧”

【质量】
每条弹幕视角或落点尽量不同；禁止互相雷同、禁止同义反复。
`.trim()

function danmakuGenderZh(g: Character['gender'] | undefined | null): string {
  if (g === 'male') return '男'
  if (g === 'female') return '女'
  if (g === 'other') return '其他'
  return '未知'
}

/** 弹幕专用：中文性别 + 核心人设字段。 */
function buildDanmakuPersonaBriefLines(c: Character | null, role: 'peer' | 'player'): string {
  if (!c) {
    return role === 'peer'
      ? '（当前会话未绑定聊天角色档案；若对话里出现具体人名、关系，以对话内容为准。）'
      : '（未绑定玩家身份档案。）'
  }
  const bits = [
    `姓名/常用称呼：${c.name || '未命名'}`,
    `性别：${danmakuGenderZh(c.gender)}`,
    typeof c.age === 'number' ? `年龄：${c.age}` : '',
    c.birthdayMD ? `生日：${c.birthdayMD}` : '',
    c.zodiac ? `星座：${c.zodiac}` : '',
    c.identity ? `身份：${c.identity}` : '',
    c.mbti ? `MBTI：${c.mbti}` : '',
    c.wechatNickname ? `微信昵称：${c.wechatNickname}` : '',
    c.wechatSignature ? `微信签名：${c.wechatSignature}` : '',
    c.wechatRegion ? `微信地区：${c.wechatRegion}` : '',
  ].filter(Boolean)
  const motto = c.motto?.trim()
  if (motto) bits.push(`个性签名/座右铭：${motto.length > 80 ? `${motto.slice(0, 80)}…` : motto}`)
  const bio = c.bio?.trim()
  if (bio) bits.push(`简介：${bio.length > 200 ? `${bio.slice(0, 200)}…` : bio}`)
  return bits.join('\n')
}

/**
 * 无论是否勾选长期记忆，都注入双方人设摘要，避免弹幕吐槽脱离角色与用户设定。
 */
function buildDanmakuIdentityContext(params: {
  character: Character | null
  playerIdentity: PlayerIdentity | null
  playerDisplayName: string
  worldBackgroundPrompt?: string
  useMemory: boolean
}): string {
  const peerName = params.playerDisplayName.trim() || '朋友'
  let peerBlock = buildDanmakuPersonaBriefLines(params.character, 'peer')
  const wbg = params.worldBackgroundPrompt?.trim()
  if (wbg) {
    const clip = wbg.length > 900 ? `${wbg.slice(0, 900)}…` : wbg
    peerBlock += `\n---\n【世界背景（节选，供理解角色处境）】\n${clip}`
  }

  let userBlock = buildDanmakuPersonaBriefLines(params.playerIdentity, 'player')
  if (!params.playerIdentity) {
    userBlock += `\n会话中用户展示名/备注：${peerName}（仅此，无完整玩家档案时请用中性观众视角，勿默认性别）。`
  }

  const memNote = params.useMemory
    ? '（若上方系统提示中另有【世界书】【长期记忆】等，弹幕吐槽须与之一致，不得与世界书矛盾。）'
    : '（本轮未注入长期记忆与世界书全文；请以本段人设摘要 + 最近对话为准，勿臆造未给出的设定。）'

  return `【弹幕参考｜须贴合人设】
你在扮演看综艺发弹幕的网友，但吐槽对象与代入视角须贴合下列「对方角色」与「用户」人设，禁止与档案气质明显冲突。
${memNote}

---
【聊天角色（对方）】
${peerBlock}
---
【用户（发微信的一方 / 玩家）】
${userBlock}
---`.trim()
}

function parseDanmakuLines(raw: string, maxLines: number): string[] {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/^\s*[\d０-９]+[.\u3001．:：]\s*/u, '')
        .replace(/^[-*•]\s*/, '')
        .trim(),
    )
    .filter(Boolean)

  const out: string[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    if (out.length >= maxLines) break
    const t = line.replace(/["'「」【】]/g, '').trim()
    if (t.length < 4) continue
    const clipped = t.length > 36 ? t.slice(0, 36) : t
    const key = clipped.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(clipped)
  }
  return out
}

/**
 * 综艺现场观众式弹幕：不计入聊天记录；按配置条数返回多行。
 */
export async function requestWeChatDanmakuVarietyShow(params: {
  apiConfig: ApiConfig | null
  character: Character | null
  playerIdentity: PlayerIdentity | null
  playerDisplayName: string
  transcript: ChatTranscriptTurn[]
  promptMode: WeChatChatPromptMode
  useMemory: boolean
  generateCount: number
  /** 非空则替代内置 `DANMAKU_VARIETY_SHOW_RULES` */
  customRulesPrompt?: string
  longTermMemoryNotes?: string
  worldBackgroundPrompt?: string
  offlineDatingPlotsContext?: string
}): Promise<string[]> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    return []
  }

  const n = Math.min(20, Math.max(1, Math.round(params.generateCount)))
  const taskUser = `【本轮任务】请根据上文，输出 **${n} 行**综艺观众弹幕。
- 格式：纯文本，共 ${n} 行（信息极少时可少于 ${n} 行，禁止超过 ${n} 行）；每行一条，仅换行分隔。
- 除此以外不要任何说明、前后缀或空行。`

  const custom = params.customRulesPrompt?.trim() ?? ''
  const rulesBlock = custom.length > 0 ? custom : DANMAKU_VARIETY_SHOW_RULES
  const identityCtx = buildDanmakuIdentityContext({
    character: params.character,
    playerIdentity: params.playerIdentity,
    playerDisplayName: params.playerDisplayName,
    worldBackgroundPrompt: params.worldBackgroundPrompt,
    useMemory: params.useMemory,
  })

  let messages: OpenAiCompatibleMessage[]

  if (params.useMemory) {
    const base = buildSystemContent({
      character: params.character,
      playerIdentity: params.playerIdentity,
      playerDisplayName: params.playerDisplayName,
      promptMode: params.promptMode,
      longTermMemoryNotes: params.longTermMemoryNotes,
      worldBackgroundPrompt: params.worldBackgroundPrompt,
      offlineDatingPlotsContext: params.offlineDatingPlotsContext,
    })
    const system = `${base}\n\n${identityCtx}\n\n---\n【弹幕生成附加铁则】\n${rulesBlock}`
    const history = transcriptToMessages(params.transcript)
    messages = [{ role: 'system', content: system }, ...history, { role: 'user', content: taskUser }]
  } else {
    const system = `${rulesBlock}\n\n${identityCtx}\n\n【上下文范围】你仅根据下方「最近 20 条」对话消息理解剧情；未在上方档案中出现的细节不要编造。`
    const tail = params.transcript.slice(-20)
    const history = transcriptToMessages(tail)
    messages = [{ role: 'system', content: system }, ...history, { role: 'user', content: taskUser }]
  }

  try {
    const text = await openAiCompatibleChat(cfg, messages, {
      temperature: 0.92,
      max_tokens: Math.min(4000, 32 + n * 80),
    })
    return parseDanmakuLines(text, n)
  } catch {
    return []
  }
}
