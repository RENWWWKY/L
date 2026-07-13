/** generateContent 失败时，是否值得改走 OpenAI 兼容 /images/generations */
export function shouldRetryGeminiImageViaGenerations(message: string): boolean {
  const msg = message.trim()
  if (!msg) return false
  return (
    /upstream error|do request failed|failed to fetch|network|timeout|timed out|502|503|504/i.test(msg) ||
    /not found|404|invalid url|unknown path|unsupported.*endpoint|route not found/i.test(msg) ||
    /generateContent|responseModalities|contents is required|systemInstruction/i.test(msg)
  )
}

/** /images/generations 失败时，是否值得改走 Gemini generateContent */
export function shouldRetryGeminiImageViaGenerateContent(message: string): boolean {
  const msg = message.trim()
  if (!msg) return false
  return (
    /only imagen models are supported|not supported model for image generation|unsupported model/i.test(msg) ||
    /images\/generations|image generation is not supported|does not support.*image/i.test(msg) ||
    /generateContent|responseModalities|gemini.*image.*preview/i.test(msg)
  )
}

export function mergeGeminiImageRouteErrors(primary: unknown, secondary: unknown): Error {
  const a = primary instanceof Error ? primary.message : String(primary ?? '')
  const b = secondary instanceof Error ? secondary.message : String(secondary ?? '')
  if (a && b) return new Error(`${a}（已自动尝试备用路径：${b}）`)
  return primary instanceof Error ? primary : new Error(a || b || '生图失败')
}
