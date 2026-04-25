import type { NarrativeGenOptions } from './types'

/**
 * AI Prompt：文风调教（注入到约会续写的 **system** 末尾，与 `lumiThinkingChainRules` 导出的 DATING_STYLE_SYSTEM_PROMPT 拼接）。
 *
 * 当用户在「文风设定」中填写 stylePrompt / referenceSnippet 并在点击「发送」时通过
 * `NarrativeGenOptions` 传入 `generateDatingAi`，此处生成以下结构（与产品文档一致）：
 *
 * 【写作风格约束】
 * 必须严格遵循以下文风：${stylePrompt}
 *
 * 【参考笔触学习】
 * 请深入分析并精准模仿以下片段的行文节奏、用词习惯、感官描写方式和句式结构。
 * 你的回复必须让人觉得是出自同一作者之手：
 * """${referenceSnippet}"""
 */
export function buildDatingStyleSystemAppend(gen?: NarrativeGenOptions): string {
  const stylePrompt = gen?.stylePrompt?.trim()
  const referenceSnippet = gen?.referenceSnippet?.trim()
  if (!stylePrompt && !referenceSnippet) return ''

  const parts: string[] = []
  if (stylePrompt) {
    parts.push(
      `【写作风格约束】\n接下来请推进剧情。请严格遵循以下文风：${stylePrompt}`,
    )
  }
  if (referenceSnippet) {
    parts.push(
      `【参考笔触学习】\n你可以参考以下文本的笔触和行文节奏进行模仿；并尽量让输出在句式密度、标点节奏与用词习惯上与之一致：\n"""${referenceSnippet}"""`,
    )
  }
  return `\n\n${parts.join('\n\n')}`
}
