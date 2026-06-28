import { fetchModels } from '../../api/apiSim'
import type { ApiConfig } from '../../api/types'
import { personaDb } from '../newFriendsPersona/idb'
import type { MemorySettingsRow } from '../newFriendsPersona/types'

/** 解析剧情摘要表请求用的 url / key：专用副接口开启时仅走专用项，否则走聊天 `apiConfig`。 */
export function resolveTimelineSummaryApiCredentials(
  settings: MemorySettingsRow,
  chatFallback: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null | undefined,
): { apiUrl: string; apiKey: string } | null {
  const useDedicated = settings.memoryTimelineSummaryUseDedicatedApi === true
  if (useDedicated) {
    const url = settings.memoryTimelineSummaryApiUrl?.trim() || ''
    const key = settings.memoryTimelineSummaryApiKey?.trim() || ''
    if (!url || !key) return null
    return { apiUrl: url, apiKey: key }
  }
  const url = chatFallback?.apiUrl?.trim() || ''
  const key = chatFallback?.apiKey?.trim() || ''
  if (!url || !key) return null
  return { apiUrl: url, apiKey: key }
}

/**
 * 合并聊天主配置与记忆设置，得到剧情摘要表实际使用的 ApiConfig。
 * 专用接口开启时 url/key 走专用项；modelId 优先 memoryTimelineSummaryModelId，否则回落聊天主模型。
 */
export function resolveTimelineSummaryApiConfigFromSettings(
  settings: MemorySettingsRow,
  chatFallback: ApiConfig | null | undefined,
): ApiConfig | null {
  const cred = resolveTimelineSummaryApiCredentials(settings, chatFallback)
  if (!cred) return null
  const modelId = (
    settings.memoryTimelineSummaryModelId?.trim() ||
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

export async function resolveTimelineSummaryApiConfig(
  chatFallback: ApiConfig | null | undefined,
): Promise<ApiConfig | null> {
  const settings = await personaDb.getMemorySettings()
  return resolveTimelineSummaryApiConfigFromSettings(settings, chatFallback)
}

/** 拉模型列表探测摘要表接口是否可用 */
export async function testMemoryTimelineSummaryConnection(
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
