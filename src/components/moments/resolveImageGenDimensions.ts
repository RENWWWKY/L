import {
  getSupportedImageSizes,
  pickDefaultImageSize,
  type MomentsImageSizeOption,
} from './momentsImageSizePresets'
import {
  inferCharacterMediaImageAspectPreference,
  pickImageSizeForAspectPreference,
} from './resolveCharacterMediaImageAspect'
import {
  inferMomentsImageProviderFromModelId,
  parseMomentsImageModelId,
} from './momentsImageModelCatalog'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

export type ResolvedImageGenDimensions = {
  sizeId: string
  width: number
  height: number
  imageSize: string
}

export type ImageGenSizeMode = 'fixed' | 'random' | 'scene'

function toResolved(size: MomentsImageSizeOption): ResolvedImageGenDimensions {
  return {
    sizeId: size.id,
    width: size.width,
    height: size.height,
    imageSize: size.apiSize,
  }
}

export function normalizeImageSizePoolIds(
  poolIds: string[] | undefined,
  sizes: MomentsImageSizeOption[],
): string[] {
  if (!poolIds?.length) return sizes.map((s) => s.id)
  const valid = new Set(sizes.map((s) => s.id))
  const filtered = poolIds.filter((id) => valid.has(id))
  return filtered.length ? filtered : sizes.map((s) => s.id)
}

export function resolveImageGenDimensions(
  settings: MomentsImageGenSettings,
  options?: {
    rng?: () => number
    /** 角色私聊/群聊配图：scene 模式下按竖横方推断尺寸 */
    prompt?: string
    context?: 'moments' | 'character_media' | 'dating_plot'
  },
): ResolvedImageGenDimensions {
  const rng = options?.rng ?? Math.random
  const provider = settings.provider ?? inferMomentsImageProviderFromModelId(settings.modelId)
  const { modelName } = parseMomentsImageModelId(settings.modelId)
  const sizes = getSupportedImageSizes(provider, modelName)
  if (!sizes.length) {
    return { sizeId: '1024x1024', width: 1024, height: 1024, imageSize: '1024x1024' }
  }

  const mode: ImageGenSizeMode =
    settings.imageSizeMode === 'random'
      ? 'random'
      : settings.imageSizeMode === 'fixed'
        ? 'fixed'
        : 'scene'
  const poolIds = normalizeImageSizePoolIds(settings.imageSizePoolIds, sizes)
  const pool = sizes.filter((s) => poolIds.includes(s.id))
  const effectivePool = pool.length ? pool : sizes

  if (
    mode === 'scene' &&
    options?.context === 'character_media' &&
    options.prompt?.trim()
  ) {
    const pref = inferCharacterMediaImageAspectPreference(options.prompt)
    const picked = pickImageSizeForAspectPreference(effectivePool, pref)
    if (picked) return toResolved(picked)
  }

  if (mode === 'random') {
    const index = Math.min(
      effectivePool.length - 1,
      Math.max(0, Math.floor(rng() * effectivePool.length)),
    )
    return toResolved(effectivePool[index]!)
  }

  const fixed =
    pickDefaultImageSize(sizes, settings.imageSizeId?.trim() || undefined) ?? effectivePool[0]!
  return toResolved(fixed)
}
