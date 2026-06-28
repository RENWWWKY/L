import type { ReactNode } from 'react'

import { Pressable } from '../../components/Pressable'

const IOS_BLUE = '#0B93F6'
const TG_BLUE = '#3390EC'
const TG_MUTED = '#707579'

function PsycheMonitorIcon({ className, color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg className={className} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h1.5l1.5-3 2 6 1.5-3H17" />
    </svg>
  )
}

function ImessageInfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function TelegramMoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  )
}

function HeaderAvatar({ url, name, sizePx }: { url?: string; name: string; sizePx: number }) {
  const src = url?.trim()
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: sizePx, height: sizePx }}
        aria-hidden
      />
    )
  }
  const initial = name.trim().charAt(0) || '?'
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[#d1d5db] font-semibold text-white"
      style={{ width: sizePx, height: sizePx, fontSize: Math.max(11, Math.round(sizePx * 0.36)) }}
      aria-hidden
    >
      {initial}
    </span>
  )
}

export type WeChatMessengerChatHeaderProps = {
  variant: 'wechat' | 'imessage' | 'telegram' | 'talkmaker'
  title: string
  avatarUrl?: string
  onBack: () => void
  onOpenSettings: () => void
  onOpenPsycheRadar?: () => void
  showPsycheRadar?: boolean
  /** iMessage 返回键旁未读数 */
  backBadgeCount?: number
  showTyping?: boolean
  typingText?: string
  customRight?: ReactNode
  onCenterClick?: () => void
  /** Messenger 模版聊天气泡字体栈；不传则继承全局 --wx-font */
  fontFamily?: string
}

function TalkmakerMonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
    </svg>
  )
}

function TalkmakerSettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

/** 微信 8.x 顶栏「更多」：三颗等距实心点 */
function WechatMoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="6.5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="17.5" cy="12" r="2" />
    </svg>
  )
}

function WechatHealthIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  )
}

export function WeChatMessengerChatHeader({
  variant,
  title,
  avatarUrl,
  onBack,
  onOpenSettings,
  onOpenPsycheRadar,
  showPsycheRadar = false,
  backBadgeCount,
  showTyping = false,
  typingText,
  customRight,
  onCenterClick,
  fontFamily,
}: WeChatMessengerChatHeaderProps) {
  if (variant === 'wechat') {
    const centerLabel = showTyping && typingText?.trim() ? typingText.trim() : title
    return (
      <header
        className="relative z-50 shrink-0 border-b border-gray-200 bg-[#EDEDED]"
        style={{
          paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
          ...(fontFamily ? { fontFamily } : null),
        }}
      >
        <div className="relative flex h-11 items-center px-2">
          <div className="flex w-[88px] shrink-0 items-center justify-start">
            <Pressable
              type="button"
              aria-label="返回"
              onClick={onBack}
              className="flex shrink-0 items-center text-[#191919] active:opacity-60"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {typeof backBadgeCount === 'number' && backBadgeCount > 0 ? (
                <span className="text-[17px]">{backBadgeCount}</span>
              ) : null}
            </Pressable>
          </div>

          <Pressable
            type="button"
            onClick={onCenterClick ?? onOpenSettings}
            className="pointer-events-auto absolute inset-x-[88px] truncate px-2 text-center text-[17px] font-semibold text-[#191919] active:opacity-80"
          >
            {centerLabel}
          </Pressable>

          <div className="ml-auto flex w-[88px] shrink-0 items-center justify-end gap-5 text-[#191919]">
            {customRight ?? (
              <>
                {showPsycheRadar && onOpenPsycheRadar ? (
                  <Pressable
                    type="button"
                    aria-label="生理监测"
                    onClick={onOpenPsycheRadar}
                    className="text-[#191919] active:opacity-60"
                  >
                    <WechatHealthIcon className="h-6 w-6" />
                  </Pressable>
                ) : null}
                <Pressable type="button" aria-label="聊天设置" onClick={onOpenSettings} className="active:opacity-60">
                  <WechatMoreIcon className="h-6 w-6" />
                </Pressable>
              </>
            )}
          </div>
        </div>
      </header>
    )
  }

  if (variant === 'talkmaker') {
    const statusLabel = showTyping && typingText?.trim() ? typingText.trim() : '在线'
    return (
      <header
        className="relative z-50 shrink-0 bg-[#BACEE0] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        style={{
          paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
          ...(fontFamily ? { fontFamily } : null),
        }}
      >
        <div className="flex h-11 items-center px-2">
          <div className="flex w-[88px] shrink-0 justify-start">
            <Pressable
              type="button"
              aria-label="返回"
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center text-black active:opacity-60"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Pressable>
          </div>

          <Pressable
            type="button"
            onClick={onCenterClick ?? onOpenSettings}
            className="flex min-w-0 flex-1 flex-col items-center justify-center px-1 text-center active:opacity-80"
          >
            <span className="block w-full truncate text-[16px] font-bold leading-tight text-black">{title}</span>
            <span className="mt-[2px] block w-full truncate text-[12px] leading-tight text-[#555555]">{statusLabel}</span>
          </Pressable>

          <div className="flex w-[88px] shrink-0 items-center justify-end gap-4 text-gray-700">
            {customRight ?? (
              <>
                {showPsycheRadar && onOpenPsycheRadar ? (
                  <Pressable type="button" aria-label="生理监测" onClick={onOpenPsycheRadar} className="active:opacity-60">
                    <TalkmakerMonitorIcon className="h-6 w-6" />
                  </Pressable>
                ) : null}
                <Pressable type="button" aria-label="聊天设置" onClick={onOpenSettings} className="active:opacity-60">
                  <TalkmakerSettingsIcon className="h-6 w-6" />
                </Pressable>
              </>
            )}
          </div>
        </div>
      </header>
    )
  }

  if (variant === 'telegram') {
    const statusLabel = showTyping && typingText?.trim() ? typingText.trim() : 'online'
    const statusColor = showTyping ? TG_BLUE : TG_BLUE

    return (
      <header
        className="relative z-50 flex shrink-0 items-center justify-between bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
        style={{
          paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
          ...(fontFamily ? { fontFamily } : null),
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Pressable
            type="button"
            aria-label="返回"
            onClick={onBack}
            className="flex shrink-0 items-center justify-center rounded-full p-2 text-gray-600 transition-colors active:bg-gray-100"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Pressable>

          <Pressable
            type="button"
            aria-label={`查看 ${title} 资料`}
            onClick={onCenterClick ?? onOpenSettings}
            className="-ml-1 flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-80"
          >
            <HeaderAvatar url={avatarUrl} name={title} sizePx={40} />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[17px] font-medium leading-tight text-black">{title}</span>
              <span className="mt-[1px] block truncate text-[13px] leading-tight" style={{ color: statusColor }}>
                {statusLabel}
              </span>
            </div>
          </Pressable>
        </div>

        <div className="mr-1 flex shrink-0 items-center gap-1 text-gray-500">
          {customRight ?? (
            <>
              {showPsycheRadar && onOpenPsycheRadar ? (
                <Pressable
                  type="button"
                  aria-label="体征与心理监测"
                  onClick={onOpenPsycheRadar}
                  className="rounded-full p-2.5 transition-colors active:bg-gray-100"
                  style={{ color: TG_MUTED }}
                >
                  <PsycheMonitorIcon className="h-[22px] w-[22px]" color={TG_MUTED} />
                </Pressable>
              ) : null}
              <Pressable
                type="button"
                aria-label="聊天设置"
                onClick={onOpenSettings}
                className="rounded-full p-2.5 transition-colors active:bg-gray-100"
                style={{ color: TG_MUTED }}
              >
                <TelegramMoreIcon className="h-[22px] w-[22px]" />
              </Pressable>
            </>
          )}
        </div>
      </header>
    )
  }

  const centerLabel = showTyping && typingText?.trim() ? typingText.trim() : title

  return (
    <header
      className="relative z-50 shrink-0"
      style={{
        paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
        ...(fontFamily ? { fontFamily } : null),
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 border-b border-white/55 bg-gradient-to-b from-white/82 via-white/62 to-white/48 backdrop-blur-[20px] backdrop-saturate-150"
        style={{ WebkitBackdropFilter: 'blur(20px) saturate(1.5)' }}
        aria-hidden
      />
      <div className="relative flex min-h-[58px] items-center px-2">
        <div className="flex w-[88px] shrink-0 justify-start">
          <Pressable
            type="button"
            aria-label="返回"
            onClick={onBack}
            className="flex items-center active:opacity-60"
            style={{ color: IOS_BLUE }}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {typeof backBadgeCount === 'number' && backBadgeCount > 0 ? (
              <span className="-ml-1 text-[17px]">{backBadgeCount}</span>
            ) : null}
          </Pressable>
        </div>

        <Pressable
          type="button"
          aria-label={`${title} 详情与设置`}
          onClick={onCenterClick ?? onOpenSettings}
          className="flex min-w-0 flex-1 flex-col items-center justify-center px-1 pt-0.5 text-center active:opacity-80"
        >
          <HeaderAvatar url={avatarUrl} name={title} sizePx={42} />
          <span className="mt-[2px] flex max-w-[min(148px,calc(100vw-176px))] items-center justify-center gap-px truncate text-[10px] font-semibold leading-none tracking-tight text-black">
            <span className="truncate">{centerLabel}</span>
            {!showTyping ? (
              <svg className="h-[7px] w-[7px] shrink-0 text-[#8e8e93]" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : null}
          </span>
        </Pressable>

        <div className="flex w-[88px] shrink-0 items-center justify-end gap-4" style={{ color: IOS_BLUE }}>
          {customRight ?? (
            <>
              {showPsycheRadar && onOpenPsycheRadar ? (
                <Pressable type="button" aria-label="体征与心理监测" onClick={onOpenPsycheRadar} className="active:opacity-60">
                  <PsycheMonitorIcon className="h-6 w-6" color={IOS_BLUE} />
                </Pressable>
              ) : null}
              <Pressable type="button" aria-label="聊天设置" onClick={onOpenSettings} className="active:opacity-60">
                <ImessageInfoIcon className="h-6 w-6" />
              </Pressable>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
