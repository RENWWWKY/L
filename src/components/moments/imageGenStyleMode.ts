/** 生图风格二选一：预设 / 自定义前缀 */
export type ImageGenStyleMode = 'preset' | 'custom'

export function normalizeImageGenStyleMode(raw: unknown): ImageGenStyleMode {
  if (raw === 'custom') return 'custom'
  return 'preset'
}

/** @deprecated 画师串已并入提示词 Tab；旧数据 `artist` 在 normalize 时映射为 preset */
export function isImageGenArtistStyleMode(_mode: unknown): _mode is 'artist' {
  return false
}
