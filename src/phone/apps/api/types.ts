export type SubApiType = 'xinyu' | 'chatCard' | 'danmaku' | 'voiceAsr'

export type ApiConfig = {
  apiUrl: string
  apiKey: string
  modelId: string
  /** 已拉取的模型列表（用于下拉选择） */
  modelList: string[]
  /** 最近一次测试连接结果（用于首页显示连接状态） */
  lastTest?: { ok: boolean; message: string; at: number }
}

export type SubApiConfig = {
  enabled: boolean
  useMainApi: boolean
  apiConfig: ApiConfig
}

export type ApiPreset = {
  id: string
  name: string
  description?: string
  main: ApiConfig
  sub: Record<SubApiType, SubApiConfig>
  createdAt: number
  updatedAt: number
}

export type ApiStore = {
  presets: ApiPreset[]
  currentPresetId: string
}

