import { useMemo } from 'react'

import { parsePulseWeiboRichText, PUBLISH_SYNTAX_COLORS } from '../pulseWeiboRichText'
import { PulseNumericText } from './PulseNum'

/** 渲染含 [doge] 微博表情、#话题#、@艾特、【超话】的正文 */
export function PulseWeiboFaceText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const parts = useMemo(() => parsePulseWeiboRichText(text), [text])

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <PulseNumericText key={`t-${i}`} text={part.value} className="whitespace-pre-wrap" />
          )
        }
        if (part.type === 'face') {
          return (
            <img
              key={`f-${i}-${part.name}`}
              src={part.url}
              alt={`[${part.name}]`}
              title={`[${part.name}]`}
              className="mx-px inline-block size-[18px] align-[-4px] object-contain"
              draggable={false}
            />
          )
        }
        if (part.type === 'mention') {
          return (
            <span
              key={`m-${i}-${part.name}`}
              className="font-medium"
              style={{ color: PUBLISH_SYNTAX_COLORS.mention }}
            >
              {part.raw}
            </span>
          )
        }
        if (part.type === 'supertopic') {
          return (
            <span
              key={`s-${i}-${part.name}`}
              className="rounded-md px-1 font-semibold text-[#3A3A3C]"
              style={{ backgroundColor: PUBLISH_SYNTAX_COLORS.supertopicBg }}
            >
              {part.raw}
            </span>
          )
        }
        return (
          <span
            key={`h-${i}-${part.tag}`}
            className="font-medium"
            style={{ color: PUBLISH_SYNTAX_COLORS.hashtag }}
          >
            {part.raw}
          </span>
        )
      })}
    </span>
  )
}
