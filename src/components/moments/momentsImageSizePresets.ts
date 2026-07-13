import type { MomentsImageProvider } from './momentsImageModelCatalog'
import { isNovelaiImageModelName } from './novelaiImageCatalog'
import { getOpenaiImageSizes } from './openaiImageCatalog'

export type MomentsImageSizeOption = {
  id: string
  label: string
  width: number
  height: number
  /** 传给各平台 API 的 size / image_size 参数 */
  apiSize: string
}

function size(
  id: string,
  width: number,
  height: number,
  apiSize: string = `${width}x${height}`,
): MomentsImageSizeOption {
  return { id, label: `${width}×${height}`, width, height, apiSize }
}

export const KOLORS_IMAGE_SIZES = [
  size('1024x1024', 1024, 1024),
  size('960x1280', 960, 1280),
  size('768x1024', 768, 1024),
  size('720x1440', 720, 1440),
  size('720x1280', 720, 1280),
]

export const QWEN_IMAGE_SIZES = [
  size('1328x1328', 1328, 1328),
  size('1664x928', 1664, 928),
  size('928x1664', 928, 1664),
  size('1472x1140', 1472, 1140),
  size('1140x1472', 1140, 1472),
  size('1584x1056', 1584, 1056),
  size('1056x1584', 1056, 1584),
]

export const QIANFAN_IMAGE_SIZES = [
  size('1024x1024', 1024, 1024),
  size('768x1024', 768, 1024),
  size('1024x768', 1024, 768),
  size('720x1280', 720, 1280),
  size('1280x720', 1280, 720),
]

const GENERIC_SILICONFLOW_IMAGE_SIZES = [
  size('512x512', 512, 512),
  size('768x768', 768, 768),
  size('1024x1024', 1024, 1024),
  size('1024x768', 1024, 768),
  size('768x1024', 768, 1024),
  size('1280x720', 1280, 720),
]

/** Seedream 4.0：1K / 2K / 4K */
const VOLCENGINE_SEEDREAM_40_SIZES = [
  size('1k-1-1', 1024, 1024, '1K'),
  size('2k-1-1', 2048, 2048, '2K'),
  size('2k-16-9', 2560, 1440),
  size('2k-4-3', 2304, 1728),
  size('4k-1-1', 4096, 4096, '4K'),
]

/** Seedream 4.5 / 5.0：2K / 4K */
const VOLCENGINE_SEEDREAM_45_50_SIZES = [
  size('2k-1-1', 2048, 2048, '2K'),
  size('2k-16-9', 2560, 1440),
  size('2k-4-3', 2304, 1728),
  size('2k-3-2', 2496, 1664),
  size('4k-1-1', 4096, 4096, '4K'),
]

/** Seedream 5.0 Lite：2K / 3K */
const VOLCENGINE_SEEDREAM_50_LITE_SIZES = [
  size('2k-1-1', 2048, 2048, '2K'),
  size('2k-16-9', 2560, 1440),
  size('2k-4-3', 2304, 1728),
  size('3k-1-1', 3072, 3072, '3K'),
]

/** Seedream 3.0 及更早 */
const VOLCENGINE_SEEDREAM_30_SIZES = [
  size('1024x1024', 1024, 1024),
  size('1024x768', 1024, 768),
  size('768x1024', 768, 1024),
  size('2048x2048', 2048, 2048, '2K'),
]

function getVolcengineImageSizes(modelName: string): MomentsImageSizeOption[] {
  if (/seedream-5-0-lite/i.test(modelName)) return VOLCENGINE_SEEDREAM_50_LITE_SIZES
  if (/seedream-4-5/i.test(modelName) || /seedream-5-0/i.test(modelName)) {
    return VOLCENGINE_SEEDREAM_45_50_SIZES
  }
  if (/seedream-4-0/i.test(modelName)) return VOLCENGINE_SEEDREAM_40_SIZES
  return VOLCENGINE_SEEDREAM_30_SIZES
}

const NOVELAI_IMAGE_SIZES = [
  size('832x1216', 832, 1216),
  size('1216x832', 1216, 832),
  size('1024x1024', 1024, 1024),
  size('768x1024', 768, 1024),
  size('1024x768', 1024, 768),
  size('640x640', 640, 640),
]

const GEMINI_IMAGE_SIZES = [
  size('1024x1024', 1024, 1024),
  size('768x1024', 768, 1024),
  size('1024x768', 1024, 768),
  size('1280x720', 1280, 720),
  size('720x1280', 720, 1280),
]

export function getSupportedImageSizes(
  provider: MomentsImageProvider,
  modelName: string,
): MomentsImageSizeOption[] {
  if (provider === 'volcengine') return getVolcengineImageSizes(modelName)
  if (provider === 'qianfan') return QIANFAN_IMAGE_SIZES
  if (provider === 'novelai') return NOVELAI_IMAGE_SIZES
  if (provider === 'gemini') return GEMINI_IMAGE_SIZES
  if (provider === 'openai') return getOpenaiImageSizes(modelName)
  if (provider === 'custom') {
    if (isNovelaiImageModelName(modelName)) return NOVELAI_IMAGE_SIZES
    if (/gpt-image/i.test(modelName) || /dall-?e/i.test(modelName)) return getOpenaiImageSizes(modelName)
    if (/Qwen\/Qwen-Image/i.test(modelName) && !/Edit/i.test(modelName)) return QWEN_IMAGE_SIZES
    if (/Kolors/i.test(modelName)) return KOLORS_IMAGE_SIZES
    if (/seedream|doubao-seedream/i.test(modelName)) return getVolcengineImageSizes(modelName)
    return GENERIC_SILICONFLOW_IMAGE_SIZES
  }
  if (/Kolors/i.test(modelName)) return KOLORS_IMAGE_SIZES
  if (/Qwen\/Qwen-Image/i.test(modelName) && !/Edit/i.test(modelName)) return QWEN_IMAGE_SIZES
  return GENERIC_SILICONFLOW_IMAGE_SIZES
}

export function pickDefaultImageSize(
  sizes: MomentsImageSizeOption[],
  preferredId?: string,
): MomentsImageSizeOption | undefined {
  if (!sizes.length) return undefined
  if (preferredId) {
    const matched = sizes.find((s) => s.id === preferredId)
    if (matched) return matched
  }
  return sizes.find((s) => s.width === 512 && s.height === 512) ?? sizes[0]
}
