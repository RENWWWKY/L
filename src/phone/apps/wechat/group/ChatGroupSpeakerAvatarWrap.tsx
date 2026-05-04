import type { ReactNode } from 'react'

const GOLD = '#E8C87C'
const GOLD_BORDER = 'rgba(201, 162, 39, 0.95)'
const BADGE_BG = '#0a0a0a'

export type ChatGroupSpeakerRankBadge = 'owner' | 'admin'

/** 头衔胶囊：排在群昵称左侧 */
export function ChatGroupSpeakerRankBadgeInline({ rankBadge }: { rankBadge: ChatGroupSpeakerRankBadge }) {
  const badgeLabel = rankBadge === 'owner' ? '群主' : rankBadge === 'admin' ? '管理员' : null
  if (!badgeLabel) return null
  const badgeFontPx = rankBadge === 'admin' ? 9 : 10
  return (
    <span
      className="inline-flex shrink-0 items-center whitespace-nowrap rounded px-[5px] py-[2px] font-bold leading-none tracking-tight"
      style={{
        fontSize: badgeFontPx,
        background: BADGE_BG,
        color: GOLD,
        borderRadius: 4,
        boxShadow: `0 0 0 1px ${GOLD_BORDER}`,
        textShadow: '0 1px 2px rgba(0,0,0,0.75)',
      }}
    >
      {badgeLabel}
    </span>
  )
}

/**
 * 群聊：头衔在左、群昵称在右（同一行）；无昵称而仅有头衔时只显示头衔。
 */
export function ChatGroupSenderNicknameWithRank({
  nickname,
  rankBadge,
}: {
  nickname?: string | null | undefined
  rankBadge?: ChatGroupSpeakerRankBadge | null | undefined
}) {
  const nick = nickname?.trim()
  const hasRank = rankBadge === 'owner' || rankBadge === 'admin'
  if (!nick && !hasRank) return null
  return (
    <div className="flex min-w-0 max-w-[min(200px,calc(100vw-24px-24px-40px-12px))] flex-row items-center gap-[6px]">
      {hasRank ? <ChatGroupSpeakerRankBadgeInline rankBadge={rankBadge} /> : null}
      {nick ? (
        <span className="min-w-0 truncate text-[11px] leading-snug" style={{ color: 'var(--wx-text-muted, #888)' }}>
          {nick}
        </span>
      ) : null}
    </div>
  )
}

/** 关闭「显示成员昵称」时：头衔叠在头像内侧左上角 */
export function ChatGroupSpeakerRankOnAvatar({
  rankBadge,
  children,
}: {
  rankBadge: ChatGroupSpeakerRankBadge | null | undefined
  children: ReactNode
}) {
  const badgeLabel = rankBadge === 'owner' ? '群主' : rankBadge === 'admin' ? '管理员' : null
  const badgeFontPx = rankBadge === 'admin' ? 6 : 8
  if (!badgeLabel) return <>{children}</>
  return (
    <div className="relative inline-flex h-10 w-10 shrink-0 overflow-visible">
      {children}
      <span
        className="pointer-events-none absolute left-[2px] top-[2px] z-[6] whitespace-nowrap rounded px-[2px] py-[1px] font-bold leading-none tracking-tight"
        style={{
          fontSize: badgeFontPx,
          background: BADGE_BG,
          color: GOLD,
          borderRadius: 3,
          boxShadow: `0 0 0 1px ${GOLD_BORDER}, 0 2px 6px rgba(0,0,0,0.35)`,
          textShadow: '0 1px 2px rgba(0,0,0,0.75)',
        }}
      >
        {badgeLabel}
      </span>
    </div>
  )
}

/** 头像不再叠头衔时仅用子节点，保留别名以免大范围改名 */
export function ChatGroupSpeakerAvatarWrap({ children }: { children: ReactNode }) {
  return <>{children}</>
}
