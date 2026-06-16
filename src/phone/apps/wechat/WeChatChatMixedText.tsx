import type { CSSProperties } from 'react'

import {
  isPhoneDigitTextToken,
  isPhoneLatinTextToken,
  splitPhoneMixedLatinNumText,
} from '../../phoneMixedLatinNumText'

/** 聊天室英文与数字：Corbel Light（Windows 系统字体，其他平台回退 Corbel / sans-serif） */
export const WECHAT_CHAT_LATIN_NUM_FONT_FAMILY = '"Corbel Light", Corbel, sans-serif'

export const WECHAT_CHAT_LATIN_NUM_STYLE: CSSProperties = {
  fontFamily: WECHAT_CHAT_LATIN_NUM_FONT_FAMILY,
  fontWeight: 300,
}

/** 原生输入框：仅数字 0–9 → Corbel Light（@font-face unicode-range）；中文/英文仍 --wx-font */
export const wechatChatComposerFontStyle: CSSProperties = {
  fontFamily: '"WeChatChatComposerDigits", var(--wx-font)',
}

/** 混排文案：拉丁字母与数字 → Corbel Light；中文等其余字符保持父级字体 */
export function WeChatChatMixedText({
  text,
  className,
  style,
}: {
  text: string
  className?: string
  style?: CSSProperties
}) {
  const parts = splitPhoneMixedLatinNumText(text)
  return (
    <span className={className} style={style}>
      {parts.map((part, index) => {
        if (isPhoneDigitTextToken(part) || isPhoneLatinTextToken(part)) {
          return (
            <span key={index} style={WECHAT_CHAT_LATIN_NUM_STYLE}>
              {part}
            </span>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </span>
  )
}
