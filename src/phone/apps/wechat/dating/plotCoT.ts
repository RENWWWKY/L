/**
 * 约会剧情：从模型整段返回中拆分「思维链 / 规划摘要 / 正文」。
 * 供存盘（DatingContext）与展示兜底（DatingStoryPage）共用。
 */

import { stripVnVoiceParamsPayload } from './vnVoiceParamsStrip'

import type { PlotItem } from './types'
import { getAiPlotVersionSlices } from './plotVersions'

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

/**
 * 去掉「内心 OS」里仅有省略号/语气占位的 **…** 块（如 **我……**），避免固定前缀与旁白断裂。
 * 星号内一旦出现叙事汉字（呃、好、别等以外的实质内容）即保留。
 */
function stripEllipsisOnlyOsSpans(s: string): string {
  return String(s || '').replace(/\*\*([\s\S]*?)\*\*/g, (full, inner: string) => {
    const t = String(inner ?? '').trim()
    if (!t) return ''
    const withoutLeadingWo = t.replace(/^我\s*/, '')
    const substantive = withoutLeadingWo.replace(/[.。⋯…\s\d，,、；;:!！?？…]/gu, '')
    if (substantive.length === 0 && t.length <= 20) return ''
    return full
  })
}

function stripHtmlComments(s: string): string {
  return s.replace(/<!--[\s\S]*?-->/g, '').trim()
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

/**
 * 接口截断或模型漏写闭合标签时，非贪婪正则匹配不到，`stripFirstCoTBlock` 会跳过。
 * 旧逻辑：把 `<thinking>` 之后**整段**当思维链 → 正文恒为空，界面变成「剧情进思维链、字数 0」。
 * 现改为：仅在与「典型分册思维链」体量一致时才吞掉；过长或不像分册结构则放弃本条路径，避免误吞正文。
 */
/** VN/普通约会剧情标签，不应计入 Lumi 分册思维链的【】计数 */
const VN_OR_PLOT_SCENE_BRACKET_RE =
  /^【\s*(?:旁白|对白|内心|心声|OS|os|VN语音参数|VN语音参数结束)(?:\s*[｜|][^】]*)?\s*】$/u

function countLumiStyleCoTMarkers(text: string): number {
  const brackets = text.match(/【[^】]{2,120}】/g) || []
  return brackets.filter((b) => !VN_OR_PLOT_SCENE_BRACKET_RE.test(String(b).trim())).length
}

function stripUnclosedThinkingBlock(src: string): { inner: string; rest: string } | null {
  if (/<\/thinking>/i.test(src)) return null
  const open = /<thinking\b[^>]*>/i.exec(src)
  if (!open || open.index === undefined) return null
  const after = src.slice(open.index + open[0].length).trim()
  if (!after) return null
  if (after.length > 4200) return null
  const lumiMarkers = countLumiStyleCoTMarkers(after)
  const plotSceneTags = (after.match(/【\s*(?:旁白|对白|内心|心声|OS|os)\b/gu) || []).length
  /** 未闭合 thinking 里若是 VN 剧情（旁白/对白等），整段当正文，避免主区域空白、字数只在折叠里 */
  if (plotSceneTags >= 1 && lumiMarkers < 2) return null
  if (after.length > 700 && lumiMarkers < 2) return null
  if (lumiMarkers < 2 && after.length < 4500) return null
  return { inner: after, rest: '' }
}

/** 是否像 Lumi 分册式思维链（用于区分「真思维链」与误塞进 thinking 的正文） */
function looksLikeStructuredCoT(s: string): boolean {
  const t = String(s || '').trim()
  if (!t) return false
  const lumiMarkers = countLumiStyleCoTMarkers(t)
  const plotSceneTags = (t.match(/【\s*(?:旁白|对白|内心|心声|OS|os)\b/gu) || []).length
  if (plotSceneTags >= 2 && lumiMarkers < 2) return false
  if (t.length < 160) return lumiMarkers >= 1
  if (lumiMarkers >= 3) return true
  if (/【\s*Lumi终检单\s*】|终检单】|【\s*篇幅/.test(t)) return true
  return false
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
  let bodyTrim = stripEllipsisOnlyOsSpans(stripHtmlComments(content))
  const original = String(raw || '').trim()
  let finalContent = bodyTrim || (logicPass || planSummary ? '' : original)

  // 正文被剥空但 logicPass 很长且不像分册思维链：多为模型把剧情写在 thinking 内或未闭合误匹配 —— 回落为正文展示，避免 0 字与「全文只在折叠里」。
  if (!finalContent.trim() && logicPass.trim()) {
    const lp = logicPass.trim()
    if (!looksLikeStructuredCoT(lp) && lp.length > 35) {
      finalContent = stripEllipsisOnlyOsSpans(stripHtmlComments(lp))
      logicPass = ''
    }
  }

  finalContent = finalContent.replace(/\n?【本节梗概】\s*[^\n]{0,400}\s*$/u, '').trimEnd()

  return { logicPass, planSummary, content: finalContent }
}

/** 注入 prompt / 游标前原文向量索引：剥离全部思维链块（含正文中间的 `<thinking>`） */
export function stripAllCoTBlocksFromDatingText(text: string): string {
  let s = normalizeCoTAngleBrackets(String(text || '').trim())
  if (!s) return ''
  for (let i = 0; i < 16; i++) {
    const first = stripFirstCoTBlock(s)
    if (first) {
      s = first.rest.trim()
      continue
    }
    const unclosed = stripUnclosedThinkingBlock(s)
    if (unclosed) {
      s = unclosed.rest.trim()
      continue
    }
    break
  }
  return stripEllipsisOnlyOsSpans(stripHtmlComments(s)).trim()
}

/** 约会 plot 写入 prompt / 语义召回索引的正文（玩家原文保留；AI 去思维链与 VN 语音参数） */
export function datingPlotBodyForPromptInjection(raw: string, plotType: 'player' | 'ai'): string {
  const rawStr = String(raw || '').trim()
  if (!rawStr) return ''
  if (plotType === 'player') return rawStr
  const prose = splitDatingAssistantOutput(rawStr).content.trim()
  const sansVn = stripVnVoiceParamsPayload(prose).trim()
  const stripped = stripAllCoTBlocksFromDatingText(sansVn)
  return stripped || sansVn
}

/** 思维溯源 / 主界面展示：与 split 规则一致，并剥离 VN 语音参数块 */
export function resolveDatingAssistantDisplayText(raw: string): {
  thinkingText: string
  displayBody: string
} {
  const sp = splitDatingAssistantOutput(raw)
  let thinkingText = (sp.logicPass || sp.planSummary || '').trim()
  let displayBody = stripVnVoiceParamsPayload(sp.content)
  if (!displayBody.trim() && thinkingText.trim()) {
    const lp = thinkingText.trim()
    if (!looksLikeStructuredCoT(lp) && lp.length > 35) {
      displayBody = stripVnVoiceParamsPayload(lp)
      thinkingText = ''
    }
  }
  return { thinkingText, displayBody }
}

/** StoryBlock 展示：优先当前版本正文，并与 resolveDatingAssistantDisplayText 对齐 */
export function resolveDatingPlotDisplayFromItem(plot: PlotItem): {
  thinkingText: string
  displayBody: string
} {
  if (plot.type !== 'ai') {
    return { thinkingText: '', displayBody: String(plot.content || '') }
  }
  const { body } = getAiPlotVersionSlices(plot)
  const raw = String(body || plot.content || '').trim()
  const storedCoT = plot.logicPass?.trim()
  const resolved = resolveDatingAssistantDisplayText(raw)
  let thinkingText =
    (storedCoT || resolved.thinkingText || plot.planSummary?.trim() || '').trim()
  let displayBody = resolved.displayBody
  if (!displayBody.trim() && thinkingText.trim()) {
    const promoted = resolveDatingAssistantDisplayText(thinkingText)
    if (promoted.displayBody.trim()) {
      displayBody = promoted.displayBody
      if (!looksLikeStructuredCoT(thinkingText)) thinkingText = promoted.thinkingText
    }
  }
  return { thinkingText, displayBody }
}
