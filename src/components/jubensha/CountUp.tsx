import { useEffect, useState } from 'react'

export function CountUp({
  value,
  durationMs = 900,
  className = '',
}: {
  value: number
  durationMs?: number
  className?: string
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs)
      setDisplay(Math.round(value * p))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs])

  return <span className={className}>{display}</span>
}
