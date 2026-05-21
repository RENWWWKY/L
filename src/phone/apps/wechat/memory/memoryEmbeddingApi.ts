import type { ApiConfig } from '../../api/types'
import type { MemorySettingsRow } from '../newFriendsPersona/types'

/** 与 OpenAI 兼容接口默认对齐；可在记忆设置里覆盖 */
export const DEFAULT_MEMORY_EMBEDDING_MODEL = 'text-embedding-3-small'

/**
 * 解析向量请求用的 url / key：记忆设置中的「专用」项优先，缺省回落到聊天 `apiConfig`。
 */
export function resolveEmbeddingApiCredentials(
  settings: MemorySettingsRow,
  chatFallback: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null | undefined,
): { apiUrl: string; apiKey: string } | null {
  const useDedicated = settings.memoryEmbeddingUseDedicatedApi === true
  const dedicatedUrl = useDedicated ? settings.memoryEmbeddingApiUrl?.trim() : ''
  const dedicatedKey = useDedicated ? settings.memoryEmbeddingApiKey?.trim() : ''
  const url = (dedicatedUrl || chatFallback?.apiUrl?.trim() || '').trim()
  const key = (dedicatedKey || chatFallback?.apiKey?.trim() || '').trim()
  if (!url || !key) return null
  return { apiUrl: url, apiKey: key }
}

function embeddingsEndpoint(apiUrl: string): string {
  const base = apiUrl.trim().replace(/\/+$/, '')
  if (/\/v1$/i.test(base)) return `${base}/embeddings`
  if (/\/v1\/embeddings$/i.test(base)) return base
  return `${base}/v1/embeddings`
}

function normalizeEmbeddingArray(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || !raw.length) return null
  const out: number[] = []
  for (const x of raw) {
    const n = typeof x === 'number' ? x : Number(x)
    if (!Number.isFinite(n)) return null
    out.push(n)
  }
  return out.length ? out : null
}

/** 单条文本 → 向量（失败抛错，由调用方 try/catch） */
export async function fetchEmbeddingVector(
  cfg: Pick<ApiConfig, 'apiUrl' | 'apiKey'>,
  text: string,
  modelId: string,
): Promise<number[]> {
  const t = String(text ?? '').trim()
  if (!t) throw new Error('embedding_empty_text')
  const url = embeddingsEndpoint(cfg.apiUrl)
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId.trim() || DEFAULT_MEMORY_EMBEDDING_MODEL,
      input: t.slice(0, 12000),
    }),
  })
  const data = (await resp.json()) as {
    error?: { message?: string }
    message?: string
    data?: { embedding?: unknown; index?: number }[]
  }
  if (!resp.ok) {
    const msg = data?.error?.message ?? data?.message ?? `embedding HTTP ${resp.status}`
    throw new Error(typeof msg === 'string' ? msg : 'embedding_failed')
  }
  const emb = normalizeEmbeddingArray(data?.data?.[0]?.embedding)
  if (!emb) throw new Error('embedding_bad_response')
  return emb
}

/**
 * 批量请求 embedding（同一模型）；返回与 `texts` 同序的向量数组。
 * 单条失败则整批抛错。
 */
export async function fetchEmbeddingVectorsBatch(
  cfg: Pick<ApiConfig, 'apiUrl' | 'apiKey'>,
  texts: string[],
  modelId: string,
): Promise<number[][]> {
  const trimmed = texts.map((s) => String(s ?? '').trim().slice(0, 12000))
  if (!trimmed.length) return []
  const url = embeddingsEndpoint(cfg.apiUrl)
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId.trim() || DEFAULT_MEMORY_EMBEDDING_MODEL,
      input: trimmed.length === 1 ? trimmed[0] : trimmed,
    }),
  })
  const data = (await resp.json()) as {
    error?: { message?: string }
    message?: string
    data?: { embedding?: unknown; index?: number }[]
  }
  if (!resp.ok) {
    const msg = data?.error?.message ?? data?.message ?? `embedding HTTP ${resp.status}`
    throw new Error(typeof msg === 'string' ? msg : 'embedding_failed')
  }
  const rows = Array.isArray(data?.data) ? data.data : []
  const sorted = [...rows].sort((a, b) => (Number(a?.index) || 0) - (Number(b?.index) || 0))
  if (sorted.length !== trimmed.length) {
    // 部分代理只返回单条时兜底
    if (trimmed.length === 1 && sorted[0]) {
      const one = normalizeEmbeddingArray(sorted[0]?.embedding)
      if (one) return [one]
    }
    throw new Error('embedding_batch_length_mismatch')
  }
  return sorted.map((row) => {
    const v = normalizeEmbeddingArray(row?.embedding)
    if (!v) throw new Error('embedding_bad_row')
    return v
  })
}

/** 发一条最短文本探测 embeddings 是否可用，返回向量维度或错误信息 */
export async function testMemoryEmbeddingConnection(
  cfg: Pick<ApiConfig, 'apiUrl' | 'apiKey'>,
  modelId: string,
): Promise<{ ok: true; dimensions: number } | { ok: false; message: string }> {
  try {
    const vec = await fetchEmbeddingVector(cfg, 'ping', modelId)
    if (!vec.length) return { ok: false, message: '返回向量为空' }
    return { ok: true, dimensions: vec.length }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}
