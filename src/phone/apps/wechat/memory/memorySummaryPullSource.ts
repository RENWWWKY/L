import type { ApiConfig } from '../../api/types'
import type { MemorySettingsRow } from '../newFriendsPersona/types'
import type { SummaryAPIConfig } from './memoryEngineConfigTypes'

export type SummaryPullSource = {
  apiUrl: string
  apiKey: string
  label: string
  kind: 'dedicated' | 'main'
}

/** 解析「拉取总结模型列表」实际会用哪套地址与密钥 */
export function resolveSummaryPullSource(params: {
  draft: SummaryAPIConfig
  saved: Pick<MemorySettingsRow, 'memorySummaryApiUrl' | 'memorySummaryApiKey'>
  hasSavedDedicatedKey: boolean
  useDedicatedApi: boolean
  chatApi: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null | undefined
}): SummaryPullSource | null {
  if (!params.useDedicatedApi) {
    const mainUrl = params.chatApi?.apiUrl?.trim() || ''
    const mainKey = params.chatApi?.apiKey?.trim() || ''
    if (mainUrl && mainKey) {
      return {
        apiUrl: mainUrl,
        apiKey: mainKey,
        kind: 'main',
        label: '将按当前聊天主接口（全局 API 配置）拉取线上总结模型',
      }
    }
    return null
  }

  const dedicatedUrl =
    params.draft.endpoint.trim() || params.saved.memorySummaryApiUrl?.trim() || ''
  const dedicatedKey =
    params.draft.apiKey.trim() || params.saved.memorySummaryApiKey?.trim() || ''

  if (dedicatedUrl && (dedicatedKey || params.hasSavedDedicatedKey)) {
    return {
      apiUrl: dedicatedUrl,
      apiKey: dedicatedKey,
      kind: 'dedicated',
      label: '将按你在下面填写的「线上总结专用接口」拉取模型',
    }
  }

  return null
}
