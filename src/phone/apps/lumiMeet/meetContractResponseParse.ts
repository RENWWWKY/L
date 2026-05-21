/** 缔结契约：解析模型在正文最前输出的 <contract_response>…</contract_response>，并从可见文本中剔除 */

export type MeetContractActionType = 'char_add_user' | 'user_add_char' | 'none'

export type MeetContractDecision = 'agree' | 'reject'

export type MeetContractParsed = {
  decision: MeetContractDecision
  actionType: MeetContractActionType
  /** 模型可在契约块内显式给出，便于卡片展示（避免 action_type 漏填导致无微信号） */
  explicitWechatId?: string
}

const CONTRACT_BLOCK = /<contract_response\b[^>]*>([\s\S]*?)<\/contract_response>/i

function normToken(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function parseInner(inner: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = inner.match(re)
  return (m?.[1] ?? '').trim()
}

export function stripMeetContractResponseBlock(raw: string): {
  parsed: MeetContractParsed | null
  bodyForBubbles: string
} {
  const src = String(raw ?? '')
  const m = src.match(CONTRACT_BLOCK)
  if (!m) return { parsed: null, bodyForBubbles: src.trim() }
  const inner = m[1] ?? ''
  const decRaw = normToken(parseInner(inner, 'decision'))
  const actRaw = normToken(parseInner(inner, 'action_type'))
  const decision: MeetContractDecision = decRaw === 'agree' ? 'agree' : 'reject'
  let actionType: MeetContractActionType = 'none'
  if (actRaw === 'char_add_user' || actRaw === 'char-add-user') actionType = 'char_add_user'
  else if (actRaw === 'user_add_char' || actRaw === 'user-add-char') actionType = 'user_add_char'
  const wxExplicit =
    parseInner(inner, 'wechat_id').trim() ||
    parseInner(inner, 'wechat-id').trim() ||
    parseInner(inner, 'char_wechat_id').trim()
  const explicitWechatId = wxExplicit.replace(/\s+/g, '') || undefined
  const bodyForBubbles = src.replace(m[0], '').trim()
  return { parsed: { decision, actionType, explicitWechatId }, bodyForBubbles }
}

function extractWechatId(text: string): string | null {
  const m = /(?:微信号|微信|加我)[：:\s]*([A-Za-z][A-Za-z0-9_]{3,19})/.exec(text)
  const id = (m?.[1] ?? '').trim()
  return /^[A-Za-z0-9_]{4,20}$/.test(id) ? id : null
}

export function pickWechatFromNpcPlainText(text: string): string | null {
  const flat = text.replace(/\s+/g, ' ')
  const a = extractWechatId(flat)
  if (a) return a
  const m = flat.match(/\bLm_[A-Za-z0-9_]{2,18}\b/i)
  if (m?.[0] && /^[A-Za-z0-9_]{4,20}$/.test(m[0])) return m[0]
  const g = flat.match(/\b([A-Za-z][A-Za-z0-9_]{3,19})\b/)
  return g?.[1] && /^[A-Za-z0-9_]{4,20}$/.test(g[1]) ? g[1] : null
}
