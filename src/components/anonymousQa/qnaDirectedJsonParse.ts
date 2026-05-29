function repairJsonLikeText(text: string): string {
  return text
    .replace(/[\u201c\u201d\u2018\u2019]/g, '"')
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

/** 从模型原文中解析 JSON（兼容 ```json 包裹、前后废话、轻微语法瑕疵） */
export function parseModelJsonPayload(text: string): unknown | null {
  const candidates: string[] = []
  const t = text.trim()
  if (t) candidates.push(t)

  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/gi)
  if (fenced) {
    for (const block of fenced) {
      const inner = block.replace(/```(?:json)?/i, '').replace(/```$/, '').trim()
      if (inner) candidates.push(inner)
    }
  }

  const objStart = t.indexOf('{')
  const objEnd = t.lastIndexOf('}')
  if (objStart >= 0 && objEnd > objStart) {
    candidates.push(t.slice(objStart, objEnd + 1))
  }

  const arrStart = t.indexOf('[')
  const arrEnd = t.lastIndexOf(']')
  if (arrStart >= 0 && arrEnd > arrStart) {
    candidates.push(t.slice(arrStart, arrEnd + 1))
  }

  for (const raw of candidates) {
    for (const attempt of [raw, repairJsonLikeText(raw)]) {
      try {
        return JSON.parse(attempt) as unknown
      } catch {
        /* next */
      }
    }
  }

  return null
}

export function extractRepliesArray(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return null
  const o = payload as Record<string, unknown>
  for (const key of ['replies', 'reply', 'comments', 'data', 'messages']) {
    if (Array.isArray(o[key])) return o[key] as unknown[]
  }
  return null
}

/** 解析互动连击 JSON；失败返回 null */
export function parseInteractionRepliesFromRaw(raw: string): unknown[] | null {
  const payload = parseModelJsonPayload(raw)
  const replies = extractRepliesArray(payload)
  if (replies?.length) return replies

  // 兜底：从文本中抠出 "replies": [...] 段（仍来自模型输出，非本地台词）
  const block = raw.match(/"replies"\s*:\s*(\[[\s\S]*\])/i)?.[1]
  if (block) {
    for (const attempt of [block, repairJsonLikeText(block)]) {
      try {
        const arr = JSON.parse(attempt) as unknown
        if (Array.isArray(arr) && arr.length) return arr
      } catch {
        /* continue */
      }
    }
  }

  return null
}

export function describeInteractionParseFailure(raw: string): string {
  const t = raw.trim()
  if (!t) return '模型返回为空，请检查 API 或稍后重试'
  if (!t.includes('{') && !t.includes('[')) {
    return '模型返回了纯文本而非 JSON。已切换为 JSON 专用请求，请再试一次'
  }
  if (parseModelJsonPayload(t) && !extractRepliesArray(parseModelJsonPayload(t)!)) {
    return 'JSON 已解析但缺少 replies 数组，请重试'
  }
  return '模型返回的 JSON 无法解析，请重试或更换指令遵循更好的模型'
}
