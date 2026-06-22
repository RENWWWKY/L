import { useCallback, useState } from 'react'
import {
  beginDiscordOAuth,
  isDiscordOAuthConfigured,
  type DiscordOAuthIntent,
} from '../userSystem/discordOAuth'

type Props = {
  intent: DiscordOAuthIntent
  lumiEntry?: boolean
  disabled?: boolean
  label?: string
  className?: string
  buttonClassName?: string
  onError?: (message: string) => void
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 19" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.224 3.768a14.5 14.5 0 0 0-3.67-1.153c-.158.286-.343.67-.47.976a13.5 13.5 0 0 0-4.067 0c-.128-.306-.317-.69-.476-.976A14.4 14.4 0 0 0 3.868 3.77C1.546 7.28.916 10.703 1.231 14.077a14.7 14.7 0 0 0 4.5 2.306q.545-.748.965-1.587a9.5 9.5 0 0 1-1.518-.74q.191-.14.372-.293c2.927 1.369 6.107 1.369 8.999 0q.183.152.372.294-.723.437-1.52.74.418.838.963 1.588a14.6 14.6 0 0 0 4.504-2.308c.37-3.911-.63-7.302-2.644-10.309m-9.13 8.234c-.878 0-1.599-.82-1.599-1.82 0-.998.705-1.82 1.6-1.82.894 0 1.614.82 1.599 1.82.001 1-.705 1.82-1.6 1.82m5.91 0c-.878 0-1.599-.82-1.599-1.82 0-.998.705-1.82 1.6-1.82.893 0 1.614.82 1.599 1.82 0 1-.706 1.82-1.6 1.82"
      />
    </svg>
  )
}

export function DiscordLoginButton({
  intent,
  lumiEntry = false,
  disabled = false,
  label,
  className = '',
  buttonClassName = '',
  onError,
}: Props) {
  const [redirecting, setRedirecting] = useState(false)

  const handleClick = useCallback(() => {
    setRedirecting(true)
    const r = beginDiscordOAuth({ intent, lumiEntry })
    if (!r.ok) {
      setRedirecting(false)
      onError?.(r.error)
    }
  }, [intent, lumiEntry, onError])

  if (!isDiscordOAuthConfigured()) return null

  const defaultLabel =
    intent === 'register' ? '使用 Discord 一键注册' : '使用 Discord 登录'

  return (
    <div className={className}>
      <button
        type="button"
        className={
          buttonClassName ||
          'flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-[#5865F2]/35 bg-[#5865F2]/10 text-[14px] font-medium text-[#4752C4] disabled:opacity-50'
        }
        disabled={disabled || redirecting}
        onClick={handleClick}
      >
        <DiscordIcon className="size-4 shrink-0" />
        {redirecting ? '正在跳转 Discord…' : (label ?? defaultLabel)}
      </button>
    </div>
  )
}

export function AuthDivider({ mutedCls }: { mutedCls?: string }) {
  return (
    <div className={`flex items-center gap-3 text-[12px] ${mutedCls ?? 'text-[#1C1C1E]/45'}`}>
      <span className="h-px flex-1 bg-current opacity-30" />
      <span>或</span>
      <span className="h-px flex-1 bg-current opacity-30" />
    </div>
  )
}
