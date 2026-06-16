import { Music2, Pause, Play } from 'lucide-react'

export const LISTEN_TAB_BAR_H = 56
export const LISTEN_MINI_PLAYER_H = 68

export function listenOverlayBottomInset() {
  return `calc(${LISTEN_MINI_PLAYER_H}px + env(safe-area-inset-bottom, 0px))`
}

function SpinningCover({ src, playing }: { src?: string; playing: boolean }) {
  return (
    <div className="relative h-11 w-11 shrink-0">
      <div
        className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-stone-200 shadow-sm ring-1 ring-stone-200/80 ${
          playing ? 'animate-[spin_8s_linear_infinite]' : ''
        }`}
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <Music2 className="size-5 text-stone-400" strokeWidth={1.5} aria-hidden />
        )}
      </div>
      <div
        className="pointer-events-none absolute -right-0.5 top-1/2 h-5 w-1.5 -translate-y-1/2 rounded-sm bg-stone-300/90 shadow-sm"
        aria-hidden
      />
    </div>
  )
}

export type ListenTogetherMiniPlayerBarProps = {
  title: string
  artist: string
  cover?: string
  progress: number
  isPlaying: boolean
  bottom: string
  onOpenFullscreen: () => void
  onTogglePlay: () => void
  className?: string
  zIndexClass?: string
}

export function ListenTogetherMiniPlayerBar({
  title,
  artist,
  cover,
  progress,
  isPlaying,
  bottom,
  onOpenFullscreen,
  onTogglePlay,
  className = '',
  zIndexClass = 'z-[45]',
}: ListenTogetherMiniPlayerBarProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenFullscreen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenFullscreen()
        }
      }}
      className={`fixed left-0 right-0 mx-auto max-w-[560px] cursor-pointer border-t border-stone-100/50 bg-white/80 shadow-lg backdrop-blur-md ${zIndexClass} ${className}`}
      style={{
        bottom,
        height: LISTEN_MINI_PLAYER_H,
      }}
      aria-label="打开全屏播放器"
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-stone-100" aria-hidden>
        <div
          className="h-full bg-rose-300 transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex h-full items-center gap-3 px-4 pt-0.5">
        <SpinningCover src={cover} playing={isPlaying} />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[14px] font-medium text-stone-800">{title}</p>
          <p className="truncate text-[12px] text-stone-400">{artist}</p>
        </div>
        <button
          type="button"
          aria-label={isPlaying ? '暂停' : '播放'}
          onClick={(e) => {
            e.stopPropagation()
            onTogglePlay()
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rose-400 transition-colors hover:bg-rose-50/80"
        >
          {isPlaying ? (
            <Pause className="size-5 fill-current" strokeWidth={0} />
          ) : (
            <Play className="size-5 fill-current" strokeWidth={0} />
          )}
        </button>
      </div>
    </div>
  )
}
