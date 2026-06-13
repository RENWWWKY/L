import { MomentBodyText } from './ArchiveTimelineDateColumn'
import { useResolvedMomentImages } from './resolveMomentImageSrc'

/** 个人相册时间轴 / 置顶栏：单图与多图共用同一外框尺寸 */
export const MOMENT_ARCHIVE_THUMB_OUTER_CLASS = 'size-[88px] shrink-0'
export const MOMENT_ARCHIVE_THUMB_BAR_CLASS = 'size-[72px] shrink-0'

/** 纯文字动态：半透明浅灰毛玻璃底条 */
export const MOMENT_ARCHIVE_TEXT_STRIP_CLASS =
  'rounded-xl border border-white/55 bg-white/38 shadow-[0_2px_14px_rgba(15,23,42,0.04)] backdrop-blur-xl backdrop-saturate-150'

type ArchiveTextOnlyMomentStripProps = {
  content: string
  /** timeline=时间轴宽条；thumb=置顶缩略方格 */
  variant?: 'timeline' | 'thumb' | 'pinnedBar'
  className?: string
}

export function ArchiveTextOnlyMomentStrip({
  content,
  variant = 'timeline',
  className = '',
}: ArchiveTextOnlyMomentStripProps) {
  const body = content.trim() || '文字动态'
  if (variant === 'thumb') {
    return (
      <div
        className={`${MOMENT_ARCHIVE_THUMB_OUTER_CLASS} ${MOMENT_ARCHIVE_TEXT_STRIP_CLASS} flex items-center justify-center overflow-hidden px-1.5 ${className}`.trim()}
      >
        <MomentBodyText
          text={body}
          className="line-clamp-3 text-center text-[9px] leading-snug text-[#4B5563]/90"
        />
      </div>
    )
  }
  if (variant === 'pinnedBar') {
    return (
      <div
        className={`${MOMENT_ARCHIVE_THUMB_BAR_CLASS} ${MOMENT_ARCHIVE_TEXT_STRIP_CLASS} flex items-center justify-center overflow-hidden px-1.5 ${className}`.trim()}
      >
        <MomentBodyText
          text={body}
          className="line-clamp-3 text-center text-[9px] leading-snug text-[#4B5563]/90"
        />
      </div>
    )
  }
  return (
    <div className={`w-full ${MOMENT_ARCHIVE_TEXT_STRIP_CLASS} px-3.5 py-3 ${className}`.trim()}>
      <MomentBodyText
        text={body}
        className="text-[14px] leading-[1.6] text-[#111827]/88 line-clamp-3"
      />
    </div>
  )
}

function gridColsForCount(count: number): number {
  if (count <= 1) return 1
  if (count <= 4) return 2
  return 3
}

type MomentArchiveThumbnailProps = {
  images?: string[]
  /** 时间轴与置顶列表用标准尺寸；置顶栏预览略小 */
  variant?: 'timeline' | 'pinnedBar'
  className?: string
}

export function MomentArchiveThumbnail({
  images,
  variant = 'timeline',
  className = '',
}: MomentArchiveThumbnailProps) {
  const imgs = useResolvedMomentImages(images)
  const outer = variant === 'pinnedBar' ? MOMENT_ARCHIVE_THUMB_BAR_CLASS : MOMENT_ARCHIVE_THUMB_OUTER_CLASS

  if (!imgs.length) return null

  if (imgs.length === 1) {
    return (
      <div className={`${outer} overflow-hidden rounded-lg ${className}`.trim()}>
        <img src={imgs[0]} alt="" className="size-full object-cover" />
      </div>
    )
  }

  if (imgs.length === 3) {
    return (
      <div
        className={`${outer} grid grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-lg bg-[#E5E7EB] ${className}`.trim()}
      >
        <img src={imgs[0]} alt="" className="row-span-2 size-full object-cover" />
        <img src={imgs[1]} alt="" className="size-full object-cover" />
        <img src={imgs[2]} alt="" className="size-full object-cover" />
      </div>
    )
  }

  const cols = gridColsForCount(imgs.length)
  return (
    <div
      className={`${outer} grid gap-px overflow-hidden rounded-lg bg-[#E5E7EB] ${className}`.trim()}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {imgs.map((src) => (
        <img key={src} src={src} alt="" className="aspect-square size-full object-cover" />
      ))}
    </div>
  )
}
