import type { RefObject } from 'react'

import { useKeyboardInset } from '../../hooks/useKeyboardInset'

/** 遇见临时会话 · 与微信 ChatRoom 同源键盘抬升 */
export function useMeetKeyboardInset(
  composerRef?: RefObject<HTMLElement | null>,
): number {
  return useKeyboardInset(composerRef)
}
