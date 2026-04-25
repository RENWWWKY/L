import type { ApiConfig, ApiPreset, SubApiConfig, SubApiType } from './types'
import { SILICONFLOW_ASR_DEFAULT_BASE_URL } from '../wechat/voiceCall/siliconflowAsr'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyApiConfig(): ApiConfig {
  return {
    apiUrl: '',
    apiKey: '',
    modelId: '',
    modelList: [],
  }
}

export function createEmptyPreset(): ApiPreset {
  const now = Date.now()
  const mkSub = (useMainApi: boolean): SubApiConfig => ({ enabled: true, useMainApi, apiConfig: createEmptyApiConfig() })
  const sub: Record<SubApiType, SubApiConfig> = {
    xinyu: mkSub(true),
    chatCard: mkSub(true),
    danmaku: mkSub(true),
    voiceAsr: { enabled: true, useMainApi: false, apiConfig: { ...createEmptyApiConfig(), apiUrl: SILICONFLOW_ASR_DEFAULT_BASE_URL } },
  }
  return {
    id: uid('preset'),
    name: '',
    description: '',
    main: createEmptyApiConfig(),
    sub,
    createdAt: now,
    updatedAt: now,
  }
}
