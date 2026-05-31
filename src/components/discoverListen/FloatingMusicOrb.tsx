import { animate, motion, useMotionValue } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useMusicStore } from '../../stores/useMusicStore'
import { MiniPlayerPopover } from './MiniPlayerPopover'
import { ORB_PEEK_H, ORB_PEEK_W, RoseAuraOrbVisual } from './RoseAuraOrbVisual'

const ORB_SIZE = 56
const EDGE_MARGIN = 10
const ORB_IDLE_MS = 3000
const DRAG_THRESHOLD_PX = 6
const SPRING = { type: 'spring' as const, stiffness: 300, damping: 25, mass: 0.8 }

export function FloatingMusicOrb() {
  const visible = useMusicStore((s) => s.isFloatingOrbVisible)
  const track = useMusicStore((s) => s.currentTrack)
  const isPlaying = useMusicStore((s) => s.isPlaying)
  const popoverOpen = useMusicStore((s) => s.popoverOpen)
  const orbEdgeHidden = useMusicStore((s) => s.orbEdgeHidden)
  const setPopoverOpen = useMusicStore((s) => s.setPopoverOpen)
  const setOrbEdgeHidden = useMusicStore((s) => s.setOrbEdgeHidden)

  const containerRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(120)
  const snapSideRef = useRef<'left' | 'right'>('right')
  const dragMovedRef = useRef(false)
  const hideTimerRef = useRef<number | null>(null)
  const [anchorY, setAnchorY] = useState(120)
  const [ready, setReady] = useState(false)

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const scheduleAutoHide = useCallback(() => {
    if (useMusicStore.getState().popoverOpen) return
    clearHideTimer()
    hideTimerRef.current = window.setTimeout(() => {
      if (useMusicStore.getState().popoverOpen) return
      setOrbEdgeHidden(true)
    }, ORB_IDLE_MS)
  }, [clearHideTimer, setOrbEdgeHidden])

  const revealOrb = useCallback(() => {
    setOrbEdgeHidden(false)
    clearHideTimer()
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return
    const targetX =
      snapSideRef.current === 'left'
        ? EDGE_MARGIN
        : bounds.width - ORB_SIZE - EDGE_MARGIN
    void animate(x, targetX, SPRING)
    scheduleAutoHide()
  }, [clearHideTimer, scheduleAutoHide, setOrbEdgeHidden, x])

  const snapToNearestEdge = useCallback(() => {
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return
    const currentX = x.get()
    const centerX = currentX + ORB_SIZE / 2
    const snapLeft = EDGE_MARGIN
    const snapRight = bounds.width - ORB_SIZE - EDGE_MARGIN
    const toLeft = centerX < bounds.width / 2
    snapSideRef.current = toLeft ? 'left' : 'right'
    const targetX = toLeft ? snapLeft : snapRight
    void animate(x, targetX, SPRING)
    setAnchorY(y.get())
    scheduleAutoHide()
  }, [scheduleAutoHide, x, y])

  useEffect(() => {
    if (!visible || !containerRef.current) return
    const bounds = containerRef.current.getBoundingClientRect()
    const initialX = bounds.width - ORB_SIZE - EDGE_MARGIN - 4
    x.set(initialX)
    y.set(bounds.height * 0.38)
    snapSideRef.current = 'right'
    setAnchorY(bounds.height * 0.38)
    setReady(true)
    scheduleAutoHide()
  }, [visible, scheduleAutoHide, x, y])

  useEffect(() => {
    if (!visible) {
      setPopoverOpen(false)
      setOrbEdgeHidden(false)
      clearHideTimer()
      setReady(false)
    }
  }, [visible, setPopoverOpen, setOrbEdgeHidden, clearHideTimer])

  useEffect(() => () => clearHideTimer(), [clearHideTimer])

  useEffect(() => {
    if (orbEdgeHidden && popoverOpen) {
      setPopoverOpen(false)
    }
  }, [orbEdgeHidden, popoverOpen, setPopoverOpen])

  useEffect(() => {
    if (!ready) return
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return
    const hiddenX = snapSideRef.current === 'left' ? 0 : bounds.width - ORB_PEEK_W
    const openX =
      snapSideRef.current === 'left'
        ? EDGE_MARGIN
        : bounds.width - ORB_SIZE - EDGE_MARGIN
    void animate(x, orbEdgeHidden ? hiddenX : openX, SPRING)
  }, [orbEdgeHidden, ready, x])

  if (!visible || !track) return null

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-[10002] overflow-visible"
      aria-hidden={!visible}
    >
      <motion.div
        drag={!popoverOpen}
        dragMomentum={false}
        dragElastic={0.08}
        style={{ x, y, touchAction: 'none', zIndex: popoverOpen ? 1 : 2 }}
        onDragStart={() => {
          dragMovedRef.current = false
          setOrbEdgeHidden(false)
          clearHideTimer()
          setPopoverOpen(false)
        }}
        onDrag={(_, info) => {
          if (
            Math.abs(info.offset.x) > DRAG_THRESHOLD_PX ||
            Math.abs(info.offset.y) > DRAG_THRESHOLD_PX
          ) {
            dragMovedRef.current = true
          }
        }}
        onDragEnd={() => {
          snapToNearestEdge()
        }}
        className="pointer-events-auto absolute left-0 top-0"
      >
        <motion.button
          type="button"
          aria-label={orbEdgeHidden ? '展开音乐悬浮球' : `${track.title}，打开控制面板`}
          onPointerDown={() => {
            dragMovedRef.current = false
          }}
          onTap={() => {
            if (dragMovedRef.current) return
            if (orbEdgeHidden) {
              revealOrb()
              return
            }
            const nextOpen = !popoverOpen
            setPopoverOpen(nextOpen)
            if (nextOpen) {
              clearHideTimer()
            } else {
              scheduleAutoHide()
            }
          }}
          whileTap={{ scale: orbEdgeHidden ? 1 : 0.94 }}
          className={`relative flex items-center justify-center overflow-visible ${
            orbEdgeHidden ? 'rounded-sm' : 'h-14 w-14 rounded-full'
          }`}
          style={
            orbEdgeHidden
              ? { width: ORB_PEEK_W, height: ORB_PEEK_H }
              : undefined
          }
        >
          <RoseAuraOrbVisual
            cover={track.cover}
            isPlaying={isPlaying}
            edgeHidden={orbEdgeHidden}
            snapSide={snapSideRef.current}
          />
        </motion.button>
      </motion.div>

      {ready && popoverOpen ? (
        <div className="pointer-events-auto absolute inset-0 z-[10000]">
          <MiniPlayerPopover
            open={popoverOpen}
            onClose={() => {
              setPopoverOpen(false)
              scheduleAutoHide()
            }}
            anchorSide={snapSideRef.current}
            anchorY={anchorY}
          />
        </div>
      ) : null}
    </div>
  )
}
