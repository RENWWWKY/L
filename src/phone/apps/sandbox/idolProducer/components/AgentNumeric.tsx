import type { CSSProperties, ReactNode } from 'react'
import { PHONE_NUM_FONT_FAMILY } from '../../../../types'

/** 与朋友圈相册、微信钱包等一致的衬线数字样式 */
export const agentNumericStyle: CSSProperties = {
  fontFamily: PHONE_NUM_FONT_FAMILY,
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 700,
  color: 'inherit',
}

/** 纯数字展示（资金、粉丝、好感等） */
export function AgentNum({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <span className={`tabular-nums ${className}`.trim()} style={{ ...agentNumericStyle, ...style }}>
      {children}
    </span>
  )
}

/** 混排文案中的数字片段走全局衬线数字字体 */
export function AgentNumericText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const parts = text.split(/(\d+)/)
  return (
    <span className={className}>
      {parts.map((part, index) =>
        /^\d+$/.test(part) ? (
          <span key={index} style={agentNumericStyle}>{part}</span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  )
}
