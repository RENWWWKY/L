import { PolaroidCard } from './PolaroidCard'
import { formatDefaultPolaroidTitle, type PhotoItem } from './memoryAlbumTypes'

type AlbumPageSpreadProps = {
  photos: PhotoItem[]
  characterName: string
  pageKey: string
  resolvePolaroidTitle: (photoId: string, fallback: string) => string
  onOpenPhotoDetail: (photo: PhotoItem) => void
}

/** 每页固定 2×2 均匀网格；轻点打开详情，暂不支持拖拽/缩放 */
export function AlbumPageSpread({
  photos,
  characterName,
  pageKey,
  resolvePolaroidTitle,
  onOpenPhotoDetail,
}: AlbumPageSpreadProps) {
  const filledPhotos = photos.filter(Boolean)
  const single = filledPhotos.length === 1

  return (
    <div
      className={`memory-album-paper memory-album-page-grid h-full min-h-full w-full ${
        single ? 'memory-album-page-grid--single' : ''
      }`}
    >
      {filledPhotos.map((photo) => {
        const fallbackTitle = formatDefaultPolaroidTitle(photo.timestamp, characterName)
        return (
          <div key={`${pageKey}-${photo.messageId}`} className="memory-album-polaroid-slot">
            <PolaroidCard
              imageUrl={photo.imageUrl}
              timestamp={photo.timestamp}
              characterName={characterName}
              messageId={photo.messageId}
              customTitle={resolvePolaroidTitle(photo.messageId, fallbackTitle)}
              interactive
              onOpenDetail={() => onOpenPhotoDetail(photo)}
            />
          </div>
        )
      })}
    </div>
  )
}
