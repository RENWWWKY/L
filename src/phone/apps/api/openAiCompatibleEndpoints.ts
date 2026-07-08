/** OpenAI 兼容接口常见版本后缀，如 /v1、/v4 */
const OPENAI_API_VERSION_SUFFIX_RE = /\/v\d+$/i

function trimApiBase(apiUrl: string): string {
  return apiUrl.trim().replace(/\/+$/, '')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 将用户填写的 API 根地址拼成 OpenAI 兼容子路径（chat/completions、models、embeddings 等）。
 * - 已含完整子路径（含 /v4/chat/completions）→ 原样返回
 * - 以 /v1、/v4 等版本后缀结尾 → 追加 `/{resource}`
 * - 仅域名根 → 默认补 `/v1/{resource}`
 */
export function buildOpenAiCompatibleEndpoint(
  apiUrl: string,
  resource: string,
  defaultVersion = 'v1',
): string {
  const base = trimApiBase(apiUrl)
  if (!base) return ''

  const resourcePath = resource.replace(/^\/+/, '')
  const fullSuffix = `/${resourcePath}`
  if (base.endsWith(fullSuffix)) return base

  const versionedFullRe = new RegExp(`/v\\d+/${escapeRegExp(resourcePath)}$`, 'i')
  if (versionedFullRe.test(base)) return base

  if (OPENAI_API_VERSION_SUFFIX_RE.test(base)) return `${base}${fullSuffix}`

  return `${base}/${defaultVersion}${fullSuffix}`
}

export function buildOpenAiChatCompletionsEndpoint(apiUrl: string): string {
  const base = trimApiBase(apiUrl)
  if (!base) return ''
  if (base.endsWith('/completions') && !base.endsWith('/chat/completions')) return base
  return buildOpenAiCompatibleEndpoint(base, 'chat/completions')
}

export function buildOpenAiModelsEndpoint(apiUrl: string): string {
  return buildOpenAiCompatibleEndpoint(apiUrl, 'models')
}

export function buildOpenAiEmbeddingsEndpoint(apiUrl: string): string {
  return buildOpenAiCompatibleEndpoint(apiUrl, 'embeddings')
}

export function buildOpenAiImagesGenerationsEndpoint(apiUrl: string): string {
  return buildOpenAiCompatibleEndpoint(apiUrl, 'images/generations')
}

export function buildOpenAiImagesEditsEndpoint(apiUrl: string): string {
  return buildOpenAiCompatibleEndpoint(apiUrl, 'images/edits')
}

/** 自定义中转：Gemini 原生图模走 /v1beta/models/{model}:generateContent */
export function buildGeminiGenerateContentEndpoint(apiUrl: string, modelName: string): string {
  const base = trimApiBase(apiUrl)
  if (!base) return ''
  if (/:generateContent$/i.test(base)) return base

  let root = base
  if (OPENAI_API_VERSION_SUFFIX_RE.test(root)) {
    root = root.replace(/\/v\d+$/i, '/v1beta')
  } else if (!/\/v1beta$/i.test(root)) {
    root = `${root}/v1beta`
  }

  return `${root}/models/${encodeURIComponent(modelName)}:generateContent`
}

export function buildOpenAiAudioTranscriptionsEndpoint(apiUrl: string): string {
  return buildOpenAiCompatibleEndpoint(apiUrl, 'audio/transcriptions')
}
