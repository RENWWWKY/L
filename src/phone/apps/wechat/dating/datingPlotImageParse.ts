/** 解析剧情配图模型输出：<imgthink> 自动剥离，<image> 提取 tag prompt */

export type DatingPlotImageParseResult = {
  /** 剥离后的思维链（不展示给用户，可供调试） */
  imgThinks: string[]
  /** 清洗后的英文 tag prompts */
  prompts: string[]
}

const IMG_THINK_RE = /<imgthink>([\s\S]*?)<\/imgthink>/gi
const IMAGE_BLOCK_RE = /<image>([\s\S]*?)<\/image>/gi
const IMAGE_HASH_RE = /image###([\s\S]*?)###/gi

/** 移除所有 imgthink 块，得到「可见段」 */
export function stripDatingPlotImgThinkBlocks(raw: string): string {
  return String(raw ?? '')
    .replace(IMG_THINK_RE, '')
    .replace(/<\/?imgthink>/gi, '')
    .trim()
}

export function parseDatingPlotImageModelOutput(
  raw: string,
  expectedCount: number,
): DatingPlotImageParseResult {
  const cap = Math.max(1, Math.min(6, Math.round(expectedCount)))
  const text = String(raw ?? '').trim()
  if (!text) return { imgThinks: [], prompts: [] }

  const imgThinks: string[] = []
  for (const m of text.matchAll(new RegExp(IMG_THINK_RE.source, 'gi'))) {
    const body = m[1]?.trim()
    if (body) imgThinks.push(body)
  }

  const prompts: string[] = []

  for (const m of text.matchAll(new RegExp(IMAGE_BLOCK_RE.source, 'gi'))) {
    const tag = extractTagsFromImageInner(m[1] ?? '')
    if (tag) prompts.push(tag)
  }

  if (!prompts.length) {
    for (const m of text.matchAll(new RegExp(IMAGE_HASH_RE.source, 'gi'))) {
      const tag = extractTagsFromHashBlock(m[1] ?? '')
      if (tag) prompts.push(tag)
    }
  }

  const visible = stripDatingPlotImgThinkBlocks(text)
  if (!prompts.length) {
    prompts.push(...parsePromptsFromJsonFallback(visible))
  }

  if (!prompts.length) {
    const lines = visible
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && /^[a-z0-9]/i.test(l) && l.includes(','))
    prompts.push(...lines)
  }

  const cleaned = prompts
    .map((p) => sanitizePlotImagePrompt(p))
    .filter(Boolean)
    .slice(0, cap)

  return { imgThinks, prompts: cleaned }
}

function extractTagsFromImageInner(inner: string): string {
  let s = inner.trim()
  if (!s) return ''
  s = s.replace(/^【[^】\]]+】\s*/m, '')
  if (/image###/i.test(s)) return extractTagsFromHashBlock(s)
  if (/Scene Composition:/i.test(s) || /Character\s*\d*\s*Prompt:/i.test(s)) {
    return extractTagsFromHashBlock(s)
  }
  s = s.replace(/^image###/i, '').replace(/###\s*$/i, '')
  return s.replace(/\n+/g, ', ').trim()
}

function extractTagsFromHashBlock(block: string): string {
  const parts: string[] = []
  const scene = /Scene Composition:\s*([^;]+)/i.exec(block)
  if (scene?.[1]?.trim()) parts.push(scene[1].trim())
  const charPrompt = /Character\s*\d*\s*Prompt:\s*([^;]+)/i.exec(block)
  if (charPrompt?.[1]?.trim()) parts.push(charPrompt[1].trim())
  if (parts.length) return parts.join(', ')
  return block
    .replace(/Scene Composition:/gi, '')
    .replace(/Character\s*\d*\s*Prompt:/gi, '')
    .replace(/Character\s*\d*\s*UC:/gi, '')
    .replace(/image###/gi, '')
    .replace(/###/g, '')
    .replace(/;/g, ',')
    .replace(/\n+/g, ', ')
    .trim()
}

function parsePromptsFromJsonFallback(visible: string): string[] {
  const jsonMatch = /\{[\s\S]*\}/.exec(visible)
  if (!jsonMatch) return []
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { prompts?: unknown }
    if (!Array.isArray(parsed.prompts)) return []
    return parsed.prompts.map((p) => String(p ?? '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

/** 清洗模型偶发输出的禁用风格词与格式残留 */
export function sanitizePlotImagePrompt(prompt: string): string {
  let s = prompt.trim()
  if (!s) return ''
  s = s.replace(/<\/?imgthink>/gi, '')
  s = s.replace(/<\/?image>/gi, '')
  s = s.replace(/image###[\s\S]*?###/gi, '')
  s = s.replace(/\|centers:[^;]+;?/gi, '')
  const banned =
    /\b(masterpiece|best quality|absurdres|aesthetic|8k|ultra detailed|photorealistic|realistic photo|anime style|illustration style)\b/gi
  s = s.replace(banned, '')
  s = s.replace(/\s*,\s*,+/g, ', ').replace(/^,\s*/, '').replace(/\s*,$/, '')
  return s.replace(/\s+/g, ' ').trim()
}
