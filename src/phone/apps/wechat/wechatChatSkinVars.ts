import type { CSSProperties } from 'react'

import type { ChatTheme } from './chatTheme/types'
import type { WeChatTheme } from '../../types'

/** 聊天页美化 CSS 变量默认值（Lumi 默认灰蓝 + 铂金特殊消息） */
export const WECHAT_CHAT_SKIN_DEFAULTS = {
  chatHeaderBg: 'var(--wx-surface)',
  chatHeaderText: 'var(--wx-text)',
  chatHeaderMuted: 'var(--wx-text-muted)',
  chatHeaderBorder: 'var(--wx-border)',
  chatInputBarBg: 'var(--wx-input-bg)',
  chatInputBarBorder: '#e5e5e5',
  chatInputShellBg: '#ffffff',
  chatInputShellBorder: '#e5e5e5',
  chatInputShellRadius: '6px',
  chatInputBtnColor: '#191919',
  chatInputTextColor: 'var(--wx-text)',
  chatInputPlaceholder: '#8E8E93',
  specialRpBg: '#ffffff',
  specialRpBorder: 'rgba(212, 175, 55, 0.3)',
  specialRpAccent: '#D4AF37',
  specialRpText: '#1f2937',
  specialRpTag: 'rgba(212, 175, 55, 0.55)',
  specialTfBg: '#ffffff',
  specialTfAccentPending: '#D4AF37',
  specialTfAccentAccepted: '#B8D4C8',
  specialTfAccentReturned: '#9CA3AF',
  specialTfAmount: '#0f172a',
  specialTfMuted: '#64748B',
  specialVoiceBgSelf: '#FAF8F5',
  specialVoiceBgOther: '#ffffff',
  specialVoiceBorderSelf: '#e7e2d9',
  specialVoiceBorderOther: '#ececec',
  specialVoicePlayBg: '#ffffff',
  specialVoiceWaveActiveSelf: '#D4AF37',
  specialVoiceWaveActiveOther: '#8d8d8d',
  specialVoiceWaveIdle: '#b6b6b6',
  specialVoiceDuration: '#555555',
  specialLocPin: '#D4AF37',
  specialLocTitle: '#0a0a0a',
  specialLocMuted: '#9ca3af',
  specialLocDistance: '#8B7355',
} as const

const SKIN_VAR_MAP: Record<keyof typeof WECHAT_CHAT_SKIN_DEFAULTS, string> = {
  chatHeaderBg: '--wx-chat-header-bg',
  chatHeaderText: '--wx-chat-header-text',
  chatHeaderMuted: '--wx-chat-header-muted',
  chatHeaderBorder: '--wx-chat-header-border',
  chatInputBarBg: '--wx-chat-input-bar-bg',
  chatInputBarBorder: '--wx-chat-input-bar-border',
  chatInputShellBg: '--wx-chat-input-shell-bg',
  chatInputShellBorder: '--wx-chat-input-shell-border',
  chatInputShellRadius: '--wx-chat-input-shell-radius',
  chatInputBtnColor: '--wx-chat-input-btn-color',
  chatInputTextColor: '--wx-chat-input-text-color',
  chatInputPlaceholder: '--wx-chat-input-placeholder',
  specialRpBg: '--wx-special-rp-bg',
  specialRpBorder: '--wx-special-rp-border',
  specialRpAccent: '--wx-special-rp-accent',
  specialRpText: '--wx-special-rp-text',
  specialRpTag: '--wx-special-rp-tag',
  specialTfBg: '--wx-special-tf-bg',
  specialTfAccentPending: '--wx-special-tf-accent-pending',
  specialTfAccentAccepted: '--wx-special-tf-accent-accepted',
  specialTfAccentReturned: '--wx-special-tf-accent-returned',
  specialTfAmount: '--wx-special-tf-amount',
  specialTfMuted: '--wx-special-tf-muted',
  specialVoiceBgSelf: '--wx-special-voice-bg-self',
  specialVoiceBgOther: '--wx-special-voice-bg-other',
  specialVoiceBorderSelf: '--wx-special-voice-border-self',
  specialVoiceBorderOther: '--wx-special-voice-border-other',
  specialVoicePlayBg: '--wx-special-voice-play-bg',
  specialVoiceWaveActiveSelf: '--wx-special-voice-wave-active-self',
  specialVoiceWaveActiveOther: '--wx-special-voice-wave-active-other',
  specialVoiceWaveIdle: '--wx-special-voice-wave-idle',
  specialVoiceDuration: '--wx-special-voice-duration',
  specialLocPin: '--wx-special-loc-pin',
  specialLocTitle: '--wx-special-loc-title',
  specialLocMuted: '--wx-special-loc-muted',
  specialLocDistance: '--wx-special-loc-distance',
}

export type WeChatChatSkinResolved = {
  [K in keyof typeof WECHAT_CHAT_SKIN_DEFAULTS]: string
}

export function resolveWeChatChatSkinValues(
  wechatTheme: WeChatTheme,
  chatTheme: ChatTheme,
): WeChatChatSkinResolved {
  const ib = chatTheme.inputBar
  return {
    ...WECHAT_CHAT_SKIN_DEFAULTS,
    chatHeaderBg: wechatTheme.surface,
    chatHeaderText: wechatTheme.text,
    chatHeaderMuted: wechatTheme.textMuted,
    chatHeaderBorder: wechatTheme.border,
    chatInputBarBg: wechatTheme.chatInputBg,
    chatInputBarBorder: ib.borderColor || WECHAT_CHAT_SKIN_DEFAULTS.chatInputBarBorder,
    chatInputShellBg: ib.backgroundColor || WECHAT_CHAT_SKIN_DEFAULTS.chatInputShellBg,
    chatInputShellBorder: ib.borderColor || WECHAT_CHAT_SKIN_DEFAULTS.chatInputShellBorder,
    chatInputShellRadius: `${ib.borderRadius ?? 6}px`,
    chatInputBtnColor: ib.buttonColor || WECHAT_CHAT_SKIN_DEFAULTS.chatInputBtnColor,
  }
}

export function weChatChatSkinCssProperties(
  wechatTheme: WeChatTheme,
  chatTheme: ChatTheme,
): CSSProperties {
  const values = resolveWeChatChatSkinValues(wechatTheme, chatTheme)
  const out: Record<string, string> = {}
  for (const [key, cssVar] of Object.entries(SKIN_VAR_MAP)) {
    out[cssVar] = values[key as keyof WeChatChatSkinResolved]
  }
  return out as CSSProperties
}

export function weChatChatSkinCssVarLines(values: WeChatChatSkinResolved): string[] {
  return Object.entries(SKIN_VAR_MAP).map(([key, cssVar]) => {
    const val = values[key as keyof WeChatChatSkinResolved]
    return `  ${cssVar}: ${val};`
  })
}

/** 供导出模版注释：按消息类型可用的 data 属性 */
export const WECHAT_CHAT_SKIN_SELECTOR_DOC = [
  '[data-wx-chat-skin-scope] — 聊天室根（文字/语音/红包/转账/位置等）',
  '[data-wx-chat-header] — Lumi 默认顶栏（非 Messenger 预设）',
  '[data-wx-chat-input-bar] — 底部输入栏外框',
  '[data-wx-chat-input-shell] — 输入框 / 「按住说话」内壳',
  '[data-wx-bubble-side="self"|"other"] — 文字气泡侧',
  '[data-wx-msg-kind="text"|"voice"|"red-packet"|"transfer"|"location"] — 消息类型',
  '[data-wx-special-card] — Lumi 特殊消息卡片（红包/转账/位置等）',
] as const
