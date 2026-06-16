import type { CSSProperties } from 'react'

import { ListenNumericText } from './ListenNum'
import { parseNeteaseCommentText } from './neteaseCommentEmoji'

export type ListenNeteaseCommentTextProps = {
  text: string
  className?: string
  /** 表情相对正文的缩放 */
  emojiScale?: number
}

export function ListenNeteaseCommentText({
  text,
  className,
  emojiScale = 1.12,
}: ListenNeteaseCommentTextProps) {
  const parts = parseNeteaseCommentText(text)

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'emoji') {
          const style: CSSProperties = {
            fontSize: `${emojiScale}em`,
            lineHeight: 1,
            verticalAlign: '-0.12em',
          }
          return (
            <span
              key={`${index}-${part.name}`}
              className="mx-0.5 inline-block"
              style={style}
              role="img"
              aria-label={part.name}
            >
              {part.value}
            </span>
          )
        }
        if (!part.value) return null
        return <ListenNumericText key={index} text={part.value} />
      })}
    </span>
  )
}
