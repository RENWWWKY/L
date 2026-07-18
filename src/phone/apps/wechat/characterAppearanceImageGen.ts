import {
  isCharacterMediaAppearanceLockPrompt,
  isCharacterMediaCharacterAppearanceNeededPrompt,
  isCharacterMediaCharacterFaceVisiblePrompt,
  isCharacterMediaReferenceImagePrompt,
} from '../../../components/moments/momentsImagePromptEnhancer'
import { translateCharacterMediaPromptTagsToEnglishSync } from '../../../components/moments/characterMediaPromptTranslator'
import type { MomentsImageGenParams } from '../../../components/moments/momentsImageGen'
import { modelSupportsReferenceImageUpload } from '../../../components/moments/imageGenModelCapabilities'
import { resolveImageGenDimensions } from '../../../components/moments/resolveImageGenDimensions'
import type { MomentsImageGenSettings } from '../../../components/moments/useMomentsSettingsStore'
import { inferMomentsImageProviderFromModelId, parseMomentsImageModelId } from '../../../components/moments/momentsImageModelCatalog'
import { resolveCharacterAvatarUrl } from '../../utils/characterAvatarUrl'
import { normalizeCharacterImageGenPromptForApi } from '../../../components/moments/momentCharacterImageRules'
import { sanitizeCharacterMediaImagePrompt } from '../../../components/moments/characterMediaPromptSanitizer'
import { buildDatingPlotCastReferenceLockNote } from './dating/datingPlotImageCast'
import { sanitizeDatingPlotImagePrompt } from './dating/datingPlotImagePromptSanitizer'
import {
  getCharacterAppearanceRefImages,
  resolveCharacterAppearanceRefUrls,
} from './characterAppearanceRefImages'
import type { Character, Gender, CharacterAppearanceRefImage } from './newFriendsPersona/types'

const APPEARANCE_WORLD_BOOK_TITLES = ['外在形象', '气质与体态']

function genderLabelZh(gender: Gender | undefined | null): string {
  if (gender === 'male') return '男'
  if (gender === 'female') return '女'
  if (gender === 'other') return '其他'
  return ''
}

/** 写入参考图锁脸 prompt 的英文性别约束（有参考图自拍时强制附带） */
export function extractCharacterGenderHintForImageGen(gender: Gender | undefined | null): string {
  if (gender === 'male') return 'male (man/boy)'
  if (gender === 'female') return 'female (woman/girl)'
  return ''
}

function danbooruGenderTag(gender: Gender | undefined | null): '1boy' | '1girl' | null {
  if (gender === 'male') return '1boy'
  if (gender === 'female') return '1girl'
  return null
}

function wrongDanbooruGenderTag(gender: Gender | undefined | null): '1boy' | '1girl' | null {
  if (gender === 'male') return '1girl'
  if (gender === 'female') return '1boy'
  return null
}

/**
 * 朋友圈 / 角色媒体生图：按档案性别改写 prompt 里被 LLM 写反的 1boy/1girl、young man/woman 等。
 * 有本人参考图时也必须执行，否则 API 会优先服从错误性别 tag。
 */
export function enforceCharacterMediaImagePromptGender(
  prompt: string,
  gender: Gender | undefined | null,
): string {
  if (gender !== 'male' && gender !== 'female') return prompt.trim()
  let s = prompt.trim()
  if (!s) return s

  const correct = danbooruGenderTag(gender)!
  const wrong = wrongDanbooruGenderTag(gender)!
  const correctEn = gender === 'female' ? 'young woman' : 'young man'
  const wrongEn = gender === 'female' ? 'young man' : 'young woman'
  const correctSex = gender === 'female' ? 'female' : 'male'
  const wrongSex = gender === 'female' ? 'male' : 'female'

  s = s.replace(new RegExp(`\\b${wrong}\\b\\s*,?\\s*(reference\\s+character)\\b`, 'gi'), `${correct}, $1`)
  s = s.replace(new RegExp(`\\b(reference\\s+character)\\b\\s*,?\\s*\\b${wrong}\\b`, 'gi'), `$1, ${correct}`)
  s = s.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), correct)
  s = s.replace(new RegExp(`\\b${wrongEn.replace(' ', '\\s+')}\\b`, 'gi'), correctEn)
  s = s.replace(new RegExp(`\\bon\\s+${wrongSex}\\s+lips\\b`, 'gi'), 'on lips')
  s = s.replace(new RegExp(`\\b${wrongSex}\\s+lips\\b`, 'gi'), 'lips')
  s = s.replace(new RegExp(`,\\s*\\b${wrongSex}\\b\\s*,`, 'gi'), `, ${correctSex},`)
  s = s.replace(new RegExp(`^\\b${wrongSex}\\b\\s*,`, 'gi'), `${correctSex},`)
  s = s.replace(new RegExp(`,\\s*\\b${wrongSex}\\b\\s*$`, 'gi'), `, ${correctSex}`)

  if (/\breference\s+character\b/i.test(s) && !new RegExp(`\\b${correct}\\b`, 'i').test(s)) {
    s = `${correct}, ${extractCharacterGenderHintForImageGen(gender)}, ${s}`
  } else if (
    !new RegExp(`\\b${correct}\\b`, 'i').test(s) &&
    /\b(person|portrait|selfie|face|lipstick|leaning|wearing)\b/i.test(s)
  ) {
    s = `${correct}, ${correctEn}, ${s}`
  }

  return s.replace(/\s*,\s*,+/g, ', ').replace(/^,\s*/, '').replace(/\s+/g, ' ').trim()
}

/** @deprecated 使用 resolveCharacterAppearanceRefUrls */
export function resolveCharacterAppearanceRefUrl(character: Character | null | undefined): string {
  return resolveCharacterAppearanceRefUrls(character)[0] ?? ''
}

/** 角色是否已配置 AI 生图专用形象参考图 */
export function characterHasAppearanceReference(character: Character | null | undefined): boolean {
  return resolveCharacterAppearanceRefUrls(character).length > 0
}

/** 用户填写的形象参考文字补充（与参考图一并注入生图） */
export function extractCharacterAppearanceRefNote(character: Character | null | undefined): string {
  const note = character?.appearanceRefNote?.trim().replace(/\s+/g, ' ')
  if (!note) return ''
  return note.slice(0, 500)
}

/** 外貌描述可对齐的身体区域（不露脸时按画面选择性注入） */
export type AppearanceTraitRegion =
  | 'face'
  | 'hair'
  | 'hands'
  | 'arms'
  | 'body'
  | 'legs'
  | 'skin'
  | 'clothing'
  | 'other'

const APPEARANCE_REGION_SCENE_RES: Record<Exclude<AppearanceTraitRegion, 'other'>, RegExp> = {
  face: /\b(?:face|faces|facial|headshot|portrait|eyes?|lips?|mouth|jaw|chin|cheek|forehead|nose|blush|expression|smile)\b|脸|面|五官|眼|唇|颊|额|鼻|表情|微笑/i,
  hair: /\b(?:hair|bangs|ponytail|braid)\b|发|刘海|马尾|辫/i,
  hands: /\b(?:hands?|fingers?|knuckles?|fingertips?|nails?|rings?|holding hand|interlaced|interlocked)\b|手|指|指节|指尖|指甲|戒指|指环|十指|牵手|握手/i,
  arms: /\b(?:arms?|forearms?|wrists?|elbows?)\b|臂|手臂|小臂|腕|肘|袖口/i,
  body: /\b(?:body|figure|physique|torso|waist|hips?|chest|belly|abdomen|curvy|slender|slim|muscular|hourglass|bust)\b|身材|体型|身形|腰|胯|胸|腹|臀|丰满|纤细|瘦|壮|宽肩|窄腰|身高/i,
  legs: /\b(?:legs?|thighs?|calves?|feet|foot|ankles?|knees?)\b|腿|大腿|小腿|脚|踝|膝|鞋/i,
  skin: /\b(?:skin|skin[\s-]?tone|fair skin|pale|tan)\b|肤|皮肤|肤色|冷白|暖白|小麦色/i,
  clothing: /\b(?:clothes?|clothing|outfit|dress|shirt|coat|jacket|lingerie|underwear|sweater)\b|穿|衣|裙|衫|外套|内衣|睡衣|浴袍/i,
}

const APPEARANCE_REGION_CLAUSE_RES: Record<Exclude<AppearanceTraitRegion, 'other'>, RegExp> = {
  face: /\b(?:face|facial|eyes?|eyelashes?|lips?|mouth|jaw|chin|cheek|forehead|nose|blush|expression|smile|pupils?)\b|脸|面|五官|眼|瞳|睫|唇|嘴|颊|额|鼻|表情|微笑|桃花眼|卧蚕/i,
  hair: /\b(?:hair|bangs|ponytail|braid|fringe)\b|发|刘海|马尾|辫|鬓/i,
  hands: /\b(?:hands?|fingers?|knuckles?|fingertips?|nails?|rings?|manicure)\b|手|指|指节|指尖|指甲|美甲|戒指|指环|无名指|尾戒/i,
  arms: /\b(?:arms?|forearms?|wrists?|elbows?)\b|臂|手臂|小臂|腕|肘|手腕/i,
  body: /\b(?:body|figure|physique|torso|waist|hips?|chest|belly|abdomen|curvy|slender|slim|muscular|hourglass|bust|height)\b|身材|体型|身形|腰|胯|胸|腹|臀|丰满|纤细|瘦削|壮硕|宽肩|窄腰|身高|体脂|肌肉/i,
  legs: /\b(?:legs?|thighs?|calves?|feet|foot|ankles?|knees?)\b|腿|大腿|小腿|脚|踝|膝|长腿/i,
  skin: /\b(?:skin|skin[\s-]?tone|fair skin|pale|tan|porcelain)\b|肤|皮肤|肤色|冷白|暖白|白皙|小麦色|健康色/i,
  clothing: /\b(?:clothes?|clothing|outfit|dress|shirt|coat|jacket|lingerie|underwear|sweater|wear(?:s|ing)?)\b|穿|衣|裙|衫|外套|内衣|睡衣|浴袍|常穿|穿搭/i,
}

function splitAppearanceTraitClauses(text: string): string[] {
  return text
    .split(/[\n；;。！？!？]+|,(?![^()]*\))|，/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
}

function classifyAppearanceTraitClause(clause: string): AppearanceTraitRegion[] {
  const hit: AppearanceTraitRegion[] = []
  for (const region of Object.keys(APPEARANCE_REGION_CLAUSE_RES) as Array<
    Exclude<AppearanceTraitRegion, 'other'>
  >) {
    if (APPEARANCE_REGION_CLAUSE_RES[region].test(clause)) hit.push(region)
  }
  return hit.length ? hit : ['other']
}

/** 从生图构图 prompt 推断画面中可能露出的身体区域 */
export function detectVisibleAppearanceRegionsFromPrompt(prompt: string): Set<AppearanceTraitRegion> {
  const p = prompt.trim()
  const regions = new Set<AppearanceTraitRegion>()
  if (!p) return regions

  for (const region of Object.keys(APPEARANCE_REGION_SCENE_RES) as Array<
    Exclude<AppearanceTraitRegion, 'other'>
  >) {
    if (APPEARANCE_REGION_SCENE_RES[region].test(p)) regions.add(region)
  }

  if (/\b(?:full body|whole body)\b|全身|整身/i.test(p)) {
    regions.add('body')
    regions.add('arms')
    regions.add('legs')
    regions.add('hands')
    regions.add('clothing')
    regions.add('skin')
  }
  if (/\b(?:upper body|half[\s-]?body|waist-up|chest-up)\b|上半身|半身|七分身|腰部以上/i.test(p)) {
    regions.add('body')
    regions.add('arms')
    regions.add('clothing')
    regions.add('skin')
  }
  if (
    regions.has('hands') ||
    regions.has('arms') ||
    regions.has('body') ||
    regions.has('legs')
  ) {
    regions.add('skin')
  }

  return regions
}

/**
 * 按画面露出部位，从外貌关键词/特征补充里筛选可注入的描述。
 * - 露脸：原样返回
 * - 不露脸：去掉脸/发相关句，只保留与手、身材、腿等可见区域匹配的词
 */
export function selectAppearanceTraitsForVisibleParts(
  appearanceText: string,
  scenePrompt: string,
  options?: { faceVisible?: boolean },
): string {
  const text = appearanceText.trim().replace(/\s+/g, ' ')
  if (!text) return ''

  const faceVisible =
    options?.faceVisible ?? isCharacterMediaCharacterFaceVisiblePrompt(scenePrompt)
  if (faceVisible) return text.slice(0, 500)

  const visible = detectVisibleAppearanceRegionsFromPrompt(scenePrompt)
  visible.delete('face')
  visible.delete('hair')
  if (!visible.size) return ''

  const kept: string[] = []
  const seen = new Set<string>()
  for (const clause of splitAppearanceTraitClauses(text)) {
    const regions = classifyAppearanceTraitClause(clause)
    if (regions.includes('face') || regions.includes('hair')) continue
    if (regions.length === 1 && regions[0] === 'other') continue
    if (!regions.some((r) => visible.has(r))) continue
    const key = clause.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    kept.push(clause)
  }
  return kept.join('，').slice(0, 500)
}

function mergeUniqueCommaTags(parts: string[], extra: string): void {
  const seen = new Set(parts.map((p) => p.trim().toLowerCase()).filter(Boolean))
  for (const tag of extra.split(/[,，]/).map((t) => t.trim()).filter(Boolean)) {
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    parts.push(tag)
  }
}

/** 无参考图时替换 LLM 误写的 reference character，改写入 1boy/1girl + 外貌 tag */
export function buildNoRefCharacterSubjectTags(character: Character | null | undefined): string {
  const parts: string[] = []
  const gender = character?.gender
  if (gender === 'male') parts.push('1boy')
  else if (gender === 'female') parts.push('1girl')

  const note = extractCharacterAppearanceRefNote(character)
  if (note) mergeUniqueCommaTags(parts, translateCharacterMediaPromptTagsToEnglishSync(note))

  const hint = extractCharacterAppearanceHint(character)
  if (hint) mergeUniqueCommaTags(parts, translateCharacterMediaPromptTagsToEnglishSync(hint))

  if (!parts.length) {
    if (gender === 'female') parts.push('young woman')
    else if (gender === 'male') parts.push('young man')
  }
  return parts.join(', ')
}

/** 将 prompt 中的 reference character 占位替换为具体外貌 tag（仅无参考图时） */
export function replaceReferenceCharacterPlaceholder(prompt: string, subjectTags: string): string {
  const tags = subjectTags.trim()
  if (!tags || !/\breference character\b/i.test(prompt)) return prompt
  let s = prompt.replace(/\breference character(?:'s|s)\s+/gi, `${tags}, `)
  s = s.replace(/\breference character\b/gi, tags)
  return s
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/^,\s*|\s*,$/g, '')
    .trim()
}

/** 从档案与世界书提取可写入生图 prompt 的外貌摘要（无参考图时的回落） */
export function extractCharacterAppearanceHint(character: Character | null | undefined): string {
  if (!character) return ''
  const parts: string[] = []

  const gender = genderLabelZh(character.gender)
  if (gender) parts.push(gender)
  if (character.age != null && Number.isFinite(character.age)) parts.push(`${character.age}岁`)
  if (character.height?.trim()) parts.push(`身高${character.height.trim()}`)
  if (character.identity?.trim()) parts.push(character.identity.trim())

  for (const book of character.worldBooks ?? []) {
    if (!book.enabled) continue
    for (const item of book.items ?? []) {
      if (!item.enabled) continue
      if (!APPEARANCE_WORLD_BOOK_TITLES.some((title) => item.name.includes(title))) continue
      const content = item.content.trim()
      if (content) parts.push(content.replace(/\s+/g, ' ').slice(0, 180))
    }
  }

  const bio = character.bio?.trim()
  if (bio) parts.push(bio.replace(/\s+/g, ' ').slice(0, 120))

  const merged = parts.join('，').replace(/\s+/g, ' ').trim()
  return merged.slice(0, 320)
}

/** 无参考图时注入聊天 LLM 的外貌 DNA 摘要 */
export function resolveCharacterImageGenPromptAppearanceHint(
  character: Character | null | undefined,
): string | undefined {
  if (characterHasAppearanceReference(character)) return undefined
  const hint = extractCharacterAppearanceHint(character).trim()
  return hint || undefined
}

export async function loadImageUrlAsDataUrl(url: string): Promise<string | null> {
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

export function parseImageDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const m = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!m?.[2]?.trim()) return null
  return { mime: m[1]!.trim() || 'image/png', base64: m[2]!.trim() }
}

/** 角色私聊/群聊/朋友圈配图：自拍/第一视角露肢体时自动附带形象参考与外貌摘要 */
export function buildCharacterMediaImageGenParams(opts: {
  prompt: string
  settings: MomentsImageGenSettings
  character?: Character | null
  /** 额外参考图（如用户形象参考），与角色参考一并参与锁脸/锁画风 */
  additionalReferenceImages?: CharacterAppearanceRefImage[]
  /** 与 additionalReferenceImages 配套的文字补充 */
  additionalAppearanceRefNote?: string
  width?: number
  height?: number
  imageSize?: string
}): MomentsImageGenParams {
  const rawPrompt = opts.prompt
  const refEntries = [
    ...getCharacterAppearanceRefImages(opts.character),
    ...(opts.additionalReferenceImages ?? []),
  ]
  const referenceImageUrls = [
    ...resolveCharacterAppearanceRefUrls(opts.character),
    ...(opts.additionalReferenceImages ?? [])
      .map((item) => resolveCharacterAvatarUrl({ avatarUrl: item.url }) || item.url.trim())
      .filter(Boolean),
  ].filter((url, index, arr) => arr.indexOf(url) === index)
  const hasReferenceConfigured = referenceImageUrls.length > 0
  const provider = opts.settings.provider ?? inferMomentsImageProviderFromModelId(opts.settings.modelId)
  const { modelName } = parseMomentsImageModelId(opts.settings.modelId)
  const refUploadSupported = modelSupportsReferenceImageUpload(provider, modelName)

  const promptForApi = !hasReferenceConfigured
    ? replaceReferenceCharacterPlaceholder(rawPrompt, buildNoRefCharacterSubjectTags(opts.character))
    : rawPrompt
  const genderCorrected = enforceCharacterMediaImagePromptGender(promptForApi, opts.character?.gender)
  const prompt = sanitizeCharacterMediaImagePrompt(normalizeCharacterImageGenPromptForApi(genderCorrected))
  const lockAppearance = isCharacterMediaAppearanceLockPrompt(prompt)
  const faceVisible = isCharacterMediaCharacterFaceVisiblePrompt(prompt)
  /** 自拍/对镜：锁脸身份；其它露脸构图：仅锁画风；不露脸（牵手特写等）：不传参考图 */
  const attachIdentityReference =
    refUploadSupported && hasReferenceConfigured && isCharacterMediaReferenceImagePrompt(prompt)
  const attachStyleReference =
    refUploadSupported && hasReferenceConfigured && !attachIdentityReference && faceVisible
  const attachReferenceImages = attachIdentityReference || attachStyleReference
  const characterAppearanceNeeded = isCharacterMediaCharacterAppearanceNeededPrompt(rawPrompt)
  const fullRefNoteParts = [
    characterAppearanceNeeded ? extractCharacterAppearanceRefNote(opts.character) : '',
    lockAppearance && characterAppearanceNeeded ? opts.additionalAppearanceRefNote?.trim() ?? '' : '',
  ].filter(Boolean)
  const fullRefNote = fullRefNoteParts.join('；').slice(0, 500)
  /** 不露脸时仍按露出部位挑选戒指/身材等外貌词；露脸则用完整特征补充 */
  const selectiveSource = [
    extractCharacterAppearanceRefNote(opts.character),
    opts.additionalAppearanceRefNote?.trim() ?? '',
    !hasReferenceConfigured || !refUploadSupported
      ? extractCharacterAppearanceHint(opts.character)
      : '',
  ]
    .filter(Boolean)
    .join('；')
  const selectiveRefNote =
    !faceVisible && characterAppearanceNeeded
      ? selectAppearanceTraitsForVisibleParts(selectiveSource, rawPrompt, { faceVisible: false })
      : ''
  const refNote = faceVisible ? fullRefNote : selectiveRefNote

  const defaultDims =
    opts.width == null && opts.height == null && !opts.imageSize
      ? resolveImageGenDimensions(
          opts.settings,
          opts.settings.imageSizeMode === 'fixed'
            ? undefined
            : {
                prompt: rawPrompt,
                context: 'character_media',
              },
        )
      : null

  const genderHint = extractCharacterGenderHintForImageGen(opts.character?.gender) || undefined

  return {
    prompt,
    settings: opts.settings,
    width: opts.width ?? defaultDims?.width,
    height: opts.height ?? defaultDims?.height,
    imageSize: opts.imageSize ?? defaultDims?.imageSize,
    promptContext: 'character_media',
    characterMediaPromptForInference: rawPrompt,
    referenceImageUrls: attachReferenceImages && referenceImageUrls.length ? referenceImageUrls : undefined,
    referenceImageKinds:
      attachReferenceImages && refEntries.length ? refEntries.map((item) => item.kind) : undefined,
    referenceImageUrl: attachReferenceImages ? referenceImageUrls[0] : undefined,
    characterAppearanceRefNote: refNote || undefined,
    characterAppearanceHint:
      faceVisible && (!hasReferenceConfigured || !refUploadSupported)
        ? extractCharacterAppearanceHint(opts.character) || undefined
        : undefined,
    // 档案有明确性别时一律附带（不再仅限自拍），避免第三人称构图写成对面性别
    characterGenderHint: genderHint,
    referenceStyleOnly: attachStyleReference || undefined,
  }
}

/** 线下约会剧情配图：第三人称电影镜头；支持双人 cast（角色 + 玩家）参考图 */
export function buildDatingPlotImageGenParams(opts: {
  prompt: string
  settings: MomentsImageGenSettings
  character?: Character | null
  playerIdentity?: Character | null
  additionalReferenceImages?: CharacterAppearanceRefImage[]
  playerDisplayName?: string
  width?: number
  height?: number
  imageSize?: string
}): MomentsImageGenParams {
  const prompt = sanitizeDatingPlotImagePrompt(opts.prompt)
  const characterRefEntries = getCharacterAppearanceRefImages(opts.character)
  const playerRefEntries = opts.additionalReferenceImages ?? []
  const characterRefUrls = resolveCharacterAppearanceRefUrls(opts.character)
  const playerRefUrls = playerRefEntries
    .map((item) => resolveCharacterAvatarUrl({ avatarUrl: item.url }) || item.url.trim())
    .filter(Boolean)
  const referenceImageUrls = [...characterRefUrls, ...playerRefUrls].filter(
    (url, index, arr) => arr.indexOf(url) === index,
  )
  const refEntries = [...characterRefEntries, ...playerRefEntries]
  const hasReferenceConfigured = referenceImageUrls.length > 0
  const provider = opts.settings.provider ?? inferMomentsImageProviderFromModelId(opts.settings.modelId)
  const { modelName } = parseMomentsImageModelId(opts.settings.modelId)
  const refUploadSupported = modelSupportsReferenceImageUpload(provider, modelName)
  const attachReferenceImages = refUploadSupported && hasReferenceConfigured
  const castLockNote = buildDatingPlotCastReferenceLockNote({
    character: opts.character,
    playerIdentity: opts.playerIdentity,
    playerDisplayName: opts.playerDisplayName,
    characterRefCount: characterRefUrls.length,
    playerRefCount: playerRefUrls.length,
  })

  const defaultDims =
    opts.width == null && opts.height == null && !opts.imageSize
      ? resolveImageGenDimensions(opts.settings)
      : null

  return {
    prompt,
    settings: opts.settings,
    width: opts.width ?? defaultDims?.width,
    height: opts.height ?? defaultDims?.height,
    imageSize: opts.imageSize ?? defaultDims?.imageSize,
    promptContext: 'dating_plot',
    referenceImageUrls: attachReferenceImages ? referenceImageUrls : undefined,
    referenceImageKinds:
      attachReferenceImages && refEntries.length ? refEntries.map((item) => item.kind) : undefined,
    referenceImageUrl: attachReferenceImages ? referenceImageUrls[0] : undefined,
    characterAppearanceRefNote: attachReferenceImages ? castLockNote || undefined : undefined,
    characterAppearanceHint:
      !hasReferenceConfigured || !refUploadSupported
        ? extractCharacterAppearanceHint(opts.character)
        : undefined,
    characterGenderHint: extractCharacterGenderHintForImageGen(opts.character?.gender) || undefined,
    datingPlotCharacterRefCount: characterRefUrls.length,
    datingPlotPlayerGenderHint: extractCharacterGenderHintForImageGen(opts.playerIdentity?.gender) || undefined,
    referenceStyleOnly: false,
  }
}

export { getCharacterAppearanceRefImages, resolveCharacterAppearanceRefUrls }
