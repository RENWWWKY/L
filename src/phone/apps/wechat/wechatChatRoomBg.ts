import type { CSSProperties } from 'react'

import type { WeChatChatRoomBg } from '../../types'

export function wechatChatRoomBgEqual(a: WeChatChatRoomBg, b: WeChatChatRoomBg): boolean {
  if (a.mode !== b.mode) return false
  if (a.mode === 'solid' && b.mode === 'solid') return a.color === b.color
  if (a.mode === 'image' && b.mode === 'image') {
    return a.imageUrl === b.imageUrl && a.fallbackColor === b.fallbackColor
  }
  return false
}

export function wechatChatRoomBgFallbackColor(bg: WeChatChatRoomBg): string {
  return bg.mode === 'solid' ? bg.color : bg.fallbackColor
}

export function wechatChatRoomBgToStyle(
  bg: WeChatChatRoomBg,
  resolveImageUrl: (path: string) => string,
): CSSProperties {
  if (bg.mode === 'solid') {
    return { backgroundColor: bg.color }
  }
  const url = resolveImageUrl(bg.imageUrl)
  return {
    backgroundColor: bg.fallbackColor,
    backgroundImage: url ? `url(${url})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }
}
