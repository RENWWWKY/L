import { isGeminiImageRouteCandidate, isGeminiNativeImageModel } from './geminiImageCatalog'
import {
  inferMomentsImageProviderFromModelId,
  parseMomentsImageModelId,
  type MomentsImageProvider,
} from './momentsImageModelCatalog'
import { isNovelaiImageModelName } from './novelaiImageCatalog'
import { isGptImageModel } from './openaiImageCatalog'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

export type ImageGenReferenceImageMode = 'none' | 'gemini-inline' | 'gpt-edits'

/** 当前模型是否支持把参考图真正传给生图 API（非仅 prompt 文字描述） */
export function resolveReferenceImageUploadMode(
  provider: MomentsImageProvider,
  modelName: string,
): ImageGenReferenceImageMode {
  if (isGptImageModel(modelName)) return 'gpt-edits'
  if (provider === 'gemini' && isGeminiNativeImageModel(modelName)) return 'gemini-inline'
  if (provider === 'custom') {
    if (isGptImageModel(modelName)) return 'gpt-edits'
    if (isGeminiImageRouteCandidate(modelName) || isGeminiNativeImageModel(modelName)) {
      return 'gemini-inline'
    }
  }
  return 'none'
}

export function modelSupportsReferenceImageUpload(
  provider: MomentsImageProvider,
  modelName: string,
): boolean {
  return resolveReferenceImageUploadMode(provider, modelName) !== 'none'
}

export function modelSupportsReferenceImageUploadFromSettings(
  settings: MomentsImageGenSettings,
): boolean {
  const provider = settings.provider ?? inferMomentsImageProviderFromModelId(settings.modelId)
  const { modelName } = parseMomentsImageModelId(settings.modelId)
  return modelSupportsReferenceImageUpload(provider, modelName)
}

export function referenceImageUploadModeLabel(mode: ImageGenReferenceImageMode): string {
  switch (mode) {
    case 'gpt-edits':
      return 'GPT Image /images/edits'
    case 'gemini-inline':
      return 'Gemini 原生多模态参考图'
    default:
      return ''
  }
}

export function describeReferenceImageSupportForModel(
  provider: MomentsImageProvider,
  modelName: string,
): string {
  const mode = resolveReferenceImageUploadMode(provider, modelName)
  if (mode === 'gpt-edits') {
    return '当前模型支持上传参考图锁脸/锁画风（含第三方 GPT Image 中转，需开通 /images/edits）。'
  }
  if (mode === 'gemini-inline') {
    return '当前模型支持上传参考图锁脸/锁画风（Gemini 原生图模会把参考图一并提交）。'
  }
  if (isNovelaiImageModelName(modelName)) {
    return '当前 NovelAI 模型不支持传参考图，仅可使用风格 Tab 预设与「提示词」Tab 正面提示词；已上传的形象参考图不会送入 API。'
  }
  return '当前模型不支持传参考图，仅可使用风格 Tab 预设；已上传的形象参考图不会送入 API。'
}
