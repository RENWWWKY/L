import { isCharacterMediaSelfiePrompt } from './momentsImagePromptEnhancer'
import type { MomentsImageGenParams } from './momentsImageGen'

/** 形象参考补充里写明「参考图即自拍角度」时，不再做客户端镜像校正 */
const SELFIE_ANGLE_REF_NOTE_RE =
  /自拍角度|对镜参考|镜面参考|前置摄像头自拍|前置自拍|自拍参考|自拍形象|mirror\s*selfie|selfie\s*(angle|ref|reference)/i

export function appearanceRefNoteClaimsSelfieAngle(note: string | undefined | null): boolean {
  const t = note?.trim()
  if (!t) return false
  return SELFIE_ANGLE_REF_NOTE_RE.test(t)
}

export function shouldFlipCharacterSelfieOutput(params: MomentsImageGenParams): boolean {
  if (params.promptContext !== 'character_media') return false
  if (!isCharacterMediaSelfiePrompt(params.prompt)) return false
  if (appearanceRefNoteClaimsSelfieAngle(params.characterAppearanceRefNote)) return false
  return true
}

function outputMimeFromDataUrl(dataUrl: string): string {
  const m = /^data:([^;,]+)/i.exec(dataUrl.trim())
  return m?.[1]?.trim().toLowerCase() || 'image/png'
}

/** 将 data URL 图片水平镜像（自拍校正）；失败时原样返回 */
export async function flipImageDataUrlHorizontal(dataUrl: string): Promise<string> {
  const trimmed = dataUrl.trim()
  if (!trimmed.startsWith('data:')) return trimmed

  const mime = outputMimeFromDataUrl(trimmed)
  if (mime === 'image/gif') return trimmed

  if (typeof document === 'undefined') return trimmed

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width
        const h = img.naturalHeight || img.height
        if (!w || !h) {
          resolve(trimmed)
          return
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(trimmed)
          return
        }
        ctx.translate(w, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(img, 0, 0, w, h)
        if (mime === 'image/jpeg' || mime === 'image/jpg') {
          resolve(canvas.toDataURL('image/jpeg', 0.92))
          return
        }
        if (mime === 'image/webp') {
          resolve(canvas.toDataURL('image/webp', 0.92))
          return
        }
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(trimmed)
      }
    }
    img.onerror = () => resolve(trimmed)
    img.src = trimmed
  })
}

export async function applyCharacterSelfieMirrorFlip(
  params: MomentsImageGenParams,
  dataUrl: string,
): Promise<string> {
  if (!shouldFlipCharacterSelfieOutput(params)) return dataUrl
  return flipImageDataUrlHorizontal(dataUrl)
}
