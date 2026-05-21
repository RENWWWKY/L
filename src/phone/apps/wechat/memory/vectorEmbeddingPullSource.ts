import type { ApiConfig } from '../../api/types'
import type { MemorySettingsRow } from '../newFriendsPersona/types'
import type { VectorAPIConfig } from './memoryEngineConfigTypes'

export type EmbeddingPullSource = {
  apiUrl: string
  apiKey: string
  /** 给用户看的说明 */
  label: string
  kind: 'dedicated' | 'main'
}

/** 解析「拉取模型列表 / 测连通」实际会用哪套地址与密钥 */
export function resolveEmbeddingPullSource(params: {
  draft: VectorAPIConfig
  saved: Pick<MemorySettingsRow, 'memoryEmbeddingApiUrl' | 'memoryEmbeddingApiKey'>
  hasSavedDedicatedKey: boolean
  useDedicatedApi: boolean
  chatApi: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null | undefined
}): EmbeddingPullSource | null {
  if (!params.useDedicatedApi) {
    const mainUrl = params.chatApi?.apiUrl?.trim() || ''
    const mainKey = params.chatApi?.apiKey?.trim() || ''
    if (mainUrl && mainKey) {
      return {
        apiUrl: mainUrl,
        apiKey: mainKey,
        kind: 'main',
        label: '将按当前聊天主接口（全局 API 配置）去拉模型',
      }
    }
    return null
  }

  const dedicatedUrl =
    params.draft.endpoint.trim() || params.saved.memoryEmbeddingApiUrl?.trim() || ''
  const dedicatedKey =
    params.draft.apiKey.trim() || params.saved.memoryEmbeddingApiKey?.trim() || ''

  if (dedicatedUrl && (dedicatedKey || params.hasSavedDedicatedKey)) {
    return {
      apiUrl: dedicatedUrl,
      apiKey: dedicatedKey,
      kind: 'dedicated',
      label: '将按你在下面填写的「向量专用接口」去拉模型',
    }
  }

  const mainUrl = params.chatApi?.apiUrl?.trim() || ''
  const mainKey = params.chatApi?.apiKey?.trim() || ''
  if (mainUrl && mainKey) {
    return {
      apiUrl: mainUrl,
      apiKey: mainKey,
      kind: 'main',
      label: '将按当前聊天主接口（全局 API 配置）去拉模型',
    }
  }

  return null
}
