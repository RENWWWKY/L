import type { CSSProperties, ReactNode } from 'react'

export type ParsedMemoryWithSources = {
  hasOnlineTag: boolean
  hasGroupChatTag: boolean
  hasOfflineTag: boolean
  body: string
}

/** 解析入库时写入的 `[线上]` `[群聊]` `[线下]` 前缀（仅前缀；顺序与入库一致） */
export function parseMemorySourcePrefix(raw: string): ParsedMemoryWithSources {
  let s = String(raw ?? '')
  let hasOnlineTag = false
  let hasGroupChatTag = false
  let hasOfflineTag = false
  if (s.startsWith('[线上]')) {
    hasOnlineTag = true
    s = s.slice('[线上]'.length)
  }
  if (s.startsWith('[群聊]')) {
    hasGroupChatTag = true
    s = s.slice('[群聊]'.length)
  }
  if (s.startsWith('[线下]')) {
    hasOfflineTag = true
    s = s.slice('[线下]'.length)
  }
  const body = s.replace(/^\s+/, '')
  return { hasOnlineTag, hasGroupChatTag, hasOfflineTag, body }
}

/** 按与 `parseMemorySourcePrefix` 相同顺序拼接前缀与正文（用于编辑后写回） */
export function composeMemoryWithSourcePrefix(
  flags: Pick<ParsedMemoryWithSources, 'hasOnlineTag' | 'hasGroupChatTag' | 'hasOfflineTag'>,
  body: string,
): string {
  let s = ''
  if (flags.hasOnlineTag) s += '[线上]'
  if (flags.hasGroupChatTag) s += '[群聊]'
  if (flags.hasOfflineTag) s += '[线下]'
  const b = String(body ?? '').replace(/^\s+/, '')
  return s + b
}

const BADGE_ONLINE: CSSProperties = {
  background: '#07c160',
  color: '#ffffff',
}

const BADGE_OFFLINE: CSSProperties = {
  background: '#6366f1',
  color: '#ffffff',
}

const BADGE_GROUP: CSSProperties = {
  background: '#c2410c',
  color: '#ffffff',
}

/** 记忆档案馆页：说明卡片上的来源标签含义 */
export function MemorySourceLegendStrip({ className }: { className?: string }) {
  const chip = 'inline-block shrink-0 rounded-[6px] px-[6px] py-[2px] text-[10px] font-semibold leading-tight text-white shadow-sm'
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-neutral-500 ${className ?? ''}`}
    >
      <span className="text-neutral-400">来源</span>
      <span className={chip} style={BADGE_ONLINE}>
        线上
      </span>
      <span className={chip} style={BADGE_GROUP}>
        群聊
      </span>
      <span className={chip} style={BADGE_OFFLINE}>
        线下
      </span>
    </div>
  )
}

/** 长期记忆列表/详情：把 `[线上][群聊][线下]` 前缀渲染为高亮标签，正文单独排版 */
export function MemoryContentWithSourceBadges({
  content,
  bodyClassName,
  bodyStyle,
  size = 'sm',
  emptyBodyFallback,
}: {
  content: string
  bodyClassName?: string
  bodyStyle?: CSSProperties
  /** sm：列表两行摘要；md：弹窗正文旁稍大标签 */
  size?: 'sm' | 'md'
  /** 正文去标签后为空时的占位（不传则保持空字符串） */
  emptyBodyFallback?: string
}) {
  const { hasOnlineTag, hasGroupChatTag, hasOfflineTag, body } = parseMemorySourcePrefix(content)
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
  if (hasGroupChatTag) {
    badges.push(
      <span
        key="grp"
        className={`mr-1 inline-block shrink-0 align-middle font-semibold leading-tight shadow-sm ${sc}`}
        style={BADGE_GROUP}
      >
        群聊
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

  const bodyShown = body.trim() ? body : (emptyBodyFallback ?? body)

  return (
    <>
      {badges}
      <span className={bodyClassName} style={bodyStyle}>
        {bodyShown}
      </span>
    </>
  )
}
