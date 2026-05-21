import { useEffect, useRef, useState } from 'react'

/** 浅色铂金风 · 情感共鸣刻度，细线与铂金色进度 */
export function AffectionMeter({
  value,
  flashKey,
}: {
  /** 0–100 */
  value: number
  /** 好感来源更新时递增，用于触发一次铂金光晕 */
  flashKey?: number
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  const [display, setDisplay] = useState(clamped)
  const displayRef = useRef(display)
  displayRef.current = display

  const [glow, setGlow] = useState(false)
  const prevFlashRef = useRef(flashKey ?? 0)

  useEffect(() => {
    if (flashKey == null || flashKey === prevFlashRef.current) return
    prevFlashRef.current = flashKey
    setGlow(true)
    const t = window.setTimeout(() => setGlow(false), 520)
    return () => window.clearTimeout(t)
  }, [flashKey])

  useEffect(() => {
    const target = clamped
    const from = displayRef.current
    if (from === target) return
    const t0 = performance.now()
    const dur = 420
    let raf = 0
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / dur)
      const eased = 1 - (1 - u) ** 2
      const next = Math.round(from + (target - from) * eased)
      displayRef.current = next
      setDisplay(next)
      if (u < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [clamped])

  return (
    <div className="w-full">
      <div className="flex items-end justify-end gap-2">
        <span className="font-mono text-[10px] tracking-tight text-gray-400">
          情感共鸣 {display}%
        </span>
      </div>
      <div
        className="relative mt-1.5 h-px w-full overflow-visible rounded-none bg-gray-200/90"
        style={{
          boxShadow: glow ? '0 0 14px rgba(212, 175, 55, 0.35)' : 'none',
          transition: 'box-shadow 0.45s ease-out',
        }}
      >
        <div
          className="absolute left-0 top-0 h-px rounded-none bg-[#D4AF37]"
          style={{
            width: `${clamped}%`,
            transition: 'width 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
            boxShadow: glow ? '0 0 10px rgba(212, 175, 55, 0.45)' : 'none',
          }}
        />
      </div>
    </div>
  )
}
