import type { CSSProperties, ReactNode } from 'react'
import { PHONE_NUM_FONT_FAMILY } from '../types'

export const accountNumStyle: CSSProperties = {
  fontFamily: PHONE_NUM_FONT_FAMILY,
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 700,
}

export function AccountNum({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <span className={`tabular-nums ${className}`.trim()} style={{ ...accountNumStyle, ...style }}>
      {children}
    </span>
  )
}

export function AccountNumericText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\d+)/)
  return (
    <span className={className}>
      {parts.map((part, index) =>
        /^\d+$/.test(part) ? (
          <span key={index} style={accountNumStyle}>{part}</span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  )
}
