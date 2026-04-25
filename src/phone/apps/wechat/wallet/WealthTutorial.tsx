import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useId, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'

export type WealthTutorialPick = 'vault' | 'deposit' | 'market'

type RectLike = { left: number; top: number; width: number; height: number }

function rectFromElement(el: HTMLElement | null): RectLike | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

export function WealthTutorial({
  open,
  phase,
  signingSheetMode = false,
  onPickTrack,
  stepTitle,
  stepText,
  targetElement,
  onNext,
  onPrev,
  onClose,
  canGoPrev,
  nextLabel,
}: {
  open: boolean
  phase: 'hub' | 'step'
  /** 签约演示：仅渲染顶部教程卡片；暗色与签署面板的层级由页面穿插控制 */
  signingSheetMode?: boolean
  onPickTrack?: (t: WealthTutorialPick) => void
  stepTitle: string
  stepText: string
  targetElement: HTMLElement | null
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  canGoPrev: boolean
  nextLabel: string
}) {
  const maskId = useId().replace(/:/g, '')
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 390,
    h: typeof window !== 'undefined' ? window.innerHeight : 844,
  }))

  /** 高亮目标在动画/布局变化时矩形会变；不能仅靠 targetElement 引用做 memo */
  const [layoutMeasure, setLayoutMeasure] = useState(0)

  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (!open || phase === 'hub' || !targetElement || signingSheetMode) return
    let n = 0
    let id = 0
    const tick = () => {
      setLayoutMeasure((m) => m + 1)
      n += 1
      if (n < 40) id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [open, phase, targetElement, signingSheetMode])

  const rect = useMemo(
    () => (phase === 'hub' || signingSheetMode ? null : rectFromElement(targetElement)),
    [phase, signingSheetMode, targetElement, layoutMeasure],
  )

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
  }, [rect, viewport.h, viewport.w])

  const panelPos = useMemo(() => {
    const margin = 12
    const panelW = Math.min(460, viewport.w - margin * 2)
    const panelH = phase === 'hub' ? 420 : 238
    if (signingSheetMode) {
      return {
        left: (viewport.w - panelW) / 2,
        width: panelW,
      }
    }
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
  }, [focus, phase, signingSheetMode, viewport.h, viewport.w])

  const panelInner =
    phase === 'hub' ? (
      <>
        <h4 className="mt-1 text-[18px] font-semibold text-black">理财教程</h4>
        <p className="mt-2 text-[13px] leading-6 text-gray-700">请选择一种玩法，按步骤了解活期、定期或股市。</p>
        <div className="mt-4 grid gap-2">
          <Pressable
            type="button"
            onClick={() => onPickTrack?.('vault')}
            className="flex flex-col items-start rounded-[18px] border border-white/70 bg-white/55 px-4 py-3 text-left backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]"
          >
            <span className="text-[15px] font-semibold text-black">活期小金库</span>
            <span className="mt-1 text-[12px] text-gray-600">随存随取，按日计息，适合放日常零钱。</span>
          </Pressable>
          <Pressable
            type="button"
            onClick={() => onPickTrack?.('deposit')}
            className="flex flex-col items-start rounded-[18px] border border-white/70 bg-white/55 px-4 py-3 text-left backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]"
          >
            <span className="text-[15px] font-semibold text-black">定期契约</span>
            <span className="mt-1 text-[12px] text-gray-600">锁定天数换更高年化，到期再取。</span>
          </Pressable>
          <Pressable
            type="button"
            onClick={() => onPickTrack?.('market')}
            className="flex flex-col items-start rounded-[18px] border border-white/70 bg-white/55 px-4 py-3 text-left backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]"
          >
            <span className="text-[15px] font-semibold text-black">星空股市</span>
            <span className="mt-1 text-[12px] text-gray-600">看价、买入、签约与持仓盈亏。</span>
          </Pressable>
        </div>
        <div className="mt-4 flex justify-end">
          <Pressable
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-300 px-4 py-2 text-[12px] text-gray-700"
          >
            跳过教程
          </Pressable>
        </div>
      </>
    ) : (
      <>
        <h4 className="mt-1 text-[18px] font-semibold text-black">{stepTitle}</h4>
        <p className="mt-2 text-[13px] leading-6 text-gray-700">{stepText}</p>
        {signingSheetMode ? (
          <p className="mt-2 text-[12px] leading-5 text-gray-500">底部为演示面板，点「签署并买入」仅作动画，不会真实扣款。</p>
        ) : null}
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
              className={`rounded-full border px-4 py-2 text-[12px] ${canGoPrev ? 'border-gray-300 text-gray-700' : 'border-gray-200 text-gray-300'}`}
              disabled={!canGoPrev}
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
      </>
    )

  if (signingSheetMode && open) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-[150]"
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            className="pointer-events-auto absolute max-h-[min(520px,86vh)] overflow-y-auto rounded-[24px] border border-white/60 bg-white/92 px-4 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
            style={{
              left: panelPos.left,
              top: 'max(12px, env(safe-area-inset-top, 0px))',
              width: panelPos.width,
            }}
          >
            <p className="text-[11px] tracking-[0.2em] text-gray-500">WEALTH TUTORIAL</p>
            {panelInner}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-[150]"
        >
          {focus ? (
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${viewport.w} ${viewport.h}`}
              preserveAspectRatio="none"
              aria-hidden
            >
              <defs>
                <mask id={`wealth-tutorial-hole-${maskId}`}>
                  <rect x="0" y="0" width={viewport.w} height={viewport.h} fill="white" />
                  <rect
                    x={focus.left}
                    y={focus.top}
                    width={focus.width}
                    height={focus.height}
                    rx="22"
                    ry="22"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width={viewport.w}
                height={viewport.h}
                fill="rgba(0,0,0,0.45)"
                mask={`url(#wealth-tutorial-hole-${maskId})`}
              />
            </svg>
          ) : (
            <div className="absolute inset-0 bg-black/45" />
          )}

          {focus ? (
            <motion.div
              initial={{ opacity: 0.5, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.22 }}
              className="absolute rounded-[22px] border-2 border-[#d7be8d]"
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
            className="pointer-events-auto absolute max-h-[min(520px,86vh)] overflow-y-auto rounded-[24px] border border-white/60 bg-white/92 px-4 py-4 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
            style={{ left: panelPos.left, top: panelPos.top, width: panelPos.width }}
          >
            <p className="text-[11px] tracking-[0.2em] text-gray-500">WEALTH TUTORIAL</p>
            {panelInner}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
