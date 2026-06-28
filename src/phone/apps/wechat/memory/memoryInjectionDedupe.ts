/** 判断「尚未总结」块是否含足够实质内容（供其它模块判断注入质量）。 */

const MIN_UNSUMMARIZED_BODY_CHARS = 80

function stripInjectionFooter(raw: string): string {
  return String(raw ?? '')
    .replace(/（↑[\s\S]*$/m, '')
    .replace(/【说话人[\s\S]*$/m, '')
    .trim()
}

export function hasMeaningfulUnsummarizedBlock(raw: string | undefined | null): boolean {
  const body = stripInjectionFooter(String(raw ?? ''))
  if (body.length < MIN_UNSUMMARIZED_BODY_CHARS) return false
  const lines = body.split('\n').filter((l) => l.trim().startsWith('- '))
  return lines.length >= 2 || body.length >= MIN_UNSUMMARIZED_BODY_CHARS + 40
}

/**
 * 「最近 N 轮参考」与「尚未总结」块内容重叠，已统一只注入后者；
 * 历史剧情语义命中由本地 worker 的 context vector 召回补充。
 */
export function dedupeUnsummarizedVsRecentAiRounds(params: {
  unsummarized: string
  recentAiRounds: string
}): { unsummarized: string; recentAiRounds: string } {
  return { unsummarized: params.unsummarized.trim(), recentAiRounds: '' }
}
