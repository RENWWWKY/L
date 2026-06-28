/** 聊天气泡入场：果冻感 spring（从底角弹出） */
export const CHAT_BUBBLE_ENTER_SPRING = {
  type: 'spring' as const,
  stiffness: 450,
  damping: 26,
  mass: 0.8,
}

export const CHAT_BUBBLE_ENTER_INITIAL = {
  opacity: 0,
  scaleY: 0.1,
  scaleX: 0.8,
  y: 20,
}

export const CHAT_BUBBLE_ENTER_ANIMATE = {
  opacity: 1,
  scaleY: 1,
  scaleX: 1,
  y: 0,
}

export function chatBubbleTransformOrigin(
  isSelf: boolean,
  _tailStyle: 'wechat' | 'imessage' | 'telegram' | 'talkmaker' = 'wechat',
): { originX: number; originY: number } {
  return {
    originX: isSelf ? 1 : 0,
    originY: 1,
  }
}
