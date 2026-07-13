import {
  inferMomentsImageProviderFromModelId,
  parseMomentsImageModelId,
  type MomentsImageProvider,
} from './momentsImageModelCatalog'
import { isGptImageModel } from './openaiImageCatalog'
import { isGeminiImagenModel, isGeminiNativeImageModel } from './geminiImageCatalog'
import { isQianfanMuseSteamerModel } from './qianfanImageCatalog'
import { isNovelaiImageModelName, isNovelaiV4Model } from './novelaiImageCatalog'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

/** 各引擎共用的正面提示词追加项 */
export interface ImageGenCommonPromptParams {
  /** 统一正面附加提示词（拼接到主画面描述前，与风格/画师串叠加） */
  extraPositivePrompt: string
  /** @deprecated 旧版前缀，读取时自动合并入 extraPositivePrompt */
  extraPositivePrefix: string
  /** @deprecated 旧版后缀，读取时自动合并入 extraPositivePrompt */
  extraPositiveSuffix: string
}

export interface NovelaiPromptParams {
  steps: number
  /** 提示词相关性（CFG / scale） */
  cfg: number
  sampler: string
  /** 画风参考 token，如 artist:xxx 或风格标签 */
  styleReference: string
  /** 正面提示词前缀（画风参考之后、主画面之前） */
  positivePrefix: string
  /** 负面提示词（留空时不注入） */
  negativePrompt: string
}

export interface SiliconflowPromptParams {
  steps: number
  /** Qwen-Image 等模型的 cfg */
  cfg: number
  /** Kolors 等模型的 guidance_scale */
  guidanceScale: number
  negativePrompt: string
}

export interface QianfanPromptParams {
  negativePrompt: string
}

export interface VolcenginePromptParams {
  negativePrompt: string
}

export interface GeminiPromptParams {
  negativePrompt: string
}

export interface OpenaiPromptParams {
  negativePrompt: string
}

export interface CustomPromptParams {
  steps: number
  cfg: number
  guidanceScale: number
  negativePrompt: string
}

export interface ImageGenProviderPromptSettings {
  common: ImageGenCommonPromptParams
  novelai: NovelaiPromptParams
  siliconflow: SiliconflowPromptParams
  qianfan: QianfanPromptParams
  volcengine: VolcenginePromptParams
  gemini: GeminiPromptParams
  openai: OpenaiPromptParams
  custom: CustomPromptParams
}

export const NOVELAI_SAMPLER_OPTIONS = [
  { id: 'k_euler_ancestral', label: 'Euler Ancestral（默认）' },
  { id: 'k_euler', label: 'Euler' },
  { id: 'k_dpmpp_2m', label: 'DPM++ 2M' },
  { id: 'k_dpmpp_sde', label: 'DPM++ SDE' },
  { id: 'k_dpmpp_2s_ancestral', label: 'DPM++ 2S Ancestral' },
  { id: 'ddim', label: 'DDIM' },
] as const

export const DEFAULT_IMAGE_GEN_COMMON_PROMPT_PARAMS: ImageGenCommonPromptParams = {
  extraPositivePrompt: '',
  extraPositivePrefix: '',
  extraPositiveSuffix: '',
}

export const DEFAULT_NOVELAI_PROMPT_PARAMS: NovelaiPromptParams = {
  steps: 28,
  cfg: 5,
  sampler: 'k_euler_ancestral',
  styleReference: '',
  positivePrefix: '',
  negativePrompt: '',
}

export const DEFAULT_SILICONFLOW_PROMPT_PARAMS: SiliconflowPromptParams = {
  steps: 20,
  cfg: 4,
  guidanceScale: 7.5,
  negativePrompt: '',
}

export const DEFAULT_QIANFAN_PROMPT_PARAMS: QianfanPromptParams = {
  negativePrompt: '',
}

export const DEFAULT_VOLCENGINE_PROMPT_PARAMS: VolcenginePromptParams = {
  negativePrompt: '',
}

export const DEFAULT_GEMINI_PROMPT_PARAMS: GeminiPromptParams = {
  negativePrompt: '',
}

export const DEFAULT_OPENAI_PROMPT_PARAMS: OpenaiPromptParams = {
  negativePrompt: '',
}

export const DEFAULT_CUSTOM_PROMPT_PARAMS: CustomPromptParams = {
  steps: 20,
  cfg: 4,
  guidanceScale: 7.5,
  negativePrompt: '',
}

export const DEFAULT_IMAGE_GEN_PROVIDER_PROMPT_SETTINGS: ImageGenProviderPromptSettings = {
  common: { ...DEFAULT_IMAGE_GEN_COMMON_PROMPT_PARAMS },
  novelai: { ...DEFAULT_NOVELAI_PROMPT_PARAMS },
  siliconflow: { ...DEFAULT_SILICONFLOW_PROMPT_PARAMS },
  qianfan: { ...DEFAULT_QIANFAN_PROMPT_PARAMS },
  volcengine: { ...DEFAULT_VOLCENGINE_PROMPT_PARAMS },
  gemini: { ...DEFAULT_GEMINI_PROMPT_PARAMS },
  openai: { ...DEFAULT_OPENAI_PROMPT_PARAMS },
  custom: { ...DEFAULT_CUSTOM_PROMPT_PARAMS },
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function clampFloat(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function normalizeCommonPromptParams(raw: unknown): ImageGenCommonPromptParams {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const prefix = readString(o.extraPositivePrefix)
  const suffix = readString(o.extraPositiveSuffix)
  let extraPositivePrompt = readString(o.extraPositivePrompt)
  if (!extraPositivePrompt.trim() && (prefix.trim() || suffix.trim())) {
    extraPositivePrompt = joinPromptParts(prefix, suffix)
  }
  return {
    extraPositivePrompt,
    extraPositivePrefix: prefix,
    extraPositiveSuffix: suffix,
  }
}

function normalizeNovelaiPromptParams(raw: unknown): NovelaiPromptParams {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const sampler = readString(o.sampler, DEFAULT_NOVELAI_PROMPT_PARAMS.sampler)
  const validSampler = NOVELAI_SAMPLER_OPTIONS.some((s) => s.id === sampler)
    ? sampler
    : DEFAULT_NOVELAI_PROMPT_PARAMS.sampler
  return {
    steps: clampInt(o.steps, 1, 50, DEFAULT_NOVELAI_PROMPT_PARAMS.steps),
    cfg: clampFloat(o.cfg, 1, 20, DEFAULT_NOVELAI_PROMPT_PARAMS.cfg),
    sampler: validSampler,
    styleReference: readString(o.styleReference),
    positivePrefix: readString(o.positivePrefix),
    negativePrompt: readString(o.negativePrompt),
  }
}

function normalizeSiliconflowPromptParams(raw: unknown): SiliconflowPromptParams {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    steps: clampInt(o.steps, 1, 50, DEFAULT_SILICONFLOW_PROMPT_PARAMS.steps),
    cfg: clampFloat(o.cfg, 1, 20, DEFAULT_SILICONFLOW_PROMPT_PARAMS.cfg),
    guidanceScale: clampFloat(o.guidanceScale, 1, 20, DEFAULT_SILICONFLOW_PROMPT_PARAMS.guidanceScale),
    negativePrompt: readString(o.negativePrompt),
  }
}

function normalizeQianfanPromptParams(raw: unknown): QianfanPromptParams {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { negativePrompt: readString(o.negativePrompt) }
}

function normalizeVolcenginePromptParams(raw: unknown): VolcenginePromptParams {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { negativePrompt: readString(o.negativePrompt) }
}

function normalizeGeminiPromptParams(raw: unknown): GeminiPromptParams {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { negativePrompt: readString(o.negativePrompt) }
}

function normalizeOpenaiPromptParams(raw: unknown): OpenaiPromptParams {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { negativePrompt: readString(o.negativePrompt) }
}

function normalizeCustomPromptParams(raw: unknown): CustomPromptParams {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    steps: clampInt(o.steps, 1, 50, DEFAULT_CUSTOM_PROMPT_PARAMS.steps),
    cfg: clampFloat(o.cfg, 1, 20, DEFAULT_CUSTOM_PROMPT_PARAMS.cfg),
    guidanceScale: clampFloat(o.guidanceScale, 1, 20, DEFAULT_CUSTOM_PROMPT_PARAMS.guidanceScale),
    negativePrompt: readString(o.negativePrompt),
  }
}

export function normalizeImageGenProviderPromptSettings(raw: unknown): ImageGenProviderPromptSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const base: ImageGenProviderPromptSettings = {
    common: normalizeCommonPromptParams(o.common),
    novelai: normalizeNovelaiPromptParams(o.novelai),
    siliconflow: normalizeSiliconflowPromptParams(o.siliconflow),
    qianfan: normalizeQianfanPromptParams(o.qianfan),
    volcengine: normalizeVolcenginePromptParams(o.volcengine),
    gemini: normalizeGeminiPromptParams(o.gemini),
    openai: normalizeOpenaiPromptParams(o.openai),
    custom: normalizeCustomPromptParams(o.custom),
  }
  return migrateLegacyStyleReferenceIntoPositive(base)
}

/** 旧版独立「画师串」并入正面提示词，避免重复注入 */
function migrateLegacyStyleReferenceIntoPositive(
  settings: ImageGenProviderPromptSettings,
): ImageGenProviderPromptSettings {
  const styleRef = settings.novelai.styleReference.trim()
  if (!styleRef) return settings
  const positive = resolveCommonExtraPositivePrompt(settings.common)
  if (positive.toLowerCase().includes(styleRef.toLowerCase())) {
    return {
      ...settings,
      novelai: { ...settings.novelai, styleReference: '' },
    }
  }
  return {
    ...settings,
    common: {
      ...settings.common,
      extraPositivePrompt: joinPromptParts(styleRef, positive),
      extraPositivePrefix: '',
      extraPositiveSuffix: '',
    },
    novelai: { ...settings.novelai, styleReference: '' },
  }
}

export function getDefaultNovelaiCfg(modelName: string): number {
  return isNovelaiV4Model(modelName) ? 5 : 6
}

export function resolveImageGenProvider(
  settings: MomentsImageGenSettings,
): MomentsImageProvider {
  return settings.provider ?? inferMomentsImageProviderFromModelId(settings.modelId)
}

export function resolveProviderPromptSettings(
  settings: MomentsImageGenSettings,
  _provider: MomentsImageProvider = resolveImageGenProvider(settings),
): ImageGenProviderPromptSettings {
  return normalizeImageGenProviderPromptSettings(settings.providerPromptSettings)
}

export type ImageGenModelPromptKind =
  | 'novelai'
  | 'siliconflow-qwen'
  | 'siliconflow-kolors'
  | 'siliconflow-diffusion'
  | 'qianfan-flux'
  | 'qianfan-musesteamer'
  | 'volcengine-seedream'
  | 'gemini-native'
  | 'gemini-imagen'
  | 'openai-gpt-image'
  | 'openai-dalle'
  | 'custom-diffusion'
  | 'generic'

export type ImageGenPromptSettingsScope = Exclude<keyof ImageGenProviderPromptSettings, 'common'>

export type ImageGenModelPromptProfile = {
  kind: ImageGenModelPromptKind
  modelName: string
  label: string
  settingsScope: ImageGenPromptSettingsScope
  supportsNegative: boolean
  fieldMetas: ImageGenPromptFieldMeta[]
}

function isQwenImageModelName(modelName: string): boolean {
  return /Qwen\/Qwen-Image/i.test(modelName) && !/Edit/i.test(modelName)
}

function isKolorsModelName(modelName: string): boolean {
  return /Kolors/i.test(modelName)
}

function isDiffusionLikeModelName(modelName: string): boolean {
  const lower = modelName.toLowerCase()
  return /flux|stable[\s-]?diffusion|sdxl|sd3|seedream|realvis|dreamshaper|pixart|playground|cogview|wanx|z-image|midjourney|black-forest|bfl-/i.test(
    lower,
  )
}

function isGptImageModelName(modelName: string): boolean {
  return isGptImageModel(modelName) || /gpt-image/i.test(modelName)
}

function isDalleModelName(modelName: string): boolean {
  return /dall-?e/i.test(modelName)
}

function isSeedreamModelName(modelName: string): boolean {
  return /seedream|doubao-seedream/i.test(modelName)
}

/** 按当前选中的生图模型推断可调参数类型（与 provider 解耦，NAI 中转也走 novelai 配置） */
export function resolveImageGenModelPromptKind(
  provider: MomentsImageProvider,
  modelName: string,
): ImageGenModelPromptKind {
  if (isNovelaiImageModelName(modelName)) return 'novelai'
  if (provider === 'gemini' || provider === 'custom') {
    if (isGeminiImagenModel(modelName)) return 'gemini-imagen'
    if (isGeminiNativeImageModel(modelName) || /gemini-.*image/i.test(modelName)) return 'gemini-native'
  }
  if (provider === 'openai' || provider === 'custom') {
    if (isGptImageModelName(modelName)) return 'openai-gpt-image'
    if (isDalleModelName(modelName)) return 'openai-dalle'
  }
  if (provider === 'volcengine' || (provider === 'custom' && isSeedreamModelName(modelName))) {
    return 'volcengine-seedream'
  }
  if (provider === 'qianfan') {
    return isQianfanMuseSteamerModel(modelName) ? 'qianfan-musesteamer' : 'qianfan-flux'
  }
  if (isQwenImageModelName(modelName)) {
    return provider === 'siliconflow' ? 'siliconflow-qwen' : 'siliconflow-qwen'
  }
  if (isKolorsModelName(modelName)) {
    return provider === 'siliconflow' ? 'siliconflow-kolors' : 'siliconflow-kolors'
  }
  if (provider === 'siliconflow' && isDiffusionLikeModelName(modelName)) return 'siliconflow-diffusion'
  if (provider === 'custom' && isDiffusionLikeModelName(modelName)) return 'custom-diffusion'
  if (provider === 'siliconflow') return 'siliconflow-diffusion'
  if (provider === 'custom') return 'custom-diffusion'
  return 'generic'
}

function resolveSettingsScopeForKind(kind: ImageGenModelPromptKind): ImageGenPromptSettingsScope {
  switch (kind) {
    case 'novelai':
      return 'novelai'
    case 'siliconflow-qwen':
    case 'siliconflow-kolors':
    case 'siliconflow-diffusion':
      return 'siliconflow'
    case 'qianfan-flux':
    case 'qianfan-musesteamer':
      return 'qianfan'
    case 'volcengine-seedream':
      return 'volcengine'
    case 'gemini-native':
    case 'gemini-imagen':
      return 'gemini'
    case 'openai-gpt-image':
    case 'openai-dalle':
      return 'openai'
    case 'custom-diffusion':
      return 'custom'
    default:
      return 'custom'
  }
}

function buildNovelaiFieldMetas(modelName: string, relay = false): ImageGenPromptFieldMeta[] {
  void modelName
  void relay
  return [
    { id: 'novelai.steps', label: '采样步数', type: 'number', min: 1, max: 50, step: 1 },
    { id: 'novelai.cfg', label: '提示词相关性（CFG）', type: 'number', min: 1, max: 20, step: 0.5 },
    {
      id: 'novelai.sampler',
      label: '采样器',
      type: 'select',
      options: NOVELAI_SAMPLER_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
    },
    {
      id: 'novelai.negativePrompt',
      label: '负面提示词',
      description: '留空则不注入；生图时写入 NovelAI 的 uc / v4_negative_prompt',
      type: 'textarea',
    },
  ]
}

function buildModelSpecificFieldMetas(
  kind: ImageGenModelPromptKind,
  modelName: string,
  provider: MomentsImageProvider,
): ImageGenPromptFieldMeta[] {
  switch (kind) {
    case 'novelai':
      return buildNovelaiFieldMetas(modelName, provider === 'custom')
    case 'siliconflow-qwen':
      return [
        { id: 'siliconflow.steps', label: '采样步数', type: 'number', min: 1, max: 50, step: 1 },
        { id: 'siliconflow.cfg', label: 'CFG', type: 'number', min: 1, max: 20, step: 0.5 },
        {
          id: 'siliconflow.negativePrompt',
          label: '负面提示词',
          description: 'Qwen-Image 若接口支持 negative_prompt 将一并提交',
          type: 'textarea',
        },
      ]
    case 'siliconflow-kolors':
      return [
        { id: 'siliconflow.steps', label: '采样步数', type: 'number', min: 1, max: 50, step: 1 },
        {
          id: 'siliconflow.guidanceScale',
          label: 'Guidance Scale',
          type: 'number',
          min: 1,
          max: 20,
          step: 0.5,
        },
        {
          id: 'siliconflow.negativePrompt',
          label: '负面提示词',
          description: 'Kolors 若接口支持 negative_prompt 将一并提交',
          type: 'textarea',
        },
      ]
    case 'siliconflow-diffusion':
      return [
        { id: 'siliconflow.steps', label: '采样步数', type: 'number', min: 1, max: 50, step: 1 },
        {
          id: 'siliconflow.negativePrompt',
          label: '负面提示词',
          description: 'Flux / SD 等模型若接口支持 negative_prompt 将一并提交',
          type: 'textarea',
        },
      ]
    case 'custom-diffusion':
      return [
        { id: 'custom.steps', label: '采样步数', type: 'number', min: 1, max: 50, step: 1 },
        { id: 'custom.cfg', label: 'CFG', type: 'number', min: 1, max: 20, step: 0.5 },
        {
          id: 'custom.guidanceScale',
          label: 'Guidance Scale',
          type: 'number',
          min: 1,
          max: 20,
          step: 0.5,
        },
        {
          id: 'custom.negativePrompt',
          label: '负面提示词',
          description: '兼容接口若支持 negative_prompt 将一并提交',
          type: 'textarea',
        },
      ]
    case 'qianfan-flux':
    case 'qianfan-musesteamer':
      return [
        {
          id: 'qianfan.negativePrompt',
          label: '负面提示词',
          description: '若千帆接口支持将一并提交',
          type: 'textarea',
        },
      ]
    case 'volcengine-seedream':
      return [
        {
          id: 'volcengine.negativePrompt',
          label: '负面提示词',
          description: '豆包 Seedream 接口通常不支持负面词，仅作记录',
          type: 'textarea',
        },
      ]
    case 'gemini-native':
    case 'gemini-imagen':
      return [
        {
          id: 'gemini.negativePrompt',
          label: '负面提示词',
          description: 'Gemini / Imagen 接口不支持负面提示词，仅作备注',
          type: 'textarea',
        },
      ]
    case 'openai-gpt-image':
    case 'openai-dalle':
      return [
        {
          id: 'openai.negativePrompt',
          label: '负面提示词',
          description: 'OpenAI 文生图接口不支持负面提示词，仅作备注',
          type: 'textarea',
        },
      ]
    default:
      return []
  }
}

function labelForModelPromptKind(kind: ImageGenModelPromptKind, modelName: string): string {
  const short = modelName.includes('/') ? modelName.slice(modelName.lastIndexOf('/') + 1) : modelName
  switch (kind) {
    case 'novelai':
      return `NovelAI · ${short}`
    case 'siliconflow-qwen':
      return `Qwen-Image · ${short}`
    case 'siliconflow-kolors':
      return `Kolors · ${short}`
    case 'siliconflow-diffusion':
      return `Diffusion · ${short}`
    case 'custom-diffusion':
      return `Diffusion（中转）· ${short}`
    case 'qianfan-flux':
      return `千帆 Flux · ${short}`
    case 'qianfan-musesteamer':
      return `千帆蒸汽机 · ${short}`
    case 'volcengine-seedream':
      return `Seedream · ${short}`
    case 'gemini-native':
      return `Gemini 原生 · ${short}`
    case 'gemini-imagen':
      return `Imagen · ${short}`
    case 'openai-gpt-image':
      return `GPT Image · ${short}`
    case 'openai-dalle':
      return `DALL·E · ${short}`
    default:
      return short || '当前模型'
  }
}

export function resolveImageGenModelPromptProfile(
  provider: MomentsImageProvider,
  modelName: string,
): ImageGenModelPromptProfile {
  const kind = resolveImageGenModelPromptKind(provider, modelName)
  const settingsScope = resolveSettingsScopeForKind(kind)
  const modelFields = buildModelSpecificFieldMetas(kind, modelName, provider)
  const supportsNegative =
    kind === 'novelai' ||
    kind === 'siliconflow-qwen' ||
    kind === 'siliconflow-kolors' ||
    kind === 'siliconflow-diffusion' ||
    kind === 'custom-diffusion' ||
    kind === 'qianfan-flux' ||
    kind === 'qianfan-musesteamer'

  return {
    kind,
    modelName,
    label: labelForModelPromptKind(kind, modelName),
    settingsScope,
    supportsNegative,
    fieldMetas: modelFields,
  }
}

/** 当前模型负面提示词在 providerPromptSettings 中的路径 */
export function resolveImageGenNegativePromptFieldPath(
  provider: MomentsImageProvider,
  modelName: string,
): string | null {
  const profile = resolveImageGenModelPromptProfile(provider, modelName)
  const hasNegative = profile.fieldMetas.some((f) => f.id.endsWith('.negativePrompt'))
  return hasNegative ? `${profile.settingsScope}.negativePrompt` : null
}

export function resolveImageGenModelPromptProfileFromSettings(
  settings: MomentsImageGenSettings,
): ImageGenModelPromptProfile {
  const provider = resolveImageGenProvider(settings)
  const { modelName } = parseMomentsImageModelId(settings.modelId)
  return resolveImageGenModelPromptProfile(provider, modelName)
}

export function resolveEffectiveNegativePrompt(
  settings: MomentsImageGenSettings,
  provider: MomentsImageProvider = resolveImageGenProvider(settings),
  modelName?: string,
): string | null {
  const resolvedModelName = modelName ?? parseMomentsImageModelId(settings.modelId).modelName
  const profile = resolveImageGenModelPromptProfile(provider, resolvedModelName)
  const params = resolveProviderPromptSettings(settings, provider)
  const scope = profile.settingsScope

  const custom = (() => {
    switch (scope) {
      case 'novelai':
        return params.novelai.negativePrompt.trim()
      case 'siliconflow':
        return params.siliconflow.negativePrompt.trim()
      case 'qianfan':
        return params.qianfan.negativePrompt.trim()
      case 'volcengine':
        return params.volcengine.negativePrompt.trim()
      case 'gemini':
        return params.gemini.negativePrompt.trim()
      case 'openai':
        return params.openai.negativePrompt.trim()
      case 'custom':
        return params.custom.negativePrompt.trim()
      default:
        return ''
    }
  })()

  return custom || null
}

function joinPromptParts(...parts: Array<string | undefined | null>): string {
  return parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ')
}

/** 读取生效中的统一正面附加提示词（含旧版 prefix/suffix 迁移） */
export function resolveCommonExtraPositivePrompt(common: ImageGenCommonPromptParams): string {
  const unified = common.extraPositivePrompt.trim()
  if (unified) return unified
  return joinPromptParts(common.extraPositivePrefix, common.extraPositiveSuffix)
}

/** @deprecated 画师串已并入正面提示词；保留空实现以兼容旧引用 */
export function resolveEffectiveStyleReference(
  _settings: MomentsImageGenSettings,
  _provider: MomentsImageProvider,
  _modelName: string,
): string {
  return ''
}

/** 将模型专用与通用正面提示词拼接到 buildFullPrompt 结果上 */
export function augmentPositivePromptForProvider(
  basePrompt: string,
  settings: MomentsImageGenSettings,
  provider: MomentsImageProvider = resolveImageGenProvider(settings),
  _modelName?: string,
): string {
  const params = resolveProviderPromptSettings(settings, provider)
  const extraPositive = resolveCommonExtraPositivePrompt(params.common)
  return joinPromptParts(extraPositive, basePrompt)
}

export type AugmentedImageGenPromptParts = {
  extraPositivePrompt: string
  styleReference: string
  scenePrompt: string
  final: string
}

/** 拆解最终正面提示词各段，供预览与控制台展示 */
export function buildAugmentedPositivePromptParts(
  basePrompt: string,
  settings: MomentsImageGenSettings,
  provider: MomentsImageProvider = resolveImageGenProvider(settings),
  _modelName?: string,
): AugmentedImageGenPromptParts {
  const params = resolveProviderPromptSettings(settings, provider)
  const extraPositivePrompt = resolveCommonExtraPositivePrompt(params.common).trim()
  const scenePrompt = basePrompt.trim()
  const parts = {
    extraPositivePrompt,
    styleReference: '',
    scenePrompt,
    final: joinPromptParts(extraPositivePrompt, scenePrompt),
  }
  return parts
}

const IMAGEGEN_CONSOLE_PROMPT_MAX = 480

/** 控制台展示生图 API 正面提示词 */
export function formatImageGenApiPromptForConsole(
  parts: AugmentedImageGenPromptParts,
  opts?: { messageId?: string; label?: string; sizeLabel?: string },
): string {
  const label = opts?.label ?? 'api 正面提示词'
  const idPart = opts?.messageId?.trim() ? ` id=${opts.messageId.trim()}` : ''
  const lines: string[] = [`[imagegen] ${label}${idPart}`]
  const sizeLabel = opts?.sizeLabel?.trim()
  if (sizeLabel) lines.push(`尺寸: ${sizeLabel}`)
  const extra = parts.extraPositivePrompt?.trim()
  if (extra) {
    const extraShort =
      extra.length > IMAGEGEN_CONSOLE_PROMPT_MAX
        ? `${extra.slice(0, IMAGEGEN_CONSOLE_PROMPT_MAX)}…`
        : extra
    lines.push(`正面附加: ${extraShort}`)
  }
  const scene = parts.scenePrompt?.trim()
  if (scene) {
    const sceneShort =
      scene.length > IMAGEGEN_CONSOLE_PROMPT_MAX
        ? `${scene.slice(0, IMAGEGEN_CONSOLE_PROMPT_MAX)}…`
        : scene
    lines.push(sceneShort)
  } else if (lines.length === 1 && parts.final?.trim()) {
    const final = parts.final.trim()
    lines.push(
      final.length > IMAGEGEN_CONSOLE_PROMPT_MAX
        ? `${final.slice(0, IMAGEGEN_CONSOLE_PROMPT_MAX)}…`
        : final,
    )
  }
  return lines.length > 1 ? lines.join('\n') : lines[0] ?? ''
}

export function resolveNovelaiGenerationParams(
  settings: MomentsImageGenSettings,
  modelName: string,
): {
  steps: number
  cfg: number
  sampler: string
  negativePrompt: string
} {
  const params = resolveProviderPromptSettings(settings).novelai
  const defaultCfg = getDefaultNovelaiCfg(modelName)
  let cfg = params.cfg > 0 ? params.cfg : defaultCfg
  if (!isNovelaiV4Model(modelName) && cfg === DEFAULT_NOVELAI_PROMPT_PARAMS.cfg) {
    cfg = defaultCfg
  }
  const provider = resolveImageGenProvider(settings)
  const negativePrompt = resolveEffectiveNegativePrompt(settings, provider, modelName) ?? ''
  return {
    steps: params.steps,
    cfg,
    sampler: params.sampler,
    negativePrompt,
  }
}

export function modelSupportsNegativePrompt(
  provider: MomentsImageProvider,
  modelName: string,
): boolean {
  return resolveImageGenModelPromptProfile(provider, modelName).supportsNegative
}

/** @deprecated 使用 modelSupportsNegativePrompt */
export function providerSupportsNegativePrompt(provider: MomentsImageProvider): boolean {
  return provider !== 'gemini' && provider !== 'openai' && provider !== 'volcengine'
}

/** @deprecated 使用 resolveImageGenModelPromptProfile */
export function providerSupportsSamplingParams(provider: MomentsImageProvider): boolean {
  return provider === 'novelai' || provider === 'siliconflow' || provider === 'custom'
}

export type ImageGenPromptFieldMeta = {
  id: string
  label: string
  description?: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'toggle'
  min?: number
  max?: number
  step?: number
  options?: Array<{ id: string; label: string }>
}

export function getImageGenPromptFieldMetas(
  provider: MomentsImageProvider,
  modelName = '',
): ImageGenPromptFieldMeta[] {
  if (!modelName.trim()) return []
  return resolveImageGenModelPromptProfile(provider, modelName).fieldMetas
}

/** @deprecated 使用 getImageGenPromptFieldMetas */
export function getProviderPromptFieldMetas(
  provider: MomentsImageProvider,
  modelName?: string,
): ImageGenPromptFieldMeta[] {
  return getImageGenPromptFieldMetas(provider, modelName ?? '')
}

export function patchProviderPromptSettings(
  current: ImageGenProviderPromptSettings | undefined,
  path: string,
  value: string | number | boolean,
): ImageGenProviderPromptSettings {
  const base = normalizeImageGenProviderPromptSettings(current)
  const [scope, field] = path.split('.') as [keyof ImageGenProviderPromptSettings, string]
  if (!scope || !field || !(scope in base)) return base
  const section = base[scope] as unknown as Record<string, unknown>
  return {
    ...base,
    [scope]: { ...section, [field]: value },
  }
}

export function readProviderPromptValue(
  settings: ImageGenProviderPromptSettings,
  path: string,
): string | number | boolean {
  const [scope, field] = path.split('.') as [keyof ImageGenProviderPromptSettings, string]
  if (!scope || !field) return ''
  const section = settings[scope] as unknown as Record<string, unknown>
  const value = section[field]
  if (typeof value === 'boolean' || typeof value === 'number') return value
  return typeof value === 'string' ? value : ''
}

export function resolveModelNameFromSettings(settings: MomentsImageGenSettings): string {
  const { modelName } = parseMomentsImageModelId(settings.modelId)
  return modelName
}
