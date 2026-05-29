/** 听一听 · 主页 / 搜索 / 笔记 / 全屏播放 共用页面背景 */
export const LISTEN_TOGETHER_PAGE_BG_URL = '/images/listen-together-page-bg.png'

/** 全屏播放器 · 黑胶右下角装饰动图 */
export const LISTEN_FULLSCREEN_VINYL_DECORATION_URL =
  '/images/listen-fullscreen-cinnamoroll.gif'

/** 全屏进度条拖拽块：播放中 / 暂停 */
export const LISTEN_PROGRESS_THUMB_PLAYING_URL = '/images/listen-progress-thumb-playing.gif'
export const LISTEN_PROGRESS_THUMB_PAUSED_URL = '/images/listen-progress-thumb-paused.webp'

/** 进度条拖拽块展示尺寸（px），用于居中定位 */
export const LISTEN_PROGRESS_THUMB_PLAYING_SIZE_PX = 36
export const LISTEN_PROGRESS_THUMB_PAUSED_SIZE_PX = 58

type ListenTogetherPageBackgroundProps = {
  className?: string
  /** 轻微遮罩，保证前景文字可读 */
  overlayClassName?: string
}

export function ListenTogetherPageBackground({
  className = '',
  overlayClassName = 'bg-white/5',
}: ListenTogetherPageBackgroundProps) {
  return (
    <div className={`pointer-events-none absolute inset-0 z-0 ${className}`} aria-hidden>
      <img
        src={LISTEN_TOGETHER_PAGE_BG_URL}
        alt=""
        className="h-full w-full object-cover object-center"
        draggable={false}
      />
      {overlayClassName ? <div className={`absolute inset-0 ${overlayClassName}`} /> : null}
    </div>
  )
}
