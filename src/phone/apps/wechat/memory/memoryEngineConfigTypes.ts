export interface VectorAPIConfig {
  endpoint: string
  apiKey: string
  collection: string
}

export interface SummaryAPIConfig {
  endpoint: string
  apiKey: string
}

export function summaryConfigFromDraft(params: { endpoint: string; apiKey: string }): SummaryAPIConfig {
  return {
    endpoint: params.endpoint.trim(),
    apiKey: params.apiKey.trim(),
  }
}

export function isSummaryConfigReadyForPing(config: SummaryAPIConfig, hasSavedKey: boolean): boolean {
  return Boolean(config.endpoint && (config.apiKey || hasSavedKey))
}

export type ConnectionStatus = 'idle' | 'pinging' | 'connected' | 'failed'

export function vectorConfigFromDraft(params: {
  endpoint: string
  apiKey: string
  collection: string
}): VectorAPIConfig {
  return {
    endpoint: params.endpoint.trim(),
    apiKey: params.apiKey.trim(),
    collection: params.collection.trim(),
  }
}

export function isVectorConfigReadyForPing(
  config: VectorAPIConfig,
  hasSavedKey: boolean,
): boolean {
  return Boolean(config.endpoint && (config.apiKey || hasSavedKey))
}
