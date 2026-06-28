import type { ApiConfig } from '../../api/types'
import type { MemorySettingsRow } from '../newFriendsPersona/types'
import {
  DEFAULT_MEMORY_EMBEDDING_MODEL,
  fetchEmbeddingVector,
  fetchEmbeddingVectorsBatch,
  resolveEmbeddingApiCredentials,
} from './memoryEmbeddingApi'
import {
  embedTextWithLocalModel,
  embedTextsWithLocalModel,
  testLocalEmbeddingConnection,
} from './localEmbeddingClient'
import { DEFAULT_LOCAL_EMBEDDING_MODEL, normalizeLocalEmbeddingModelId } from './memoryEmbeddingConstants'

export { DEFAULT_LOCAL_EMBEDDING_MODEL }

export type MemoryEmbeddingProviderKind = 'local' | 'api'
export type MemoryEmbeddingProviderMode = 'api' | 'local' | 'auto'

export type ResolvedEmbeddingVector = {
  vec: number[]
  provider: MemoryEmbeddingProviderKind
  modelId: string
}

export function resolveMemoryEmbeddingProviderMode(settings: MemorySettingsRow): MemoryEmbeddingProviderMode {
  const raw = settings.memoryEmbeddingProviderMode
  if (raw === 'api' || raw === 'local' || raw === 'auto') return raw
  return 'auto'
}

export function resolveLocalEmbeddingModelId(settings: MemorySettingsRow): string {
  return normalizeLocalEmbeddingModelId(settings.memoryLocalEmbeddingModelId)
}

export function resolveApiEmbeddingModelId(
  settings: MemorySettingsRow,
  override?: string | null,
): string {
  const o = override?.trim()
  if (o) return o
  const s = settings.memoryEmbeddingModelId?.trim()
  if (s) return s
  return DEFAULT_MEMORY_EMBEDDING_MODEL
}

/** 向量召回是否可用（本地模式无需 API Key） */
export function isMemoryEmbeddingAvailable(
  settings: MemorySettingsRow,
  chatFallback: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null | undefined,
): boolean {
  const mode = resolveMemoryEmbeddingProviderMode(settings)
  if (mode === 'local') return true
  const cred = resolveEmbeddingApiCredentials(settings, chatFallback ?? null)
  if (mode === 'api') return Boolean(cred?.apiUrl?.trim() && cred?.apiKey?.trim())
  return true
}

async function embedWithApi(
  settings: MemorySettingsRow,
  chatFallback: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null | undefined,
  texts: string[],
  modelOverride?: string | null,
): Promise<ResolvedEmbeddingVector[]> {
  const cred = resolveEmbeddingApiCredentials(settings, chatFallback ?? null)
  if (!cred?.apiUrl?.trim() || !cred.apiKey?.trim()) {
    throw new Error('embedding_api_not_configured')
  }
  const modelId = resolveApiEmbeddingModelId(settings, modelOverride)
  if (texts.length === 1) {
    const vec = await fetchEmbeddingVector(cred, texts[0], modelId)
    return [{ vec, provider: 'api', modelId }]
  }
  const vecs = await fetchEmbeddingVectorsBatch(cred, texts, modelId)
  return vecs.map((vec) => ({ vec, provider: 'api', modelId }))
}

async function embedWithLocal(texts: string[], modelId: string): Promise<ResolvedEmbeddingVector[]> {
  const vecs = texts.length === 1 ? [await embedTextWithLocalModel(texts[0], modelId)] : await embedTextsWithLocalModel(texts, modelId)
  return vecs.map((vec) => ({ vec, provider: 'local', modelId }))
}

export async function fetchEmbeddingVectorsUnified(
  settings: MemorySettingsRow,
  chatFallback: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null | undefined,
  texts: string[],
  modelOverride?: string | null,
): Promise<ResolvedEmbeddingVector[]> {
  const trimmed = texts.map((t) => String(t ?? '').trim()).filter(Boolean)
  if (!trimmed.length) return []
  const mode = resolveMemoryEmbeddingProviderMode(settings)
  const localModelId = resolveLocalEmbeddingModelId(settings)

  if (mode === 'local') {
    return embedWithLocal(trimmed, localModelId)
  }
  if (mode === 'api') {
    return embedWithApi(settings, chatFallback, trimmed, modelOverride)
  }

  try {
    return await embedWithLocal(trimmed, localModelId)
  } catch {
    return embedWithApi(settings, chatFallback, trimmed, modelOverride)
  }
}

export async function fetchEmbeddingVectorUnified(
  settings: MemorySettingsRow,
  chatFallback: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null | undefined,
  text: string,
  modelOverride?: string | null,
): Promise<ResolvedEmbeddingVector | null> {
  const t = String(text ?? '').trim()
  if (!t) return null
  const [one] = await fetchEmbeddingVectorsUnified(settings, chatFallback, [t], modelOverride)
  return one ?? null
}

export async function testMemoryEmbeddingConnectionUnified(
  settings: MemorySettingsRow,
  chatFallback: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null | undefined,
  modelOverride?: string | null,
): Promise<{ ok: true; dimensions: number; provider: MemoryEmbeddingProviderKind } | { ok: false; message: string }> {
  const mode = resolveMemoryEmbeddingProviderMode(settings)

  if (mode === 'local') {
    const r = await testLocalEmbeddingConnection(resolveLocalEmbeddingModelId(settings))
    return r.ok ? { ok: true, dimensions: r.dimensions, provider: 'local' } : r
  }

  if (mode === 'api') {
    const cred = resolveEmbeddingApiCredentials(settings, chatFallback ?? null)
    if (!cred) return { ok: false, message: '未配置向量 API' }
    const { testMemoryEmbeddingConnection } = await import('./memoryEmbeddingApi')
    const modelId = resolveApiEmbeddingModelId(settings, modelOverride)
    const r = await testMemoryEmbeddingConnection(cred, modelId)
    return r.ok ? { ok: true, dimensions: r.dimensions, provider: 'api' } : r
  }

  const localTry = await testLocalEmbeddingConnection(resolveLocalEmbeddingModelId(settings))
  if (localTry.ok) return { ok: true, dimensions: localTry.dimensions, provider: 'local' }

  const cred = resolveEmbeddingApiCredentials(settings, chatFallback ?? null)
  if (!cred) return localTry
  const { testMemoryEmbeddingConnection } = await import('./memoryEmbeddingApi')
  const modelId = resolveApiEmbeddingModelId(settings, modelOverride)
  const apiTry = await testMemoryEmbeddingConnection(cred, modelId)
  return apiTry.ok ? { ok: true, dimensions: apiTry.dimensions, provider: 'api' } : apiTry
}
