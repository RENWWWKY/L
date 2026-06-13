import type { CSSProperties } from 'react'

import { PHONE_NUM_FONT_FAMILY } from '../../phone/types'
import { formatArchiveTimelineDate } from './utils/archiveTimelineDate'
import { formatMomentCommentTime, formatMomentTime } from './utils/timeFormat'
import { formatNoticeTimestamp } from './utils/noticeTimeFormat'

export const MOMENTS_SERIF_NUMERIC_FONT = PHONE_NUM_FONT_FAMILY

export const momentsSerifNumericStyle = {
  fontFamily: MOMENTS_SERIF_NUMERIC_FONT,
} as const

type ArchiveTimelineDateColumnProps = {
  timestamp: number
  locationLabel?: string
  showDateLabel: boolean
  nowMs?: number
}

/** 个人相册左侧：大号日 + 同字体月份 + 下方地址 */
export function ArchiveTimelineDateColumn({
  timestamp,
  locationLabel,
  showDateLabel,
  nowMs,
}: ArchiveTimelineDateColumnProps) {
  if (!showDateLabel) return null

  const date = formatArchiveTimelineDate(timestamp, nowMs)
  const location = locationLabel?.trim()

  if (!date.secondary) {
    return (
      <div>
        <p className="text-[15px] font-semibold text-[#0A0A0A]" style={momentsSerifNumericStyle}>
          {date.primary}
        </p>
        {location ? (
          <p className="mt-1 max-w-full break-words text-[9px] leading-snug text-gray-400">{location}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="leading-none">
      <div className="flex items-start gap-0.5">
        <p
          className="text-[26px] font-semibold tabular-nums leading-none text-[#0A0A0A]"
          style={momentsSerifNumericStyle}
        >
          {date.primary}
        </p>
        <p
          className="mt-px text-[11px] font-semibold tabular-nums leading-none text-[#0A0A0A]"
          style={momentsSerifNumericStyle}
        >
          {date.secondary}
        </p>
      </div>
      {location ? (
        <p className="mt-1 max-w-full break-words text-[9px] leading-snug text-gray-400">{location}</p>
      ) : null}
    </div>
  )
}

function renderSerifNumericText(text: string) {
  const parts = text.split(/(\d+)/)
  return parts.map((part, index) =>
    /^\d+$/.test(part) ? (
      <span key={index} style={momentsSerifNumericStyle}>
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}

/** 纯数字（点赞数、未读角标等） */
export function MomentsSerifNumericValue({
  value,
  className,
  style,
}: {
  value: number | string
  className?: string
  style?: CSSProperties
}) {
  return (
    <span className={className} style={{ ...momentsSerifNumericStyle, ...style }}>
      {value}
    </span>
  )
}

/** 混排文案中的数字片段走全局衬线数字字体 */
export function MomentsSerifNumericText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return <span className={className}>{renderSerifNumericText(text)}</span>
}

/** 朋友圈正文：保留换行，数字走全局衬线字体 */
export function MomentBodyText({
  text,
  className,
  as: Tag = 'p',
}: {
  text: string
  className?: string
  as?: 'p' | 'span'
}) {
  if (!text) return null
  return (
    <Tag className={className}>
      <MomentsSerifNumericText text={text} />
    </Tag>
  )
}

/** 朋友圈 feed：发布时间中的数字（含月份）使用与个人相册日数相同的衬线字体 */
export function MomentPublishTimeLabel({
  timestamp,
  nowMs = Date.now(),
  className = 'text-[12px] tabular-nums text-[#9CA3AF]',
}: {
  timestamp: number
  nowMs?: number
  className?: string
}) {
  const label = formatMomentTime(timestamp, nowMs)
  if (!label) return null
  return <span className={className}>{renderSerifNumericText(label)}</span>
}

/** 评论区时间戳：数字走全局衬线数字字体 */
export function MomentCommentTimeLabel({
  timestamp,
  className = 'shrink-0 text-[12px] tabular-nums leading-none text-[#b2b2b2]',
}: {
  timestamp: number
  className?: string
}) {
  const label = formatMomentCommentTime(timestamp)
  if (!label) return null
  return <span className={className}>{renderSerifNumericText(label)}</span>
}

/** 互动消息列表时间戳 */
export function MomentNoticeTimeLabel({
  timestamp,
  nowMs = Date.now(),
  className = 'mt-1.5 text-[11px] tabular-nums text-gray-400',
}: {
  timestamp: number
  nowMs?: number
  className?: string
}) {
  const label = formatNoticeTimestamp(timestamp, nowMs)
  if (!label) return null
  return <p className={className}>{renderSerifNumericText(label)}</p>
}
