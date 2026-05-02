import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, durationMs = 1200): number {
  const [v, setV] = useState(0)
  const raf = useRef<number>(0)

  useEffect(() => {
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - (1 - t) ** 3
      setV(Math.round(from + (target - from) * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, durationMs])

  return v
}

export function formatWithCommas(n: number): string {
  const s = String(Math.max(0, Math.floor(n)))
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
