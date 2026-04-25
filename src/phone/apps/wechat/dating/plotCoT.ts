/**
 * 约会剧情：从模型整段返回中拆分「思维链 / 规划摘要 / 正文」。
 * 供存盘（DatingContext）与展示兜底（DatingStoryPage）共用。
 */

export const DATING_COT_TAG_PATTERNS: RegExp[] = [
  /<thinking\b[^>]*>([\s\S]*?)<\/thinking>/i,
  /** 少数网关/模型误用短闭合标签 */
  /<thinking\b[^>]*>([\s\S]*?)<\/think>/i,
  /<redacted_thinking\b[^>]*>([\s\S]*?)<\/redacted_thinking>/i,
  /** DeepSeek 等：think … think（与 <thinking> 区分：\<think\b 不会匹配 \<thinking） */
  /<think\b[^>]*>([\s\S]*?)<\/think>/i,
  /<logicpass\b[^>]*>([\s\S]*?)<\/logicpass>/i,
  /<reasoning\b[^>]*>([\s\S]*?)<\/reasoning>/i,
]

/** 全角尖括号、常见误输入，避免整段无法匹配 */
function normalizeCoTAngleBrackets(s: string): string {
  return s.replace(/\uFF1C/g, '<').replace(/\uFF1E/g, '>').replace(/＜/g, '<').replace(/＞/g, '>')
}

function stripFirstCoTBlock(src: string): { inner: string; rest: string } | null {
  for (const re of DATING_COT_TAG_PATTERNS) {
    const m = src.match(re)
    if (m && m.index !== undefined) {
      return {
        inner: (m[1] || '').trim(),
        rest: (src.slice(0, m.index) + src.slice(m.index + m[0].length)).trim(),
      }
    }
  }
  return null
}

/** 接口截断或模型漏写闭合标签时，整段无法被非贪婪正则匹配 */
function stripUnclosedThinkingBlock(src: string): { inner: string; rest: string } | null {
  if (/<\/thinking>/i.test(src)) return null
  const open = /<thinking\b[^>]*>/i.exec(src)
  if (!open || open.index === undefined) return null
  const after = src.slice(open.index + open[0].length).trim()
  if (!after) return null
  return { inner: after, rest: '' }
}

function stripLeadingMarkdownCoT(src: string): { inner: string; rest: string } | null {
  const m = src.match(/^\s*```(?:thinking|reasoning|cot)?\s*\n([\s\S]*?)```\s*/i)
  if (!m || m.index === undefined) return null
  return {
    inner: (m[1] || '').trim(),
    rest: (src.slice(0, m.index) + src.slice(m.index + m[0].length)).trim(),
  }
}

/**
 * @returns logicPass 思维链正文（无外层标签）；planSummary 旧版一行摘要；content 纯剧情正文
 */
export function splitDatingAssistantOutput(raw: string): {
  logicPass: string
  planSummary: string
  content: string
} {
  let text = normalizeCoTAngleBrackets(String(raw || '').trim())
  let logicPass = ''

  const first = stripFirstCoTBlock(text)
  if (first) {
    logicPass = first.inner
    text = first.rest
  }
  if (!logicPass) {
    const md = stripLeadingMarkdownCoT(text)
    if (md?.inner) {
      logicPass = md.inner
      text = md.rest
    }
  }
  if (!logicPass) {
    const unclosed = stripUnclosedThinkingBlock(text)
    if (unclosed) {
      logicPass = unclosed.inner
      text = unclosed.rest
    }
  }

  const legacy = text.match(/^\s*【规划摘要】\s*([^\n]{1,160})\s*(?:\r?\n)+([\s\S]*)$/)
  let planSummary = ''
  let content = text
  if (legacy) {
    planSummary = legacy[1].trim()
    content = (legacy[2] || '').trim() || text
  } else {
    content = text
  }
  const bodyTrim = content.trim()
  const original = String(raw || '').trim()
  const finalContent = bodyTrim || (logicPass || planSummary ? '' : original)
  return { logicPass, planSummary, content: finalContent }
}
