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

const URL_INLINE_RE = /https?:\/\/[^\s<>"')\]}，。；、]+/gi

const URL_SPAN_STYLE: CSSProperties = {
  ...WECHAT_CHAT_LATIN_NUM_STYLE,
  wordBreak: 'break-all',
  overflowWrap: 'anywhere',
}

function splitTextAndUrls(text: string): Array<{ kind: 'url' | 'text'; value: string }> {
  const out: Array<{ kind: 'url' | 'text'; value: string }> = []
  let last = 0
  for (const m of text.matchAll(URL_INLINE_RE)) {
    const idx = m.index ?? 0
    if (idx > last) out.push({ kind: 'text', value: text.slice(last, idx) })
    const url = String(m[0] ?? '').trim()
    if (url) out.push({ kind: 'url', value: url })
    last = idx + m[0]!.length
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) })
  if (!out.length) out.push({ kind: 'text', value: text })
  return out
}

function renderMixedChunk(chunk: string, keyPrefix: string) {
  const parts = splitPhoneMixedLatinNumText(chunk)
  return parts.map((part, index) => {
    if (isPhoneDigitTextToken(part) || isPhoneLatinTextToken(part)) {
      return (
        <span key={`${keyPrefix}-${index}`} style={WECHAT_CHAT_LATIN_NUM_STYLE}>
          {part}
        </span>
      )
    }
    return <span key={`${keyPrefix}-${index}`}>{part}</span>
  })
}

/** 原生输入框：Messenger 模版走 --wx-chat-font；默认 Lumi 气泡仍用 Corbel 数字 + 全局衬线 */
export const wechatChatComposerFontStyle: CSSProperties = {
  fontFamily: 'var(--wx-chat-font, "WeChatChatComposerDigits", var(--wx-font))',
}

/** 混排文案：Messenger 模版统一走 --wx-chat-font；默认 Lumi 气泡拉丁/数字 → Corbel Light */
export function WeChatChatMixedText({
  text,
  className,
  style,
  templateFont = false,
}: {
  text: string
  className?: string
  style?: CSSProperties
  /** true：使用当前气泡模版字体栈，不做 Corbel 拆字 */
  templateFont?: boolean
}) {
  const segments = splitTextAndUrls(String(text ?? ''))
  if (templateFont) {
    return (
      <span
        className={className}
        style={{ fontFamily: 'var(--wx-chat-font)', ...style }}
      >
        {segments.map((seg, index) => {
          if (seg.kind === 'url') {
            return (
              <span key={`url-${index}`} style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                {seg.value}
              </span>
            )
          }
          return <span key={`txt-${index}`}>{seg.value}</span>
        })}
      </span>
    )
  }
  return (
    <span className={className} style={style}>
      {segments.map((seg, index) => {
        if (seg.kind === 'url') {
          return (
            <span key={`url-${index}`} style={URL_SPAN_STYLE}>
              {seg.value}
            </span>
          )
        }
        return <span key={`txt-${index}`}>{renderMixedChunk(seg.value, `txt-${index}`)}</span>
      })}
    </span>
  )
}
