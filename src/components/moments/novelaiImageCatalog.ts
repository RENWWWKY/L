import type { MomentsImageModelOption } from './momentsImageModelCatalog'

const NOVELAI_SUBSCRIPTION_URL = 'https://api.novelai.net/user/subscription'

type NovelaiModelDef = {
  modelName: string
  labelZh: string
  description: string
  priceLabel?: string
}

const NOVELAI_IMAGE_MODEL_DEFS: NovelaiModelDef[] = [
  {
    modelName: 'nai-diffusion-4-5-full',
    labelZh: 'NAI Diffusion 4.5 Full',
    description: '最新 4.5 完整模型，细节与可控性最佳',
    priceLabel: '按 Anlas 计费',
  },
  {
    modelName: 'nai-diffusion-4-5-curated',
    labelZh: 'NAI Diffusion 4.5 Curated',
    description: '4.5 精选版，更稳定、更省 Anlas',
    priceLabel: '按 Anlas 计费',
  },
  {
    modelName: 'nai-diffusion-4-full',
    labelZh: 'NAI Diffusion 4 Full',
    description: 'V4 完整模型',
    priceLabel: '按 Anlas 计费',
  },
  {
    modelName: 'nai-diffusion-4-curated-preview',
    labelZh: 'NAI Diffusion 4 Curated',
    description: 'V4 精选预览版',
    priceLabel: '按 Anlas 计费',
  },
  {
    modelName: 'nai-diffusion-3',
    labelZh: 'NAI Diffusion 3',
    description: '经典 V3 模型',
    priceLabel: '按 Anlas 计费',
  },
]

export const DEFAULT_NOVELAI_IMAGE_MODEL_ID = 'novelai:nai-diffusion-4-5-full'

export const NOVELAI_IMAGE_API_URL = 'https://image.novelai.net/ai/generate-image'

export const NOVELAI_ACCOUNT_URL = 'https://novelai.net/account'

function toCatalogOption(def: NovelaiModelDef): MomentsImageModelOption {
  return {
    id: `novelai:${def.modelName}`,
    modelName: def.modelName,
    labelZh: def.labelZh,
    title: def.labelZh,
    brand: 'NovelAI',
    description: def.description,
    free: false,
    priceLabel: def.priceLabel ?? '按 Anlas 计费',
  }
}

export function buildNovelaiImageModelCatalog(): MomentsImageModelOption[] {
  return NOVELAI_IMAGE_MODEL_DEFS.map(toCatalogOption)
}

export function isNovelaiV4Model(modelName: string): boolean {
  return /nai-diffusion-4|nai-diffusion-4-5/i.test(modelName)
}

/** 识别 NovelAI 模型名（含中转站常见前缀/别名） */
export function isNovelaiImageModelName(modelName: string): boolean {
  const core = modelName
    .trim()
    .replace(/^(?:\[[^\]]+\]|Pro\/)+/gi, '')
    .trim()
    .toLowerCase()
  return (
    /^nai-diffusion(?:-|$)/i.test(core) ||
    /^novelai(?:[\/:_-]|$)/i.test(core) ||
    /(?:^|[\/:_-])nai-diffusion(?:-|$)/i.test(core)
  )
}

export async function fetchNovelaiImageModelCatalog(apiKey: string): Promise<MomentsImageModelOption[]> {
  const key = apiKey.trim()
  if (!key) throw new Error('请先填写 NovelAI API Key')

  try {
    const res = await fetch(NOVELAI_SUBSCRIPTION_URL, {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `NovelAI 鉴权失败 (${res.status})`)
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('鉴权')) throw e
    // 网络受限时仍允许使用静态模型列表
  }

  return buildNovelaiImageModelCatalog()
}

export function snapNovelaiDimension(n: number): number {
  const clamped = Math.max(64, Math.min(1536, Math.round(n)))
  return Math.round(clamped / 64) * 64
}

/** 从中转站模型名提取 NovelAI 官方 model 字段 */
export function normalizeNovelaiRelayModelName(modelName: string): string {
  const core = modelName
    .trim()
    .replace(/^(?:\[[^\]]+\]|Pro\/)+/gi, '')
    .trim()
  const matched = core.match(/(nai-diffusion(?:-[\w-]+)?)/i)
  if (matched?.[1]) return matched[1].toLowerCase()
  return core.replace(/^novelai[\/:_-]?/i, '')
}

/** 为官方 NAI 与 OpenAI 兼容中转补齐多种常见尺寸字段 */
export function applyNovelaiSizeFieldsToRequestBody(
  body: Record<string, unknown>,
  width: number,
  height: number,
  imageSize?: string,
): { width: number; height: number; size: string } {
  const w = snapNovelaiDimension(width)
  const h = snapNovelaiDimension(height)
  const size = imageSize?.trim() || `${w}x${h}`
  body.width = w
  body.height = h
  body.size = size
  const existing =
    body.parameters && typeof body.parameters === 'object'
      ? (body.parameters as Record<string, unknown>)
      : {}
  body.parameters = { ...existing, width: w, height: h }
  return { width: w, height: h, size }
}

export function buildNovelaiRelayEndpointCandidates(apiUrl: string): string[] {
  const base = apiUrl.trim().replace(/\/+$/, '')
  if (!base) return []
  const candidates = new Set<string>()
  if (/\/ai\/generate-image$/i.test(base)) candidates.add(base)
  if (/\/v1$/i.test(base)) candidates.add(`${base.replace(/\/v1$/i, '')}/ai/generate-image`)
  candidates.add(`${base}/ai/generate-image`)
  if (/\/v1$/i.test(base)) candidates.add(`${base}/ai/generate-image`)
  return [...candidates]
}

/** OpenAI 兼容中转（/v1）优先走 /images/generations，避免先请求不存在的 /ai/generate-image 产生 500 */
export function shouldPreferNovelaiCustomGenerationsRoute(apiUrl: string): boolean {
  const base = apiUrl.trim().replace(/\/+$/, '')
  if (!base) return false
  if (/\/ai\/generate-image$/i.test(base)) return false
  return /\/v1$/i.test(base) || !/\/ai\//i.test(base)
}

export function buildNovelaiImageRequestBody(input: {
  prompt: string
  modelName: string
  width: number
  height: number
  steps: number
  cfg: number
  sampler: string
  negativePrompt: string
}): Record<string, unknown> {
  const model = normalizeNovelaiRelayModelName(input.modelName)
  if (isNovelaiV4Model(model)) {
    return {
      input: input.prompt,
      model,
      action: 'generate',
      parameters: {
        params_version: 3,
        width: input.width,
        height: input.height,
        scale: input.cfg,
        sampler: input.sampler,
        steps: input.steps,
        n_samples: 1,
        ucPreset: 0,
        qualityToggle: true,
        v4_prompt: {
          caption: { base_caption: input.prompt, char_captions: [] },
          use_coords: false,
          use_order: true,
        },
        v4_negative_prompt: {
          caption: { base_caption: input.negativePrompt },
        },
      },
    }
  }
  return {
    input: input.prompt,
    model,
    action: 'generate',
    parameters: {
      width: input.width,
      height: input.height,
      scale: input.cfg,
      sampler: input.sampler,
      steps: input.steps,
      n_samples: 1,
      uc: input.negativePrompt,
    },
  }
}
