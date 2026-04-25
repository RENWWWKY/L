import {
  BookOpen,
  Bookmark,
  ChevronRight,
  CreditCard,
  Image as ImageIcon,
  Settings,
  Smile,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const AVATAR_PLACEHOLDER = 'https://via.placeholder.com/120'

export type WeChatMeInstagramProfileProps = {
  /** 微信昵称 */
  nickname?: string
  /** 个性签名（可多行） */
  signature?: string
  /** 头像地址 */
  avatarUrl?: string
  /** 点击顶部个人名片（如打开资料编辑） */
  onOpenProfileCard?: () => void
  /** 列表项点击 */
  onMenuItemClick?: (id: MenuRowId) => void
  className?: string
}

export type MenuRowId = 'favorites' | 'memory' | 'identity' | 'album' | 'card' | 'emoji' | 'settings'
  | 'persona'

type MenuRow = {
  id: MenuRowId
  label: string
  en?: string
  icon: LucideIcon
}

const MENU_ROWS: MenuRow[] = [
  { id: 'favorites', label: '收藏', en: 'Favorites', icon: Bookmark },
  { id: 'memory', label: '记忆', en: 'Memory', icon: BookOpen },
  { id: 'identity', label: '身份', en: 'Identity', icon: User },
  { id: 'persona', label: '角色人设', en: 'Persona', icon: User },
  { id: 'album', label: '相册', en: 'Album', icon: ImageIcon },
  { id: 'card', label: '卡包', en: 'Cards', icon: CreditCard },
  { id: 'emoji', label: '表情', en: 'Stickers', icon: Smile },
  { id: 'settings', label: '设置', en: 'Settings', icon: Settings },
]

/**
 * 微信「我的」页结构 + 偏 iOS 玻璃感个人名片（React + TS + Tailwind）。
 */
export function WeChatMeInstagramProfile({
  nickname = '微信昵称',
  signature = '个性签名：生活不止眼前的苟且，还有诗和远方。',
  avatarUrl = AVATAR_PLACEHOLDER,
  onOpenProfileCard,
  onMenuItemClick,
  className = '',
}: WeChatMeInstagramProfileProps) {
  return (
    <div
      className={`h-full min-h-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={{ background: 'transparent', color: '#000000' }}
    >
      <div className="mx-auto flex max-w-[480px] flex-col pb-10">
        {/* 顶部个人名片 */}
        <header className="px-4 pt-8">
          {onOpenProfileCard ? (
            <button
              type="button"
              onClick={onOpenProfileCard}
              className="w-full rounded-[12px] border bg-white px-5 py-7 text-center outline-none transition-opacity active:opacity-90"
              style={{ borderColor: '#e5e5e5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
            >
              <div className="mx-auto flex h-[124px] w-[124px] items-center justify-center rounded-full border bg-white" style={{ borderColor: '#e5e5e5' }}>
                <img
                  src={avatarUrl}
                  alt=""
                  width={120}
                  height={120}
                  className="h-[120px] w-[120px] shrink-0 rounded-full border object-cover"
                  style={{ borderColor: '#e5e5e5' }}
                  loading="lazy"
                />
              </div>
              <h1 className="mt-4 text-center text-[20px] font-semibold leading-tight" style={{ color: '#000000' }}>
                {nickname}
              </h1>
              <p className="mx-auto mt-2 max-w-[300px] text-center text-[14px] leading-relaxed" style={{ color: '#666666' }}>
                {signature}
              </p>
            </button>
          ) : (
            <div
              className="rounded-[12px] border bg-white px-5 py-7 text-center"
              style={{ borderColor: '#e5e5e5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
            >
              <div className="mx-auto flex h-[124px] w-[124px] items-center justify-center rounded-full border bg-white" style={{ borderColor: '#e5e5e5' }}>
                <img
                  src={avatarUrl}
                  alt=""
                  width={120}
                  height={120}
                  className="h-[120px] w-[120px] shrink-0 rounded-full border object-cover"
                  style={{ borderColor: '#e5e5e5' }}
                  loading="lazy"
                />
              </div>
              <h1 className="mt-4 text-center text-[20px] font-semibold leading-tight" style={{ color: '#000000' }}>
                {nickname}
              </h1>
              <p className="mx-auto mt-2 max-w-[300px] text-center text-[14px] leading-relaxed" style={{ color: '#666666' }}>
                {signature}
              </p>
            </div>
          )}
        </header>

        {/* 功能列表卡片 */}
        <section className="mx-4 mt-6 overflow-hidden rounded-[12px] border bg-white" style={{ borderColor: '#e5e5e5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} aria-label="功能列表">
          <ul>
            {MENU_ROWS.map((row, idx) => {
              const Icon = row.icon
              const borderTop = idx === 0 ? 'none' : '1px solid #e5e5e5'
              return (
                <li key={row.id} style={{ borderTop }}>
                  <button
                    type="button"
                    onClick={() => onMenuItemClick?.(row.id)}
                    className="group flex w-full items-center gap-3 px-4 py-4 text-left transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white transition-colors duration-200 group-hover:bg-white" style={{ borderColor: '#e5e5e5' }}>
                      <Icon
                        className="size-5 shrink-0"
                        strokeWidth={1.75}
                        color="#000000"
                        aria-hidden
                      />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[16px] leading-tight" style={{ color: '#000000' }}>
                        {row.label}
                      </span>
                      {row.en ? (
                        <span className="mt-0.5 block text-[11px] tracking-[0.08em]" style={{ color: '#666666' }}>
                          {row.en}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight
                      className="ml-auto size-4 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                      strokeWidth={1.75}
                      color="#666666"
                      aria-hidden
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}

export default WeChatMeInstagramProfile
