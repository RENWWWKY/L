import type { ChatTheme } from './chatTheme/types'
import type { WeChatTheme } from '../../types'
import {
  WECHAT_CHAT_SKIN_SELECTOR_DOC,
  resolveWeChatChatSkinValues,
  weChatChatSkinCssVarLines,
} from './wechatChatSkinVars'

/** 聊天气泡页：导出 CSS 模版 / AI 提示词（暂未开放；美化预览已独立展示） */
export const WECHAT_CHAT_SKIN_EXPORT_UI_ENABLED = false

export type WeChatChatSkinExportInput = {
  wechatTheme: WeChatTheme
  chatTheme: ChatTheme
  globalFontFamily: string
}

function appLevelCssVars(t: WeChatTheme, globalFontFamily: string): string[] {
  const resolvedFont = t.fontFamily?.trim() ? t.fontFamily : globalFontFamily
  const resolvedNumFont = t.numberFontFamily?.trim() ? t.numberFontFamily : 'var(--wx-num-font)'
  return [
    '/* ===== 1. 微信 App 级变量（文字气泡 / 全局字体 / Tab 等） ===== */',
    '[data-app-id="wechat"] {',
    `  --wx-primary: ${t.primary};`,
    `  --wx-bg: ${t.background};`,
    `  --wx-surface: ${t.surface};`,
    `  --wx-text: ${t.text};`,
    `  --wx-text-muted: ${t.textMuted};`,
    `  --wx-border: ${t.border};`,
    `  --wx-font: ${resolvedFont};`,
    `  --wx-num-font: ${resolvedNumFont};`,
    `  --wx-font-size: ${t.fontSizeBasePx}px;`,
    '',
    `  --wx-input-bg: ${t.chatInputBg};`,
    `  --wx-input-border: ${t.chatInputBorder};`,
    `  --wx-self-bubble-bg: ${t.bubbleGlobal.selfBubbleBg};`,
    `  --wx-self-bubble-text: ${t.selfBubbleText};`,
    `  --wx-self-bubble-radius: ${t.bubbleGlobal.selfBubbleRadiusPx}px;`,
    `  --wx-other-bubble-bg: ${t.bubbleGlobal.otherBubbleBg};`,
    `  --wx-other-bubble-text: ${t.otherBubbleText};`,
    `  --wx-other-bubble-radius: ${t.bubbleGlobal.otherBubbleRadiusPx}px;`,
    `  --wx-avatar-radius: ${t.bubbleGlobal.avatarRadiusPx}px;`,
    `  --wx-timestamp-text: ${t.timestampText};`,
    '}',
  ]
}

function skinScopeCssBlock(t: WeChatTheme, chatTheme: ChatTheme): string[] {
  const skin = resolveWeChatChatSkinValues(t, chatTheme)
  return [
    '',
    '/* ===== 2. 聊天页：顶栏 / 输入栏 / 特殊消息（语音·红包·转账·位置） ===== */',
    '[data-wx-chat-skin-scope] {',
    ...weChatChatSkinCssVarLines(skin),
    '}',
    '',
    '/* 示例：仅改己方文字气泡阴影 */',
    '/* [data-wx-chat-skin-scope] [data-wx-bubble-side="self"] [data-wx-msg-kind="text"] { box-shadow: 0 2px 8px rgba(0,0,0,0.06); } */',
    '',
    '/* 示例：Lumi 红包卡片 */',
    '/* [data-wx-chat-skin-scope] [data-wx-msg-kind="red-packet"] [data-wx-special-card] { border-radius: 16px; } */',
  ]
}

function jsonConfigBlock(t: WeChatTheme, chatTheme: ChatTheme): string[] {
  const b = t.bubbleGlobal
  const ib = chatTheme.inputBar
  const config = {
    bubbleGlobal: {
      showAvatar: b.showAvatar,
      showBubbleTail: b.showBubbleTail,
      bubbleTailStyle: b.bubbleTailStyle ?? null,
      mergeConsecutiveAvatarGroup: b.mergeConsecutiveAvatarGroup,
      selfBubbleRadiusPx: b.selfBubbleRadiusPx,
      otherBubbleRadiusPx: b.otherBubbleRadiusPx,
    },
    timestampStyle: t.timestampStyle,
    chatInputBar: {
      layout: ib.layout ?? null,
      borderRadius: ib.borderRadius,
      borderColor: ib.borderColor,
      backgroundColor: ib.backgroundColor,
      buttonColor: ib.buttonColor,
      buttonSize: ib.buttonSize,
      sendButtonColor: ib.sendButtonColor ?? null,
    },
  }
  return [
    '',
    '/* ===== 3. 结构性配置（CSS 改不了，需在主题面板或让 AI 输出 JSON 说明） ===== */',
    '/*',
    JSON.stringify(config, null, 2),
    '*/',
  ]
}

function selectorDocBlock(): string[] {
  return [
    '',
    '/* ===== 4. 可用选择器 ===== */',
    ...WECHAT_CHAT_SKIN_SELECTOR_DOC.map((line) => `/* ${line} */`),
  ]
}

export function buildWeChatChatSkinExport(input: WeChatChatSkinExportInput): string {
  const { wechatTheme, chatTheme, globalFontFamily } = input
  return [
    '/*',
    ' * Lumi 微信 · 聊天美化模版',
    ' * 用法：整段粘贴到「外观 → 自定义 CSS」，或只保留需要的块。',
    ' * 改完后刷新页面；结构性选项见文末 JSON 注释。',
    ' */',
    ...appLevelCssVars(wechatTheme, globalFontFamily),
    ...skinScopeCssBlock(wechatTheme, chatTheme),
    ...jsonConfigBlock(wechatTheme, chatTheme),
    ...selectorDocBlock(),
    '',
  ].join('\n')
}

function buildWeChatChatSkinUserBriefTemplate(): string {
  return [
    '--- 在下方填写你的美化需求（留空表示不改该项），与「AI 提示词」一起发给 AI ---',
    '',
    '【顶栏 / 标题栏】',
    '（例：磨砂白底、细灰底边、标题字重偏细）',
    '',
    '【文字气泡 · 己方】',
    '（例：雾蓝半透明、圆角 20px、字色深灰）',
    '',
    '【文字气泡 · 对方】',
    '（例：暖白实色、略窄、不要阴影）',
    '',
    '【输入栏】',
    '（例：浅灰底条、输入框纯白圆角、侧栏图标黑色）',
    '',
    '【语音消息】',
    '（例：播放钮改玫瑰金、波形已播放段更深）',
    '',
    '【红包】',
    '（例：卡片改深红绒面、祝福语金色、标签字间距更大）',
    '',
    '【转账】',
    '（例：左侧竖线改香槟金、金额字号更大）',
    '',
    '【位置】',
    '（例：地图 pin 改蓝色、距离字改 mono）',
    '',
    '【整体风格 / 参考】',
    '（例：极简北欧 / 比 iMessage 更粉 / 夜间深色但特殊消息仍可读）',
    '',
    '【保持不变】',
    '（例：不要改字体；只动红包和顶栏）',
  ].join('\n')
}

export function buildWeChatChatSkinAiPrompt(): string {
  return [
    '你是 Lumi 手机模拟器里「微信聊天页」的美化助手。请根据用户描述，输出可直接粘贴的 CSS（必要时附带 JSON 说明）。',
    '',
    '## 用户怎么提需求',
    '1. 本提示词文末附有「需求填写模版」；用户会在各【】区块里填空后，把整段（含本说明）一次性发给你；',
    '2. 只改用户写明的区块，留空或未写的部分保持模版默认值；',
    '3. 若描述模糊，先按 Lumi 默认灰蓝 + 铂金特殊消息风格做保守调整，并在回复里说明假设。',
    '',
    '## 能改什么',
    '- 文字气泡：--wx-self-bubble-* / --wx-other-bubble-*（背景、文字、圆角）',
    '- 顶栏：--wx-chat-header-bg / --wx-chat-header-text / --wx-chat-header-border',
    '- 输入栏：--wx-chat-input-bar-* / --wx-chat-input-shell-* / --wx-chat-input-btn-color',
    '- Lumi 特殊消息变量：',
    '  - 红包 --wx-special-rp-*',
    '  - 转账 --wx-special-tf-*',
    '  - 语音 --wx-special-voice-*',
    '  - 位置 --wx-special-loc-*',
    '',
    '## 选择器（精确覆盖）',
    ...WECHAT_CHAT_SKIN_SELECTOR_DOC.map((line) => `- ${line}`),
    '',
    '## 规则',
    '1. 只输出 CSS，包裹在 [data-app-id="wechat"] 与 [data-wx-chat-skin-scope] 内，避免污染其它 App。',
    '2. 不要改 React 组件；不要用 !important 除非用户明确要求。',
    '3. bubbleTailStyle 为空 = Lumi 默认（灰蓝 + 铂金特殊消息 + 全局字体）；',
    '   设为 wechat/imessage/telegram/talkmaker 才会切换整套 Messenger UI（含顶栏与特殊消息样式）。',
    '4. 改 layout / showAvatar / showBubbleTail / mergeConsecutiveAvatarGroup 等结构：输出 JSON 并说明去「微信主题 → 气泡」面板修改。',
    '5. 用户粘贴位置：手机「外观 → 自定义 CSS」。',
    '',
    '## 输出格式',
    '先给 1～2 句说明，再给一个 ```css 代码块```。若涉及结构项，追加 ```json 代码块```。',
    '',
    '--- 需求填写模版（请让用户在下方填空后再发给你）---',
    buildWeChatChatSkinUserBriefTemplate(),
  ].join('\n')
}
