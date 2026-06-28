import type { ApiConfig } from '../../api/types'
import type { MemorySettingsRow } from '../newFriendsPersona/types'
import type { SummaryAPIConfig } from './memoryEngineConfigTypes'

export type TimelineSummaryPullSource = {
  apiUrl: string
  apiKey: string
  label: string
  kind: 'dedicated' | 'main'
}

/** 解析「拉取剧情摘要表模型列表」实际会用哪套地址与密钥 */
export function resolveTimelineSummaryPullSource(params: {
  draft: SummaryAPIConfig
  saved: Pick<MemorySettingsRow, 'memoryTimelineSummaryApiUrl' | 'memoryTimelineSummaryApiKey'>
  hasSavedDedicatedKey: boolean
  useDedicatedApi: boolean
  chatApi: Pick<ApiConfig, 'apiUrl' | 'apiKey'> | null | undefined
}): TimelineSummaryPullSource | null {
  if (!params.useDedicatedApi) {
    const mainUrl = params.chatApi?.apiUrl?.trim() || ''
    const mainKey = params.chatApi?.apiKey?.trim() || ''
    if (mainUrl && mainKey) {
      return {
        apiUrl: mainUrl,
        apiKey: mainKey,
        kind: 'main',
        label: '将按当前聊天主接口（全局 API 配置）拉取线下摘要模型',
      }
    }
    return null
  }

  const dedicatedUrl =
    params.draft.endpoint.trim() || params.saved.memoryTimelineSummaryApiUrl?.trim() || ''
  const dedicatedKey =
    params.draft.apiKey.trim() || params.saved.memoryTimelineSummaryApiKey?.trim() || ''

  if (dedicatedUrl && (dedicatedKey || params.hasSavedDedicatedKey)) {
    return {
      apiUrl: dedicatedUrl,
      apiKey: dedicatedKey,
      kind: 'dedicated',
      label: '将按你在下面填写的「线下摘要专用接口」拉取模型',
    }
  }

  return null
}
