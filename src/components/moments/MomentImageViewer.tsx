import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchList as ReactTouchList,
} from 'react'
import { createPortal } from 'react-dom'

import { MomentsSerifNumericText } from './ArchiveTimelineDateColumn'
import { saveMomentImageToAlbum } from './saveMomentImageToAlbum'

type MomentImageViewerProps = {
  open: boolean
  images: string[]
  initialIndex?: number
  allowSave?: boolean
  onClose: () => void
}

const MIN_SCALE = 1
const MAX_SCALE = 4
const SLIDE_TRANSITION = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)'

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

function rubberBandOffset(delta: number, index: number, count: number): number {
  if (count <= 1) return delta * 0.35
  if (index <= 0 && delta > 0) return delta * 0.35
  if (index >= count - 1 && delta < 0) return delta * 0.35
  return delta
}

export function MomentImageViewer({
  open,
  images,
  initialIndex = 0,
  allowSave = false,
  onClose,
}: MomentImageViewerProps) {
  const [index, setIndex] = useState(initialIndex)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [slideWidth, setSlideWidth] = useState(0)
  const [swipeOffsetX, setSwipeOffsetX] = useState(0)
  const [slideTransition, setSlideTransition] = useState(SLIDE_TRANSITION)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const swipeStartXRef = useRef<number | null>(null)
  const isDraggingSlideRef = useRef(false)
  const pendingIndexRef = useRef<number | null>(null)
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null)
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const count = images.length
  const currentSrc = images[index] ?? ''

  const resetTransform = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const resetSlideOffset = useCallback((animated = true) => {
    pendingIndexRef.current = null
    setSlideTransition(animated ? SLIDE_TRANSITION : 'none')
    setSwipeOffsetX(0)
  }, [])

  const finalizePendingSlide = useCallback(() => {
    const nextIndex = pendingIndexRef.current
    if (nextIndex == null) return
    pendingIndexRef.current = null
    setSlideTransition('none')
    setIndex(nextIndex)
    resetTransform()
    setSwipeOffsetX(0)
    requestAnimationFrame(() => setSlideTransition(SLIDE_TRANSITION))
  }, [resetTransform])

  useEffect(() => {
    if (!open) return
    const safeIndex = Math.min(Math.max(0, initialIndex), Math.max(0, images.length - 1))
    setIndex(safeIndex)
    resetTransform()
    resetSlideOffset(false)
    pendingIndexRef.current = null
  }, [open, initialIndex, images.length, resetSlideOffset, resetTransform])

  useEffect(() => {
    if (!open || !viewportRef.current) return
    const el = viewportRef.current
    const syncWidth = () => setSlideWidth(el.clientWidth)
    syncWidth()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncWidth) : null
    ro?.observe(el)
    window.addEventListener('resize', syncWidth)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', syncWidth)
    }
  }, [open])

  /** 从当前跟手位置平滑滑到目标张，动画结束后无感切换 index */
  const animateSlideTo = useCallback(
    (nextIndex: number, targetOffsetX: number) => {
      if (!slideWidth) {
        setIndex(nextIndex)
        resetTransform()
        resetSlideOffset(false)
        return
      }

      pendingIndexRef.current = nextIndex
      setSlideTransition(SLIDE_TRANSITION)
      setSwipeOffsetX(targetOffsetX)
    },
    [resetSlideOffset, resetTransform, slideWidth],
  )

  const goPrev = useCallback(() => {
    if (index <= 0 || !slideWidth) return
    animateSlideTo(index - 1, slideWidth)
  }, [animateSlideTo, index, slideWidth])

  const goNext = useCallback(() => {
    if (index >= count - 1 || !slideWidth) return
    animateSlideTo(index + 1, -slideWidth)
  }, [animateSlideTo, count, index, slideWidth])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && scale <= 1) goPrev()
      if (e.key === 'ArrowRight' && scale <= 1) goNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goNext, goPrev, onClose, open, scale])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const finishSwipe = useCallback(
    (deltaX: number) => {
      isDraggingSlideRef.current = false
      swipeStartXRef.current = null

      const threshold = Math.max(48, slideWidth * 0.18)
      if (deltaX > threshold && index > 0) {
        animateSlideTo(index - 1, slideWidth)
        return
      }
      if (deltaX < -threshold && index < count - 1) {
        animateSlideTo(index + 1, -slideWidth)
        return
      }
      resetSlideOffset(true)
    },
    [animateSlideTo, count, index, resetSlideOffset, slideWidth],
  )

  const handleSave = async () => {
    if (!allowSave || !currentSrc || saving) return
    setSaving(true)
    try {
      const result = await saveMomentImageToAlbum(currentSrc, 'wechat-moment')
      if (!result.ok && result.message) window.alert(result.message)
    } finally {
      setSaving(false)
    }
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.15 : 0.15
    setScale((s) => {
      const next = clampScale(s + delta)
      if (next <= 1) setOffset({ x: 0, y: 0 })
      return next
    })
  }

  const onDoubleClick = () => {
    if (scale > 1) {
      resetTransform()
      return
    }
    setScale(2)
  }

  const touchDistance = (touches: ReactTouchList) => {
    if (touches.length < 2) return 0
    const a = touches[0]!
    const b = touches[1]!
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  const beginSlideDrag = (clientX: number) => {
    if (scale > 1 || count <= 1) return
    pendingIndexRef.current = null
    isDraggingSlideRef.current = true
    swipeStartXRef.current = clientX
    setSlideTransition('none')
  }

  const moveSlideDrag = (clientX: number) => {
    if (!isDraggingSlideRef.current || swipeStartXRef.current == null || scale > 1) return
    const delta = clientX - swipeStartXRef.current
    setSwipeOffsetX(rubberBandOffset(delta, index, count))
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { distance: touchDistance(e.touches), scale }
      panRef.current = null
      isDraggingSlideRef.current = false
      swipeStartXRef.current = null
      return
    }
    if (e.touches.length === 1 && scale > 1) {
      panRef.current = {
        x: e.touches[0]!.clientX,
        y: e.touches[0]!.clientY,
        ox: offset.x,
        oy: offset.y,
      }
      return
    }
    if (e.touches.length === 1 && scale <= 1) {
      beginSlideDrag(e.touches[0]!.clientX)
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const distance = touchDistance(e.touches)
      if (distance <= 0) return
      const next = clampScale(pinchRef.current.scale * (distance / pinchRef.current.distance))
      setScale(next)
      if (next <= 1) setOffset({ x: 0, y: 0 })
      return
    }
    if (e.touches.length === 1 && panRef.current && scale > 1) {
      const t = e.touches[0]!
      setOffset({
        x: panRef.current.ox + t.clientX - panRef.current.x,
        y: panRef.current.oy + t.clientY - panRef.current.y,
      })
      return
    }
    if (e.touches.length === 1 && isDraggingSlideRef.current) {
      moveSlideDrag(e.touches[0]!.clientX)
    }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (pinchRef.current && e.touches.length < 2) pinchRef.current = null
    if (panRef.current && e.touches.length === 0) panRef.current = null

    if (isDraggingSlideRef.current && e.changedTouches.length === 1) {
      const delta = e.changedTouches[0]!.clientX - (swipeStartXRef.current ?? 0)
      finishSwipe(delta)
      return
    }
    swipeStartXRef.current = null
    isDraggingSlideRef.current = false
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    if (scale > 1 || count <= 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    beginSlideDrag(e.clientX)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    if (!isDraggingSlideRef.current) return
    moveSlideDrag(e.clientX)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    if (!isDraggingSlideRef.current || swipeStartXRef.current == null) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    finishSwipe(e.clientX - swipeStartXRef.current)
  }

  const onPointerCancel = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    if (!isDraggingSlideRef.current) return
    resetSlideOffset(true)
    isDraggingSlideRef.current = false
    swipeStartXRef.current = null
  }

  const onTrackTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== trackRef.current || e.propertyName !== 'transform') return
    if (pendingIndexRef.current != null) finalizePendingSlide()
  }

  const trackTranslateX =
    slideWidth > 0 ? -index * slideWidth + swipeOffsetX : swipeOffsetX

  if (!open || !count) return null

  const overlay = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[600] flex flex-col bg-black/96"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div
            className="flex shrink-0 items-center justify-between px-3 pb-2"
            style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="关闭"
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>
            {count > 1 ? (
              <span className="text-[13px] text-white/75">
                <MomentsSerifNumericText text={`${index + 1} / ${count}`} />
              </span>
            ) : (
              <span className="text-[13px] text-white/50">图片</span>
            )}
            {allowSave ? (
              <button
                type="button"
                aria-label="保存到相册"
                disabled={saving}
                onClick={() => void handleSave()}
                className="flex size-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                <Download className="size-5" strokeWidth={1.75} />
              </button>
            ) : (
              <div className="size-10" />
            )}
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-2"
            onClick={(e) => e.stopPropagation()}
          >
            {index > 0 ? (
              <button
                type="button"
                aria-label="上一张"
                onClick={goPrev}
                className="absolute left-1 z-10 flex size-10 items-center justify-center rounded-full bg-black/35 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/50 sm:left-3"
              >
                <ChevronLeft className="size-6" strokeWidth={1.75} />
              </button>
            ) : null}

            <div
              ref={viewportRef}
              className="h-full w-full max-w-full touch-none select-none overflow-hidden"
              style={{ touchAction: 'none' }}
              onWheel={onWheel}
              onDoubleClick={onDoubleClick}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            >
              <div
                ref={trackRef}
                className="flex h-full will-change-transform"
                style={{
                  width: slideWidth > 0 ? slideWidth * count : `${count * 100}%`,
                  transform: `translate3d(${trackTranslateX}px, 0, 0)`,
                  transition: slideTransition,
                }}
                onTransitionEnd={onTrackTransitionEnd}
              >
                {images.map((src, imageIndex) => {
                  const isActive = imageIndex === index
                  return (
                    <div
                      key={`${src}-${imageIndex}`}
                      className="flex h-full shrink-0 items-center justify-center px-1"
                      style={{ width: slideWidth > 0 ? slideWidth : `${100 / count}%` }}
                    >
                      <img
                        src={src}
                        alt=""
                        className="max-h-[min(78vh,720px)] max-w-full object-contain"
                        style={{
                          transform: isActive
                            ? `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`
                            : undefined,
                        }}
                        draggable={false}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {index < count - 1 ? (
              <button
                type="button"
                aria-label="下一张"
                onClick={goNext}
                className="absolute right-1 z-10 flex size-10 items-center justify-center rounded-full bg-black/35 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/50 sm:right-3"
              >
                <ChevronRight className="size-6" strokeWidth={1.75} />
              </button>
            ) : null}
          </div>

          <p
            className="shrink-0 pb-[max(12px,env(safe-area-inset-bottom,0px))] text-center text-[11px] text-white/45"
            onClick={(e) => e.stopPropagation()}
          >
            双击放大 · 左右滑动切换
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )

  return createPortal(overlay, document.body)
}
