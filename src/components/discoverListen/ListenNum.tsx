import type { CSSProperties, ReactNode } from 'react'

import { listenNumMetaClass, listenNumStyle, listenPlainNumStyle } from './listenTogetherTypography'

type ListenNumProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/** 包裹纯数字或短数字文案 */
export function ListenNum({ children, className = '', style }: ListenNumProps) {
  return (
    <span className={listenNumMetaClass(className)} style={{ ...listenNumStyle, ...style }}>
      {children}
    </span>
  )
}

/** 小计数/比例：全局衬线数字，但不补等宽前导位（如 2/3 而非 02/03） */
export function ListenPlainNum({ children, className = '', style }: ListenNumProps) {
  return (
    <span className={className} style={{ ...listenPlainNumStyle, ...style }}>
      {children}
    </span>
  )
}

/** 混排文案中的数字片段走全局衬线数字字体（如 Lv.8、2小时前、2024-03-15） */
export function ListenNumericText({
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
          <span key={index} className={listenNumMetaClass()} style={listenNumStyle}>
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  )
}
