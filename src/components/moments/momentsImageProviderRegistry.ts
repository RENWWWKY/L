import type { MomentsImageProvider } from './momentsImageModelCatalog'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'
import { GEMINI_AI_STUDIO_URL } from './geminiImageCatalog'
import { NOVELAI_ACCOUNT_URL } from './novelaiImageCatalog'
import { OPENAI_PLATFORM_URL } from './openaiImageCatalog'

export type ImageGenProviderMeta = {
  id: MomentsImageProvider
  label: string
  /** 获取 API Key 的引导页 */
  keyUrl: string
  keyLinkLabel: string
}

export const MOMENTS_IMAGE_PROVIDER_META: ImageGenProviderMeta[] = [
  {
    id: 'custom',
    label: '自定义接口',
    keyUrl: '',
    keyLinkLabel: '',
  },
  {
    id: 'novelai',
    label: 'NovelAI',
    keyUrl: NOVELAI_ACCOUNT_URL,
    keyLinkLabel: 'NovelAI 账户页',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    keyUrl: GEMINI_AI_STUDIO_URL,
    keyLinkLabel: 'Google AI Studio',
  },
  {
    id: 'openai',
    label: 'GPT 生图',
    keyUrl: OPENAI_PLATFORM_URL,
    keyLinkLabel: 'OpenAI 控制台',
  },
  {
    id: 'siliconflow',
    label: '硅基流动',
    keyUrl: 'https://cloud.siliconflow.cn/account/ak',
    keyLinkLabel: '硅基流动控制台',
  },
  {
    id: 'qianfan',
    label: '百度千帆',
    keyUrl: 'https://console.bce.baidu.com/qianfan/ais/console/apiKey',
    keyLinkLabel: '千帆控制台',
  },
  {
    id: 'volcengine',
    label: '火山方舟',
    keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    keyLinkLabel: '火山方舟控制台',
  },
]

export const MOMENTS_IMAGE_PROVIDER_LIST = MOMENTS_IMAGE_PROVIDER_META.map((m) => ({
  id: m.id,
  label: m.label,
}))

export function getImageGenProviderMeta(provider: MomentsImageProvider): ImageGenProviderMeta {
  return MOMENTS_IMAGE_PROVIDER_META.find((m) => m.id === provider) ?? MOMENTS_IMAGE_PROVIDER_META[0]!
}

export type ImageGenApiKeyField =
  | 'siliconflowApiKey'
  | 'qianfanApiKey'
  | 'volcengineApiKey'
  | 'novelaiApiKey'
  | 'geminiApiKey'
  | 'openaiApiKey'
  | 'customApiKey'

const KEY_FIELD_BY_PROVIDER: Record<MomentsImageProvider, ImageGenApiKeyField> = {
  siliconflow: 'siliconflowApiKey',
  qianfan: 'qianfanApiKey',
  volcengine: 'volcengineApiKey',
  novelai: 'novelaiApiKey',
  gemini: 'geminiApiKey',
  openai: 'openaiApiKey',
  custom: 'customApiKey',
}

export function getImageGenApiKeyField(provider: MomentsImageProvider): ImageGenApiKeyField {
  return KEY_FIELD_BY_PROVIDER[provider]
}

export function getImageGenApiKey(settings: MomentsImageGenSettings, provider: MomentsImageProvider): string {
  return settings[getImageGenApiKeyField(provider)] ?? ''
}

export function isMomentsImageProvider(value: unknown): value is MomentsImageProvider {
  return (
    value === 'siliconflow' ||
    value === 'qianfan' ||
    value === 'volcengine' ||
    value === 'novelai' ||
    value === 'gemini' ||
    value === 'openai' ||
    value === 'custom'
  )
}

export function buildFetchCatalogOptions(
  provider: MomentsImageProvider,
  settings: MomentsImageGenSettings,
): import('./momentsImageModelCatalog').FetchMomentsImageModelCatalogOptions {
  return {
    provider,
    siliconflowApiKey: settings.siliconflowApiKey,
    qianfanApiKey: settings.qianfanApiKey,
    volcengineApiKey: settings.volcengineApiKey,
    novelaiApiKey: settings.novelaiApiKey,
    geminiApiKey: settings.geminiApiKey,
    openaiApiKey: settings.openaiApiKey,
    customApiUrl: settings.customApiUrl,
    customApiKey: settings.customApiKey,
    customManualModelIds: settings.customManualModelIds,
  }
}
