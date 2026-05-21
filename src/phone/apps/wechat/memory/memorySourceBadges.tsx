import type { CSSProperties, ReactNode } from 'react'

export type ParsedMemoryWithSources = {
  hasOnlineTag: boolean
  hasGroupChatTag: boolean
  hasOfflineTag: boolean
  /** 来自绑定主角线下剧情、挂在人脉 NPC 上的关联记忆 */
  hasLinkedOfflineTag: boolean
  /** 来自遇见 App 临时邂逅会话的总结 */
  hasMeetTag: boolean
  body: string
}

/** 解析入库前缀：`[遇见]` 可单独或置于 `[私聊]` 等之后；`[私聊]`/`[线上]` `[群聊]` `[线下]` `[关联线下]` 顺序须一致 */
export function parseMemorySourcePrefix(raw: string): ParsedMemoryWithSources {
  let s = String(raw ?? '')
  let hasOnlineTag = false
  let hasGroupChatTag = false
  let hasOfflineTag = false
  let hasLinkedOfflineTag = false
  let hasMeetTag = false
  if (s.startsWith('[遇见]')) {
    hasMeetTag = true
    s = s.slice('[遇见]'.length)
  }
  if (s.startsWith('[私聊]')) {
    hasOnlineTag = true
    s = s.slice('[私聊]'.length)
  } else if (s.startsWith('[线上]')) {
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
  if (s.startsWith('[关联线下]')) {
    hasLinkedOfflineTag = true
    s = s.slice('[关联线下]'.length)
  }
  const body = s.replace(/^\s+/, '')
  return { hasOnlineTag, hasGroupChatTag, hasOfflineTag, hasLinkedOfflineTag, hasMeetTag, body }
}

/** 按与 `parseMemorySourcePrefix` 相同顺序拼接前缀与正文（用于编辑后写回） */
export function composeMemoryWithSourcePrefix(
  flags: Pick<
    ParsedMemoryWithSources,
    'hasOnlineTag' | 'hasGroupChatTag' | 'hasOfflineTag' | 'hasLinkedOfflineTag' | 'hasMeetTag'
  >,
  body: string,
): string {
  let s = ''
  if (flags.hasMeetTag) s += '[遇见]'
  if (flags.hasOnlineTag) s += '[私聊]'
  if (flags.hasGroupChatTag) s += '[群聊]'
  if (flags.hasOfflineTag) s += '[线下]'
  if (flags.hasLinkedOfflineTag) s += '[关联线下]'
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

const BADGE_LINKED_OFFLINE: CSSProperties = {
  background: '#0d9488',
  color: '#ffffff',
}

const BADGE_MEET: CSSProperties = {
  background: '#1C1C1E',
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
        私聊
      </span>
      <span className={chip} style={BADGE_GROUP}>
        群聊
      </span>
      <span className={chip} style={BADGE_OFFLINE}>
        线下
      </span>
      <span className={chip} style={BADGE_LINKED_OFFLINE}>
        关联线下
      </span>
      <span className={chip} style={BADGE_MEET}>
        遇见
      </span>
    </div>
  )
}

/** 长期记忆列表/详情：把来源前缀渲染为「私聊」「群聊」「线下」标签，正文单独排版 */
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
  const { hasOnlineTag, hasGroupChatTag, hasOfflineTag, hasLinkedOfflineTag, hasMeetTag, body } =
    parseMemorySourcePrefix(content)
  const sc = size === 'md' ? 'px-2 py-0.5 text-[12px] rounded-md' : 'px-[6px] py-[2px] text-[11px] rounded-[6px]'

  const badges: ReactNode[] = []
  if (hasOnlineTag) {
    badges.push(
      <span
        key="on"
        className={`mr-1 inline-block shrink-0 align-middle font-semibold leading-tight shadow-sm ${sc}`}
        style={BADGE_ONLINE}
      >
        私聊
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
  if (hasLinkedOfflineTag) {
    badges.push(
      <span
        key="linked"
        className={`mr-1 inline-block shrink-0 align-middle font-semibold leading-tight shadow-sm ${sc}`}
        style={BADGE_LINKED_OFFLINE}
      >
        关联线下
      </span>,
    )
  }
  if (hasMeetTag) {
    badges.push(
      <span
        key="meet"
        className={`mr-1 inline-block shrink-0 align-middle font-semibold leading-tight shadow-sm ${sc}`}
        style={BADGE_MEET}
      >
        遇见
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
