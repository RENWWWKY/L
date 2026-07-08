import { animate, useMotionValue } from 'framer-motion'
import { useCallback, useRef, useState } from 'react'

export const FLIP_SPRING = { type: 'spring' as const, stiffness: 200, damping: 25 }

export type FlipOverlay = {
  underIndex: number
  flipIndex: number
  direction: 'next' | 'prev'
}

export function useHardPageFlip(pageCount: number) {
  const [pageIndex, setPageIndex] = useState(0)
  const [overlay, setOverlay] = useState<FlipOverlay | null>(null)
  const [isFlipping, setIsFlipping] = useState(false)
  const rotateY = useMotionValue(0)
  const dragStartX = useRef(0)
  const containerWidth = useRef(320)
  const isDragging = useRef(false)
  const dragDirection = useRef<'next' | 'prev' | null>(null)

  const clearOverlay = useCallback(() => {
    setOverlay(null)
    rotateY.set(0)
  }, [rotateY])

  const flipNext = useCallback(async () => {
    if (isFlipping || pageIndex >= pageCount - 1) return
    setIsFlipping(true)
    setOverlay({ underIndex: pageIndex + 1, flipIndex: pageIndex, direction: 'next' })
    rotateY.set(0)
    await animate(rotateY, -180, FLIP_SPRING)
    setPageIndex((i) => i + 1)
    clearOverlay()
    setIsFlipping(false)
  }, [clearOverlay, isFlipping, pageCount, pageIndex, rotateY])

  const flipPrev = useCallback(async () => {
    if (isFlipping || pageIndex <= 0) return
    setIsFlipping(true)
    setOverlay({ underIndex: pageIndex, flipIndex: pageIndex - 1, direction: 'prev' })
    rotateY.set(-180)
    await animate(rotateY, 0, FLIP_SPRING)
    setPageIndex((i) => i - 1)
    clearOverlay()
    setIsFlipping(false)
  }, [clearOverlay, isFlipping, pageIndex, rotateY])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isFlipping) return
      if ((e.target as HTMLElement).closest('[data-memory-album-photo]')) return
      dragStartX.current = e.clientX
      containerWidth.current = (e.currentTarget as HTMLElement).offsetWidth || 320
      isDragging.current = true
      dragDirection.current = null
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [isFlipping],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current || isFlipping) return
      const dx = e.clientX - dragStartX.current
      const width = containerWidth.current

      if (dx < -8 && pageIndex < pageCount - 1) {
        dragDirection.current = 'next'
        const progress = Math.min(1, Math.abs(dx) / (width * 0.72))
        rotateY.set(-180 * progress)
        setOverlay({ underIndex: pageIndex + 1, flipIndex: pageIndex, direction: 'next' })
      } else if (dx > 8 && pageIndex > 0) {
        dragDirection.current = 'prev'
        const progress = Math.min(1, dx / (width * 0.72))
        rotateY.set(-180 * (1 - progress))
        setOverlay({ underIndex: pageIndex, flipIndex: pageIndex - 1, direction: 'prev' })
      }
    },
    [isFlipping, pageCount, pageIndex, rotateY],
  )

  const onPointerUp = useCallback(async () => {
    if (!isDragging.current) return
    isDragging.current = false

    const currentRotate = rotateY.get()
    const dir = dragDirection.current
    dragDirection.current = null

    if (!dir) {
      if (overlay) {
        await animate(rotateY, 0, FLIP_SPRING)
        clearOverlay()
      }
      return
    }

    if (dir === 'next') {
      if (currentRotate < -54 && pageIndex < pageCount - 1) {
        setIsFlipping(true)
        await animate(rotateY, -180, FLIP_SPRING)
        setPageIndex((i) => i + 1)
        clearOverlay()
        setIsFlipping(false)
        return
      }
      await animate(rotateY, 0, FLIP_SPRING)
      clearOverlay()
      return
    }

    if (dir === 'prev') {
      if (currentRotate > -126 && pageIndex > 0) {
        setIsFlipping(true)
        await animate(rotateY, 0, FLIP_SPRING)
        setPageIndex((i) => i - 1)
        clearOverlay()
        setIsFlipping(false)
        return
      }
      await animate(rotateY, -180, FLIP_SPRING)
      clearOverlay()
    }
  }, [clearOverlay, overlay, pageCount, pageIndex, rotateY])

  return {
    pageIndex,
    overlay,
    isFlipping,
    rotateY,
    flipNext,
    flipPrev,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  }
}
