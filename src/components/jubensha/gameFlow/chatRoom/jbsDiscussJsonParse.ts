/** 从模型原始输出中解析讨论 beats JSON（含截断修复） */

function unescapeJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string
  } catch {
    return raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
}

/** 逐条提取完整的 beat 对象（应对 max_tokens 截断） */
export function salvageDiscussBeatsFromText(raw: string): Record<string, unknown>[] {
  const beats: Record<string, unknown>[] = []
  const re =
    /\{\s*"speaker"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"action"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"line"\s*:\s*"((?:\\.|[^"\\])*)"\s*\}/gu
  const reNoAction =
    /\{\s*"speaker"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"line"\s*:\s*"((?:\\.|[^"\\])*)"\s*\}/gu

  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    beats.push({
      speaker: unescapeJsonString(m[1]!),
      action: unescapeJsonString(m[2]!),
      line: unescapeJsonString(m[3]!),
    })
  }
  if (beats.length > 0) return beats

  while ((m = reNoAction.exec(raw)) !== null) {
    beats.push({
      speaker: unescapeJsonString(m[1]!),
      line: unescapeJsonString(m[2]!),
    })
  }
  return beats
}

function extractJsonObjectCandidate(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()

  const start = trimmed.indexOf('{')
  if (start < 0) return trimmed
  return trimmed.slice(start)
}

/** 截断在数组中途时，保留最后一个完整 beat 并补全括号 */
function repairTruncatedBeatsJson(candidate: string): string {
  let s = candidate.trim()
  if (!s.startsWith('{')) return s

  const lastCompleteBeat = s.lastIndexOf('},')
  if (lastCompleteBeat > 0) {
    s = s.slice(0, lastCompleteBeat + 1)
  } else {
    const lastBrace = s.lastIndexOf('}')
    if (lastBrace > 0 && !s.trimEnd().endsWith('}')) {
      s = s.slice(0, lastBrace + 1)
    }
  }

  s = s.replace(/,\s*$/, '')

  let braces = 0
  let brackets = 0
  for (const ch of s) {
    if (ch === '{') braces += 1
    else if (ch === '}') braces -= 1
    else if (ch === '[') brackets += 1
    else if (ch === ']') brackets -= 1
  }
  for (let i = 0; i < brackets; i += 1) s += ']'
  for (let i = 0; i < braces; i += 1) s += '}'
  return s
}

export function parseDiscussAiRoot(raw: string): Record<string, unknown> | null {
  const candidate = extractJsonObjectCandidate(raw)
  if (!candidate) return null

  const attempts = [candidate, repairTruncatedBeatsJson(candidate)]
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt)
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>
      }
    } catch {
      /* try next */
    }
  }

  const salvaged = salvageDiscussBeatsFromText(raw)
  if (salvaged.length > 0) {
    return { beats: salvaged, _salvaged: true }
  }
  return null
}
