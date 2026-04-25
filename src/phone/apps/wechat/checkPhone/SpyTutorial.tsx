import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useId, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'

type RectLike = { left: number; top: number; width: number; height: number }

function rectFromElement(el: HTMLElement | null): RectLike | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

export function SpyTutorial({
  open,
  step,
  title,
  text,
  targetElement,
  canPrev,
  onPrev,
  onNext,
  onClose,
  nextLabel,
}: {
  open: boolean
  step: number
  title: string
  text: string
  targetElement: HTMLElement | null
  canPrev: boolean
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  nextLabel: string
}) {
  const maskId = useId().replace(/:/g, '')
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 390,
    h: typeof window !== 'undefined' ? window.innerHeight : 844,
  }))
  const [layoutMeasure, setLayoutMeasure] = useState(0)

  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (!open || !targetElement) return
    let n = 0
    let id = 0
    const tick = () => {
      setLayoutMeasure((m) => m + 1)
      n += 1
      if (n < 32) id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [open, targetElement, step])

  const rect = useMemo(() => rectFromElement(targetElement), [targetElement, layoutMeasure])

  const focus = useMemo(() => {
    if (!rect) return null
    const pad = 8
    const left = Math.max(8, rect.left - pad)
    const top = Math.max(8, rect.top - pad)
    const right = Math.min(viewport.w - 8, rect.left + rect.width + pad)
    const bottom = Math.min(viewport.h - 8, rect.top + rect.height + pad)
    return {
      left,
      top,
      width: Math.max(24, right - left),
      height: Math.max(24, bottom - top),
      right,
      bottom,
    }
  }, [rect, viewport.w, viewport.h])

  const panelPos = useMemo(() => {
    const margin = 12
    const panelW = Math.min(440, viewport.w - margin * 2)
    const panelH = 250
    if (!focus) {
      return {
        left: (viewport.w - panelW) / 2,
        top: Math.max(24, (viewport.h - panelH) / 2),
        width: panelW,
      }
    }
    const spaceTop = focus.top - margin
    const spaceBottom = viewport.h - focus.bottom - margin
    const placeAbove = spaceTop > spaceBottom && spaceTop >= panelH
    let top = placeAbove ? focus.top - panelH - margin : focus.bottom + margin
    top = Math.max(12, Math.min(top, viewport.h - panelH - 12))
    let left = focus.left + focus.width / 2 - panelW / 2
    left = Math.max(12, Math.min(left, viewport.w - panelW - 12))
    return { left, top, width: panelW }
  }, [focus, viewport.w, viewport.h])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[1490]"
        >
          {focus ? (
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${viewport.w} ${viewport.h}`}
              preserveAspectRatio="none"
              aria-hidden
            >
              <defs>
                <mask id={`spy-tutorial-hole-${maskId}`}>
                  <rect x="0" y="0" width={viewport.w} height={viewport.h} fill="white" />
                  <rect
                    x={focus.left}
                    y={focus.top}
                    width={focus.width}
                    height={focus.height}
                    rx="18"
                    ry="18"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width={viewport.w}
                height={viewport.h}
                fill="rgba(0,0,0,0.44)"
                mask={`url(#spy-tutorial-hole-${maskId})`}
              />
            </svg>
          ) : (
            <div className="absolute inset-0 bg-black/44" />
          )}

          {focus ? (
            <motion.div
              initial={{ opacity: 0.5, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.22 }}
              className="absolute rounded-[18px] border-2 border-[#d7be8d]"
              style={{
                left: focus.left,
                top: focus.top,
                width: focus.width,
                height: focus.height,
                boxShadow: '0 0 0 1px rgba(255,255,255,0.42), 0 8px 28px rgba(0,0,0,0.22)',
              }}
            />
          ) : null}

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            className="pointer-events-auto absolute rounded-[24px] border border-white/60 bg-white/92 px-4 py-4 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
            style={{ left: panelPos.left, top: panelPos.top, width: panelPos.width }}
          >
            <p className="text-[11px] tracking-[0.2em] text-gray-500">SPY MODE TUTORIAL</p>
            <h4 className="mt-1 text-[18px] font-semibold text-black">{title}</h4>
            <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-gray-700">{text}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Pressable
                type="button"
                onClick={onClose}
                className="rounded-full border border-gray-300 px-4 py-2 text-[12px] text-gray-700"
              >
                跳过教程
              </Pressable>
              <div className="flex items-center gap-2">
                <Pressable
                  type="button"
                  onClick={onPrev}
                  className={`rounded-full border px-4 py-2 text-[12px] ${
                    canPrev ? 'border-gray-300 text-gray-700' : 'border-gray-200 text-gray-300'
                  }`}
                  disabled={!canPrev}
                >
                  上一步
                </Pressable>
                <Pressable
                  type="button"
                  onClick={onNext}
                  className="rounded-full border border-black bg-black px-4 py-2 text-[12px] text-white"
                >
                  {nextLabel}
                </Pressable>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
