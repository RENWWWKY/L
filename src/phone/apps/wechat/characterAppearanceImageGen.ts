import {
  isCharacterMediaAppearanceLockPrompt,
  isCharacterMediaReferenceImagePrompt,
} from '../../../components/moments/momentsImagePromptEnhancer'
import { translateCharacterMediaPromptTagsToEnglishSync } from '../../../components/moments/characterMediaPromptTranslator'
import type { MomentsImageGenParams } from '../../../components/moments/momentsImageGen'
import type { MomentsImageGenSettings } from '../../../components/moments/useMomentsSettingsStore'
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
  const hasReference = referenceImageUrls.length > 0
  const promptForApi = !hasReference
    ? replaceReferenceCharacterPlaceholder(rawPrompt, buildNoRefCharacterSubjectTags(opts.character))
    : rawPrompt
  const prompt = sanitizeCharacterMediaImagePrompt(normalizeCharacterImageGenPromptForApi(promptForApi))
  const lockAppearance = isCharacterMediaAppearanceLockPrompt(prompt)
  const attachIdentityReference = isCharacterMediaReferenceImagePrompt(prompt)
  const attachStyleReference = hasReference && !attachIdentityReference
  const attachReferenceImages = attachIdentityReference || attachStyleReference
  const refNoteParts = [
    lockAppearance || attachStyleReference ? extractCharacterAppearanceRefNote(opts.character) : '',
    lockAppearance || attachStyleReference ? opts.additionalAppearanceRefNote?.trim() ?? '' : '',
  ].filter(Boolean)
  const refNote = refNoteParts.join('；').slice(0, 500)

  return {
    prompt,
    settings: opts.settings,
    width: opts.width,
    height: opts.height,
    imageSize: opts.imageSize,
    promptContext: 'character_media',
    characterMediaPromptForInference: rawPrompt,
    referenceImageUrls: attachReferenceImages && referenceImageUrls.length ? referenceImageUrls : undefined,
    referenceImageKinds:
      attachReferenceImages && refEntries.length ? refEntries.map((item) => item.kind) : undefined,
    referenceImageUrl: attachReferenceImages ? referenceImageUrls[0] : undefined,
    characterAppearanceRefNote: refNote || undefined,
    characterAppearanceHint: !hasReference ? extractCharacterAppearanceHint(opts.character) || undefined : undefined,
    characterGenderHint:
      attachIdentityReference && hasReference
        ? extractCharacterGenderHintForImageGen(opts.character?.gender)
        : undefined,
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
  const hasReference = referenceImageUrls.length > 0
  const castLockNote = buildDatingPlotCastReferenceLockNote({
    character: opts.character,
    playerIdentity: opts.playerIdentity,
    playerDisplayName: opts.playerDisplayName,
    characterRefCount: characterRefUrls.length,
    playerRefCount: playerRefUrls.length,
  })

  return {
    prompt,
    settings: opts.settings,
    width: opts.width,
    height: opts.height,
    imageSize: opts.imageSize,
    promptContext: 'dating_plot',
    referenceImageUrls: hasReference ? referenceImageUrls : undefined,
    referenceImageKinds: hasReference && refEntries.length ? refEntries.map((item) => item.kind) : undefined,
    referenceImageUrl: hasReference ? referenceImageUrls[0] : undefined,
    characterAppearanceRefNote: castLockNote || undefined,
    characterAppearanceHint:
      !hasReference ? extractCharacterAppearanceHint(opts.character) : undefined,
    characterGenderHint: extractCharacterGenderHintForImageGen(opts.character?.gender) || undefined,
    datingPlotCharacterRefCount: characterRefUrls.length,
    datingPlotPlayerGenderHint: extractCharacterGenderHintForImageGen(opts.playerIdentity?.gender) || undefined,
    referenceStyleOnly: false,
  }
}

export { getCharacterAppearanceRefImages, resolveCharacterAppearanceRefUrls }
