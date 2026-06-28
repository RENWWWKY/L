import type { CSSProperties } from 'react'

import type { WeChatBubbleTheme } from '../../types'

/** 各 Messenger 气泡模版独立字体栈（与 Lumi 全局 --wx-font 无关） */
export const BUBBLE_TEMPLATE_FONT_STACKS = {
  wechat:
    '-apple-system, "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif',
  imessage:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "PingFang SC", sans-serif',
  telegram: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  talkmaker:
    '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Nanum Gothic", "PingFang SC", "Noto Sans CJK SC", sans-serif',
} as const

export type BubbleTemplateFontStyle = keyof typeof BUBBLE_TEMPLATE_FONT_STACKS

export function bubbleTemplateFontFamily(style: BubbleTemplateFontStyle | string | undefined): string {
  const key = style as BubbleTemplateFontStyle
  return BUBBLE_TEMPLATE_FONT_STACKS[key] ?? BUBBLE_TEMPLATE_FONT_STACKS.wechat
}

/** 仅当套用 Messenger 预设（显式 bubbleTailStyle）时使用模版字体；默认 Lumi 气泡仍走全局字体 */
export function resolveChatDisplayFontFamily(bubble: WeChatBubbleTheme): string | null {
  const style = bubble.bubbleTailStyle
  if (!style) return null
  return bubbleTemplateFontFamily(style)
}

export function chatDisplayFontCssVars(fontFamily: string | null | undefined): CSSProperties | undefined {
  if (!fontFamily?.trim()) return undefined
  return { ['--wx-chat-font' as string]: fontFamily.trim() }
}

export function isBubbleTemplateFontActive(bubble: WeChatBubbleTheme): boolean {
  return resolveChatDisplayFontFamily(bubble) != null
}
