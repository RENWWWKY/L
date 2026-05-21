/** 将模型 API 原始错误转为「新的朋友」场景下的可读说明（勿直接 alert 英文服务端报错） */
export function formatFriendRequestApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const lower = raw.toLowerCase()

  if (
    lower.includes('disk overloaded') ||
    (lower.includes('disk') && lower.includes('threshold')) ||
    lower.includes('磁盘') ||
    lower.includes('disk full')
  ) {
    return '模型 API 服务端磁盘已满，暂时无法处理好友申请。请稍后重试，或联系 API 服务商清理/扩容磁盘（与遇见、微信功能本身无关）。'
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')) {
    return '请求过于频繁，请稍后再试。'
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('网络')
  ) {
    return '网络请求失败，请检查 API 地址、密钥与网络连接后重试。'
  }
  if (lower.includes('unauthorized') || lower.includes('401') || lower.includes('invalid api key')) {
    return 'API 密钥无效或未授权，请在 API 设置中检查配置。'
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('超时')) {
    return '请求超时，请稍后重试。'
  }
  if (lower.includes('cors')) {
    return '浏览器无法访问 API（可能被 CORS 拦截），请检查代理或 API 网关配置。'
  }

  const trimmed = raw.trim()
  if (!trimmed) return '对方回复失败，请稍后重试。'
  if (trimmed.length > 160) return `${trimmed.slice(0, 160)}…`
  return trimmed
}
