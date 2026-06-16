import { fetchModels } from '../../api/apiSim'
import type { ApiConfig } from '../../api/types'
import { personaDb } from '../newFriendsPersona/idb'
import type { MemorySettingsRow } from '../newFriendsPersona/types'

/** 解析自动总结请求用的 url / key：专用副接口开启时仅走专用项，否则走聊天 `apiConfig`。 */
export function resolveSummaryApiCredentials(
  settings: MemorySettingsRow,
  chatFallback: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null | undefined,
): { apiUrl: string; apiKey: string } | null {
  const useDedicated = settings.memorySummaryUseDedicatedApi === true
  if (useDedicated) {
    const url = settings.memorySummaryApiUrl?.trim() || ''
    const key = settings.memorySummaryApiKey?.trim() || ''
    if (!url || !key) return null
    return { apiUrl: url, apiKey: key }
  }
  const url = chatFallback?.apiUrl?.trim() || ''
  const key = chatFallback?.apiKey?.trim() || ''
  if (!url || !key) return null
  return { apiUrl: url, apiKey: key }
}

/**
 * 合并聊天主配置与记忆设置，得到自动总结实际使用的 ApiConfig。
 * 专用接口开启时 url/key 走专用项；modelId 优先 memorySummaryModelId，否则回落聊天主模型。
 */
export function resolveAutoSummaryApiConfigFromSettings(
  settings: MemorySettingsRow,
  chatFallback: ApiConfig | null | undefined,
): ApiConfig | null {
  const cred = resolveSummaryApiCredentials(settings, chatFallback)
  if (!cred) return null
  const modelId = (
    settings.memorySummaryModelId?.trim() ||
    chatFallback?.modelId?.trim() ||
    ''
  ).trim()
  if (!modelId) return null
  return {
    apiUrl: cred.apiUrl,
    apiKey: cred.apiKey,
    modelId,
    modelList: chatFallback?.modelList ?? [],
  }
}

export async function resolveAutoSummaryApiConfig(
  chatFallback: ApiConfig | null | undefined,
): Promise<ApiConfig | null> {
  const settings = await personaDb.getMemorySettings()
  return resolveAutoSummaryApiConfigFromSettings(settings, chatFallback)
}

/** 拉模型列表探测总结接口是否可用 */
export async function testMemorySummaryConnection(
  cfg: Pick<ApiConfig, 'apiUrl' | 'apiKey'>,
): Promise<{ ok: true; modelCount: number } | { ok: false; message: string }> {
  try {
    const res = await fetchModels({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey, modelId: '', modelList: [] })
    if (!res.ok) return { ok: false, message: res.error }
    return { ok: true, modelCount: res.models.length }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}
