import type { MomentsImageModelOption } from './momentsImageModelCatalog'
import type { MomentsImageSizeOption } from './momentsImageSizePresets'

type OpenAiImageModelDef = {
  modelName: string
  labelZh: string
  description: string
  priceLabel?: string
}

const OPENAI_IMAGE_MODEL_DEFS: OpenAiImageModelDef[] = [
  {
    modelName: 'gpt-image-1',
    labelZh: 'GPT Image 1',
    description: 'OpenAI 最新 GPT 生图模型，质量与语义理解最佳',
    priceLabel: '按 OpenAI 计费',
  },
  {
    modelName: 'dall-e-3',
    labelZh: 'DALL·E 3',
    description: '经典 DALL·E 3 文生图',
    priceLabel: '按 OpenAI 计费',
  },
  {
    modelName: 'dall-e-2',
    labelZh: 'DALL·E 2',
    description: 'DALL·E 2 文生图（更经济）',
    priceLabel: '按 OpenAI 计费',
  },
]

export const DEFAULT_OPENAI_IMAGE_MODEL_ID = 'openai:gpt-image-1'

export const OPENAI_IMAGE_API_URL = 'https://api.openai.com/v1/images/generations'

export const OPENAI_IMAGE_EDITS_API_URL = 'https://api.openai.com/v1/images/edits'

/** GPT Image 系列（gpt-image-1 / 1.5 / mini / 2 等）支持 /images/edits 参考图生图；兼容中转站前缀如 [特价]gpt-image-2 */
export function isGptImageModel(modelName: string): boolean {
  return /gpt-image/i.test(modelName.trim())
}

export const OPENAI_PLATFORM_URL = 'https://platform.openai.com/api-keys'

const GPT_IMAGE_SIZES: MomentsImageSizeOption[] = [
  { id: '1024x1024', label: '1024×1024', width: 1024, height: 1024, apiSize: '1024x1024' },
  { id: '1536x1024', label: '1536×1024', width: 1536, height: 1024, apiSize: '1536x1024' },
  { id: '1024x1536', label: '1024×1536', width: 1024, height: 1536, apiSize: '1024x1536' },
  { id: 'auto', label: '自动', width: 1024, height: 1024, apiSize: 'auto' },
]

const DALLE3_SIZES: MomentsImageSizeOption[] = [
  { id: '1024x1024', label: '1024×1024', width: 1024, height: 1024, apiSize: '1024x1024' },
  { id: '1792x1024', label: '1792×1024', width: 1792, height: 1024, apiSize: '1792x1024' },
  { id: '1024x1792', label: '1024×1792', width: 1024, height: 1792, apiSize: '1024x1792' },
]

const DALLE2_SIZES: MomentsImageSizeOption[] = [
  { id: '256x256', label: '256×256', width: 256, height: 256, apiSize: '256x256' },
  { id: '512x512', label: '512×512', width: 512, height: 512, apiSize: '512x512' },
  { id: '1024x1024', label: '1024×1024', width: 1024, height: 1024, apiSize: '1024x1024' },
]

function toCatalogOption(def: OpenAiImageModelDef): MomentsImageModelOption {
  return {
    id: `openai:${def.modelName}`,
    modelName: def.modelName,
    labelZh: def.labelZh,
    title: def.labelZh,
    brand: 'OpenAI',
    description: def.description,
    free: false,
    priceLabel: def.priceLabel ?? '按 OpenAI 计费',
  }
}

export function buildOpenaiImageModelCatalog(): MomentsImageModelOption[] {
  return OPENAI_IMAGE_MODEL_DEFS.map(toCatalogOption)
}

export async function fetchOpenaiImageModelCatalog(apiKey: string): Promise<MomentsImageModelOption[]> {
  const key = apiKey.trim()
  if (!key) throw new Error('请先填写 OpenAI API Key')
  return buildOpenaiImageModelCatalog()
}

export function getOpenaiImageSizes(modelName: string): MomentsImageSizeOption[] {
  if (modelName === 'dall-e-2') return DALLE2_SIZES
  if (modelName === 'dall-e-3') return DALLE3_SIZES
  return GPT_IMAGE_SIZES
}

export function resolveOpenaiImageSize(
  modelName: string,
  width: number,
  height: number,
  imageSize?: string,
): string {
  if (imageSize) return imageSize
  const sizes = getOpenaiImageSizes(modelName)
  const targetRatio = width / height
  let best = sizes[0]!.apiSize
  let bestScore = Number.POSITIVE_INFINITY
  for (const s of sizes) {
    if (s.apiSize === 'auto') continue
    const ratio = s.width / s.height
    const score = Math.abs(Math.log(ratio / targetRatio))
    if (score < bestScore) {
      bestScore = score
      best = s.apiSize
    }
  }
  return best
}
