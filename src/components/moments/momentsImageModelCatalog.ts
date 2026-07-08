import { DEFAULT_GEMINI_IMAGE_MODEL_ID } from './geminiImageCatalog'
import { DEFAULT_NOVELAI_IMAGE_MODEL_ID } from './novelaiImageCatalog'
import { DEFAULT_OPENAI_IMAGE_MODEL_ID } from './openaiImageCatalog'
import { DEFAULT_QIANFAN_IMAGE_MODEL_ID } from './qianfanImageCatalog'
import { DEFAULT_SILICONFLOW_IMAGE_MODEL_ID } from './siliconflowImageCatalog'
import { DEFAULT_CUSTOM_IMAGE_MODEL_ID, parseCustomManualModelIds } from './customImageCatalog'
import { DEFAULT_VOLCENGINE_IMAGE_MODEL_ID } from './volcengineImageCatalog'

export type MomentsImageProvider =
  | 'siliconflow'
  | 'qianfan'
  | 'volcengine'
  | 'novelai'
  | 'gemini'
  | 'openai'
  | 'custom'

export type MomentsImageModelCacheByProvider = Record<MomentsImageProvider, MomentsImageModelOption[]>

export type MomentsImageModelsFetchedAtByProvider = Record<MomentsImageProvider, number | null>

export const EMPTY_MODEL_CACHE_BY_PROVIDER: MomentsImageModelCacheByProvider = {
  siliconflow: [],
  qianfan: [],
  volcengine: [],
  novelai: [],
  gemini: [],
  openai: [],
  custom: [],
}

export const EMPTY_MODELS_FETCHED_AT_BY_PROVIDER: MomentsImageModelsFetchedAtByProvider = {
  siliconflow: null,
  qianfan: null,
  volcengine: null,
  novelai: null,
  gemini: null,
  openai: null,
  custom: null,
}

export function getCachedModelsForProvider(
  cache: MomentsImageModelCacheByProvider,
  provider: MomentsImageProvider,
): MomentsImageModelOption[] {
  return cache[provider] ?? []
}

export function replaceCachedModelsForProvider(
  cache: MomentsImageModelCacheByProvider,
  provider: MomentsImageProvider,
  models: MomentsImageModelOption[],
): MomentsImageModelCacheByProvider {
  return { ...cache, [provider]: models }
}

export type MomentsImageModelOption = {
  id: string
  modelName: string
  labelZh: string
  title?: string
  brand?: string
  description?: string
  free: boolean
  priceYuanPerImage?: number | null
  priceLabel?: string
  /** 火山方舟：账号是否已开通该模型服务（加载列表时探测） */
  serviceActivated?: boolean | null
}

export const DEFAULT_MOMENTS_IMAGE_MODEL_ID = DEFAULT_SILICONFLOW_IMAGE_MODEL_ID

const LEGACY_MODEL_ID_MAP: Record<string, string> = {
  pollinations: DEFAULT_SILICONFLOW_IMAGE_MODEL_ID,
  'pollinations:flux': DEFAULT_SILICONFLOW_IMAGE_MODEL_ID,
  'pollinations:turbo': DEFAULT_SILICONFLOW_IMAGE_MODEL_ID,
  'proxy:shturl-flux': DEFAULT_SILICONFLOW_IMAGE_MODEL_ID,
  'proxy:pixazo-schnell': DEFAULT_SILICONFLOW_IMAGE_MODEL_ID,
  'shturl-flux': DEFAULT_SILICONFLOW_IMAGE_MODEL_ID,
  'pixazo-schnell': DEFAULT_SILICONFLOW_IMAGE_MODEL_ID,
}

const PROVIDER_PREFIXES: MomentsImageProvider[] = [
  'siliconflow',
  'qianfan',
  'volcengine',
  'novelai',
  'gemini',
  'openai',
  'custom',
]

export function getDefaultModelIdForProvider(provider: MomentsImageProvider): string {
  if (provider === 'qianfan') return DEFAULT_QIANFAN_IMAGE_MODEL_ID
  if (provider === 'volcengine') return DEFAULT_VOLCENGINE_IMAGE_MODEL_ID
  if (provider === 'novelai') return DEFAULT_NOVELAI_IMAGE_MODEL_ID
  if (provider === 'gemini') return DEFAULT_GEMINI_IMAGE_MODEL_ID
  if (provider === 'openai') return DEFAULT_OPENAI_IMAGE_MODEL_ID
  if (provider === 'custom') return DEFAULT_CUSTOM_IMAGE_MODEL_ID
  return DEFAULT_SILICONFLOW_IMAGE_MODEL_ID
}

export function inferMomentsImageProviderFromModelId(modelId: string): MomentsImageProvider {
  for (const prefix of PROVIDER_PREFIXES) {
    if (prefix !== 'siliconflow' && modelId.startsWith(`${prefix}:`)) return prefix
  }
  return 'siliconflow'
}

export function migrateMomentsImageModelId(id: string): string {
  const trimmed = id.trim()
  if (!trimmed) return DEFAULT_MOMENTS_IMAGE_MODEL_ID
  if (LEGACY_MODEL_ID_MAP[trimmed]) return LEGACY_MODEL_ID_MAP[trimmed]!
  if (trimmed.startsWith('pollinations:')) return DEFAULT_SILICONFLOW_IMAGE_MODEL_ID
  for (const prefix of PROVIDER_PREFIXES) {
    if (trimmed.startsWith(`${prefix}:`)) return trimmed
  }
  return DEFAULT_MOMENTS_IMAGE_MODEL_ID
}

export function isKnownMomentsImageModelId(
  id: string,
  catalog?: MomentsImageModelOption[],
): boolean {
  const normalized = migrateMomentsImageModelId(id)
  if (!catalog?.length) {
    return PROVIDER_PREFIXES.some((prefix) => normalized.startsWith(`${prefix}:`))
  }
  return catalog.some((m) => m.id === normalized)
}

export function findMomentsImageModel(
  id: string,
  catalog: MomentsImageModelOption[],
): MomentsImageModelOption | undefined {
  const normalized = migrateMomentsImageModelId(id)
  return catalog.find((m) => m.id === normalized)
}

export type FetchMomentsImageModelCatalogOptions = {
  provider: MomentsImageProvider
  siliconflowApiKey?: string
  qianfanApiKey?: string
  volcengineApiKey?: string
  novelaiApiKey?: string
  geminiApiKey?: string
  openaiApiKey?: string
  customApiUrl?: string
  customApiKey?: string
  customManualModelIds?: string
}

export async function fetchMomentsImageModelCatalog(
  options: FetchMomentsImageModelCatalogOptions,
): Promise<MomentsImageModelOption[]> {
  if (options.provider === 'qianfan') {
    const { fetchQianfanImageModelCatalog } = await import('./qianfanImageCatalog')
    return fetchQianfanImageModelCatalog(options.qianfanApiKey ?? '')
  }
  if (options.provider === 'volcengine') {
    const { fetchVolcengineImageModelCatalog } = await import('./volcengineImageCatalog')
    return fetchVolcengineImageModelCatalog(options.volcengineApiKey ?? '')
  }
  if (options.provider === 'novelai') {
    const { fetchNovelaiImageModelCatalog } = await import('./novelaiImageCatalog')
    return fetchNovelaiImageModelCatalog(options.novelaiApiKey ?? '')
  }
  if (options.provider === 'gemini') {
    const { fetchGeminiImageModelCatalog } = await import('./geminiImageCatalog')
    return fetchGeminiImageModelCatalog(options.geminiApiKey ?? '')
  }
  if (options.provider === 'openai') {
    const { fetchOpenaiImageModelCatalog } = await import('./openaiImageCatalog')
    return fetchOpenaiImageModelCatalog(options.openaiApiKey ?? '')
  }
  if (options.provider === 'custom') {
    const { fetchCustomImageModelCatalog } = await import('./customImageCatalog')
    return fetchCustomImageModelCatalog(
      options.customApiUrl ?? '',
      options.customApiKey ?? '',
      parseCustomManualModelIds(options.customManualModelIds),
    )
  }
  const { fetchSiliconFlowImageModelCatalog } = await import('./siliconflowImageCatalog')
  return fetchSiliconFlowImageModelCatalog(options.siliconflowApiKey ?? '')
}

export function parseMomentsImageModelId(modelId: string): {
  provider: MomentsImageProvider
  modelName: string
} {
  const id = migrateMomentsImageModelId(modelId)
  for (const prefix of PROVIDER_PREFIXES) {
    if (prefix !== 'siliconflow' && id.startsWith(`${prefix}:`)) {
      return { provider: prefix, modelName: id.slice(prefix.length + 1) }
    }
  }
  return {
    provider: 'siliconflow',
    modelName: id.startsWith('siliconflow:') ? id.slice('siliconflow:'.length) : id,
  }
}
