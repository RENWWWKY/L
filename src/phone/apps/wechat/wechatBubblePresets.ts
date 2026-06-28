import type { ChatThemePatch } from './ChatThemeContext'
import { DEFAULT_CHAT_THEME, type ChatTheme } from './chatTheme/types'
import { wechatChatRoomBgEqual } from './wechatChatRoomBg'
import type { WeChatBubbleTheme, WeChatChatRoomBg, WeChatTheme } from '../../types'
import {
  DEFAULT_CUSTOMIZATION,
  DEFAULT_WECHAT_CHAT_WALLPAPER_PATH,
  wechatBubbleThemesEqual,
} from '../../types'

export type WeChatBubblePreset = {
  id: string
  name: string
  description: string
  bubble: WeChatBubbleTheme
  selfBubbleText: string
  otherBubbleText: string
  /** 套用后写入聊天室默认背景（不影响 Tab 页底图） */
  chatRoomDefaultBg: WeChatChatRoomBg
  /** 全局套用预设时一并写入 wechatTheme（不含 bubbleGlobal / Tab 背景） */
  wechatThemePatch?: Partial<
    Pick<WeChatTheme, 'chatRoomDefaultBg' | 'chatInputBg' | 'chatInputBorder'>
  >
  /** 全局套用预设时一并写入 IndexedDB 聊天输入栏主题 */
  chatThemePatch?: ChatThemePatch
}

/** 高仿官方微信 App 聊天气泡：经典绿 + 白底 + 小圆角 + 指向三角 + 灰底聊天背景 */
export const WECHAT_APP_CLASSIC_BUBBLE_PRESET: WeChatBubblePreset = {
  id: 'wechat-app-classic',
  name: '微信 App',
  description: '经典绿己方、白底对方、指向三角；聊天室背景 #F3F3F3，顶栏 #EDEDED。',
  bubble: {
    selfBubbleBg: '#95EC69',
    otherBubbleBg: '#FFFFFF',
    selfBubbleRadiusPx: 8,
    otherBubbleRadiusPx: 8,
    showAvatar: true,
    avatarRadiusPx: 8,
    showBubbleTail: true,
    bubbleTailStyle: 'wechat',
    mergeConsecutiveAvatarGroup: false,
  },
  selfBubbleText: '#191919',
  otherBubbleText: '#191919',
  chatRoomDefaultBg: { mode: 'solid', color: '#F3F3F3' },
  wechatThemePatch: {
    chatRoomDefaultBg: { mode: 'solid', color: '#F3F3F3' },
    chatInputBg: '#F7F7F7',
    chatInputBorder: 'rgba(0, 0, 0, 0.06)',
  },
  chatThemePatch: {
    inputBar: {
      layout: 'wechat',
      borderRadius: 6,
      borderColor: 'rgba(0, 0, 0, 0.06)',
      backgroundColor: '#F7F7F7',
      buttonColor: '#191919',
      buttonSize: 22,
    },
  },
}

/** 高仿 iOS iMessage：苹果蓝 + 浅灰对方 + 切角尾巴 + #f2f2f6 聊天室 */
export const IMESSAGE_BUBBLE_PRESET: WeChatBubblePreset = {
  id: 'imessage-ios',
  name: 'iMessage',
  description:
    '苹果蓝己方、#E5E5EA 对方、20px 圆角与 iOS 切角尾巴；聊天室 #f2f2f6，底部输入栏毛玻璃药丸样式。',
  bubble: {
    selfBubbleBg: '#0B93F6',
    otherBubbleBg: '#E5E5EA',
    selfBubbleRadiusPx: 20,
    otherBubbleRadiusPx: 20,
    showAvatar: false,
    avatarRadiusPx: 0,
    showBubbleTail: true,
    bubbleTailStyle: 'imessage',
    mergeConsecutiveAvatarGroup: true,
  },
  selfBubbleText: '#FFFFFF',
  otherBubbleText: '#000000',
  chatRoomDefaultBg: { mode: 'solid', color: '#F2F2F6' },
  wechatThemePatch: {
    chatRoomDefaultBg: { mode: 'solid', color: '#F2F2F6' },
    chatInputBg: 'rgba(255, 255, 255, 0.8)',
    chatInputBorder: 'rgba(0, 0, 0, 0.08)',
  },
  chatThemePatch: {
    inputBar: {
      layout: 'imessage',
      borderRadius: 999,
      borderColor: '#D1D1D6',
      backgroundColor: '#FFFFFF',
      buttonColor: '#8E8E93',
      buttonSize: 24,
      sendButtonColor: '#0B93F6',
    },
  },
}

/** 高仿 Talkmaker / KakaoTalk：暖黄己方 + 白底对方 + 底角小尾巴 + 暖蓝灰聊天室 */
export const TALKMAKER_BUBBLE_PRESET: WeChatBubblePreset = {
  id: 'talkmaker-kakao',
  name: 'Talkmaker',
  description:
    '暖黄 #FEE500 / 白底、底角小尾巴、时间戳外置；聊天室 #BACEE0，底部 Kakao 风格输入栏。',
  bubble: {
    selfBubbleBg: '#FEE500',
    otherBubbleBg: '#FFFFFF',
    selfBubbleRadiusPx: 12,
    otherBubbleRadiusPx: 12,
    showAvatar: true,
    avatarRadiusPx: 16,
    showBubbleTail: true,
    bubbleTailStyle: 'talkmaker',
    mergeConsecutiveAvatarGroup: true,
  },
  selfBubbleText: '#000000',
  otherBubbleText: '#000000',
  chatRoomDefaultBg: { mode: 'solid', color: '#BACEE0' },
  wechatThemePatch: {
    chatRoomDefaultBg: { mode: 'solid', color: '#BACEE0' },
    chatInputBg: '#FFFFFF',
    chatInputBorder: '#E5E5E5',
  },
  chatThemePatch: {
    inputBar: {
      layout: 'talkmaker',
      borderRadius: 999,
      borderColor: 'transparent',
      backgroundColor: '#F2F2F2',
      buttonColor: '#666666',
      buttonSize: 22,
      sendButtonColor: '#FEE500',
    },
  },
}

/** 高仿 Telegram 移动端：浅绿己方 + 白底对方 + 鸟喙尾巴 + 内嵌时间双勾 */
export const TELEGRAM_BUBBLE_PRESET: WeChatBubblePreset = {
  id: 'telegram-mobile',
  name: 'Telegram',
  description:
    '浅绿 #EEFFDE / 白底、12px 圆角鸟喙尾巴、微阴影与内嵌时间双勾；聊天室 #8CAABF，底部扁平输入栏。',
  bubble: {
    selfBubbleBg: '#EEFFDE',
    otherBubbleBg: '#FFFFFF',
    selfBubbleRadiusPx: 12,
    otherBubbleRadiusPx: 12,
    showAvatar: false,
    avatarRadiusPx: 0,
    showBubbleTail: true,
    bubbleTailStyle: 'telegram',
    mergeConsecutiveAvatarGroup: true,
  },
  selfBubbleText: '#000000',
  otherBubbleText: '#000000',
  chatRoomDefaultBg: { mode: 'solid', color: '#8CAABF' },
  wechatThemePatch: {
    chatRoomDefaultBg: { mode: 'solid', color: '#8CAABF' },
    chatInputBg: '#FFFFFF',
    chatInputBorder: 'transparent',
  },
  chatThemePatch: {
    inputBar: {
      layout: 'telegram',
      borderRadius: 0,
      borderColor: 'transparent',
      backgroundColor: '#FFFFFF',
      buttonColor: '#8E8E93',
      buttonSize: 24,
      sendButtonColor: '#3390EC',
    },
  },
}

/** 本项目默认气泡样式，便于从预设切回 */
export const WECHAT_APP_DEFAULT_BUBBLE_PRESET: WeChatBubblePreset = {
  id: 'wechat-app-default',
  name: '简约灰蓝',
  description: '低饱和灰蓝己方 + 浅灰对方，无三角；恢复默认聊天壁纸（不改 Tab 页背景）。',
  bubble: {
    ...DEFAULT_CUSTOMIZATION.wechatTheme.bubbleGlobal,
  },
  selfBubbleText: DEFAULT_CUSTOMIZATION.wechatTheme.selfBubbleText,
  otherBubbleText: DEFAULT_CUSTOMIZATION.wechatTheme.otherBubbleText,
  chatRoomDefaultBg: {
    mode: 'image',
    imageUrl: DEFAULT_WECHAT_CHAT_WALLPAPER_PATH,
    fallbackColor: '#EDEDED',
  },
  wechatThemePatch: {
    chatRoomDefaultBg: {
      mode: 'image',
      imageUrl: DEFAULT_WECHAT_CHAT_WALLPAPER_PATH,
      fallbackColor: '#EDEDED',
    },
    chatInputBg: DEFAULT_CUSTOMIZATION.wechatTheme.chatInputBg,
    chatInputBorder: DEFAULT_CUSTOMIZATION.wechatTheme.chatInputBorder,
  },
  chatThemePatch: {
    inputBar: {
      borderRadius: 16,
      borderColor: '#e5e5e5',
      backgroundColor: '#ffffff',
      buttonColor: '#000000',
      buttonSize: 20,
    },
  },
}

/** 与 DEFAULT_CUSTOMIZATION.wechatTheme.bubbleGlobal 形态一致（简约灰蓝） */
export function isLumiDefaultBubbleShape(bubble: WeChatBubbleTheme): boolean {
  const lumi = DEFAULT_CUSTOMIZATION.wechatTheme.bubbleGlobal
  return (
    bubble.selfBubbleBg === lumi.selfBubbleBg &&
    bubble.otherBubbleBg === lumi.otherBubbleBg &&
    bubble.selfBubbleRadiusPx === lumi.selfBubbleRadiusPx &&
    bubble.otherBubbleRadiusPx === lumi.otherBubbleRadiusPx &&
    bubble.showBubbleTail === false &&
    bubble.showAvatar === lumi.showAvatar &&
    bubble.avatarRadiusPx === lumi.avatarRadiusPx &&
    bubble.mergeConsecutiveAvatarGroup === lumi.mergeConsecutiveAvatarGroup
  )
}

/** 套用无 tail 预设或迁移：清掉残留的 Messenger bubbleTailStyle */
export function mergeWeChatBubbleGlobal(
  prev: WeChatBubbleTheme,
  patch: Partial<WeChatBubbleTheme>,
): WeChatBubbleTheme {
  const merged: WeChatBubbleTheme = { ...prev, ...patch }
  if (patch.showBubbleTail === false && !patch.bubbleTailStyle && !('bubbleTailStyle' in patch)) {
    delete merged.bubbleTailStyle
  }
  return migrateMislabeledLumiDefaultBubble(merged)
}

/** 旧版「简约灰蓝」误带 Messenger/wechat 尾巴；或切回默认后仍残留 tail 字段 */
export function migrateMislabeledLumiDefaultBubble(bubble: WeChatBubbleTheme): WeChatBubbleTheme {
  const lumi = DEFAULT_CUSTOMIZATION.wechatTheme.bubbleGlobal
  if (!bubble.bubbleTailStyle) return bubble
  if (isLumiDefaultBubbleShape(bubble)) {
    const { bubbleTailStyle: _removed, ...rest } = bubble
    return rest
  }
  // 颜色/圆角已是简约灰蓝，但浅合并遗留 Messenger 尾巴或 showBubbleTail
  const colorsMatchLumi =
    bubble.selfBubbleBg === lumi.selfBubbleBg &&
    bubble.otherBubbleBg === lumi.otherBubbleBg &&
    bubble.selfBubbleRadiusPx === lumi.selfBubbleRadiusPx &&
    bubble.otherBubbleRadiusPx === lumi.otherBubbleRadiusPx
  if (!colorsMatchLumi) return bubble
  return { ...lumi }
}

export function lumiDefaultChatInputBar(): ChatTheme['inputBar'] {
  const lumiDefaultInput = WECHAT_APP_DEFAULT_BUBBLE_PRESET.chatThemePatch?.inputBar
  return {
    borderRadius: lumiDefaultInput?.borderRadius ?? DEFAULT_CHAT_THEME.inputBar.borderRadius,
    borderColor: lumiDefaultInput?.borderColor ?? DEFAULT_CHAT_THEME.inputBar.borderColor,
    buttonSize: lumiDefaultInput?.buttonSize ?? DEFAULT_CHAT_THEME.inputBar.buttonSize,
    buttonColor: lumiDefaultInput?.buttonColor ?? DEFAULT_CHAT_THEME.inputBar.buttonColor,
    backgroundColor: lumiDefaultInput?.backgroundColor ?? DEFAULT_CHAT_THEME.inputBar.backgroundColor,
    layout: 'lumi',
  }
}

export const WECHAT_BUBBLE_PRESETS: WeChatBubblePreset[] = [
  WECHAT_APP_CLASSIC_BUBBLE_PRESET,
  IMESSAGE_BUBBLE_PRESET,
  TELEGRAM_BUBBLE_PRESET,
  TALKMAKER_BUBBLE_PRESET,
  WECHAT_APP_DEFAULT_BUBBLE_PRESET,
]

export function resolveInputBarLayoutForBubble(
  bubble: WeChatBubbleTheme,
): NonNullable<ChatTheme['inputBar']['layout']> {
  const tail = migrateMislabeledLumiDefaultBubble(bubble).bubbleTailStyle
  if (tail === 'imessage') return 'imessage'
  if (tail === 'telegram') return 'telegram'
  if (tail === 'talkmaker') return 'talkmaker'
  if (tail === 'wechat') return 'wechat'
  return 'lumi'
}

function bubblePresetByTailStyle(tail: WeChatBubbleTheme['bubbleTailStyle']): WeChatBubblePreset | null {
  if (!tail) return null
  return WECHAT_BUBBLE_PRESETS.find((preset) => preset.bubble.bubbleTailStyle === tail) ?? null
}

/** 输入栏与当前气泡模版对齐，避免 Lumi 简约灰蓝气泡仍显示 Messenger 输入栏 */
export function resolveEffectiveChatInputBarForBubble(
  inputBar: ChatTheme['inputBar'],
  bubble: WeChatBubbleTheme,
): ChatTheme['inputBar'] {
  const effectiveBubble = migrateMislabeledLumiDefaultBubble(bubble)
  const layout = resolveInputBarLayoutForBubble(effectiveBubble)
  const presetInput = bubblePresetByTailStyle(effectiveBubble.bubbleTailStyle)?.chatThemePatch?.inputBar

  if (!effectiveBubble.bubbleTailStyle) {
    return lumiDefaultChatInputBar()
  }

  return {
    ...inputBar,
    layout,
    borderRadius: presetInput?.borderRadius ?? inputBar.borderRadius,
    borderColor: presetInput?.borderColor ?? inputBar.borderColor,
    buttonSize: presetInput?.buttonSize ?? inputBar.buttonSize,
    buttonColor: presetInput?.buttonColor ?? inputBar.buttonColor,
    backgroundColor: presetInput?.backgroundColor ?? inputBar.backgroundColor,
    sendButtonColor: presetInput?.sendButtonColor ?? inputBar.sendButtonColor,
  }
}

/** 美化预览顶栏/输入栏底色与当前气泡模版一致 */
export function resolvePreviewWechatThemeForBubble(
  wechatTheme: WeChatTheme,
  bubble: WeChatBubbleTheme,
): WeChatTheme {
  const effectiveBubble = migrateMislabeledLumiDefaultBubble(bubble)
  if (!effectiveBubble.bubbleTailStyle) {
    return {
      ...wechatTheme,
      chatInputBg: DEFAULT_CUSTOMIZATION.wechatTheme.chatInputBg,
      chatInputBorder: DEFAULT_CUSTOMIZATION.wechatTheme.chatInputBorder,
    }
  }
  const presetPatch = bubblePresetByTailStyle(effectiveBubble.bubbleTailStyle)?.wechatThemePatch
  return presetPatch ? { ...wechatTheme, ...presetPatch } : wechatTheme
}

export function wechatBubblePresetMatchesActive(
  preset: WeChatBubblePreset,
  activeBubble: WeChatBubbleTheme,
  selfBubbleText: string,
  otherBubbleText: string,
  wechatTheme?: WeChatTheme,
  bubbleScope: 'global' | 'role' = 'global',
): boolean {
  if (
    !wechatBubbleThemesEqual(preset.bubble, activeBubble) ||
    preset.selfBubbleText !== selfBubbleText ||
    preset.otherBubbleText !== otherBubbleText
  ) {
    return false
  }
  if (bubbleScope !== 'global' || !preset.wechatThemePatch?.chatRoomDefaultBg || !wechatTheme) {
    return true
  }
  return wechatChatRoomBgEqual(preset.wechatThemePatch.chatRoomDefaultBg, wechatTheme.chatRoomDefaultBg)
}
