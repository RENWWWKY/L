/**
 * 与微信 ChatRoom 一致的软键盘遮挡高度估算（visualViewport baseline）。
 * @see src/phone/apps/wechat/ChatRoom.tsx 内 keyboardInsetPx effect
 */

export function computeWeChatStyleKeyboardInset(baselineRef: { current: number }): number {
  const vv = window.visualViewport
  if (!vv) return 0

  const nav = navigator as Navigator & {
    virtualKeyboard?: { boundingRect?: { height?: number } }
  }
  const vkInset = Math.max(0, Math.round(nav.virtualKeyboard?.boundingRect?.height ?? 0))

  const visible = vv.height + vv.offsetTop
  const cssVhRaw = window.getComputedStyle(document.documentElement).getPropertyValue('--app-vh')
  const cssVh = Number.parseFloat(cssVhRaw)

  const baselineCandidate = Math.max(
    visible,
    Math.round(window.innerHeight || 0),
    Number.isFinite(cssVh) ? Math.round(cssVh) : 0,
  )
  if (baselineCandidate > baselineRef.current) baselineRef.current = baselineCandidate

  let inset = Math.max(
    0,
    Math.round(baselineRef.current - visible),
    Math.round((window.innerHeight || 0) - visible),
    Number.isFinite(cssVh) ? Math.round(cssVh - visible) : 0,
    vkInset,
  )

  inset = Math.min(inset, Math.round((baselineRef.current * 0.6) || 0))
  return inset
}

/** 输入栏底边超出可视区域底部时，补足抬升量（iOS 26 上 baseline 偶发为 0） */
export function measureComposerOverlapPx(el: HTMLElement | null): number {
  const vv = window.visualViewport
  if (!vv || !el) return 0
  const visibleBottom = vv.offsetTop + vv.height
  return Math.max(0, Math.round(el.getBoundingClientRect().bottom - visibleBottom + 8))
}
