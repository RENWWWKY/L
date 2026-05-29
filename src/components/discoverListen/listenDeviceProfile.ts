/** iOS Safari（含 iPadOS 桌面模式） */
export function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!isIOS) return false
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Chromium/i.test(ua)
}

export function isCoarsePointerDevice(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia('(pointer: coarse)').matches) return true
    if (window.matchMedia('(hover: none)').matches) return true
  } catch {
    /* matchMedia 不可用 */
  }
  return window.innerWidth < 768
}

/** 全平台静态歌词高亮（无 KTV 扫字） */
export function shouldUseStaticLyricOnly(): boolean {
  return true
}

export function shouldUseLiteFullscreenEffects(): boolean {
  return isCoarsePointerDevice()
}

export function shouldDisableFullscreenBlur(): boolean {
  return isCoarsePointerDevice() || isIOSSafari()
}
