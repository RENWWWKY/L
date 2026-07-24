/**
 * 心语稳定 markup（替换易碎 JSON）。
 * 单聊：[HEART_WHISPER] + 字段行；群聊：[HEART_WHISPER_GROUP] + 多段 [角色]。
 * 解析侧仍兼容旧 JSON，避免旧会话/模型偶发回退失败。
 */

export type HeartWhisperFields = {
  location: string
  action: string
  outfit: string
  innerThoughts: string
  userImpression: string
}

export type GroupHeartWhisperEntry = {
  character_id: string
  location: string
  clothing: string
  posture: string
  monologue: string
  impression_on_user: string
}

const PRIVATE_BLOCK_RE =
  /\[HEART_WHISPER\](?![_\w])\s*([\s\S]*?)(?=\n\s*\[HEART_WHISPER_GROUP\]|$)/i
const GROUP_BLOCK_RE = /\[HEART_WHISPER_GROUP\]\s*([\s\S]*)$/i
const ROLE_SPLIT_RE = /(?:^|\n)\s*\[角色\]\s*/i

export const WECHAT_HEART_WHISPER_MARKUP_FORMAT = `
【输出格式】禁止 JSON、禁止 markdown 代码围栏、禁止前后解释或思维链标签外露。只输出下列 markup（字段名须保留）：

[HEART_WHISPER]
地点：（简短；此刻具体地点，结合当前剧情）
动作：（简短；此刻一个微小或具体的肢体动作）
着装：（简短；此刻穿着）
内心：（第一人称内心独白；可多行。基于刚才的回复延伸未说出口的想法；直白、不加修饰）
对用户看法：（第三人称；客观描述此刻对 User 的看法或感觉；可多行。禁止 ta，须用外部给定的「他」或「她」）
`.trim()

export const WECHAT_GROUP_HEART_WHISPER_MARKUP_FORMAT = `
【输出格式】禁止 JSON、禁止 markdown 代码围栏、禁止前后解释。只输出下列 markup：

[HEART_WHISPER_GROUP]
[角色]
id：（必须与名单中的 character_id 完全一致）
地点：（简短）
着装：（简短）
姿态：（简短；动作或姿态）
内心：（第一人称独白；可多行；直白陈述）
对你看法：（转述句式：npc_pronoun + 觉得/认为 + 你 + …；禁止用户真名；可多行）
[角色]
id：…
地点：…
着装：…
姿态：…
内心：…
对你看法：…

【硬性要求】
- [角色] 段数必须等于名单 NPC 人数；每人恰好一段，不得遗漏 id，不得多出名单外的 id。
- id 必须与名单一致（大小写一致）。
- 所有字段不得为空；信息不足时用简短合理占位，禁止写 null。
`.trim()

function stripModelFences(raw: string): string {
  return String(raw ?? '')
    .replace(/^```(?:json|markdown|text|xml)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

/** 推理模型常在 </thinking> 之后才输出正文 */
function thinkingAwareSearchBases(raw: string): string[] {
  const fenced = stripModelFences(String(raw ?? '').trim())
  if (!fenced) return ['']
  const closeTag = '</thinking>'
  const idx = fenced.lastIndexOf(closeTag)
  const ordered: string[] = []
  if (idx >= 0) {
    const tail = fenced.slice(idx + closeTag.length).trim()
    if (tail) ordered.push(tail)
  }
  ordered.push(fenced)
  return [...new Set(ordered)]
}

function fieldLine(block: string, keys: string[]): string {
  const lines = block.split(/\r?\n/)
  for (const key of keys) {
    const re = new RegExp(`^\\s*${key}\\s*[:：]\\s*(.*)$`, 'i')
    for (const line of lines) {
      const m = re.exec(line.trim())
      if (!m) continue
      return (m[1] ?? '').trim()
    }
  }
  return ''
}

function multilineAfter(block: string, keys: string[]): string {
  const lines = block.split(/\r?\n/)
  const keyRe = new RegExp(`^\\s*(?:${keys.join('|')})\\s*[:：]\\s*(.*)$`, 'i')
  const stopRe =
    /^\s*(?:地点|动作|着装|姿态|内心|对用户看法|对你看法|id|character_id|location|action|outfit|clothing|posture|inner_thoughts|view_on_user|impression_on_user|monologue)\s*[:：]/i
  for (let i = 0; i < lines.length; i++) {
    const m = keyRe.exec(lines[i]!.trim())
    if (!m) continue
    const parts: string[] = []
    const first = (m[1] ?? '').trim()
    if (first) parts.push(first)
    for (let j = i + 1; j < lines.length; j++) {
      const raw = lines[j]!
      const t = raw.trim()
      if (!t) {
        parts.push('')
        continue
      }
      if (stopRe.test(t) && !keyRe.test(t)) break
      if (/^\[角色\]/i.test(t) || /^\[HEART_WHISPER/i.test(t)) break
      parts.push(raw)
    }
    return parts.join('\n').replace(/\n+$/g, '').trim()
  }
  return ''
}

function txt(v: unknown): string {
  return String(v ?? '').trim()
}

function parsePrivateMarkupBlock(block: string): HeartWhisperFields | null {
  const location = fieldLine(block, ['地点', 'location'])
  const action = fieldLine(block, ['动作', 'action', '姿态', 'posture'])
  const outfit = fieldLine(block, ['着装', 'outfit', 'clothing', '服装'])
  const innerThoughts =
    multilineAfter(block, ['内心', '内心独白', 'inner_thoughts', 'innerThoughts', 'monologue']) ||
    fieldLine(block, ['内心', '内心独白', 'inner_thoughts', 'innerThoughts'])
  const userImpression =
    multilineAfter(block, [
      '对用户看法',
      '对你看法',
      'view_on_user',
      'userImpression',
      'impression_on_user',
    ]) ||
    fieldLine(block, ['对用户看法', '对你看法', 'view_on_user', 'userImpression'])

  if (!location && !action && !outfit && !innerThoughts && !userImpression) return null
  return { location, action, outfit, innerThoughts, userImpression }
}

function parseGroupRoleBlock(block: string): GroupHeartWhisperEntry | null {
  const character_id = fieldLine(block, ['id', 'character_id', 'charId', 'characterId'])
  if (!character_id) return null
  const location = fieldLine(block, ['地点', 'location'])
  const clothing = fieldLine(block, ['着装', 'clothing', 'outfit', '服装'])
  const posture = fieldLine(block, ['姿态', '动作', 'posture', 'action'])
  const monologue =
    multilineAfter(block, ['内心', '内心独白', 'monologue', 'inner_thoughts']) ||
    fieldLine(block, ['内心', '内心独白', 'monologue', 'inner_thoughts'])
  const impression_on_user =
    multilineAfter(block, ['对你看法', '对用户看法', 'impression_on_user', 'view_on_user']) ||
    fieldLine(block, ['对你看法', '对用户看法', 'impression_on_user', 'view_on_user'])
  return { character_id, location, clothing, posture, monologue, impression_on_user }
}

function parsePrivateFromMarkup(raw: string): HeartWhisperFields | null {
  for (const base of thinkingAwareSearchBases(raw)) {
    if (!/\[HEART_WHISPER\]/i.test(base) && !/地点\s*[:：]/.test(base)) continue
    const m = PRIVATE_BLOCK_RE.exec(base)
    const block = (m?.[1] ?? base).trim()
    const parsed = parsePrivateMarkupBlock(block)
    if (parsed) return parsed
  }
  return null
}

function parseGroupFromMarkup(raw: string): GroupHeartWhisperEntry[] | null {
  for (const base of thinkingAwareSearchBases(raw)) {
    if (!/\[HEART_WHISPER_GROUP\]/i.test(base) && !/\[角色\]/i.test(base)) continue
    const m = GROUP_BLOCK_RE.exec(base)
    const body = (m?.[1] ?? base).trim()
    const chunks = body.split(ROLE_SPLIT_RE).map((s) => s.trim()).filter(Boolean)
    const out: GroupHeartWhisperEntry[] = []
    for (const chunk of chunks) {
      // 去掉可能残留的块头
      const cleaned = chunk.replace(/^\[HEART_WHISPER_GROUP\]\s*/i, '').trim()
      const entry = parseGroupRoleBlock(cleaned)
      if (entry) out.push(entry)
    }
    if (out.length) return out
  }
  return null
}

/** 旧 JSON 回退：单聊 */
function parsePrivateFromJson(raw: string): HeartWhisperFields | null {
  for (const base of thinkingAwareSearchBases(raw)) {
    const start = base.indexOf('{')
    if (start < 0) continue
    let depth = 0
    let inStr = false
    let esc = false
    let end = -1
    for (let i = start; i < base.length; i += 1) {
      const c = base[i]!
      if (inStr) {
        if (esc) {
          esc = false
          continue
        }
        if (c === '\\') {
          esc = true
          continue
        }
        if (c === '"') inStr = false
        continue
      }
      if (c === '"') {
        inStr = true
        continue
      }
      if (c === '{') depth += 1
      else if (c === '}') {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    const jsonText =
      end > start ? base.slice(start, end + 1) : (() => {
        const e = base.lastIndexOf('}')
        return e > start ? base.slice(start, e + 1) : ''
      })()
    if (!jsonText) continue
    try {
      const j = JSON.parse(jsonText) as Record<string, unknown>
      return {
        location: txt(j.location),
        action: txt(j.action),
        outfit: txt(j.outfit),
        innerThoughts: txt(j.inner_thoughts ?? j.innerThoughts),
        userImpression: txt(j.view_on_user ?? j.userImpression),
      }
    } catch {
      /* try next base */
    }
  }
  return null
}

/** 旧 JSON 回退：群聊 */
function parseGroupFromJson(raw: string): GroupHeartWhisperEntry[] | null {
  for (const base of thinkingAwareSearchBases(raw)) {
    const start = base.indexOf('{')
    if (start < 0) continue
    let depth = 0
    let inStr = false
    let esc = false
    let end = -1
    for (let i = start; i < base.length; i += 1) {
      const c = base[i]!
      if (inStr) {
        if (esc) {
          esc = false
          continue
        }
        if (c === '\\') {
          esc = true
          continue
        }
        if (c === '"') inStr = false
        continue
      }
      if (c === '"') {
        inStr = true
        continue
      }
      if (c === '{') depth += 1
      else if (c === '}') {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    const jsonText =
      end > start ? base.slice(start, end + 1) : (() => {
        const e = base.lastIndexOf('}')
        return e > start ? base.slice(start, e + 1) : ''
      })()
    if (!jsonText) continue
    try {
      const j = JSON.parse(jsonText) as { entries?: unknown }
      const arr = Array.isArray(j.entries) ? j.entries : []
      const out: GroupHeartWhisperEntry[] = []
      for (const it of arr) {
        const o = (it ?? {}) as Record<string, unknown>
        const cid = txt(o.character_id ?? o.charId ?? o.characterId)
        if (!cid) continue
        out.push({
          character_id: cid,
          location: txt(o.location),
          clothing: txt(o.clothing ?? o.outfit),
          posture: txt(o.posture ?? o.action),
          monologue: txt(o.monologue ?? o.inner_thoughts),
          impression_on_user: txt(o.impression_on_user ?? o.view_on_user),
        })
      }
      if (out.length) return out
    } catch {
      /* try next */
    }
  }
  return null
}

export function parseHeartWhisperOutput(raw: string): HeartWhisperFields {
  const markup = parsePrivateFromMarkup(raw)
  if (markup) return markup
  const json = parsePrivateFromJson(raw)
  if (json) return json
  throw new Error('心语解析失败：模型返回可能混入了思维链、截断或非约定 markup。请重试或更换模型。')
}

export function parseGroupHeartWhisperOutput(raw: string): GroupHeartWhisperEntry[] {
  const markup = parseGroupFromMarkup(raw)
  if (markup?.length) return markup
  const json = parseGroupFromJson(raw)
  if (json?.length) return json
  throw new Error('群聊心语解析失败：模型返回可能混入了思维链、截断或非约定 markup。请重试或更换模型。')
}
