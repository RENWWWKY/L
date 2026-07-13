import {
  DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  parseMomentsImageModelId,
  type MomentsImageProvider,
} from './momentsImageModelCatalog'
import { isQianfanMuseSteamerModel } from './qianfanImageCatalog'
import {
  GEMINI_API_BASE_URL,
  isGeminiImagenModel,
  isGeminiImageRouteCandidate,
  resolveImagenAspectRatio,
} from './geminiImageCatalog'
import {
  mergeGeminiImageRouteErrors,
  shouldRetryGeminiImageViaGenerateContent,
  shouldRetryGeminiImageViaGenerations,
} from './geminiImageRouteCompat'
import { extractPngDataUrlFromBuffer } from './momentsImageGenBinary'
import {
  buildAugmentedPositivePromptParts,
  formatImageGenApiPromptForConsole,
  resolveImageGenModelPromptKind,
  resolveImageGenProvider,
  resolveNovelaiGenerationParams,
  resolveProviderPromptSettings,
} from './imageGenProviderPromptSettings'
import { logConsole } from '../../phone/apps/wechat/consoleLogger'
import { resolveImageGenDimensions } from './resolveImageGenDimensions'
import {
  applyNovelaiSizeFieldsToRequestBody,
  buildNovelaiImageRequestBody,
  buildNovelaiRelayEndpointCandidates,
  isNovelaiImageModelName,
  NOVELAI_IMAGE_API_URL,
  shouldPreferNovelaiCustomGenerationsRoute,
  snapNovelaiDimension,
} from './novelaiImageCatalog'
import {
  OPENAI_IMAGE_API_URL,
  OPENAI_IMAGE_EDITS_API_URL,
  isGptImageModel,
  resolveOpenaiImageSize,
} from './openaiImageCatalog'
import {
  buildOpenAiChatCompletionsEndpoint,
  buildOpenAiImagesGenerationsEndpoint,
  buildGeminiGenerateContentEndpointCandidates,
  buildOpenAiImagesEditsEndpoint,
} from '../../phone/apps/api/openAiCompatibleEndpoints'
import {
  KOLORS_IMAGE_SIZES,
  QIANFAN_IMAGE_SIZES,
  QWEN_IMAGE_SIZES,
} from './momentsImageSizePresets'
import { resolveVolcengineImageSize, VOLCENGINE_IMAGE_API_URL } from './volcengineImageCatalog'
import { localizeMomentsImageGenError } from './momentsImageGenErrorZh'
import { buildCharacterMediaImagePrompt, buildDatingPlotImagePrompt, buildMomentsImagePrompt, isCharacterMediaCharacterAppearanceNeededPrompt, isCharacterMediaSelfiePrompt } from './momentsImagePromptEnhancer'
import { buildDatingPlotGenderLockSuffix } from '../../phone/apps/wechat/dating/datingPlotImagePromptGenderEnforcer'
import { sanitizeCharacterMediaImagePrompt, stripFrontSelfieMirrorCueEnglish } from './characterMediaPromptSanitizer'
import { hasCharacterMediaSelfiePrefix } from './characterMediaSelfiePrefix'
import { resolveCharacterMediaPromptEnglish } from './characterMediaPromptTranslator'
import { applyCharacterSelfieMirrorFlip } from './characterSelfieMirrorFlip'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

export type MomentsImageGenParams = {
  prompt: string
  settings: MomentsImageGenSettings
  width?: number
  height?: number
  /** 显式尺寸（如 1024x1024、2K），优先于 width/height 推算 */
  imageSize?: string
  /** 角色私聊/群聊/朋友圈：非自拍时客户端强制第一视角风景/环境随手拍；dating_plot：第三人称电影镜头剧情插画 */
  promptContext?: 'moments' | 'character_media' | 'dating_plot'
  /** 自拍生图：角色形象参考图 URL 或 data URL（首张，兼容旧逻辑） */
  referenceImageUrl?: string
  /** 自拍生图：多角度形象参考图（最多 8 张） */
  referenceImageUrls?: string[]
  /** 与 referenceImageUrls 一一对应的景别类型 */
  referenceImageKinds?: Array<'face' | 'half' | 'full' | 'side' | 'other'>
  /** 自拍生图：从档案/世界书提取的外貌摘要，写入 prompt 以稳定五官 */
  characterAppearanceHint?: string
  /** 自拍生图：用户填写的形象参考文字补充（与参考图一并注入，优先于档案摘要） */
  characterAppearanceRefNote?: string
  /** 自拍+参考图：档案性别，写入锁脸 prompt 防止换性别 */
  characterGenderHint?: string
  /** 非自拍配图：参考图仅锁画风/渲染，不锁第三人称构图 */
  referenceStyleOnly?: boolean
  /** 角色配图：原始中文 tag，用于 POV/景别推断（prompt 字段可能已译成英文） */
  characterMediaPromptForInference?: string
  /** 剧情配图：前 N 张参考图为约会角色，其后为玩家 */
  datingPlotCharacterRefCount?: number
  datingPlotPlayerGenderHint?: string
}

const SILICONFLOW_IMAGE_URL = 'https://api.siliconflow.cn/v1/images/generations'
const QIANFAN_IMAGE_URL = 'https://qianfan.baidubce.com/v2/images/generations'
const QIANFAN_MUSESTEAMER_URL = 'https://qianfan.baidubce.com/v2/musesteamer/images/generations'

const KOLORS_IMAGE_SIZE_STRINGS = KOLORS_IMAGE_SIZES.map((s) => s.apiSize)
const QWEN_IMAGE_SIZE_STRINGS = QWEN_IMAGE_SIZES.map((s) => s.apiSize)
const QIANFAN_IMAGE_SIZE_STRINGS = QIANFAN_IMAGE_SIZES.map((s) => s.apiSize)

const REF_KIND_PROMPT_LABELS: Record<'face' | 'half' | 'full' | 'side' | 'other', string> = {
  face: 'face and head close-up',
  half: 'half-body portrait',
  side: 'side profile',
  full: 'full-body',
  other: 'additional view',
}

function resolveReferenceUrlsFromParams(params: MomentsImageGenParams): string[] {
  const fromList = (params.referenceImageUrls ?? []).map((u) => u.trim()).filter(Boolean)
  if (fromList.length) return fromList
  const single = params.referenceImageUrl?.trim()
  return single ? [single] : []
}

function buildFullPrompt(params: MomentsImageGenParams): string {
  if (params.promptContext === 'dating_plot') {
    const hasReference = resolveReferenceUrlsFromParams(params).length > 0
    const cleanedPrompt = params.prompt.trim()
    let built = buildDatingPlotImagePrompt(cleanedPrompt, params.settings, {
      hasReferenceImage: hasReference,
    })
    const refNote = params.characterAppearanceRefNote?.trim()
    if (refNote && hasReference) {
      built += `, mandatory character identity traits from user reference notes (must NOT be ignored): ${refNote}`
    }
    const hint = params.characterAppearanceHint?.trim()
    if (hint && !hasReference) {
      built += `, consistent character appearance: ${hint}`
    }
    const genderHint = params.characterGenderHint?.trim()
    const playerGenderHint = params.datingPlotPlayerGenderHint?.trim()
    const mentionsPlayer = /\breference player\b/i.test(cleanedPrompt)
    const isDualCast =
      (params.datingPlotCharacterRefCount ?? 0) > 0 &&
      resolveReferenceUrlsFromParams(params).length > (params.datingPlotCharacterRefCount ?? 0)
    if (isDualCast && genderHint && playerGenderHint) {
      built += `, dating character must be ${genderHint}, player must be ${playerGenderHint}, two distinct people, do NOT swap genders`
    } else if (genderHint && playerGenderHint && mentionsPlayer) {
      built += `, dating character must be ${genderHint}, player must be ${playerGenderHint}, two distinct people, do NOT swap genders`
    } else {
      built += buildDatingPlotGenderLockSuffix({
        characterGenderHint: genderHint,
        playerGenderHint,
        promptMentionsPlayer: mentionsPlayer,
      })
    }
    return built
  }

  if (params.promptContext === 'character_media') {
    const hasReference = resolveReferenceUrlsFromParams(params).length > 0
    const inferencePrompt =
      params.characterMediaPromptForInference?.trim() || params.prompt.trim()
    const isSubjectSelfie = hasCharacterMediaSelfiePrefix(inferencePrompt)
    const cleanedPrompt = isSubjectSelfie
      ? sanitizeCharacterMediaImagePrompt(params.prompt)
      : stripFrontSelfieMirrorCueEnglish(
          sanitizeCharacterMediaImagePrompt(params.prompt),
          inferencePrompt,
        )
    let built = buildCharacterMediaImagePrompt(cleanedPrompt, params.settings, {
      hasReferenceImage: hasReference,
      inferencePrompt,
    })
    const hint = params.characterAppearanceHint?.trim()
    if (hint && !hasReference && !isSubjectSelfie) {
      built += `, consistent character appearance: ${hint}`
    }
    const refNote = params.characterAppearanceRefNote?.trim()
    const isSelfie = isCharacterMediaSelfiePrompt(inferencePrompt)
    const characterAppearanceNeeded = isCharacterMediaCharacterAppearanceNeededPrompt(inferencePrompt)
    if (refNote && characterAppearanceNeeded) {
      built += hasReference
        ? params.referenceStyleOnly
          ? `, character design traits from reference notes for visible parts only: ${refNote}`
          : `, mandatory character identity traits from user reference notes (must NOT be ignored): ${refNote}`
        : `, character appearance traits: ${refNote}`
    }
    const genderHint = params.characterGenderHint?.trim()
    if (genderHint && hasReference && isSelfie) {
      built += `, subject must be ${genderHint}, do NOT change gender or sex presentation`
    }
    return built
  }
  return buildMomentsImagePrompt(params.prompt, params.settings)
}

function buildProviderPrompt(params: MomentsImageGenParams): string {
  const base = buildFullPrompt(params)
  if (!base) return ''
  const provider = resolveImageGenProvider(params.settings)
  const { modelName } = parseMomentsImageModelId(params.settings.modelId)
  const parts = buildAugmentedPositivePromptParts(base, params.settings, provider, modelName)
  const sizeLabel =
    params.width && params.height
      ? `${params.width}×${params.height}${params.imageSize ? ` (${params.imageSize})` : ''}`
      : undefined
  logConsole('ai', formatImageGenApiPromptForConsole(parts, { label: '生图', sizeLabel }))
  return parts.final
}

/** 供聊天室排队日志等场景预览最终 API 正面提示词（不触发实际生图） */
export function previewImageGenApiPromptForConsole(
  prompt: string,
  settings: MomentsImageGenSettings,
  opts?: { messageId?: string; label?: string },
): string {
  const trimmed = prompt.trim()
  if (!trimmed) return ''
  const provider = resolveImageGenProvider(settings)
  const { modelName } = parseMomentsImageModelId(settings.modelId)
  const scene = buildMomentsImagePrompt(trimmed, settings)
  const parts = buildAugmentedPositivePromptParts(scene, settings, provider, modelName)
  return formatImageGenApiPromptForConsole(parts, opts)
}

function buildDatingPlotReferenceIdentityLockPrompt(
  scenePrompt: string,
  genderHint?: string,
  refCount = 1,
  refLabels?: string[],
  appearanceRefNote?: string,
  characterRefCount = 0,
  playerGenderHint?: string,
): string {
  const notePart = appearanceRefNote?.trim()
    ? `Mandatory cast and identity rules (must NOT be ignored): ${appearanceRefNote.trim()}. `
    : ''
  const isDualCast = characterRefCount > 0 && refCount > characterRefCount
  if (isDualCast) {
    const playerRefCount = refCount - characterRefCount
    const charGenderPart = genderHint?.trim()
      ? `Dating character must be ${genderHint.trim()}. `
      : ''
    const playerGenderPart = playerGenderHint?.trim()
      ? `Player must be ${playerGenderHint.trim()}. `
      : ''
    return (
      `${notePart}${charGenderPart}${playerGenderPart}` +
      `You are given ${characterRefCount} reference image(s) for the DATING CHARACTER and ${playerRefCount} for the PLAYER — they are TWO DIFFERENT people. ` +
      `Do NOT merge faces, swap genders, or treat all references as one person. ` +
      `Render as a third-person cinematic illustration — NOT first-person POV, NOT smartphone snapshot. ` +
      `If reference is 2D anime/illustration, output MUST remain 2D illustrated. Scene request: ${scenePrompt}`
    )
  }

  const genderPart = genderHint?.trim()
    ? `The subject is ${genderHint.trim()}. Do NOT change gender, sex, or sex presentation. `
    : ''
  const identityPart =
    refCount > 1
      ? `You are given ${refCount} reference images of the SAME character from different views (${refLabels?.join(', ') ?? 'multiple angles'}). Use ALL references together to preserve consistent identity, face, body proportions, outfit style, and art style. `
      : 'The person in the reference image must remain the EXACT same individual — identical face, hairstyle, hair color, eye shape, skin tone, and distinguishing features. '
  return (
    `${genderPart}${notePart}${identityPart}Render as a third-person cinematic illustration frame captured by an external film camera — NOT first-person POV, NOT smartphone snapshot, NOT mirror selfie. Preserve reference art style and illustration medium. If reference is 2D anime/illustration, output MUST remain 2D illustrated. Scene request: ${scenePrompt}`
  )
}

function buildReferenceStyleOnlyLockPrompt(
  scenePrompt: string,
  refCount = 1,
  appearanceRefNote?: string,
): string {
  const notePart = appearanceRefNote?.trim()
    ? `Mandatory visual traits from user reference notes (costume, prosthetics, accessories — match rendering only): ${appearanceRefNote.trim()}. `
    : ''
  const refPart =
    refCount > 1
      ? `You are given ${refCount} reference images. Match ONLY their shared art style, line quality, color palette, rendering medium and character design language. `
      : 'Match ONLY the reference image art style, line quality, color palette, rendering medium and character design language. '
  return (
    `${notePart}${refPart}Match reference art style only; do NOT copy reference third-person composition unless the scene prompt asks for it. ` +
    `If reference is 2D anime/illustration, output MUST stay 2D illustrated — NOT photorealistic. Scene request: ${scenePrompt}`
  )
}

function buildReferenceIdentityLockPrompt(
  scenePrompt: string,
  genderHint?: string,
  refCount = 1,
  refLabels?: string[],
  appearanceRefNote?: string,
): string {
  const genderPart = genderHint?.trim()
    ? `The subject is ${genderHint.trim()}. Do NOT change gender, sex, or sex presentation. `
    : ''
  const notePart = appearanceRefNote?.trim()
    ? `Mandatory character identity traits specified by the user (must NOT be ignored or omitted): ${appearanceRefNote.trim()}. `
    : ''
  const identityPart =
    refCount > 1
      ? `You are given ${refCount} reference images of the SAME character from different views (${refLabels?.join(', ') ?? 'multiple angles'}). Use ALL references together to preserve consistent identity, face, body proportions, outfit style, and art style. `
      : 'The person in the reference image must remain the EXACT same individual — identical face, hairstyle, hair color, eye shape, skin tone, and distinguishing features. '
  return (
    `${genderPart}${notePart}${identityPart}Do not change ethnicity or age. Preserve the reference image art style, illustration medium, line quality, outfit, collar, and accessories. If the reference is 2D anime/illustration, the output MUST remain 2D illustrated — do NOT convert to photorealistic photo, CGI, or 3D render. Scene request: ${scenePrompt}`
  )
}

const GPT_REFERENCE_ILLUSTRATION_GUARD =
  'Keep the same 2D anime/illustration rendering as the reference. Do NOT make photorealistic, CGI, or muscular photo-real body. Keep reference costume design unless the scene explicitly asks to change clothes.'

function pickClosestImageSize(width: number, height: number, presets: string[]): string {
  const targetRatio = width / height
  let best = presets[0]!
  let bestScore = Number.POSITIVE_INFINITY
  for (const preset of presets) {
    const [w, h] = preset.split('x').map(Number)
    if (!w || !h) continue
    const ratio = w / h
    const ratioDiff = Math.abs(Math.log(ratio / targetRatio))
    const sizeDiff = Math.abs(w * h - width * height) / (width * height)
    const score = ratioDiff * 2 + sizeDiff
    if (score < bestScore) {
      bestScore = score
      best = preset
    }
  }
  return best
}

function resolveSiliconFlowImageSize(
  modelName: string,
  width: number,
  height: number,
  imageSize?: string,
): string {
  if (imageSize) return imageSize
  if (/Kolors/i.test(modelName)) {
    return pickClosestImageSize(width, height, KOLORS_IMAGE_SIZE_STRINGS)
  }
  if (/Qwen\/Qwen-Image/i.test(modelName) && !/Edit/i.test(modelName)) {
    return pickClosestImageSize(width, height, QWEN_IMAGE_SIZE_STRINGS)
  }
  return `${Math.max(256, width)}x${Math.max(256, height)}`
}

function resolveQianfanImageSize(width: number, height: number, imageSize?: string): string {
  if (imageSize) return imageSize
  return pickClosestImageSize(Math.max(512, width), Math.max(512, height), QIANFAN_IMAGE_SIZE_STRINGS)
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(localizeMomentsImageGenError('siliconflow', res.status, 'IMAGE_DOWNLOAD_FAILED'))
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () =>
      reject(new Error(localizeMomentsImageGenError('siliconflow', 0, 'IMAGE_READ_FAILED')))
    reader.readAsDataURL(blob)
  })
}

const IMAGE_DATA_URL_BASE64_RE = /^data:([^;,]+);base64,(.+)$/i

function isValidImageDataUrl(value: string): boolean {
  const m = IMAGE_DATA_URL_BASE64_RE.exec(value.trim())
  const b64 = m?.[2]?.trim()
  return !!b64 && b64.length >= 64
}

/** 统一为微信落库可用的 base64 data URL（外链会尝试下载；失败则抛中文说明） */
async function ensureMomentsImageDataUrl(input: string): Promise<string> {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('生图 API 未返回有效图片')

  if (isValidImageDataUrl(trimmed)) {
    const m = IMAGE_DATA_URL_BASE64_RE.exec(trimmed)!
    return `data:${m[1]!.trim()};base64,${m[2]!.trim()}`
  }

  if (trimmed.startsWith('data:')) {
    throw new Error('生图返回的图片格式无效（需要 data:image/…;base64,… 格式）')
  }

  if (/^[A-Za-z0-9+/=\s]{80,}$/.test(trimmed) && !/^https?:/i.test(trimmed)) {
    return `data:image/png;base64,${trimmed.replace(/\s+/g, '')}`
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const dataUrl = await fetchImageAsDataUrl(trimmed)
      if (!isValidImageDataUrl(dataUrl)) throw new Error('download_invalid')
      return dataUrl
    } catch {
      throw new Error(
        '生图返回的是外链图片，但浏览器无法下载（常见原因：中转站 CDN 禁止跨域 CORS）。请换用返回 base64 的模型/接口，或联系中转站开启图片域 CORS。',
      )
    }
  }

  throw new Error('生图结果无法解析为图片（invalid_image_data_url）')
}

async function generateSiliconFlowImage(params: MomentsImageGenParams): Promise<string> {
  const apiKey = params.settings.siliconflowApiKey?.trim()
  if (!apiKey) throw new Error('请先填写硅基流动 API Key')

  const prompt = buildProviderPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const { modelName } = parseMomentsImageModelId(
    params.settings.modelId.trim() || DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  )
  const width = params.width ?? 512
  const height = params.height ?? 512
  const sfParams = resolveProviderPromptSettings(params.settings, 'siliconflow').siliconflow
  const kind = resolveImageGenModelPromptKind('siliconflow', modelName)

  const body: Record<string, unknown> = {
    model: modelName,
    prompt,
    image_size: resolveSiliconFlowImageSize(modelName, width, height, params.imageSize),
    num_inference_steps: sfParams.steps,
  }

  if (kind === 'siliconflow-qwen') {
    body.cfg = sfParams.cfg
  }
  if (kind === 'siliconflow-kolors') {
    body.guidance_scale = sfParams.guidanceScale
    body.batch_size = 1
  }
  const negative = sfParams.negativePrompt.trim()
  if (negative) body.negative_prompt = negative

  const res = await fetch(SILICONFLOW_IMAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(localizeMomentsImageGenError('siliconflow', res.status, text))
  }

  const data = (await res.json()) as { images?: Array<{ url?: string }> }
  const imageUrl = data.images?.[0]?.url?.trim()
  if (!imageUrl) throw new Error('硅基流动未返回图片 URL')

  try {
    return await fetchImageAsDataUrl(imageUrl)
  } catch {
    return imageUrl
  }
}

async function generateQianfanImage(params: MomentsImageGenParams): Promise<string> {
  const apiKey = params.settings.qianfanApiKey?.trim()
  if (!apiKey) throw new Error('请先填写百度千帆 API Key')

  const prompt = buildProviderPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const { modelName } = parseMomentsImageModelId(
    params.settings.modelId.trim() || DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  )
  const width = params.width ?? 512
  const height = params.height ?? 512
  const size = resolveQianfanImageSize(width, height, params.imageSize)

  const isMuseSteamer = isQianfanMuseSteamerModel(modelName)
  const url = isMuseSteamer ? QIANFAN_MUSESTEAMER_URL : QIANFAN_IMAGE_URL
  const body: Record<string, unknown> = isMuseSteamer
    ? { model: modelName, prompt, size }
    : { model: modelName, prompt, n: 1, size }

  const negative = resolveProviderPromptSettings(params.settings, 'qianfan').qianfan.negativePrompt.trim()
  if (negative) body.negative_prompt = negative

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(localizeMomentsImageGenError('qianfan', res.status, text))
  }

  const data = (await res.json()) as { data?: Array<{ url?: string }> }
  const imageUrl = data.data?.[0]?.url?.trim()
  if (!imageUrl) throw new Error('百度千帆未返回图片 URL')

  try {
    return await fetchImageAsDataUrl(imageUrl)
  } catch {
    return imageUrl
  }
}

async function generateVolcengineImage(params: MomentsImageGenParams): Promise<string> {
  const apiKey = params.settings.volcengineApiKey?.trim()
  if (!apiKey) throw new Error('请先填写火山方舟 API Key')

  const prompt = buildProviderPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const { modelName } = parseMomentsImageModelId(
    params.settings.modelId.trim() || DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  )
  const width = params.width ?? 512
  const height = params.height ?? 512

  const body: Record<string, unknown> = {
    model: modelName,
    prompt,
    size: params.imageSize ?? resolveVolcengineImageSize(modelName, width, height),
    sequential_image_generation: 'disabled',
    response_format: 'url',
    stream: false,
    watermark: false,
  }

  const res = await fetch(VOLCENGINE_IMAGE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(localizeMomentsImageGenError('volcengine', res.status, text, modelName))
  }

  const data = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> }
  const item = data.data?.[0]
  const imageUrl = item?.url?.trim()
  if (imageUrl) {
    try {
      return await fetchImageAsDataUrl(imageUrl)
    } catch {
      return imageUrl
    }
  }

  const b64 = item?.b64_json?.trim()
  if (b64) return `data:image/png;base64,${b64}`

  throw new Error('火山方舟未返回图片')
}

function logImageGenApiRequestSize(route: string, width: number, height: number, sizeLabel?: string): void {
  const extra = sizeLabel?.trim() ? ` (${sizeLabel.trim()})` : ''
  logConsole('ai', `[imagegen] API 请求 ${route} · ${width}×${height}${extra}`)
}

async function generateNovelaiImage(params: MomentsImageGenParams): Promise<string> {
  const apiKey = params.settings.novelaiApiKey?.trim()
  if (!apiKey) throw new Error('请先填写 NovelAI API Key')

  const prompt = buildProviderPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const { modelName } = parseMomentsImageModelId(
    params.settings.modelId.trim() || DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  )
  const width = snapNovelaiDimension(params.width ?? 832)
  const height = snapNovelaiDimension(params.height ?? 1216)

  const naiParams = resolveNovelaiGenerationParams(params.settings, modelName)

  const body = buildNovelaiImageRequestBody({
    prompt,
    modelName,
    width,
    height,
    steps: naiParams.steps,
    cfg: naiParams.cfg,
    sampler: naiParams.sampler,
    negativePrompt: naiParams.negativePrompt,
  })
  applyNovelaiSizeFieldsToRequestBody(body, width, height, params.imageSize)
  logImageGenApiRequestSize('NovelAI 官方', width, height, params.imageSize)

  const res = await fetch(NOVELAI_IMAGE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(localizeMomentsImageGenError('novelai', res.status, text))
  }

  return extractPngDataUrlFromBuffer(await res.arrayBuffer())
}

async function generateNovelaiRelayImage(
  params: MomentsImageGenParams,
  apiUrl: string,
  apiKey: string,
  modelName: string,
  prompt: string,
): Promise<string> {
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const width = snapNovelaiDimension(params.width ?? 832)
  const height = snapNovelaiDimension(params.height ?? 1216)
  const naiParams = resolveNovelaiGenerationParams(params.settings, modelName)
  const body = buildNovelaiImageRequestBody({
    prompt,
    modelName,
    width,
    height,
    steps: naiParams.steps,
    cfg: naiParams.cfg,
    sampler: naiParams.sampler,
    negativePrompt: naiParams.negativePrompt,
  })
  const applied = applyNovelaiSizeFieldsToRequestBody(body, width, height, params.imageSize)
  logImageGenApiRequestSize('NovelAI 中转 /ai/generate-image', applied.width, applied.height, applied.size)

  const endpoints = buildNovelaiRelayEndpointCandidates(apiUrl)
  let lastErr: unknown = null
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(localizeMomentsImageGenError('custom', res.status, text))
      }
      const contentType = res.headers.get('content-type') ?? ''
      if (/image\/png/i.test(contentType) || /application\/octet-stream/i.test(contentType)) {
        return extractPngDataUrlFromBuffer(await res.arrayBuffer())
      }
      const data = await res.json()
      const openAiRef = parseOpenAiImageResponse(data, 'custom', res.status)
      return ensureMomentsImageDataUrl(openAiRef)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('NAI 中转生图失败')
}

type GeminiGenerateContentAuth = 'bearer' | 'query'

function extractImageFromGeminiGenerateContentPayload(data: unknown): string | null {
  const payload = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> }
    }>
  }
  for (const part of payload.candidates?.[0]?.content?.parts ?? []) {
    const inline = part.inlineData
    if (inline?.data?.trim()) {
      const mime = inline.mimeType?.trim() || 'image/png'
      return `data:${mime};base64,${inline.data.trim()}`
    }
  }
  return null
}

async function requestGeminiGenerateContentImage(params: {
  endpoint: string
  apiKey: string
  prompt: string
  auth: GeminiGenerateContentAuth
  errorProvider: MomentsImageProvider
  referenceImageDataUrls?: string[]
  referenceImageKinds?: Array<'face' | 'half' | 'full' | 'side' | 'other'>
  characterGenderHint?: string
  characterAppearanceRefNote?: string
  referenceStyleOnly?: boolean
  promptContext?: MomentsImageGenParams['promptContext']
  datingPlotCharacterRefCount?: number
  datingPlotPlayerGenderHint?: string
}): Promise<string> {
  let url = params.endpoint
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (params.auth === 'bearer') {
    headers.Authorization = `Bearer ${params.apiKey}`
  } else {
    url = `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(params.apiKey)}`
  }

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
  const refDataUrls = (params.referenceImageDataUrls ?? []).filter(Boolean)
  if (refDataUrls.length) {
    const refLabels: string[] = []
    refDataUrls.forEach((dataUrl, index) => {
      const refParsed = parseImageDataUrl(dataUrl)
      if (!refParsed) return
      const kind = params.referenceImageKinds?.[index] ?? 'other'
      const kindLabel = REF_KIND_PROMPT_LABELS[kind]
      refLabels.push(kindLabel)
      parts.push({ inlineData: { mimeType: refParsed.mime, data: refParsed.base64 } })
      const charRefCount = params.datingPlotCharacterRefCount ?? 0
      const isDatingPlotDual =
        params.promptContext === 'dating_plot' && charRefCount > 0 && index >= charRefCount
      const isDatingPlotChar =
        params.promptContext === 'dating_plot' && charRefCount > 0 && index < charRefCount
      const refRole = isDatingPlotChar
        ? 'DATING CHARACTER (reference character in scene prompt)'
        : isDatingPlotDual
          ? 'PLAYER (reference player in scene prompt)'
          : 'same character appearance'
      parts.push({ text: `Reference image (${kindLabel}): ${refRole}.` })
    })
    parts.push({
      text:
        params.promptContext === 'dating_plot'
          ? buildDatingPlotReferenceIdentityLockPrompt(
              params.prompt,
              params.characterGenderHint,
              refDataUrls.length,
              refLabels,
              params.characterAppearanceRefNote,
              params.datingPlotCharacterRefCount ?? 0,
              params.datingPlotPlayerGenderHint,
            )
          : params.referenceStyleOnly
            ? buildReferenceStyleOnlyLockPrompt(
                params.prompt,
                refDataUrls.length,
                params.characterAppearanceRefNote,
              )
            : buildReferenceIdentityLockPrompt(
                params.prompt,
                params.characterGenderHint,
                refDataUrls.length,
                refLabels,
                params.characterAppearanceRefNote,
              ),
    })
  } else {
    parts.push({ text: params.prompt })
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(localizeMomentsImageGenError(params.errorProvider, res.status, text))
  }

  const dataUrl = extractImageFromGeminiGenerateContentPayload(await res.json())
  if (!dataUrl) throw new Error('Gemini 未返回图片')
  return dataUrl
}

function parseImageDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const m = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!m?.[2]?.trim()) return null
  return { mime: m[1]!.trim() || 'image/png', base64: m[2]!.trim() }
}

async function loadImageUrlAsDataUrl(url: string): Promise<string | null> {
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('data:')) return trimmed
  try {
    const res = await fetch(trimmed)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => reject(new Error('image_read_failed'))
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function resolveReferenceImageDataUrls(params: MomentsImageGenParams): Promise<string[]> {
  const urls = resolveReferenceUrlsFromParams(params)
  const out: string[] = []
  for (const url of urls) {
    const dataUrl = await loadImageUrlAsDataUrl(url)
    if (dataUrl) out.push(dataUrl)
  }
  return out
}

function pickGptReferenceDataUrl(
  dataUrls: string[],
  kinds?: Array<'face' | 'half' | 'full' | 'side' | 'other'>,
): string | null {
  if (!dataUrls.length) return null
  if (kinds?.length) {
    const faceIdx = kinds.indexOf('face')
    if (faceIdx >= 0 && dataUrls[faceIdx]) return dataUrls[faceIdx]!
    const halfIdx = kinds.indexOf('half')
    if (halfIdx >= 0 && dataUrls[halfIdx]) return dataUrls[halfIdx]!
    const sideIdx = kinds.indexOf('side')
    if (sideIdx >= 0 && dataUrls[sideIdx]) return dataUrls[sideIdx]!
  }
  return dataUrls[0] ?? null
}

function referenceImageFileName(mime: string): string {
  const lower = mime.toLowerCase()
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'reference.jpg'
  if (lower.includes('webp')) return 'reference.webp'
  return 'reference.png'
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const parsed = parseImageDataUrl(dataUrl)
  if (!parsed) throw new Error('形象参考图无效')
  const binary = atob(parsed.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: parsed.mime })
}

function buildGptImageReferenceEditPrompt(
  prompt: string,
  genderHint?: string,
  refCount = 1,
  refLabels?: string[],
  appearanceRefNote?: string,
  styleOnly = false,
  promptContext?: MomentsImageGenParams['promptContext'],
  characterRefCount = 0,
  playerGenderHint?: string,
): string {
  if (promptContext === 'dating_plot') {
    return `${buildDatingPlotReferenceIdentityLockPrompt(prompt, genderHint, refCount, refLabels, appearanceRefNote, characterRefCount, playerGenderHint)} ${GPT_REFERENCE_ILLUSTRATION_GUARD}`
  }
  if (styleOnly) {
    return `${buildReferenceStyleOnlyLockPrompt(prompt, refCount, appearanceRefNote)} ${GPT_REFERENCE_ILLUSTRATION_GUARD}`
  }
  return `${buildReferenceIdentityLockPrompt(prompt, genderHint, refCount, refLabels, appearanceRefNote)} ${GPT_REFERENCE_ILLUSTRATION_GUARD}`
}

function extractOpenAiImagePayloadError(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const o = data as Record<string, unknown>
  const errObj = o.error
  if (errObj && typeof errObj === 'object') {
    const msg = (errObj as { message?: string }).message
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  }
  const msg = o.message
  if (typeof msg === 'string') {
    const t = msg.trim()
    if (!t) return ''
    if (/reject|safety|violation|policy|moderation|blocked|审核|违规/i.test(t)) return t
    if (o.status_code === 200 && /reject/i.test(t)) return t
  }
  const violations = o.safety_violations
  if (Array.isArray(violations) && violations.length > 0) {
    const base =
      typeof msg === 'string' && msg.trim()
        ? msg.trim()
        : 'Your request was rejected by the safety system.'
    return `${base} safety_violations=${JSON.stringify(violations)}`
  }
  return ''
}

function parseOpenAiImageResponse(
  data: unknown,
  provider: MomentsImageProvider = 'openai',
  httpStatus = 200,
): string {
  const errText = extractOpenAiImagePayloadError(data)
  if (errText) throw new Error(localizeMomentsImageGenError(provider, httpStatus, errText))
  const payload = data as {
    data?: Array<{ b64_json?: string; url?: string }>
    images?: Array<{ url?: string; b64_json?: string }>
  }
  const item = payload.data?.[0]
  const b64 = item?.b64_json?.trim() ?? payload.images?.[0]?.b64_json?.trim()
  if (b64) return `data:image/png;base64,${b64}`
  const imageUrl = item?.url?.trim() ?? payload.images?.[0]?.url?.trim()
  if (imageUrl) return imageUrl
  throw new Error('OpenAI 未返回图片')
}

function extractImageRefFromText(text: string): string | null {
  const t = text.trim()
  if (!t) return null
  const dataMatch = t.match(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/i)
  if (dataMatch) return dataMatch[0].replace(/\s+/g, '')
  const mdMatch = t.match(/!\[[^\]]*\]\(([^)]+)\)/)
  if (mdMatch?.[1]?.trim()) return mdMatch[1].trim()
  const urlMatch = t.match(/https?:\/\/[^\s"'<>]+/i)
  if (urlMatch && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(urlMatch[0])) return urlMatch[0]
  return null
}

function parseChatCompletionsImageResponse(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const root = data as Record<string, unknown>
  const choice = (root.choices as unknown[])?.[0] as Record<string, unknown> | undefined
  const msg = (choice?.message ?? choice?.delta) as Record<string, unknown> | undefined
  if (msg) {
    const content = msg.content
    if (typeof content === 'string') {
      const fromText = extractImageRefFromText(content)
      if (fromText) return fromText
    }
    if (Array.isArray(content)) {
      for (const part of content) {
        if (!part || typeof part !== 'object') continue
        const p = part as Record<string, unknown>
        if (p.type === 'image_url' && p.image_url && typeof p.image_url === 'object') {
          const url = String((p.image_url as { url?: string }).url ?? '').trim()
          if (url) return url
        }
        if (p.type === 'text' && typeof p.text === 'string') {
          const fromText = extractImageRefFromText(p.text)
          if (fromText) return fromText
        }
        if (p.inline_data && typeof p.inline_data === 'object') {
          const inline = p.inline_data as { data?: string; mime_type?: string }
          const b64 = inline.data?.trim()
          if (b64) {
            const mime = inline.mime_type?.trim() || 'image/png'
            return `data:${mime};base64,${b64}`
          }
        }
      }
    }
    const msgImages = msg.images
    if (Array.isArray(msgImages)) {
      for (const img of msgImages) {
        if (!img || typeof img !== 'object') continue
        const row = img as { url?: string; b64_json?: string }
        if (row.b64_json?.trim()) return `data:image/png;base64,${row.b64_json.trim()}`
        if (row.url?.trim()) return row.url.trim()
      }
    }
  }
  try {
    return parseOpenAiImageResponse(data, 'custom', 200)
  } catch {
    return null
  }
}

async function generateGptImageViaChatCompletions(params: {
  endpoint: string
  apiKey: string
  modelName: string
  prompt: string
  errorProvider: MomentsImageProvider
}): Promise<string> {
  const res = await fetch(params.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.modelName,
      messages: [{ role: 'user', content: params.prompt }],
      stream: false,
    }),
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? (JSON.parse(text) as unknown) : null
  } catch {
    if (!res.ok) {
      throw new Error(localizeMomentsImageGenError(params.errorProvider, res.status, text))
    }
    throw new Error('chat/completions 返回不是合法 JSON')
  }
  if (!res.ok) {
    throw new Error(localizeMomentsImageGenError(params.errorProvider, res.status, text))
  }
  const imageRef = parseChatCompletionsImageResponse(data)
  if (!imageRef) throw new Error('chat/completions 未返回图片（请确认中转站 gpt-image 模型支持该接口）')
  return ensureMomentsImageDataUrl(imageRef)
}

async function generateCustomImageViaGenerations(params: {
  endpoint: string
  apiKey: string
  modelName: string
  prompt: string
  width: number
  height: number
  imageSize?: string
  errorProvider: MomentsImageProvider
  settings?: MomentsImageGenParams['settings']
}): Promise<string> {
  const body: Record<string, unknown> = { model: params.modelName, prompt: params.prompt }

  if (isOpenAiStyleImageModel(params.modelName)) {
    body.n = 1
    body.size = resolveOpenaiImageSize(params.modelName, params.width, params.height, params.imageSize)
    body.response_format = 'b64_json'
    if (params.modelName === 'gpt-image-1') body.quality = 'medium'
    else if (params.modelName === 'dall-e-3') body.quality = 'standard'
    logImageGenApiRequestSize('自定义 /images/generations · OpenAI', params.width, params.height, String(body.size ?? ''))
  } else {
    const settings = params.settings
    const kind = settings
      ? resolveImageGenModelPromptKind('custom', params.modelName)
      : 'custom-diffusion'

    if (isNovelaiImageModelName(params.modelName) && settings) {
      const width = snapNovelaiDimension(params.width)
      const height = snapNovelaiDimension(params.height)
      const naiParams = resolveNovelaiGenerationParams(settings, params.modelName)
      const naiBody = buildNovelaiImageRequestBody({
        prompt: params.prompt,
        modelName: params.modelName,
        width,
        height,
        steps: naiParams.steps,
        cfg: naiParams.cfg,
        sampler: naiParams.sampler,
        negativePrompt: naiParams.negativePrompt,
      })
      Object.assign(body, naiBody)
      const applied = applyNovelaiSizeFieldsToRequestBody(body, width, height, params.imageSize)
      body.steps = naiParams.steps
      body.scale = naiParams.cfg
      body.cfg_scale = naiParams.cfg
      body.sampler = naiParams.sampler
      if (naiParams.negativePrompt) {
        body.negative_prompt = naiParams.negativePrompt
        body.uc = naiParams.negativePrompt
      }
      logImageGenApiRequestSize('自定义 /images/generations · NAI', applied.width, applied.height, applied.size)
    } else {
      const sfParams =
        kind === 'siliconflow-qwen' || kind === 'siliconflow-kolors' || kind === 'siliconflow-diffusion'
          ? settings
            ? resolveProviderPromptSettings(settings, 'custom').siliconflow
            : null
          : null
      const customParams = settings ? resolveProviderPromptSettings(settings, 'custom').custom : null

      body.image_size = resolveSiliconFlowImageSize(
        params.modelName,
        params.width,
        params.height,
        params.imageSize,
      )
      logImageGenApiRequestSize(
        '自定义 /images/generations',
        params.width,
        params.height,
        String(body.image_size ?? params.imageSize ?? ''),
      )
      body.num_inference_steps = sfParams?.steps ?? customParams?.steps ?? 20

      if (/Qwen\/Qwen-Image/i.test(params.modelName) && !/Edit/i.test(params.modelName)) {
        body.cfg = sfParams?.cfg ?? customParams?.cfg ?? 4
      }
      if (/Kolors/i.test(params.modelName)) {
        body.guidance_scale = sfParams?.guidanceScale ?? customParams?.guidanceScale ?? 7.5
        body.batch_size = 1
      }

      const negative = (sfParams?.negativePrompt ?? customParams?.negativePrompt ?? '').trim()
      if (negative) body.negative_prompt = negative
    }
  }

  const res = await fetch(params.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(localizeMomentsImageGenError(params.errorProvider, res.status, text))
  }

  const data = await res.json()
  const payloadErr = extractOpenAiImagePayloadError(data)
  if (payloadErr) throw new Error(localizeMomentsImageGenError(params.errorProvider, res.status, payloadErr))

  return parseOpenAiImageResponse(data, params.errorProvider, res.status)
}

async function generateGptImageWithReference(params: {
  endpoint: string
  apiKey: string
  modelName: string
  prompt: string
  referenceImageDataUrl: string
  referenceCount?: number
  referenceLabels?: string[]
  width: number
  height: number
  imageSize?: string
  errorProvider: MomentsImageProvider
  characterGenderHint?: string
  characterAppearanceRefNote?: string
  referenceStyleOnly?: boolean
  promptContext?: MomentsImageGenParams['promptContext']
  datingPlotCharacterRefCount?: number
  datingPlotPlayerGenderHint?: string
}): Promise<string> {
  const blob = await dataUrlToBlob(params.referenceImageDataUrl)
  const parsed = parseImageDataUrl(params.referenceImageDataUrl)
  const form = new FormData()
  form.append('model', params.modelName)
  form.append(
    'prompt',
    buildGptImageReferenceEditPrompt(
      params.prompt,
      params.characterGenderHint,
      params.referenceCount ?? 1,
      params.referenceLabels,
      params.characterAppearanceRefNote,
      params.referenceStyleOnly === true,
      params.promptContext,
      params.datingPlotCharacterRefCount ?? 0,
      params.datingPlotPlayerGenderHint,
    ),
  )
  form.append('image', blob, referenceImageFileName(parsed?.mime ?? 'image/png'))
  form.append('n', '1')
  form.append('size', resolveOpenaiImageSize(params.modelName, params.width, params.height, params.imageSize))
  form.append('quality', 'high')
  if (isGptImageModel(params.modelName)) {
    form.append('input_fidelity', 'high')
  }

  const res = await fetch(params.endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.apiKey}` },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(localizeMomentsImageGenError(params.errorProvider, res.status, text))
  }

  const dataUrl = parseOpenAiImageResponse(await res.json(), params.errorProvider, res.status)
  if (dataUrl.startsWith('data:')) return dataUrl
  try {
    return await fetchImageAsDataUrl(dataUrl)
  } catch {
    return dataUrl
  }
}

async function generateGeminiImage(params: MomentsImageGenParams): Promise<string> {
  const apiKey = params.settings.geminiApiKey?.trim()
  if (!apiKey) throw new Error('请先填写 Gemini API Key')

  const prompt = buildProviderPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const { modelName } = parseMomentsImageModelId(
    params.settings.modelId.trim() || DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  )
  const width = params.width ?? 1024
  const height = params.height ?? 1024

  if (isGeminiImagenModel(modelName)) {
    const url = `${GEMINI_API_BASE_URL}/models/${modelName}:predict?key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: resolveImagenAspectRatio(width, height),
        },
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(localizeMomentsImageGenError('gemini', res.status, text))
    }
    const data = (await res.json()) as {
      predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
      generatedImages?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
    }
    const item = data.predictions?.[0] ?? data.generatedImages?.[0]
    const b64 = item?.bytesBase64Encoded?.trim()
    if (!b64) throw new Error('Gemini Imagen 未返回图片')
    const mime = item?.mimeType?.trim() || 'image/png'
    return `data:${mime};base64,${b64}`
  }

  const url = `${GEMINI_API_BASE_URL}/models/${modelName}:generateContent`
  const referenceImageDataUrls = await resolveReferenceImageDataUrls(params)
  return requestGeminiGenerateContentImage({
    endpoint: url,
    apiKey,
    prompt,
    auth: 'query',
    errorProvider: 'gemini',
    referenceImageDataUrls,
    referenceImageKinds: params.referenceImageKinds,
    characterGenderHint: params.characterGenderHint,
    characterAppearanceRefNote: params.characterAppearanceRefNote,
    referenceStyleOnly: params.referenceStyleOnly,
    promptContext: params.promptContext,
    datingPlotCharacterRefCount: params.datingPlotCharacterRefCount,
    datingPlotPlayerGenderHint: params.datingPlotPlayerGenderHint,
  })
}

async function generateOpenaiImage(params: MomentsImageGenParams): Promise<string> {
  const apiKey = params.settings.openaiApiKey?.trim()
  if (!apiKey) throw new Error('请先填写 OpenAI API Key')

  const prompt = buildProviderPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const { modelName } = parseMomentsImageModelId(
    params.settings.modelId.trim() || DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  )
  const width = params.width ?? 1024
  const height = params.height ?? 1024
  const size = resolveOpenaiImageSize(modelName, width, height, params.imageSize)

  const referenceImageDataUrls = await resolveReferenceImageDataUrls(params)
  const hasReference = referenceImageDataUrls.length > 0
  const referenceImageDataUrl = pickGptReferenceDataUrl(referenceImageDataUrls, params.referenceImageKinds)
  const refLabels = (params.referenceImageKinds ?? []).map((k) => REF_KIND_PROMPT_LABELS[k])

  if (hasReference && (params.promptContext === 'character_media' || params.promptContext === 'dating_plot') && !isGptImageModel(modelName)) {
    throw new Error(
      '当前 OpenAI 模型不支持形象参考图（DALL·E 仅文生图）。自拍锁脸请改用 GPT Image（gpt-image-1 等），二次元参考图更推荐 Gemini 原生图模。',
    )
  }

  if (referenceImageDataUrl && isGptImageModel(modelName)) {
    try {
      return await generateGptImageWithReference({
        endpoint: OPENAI_IMAGE_EDITS_API_URL,
        apiKey,
        modelName,
        prompt,
        referenceImageDataUrl,
        referenceCount: referenceImageDataUrls.length,
        referenceLabels: refLabels,
        width,
        height,
        imageSize: params.imageSize,
        errorProvider: 'openai',
        characterGenderHint: params.characterGenderHint,
        characterAppearanceRefNote: params.characterAppearanceRefNote,
        referenceStyleOnly: params.referenceStyleOnly,
        promptContext: params.promptContext,
        datingPlotCharacterRefCount: params.datingPlotCharacterRefCount,
        datingPlotPlayerGenderHint: params.datingPlotPlayerGenderHint,
      })
    } catch (err) {
      if (params.promptContext === 'character_media' || params.promptContext === 'dating_plot') {
        const detail = err instanceof Error ? err.message : String(err)
        throw new Error(
          `GPT 形象参考生图失败：${detail}。GPT 对二次元立绘参考容易偏写实/换脸，建议换 Gemini 原生图模；并确认 API 已开通 /v1/images/edits。`,
        )
      }
      // 非角色自拍场景保留文生图回落
    }
  }

  const body: Record<string, unknown> = {
    model: modelName,
    prompt,
    n: 1,
    size,
    response_format: 'b64_json',
  }
  if (modelName === 'gpt-image-1') {
    body.quality = 'medium'
  } else if (modelName === 'dall-e-3') {
    body.quality = 'standard'
    body.response_format = 'b64_json'
  }

  const res = await fetch(OPENAI_IMAGE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(localizeMomentsImageGenError('openai', res.status, text))
  }

  const dataUrl = parseOpenAiImageResponse(await res.json(), 'openai', res.status)
  if (dataUrl.startsWith('data:')) return dataUrl
  try {
    return await fetchImageAsDataUrl(dataUrl)
  } catch {
    return dataUrl
  }
}

function isOpenAiStyleImageModel(modelName: string): boolean {
  const name = modelName.trim()
  return /gpt-image/i.test(name) || /dall-?e/i.test(name)
}

async function generateCustomGeminiNativeImage(
  params: MomentsImageGenParams,
  apiUrl: string,
  apiKey: string,
  modelName: string,
): Promise<string> {
  const prompt = buildProviderPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const endpoints = buildGeminiGenerateContentEndpointCandidates(apiUrl, modelName)
  if (!endpoints.length) throw new Error('自定义接口 API URL 无效')

  const referenceImageDataUrls = await resolveReferenceImageDataUrls(params)
  const requestParams = {
    apiKey,
    prompt,
    auth: 'bearer' as const,
    errorProvider: 'custom' as const,
    referenceImageDataUrls,
    referenceImageKinds: params.referenceImageKinds,
    characterGenderHint: params.characterGenderHint,
    characterAppearanceRefNote: params.characterAppearanceRefNote,
    referenceStyleOnly: params.referenceStyleOnly,
    promptContext: params.promptContext,
    datingPlotCharacterRefCount: params.datingPlotCharacterRefCount,
    datingPlotPlayerGenderHint: params.datingPlotPlayerGenderHint,
  }

  let lastErr: unknown = null
  for (const endpoint of endpoints) {
    try {
      return await requestGeminiGenerateContentImage({ ...requestParams, endpoint })
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      const hasNext = endpoints.indexOf(endpoint) < endpoints.length - 1
      if (!hasNext || !shouldRetryGeminiImageViaGenerations(msg)) break
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? 'Gemini 生图失败'))
}

async function generateCustomImageWithGeminiRouteFallback(
  params: MomentsImageGenParams,
  apiUrl: string,
  apiKey: string,
  modelName: string,
): Promise<string> {
  const prompt = buildProviderPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const width = params.width ?? 1024
  const height = params.height ?? 1024
  const genEndpoint = buildOpenAiImagesGenerationsEndpoint(apiUrl)
  const genParams = {
    endpoint: genEndpoint,
    apiKey,
    modelName,
    prompt,
    width,
    height,
    imageSize: params.imageSize,
    errorProvider: 'custom' as const,
    settings: params.settings,
  }

  let generateContentErr: unknown = null
  try {
    return await generateCustomGeminiNativeImage(params, apiUrl, apiKey, modelName)
  } catch (err) {
    generateContentErr = err
    const msg = err instanceof Error ? err.message : String(err)
    if (!genEndpoint || !shouldRetryGeminiImageViaGenerations(msg)) throw err
  }

  try {
    const dataUrl = await generateCustomImageViaGenerations(genParams)
    return ensureMomentsImageDataUrl(dataUrl)
  } catch (generationsErr) {
    throw mergeGeminiImageRouteErrors(generateContentErr, generationsErr)
  }
}

async function generateCustomImage(params: MomentsImageGenParams): Promise<string> {
  const apiUrl = params.settings.customApiUrl?.trim()
  const apiKey = params.settings.customApiKey?.trim()
  if (!apiUrl) throw new Error('请先填写自定义接口 API URL')
  if (!apiKey) throw new Error('请先填写自定义接口 API Key')

  const prompt = buildProviderPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const { modelName } = parseMomentsImageModelId(
    params.settings.modelId.trim() || DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  )
  if (!modelName) throw new Error('请先拉取并选择生图模型')

  if (isNovelaiImageModelName(modelName)) {
    if (!shouldPreferNovelaiCustomGenerationsRoute(apiUrl)) {
      try {
        return await generateNovelaiRelayImage(params, apiUrl, apiKey, modelName, prompt)
      } catch {
        // 部分中转仅支持 OpenAI 兼容 /images/generations，继续走下方通用逻辑
      }
    }
  }

  if (isGeminiImageRouteCandidate(modelName)) {
    return generateCustomImageWithGeminiRouteFallback(params, apiUrl, apiKey, modelName)
  }

  const width = params.width ?? 1024
  const height = params.height ?? 1024
  const referenceImageDataUrls = await resolveReferenceImageDataUrls(params)
  const hasReference = referenceImageDataUrls.length > 0
  const referenceImageDataUrl = pickGptReferenceDataUrl(referenceImageDataUrls, params.referenceImageKinds)
  const refLabels = (params.referenceImageKinds ?? []).map((k) => REF_KIND_PROMPT_LABELS[k])

  if (hasReference && (params.promptContext === 'character_media' || params.promptContext === 'dating_plot') && !isGptImageModel(modelName)) {
    throw new Error(
      '当前自定义接口模型不支持形象参考图。自拍锁脸请改用 gpt-image 系列或 Gemini 原生图模。',
    )
  }

  if (referenceImageDataUrl && isGptImageModel(modelName)) {
    const editsEndpoint = buildOpenAiImagesEditsEndpoint(apiUrl)
    if (editsEndpoint) {
      try {
        return await generateGptImageWithReference({
          endpoint: editsEndpoint,
          apiKey,
          modelName,
          prompt,
          referenceImageDataUrl,
          referenceCount: referenceImageDataUrls.length,
          referenceLabels: refLabels,
          width,
          height,
          imageSize: params.imageSize,
          errorProvider: 'custom',
          characterGenderHint: params.characterGenderHint,
          characterAppearanceRefNote: params.characterAppearanceRefNote,
          referenceStyleOnly: params.referenceStyleOnly,
          promptContext: params.promptContext,
          datingPlotCharacterRefCount: params.datingPlotCharacterRefCount,
          datingPlotPlayerGenderHint: params.datingPlotPlayerGenderHint,
        })
      } catch (err) {
        if (params.promptContext === 'character_media' || params.promptContext === 'dating_plot') {
          const detail = err instanceof Error ? err.message : String(err)
          throw new Error(
            `GPT 形象参考生图失败：${detail}。中转站需支持 /images/edits；二次元参考更推荐 Gemini 原生图模。`,
          )
        }
      }
    } else if (params.promptContext === 'character_media') {
      throw new Error('自定义接口未配置 /images/edits，无法使用形象参考图。请换支持 edits 的中转或 Gemini 原生图模。')
    }
  }

  const endpoint = buildOpenAiImagesGenerationsEndpoint(apiUrl)
  if (!endpoint) throw new Error('自定义接口 API URL 无效')

  const genParams = {
    endpoint,
    apiKey,
    modelName,
    prompt,
    width,
    height,
    imageSize: params.imageSize,
    errorProvider: 'custom' as const,
    settings: params.settings,
  }

  if (isGptImageModel(modelName)) {
    const chatEndpoint = buildOpenAiChatCompletionsEndpoint(apiUrl)
    let lastErr: unknown = null
    if (chatEndpoint) {
      try {
        return await generateGptImageViaChatCompletions({
          endpoint: chatEndpoint,
          apiKey,
          modelName,
          prompt,
          errorProvider: 'custom',
        })
      } catch (err) {
        lastErr = err
      }
    }
    try {
      return await generateCustomImageViaGenerations(genParams)
    } catch (genErr) {
      if (lastErr instanceof Error) throw lastErr
      throw genErr
    }
  }

  try {
    const dataUrl = await generateCustomImageViaGenerations(genParams)
    return ensureMomentsImageDataUrl(dataUrl)
  } catch (generationsErr) {
    const msg = generationsErr instanceof Error ? generationsErr.message : String(generationsErr)
    if (shouldRetryGeminiImageViaGenerateContent(msg)) {
      try {
        return await generateCustomGeminiNativeImage(params, apiUrl, apiKey, modelName)
      } catch (generateContentErr) {
        throw mergeGeminiImageRouteErrors(generationsErr, generateContentErr)
      }
    }
    throw generationsErr
  }
}

function resolveProvider(settings: MomentsImageGenSettings): MomentsImageProvider {
  return settings.provider ?? parseMomentsImageModelId(settings.modelId).provider
}

export async function generateMomentsImage(params: MomentsImageGenParams): Promise<string> {
  let effectiveParams = params
  const dimPrompt =
    params.characterMediaPromptForInference?.trim() || params.prompt?.trim() || undefined
  const dimOptions =
    params.settings.imageSizeMode === 'fixed'
      ? undefined
      : {
          prompt: dimPrompt,
          context: params.promptContext,
        }
  if (params.width == null || params.height == null || !params.imageSize) {
    const dims = resolveImageGenDimensions(params.settings, dimOptions)
    effectiveParams = {
      ...effectiveParams,
      width: params.width ?? dims.width,
      height: params.height ?? dims.height,
      imageSize: params.imageSize ?? dims.imageSize,
    }
  }
  if (effectiveParams.promptContext === 'character_media') {
    const sanitized = sanitizeCharacterMediaImagePrompt(effectiveParams.prompt)
    const englishPrompt = await resolveCharacterMediaPromptEnglish(sanitized)
    effectiveParams = {
      ...effectiveParams,
      prompt: englishPrompt,
      characterMediaPromptForInference: sanitized,
    }
  }
  const provider = resolveProvider(effectiveParams.settings)
  let dataUrl: string
  if (provider === 'qianfan') dataUrl = await generateQianfanImage(effectiveParams)
  else if (provider === 'volcengine') dataUrl = await generateVolcengineImage(effectiveParams)
  else if (provider === 'novelai') dataUrl = await generateNovelaiImage(effectiveParams)
  else if (provider === 'gemini') dataUrl = await generateGeminiImage(effectiveParams)
  else if (provider === 'openai') dataUrl = await generateOpenaiImage(effectiveParams)
  else if (provider === 'custom') dataUrl = await generateCustomImage(effectiveParams)
  else dataUrl = await generateSiliconFlowImage(effectiveParams)
  dataUrl = await ensureMomentsImageDataUrl(dataUrl)
  return applyCharacterSelfieMirrorFlip(effectiveParams, dataUrl)
}
