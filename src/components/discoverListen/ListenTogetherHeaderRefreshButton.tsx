import { RefreshCw } from 'lucide-react'

export type ListenTogetherHeaderRefreshVariant = 'light' | 'dark' | 'ghost' | 'rose'

const VARIANT_CLASS: Record<ListenTogetherHeaderRefreshVariant, string> = {
  light:
    'bg-white/50 text-stone-600 shadow-sm backdrop-blur-sm hover:bg-white/80 hover:text-rose-500 disabled:opacity-60',
  dark: 'bg-black/25 text-white backdrop-blur-sm hover:bg-black/40 disabled:opacity-50',
  ghost:
    'text-stone-600 hover:bg-white hover:text-rose-500 disabled:opacity-50',
  rose: 'border border-rose-100 bg-rose-50/80 text-rose-400 shadow-sm hover:bg-rose-100 disabled:opacity-50',
}

export type ListenTogetherHeaderRefreshButtonProps = {
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  className?: string
  variant?: ListenTogetherHeaderRefreshVariant
}

export function ListenTogetherHeaderRefreshButton({
  onClick,
  loading = false,
  disabled = false,
  className = '',
  variant = 'light',
}: ListenTogetherHeaderRefreshButtonProps) {
  return (
    <button
      type="button"
      aria-label="刷新"
      title="刷新"
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${VARIANT_CLASS[variant]} ${className}`}
    >
      <RefreshCw
        className={`size-4 ${loading ? 'animate-spin' : ''}`}
        strokeWidth={1.75}
        aria-hidden
      />
    </button>
  )
}
