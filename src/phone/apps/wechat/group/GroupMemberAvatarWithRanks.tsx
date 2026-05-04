import type { GroupMemberRole } from '../newFriendsPersona/types'

const GOLD = '#E8C87C'
const GOLD_BORDER = 'rgba(201, 162, 39, 0.95)'
const BADGE_BG = '#0a0a0a'

type Props = {
  avatarUrl?: string
  role: GroupMemberRole
  /** 含管理员禁言 + 群助手定时禁言（勿仅传 member.isMuted） */
  speechBlocked: boolean
  /** 群助手禁言到期时间；未过期时在遮罩内显示剩余 mm:ss */
  botMuteExpiresAt?: number | null
  /** 头像区域边长 px */
  sizePx?: number
  roundedClassName?: string
  alt?: string
}

function formatMuteCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return ''
  const totalSec = Math.ceil(remainingMs / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * 群成员头像：
 * - 黑金头衔「群主 / 管理员」悬浮在头像**左上角外侧**
 * - 禁言：灰色半透明遮罩铺满头像；群助手限时禁言额外显示剩余时间
 */
export function GroupMemberAvatarWithRanks({
  avatarUrl,
  role,
  speechBlocked,
  botMuteExpiresAt,
  sizePx = 52,
  roundedClassName = 'rounded-[10px]',
  alt = '',
}: Props) {
  const badgeLabel = role === 'owner' ? '群主' : role === 'admin' ? '管理员' : null
  const badgeFontPx = role === 'admin' ? 7 : 9
  /** 头衔相对头像左上角向外偏移 px，保证视觉上「浮在角外」 */
  const badgeOut = 5

  return (
    <div
      className="relative shrink-0 overflow-visible"
      style={{ width: sizePx, height: sizePx }}
    >
      <div
        className={`absolute left-0 top-0 z-0 overflow-hidden bg-[#F3F4F6] ${roundedClassName}`}
        style={{ width: sizePx, height: sizePx }}
      >
        {avatarUrl?.trim() ? (
          <img src={avatarUrl.trim()} alt={alt} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-[11px] font-medium text-[#9CA3AF]">—</div>
        )}

        {speechBlocked ? (
          <div
            className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-0.5 px-0.5"
            style={{ background: 'rgba(75, 85, 99, 0.58)' }}
          >
            <span
              className="text-[11px] font-semibold tracking-[0.08em] text-[#F3F4F6]"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
            >
              禁言
            </span>
            {(() => {
              const exp = botMuteExpiresAt
              if (typeof exp !== 'number' || !Number.isFinite(exp)) return null
              const left = exp - Date.now()
              if (left <= 0) return null
              return (
                <span className="text-[9px] font-semibold tabular-nums leading-none text-[#F3F4F6] opacity-95">
                  {formatMuteCountdown(left)}
                </span>
              )
            })()}
          </div>
        ) : null}
      </div>

      {badgeLabel ? (
        <span
          className="pointer-events-none absolute z-[4] max-w-[72px] truncate px-[3px] py-[2px] font-bold leading-none tracking-tight"
          style={{
            left: -badgeOut,
            top: -badgeOut,
            fontSize: badgeFontPx,
            background: BADGE_BG,
            color: GOLD,
            borderRadius: 4,
            boxShadow: `0 0 0 1px ${GOLD_BORDER}, 0 3px 8px rgba(0,0,0,0.28)`,
            textShadow: '0 1px 2px rgba(0,0,0,0.75)',
          }}
        >
          {badgeLabel}
        </span>
      ) : null}
    </div>
  )
}
