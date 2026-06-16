import type { CSSProperties } from 'react'

import { listenPlainNumStyle } from '../components/discoverListen/listenTogetherTypography'
import { PHONE_LATIN_FONT_FAMILY } from './types'

const MIXED_TEXT_TOKEN_RE = /([A-Za-z]+|\d+)/g

export const phoneLatinTextStyle: CSSProperties = {
  fontFamily: PHONE_LATIN_FONT_FAMILY,
}

export function splitPhoneMixedLatinNumText(text: string): string[] {
  return text.split(MIXED_TEXT_TOKEN_RE).filter((part) => part.length > 0)
}

export function isPhoneLatinTextToken(part: string): boolean {
  return /^[A-Za-z]+$/.test(part)
}

export function isPhoneDigitTextToken(part: string): boolean {
  return /^\d+$/.test(part)
}

/** 混排文案：拉丁字母 → DejaVu Math TeX Gyre；数字 → 全局衬线数字（非等宽补位） */
export function PhoneMixedLatinNumText({
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
        if (isPhoneDigitTextToken(part)) {
          return (
            <span key={index} style={listenPlainNumStyle}>
              {part}
            </span>
          )
        }
        if (isPhoneLatinTextToken(part)) {
          return (
            <span key={index} style={phoneLatinTextStyle}>
              {part}
            </span>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </span>
  )
}
