import type { MomentsImageSizeOption } from './momentsImageSizePresets'
import {
  isCharacterMediaDualPersonIntimatePrompt,
  isCharacterMediaMirrorSelfiePrompt,
  isCharacterMediaPhotographingOthersPrompt,
  isCharacterMediaSelfiePrompt,
} from './momentsImagePromptEnhancer'

export type CharacterMediaImageAspectPreference = 'portrait' | 'landscape' | 'square'

const LANDSCAPE_HINT =
  /\b(?:wide shot|landscape|scenery|horizon|sunset|seascape|street view|panoramic|cityscape|skyline|turquoise sea|ocean behind)\b|全景|远景|风景|街景|海平线|天际线|横画幅|宽画幅|碧海|海面|城市天际/i

const PORTRAIT_HINT =
  /\b(?:selfie shot|mirror selfie shot|close-up face|portrait|upper body|three-quarter body|half body|full body|cowgirl|missionary|girl on top)\b|自拍|对镜|竖画幅|怼脸|半身|七分身|人像|上半身|全身照/i

/** 按角色配图 prompt 推断竖/横/方，供选最接近的 API 尺寸 */
export function inferCharacterMediaImageAspectPreference(prompt: string): CharacterMediaImageAspectPreference {
  const p = prompt.trim()
  if (!p) return 'square'

  const selfie = isCharacterMediaSelfiePrompt(p)
  const mirror = isCharacterMediaMirrorSelfiePrompt(p)
  const photoOthers = isCharacterMediaPhotographingOthersPrompt(p)
  const dualIntimate = isCharacterMediaDualPersonIntimatePrompt(p)

  if (selfie || mirror) return 'portrait'
  if (photoOthers && !LANDSCAPE_HINT.test(p)) return 'portrait'
  if (dualIntimate) {
    if (LANDSCAPE_HINT.test(p) || /\bwide shot\b|全景|远景|panoramic/i.test(p)) return 'landscape'
    return 'portrait'
  }

  const landscape = LANDSCAPE_HINT.test(p)
  const portrait = PORTRAIT_HINT.test(p) || /\b1girl\b|\b1boy\b|\breference character\b/i.test(p)

  if (landscape && !portrait) return 'landscape'
  if (portrait && !landscape) return 'portrait'
  if (landscape && portrait) {
    if (/\b(?:wide shot|horizon|seascape|landscape|scenery)\b|全景|海平线|远景/i.test(p)) return 'landscape'
    return 'portrait'
  }

  if (/\bclose-up\b|特写/i.test(p) && !landscape && !dualIntimate) return 'portrait'
  return 'square'
}

export function pickImageSizeForAspectPreference(
  sizes: MomentsImageSizeOption[],
  preference: CharacterMediaImageAspectPreference,
): MomentsImageSizeOption | undefined {
  if (!sizes.length) return undefined
  if (preference === 'portrait') {
    return sizes.reduce((best, s) => (s.height / s.width > best.height / best.width ? s : best))
  }
  if (preference === 'landscape') {
    return sizes.reduce((best, s) => (s.width / s.height > best.width / best.height ? s : best))
  }
  return sizes.reduce((best, s) => {
    const dr = Math.abs(s.width / s.height - 1)
    const br = Math.abs(best.width / best.height - 1)
    return dr < br ? s : best
  })
}
