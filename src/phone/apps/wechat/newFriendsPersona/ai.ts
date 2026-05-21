import type { Character, PlayerIdentity, WorldBook, WorldBookItem } from './types'
import { genderLabelZh } from './utils'
import { formatWorldBookItemLineForPrompt, worldBookPronounGuideAnnotation } from './worldBookPronounGuide'
import type { ApiConfig } from '../../api/types'
import { LUMI_SYS_TOKENS_TOTAL_KEY } from '../../dataArchive/constants'
import { clampWbItemGenTargetChars } from './worldBookItemGenConstants'

const WB_ITEM_PROMPT_CONTENT_CAP = 520
const WB_EXISTING_CONTEXT_MAX_CHARS = 9000
const LINKED_NPC_CONTEXT_MAX = 4500
const LINKED_NPC_BIO_SLICE = 200

function sliceForWbPrompt(s: string, cap: number): string {
  const t = s.trim()
  if (!t.length) return ''
  return t.length <= cap ? t : `${t.slice(0, cap)}…`
}

/**
 * 汇总已有世界书条目，供模型避免重复、矛盾；含同书其他条目 + 其他已启用世界书条目。
 */
function buildExistingWorldBookEntriesContext(params: {
  character: Character
  worldBook: WorldBook
  item: WorldBookItem
}): string {
  const { character, worldBook, item } = params
  const chunks: string[] = []

  const subjectName = String(character.name ?? '').trim() || '该角色'
  const sameBookLines: string[] = []
  for (const it of worldBook.items ?? []) {
    if (it.id === item.id) continue
    const c = String(it.content ?? '').trim()
    if (!c) continue
    const flag = it.enabled ? '' : '（当前关闭，仍勿与之下矛盾或重复）'
    const body = sliceForWbPrompt(c, WB_ITEM_PROMPT_CONTENT_CAP)
    const ann = worldBookPronounGuideAnnotation(it.pronounGuide, subjectName, 'character_card')
    sameBookLines.push(`- 「${it.name}」${flag}：${body}${ann ? ` ${ann}` : ''}`)
  }
  if (sameBookLines.length) {
    chunks.push(`【同一世界书内已有条目正文（勿重复、勿改头换面复述同义内容；性格态度等须与之下一致、不可自相矛盾）】\n${sameBookLines.join('\n')}`)
  }

  const otherBookLines: string[] = []
  for (const w of character.worldBooks ?? []) {
    if (w.id === worldBook.id || !w.enabled) continue
    for (const it of w.items ?? []) {
      if (!it.enabled) continue
      const c = String(it.content ?? '').trim()
      if (!c) continue
      const body = sliceForWbPrompt(c, WB_ITEM_PROMPT_CONTENT_CAP)
      const ann = worldBookPronounGuideAnnotation(it.pronounGuide, subjectName, 'character_card')
      otherBookLines.push(`- 世界书「${w.name}」·条目「${it.name}」：${body}${ann ? ` ${ann}` : ''}`)
    }
  }
  if (otherBookLines.length) {
    chunks.push(`【其他已启用世界书中的条目（整体人设须一致；勿与其中任一矛盾，勿重复其已写明的信息）】\n${otherBookLines.join('\n')}`)
  }

  const joined = chunks.join('\n\n')
  return joined.length <= WB_EXISTING_CONTEXT_MAX_CHARS ? joined : `${joined.slice(0, WB_EXISTING_CONTEXT_MAX_CHARS)}…`
}

/**
 * 同人脉下已生成 NPC 的紧凑摘要，供主角/配角世界书 AI 参考（纯函数，便于单测与编辑页组装）。
 */
export function formatLinkedNpcsForWorldBookPrompt(npcs: Character[]): string {
  if (!npcs.length) return ''
  const lines: string[] = []
  for (const n of npcs) {
    const parts: string[] = [`${n.name || '未命名'}`]
    if (n.wechatNickname?.trim()) parts.push(`网称「${n.wechatNickname.trim()}」`)
    if (n.identity?.trim()) parts.push(`身份「${n.identity.trim()}」`)
    parts.push(`性别${genderLabelZh(n.gender)}`)
    if (n.age != null && Number.isFinite(n.age)) parts.push(`年龄${n.age}`)
    if (n.mbti?.trim()) parts.push(`MBTI ${n.mbti.trim()}`)
    const ii = (n.interests ?? []).filter(Boolean)
    if (ii.length) parts.push(`兴趣${ii.join('、')}`)
    const pp = (n.painPoints ?? []).filter(Boolean)
    if (pp.length) parts.push(`雷点${pp.join('、')}`)
    if (n.motto?.trim()) parts.push(`座右铭${sliceForWbPrompt(n.motto, 80)}`)
    if (n.bio?.trim()) parts.push(`简介${sliceForWbPrompt(n.bio, LINKED_NPC_BIO_SLICE)}`)
    lines.push(`- ${parts.join('，')}`)
  }
  const header =
    '【人脉中已生成的 NPC（供社会关系与互动侧写参考；勿呆板罗列全员；须与上文已有世界书条目及主体人设一致、勿编造冲突）】'
  const body = lines.join('\n')
  const full = `${header}\n${body}`
  return full.length <= LINKED_NPC_CONTEXT_MAX ? full : `${full.slice(0, LINKED_NPC_CONTEXT_MAX)}…`
}

export type OpenAiCompatibleMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type ChatMessage = OpenAiCompatibleMessage

/** 从 OpenAI 兼容体 / Gemini generateContent 响应中取出「输出侧」可计费 token 数（优先 completion，其次 Gemini candidates） */
function extractBillableCompletionTokens(data: unknown): number {
  const root = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  if (!root) return 0
  const usage = root.usage && typeof root.usage === 'object' ? (root.usage as Record<string, unknown>) : null
  if (usage) {
    const ct = Number(usage.completion_tokens)
    if (Number.isFinite(ct) && ct > 0) return Math.min(Math.floor(ct), 2_000_000)
    const ctCamel = Number(usage.completionTokens)
    if (Number.isFinite(ctCamel) && ctCamel > 0) return Math.min(Math.floor(ctCamel), 2_000_000)
    const tt = Number(usage.total_tokens)
    if (Number.isFinite(tt) && tt > 0) return Math.min(Math.floor(tt), 2_000_000)
    const ttCamel = Number(usage.totalTokens)
    if (Number.isFinite(ttCamel) && ttCamel > 0) return Math.min(Math.floor(ttCamel), 2_000_000)
  }
  const um =
    root.usageMetadata && typeof root.usageMetadata === 'object'
      ? (root.usageMetadata as Record<string, unknown>)
      : root.usage_metadata && typeof root.usage_metadata === 'object'
        ? (root.usage_metadata as Record<string, unknown>)
        : null
  if (um) {
    const cand = Number(um.candidatesTokenCount)
    if (Number.isFinite(cand) && cand > 0) return Math.min(Math.floor(cand), 2_000_000)
    const candSnake = Number(um.candidates_token_count)
    if (Number.isFinite(candSnake) && candSnake > 0) return Math.min(Math.floor(candSnake), 2_000_000)
    const tot = Number(um.totalTokenCount)
    if (Number.isFinite(tot) && tot > 0) return Math.min(Math.floor(tot), 2_000_000)
  }
  return 0
}

/** chat/completions 成功后累加输出 token 到数据中心「灵感消耗」；同页触发刷新事件 */
export function bumpLumiSysTokensFromChatResponse(data: unknown): void {
  if (typeof localStorage === 'undefined') return
  const add = extractBillableCompletionTokens(data)
  if (!add) return
  try {
    const raw = localStorage.getItem(LUMI_SYS_TOKENS_TOTAL_KEY)
    const prev = raw ? Number(raw) : 0
    const base = Number.isFinite(prev) && prev >= 0 ? Math.floor(prev) : 0
    localStorage.setItem(LUMI_SYS_TOKENS_TOTAL_KEY, String(Math.min(base + add, Number.MAX_SAFE_INTEGER)))
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('lumi-sys-metrics-changed'))
  } catch {
    /* ignore */
  }
}

function isGeminiGenerateContentUrl(url: string): boolean {
  const u = url.trim()
  if (!u) return false
  if (/generativelanguage\.googleapis\.com/i.test(u) && /:generateContent/i.test(u)) return true
  return false
}

function buildGeminiGenerateContentEndpoint(cfg: ApiConfig): string {
  const raw = cfg.apiUrl.trim()
  if (!raw) return raw
  // 若用户直接填了 generateContent 全路径，就原样使用。
  if (isGeminiGenerateContentUrl(raw)) return raw
  // 否则仅在明显是 generativelanguage 域名时尝试拼接。
  if (!/generativelanguage\.googleapis\.com/i.test(raw)) return raw
  const base = raw.replace(/\/+$/, '')
  const v = /\/v1beta\b/i.test(base) ? 'v1beta' : /\/v1\b/i.test(base) ? 'v1' : 'v1beta'
  const host = base.replace(/\/v1beta.*$/i, '').replace(/\/v1.*$/i, '')
  const model = encodeURIComponent(cfg.modelId.trim())
  return `${host}/${v}/models/${model}:generateContent`
}

function wrapThinkingAndVisible(thinking: string | undefined, visible: string): string {
  const v = visible.trim()
  const t = String(thinking ?? '').trim()
  if (!t) return v
  /** 模型/网关常在 <thinking> 上带属性，不能用字面量 <thinking> 判断 */
  if (/<thinking\b[^>]*>[\s\S]*?<\/thinking>/i.test(v)) return v
  return `<thinking>\n${t}\n</thinking>\n${v}`.trim()
}

/** 从若干层对象上收集「与正文分字段返回」的思维链，再与可见正文拼成带 <thinking> 的整段（供 splitDatingAssistantOutput 解析） */
function mergeReasoningFieldsIntoVisible(visible: string, layers: Record<string, unknown>[]): string {
  const v = visible.trim()
  let thinking = ''
  for (const layer of layers) {
    const t =
      flattenUnknownToText(layer.reasoning_content) ||
      flattenUnknownToText(layer.reasoning) ||
      flattenUnknownToText(layer.thinking) ||
      flattenUnknownToText(layer.chain_of_thought) ||
      flattenUnknownToText(layer.analysis) ||
      ''
    if (t.trim()) {
      thinking = t.trim()
      break
    }
  }
  /** 勿在 !v 时提前 return：部分网关只填 reasoning_*、content 为空，否则思维链整段丢失 */
  return wrapThinkingAndVisible(thinking || undefined, v).trim()
}

function flattenUnknownToText(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (Array.isArray(v)) {
    const t = v.map((x) => flattenUnknownToText(x)).filter(Boolean).join('\n').trim()
    return t
  }
  if (v && typeof v === 'object') {
    const rec = v as Record<string, unknown>
    const direct =
      (typeof rec.text === 'string' ? rec.text : '') ||
      (typeof rec.content === 'string' ? rec.content : '') ||
      (typeof rec.reasoning_content === 'string' ? rec.reasoning_content : '') ||
      (typeof rec.reasoning === 'string' ? rec.reasoning : '') ||
      (typeof rec.thinking === 'string' ? rec.thinking : '')
    if (direct.trim()) return direct.trim()
    const joined = Object.values(rec)
      .map((x) => flattenUnknownToText(x))
      .filter(Boolean)
      .join('\n')
      .trim()
    return joined
  }
  return ''
}

function partTextFromOpenAiContentPiece(p: unknown): string {
  const part = p && typeof p === 'object' ? (p as Record<string, unknown>) : null
  if (!part) return ''
  const outText = part.output_text
  const t =
    (typeof part.text === 'string' ? part.text : '') ||
    (typeof part.input_text === 'string' ? part.input_text : '') ||
    (typeof outText === 'string' ? outText : '')
  return String(t || '').trim()
}

function flattenOpenAiResponsesAssistantContent(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return flattenUnknownToText(content)
  const parts: string[] = []
  for (const item of content) {
    const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : null
    if (!o) continue
    const typ = typeof o.type === 'string' ? o.type : ''
    if (typ === 'output_text' || typ === 'text' || typ === 'input_text') {
      const tx = typeof o.text === 'string' ? o.text : ''
      if (tx.trim()) parts.push(tx.trim())
    }
  }
  return parts.join('\n').trim()
}

function extractOpenAiReasoningOutputItem(o: Record<string, unknown>): string {
  const chunks: string[] = []
  const summary = o.summary
  if (Array.isArray(summary)) {
    for (const s of summary) {
      const rec = s && typeof s === 'object' ? (s as Record<string, unknown>) : null
      if (rec && typeof rec.text === 'string' && rec.text.trim()) chunks.push(rec.text.trim())
    }
  }
  const c = o.content
  if (Array.isArray(c)) {
    for (const item of c) {
      const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : null
      if (!rec) continue
      const typ = typeof rec.type === 'string' ? rec.type : ''
      if ((typ === 'reasoning_text' || typ === 'text') && typeof rec.text === 'string' && rec.text.trim()) {
        chunks.push(rec.text.trim())
      }
    }
  }
  const plain = typeof o.text === 'string' ? o.text.trim() : ''
  if (plain) chunks.push(plain)
  return chunks.join('\n').trim()
}

/** OpenAI Responses API 等返回的 output[] 结构（与 chat/completions 不同） */
function tryParseOpenAiResponsesShape(root: Record<string, unknown>): string | null {
  const output = root.output
  if (!Array.isArray(output)) return null
  const thinkingParts: string[] = []
  const visibleParts: string[] = []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const typ = typeof o.type === 'string' ? o.type : ''
    if (typ === 'reasoning') {
      const t = extractOpenAiReasoningOutputItem(o)
      if (t) thinkingParts.push(t)
    } else if (typ === 'message') {
      const role = typeof o.role === 'string' ? o.role : ''
      if (role === 'assistant') {
        const v = flattenOpenAiResponsesAssistantContent(o.content)
        if (v) visibleParts.push(v)
      }
    }
  }
  const merged = wrapThinkingAndVisible(thinkingParts.join('\n').trim(), visibleParts.join('\n').trim())
  const out = merged.trim()
  return out || null
}

function extractAssistantTextFromMessageObject(
  message: Record<string, unknown>,
  choice: Record<string, unknown>,
  root: Record<string, unknown>,
): string {
  let visible = ''
  const content = message.content
  if (typeof content === 'string') {
    visible = content.trim()
  } else if (Array.isArray(content)) {
    const visibleParts: string[] = []
    const thinkingParts: string[] = []
    for (const p of content as unknown[]) {
      const text = partTextFromOpenAiContentPiece(p)
      if (!text) continue
      const part = p && typeof p === 'object' ? (p as Record<string, unknown>) : null
      const type = typeof part?.type === 'string' ? part.type.toLowerCase() : ''
      if (type === 'reasoning' || type === 'thinking') {
        thinkingParts.push(text)
      } else {
        visibleParts.push(text)
      }
    }
    visible = visibleParts.join('\n').trim()
    const embeddedThinking = thinkingParts.join('\n').trim()
    if (embeddedThinking) {
      const out = wrapThinkingAndVisible(embeddedThinking, visible)
      if (out.trim()) return out.trim()
    }
  } else if (content && typeof content === 'object') {
    const c = content as Record<string, unknown>
    if (typeof c.text === 'string') visible = c.text.trim()
    else if (typeof c.value === 'string') visible = c.value.trim()
    else {
      const flat = flattenUnknownToText(content)
      if (flat) visible = flat
    }
  }

  const directReasoning =
    flattenUnknownToText(message.reasoning_content) ||
    flattenUnknownToText(message.reasoning) ||
    flattenUnknownToText(message.thinking) ||
    flattenUnknownToText(message.reasoning_details) ||
    flattenUnknownToText(message.reasoning_summary) ||
    flattenUnknownToText(message.chain_of_thought) ||
    flattenUnknownToText(message.analysis) ||
    flattenUnknownToText(choice.reasoning_content) ||
    flattenUnknownToText(choice.reasoning) ||
    flattenUnknownToText(choice.thinking) ||
    flattenUnknownToText(root.reasoning) ||
    flattenUnknownToText(root.thinking) ||
    ''
  const out = wrapThinkingAndVisible(directReasoning, visible)
  return out.trim()
}

/** 自建网关常见：正文在 answer / response / reply 等顶层字符串 */
function tryLooseGatewayAssistantText(root: Record<string, unknown>): string | null {
  const keys = [
    'answer',
    'response',
    'reply',
    'completion',
    'output_text',
    'assistant_response',
    'generated_text',
    'result_text',
    'content_text',
  ] as const
  for (const k of keys) {
    const v = root[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  if (typeof root.message === 'string' && root.message.trim()) return root.message.trim()

  const gens = root.generations
  if (Array.isArray(gens) && gens.length) {
    const g0 = gens[0]
    if (Array.isArray(g0) && g0[0] && typeof g0[0] === 'object') {
      const t = (g0[0] as Record<string, unknown>).text
      if (typeof t === 'string' && t.trim()) return t.trim()
    }
  }
  return null
}

function tryParseJsonObjectString(raw: string): Record<string, unknown> | null {
  const t = raw.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return null
  try {
    const v = JSON.parse(t) as unknown
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
    if (Array.isArray(v) && v[0] && typeof v[0] === 'object') return v[0] as Record<string, unknown>
  } catch {
    return null
  }
  return null
}

/**
 * 解析 OpenAI chat/completions 兼容 JSON；失败返回 null（由外层决定是否抛错）。
 * 已做：嵌套 data/result 为 JSON 字符串、choices[].message 为字符串、Gemini 误走 chat 接口等自动修正。
 */
function tryParseOpenAiChoiceMessage(data: unknown, depth = 0): string | null {
  if (depth > 5) return null

  if (Array.isArray(data) && data.length && data[0] && typeof data[0] === 'object') {
    const r0 = tryParseOpenAiChoiceMessage(data[0], depth + 1)
    if (r0?.trim()) return r0.trim()
  }

  const root = (data && typeof data === 'object' ? (data as Record<string, unknown>) : null) as Record<string, unknown> | null
  if (!root) return null

  const responsesTry = tryParseOpenAiResponsesShape(root)
  if (responsesTry?.trim()) return responsesTry.trim()

  let choices = Array.isArray(root.choices) ? root.choices : []

  if (!choices.length) {
    const nestKeys = ['data', 'result', 'body', 'output', 'response', 'payload'] as const
    for (const k of nestKeys) {
      const raw = root[k]
      if (typeof raw === 'string' && raw.trim()) {
        const parsed = tryParseJsonObjectString(raw)
        if (parsed) {
          const inner = tryParseOpenAiChoiceMessage(parsed, depth + 1)
          if (inner?.trim()) return inner.trim()
        }
      }
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const nested = raw as Record<string, unknown>
        if (Array.isArray(nested.choices) && nested.choices.length) {
          const inner = tryParseOpenAiChoiceMessage(nested, depth + 1)
          if (inner?.trim()) return inner.trim()
        }
      }
    }
    choices = Array.isArray(root.choices) ? root.choices : []
  }

  for (const ch of choices) {
    const choice = ch && typeof ch === 'object' ? (ch as Record<string, unknown>) : null
    if (!choice) continue

    const msgRaw = choice.message
    if (typeof msgRaw === 'string' && msgRaw.trim()) {
      return mergeReasoningFieldsIntoVisible(msgRaw.trim(), [choice, root])
    }
    if (msgRaw && typeof msgRaw === 'object') {
      const message = msgRaw as Record<string, unknown>
      const out = extractAssistantTextFromMessageObject(message, choice, root)
      if (out?.trim()) return out.trim()
    }

    const chContent = choice.content
    if (typeof chContent === 'string' && chContent.trim()) {
      /** 勿直接 return：部分网关把正文放在 choice.content，思维链放在 choice.reasoning_*，否则会丢思考过程 */
      return mergeReasoningFieldsIntoVisible(chContent.trim(), [choice, root])
    }

    if (typeof choice.text === 'string' && choice.text.trim()) {
      return mergeReasoningFieldsIntoVisible(choice.text.trim(), [choice, root])
    }

    const delta = choice.delta
    if (delta && typeof delta === 'object') {
      const d = delta as Record<string, unknown>
      if (typeof d.content === 'string' && d.content.trim()) {
        return mergeReasoningFieldsIntoVisible(d.content.trim(), [d, choice, root])
      }
      if (Array.isArray(d.content)) {
        const pieces = (d.content as unknown[]).map((p) => partTextFromOpenAiContentPiece(p)).filter(Boolean)
        const joined = pieces.join('\n').trim()
        if (joined) return mergeReasoningFieldsIntoVisible(joined, [d, choice, root])
      }
    }
  }

  const topLevelStrings = [root.output, root.result, root.content, root.text]
  for (const t of topLevelStrings) {
    if (typeof t === 'string' && t.trim()) return mergeReasoningFieldsIntoVisible(t.trim(), [root])
  }

  if (root.message && typeof root.message === 'object') {
    const out = extractAssistantTextFromMessageObject(root.message as Record<string, unknown>, {}, root)
    if (out?.trim()) return out.trim()
  }

  const loose = tryLooseGatewayAssistantText(root)
  if (loose?.trim()) return loose.trim()

  return null
}

function parseOpenAiChoiceMessage(data: unknown): string {
  if (typeof data === 'string') {
    const t = data.trim()
    if (t) {
      const parsed = tryParseJsonObjectString(t)
      if (parsed) {
        const r = tryParseOpenAiChoiceMessage(parsed, 0)
        if (r?.trim()) return r.trim()
      }
      return t
    }
  }

  const direct = tryParseOpenAiChoiceMessage(data, 0)
  if (direct?.trim()) return direct.trim()

  try {
    return parseGeminiText(data)
  } catch {
    // 非 Gemini 结构
  }

  throw new Error(
    '返回格式不符合预期（未解析到模型正文）。客户端已尝试：嵌套 JSON、choices[].message 为字符串、answer/response 等常见网关字段、Gemini 结构。HTTP 200 仍失败时常见于：网关套壳字段名不兼容、`choices[].message.content` / `choices[].text` 为空字符串（审查/过载/上下文过长截断）、或配置了流式 SSE 却走了非流式路径。若仍失败，请确认网关返回可与 OpenAI `chat/completions` 对齐的 JSON。',
  )
}

/** fetch 后与 `resp.json()` 等价，但在非 JSON 时给出可操作提示（多为流式/HTML/网关错误页） */
async function readFetchJsonBody(resp: Response): Promise<unknown> {
  const raw = await resp.text()
  const text = raw.trim()
  if (!text) {
    throw new Error(`网关返回空响应体（HTTP ${resp.status}），无法解析。`)
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    const head = text.slice(0, 240).replace(/\s+/g, ' ')
    throw new Error(
      `网关返回非合法 JSON（HTTP ${resp.status}）。常见原因：API 地址指向了 **SSE 流式** endpoint、反代返回 HTML/纯文本、或线路错误。响应开头：${head}${text.length > 240 ? '…' : ''}`,
    )
  }
}

function parseGeminiText(data: unknown): string {
  const root = (data && typeof data === 'object' ? (data as Record<string, unknown>) : {}) as Record<string, unknown>
  const candidates = Array.isArray(root.candidates) ? root.candidates : []
  for (const cand of candidates) {
    const first = cand && typeof cand === 'object' ? (cand as Record<string, unknown>) : {}
    const content = (first.content && typeof first.content === 'object' ? (first.content as Record<string, unknown>) : {}) as Record<
      string,
      unknown
    >
    const parts = content.parts
    if (Array.isArray(parts) && parts.length) {
      const visibleParts: string[] = []
      const thinkingParts: string[] = []
      for (const p of parts as Array<Record<string, unknown>>) {
        const text = typeof p?.text === 'string' ? p.text.trim() : ''
        if (!text) continue
        const isThought = p?.thought === true || p?.thoughtSignature != null
        if (isThought) thinkingParts.push(text)
        else visibleParts.push(text)
      }
      const merged = wrapThinkingAndVisible(thinkingParts.join('\n').trim(), visibleParts.join('\n').trim())
      if (merged.trim()) return merged.trim()
    }
    const t2 = typeof first.output === 'string' ? first.output.trim() : ''
    if (t2) return t2
  }

  const pf = root.promptFeedback && typeof root.promptFeedback === 'object' ? (root.promptFeedback as Record<string, unknown>) : null
  const blockReason = pf?.blockReason
  if (typeof blockReason === 'string' && blockReason.trim()) {
    throw new Error(`Gemini 未返回正文：${blockReason.trim()}`)
  }

  throw new Error(
    '返回格式不符合预期（Gemini 响应中无有效 candidates/parts，可能被安全策略拦截或返回为空）。',
  )
}

function extractGeminiUserTextFromOpenAiLikeMessages(messages: unknown[]): string {
  const lines: string[] = []
  for (const m of messages) {
    const mm = (m && typeof m === 'object' ? (m as Record<string, unknown>) : {}) as Record<string, unknown>
    const role = typeof mm?.role === 'string' ? mm.role : 'user'
    const c = mm?.content
    if (typeof c === 'string') {
      const t = c.trim()
      // 群聊 transcript 里历史多为 role:user，内容已含「[谁] …」；勿统一加「我：」以免误导 Gemini。
      if (t) lines.push(role === 'system' ? t : role === 'assistant' ? `对方：${t}` : t)
      continue
    }
    // content parts：提取 text part 组成上下文
    if (Array.isArray(c)) {
      const t = c
        .map((p) => {
          const part = p && typeof p === 'object' ? (p as Record<string, unknown>) : null
          return typeof part?.text === 'string' ? part.text : ''
        })
        .join('')
        .trim()
      if (t) lines.push(role === 'assistant' ? `对方：${t}` : t)
      continue
    }
  }
  return lines.join('\n').trim()
}

/**
 * 兼容多模态（OpenAI 风格 content parts）的 chat 调用。
 * - 不改动现有 `openAiCompatibleChat` 的签名，避免影响文本链路
 * - 仅在需要发送图片时使用
 */
export async function openAiCompatibleChatAny(
  cfg: ApiConfig,
  messages: unknown[],
  options?: { temperature?: number; max_tokens?: number },
): Promise<string> {
  // Gemini 原生 generateContent：按 parts 规则（先 text，后 inline_data）。
  // 仅在 apiUrl 明确指向 generateContent 时启用，避免误伤 OpenAI Compatible 代理。
  if (isGeminiGenerateContentUrl(cfg.apiUrl)) {
    const endpoint = buildGeminiGenerateContentEndpoint(cfg)
    const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}key=${encodeURIComponent(cfg.apiKey)}`

    // 从 OpenAI 风格 messages 中抽取文本与图片。
    const text = extractGeminiUserTextFromOpenAiLikeMessages(messages)
    const images: Array<{ mime_type: string; data: string }> = []
    for (const m of messages) {
      const mm = (m && typeof m === 'object' ? (m as Record<string, unknown>) : {}) as Record<string, unknown>
      const c = mm.content
      if (!Array.isArray(c)) continue
      for (const p of c) {
        const part = p && typeof p === 'object' ? (p as Record<string, unknown>) : null
        // 标准：{type:'image_url', image_url:{url:'data:...;base64,xxxx'}}
        const imageUrl =
          part?.image_url && typeof part.image_url === 'object'
            ? (part.image_url as Record<string, unknown>).url
            : part?.image_url
        const url1 = imageUrl ?? part?.url
        if (typeof url1 === 'string' && /^data:/i.test(url1) && /;base64,/i.test(url1)) {
          const mm = /^data:([^;]+);base64,(.*)$/i.exec(url1)
          if (!mm) continue
          const mime = mm[1]!
          const b64 = (mm[2] ?? '').replace(/^data:image\/\w+;base64,/i, '')
          if (b64.trim()) images.push({ mime_type: mime, data: b64 })
        }
      }
    }

    const parts: Array<Record<string, unknown>> = []
    if (text) parts.push({ text })
    for (const img of images) {
      parts.push({ inline_data: { mime_type: img.mime_type, data: img.data } })
    }

    const body: Record<string, unknown> = {
      contents: [{ parts }],
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
      },
    }
    if (options?.max_tokens != null) {
      ;(body.generationConfig as Record<string, unknown>).maxOutputTokens = options.max_tokens
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data: unknown = await readFetchJsonBody(resp)
    if (!resp.ok) {
      const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
      const errObj = rec?.error && typeof rec.error === 'object' ? (rec.error as Record<string, unknown>) : null
      const msg = (typeof errObj?.message === 'string' ? errObj.message : '') || (typeof rec?.message === 'string' ? rec.message : '') || `请求失败（HTTP ${resp.status}）`
      throw new Error(typeof msg === 'string' ? msg : '请求失败')
    }
    bumpLumiSysTokensFromChatResponse(data)
    return parseGeminiText(data)
  }

  const base = cfg.apiUrl.trim().replace(/\/+$/, '')
  const endpoint = /\/v1$/i.test(base)
    ? `${base}/chat/completions`
    : /\/v1\/chat\/completions$/i.test(base)
      ? base
      : `${base}/v1/chat/completions`
  const body: Record<string, unknown> = {
    model: cfg.modelId || undefined,
    messages,
    temperature: options?.temperature ?? 0.7,
  }
  if (options?.max_tokens != null) body.max_tokens = options.max_tokens
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data: unknown = await readFetchJsonBody(resp)
  if (!resp.ok) {
    const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
    const errObj = rec?.error && typeof rec.error === 'object' ? (rec.error as Record<string, unknown>) : null
    const msg = (typeof errObj?.message === 'string' ? errObj.message : '') || (typeof rec?.message === 'string' ? rec.message : '') || `请求失败（HTTP ${resp.status}）`
    throw new Error(typeof msg === 'string' ? msg : '请求失败')
  }
  bumpLumiSysTokensFromChatResponse(data)
  return parseOpenAiChoiceMessage(data)
}

export async function openAiCompatibleChat(
  cfg: ApiConfig,
  messages: OpenAiCompatibleMessage[],
  options?: { temperature?: number; max_tokens?: number },
): Promise<string> {
  // 文本链路也兼容 Gemini 原生 generateContent（避免 `contents is required`）
  if (isGeminiGenerateContentUrl(cfg.apiUrl)) {
    const endpoint = buildGeminiGenerateContentEndpoint(cfg)
    const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}key=${encodeURIComponent(cfg.apiKey)}`
    const text = extractGeminiUserTextFromOpenAiLikeMessages(messages as unknown[])
    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
      },
    }
    if (options?.max_tokens != null) {
      ;(body.generationConfig as Record<string, unknown>).maxOutputTokens = options.max_tokens
    }
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data: unknown = await readFetchJsonBody(resp)
    if (!resp.ok) {
      const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
      const errObj = rec?.error && typeof rec.error === 'object' ? (rec.error as Record<string, unknown>) : null
      const msg =
        (typeof errObj?.message === 'string' ? errObj.message : '') ||
        (typeof rec?.message === 'string' ? rec.message : '') ||
        `请求失败（HTTP ${resp.status}）`
      throw new Error(typeof msg === 'string' ? msg : '请求失败')
    }
    bumpLumiSysTokensFromChatResponse(data)
    return parseGeminiText(data)
  }

  const base = cfg.apiUrl.trim().replace(/\/+$/, '')
  const endpoint = /\/v1$/i.test(base) ? `${base}/chat/completions` : /\/v1\/chat\/completions$/i.test(base) ? base : `${base}/v1/chat/completions`
  const body: Record<string, unknown> = {
    model: cfg.modelId || undefined,
    messages,
    temperature: options?.temperature ?? 0.7,
  }
  if (options?.max_tokens != null) body.max_tokens = options.max_tokens
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data: unknown = await readFetchJsonBody(resp)
  if (!resp.ok) {
    const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
    const errObj = rec?.error && typeof rec.error === 'object' ? (rec.error as Record<string, unknown>) : null
    const msg = (typeof errObj?.message === 'string' ? errObj.message : '') || (typeof rec?.message === 'string' ? rec.message : '') || `请求失败（HTTP ${resp.status}）`
    throw new Error(typeof msg === 'string' ? msg : '请求失败')
  }
  bumpLumiSysTokensFromChatResponse(data)
  return parseOpenAiChoiceMessage(data)
}

export async function generateCharacterName(params: { apiConfig: ApiConfig | null; gender: string }): Promise<string> {
  const cfg = params.apiConfig
  if (!cfg || !cfg.apiUrl || !cfg.apiKey) throw new Error('未配置 AI API')
  const messages: ChatMessage[] = [
    { role: 'system', content: '你是中文起名助手。只输出一个2~3字中文姓名，不要解释。' },
    { role: 'user', content: `性别偏好：${params.gender}。生成一个小说风格、克制高级的2~3字中文姓名。` },
  ]
  return await openAiCompatibleChat(cfg, messages)
}

export async function generateCharacterBio(params: {
  apiConfig: ApiConfig | null
  character: Character
  identityContext?: PlayerIdentity | null
  /** 角色关联世界背景（次于世界书） */
  worldBackgroundPrompt?: string
}): Promise<string> {
  const cfg = params.apiConfig
  if (!cfg || !cfg.apiUrl || !cfg.apiKey) throw new Error('未配置 AI API')
  const c = params.character
  const charName = String(c.name ?? '').trim() || '该角色'
  const worldBookText = c.worldBooks
    .filter((w) => w.enabled)
    .map((w) => {
      const lines = w.items
        .filter((it) => it.enabled && String(it.content || '').trim())
        .map((it) =>
          formatWorldBookItemLineForPrompt({
            priority: it.priority,
            name: it.name,
            content: String(it.content).trim(),
            pronounGuide: it.pronounGuide,
            subjectName: charName,
            voice: 'character_card',
          }),
        )
        .join('\n')
      return lines ? `世界书「${w.name}」\n${lines}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000)

  if (!worldBookText.trim()) throw new Error('缺少世界书内容')

  const wbg = params.worldBackgroundPrompt?.trim()
  const messages: ChatMessage[] = [
    { role: 'system', content: '你是角色人设总结助手。请用第三人称，只输出一段不超过200字的中文总结，不要标题，不要分点。' },
    {
      role: 'user',
      content:
        `请根据下面的世界书条目内容，写出该角色的人设总结（第三人称，<=200字，信息完整且贴合人设，不矛盾）。若提供世界背景，须与世界背景及世界书同时自洽（冲突时以世界书为准）。\n\n` +
        `基础信息：姓名=${c.name || '未命名'}；微信昵称=${c.wechatNickname?.trim() || '未填'}；性别=${genderLabelZh(c.gender)}；年龄=${c.age ?? '未知'}；生日=${c.birthdayMD || '未知'}；星座=${c.zodiac || '未知'}；身份=${c.identity}；MBTI=${c.mbti || '未知'}。\n\n` +
        `操作者身份参考：姓名=${params.identityContext?.name || '你'}；职业/身份=${params.identityContext?.identity || '未设定'}；MBTI=${params.identityContext?.mbti || '未设定'}。\n\n` +
        (wbg ? `【世界背景】\n${wbg}\n\n` : '') +
        `世界书内容：\n${worldBookText}\n`,
    },
  ]
  return await openAiCompatibleChat(cfg, messages)
}

export async function generateCharacterOpeningLines(params: {
  apiConfig: ApiConfig | null
  character: Character
  identityContext?: PlayerIdentity | null
  worldBackgroundPrompt?: string
  /** 用户填写的本次生成偏向（语气/关系/禁忌等） */
  contentBias?: string
}): Promise<string> {
  const cfg = params.apiConfig
  if (!cfg || !cfg.apiUrl || !cfg.apiKey) throw new Error('未配置 AI API')
  const c = params.character
  const wbg = params.worldBackgroundPrompt?.trim()
  const bias = params.contentBias?.trim()
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        '你是微信角色开场白生成助手。只输出纯文本多行，不要标题、不要序号、不要解释。每一行代表一个独立聊天气泡，必须是角色视角（角色侧）对用户的开场内容。',
    },
    {
      role: 'user',
      content:
        `请为该角色生成 2~4 行微信开场白，每行 6~26 字，语气自然，贴合人设，可直接作为聊天首屏气泡。\n` +
        `硬性要求：\n` +
        `1) 每行都要像真实聊天，不要模板化欢迎词。\n` +
        `2) 禁止出现“我是AI/助手/模型”等出戏内容。\n` +
        `3) 行与行要有连贯感，但不要重复同义句。\n` +
        `4) 只输出多行正文，不要任何额外说明。\n\n` +
        (bias ? `本次生成偏向（最高优先级，必须遵守）：${bias}\n` : '') +
        `角色信息：姓名=${c.name || '未命名'}；性别=${genderLabelZh(c.gender)}；年龄=${c.age ?? '未知'}；身份=${c.identity || '未设定'}；MBTI=${c.mbti || '未知'}；` +
        `座右铭=${c.motto?.trim() || '未填'}；简介=${c.bio?.trim() || '未填'}。\n` +
        `操作者身份参考：姓名=${params.identityContext?.name || '你'}；职业/身份=${params.identityContext?.identity || '未设定'}；MBTI=${params.identityContext?.mbti || '未设定'}。\n` +
        (wbg ? `世界背景：${wbg.slice(0, 1200)}\n` : ''),
    },
  ]
  const text = await openAiCompatibleChat(cfg, messages, { temperature: 0.85, max_tokens: 420 })
  return text.trim()
}

export async function generateWorldBookItemContent(params: {
  character: Character
  worldBook: WorldBook
  item: WorldBookItem
  apiConfig: ApiConfig | null
  identityContext?: PlayerIdentity | null
  /**
   * 玩家身份编辑页：条目为「我」的第一人称自述，供用户带入聊天；禁用第三人称介绍。
   * 角色人设编辑页勿传（默认按小说式角色世界书写法）。
   */
  forPlayerIdentity?: boolean
  /** 目标汉字约数（含标点）；未传时按内置默认 */
  targetChineseChars?: number
  /** 角色关联世界背景（次于世界书条目优先级） */
  worldBackgroundPrompt?: string
  /** 同人脉下 NPC 摘要（仅小说式角色编辑页传入；玩家身份页勿传） */
  linkedNpcsContext?: string
}): Promise<string> {
  const cfg = params.apiConfig
  const forId = !!params.forPlayerIdentity
  const targetChars = clampWbItemGenTargetChars(params.targetChineseChars)

  const styleBlock =
    '\n【文风 — 必须遵守】\n' +
    '- 口语化大白话，像平时跟人聊天；短句优先，用词直白，能说明白就行。\n' +
    '- 不要为文采堆砌比喻、排比、对仗；少用「仿佛」「恰似」「氤氲」「缱绻」一类书面腔和莫名其妙的文雅修辞。\n' +
    '- 禁止无意义的升华、强行感慨、金句收尾或上价值；只写和本条标题、关键词直接相关的具体信息，别写空话。\n'

  const coherenceBlock =
    '\n【与已有条目及基础信息 — 必须遵守】\n' +
    '- 若上文列出了已有条目：通读后撰写；新正文不得与任一条在语义上重复，不得改头换面复述同一件事、同一句人设。\n' +
    '- 性格、态度、习惯等必须与已有条目一致，禁止打架（例如一条写我很冷静、另一条写我极易冲动热情）；若需涉及相近点，只能写不矛盾的补充或具体情境，不能推翻已有设定。\n' +
    '- 下方「基础信息」仅供事实与语气参考，不是正文提纲：禁止简历式/自我介绍式开场或主干，禁止逐条复读「我叫○○」「我○月○日生」「我是××座」「我今年○岁」等档案句式；需要时最多一笔带过，不得把已有档案当本条主要内容。\n'

  const baseHint = forId
    ? [
        '你在为「玩家身份」撰写世界书条目：正文是用户本人将在对话中带入的自我设定，必须是第一人称自述。',
        '',
        '【格式规定 — 必须全部遵守】',
        '- 全文第一人称：通篇用「我 / 我的 / 我会…」，像在写自己的备忘、独白或内心说明，不要换成旁观口吻。',
        '- 禁止第三人称：不得出现「他 / 她 / TA」「某人」「该身份」「这位…」「××（名字）是一名…」等介绍他人的写法；不要写「你觉得」「对方认为」这类把「我」客体化的句子。',
        '- 正文中禁止出现「玩家」二字。',
        '- 禁止自我介绍体：不要以「我叫XXX」「我是X月X日生的」「我是XX座」「我今年X岁」等把姓名生日星座年龄职业逐条陈述当开头或主体；这些在档案里已有，本条只写与「本条标题/关键词」直接相关、且上文已有条目中尚未写过的角度。',
        `- 总长度约 ${targetChars} 个汉字（含标点），允许略多略少但不要写成超长散文；与已有条目及基础信息逻辑一致；不要标题、不要分点罗列。`,
        '',
        '基础信息（仅作参考，勿写进正文当复述清单）：',
        `我对外使用的称呼：${params.character.name || '未填'}；微信/线上昵称：${params.character.wechatNickname?.trim() || '未填'}；性别：${genderLabelZh(params.character.gender)}；年龄：${params.character.age ?? '未知'}；职业/身份：${params.character.identity || '未填'}。`,
        `生日：${params.character.birthdayMD || '未知'}；星座：${params.character.zodiac || '未知'}；MBTI：${params.character.mbti || '未知'}。`,
        `兴趣：${(params.character.interests ?? []).filter(Boolean).join('、') || '未填'}；雷点：${(params.character.painPoints ?? []).filter(Boolean).join('、') || '未填'}。`,
        params.character.bio?.trim()
          ? `已有简介（可融入语气，勿整段复述）：${params.character.bio.trim().slice(0, 280)}`
          : '',
        `世界书名称：${params.worldBook.name}。`,
        `条目插入时机：${params.item.priority === 'before' ? '序言介入' : '尾声延展'}。`,
        `本条标题：${params.item.name}。关键词：${params.item.keywords || '无'}。`,
        '',
      ]
        .filter(Boolean)
        .join('\n')
    : [
        `你在为小说式角色建立世界书条目。请输出约 ${targetChars} 个汉字（含标点）的中文内容，连贯、不冲突、不突兀。`,
        '下列角色基础信息仅供参考，禁止在正文中做「我叫○」「生于○月○日」「○○座」式档案复读；只写本条主题相关且与已有条目不重复、不矛盾的内容。',
        `角色：${params.character.name || '未填'}，性别：${genderLabelZh(params.character.gender)}，年龄：${params.character.age ?? '未知'}，身份：${params.character.identity || '未填'}。`,
        `微信昵称（可与实名不同；已填写则文中称呼、人设须与之自洽，勿当词条复读）：${params.character.wechatNickname?.trim() || '未填'}。`,
        `生日：${params.character.birthdayMD || '未知'}，星座：${params.character.zodiac || '未知'}，MBTI：${params.character.mbti || '未知'}。`,
        `兴趣：${(params.character.interests ?? []).filter(Boolean).join('、') || '未填'}；雷点：${(params.character.painPoints ?? []).filter(Boolean).join('、') || '未填'}。`,
        params.character.motto?.trim() ? `座右铭（勿当正文复读）：${params.character.motto.trim().slice(0, 120)}` : '',
        params.character.wechatSignature?.trim()
          ? `微信个性签名（勿当正文复读）：${params.character.wechatSignature.trim().slice(0, 120)}`
          : '',
        params.character.bio?.trim()
          ? `已有简介（可融语气，勿整段复述）：${params.character.bio.trim().slice(0, 280)}`
          : '',
        `操作者身份参考：姓名=${params.identityContext?.name || '你'}，职业/身份=${params.identityContext?.identity || '未设定'}，MBTI=${params.identityContext?.mbti || '未设定'}。`,
        `世界书：${params.worldBook.name}。`,
        `条目优先级：${params.item.priority === 'before' ? '序言介入' : '尾声延展'}。`,
        `条目：${params.item.name}。`,
        `关键词：${params.item.keywords || '无'}。`,
        '',
      ]
        .filter(Boolean)
        .join('\n')

  const npcBlock =
    !forId && params.linkedNpcsContext?.trim() ? `\n${params.linkedNpcsContext.trim()}\n` : ''

  const pronounWriterNote = forId
    ? `\n【本条说明】只写玩家本人的经历、习惯、偏好等；不要写入对面人设角色的设定；可用第一人称「我」指自己。\n`
    : `\n【本条占位符】须使用「{{char}}」指该人设角色本人、「{{user}}」指该人设绑定的玩家身份本人；勿把角色设定与玩家身份混写；生成后注入会话时会替换为姓名。\n`

  const existingEntriesContext = buildExistingWorldBookEntriesContext({
    character: params.character,
    worldBook: params.worldBook,
    item: params.item,
  })
  const context = existingEntriesContext ? `${existingEntriesContext}\n` : ''

  const attitudeBookExtra =
    !forId && params.worldBook.name === '当前对你的态度'
      ? `【本条特殊要求】本条目属于「当前对你的态度」：第三人称旁白式叙述该角色对「你」的当前态度与相处体感；指涉操作者只用「你」，正文中禁止出现「玩家」二字；禁止第一人称台词、内心独白、书信体。叙述用直白口语化的旁白，不要文艺腔和空泛升华。须与上文已有条目中对「你」的态度、关系描述一致，勿矛盾、勿重复同义表述。\n`
      : ''

  if (!cfg || !cfg.apiUrl || !cfg.apiKey) throw new Error('未配置 AI API')

  const systemContent = forId
    ? '你是世界书写作助手。为「玩家本人身份」写条目：只输出正文，不要标题、不要分点；通篇第一人称「我」，禁止第三人称。勿复述档案式姓名生日星座；勿与已有条目重复或矛盾。文风口语化，忌文雅堆砌与无意义升华。'
    : '你是世界书写作助手。只输出正文，不要标题、不要分点。勿档案式自我介绍；勿与已有条目重复或矛盾。文风口语化、像说明事实，忌文艺腔和空泛升华。'

  const wbgBlock = params.worldBackgroundPrompt?.trim()
    ? `\n【世界背景参考（次于本条与角色已有世界书；勿与世界书矛盾）】\n${params.worldBackgroundPrompt.trim()}\n`
    : ''

  const maxTokens = Math.min(4096, Math.max(200, Math.ceil(targetChars * 3.2)))
  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    {
      role: 'user',
      content: `${baseHint}${pronounWriterNote}${npcBlock}${context}${coherenceBlock}${wbgBlock}${styleBlock}${attitudeBookExtra}请生成本条目的正文内容。`,
    },
  ]
  return await openAiCompatibleChat(cfg, messages, { max_tokens: maxTokens })
}

export type WechatProfileRow = {
  characterId: string
  wechatNickname: string
  wechatSignature: string
  wechatId: string
  motto: string
}

function parseJsonObjectFromModelText(text: string): Record<string, unknown> {
  const t = text.trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/i
  const m = t.match(fence)
  const raw = (m ? m[1] : t).trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型未返回可解析的 JSON 对象')
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
}

const WECHAT_NICK_MAX = 12
const WECHAT_SIG_MAX = 22
const MOTTO_MAX = 15

function clampNick(s: string, max = WECHAT_NICK_MAX): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) : t
}

function nicknameIsLegalNameClone(nick: string, c: Character): boolean {
  const name = (c.name || '').trim()
  if (!name || !nick) return false
  if (nick === name) return true
  if (name.length >= 2 && nick === name.slice(0, 2)) return true
  if (name.length > 1 && nick.length === 1 && /^[\u4e00-\u9fff]$/.test(nick) && name.startsWith(nick)) return true
  return false
}

function isPlausibleWechatNickname(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length >= 1 && t.length <= WECHAT_NICK_MAX
}

function clampSig(s: string, max = WECHAT_SIG_MAX): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) : t
}

function clampMotto(s: string, max = MOTTO_MAX): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) : t
}

/** 6–20 位小写英文+数字+下划线；过短则补后缀，禁止纯数字（微信人设与遇见 NPC 共用） */
export function normalizeWechatId(raw: string, seed: string): string {
  let s = raw.toLowerCase().replace(/[^a-z0-9_]/g, '')
  if (s.length > 20) s = s.slice(0, 20)
  const pad = () => {
    let h = 0
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
    const n = 100000 + (h % 899990)
    return `wx_${n}`.slice(0, 20)
  }
  if (s.length < 6) s = pad()
  if (/^\d+$/.test(s)) s = pad()
  if (s.length < 6) s = pad()
  return s.slice(0, 20)
}

const WECHAT_PROFILE_JSON_SYSTEM = `你是「贴人设专用」的微信资料生成器。只输出一个 JSON 对象，禁止 Markdown、禁止解释、禁止代码块外壳。
键名固定：profiles（数组）。每个元素必须含 characterId（与输入完全一致）、nickname、signature、wechatId、motto。profiles 条数与输入角色数相同，characterId 一一对应。

【最高优先级】所有内容必须 100% 贴合该角色的性别、年龄、职业/身份、性格、世界背景与世界书设定；禁止生成与人设矛盾的内容。

【核心】完全模仿 2026 年真实网友的微信风格：拒绝模板化、拒绝鸡汤、拒绝「完美人设」；允许普通人的小粗糙、小情绪、小随意，像真人刚随手改的。

通用规则（必须遵守）：
- 拒绝过于精致/文艺/正能量腔；签名可以口语、半句话、极简留白，甚至可以略带语病或随意感（符合真人习惯）。
- 拒绝明显过时的网络梗与签名模板（不要用 2025 及更早烂大街梗硬套）。
- 禁止烂格式：如「XX 的小世界」「XX 的日常」「热爱生活」类。
- 签名偏情绪快照、生活碎片、一句吐槽、摆烂/佛系、留白；不要长篇格言。
- 按年龄松弛度：偏年轻可更跳脱、缩写感稍多；23–30 更吐槽上班与留白；30+ 更简洁克制。
- 按身份：学生偏课业/吃喝玩乐；上班族偏摸鱼/下班/咖啡；自由职业偏时间与灵感；特殊职业要带职业痕迹（值班、学生等）但口语化。

微信 nickname（输出到 JSON 的 nickname 字段）：
- 以 2～6 个字为主，最多不超过 8 个字（必要时可极短单字意象，如「雾」「眠」，但必须与人设气质相符，且禁止用角色「姓名」本字直出或仅姓氏单字偷懒）。
- 禁止把角色档案里的「姓名」原样或明显缩写成全名当昵称；可做谐音梗/反差，但不能等于实名。
- 风格参考：小众意象（海盐、山风、落日、便利店）、状态（摸鱼中、下班了、喝奶茶）、反向表达（不开心、别烦我）、中英碎片（如 bug 与中文混用要短）；可带极简符号 . _ - 之一，不要堆表情。
- 禁止：小仙女/小哥哥/小姐姐、XX的猫/XX的狗、过长英文句、火星文与花哨符号。
- 硬约束：nickname 不得为空、不得为 null、不得缺失字段；若拿不准也必须给出一个合规昵称，绝不能留空。

微信 signature（输出到 JSON 的 signature 字段）：
角色定位：当代赛博社交观察家 & 高级文案策划。
- 每个角色只生成 1 条 signature（单字符串），禁止输出候选、编号、多版本。
- 必须严格贴合该角色人设（身份、年龄、性格、关系状态、世界书语境），像这个人真的会挂在微信资料里的那一句。
- 风格基调（2026 社交语境）：
  1) 赛博禅意：可融合科技词与哲理/自然意象（如云端、频段、404、波长、像素、光合作用），但要自然，不生硬堆词。
  2) 高级克制：短句、留白、低饱和表达；拒绝土味鸡汤、喊口号、夸张卖惨、过度抒情。
  3) 精神状态外化：允许高级丧、反内耗、冷感清醒、收敛版发疯文学，但必须“像真人随手改的一句状态”。
- 结构要求：优先 8～15 字，最长不超过 ${WECHAT_SIG_MAX} 字；一句话，不换行，不加序号。
- 语气要求：自我陈述型（可第一人称），禁止对读者/对话对象发号施令（如“你要…/别…/请…”）。
- 禁止项：照搬示例、套模板（如“热爱生活”“做最好的自己”）、泛化空话、与角色设定冲突的内容。
- 参考审美方向（仅风格，不可复用原句）：隐喻、留白、轻哲思、微观情绪切片。
- 以下是个性签名的风格示例（只用于风格参考；照搬任一句视为严重违规，必须重写）：
  劫灰深处，自生春、错落一身宁静深海浮沉摘星、做暗处的光，不必等待火炬、等你读懂我的隐喻、
  气味 音乐 声音都是时光机、Tearsvow、请将我逝去的镌刻入乐谱 成为世界的绝弦、
  悸动是像夏日含在唇齿间的青柠气泡水、我說我愛你,你回答ditto。、眼泪是否比雪花轻、
  没事 睡门永存、心平能愈三千疾、不萌则已 一萌惊人^ω^、人生荒芜，所以春天周而复始。

座右铭 motto（输出到 JSON 的 motto 字段）：
- 必须贴合该角色人设、身份与世界观，像角色会认同的一句短句。
- 长度 4～15 个字，不得超过 15 个字。
- 禁止空话套话、鸡汤模板、与角色设定矛盾。
- 不要使用引号、书名号、emoji。可口语化，但要自然。

微信 wechatId（输出到 JSON 的 wechatId 字段）：
- 6～20 个字符，仅小写 a-z、数字 0-9、下划线 _；禁止纯数字；禁止11 位手机号。
- 禁止 iloveyou、520、1314 等烂大街示爱数字梗；不要大写字母。`

export async function generateWechatProfilesForPersonaCharacters(params: {
  apiConfig: ApiConfig | null
  characters: Character[]
}): Promise<WechatProfileRow[]> {
  const cfg = params.apiConfig
  if (!cfg || !cfg.apiUrl || !cfg.apiKey) throw new Error('未配置 AI API')
  const list = params.characters
  if (!list.length) return []

  const blocks = list.map((c) => {
    const wb = c.worldBooks
      .filter((w) => w.enabled)
      .flatMap((w) => w.items.filter((it) => it.enabled && String(it.content || '').trim()))
      .map((it) => `${it.name}：${String(it.content).trim()}`)
      .join('\n')
      .slice(0, 1800)
    return [
      `characterId（必须原样回传）：${c.id}`,
      `姓名：${c.name || '未命名'}`,
      `性别/年龄：${genderLabelZh(c.gender)} / ${c.age ?? '未知'}`,
      `身高：${(c.height || '').slice(0, 30) || '未填'}`,
      `体重：${(c.weight || '').slice(0, 30) || '未填'}`,
      `身份：${c.identity}`,
      `MBTI：${c.mbti || '未知'}`,
      `人设摘要：${(c.bio || '').slice(0, 500)}`,
      `座右铭（为空时请你生成，且 <=15字）：${(c.motto || '').slice(0, 120) || '未填'}`,
      c.interests?.length ? `兴趣：${c.interests.join('、')}` : '',
      c.painPoints?.length ? `雷点：${c.painPoints.join('、')}` : '',
      wb ? `世界书节选：\n${wb}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  })

  const messages: ChatMessage[] = [
    { role: 'system', content: WECHAT_PROFILE_JSON_SYSTEM },
    {
      role: 'user',
      content:
        `下列共 ${list.length} 名角色。请为每名生成一套微信昵称、个性签名、微信号、座右铭（写入 JSON profiles）。\n` +
        `再次强调：nickname 绝对不能等于该角色的「姓名」原文，也不要仅用姓氏单字敷衍；要网感、像 2026 年真人。\n` +
        `signature 必须是资料页「自我展示」独白：禁止对「你/您」说话、禁止叮嘱说教读者（如别抽了、多喝水、照顾好自己）；可改用第一人称状态描述。\n\n` +
        `signature 只允许每个角色输出 1 条，不要 5 条候选，不要 A/B 方案。\n\n` +
        blocks.map((b, i) => `【角色 ${i + 1}】\n${b}`).join('\n\n---\n\n'),
    },
  ]

  const text = await openAiCompatibleChat(cfg, messages)
  const parsed = parseJsonObjectFromModelText(text)
  const profilesRaw = parsed['profiles']
  const rows: unknown[] = Array.isArray(profilesRaw) ? profilesRaw : []

  const byId = new Map<string, WechatProfileRow>()
  const invalidReasons: string[] = []
  for (const it of rows) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const characterId = typeof o.characterId === 'string' ? o.characterId.trim() : ''
    const ch = list.find((x) => x.id === characterId)
    const nickname = typeof o.nickname === 'string' ? clampNick(o.nickname) : ''
    if (!characterId) continue
    if (!ch) {
      invalidReasons.push(`未知角色ID: ${characterId}`)
      continue
    }
    if (!isPlausibleWechatNickname(nickname)) {
      invalidReasons.push(`${ch.name || characterId} 昵称为空或长度非法`)
      continue
    }
    if (nicknameIsLegalNameClone(nickname, ch)) {
      invalidReasons.push(`${ch.name || characterId} 昵称与姓名重复`)
      continue
    }
    const signature = typeof o.signature === 'string' ? clampSig(o.signature) : ''
    const motto = typeof o.motto === 'string' ? clampMotto(o.motto) : ''
    const widIn = typeof o.wechatId === 'string' ? o.wechatId : ''
    let wechatId = normalizeWechatId(widIn, characterId)
    if (/iloveyou|1314|(^|_)520(_|$)|^520|520$/.test(wechatId)) wechatId = normalizeWechatId('', characterId)
    byId.set(characterId, {
      characterId,
      wechatNickname: nickname,
      wechatSignature: signature || '—',
      wechatId,
      motto,
    })
  }

  const missing = list.filter((c) => !byId.has(c.id))
  if (missing.length || invalidReasons.length) {
    const missText = missing.length
      ? `缺失角色：${missing.map((c) => c.name || c.id).join('、')}`
      : ''
    const badText = invalidReasons.length ? `无效项：${invalidReasons.join('；')}` : ''
    const detail = [missText, badText].filter(Boolean).join('；')
    throw new Error(`AI 微信资料生成不完整，请重试。${detail}`)
  }

  return list.map((c) => byId.get(c.id)!)
}
