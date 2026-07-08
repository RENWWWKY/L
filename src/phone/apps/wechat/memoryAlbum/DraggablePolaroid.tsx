import { useEffect, useRef } from 'react'

import { usePolaroidGestures } from './usePolaroidGestures'
import type { PhotoLayout } from './memoryAlbumTypes'
import { PolaroidCard } from './PolaroidCard'

type DraggablePolaroidProps = {
  layout: PhotoLayout
  pageRef: React.RefObject<HTMLDivElement | null>
  onLayoutChange: (layout: PhotoLayout) => void
  onOpenDetail: () => void
  children: React.ReactNode
  bringToFront: () => void
}

export function DraggablePolaroid({
  layout,
  pageRef,
  onLayoutChange,
  onOpenDetail,
  children,
  bringToFront,
}: DraggablePolaroidProps) {
  const { displayLayout, displayScale, displayRotate, dragging, pinching, positionStyle, gestureProps } =
    usePolaroidGestures({
      layout,
      pageRef,
      onLayoutChange,
      onTap: onOpenDetail,
      onInteractionStart: bringToFront,
    })

  const interacting = dragging || pinching
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const block = (e: Event) => e.preventDefault()
    el.addEventListener('selectstart', block)
    el.addEventListener('dragstart', block)
    el.addEventListener('contextmenu', block)
    return () => {
      el.removeEventListener('selectstart', block)
      el.removeEventListener('dragstart', block)
      el.removeEventListener('contextmenu', block)
    }
  }, [])

  return (
    <div
      ref={rootRef}
      data-memory-polaroid
      data-memory-polaroid-dragging={dragging ? '1' : undefined}
      data-memory-polaroid-pinching={pinching ? '1' : undefined}
      className={`absolute w-fit max-w-[92%] select-none ${
        interacting ? 'touch-none cursor-grabbing' : 'touch-none cursor-grab'
      }`}
      style={{
        ...positionStyle,
        zIndex: displayLayout.z,
      }}
      {...gestureProps}
    >
      <div
        className="origin-center"
        style={{ transform: `rotate(${displayRotate}deg) scale(${displayScale})` }}
      >
        {children}
      </div>
    </div>
  )
}

type DraggablePolaroidCardProps = {
  layout: PhotoLayout
  pageRef: React.RefObject<HTMLDivElement | null>
  onLayoutChange: (layout: PhotoLayout) => void
  onOpenDetail: () => void
  bringToFront: () => void
  imageUrl: string
  timestamp: number
  characterName: string
  messageId: string
  customTitle?: string
}

export function DraggablePolaroidCard(props: DraggablePolaroidCardProps) {
  const {
    layout,
    pageRef,
    onLayoutChange,
    onOpenDetail,
    bringToFront,
    imageUrl,
    timestamp,
    characterName,
    messageId,
    customTitle,
  } = props

  return (
    <DraggablePolaroid
      layout={layout}
      pageRef={pageRef}
      onLayoutChange={onLayoutChange}
      onOpenDetail={onOpenDetail}
      bringToFront={bringToFront}
    >
      <PolaroidCard
        imageUrl={imageUrl}
        timestamp={timestamp}
        characterName={characterName}
        messageId={messageId}
        customTitle={customTitle}
        interactive={false}
      />
    </DraggablePolaroid>
  )
}
