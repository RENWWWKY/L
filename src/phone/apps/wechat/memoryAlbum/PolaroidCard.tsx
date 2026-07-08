import { useMemo } from 'react'

import { formatDefaultPolaroidTitle } from './memoryAlbumTypes'
import { useBlobImageSrc } from './useBlobImageSrc'

type PolaroidCardProps = {
  imageUrl: string
  timestamp: number
  characterName: string
  messageId: string
  className?: string
  customTitle?: string
  interactive?: boolean
  onOpenDetail?: () => void
}

export function PolaroidCard({
  imageUrl,
  timestamp,
  characterName,
  messageId: _messageId,
  className = '',
  customTitle,
  interactive = true,
  onOpenDetail,
}: PolaroidCardProps) {
  const displaySrc = useBlobImageSrc(imageUrl)

  const caption = useMemo(() => {
    const custom = customTitle?.trim()
    if (custom) return custom
    return formatDefaultPolaroidTitle(timestamp, characterName)
  }, [customTitle, timestamp, characterName])

  return (
    <div
      data-memory-album-photo={interactive ? '' : undefined}
      className={`memory-album-polaroid relative inline-flex w-fit max-w-full flex-col ${
        interactive && onOpenDetail ? 'cursor-pointer' : ''
      } ${className}`}
      onClick={interactive && onOpenDetail ? onOpenDetail : undefined}
    >
      <div className="memory-album-polaroid-frame relative inline-block w-fit max-w-full">
        <img
          src={displaySrc}
          alt=""
          className="memory-album-polaroid-img block"
          draggable={false}
          loading="eager"
          decoding="async"
        />
        <span className="memory-album-polaroid-laminate" aria-hidden="true" />
      </div>

      <p className="memory-album-polaroid-caption max-w-full px-1 text-center font-serif text-[11px] italic text-gray-500">
        {caption}
      </p>
      <span className="memory-album-polaroid-seal-edge" aria-hidden="true" />
    </div>
  )
}

/** @deprecated 使用 PolaroidCard */
export { PolaroidCard as PolaroidPhoto }
