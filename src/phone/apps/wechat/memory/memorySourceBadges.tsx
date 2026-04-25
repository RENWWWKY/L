import type { CSSProperties, ReactNode } from 'react'

export type ParsedMemoryWithSources = {
  hasOnlineTag: boolean
  hasOfflineTag: boolean
  body: string
}

/** 解析入库时由 `unifiedMemoryAutoSummary` 写入的 `[线上]` `[线下]` 前缀（仅前缀） */
export function parseMemorySourcePrefix(raw: string): ParsedMemoryWithSources {
  let s = String(raw ?? '')
  let hasOnlineTag = false
  let hasOfflineTag = false
  if (s.startsWith('[线上]')) {
    hasOnlineTag = true
    s = s.slice('[线上]'.length)
  }
  if (s.startsWith('[线下]')) {
    hasOfflineTag = true
    s = s.slice('[线下]'.length)
  }
  const body = s.replace(/^\s+/, '')
  return { hasOnlineTag, hasOfflineTag, body }
}

const BADGE_ONLINE: CSSProperties = {
  background: '#07c160',
  color: '#ffffff',
}

const BADGE_OFFLINE: CSSProperties = {
  background: '#6366f1',
  color: '#ffffff',
}

/** 长期记忆列表/详情：把 `[线上][线下]` 前缀渲染为高亮标签，正文单独排版 */
export function MemoryContentWithSourceBadges({
  content,
  bodyClassName,
  bodyStyle,
  size = 'sm',
}: {
  content: string
  bodyClassName?: string
  bodyStyle?: CSSProperties
  /** sm：列表两行摘要；md：弹窗正文旁稍大标签 */
  size?: 'sm' | 'md'
}) {
  const { hasOnlineTag, hasOfflineTag, body } = parseMemorySourcePrefix(content)
  const sc = size === 'md' ? 'px-2 py-0.5 text-[12px] rounded-md' : 'px-[6px] py-[2px] text-[11px] rounded-[6px]'

  const badges: ReactNode[] = []
  if (hasOnlineTag) {
    badges.push(
      <span
        key="on"
        className={`mr-1 inline-block shrink-0 align-middle font-semibold leading-tight shadow-sm ${sc}`}
        style={BADGE_ONLINE}
      >
        线上
      </span>,
    )
  }
  if (hasOfflineTag) {
    badges.push(
      <span
        key="off"
        className={`mr-1 inline-block shrink-0 align-middle font-semibold leading-tight shadow-sm ${sc}`}
        style={BADGE_OFFLINE}
      >
        线下
      </span>,
    )
  }

  return (
    <>
      {badges}
      <span className={bodyClassName} style={bodyStyle}>
        {body}
      </span>
    </>
  )
}
