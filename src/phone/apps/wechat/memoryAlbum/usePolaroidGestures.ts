import { useCallback, useEffect, useRef, useState } from 'react'

import type { PhotoLayout } from './memoryAlbumTypes'
import {
  clampPhotoPosition,
  clampPhotoRotate,
  clampPhotoScale,
  normalizePhotoLayout,
} from './photoLayoutUtils'

type Point = { x: number; y: number }

const DRAG_THRESHOLD_PX = 6
const MIN_PINCH_DISTANCE_PX = 28
const PINCH_SCALE_THRESHOLD = 0.02
const PINCH_ROTATE_THRESHOLD_DEG = 1.5

type ScrollLock = {
  parent: HTMLElement
  overflow: string
  scrollTop: number
}

type DragSession = {
  pointerId: number
  origin: Point
  base: PhotoLayout
  pageRect: DOMRect
  target: HTMLDivElement
  scrollLock: ScrollLock | null
}

type PinchSession = {
  distance: number
  angle: number
  scale: number
  rotate: number
  base: PhotoLayout
  moved: boolean
}

type UsePolaroidGesturesOptions = {
  layout: PhotoLayout
  pageRef: React.RefObject<HTMLDivElement | null>
  onLayoutChange: (layout: PhotoLayout) => void
  onTap: () => void
  onInteractionStart: () => void
}

function lockPageScroll(scrollParent: HTMLElement | null): ScrollLock | null {
  if (!scrollParent) return null
  const scrollTop = scrollParent.scrollTop
  const overflow = scrollParent.style.overflow
  scrollParent.style.overflow = 'hidden'
  scrollParent.dataset.memoryAlbumDragLock = '1'
  scrollParent.scrollTop = scrollTop
  return { parent: scrollParent, overflow, scrollTop }
}

function unlockPageScroll(lock: ScrollLock | null) {
  if (!lock) return
  const { parent, overflow, scrollTop } = lock
  parent.style.overflow = overflow
  parent.scrollTop = scrollTop
  delete parent.dataset.memoryAlbumDragLock
}

function percentToPx(layout: PhotoLayout, pageRect: DOMRect): Point {
  return {
    x: (layout.x / 100) * pageRect.width,
    y: (layout.y / 100) * pageRect.height,
  }
}

function pxToPercent(point: Point, pageRect: DOMRect): { x: number; y: number } {
  if (pageRect.width <= 0 || pageRect.height <= 0) return { x: 0, y: 0 }
  return {
    x: (point.x / pageRect.width) * 100,
    y: (point.y / pageRect.height) * 100,
  }
}

function pointerDistance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function pointerAngleDeg(a: Point, b: Point) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

function getOrderedPointerPair(map: Map<number, Point>): [Point, Point] | null {
  const pts = Array.from(map.values())
  if (pts.length < 2) return null
  return [pts[0]!, pts[1]!]
}

function canStartPinch(map: Map<number, Point>) {
  const pair = getOrderedPointerPair(map)
  if (!pair) return false
  return pointerDistance(pair[0], pair[1]) >= MIN_PINCH_DISTANCE_PX
}

/**
 * 单指：只拖动位置（内层缩放/旋转冻结）
 * 双指：只缩放 + 旋转（与拖动严格分离）
 */
export function usePolaroidGestures({
  layout,
  pageRef,
  onLayoutChange,
  onTap,
  onInteractionStart,
}: UsePolaroidGesturesOptions) {
  const [visualLayout, setVisualLayout] = useState(() => normalizePhotoLayout(layout))

  const pointersRef = useRef(new Map<number, Point>())
  const pinchRef = useRef<PinchSession | null>(null)
  const dragRef = useRef<DragSession | null>(null)
  const pendingRef = useRef<{
    pointerId: number
    origin: Point
    base: PhotoLayout
    pageRect: DOMRect
    target: HTMLDivElement
  } | null>(null)
  const movedRef = useRef(false)

  const [livePosition, setLivePosition] = useState<Point | null>(null)
  const [liveScale, setLiveScale] = useState<number | null>(null)
  const [liveRotate, setLiveRotate] = useState<number | null>(null)
  const liveScaleRef = useRef<number | null>(null)
  const liveRotateRef = useRef<number | null>(null)
  const [pinching, setPinching] = useState(false)
  const [dragging, setDragging] = useState(false)

  const setLivePinch = useCallback((scale: number | null, rotate: number | null) => {
    liveScaleRef.current = scale
    liveRotateRef.current = rotate
    setLiveScale(scale)
    setLiveRotate(rotate)
  }, [])

  useEffect(() => {
    if (!dragging && !pinching) {
      setVisualLayout(normalizePhotoLayout(layout))
    }
  }, [layout, dragging, pinching])

  const endDrag = useCallback(() => {
    const session = dragRef.current
    if (!session) return
    unlockPageScroll(session.scrollLock)
    try {
      if (session.target.hasPointerCapture(session.pointerId)) {
        session.target.releasePointerCapture(session.pointerId)
      }
    } catch {
      /* ignore */
    }
    dragRef.current = null
    setDragging(false)
    setLivePosition(null)
  }, [])

  const endPinch = useCallback(() => {
    pinchRef.current = null
    setPinching(false)
    setLivePinch(null, null)
  }, [setLivePinch])

  const resetGesture = useCallback(() => {
    pendingRef.current = null
    movedRef.current = false
    endDrag()
    endPinch()
    pointersRef.current.clear()
  }, [endDrag, endPinch])

  const applyLayout = useCallback(
    (next: PhotoLayout) => {
      const normalized = normalizePhotoLayout(next)
      setVisualLayout(normalized)
      onLayoutChange(normalized)
      return normalized
    },
    [onLayoutChange],
  )

  const commitPosition = useCallback(
    (session: DragSession, position: Point) => {
      const nextPercent = pxToPercent(position, session.pageRect)
      const next = clampPhotoPosition(nextPercent.x, nextPercent.y)
      applyLayout({
        ...session.base,
        ...next,
      })
    },
    [applyLayout],
  )

  const commitTransform = useCallback(
    (session: PinchSession, scale: number, rotate: number) => {
      applyLayout({
        ...session.base,
        scale: clampPhotoScale(scale),
        rotate: clampPhotoRotate(rotate),
      })
    },
    [applyLayout],
  )

  const beginDrag = useCallback(
    (pending: NonNullable<typeof pendingRef.current>) => {
      if (pinchRef.current) return

      const page = pageRef.current
      const scrollParent = page?.closest('.memory-album-book-container') as HTMLElement | null
      const scrollLock = lockPageScroll(scrollParent)

      try {
        pending.target.setPointerCapture(pending.pointerId)
      } catch {
        /* ignore */
      }

      onInteractionStart()
      dragRef.current = {
        pointerId: pending.pointerId,
        origin: pending.origin,
        base: pending.base,
        pageRect: pending.pageRect,
        target: pending.target,
        scrollLock,
      }
      pendingRef.current = null
      setDragging(true)
    },
    [onInteractionStart, pageRef],
  )

  const beginPinch = useCallback(
    (base: PhotoLayout) => {
      if (!canStartPinch(pointersRef.current)) return

      pendingRef.current = null
      if (dragRef.current) {
        endDrag()
      }

      const pair = getOrderedPointerPair(pointersRef.current)
      if (!pair) return
      const [a, b] = pair

      pinchRef.current = {
        distance: pointerDistance(a, b),
        angle: pointerAngleDeg(a, b),
        scale: base.scale,
        rotate: base.rotate,
        base,
        moved: false,
      }
      setPinching(true)
      setLivePinch(base.scale, base.rotate)
    },
    [endDrag, setLivePinch],
  )

  const updatePinch = useCallback(() => {
    const start = pinchRef.current
    const pair = getOrderedPointerPair(pointersRef.current)
    if (!start || !pair) return
    if (!canStartPinch(pointersRef.current)) return

    const [a, b] = pair
    const distance = Math.max(pointerDistance(a, b), 1)
    const angle = pointerAngleDeg(a, b)
    const nextScale = clampPhotoScale(start.scale * (distance / start.distance))
    const nextRotate = clampPhotoRotate(start.rotate + (angle - start.angle))

    if (
      Math.abs(nextScale - start.scale) > PINCH_SCALE_THRESHOLD ||
      Math.abs(nextRotate - start.rotate) > PINCH_ROTATE_THRESHOLD_DEG
    ) {
      start.moved = true
    }

    setLivePinch(nextScale, nextRotate)
  }, [setLivePinch])

  useEffect(() => () => resetGesture(), [resetGesture])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return

      e.stopPropagation()
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (canStartPinch(pointersRef.current)) {
        e.preventDefault()
        beginPinch(visualLayout)
        return
      }

      const page = pageRef.current
      if (!page) return

      movedRef.current = false
      pendingRef.current = {
        pointerId: e.pointerId,
        origin: { x: e.clientX, y: e.clientY },
        base: visualLayout,
        pageRect: page.getBoundingClientRect(),
        target: e.currentTarget,
      }
    },
    [beginPinch, pageRef, visualLayout],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointersRef.current.has(e.pointerId)) return

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointersRef.current.size >= 2) {
        if (!canStartPinch(pointersRef.current)) return

        e.preventDefault()
        e.stopPropagation()
        if (!pinchRef.current) {
          beginPinch(visualLayout)
        } else {
          updatePinch()
        }
        return
      }

      if (pinchRef.current) return

      const pending = pendingRef.current
      if (pending && pending.pointerId === e.pointerId && !dragRef.current) {
        const dx = e.clientX - pending.origin.x
        const dy = e.clientY - pending.origin.y
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
        movedRef.current = true
        beginDrag(pending)
      }

      const session = dragRef.current
      if (!session || session.pointerId !== e.pointerId) return

      e.preventDefault()
      e.stopPropagation()
      movedRef.current = true

      const dx = e.clientX - session.origin.x
      const dy = e.clientY - session.origin.y
      const startPx = percentToPx(session.base, session.pageRect)
      setLivePosition({ x: startPx.x + dx, y: startPx.y + dy })
    },
    [beginDrag, beginPinch, updatePinch, visualLayout],
  )

  const finishPointer = useCallback(
    (pointerId: number, releasePoint?: Point) => {
      pointersRef.current.delete(pointerId)

      const pinchSession = pinchRef.current
      if (pointersRef.current.size < 2 && pinchSession) {
        if (pinchSession.moved) {
          commitTransform(
            pinchSession,
            liveScaleRef.current ?? pinchSession.scale,
            liveRotateRef.current ?? pinchSession.rotate,
          )
        }
        endPinch()
      }

      const session = dragRef.current
      if (session?.pointerId === pointerId) {
        const position =
          releasePoint ?? livePosition ?? percentToPx(session.base, session.pageRect)
        if (movedRef.current) {
          commitPosition(session, position)
        }
        endDrag()
      }

      const pending = pendingRef.current
      if (pending?.pointerId === pointerId) {
        if (!movedRef.current) {
          onInteractionStart()
          onTap()
        }
        pendingRef.current = null
      }

      if (pointersRef.current.size === 0) {
        movedRef.current = false
      }
    },
    [
      commitPosition,
      commitTransform,
      endDrag,
      endPinch,
      livePosition,
      onInteractionStart,
      onTap,
    ],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      const session = dragRef.current
      let releasePoint: Point | undefined
      if (session?.pointerId === e.pointerId) {
        const dx = e.clientX - session.origin.x
        const dy = e.clientY - session.origin.y
        const startPx = percentToPx(session.base, session.pageRect)
        releasePoint = { x: startPx.x + dx, y: startPx.y + dy }
      }
      finishPointer(e.pointerId, releasePoint)
    },
    [finishPointer],
  )

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      finishPointer(e.pointerId)
    },
    [finishPointer],
  )

  const dragSession = dragRef.current
  const transformBase = dragSession?.base ?? visualLayout

  const displayScale = pinching && liveScale != null ? liveScale : transformBase.scale
  const displayRotate = pinching && liveRotate != null ? liveRotate : transformBase.rotate
  const positionStyle =
    dragging && livePosition
      ? { left: `${livePosition.x}px`, top: `${livePosition.y}px` }
      : { left: `${visualLayout.x}%`, top: `${visualLayout.y}%` }

  return {
    displayLayout: visualLayout,
    displayScale,
    displayRotate,
    dragging,
    pinching,
    positionStyle,
    gestureProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  }
}
