export type PollinationsStylePreset = {
  id: string
  labelZh: string
  labelEn: string
  prefix: string
}

export const POLLINATIONS_STYLE_PRESETS: PollinationsStylePreset[] = [
  { id: 'none', labelZh: '无风格', labelEn: 'NONE', prefix: '' },
  {
    id: 'realistic',
    labelZh: '写实摄影',
    labelEn: 'PHOTOREALISTIC',
    prefix: 'photorealistic, cinematic lighting, ultra detailed, natural colors, ',
  },
  {
    id: 'anime',
    labelZh: '二次元插画',
    labelEn: 'ANIME',
    prefix:
      'anime illustration, 2d anime style, cel shading, vibrant colors, clean linework, expressive eyes, NOT photorealistic, NOT realistic photo, NOT 3d render, ',
  },
  {
    id: 'watercolor',
    labelZh: '水彩手绘',
    labelEn: 'WATERCOLOR',
    prefix: 'watercolor painting, soft brush strokes, artistic illustration, ',
  },
  {
    id: 'pixel',
    labelZh: '像素复古',
    labelEn: 'PIXEL ART',
    prefix: 'pixel art, retro game aesthetic, 8-bit style, ',
  },
  {
    id: 'film',
    labelZh: '胶片怀旧',
    labelEn: 'FILM',
    prefix: 'film photography, vintage aesthetic, subtle grain, warm tones, ',
  },
  {
    id: 'reference_match',
    labelZh: '跟随参考形象图',
    labelEn: 'MATCH REF',
    prefix: '',
  },
]

export const DEFAULT_STYLE_PRESET_ID = 'realistic'

export function getPollinationsStylePreset(id: string): PollinationsStylePreset | undefined {
  return POLLINATIONS_STYLE_PRESETS.find((s) => s.id === id)
}

export function resolveStylePrefix(params: {
  stylePrefixMode: 'preset' | 'custom'
  stylePresetId: string
  customStylePrefix: string
}): string {
  if (params.stylePrefixMode === 'custom') {
    const custom = params.customStylePrefix.trim()
    if (!custom) return ''
    return custom.endsWith(', ') || custom.endsWith(',') ? custom : `${custom}, `
  }
  return getPollinationsStylePreset(params.stylePresetId)?.prefix ?? ''
}
