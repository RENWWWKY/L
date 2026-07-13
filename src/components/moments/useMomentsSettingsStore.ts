import { useCallback, useEffect, useState } from 'react'

import {
  DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  EMPTY_MODEL_CACHE_BY_PROVIDER,
  EMPTY_MODELS_FETCHED_AT_BY_PROVIDER,
  getDefaultModelIdForProvider,
  inferMomentsImageProviderFromModelId,
  migrateMomentsImageModelId,
  type MomentsImageModelCacheByProvider,
  type MomentsImageModelOption,
  type MomentsImageModelsFetchedAtByProvider,
  type MomentsImageProvider,
} from './momentsImageModelCatalog'
import { isMomentsImageProvider } from './momentsImageProviderRegistry'
import {
  DEFAULT_IMAGE_GEN_PROVIDER_PROMPT_SETTINGS,
  normalizeImageGenProviderPromptSettings,
  type ImageGenProviderPromptSettings,
} from './imageGenProviderPromptSettings'
import { DEFAULT_STYLE_PRESET_ID } from './pollinationsPresets'
import { normalizeImageGenStyleMode, type ImageGenStyleMode } from './imageGenStyleMode'
import {
  DEFAULT_PROACTIVE_CHARACTER_MOMENTS_SETTINGS,
  DEFAULT_PROACTIVE_CHARACTER_MOMENT_SCHEDULE,
  normalizeProactiveCharacterMomentsSettings,
  type ProactiveCharacterMomentsSettings,
  type ProactiveCharacterMomentSchedule,
} from './proactiveCharacterMomentTypes'
import {
  DEFAULT_USER_MOMENT_ENGAGEMENT_RULES,
  normalizeUserMomentEngagementRules,
  type UserMomentEngagementRulesSettings,
} from './userMomentEngagementRules'
import {
  migrateLegacyImageGenPromptPresets,
  type UserImageGenPromptPreset,
} from './userImageGenPromptPresets'

export interface MomentsImageGenSettings {
  /** 是否启用朋友圈 AI 配图（全局预设侧：关闭后朋友圈与聊天室均不调用生图） */
  enabled: boolean
  /**
   * 朋友圈法则页：启用「专属生图 API」。
   * 关闭时使用 API 设置应用中当前预设的默认生图 API。
   */
  useDedicatedImageGen?: boolean
  /** 当前生图引擎 */
  provider: MomentsImageProvider
  modelId: string
  /** 硅基流动 API Key（https://cloud.siliconflow.cn/account/ak） */
  siliconflowApiKey: string
  /** 百度千帆 API Key（https://console.bce.baidu.com/qianfan/ais/console/apiKey） */
  qianfanApiKey: string
  /** 火山方舟 API Key（https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey） */
  volcengineApiKey: string
  /** NovelAI API Key（https://novelai.net/account） */
  novelaiApiKey: string
  /** Google Gemini / Imagen API Key（https://aistudio.google.com/apikey） */
  geminiApiKey: string
  /** OpenAI GPT 生图 API Key（https://platform.openai.com/api-keys） */
  openaiApiKey: string
  /** 自定义 OpenAI 兼容生图接口 URL */
  customApiUrl: string
  /** 自定义 OpenAI 兼容生图接口 API Key */
  customApiKey: string
  /** 自定义接口：/models 未列出时手动补充的生图模型 ID（逗号分隔） */
  customManualModelIds: string
  /** 各引擎拉取的模型列表（持久化到 localStorage，再次拉取会覆盖对应引擎缓存） */
  cachedModelsByProvider: MomentsImageModelCacheByProvider
  modelsFetchedAtByProvider: MomentsImageModelsFetchedAtByProvider
  stylePrefixMode: ImageGenStyleMode
  stylePresetId: string
  customStylePrefix: string
  /** 各生图引擎的提示词与采样参数 */
  providerPromptSettings: ImageGenProviderPromptSettings
  /** 用户自保存的正/负面提示词预设（仅本机） */
  savedImageGenPromptPresets?: UserImageGenPromptPreset[]
  /** 默认生图尺寸：scene 按场景竖横方 / fixed 固定 / random 从池随机（角色发图、朋友圈配图等） */
  imageSizeMode?: 'fixed' | 'random' | 'scene'
  /** fixed 模式使用的尺寸 id（见 getSupportedImageSizes） */
  imageSizeId?: string
  /** random 模式候选尺寸 id；空表示当前模型支持的全部尺寸 */
  imageSizePoolIds?: string[]
}

/** @deprecated 兼容旧字段名，新代码请用 MomentsImageGenSettings */
export type MomentsImageGenApiSettings = MomentsImageGenSettings

export interface MomentsSettings {
  enableDelayedInteraction: boolean
  /** 仅提醒朋友与我的直接互动（关闭共同好友吃瓜提醒） */
  onlyDirectInteraction: boolean
  /** 用户本人发朋友圈的角色互动频繁度 */
  userMomentEngagement: UserMomentEngagementRulesSettings
  imageGen: MomentsImageGenSettings
  proactiveCharacterMoments: ProactiveCharacterMomentsSettings
}

const STORAGE_KEY = 'wechat-moments-settings-v1'

export const DEFAULT_MOMENTS_SETTINGS: MomentsSettings = {
  enableDelayedInteraction: true,
  onlyDirectInteraction: false,
  userMomentEngagement: { ...DEFAULT_USER_MOMENT_ENGAGEMENT_RULES },
  proactiveCharacterMoments: { ...DEFAULT_PROACTIVE_CHARACTER_MOMENTS_SETTINGS },
  imageGen: {
    enabled: true,
    useDedicatedImageGen: false,
    provider: 'siliconflow',
    modelId: DEFAULT_MOMENTS_IMAGE_MODEL_ID,
    siliconflowApiKey: '',
    qianfanApiKey: '',
    volcengineApiKey: '',
    novelaiApiKey: '',
    geminiApiKey: '',
    openaiApiKey: '',
    customApiUrl: '',
    customApiKey: '',
    customManualModelIds: '',
    cachedModelsByProvider: { ...EMPTY_MODEL_CACHE_BY_PROVIDER },
    modelsFetchedAtByProvider: { ...EMPTY_MODELS_FETCHED_AT_BY_PROVIDER },
    stylePrefixMode: 'preset',
    stylePresetId: DEFAULT_STYLE_PRESET_ID,
    customStylePrefix: '',
    providerPromptSettings: { ...DEFAULT_IMAGE_GEN_PROVIDER_PROMPT_SETTINGS },
    savedImageGenPromptPresets: [],
    imageSizeMode: 'scene',
    imageSizeId: '',
    imageSizePoolIds: [],
  },
}

function normalizeCachedModel(raw: unknown): MomentsImageModelOption | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = migrateMomentsImageModelId(typeof o.id === 'string' ? o.id : '')
  const defaultBrand = id.startsWith('qianfan:')
    ? '百度千帆'
    : id.startsWith('volcengine:')
      ? '火山方舟'
      : id.startsWith('novelai:')
        ? 'NovelAI'
        : id.startsWith('gemini:')
          ? 'Google Gemini'
          : id.startsWith('openai:')
            ? 'OpenAI'
            : id.startsWith('custom:')
              ? '自定义接口'
              : '硅基流动'
  const prefix = id.startsWith('qianfan:')
    ? 'qianfan:'
    : id.startsWith('volcengine:')
      ? 'volcengine:'
      : id.startsWith('novelai:')
        ? 'novelai:'
        : id.startsWith('gemini:')
          ? 'gemini:'
          : id.startsWith('openai:')
            ? 'openai:'
            : id.startsWith('custom:')
              ? 'custom:'
              : id.startsWith('siliconflow:')
                ? 'siliconflow:'
                : ''
  const modelName =
    typeof o.modelName === 'string'
      ? o.modelName.trim()
      : prefix
        ? id.slice(prefix.length)
        : ''
  const labelZh = typeof o.labelZh === 'string' ? o.labelZh.trim() : modelName
  if (!id || !modelName || !labelZh) return null

  const priceYuanPerImage =
    typeof o.priceYuanPerImage === 'number' && Number.isFinite(o.priceYuanPerImage)
      ? o.priceYuanPerImage
      : undefined
  const priceLabel = typeof o.priceLabel === 'string' ? o.priceLabel : undefined
  const serviceActivated =
    typeof o.serviceActivated === 'boolean'
      ? o.serviceActivated
      : o.serviceActivated === null
        ? null
        : undefined

  return {
    id,
    modelName,
    labelZh,
    title: typeof o.title === 'string' ? o.title : labelZh,
    brand: typeof o.brand === 'string' ? o.brand : defaultBrand,
    description: typeof o.description === 'string' ? o.description : undefined,
    free: typeof o.free === 'boolean' ? o.free : priceYuanPerImage === 0,
    priceYuanPerImage,
    priceLabel,
    serviceActivated,
  }
}

function normalizeModelCacheByProvider(raw: Record<string, unknown>): MomentsImageModelCacheByProvider {
  const base: MomentsImageModelCacheByProvider = { ...EMPTY_MODEL_CACHE_BY_PROVIDER }

  if (raw.cachedModelsByProvider && typeof raw.cachedModelsByProvider === 'object') {
    const byProvider = raw.cachedModelsByProvider as Record<string, unknown>
    for (const key of Object.keys(base) as MomentsImageProvider[]) {
      const arr = byProvider[key]
      base[key] = Array.isArray(arr)
        ? arr.map(normalizeCachedModel).filter((m): m is MomentsImageModelOption => !!m)
        : []
    }
    return base
  }

  const legacyModels = Array.isArray(raw.cachedModels)
    ? raw.cachedModels.map(normalizeCachedModel).filter((m): m is MomentsImageModelOption => !!m)
    : []

  for (const key of Object.keys(base) as MomentsImageProvider[]) {
    base[key] = legacyModels.filter((m) => m.id.startsWith(`${key}:`))
  }
  return base
}

function normalizeModelsFetchedAtByProvider(
  raw: Record<string, unknown>,
  provider: MomentsImageProvider,
): MomentsImageModelsFetchedAtByProvider {
  if (raw.modelsFetchedAtByProvider && typeof raw.modelsFetchedAtByProvider === 'object') {
    const byProvider = raw.modelsFetchedAtByProvider as Record<string, unknown>
    const read = (key: MomentsImageProvider): number | null => {
      const value = byProvider[key]
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    }
    return {
      siliconflow: read('siliconflow'),
      qianfan: read('qianfan'),
      volcengine: read('volcengine'),
      novelai: read('novelai'),
      gemini: read('gemini'),
      openai: read('openai'),
      custom: read('custom'),
    }
  }

  const legacyFetchedAt =
    typeof raw.modelsFetchedAt === 'number' && Number.isFinite(raw.modelsFetchedAt)
      ? raw.modelsFetchedAt
      : null

  return {
    siliconflow: provider === 'siliconflow' ? legacyFetchedAt : null,
    qianfan: provider === 'qianfan' ? legacyFetchedAt : null,
    volcengine: provider === 'volcengine' ? legacyFetchedAt : null,
    novelai: provider === 'novelai' ? legacyFetchedAt : null,
    gemini: provider === 'gemini' ? legacyFetchedAt : null,
    openai: provider === 'openai' ? legacyFetchedAt : null,
    custom: provider === 'custom' ? legacyFetchedAt : null,
  }
}

export function normalizeImageGenSettings(raw: unknown): MomentsImageGenSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MOMENTS_SETTINGS.imageGen }
  return normalizeImageGen(raw as Record<string, unknown>)
}

function normalizeImageGen(raw: Record<string, unknown>): MomentsImageGenSettings {
  const legacyUseGlobal = typeof raw.useGlobal === 'boolean' ? raw.useGlobal : null
  const hasNewShape = typeof raw.enabled === 'boolean' || typeof raw.modelId === 'string'

  if (!hasNewShape && legacyUseGlobal !== null) {
    return { ...DEFAULT_MOMENTS_SETTINGS.imageGen, enabled: !legacyUseGlobal }
  }

  const modelId = migrateMomentsImageModelId(
    typeof raw.modelId === 'string'
      ? raw.modelId
      : typeof raw.model === 'string'
        ? raw.model
        : DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  )

  const provider: MomentsImageProvider = isMomentsImageProvider(raw.provider)
    ? raw.provider
    : inferMomentsImageProviderFromModelId(modelId)

  const normalizedModelId =
    inferMomentsImageProviderFromModelId(modelId) === provider
      ? modelId
      : getDefaultModelIdForProvider(provider)

  return {
    enabled:
      typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_MOMENTS_SETTINGS.imageGen.enabled,
    useDedicatedImageGen:
      typeof raw.useDedicatedImageGen === 'boolean'
        ? raw.useDedicatedImageGen
        : DEFAULT_MOMENTS_SETTINGS.imageGen.useDedicatedImageGen,
    provider,
    modelId: normalizedModelId,
    siliconflowApiKey:
      typeof raw.siliconflowApiKey === 'string' ? raw.siliconflowApiKey : '',
    qianfanApiKey: typeof raw.qianfanApiKey === 'string' ? raw.qianfanApiKey : '',
    volcengineApiKey: typeof raw.volcengineApiKey === 'string' ? raw.volcengineApiKey : '',
    novelaiApiKey: typeof raw.novelaiApiKey === 'string' ? raw.novelaiApiKey : '',
    geminiApiKey: typeof raw.geminiApiKey === 'string' ? raw.geminiApiKey : '',
    openaiApiKey: typeof raw.openaiApiKey === 'string' ? raw.openaiApiKey : '',
    customApiUrl: typeof raw.customApiUrl === 'string' ? raw.customApiUrl : '',
    customApiKey: typeof raw.customApiKey === 'string' ? raw.customApiKey : '',
    customManualModelIds:
      typeof raw.customManualModelIds === 'string' ? raw.customManualModelIds : '',
    cachedModelsByProvider: normalizeModelCacheByProvider(raw),
    modelsFetchedAtByProvider: normalizeModelsFetchedAtByProvider(raw, provider),
    stylePrefixMode:
      normalizeImageGenStyleMode(raw.stylePrefixMode),
    stylePresetId:
      typeof raw.stylePresetId === 'string' && raw.stylePresetId.trim()
        ? raw.stylePresetId.trim()
        : DEFAULT_MOMENTS_SETTINGS.imageGen.stylePresetId,
    customStylePrefix:
      typeof raw.customStylePrefix === 'string'
        ? raw.customStylePrefix
        : DEFAULT_MOMENTS_SETTINGS.imageGen.customStylePrefix,
    providerPromptSettings: normalizeImageGenProviderPromptSettings(raw.providerPromptSettings),
    savedImageGenPromptPresets: migrateLegacyImageGenPromptPresets({
      savedImageGenPromptPresets: raw.savedImageGenPromptPresets,
      savedArtistStringPresets: raw.savedArtistStringPresets,
      savedExtraPositivePromptPresets: raw.savedExtraPositivePromptPresets,
    }),
    imageSizeMode:
      raw.imageSizeMode === 'random'
        ? 'random'
        : raw.imageSizeMode === 'fixed'
          ? 'fixed'
          : 'scene',
    imageSizeId: typeof raw.imageSizeId === 'string' ? raw.imageSizeId : '',
    imageSizePoolIds: Array.isArray(raw.imageSizePoolIds)
      ? raw.imageSizePoolIds.filter((id): id is string => typeof id === 'string')
      : [],
  }
}

function normalizeProactiveCharacterMoments(raw: unknown): ProactiveCharacterMomentsSettings {
  return normalizeProactiveCharacterMomentsSettings(raw)
}

function normalizeSettings(raw: unknown): MomentsSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MOMENTS_SETTINGS }
  const o = raw as Record<string, unknown>
  const imageRaw =
    (o.imageGen && typeof o.imageGen === 'object'
      ? (o.imageGen as Record<string, unknown>)
      : null) ??
    (o.imageGenApi && typeof o.imageGenApi === 'object'
      ? (o.imageGenApi as Record<string, unknown>)
      : {})

  return {
    enableDelayedInteraction:
      typeof o.enableDelayedInteraction === 'boolean'
        ? o.enableDelayedInteraction
        : DEFAULT_MOMENTS_SETTINGS.enableDelayedInteraction,
    onlyDirectInteraction:
      typeof o.onlyDirectInteraction === 'boolean'
        ? o.onlyDirectInteraction
        : DEFAULT_MOMENTS_SETTINGS.onlyDirectInteraction,
    userMomentEngagement: normalizeUserMomentEngagementRules(o.userMomentEngagement),
    proactiveCharacterMoments: normalizeProactiveCharacterMoments(o.proactiveCharacterMoments),
    imageGen: normalizeImageGenSettings(imageRaw),
  }
}

export function loadMomentsSettings(): MomentsSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_MOMENTS_SETTINGS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_MOMENTS_SETTINGS }
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_MOMENTS_SETTINGS }
  }
}

export function persistMomentsSettings(settings: MomentsSettings): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // ignore quota
  }
}

export function useMomentsSettingsStore() {
  const [settings, setSettings] = useState<MomentsSettings>(() => loadMomentsSettings())

  useEffect(() => {
    persistMomentsSettings(settings)
  }, [settings])

  const patchSettings = useCallback((patch: Partial<MomentsSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const patchImageGen = useCallback((patch: Partial<MomentsImageGenSettings>) => {
    setSettings((prev) => ({
      ...prev,
      imageGen: { ...prev.imageGen, ...patch },
    }))
  }, [])

  const patchProactiveCharacterMoments = useCallback(
    (patch: Partial<ProactiveCharacterMomentsSettings>) => {
      setSettings((prev) => ({
        ...prev,
        proactiveCharacterMoments: { ...prev.proactiveCharacterMoments, ...patch },
      }))
    },
    [],
  )

  const patchCharacterProactiveMomentSchedule = useCallback(
    (key: string, patch: Partial<ProactiveCharacterMomentSchedule>) => {
      const k = key.trim()
      if (!k) return
      setSettings((prev) => {
        const pm = prev.proactiveCharacterMoments
        const existing = pm.byCharacter[k] ?? { ...DEFAULT_PROACTIVE_CHARACTER_MOMENT_SCHEDULE }
        return {
          ...prev,
          proactiveCharacterMoments: {
            ...pm,
            byCharacter: {
              ...pm.byCharacter,
              [k]: { ...existing, ...patch },
            },
          },
        }
      })
    },
    [],
  )

  /** @deprecated 请使用 patchImageGen */
  const patchImageGenApi = patchImageGen

  return {
    settings,
    setSettings,
    patchSettings,
    patchImageGen,
    patchImageGenApi,
    patchProactiveCharacterMoments,
    patchCharacterProactiveMomentSchedule,
  }
}
