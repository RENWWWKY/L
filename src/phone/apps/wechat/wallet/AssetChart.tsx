import { AnimatePresence, motion } from 'framer-motion'
import { useId, useMemo, useRef, useState } from 'react'

export type AssetChartPoint = {
  labelZh: string
  labelEn?: string
  dateText: string
  value: number
}

type Pt = { x: number; y: number; value: number; idx: number }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function formatMoney(v: number) {
  return `¥ ${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildPoints(values: number[], width: number, height: number, padX: number, padY: number): { pts: Pt[]; min: number; max: number } {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)
  const step = (width - padX * 2) / Math.max(1, values.length - 1)
  const pts = values.map((v, i) => {
    const x = padX + i * step
    const y = height - padY - ((v - min) / range) * (height - padY * 2)
    return { x, y, value: v, idx: i }
  })
  return { pts, min, max }
}

function linePath(pts: Pt[]) {
  if (pts.length < 2) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
}

function areaPath(pts: Pt[], height: number, padY: number) {
  if (pts.length < 2) return ''
  const baseY = height - padY
  return `${linePath(pts)} L ${pts[pts.length - 1]!.x.toFixed(2)} ${baseY.toFixed(2)} L ${pts[0]!.x.toFixed(2)} ${baseY.toFixed(2)} Z`
}

export function AssetChart({
  series,
  className = '',
  tone = 'neutral',
}: {
  series: AssetChartPoint[]
  className?: string
  tone?: 'positive' | 'neutral'
}) {
  const uid = useId().replace(/:/g, '')
  const rootRef = useRef<SVGSVGElement | null>(null)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const width = 640
  const height = 210
  const padX = 18
  const padY = 26

  const values = useMemo(() => series.map((d) => d.value), [series])
  const { pts, min, max } = useMemo(() => buildPoints(values, width, height, padX, padY), [values])
  const dLine = useMemo(() => linePath(pts), [pts])
  const dArea = useMemo(() => areaPath(pts, height, padY), [pts])

  const gold = '#b69457'
  const ink = '#111111'
  const grid = 'rgba(0,0,0,0.08)'

  const yTicks = useMemo(() => {
    const a = min
    const b = max
    const steps = 3
    const out: number[] = []
    for (let i = 0; i <= steps; i += 1) out.push(a + ((b - a) * i) / steps)
    return out
  }, [min, max])

  const active = activeIdx == null ? null : pts[clamp(activeIdx, 0, pts.length - 1)] ?? null
  const activeSegmentColor = useMemo(() => {
    if (!active) return ink
    const i = active.idx
    const prev = pts[i - 1]
    if (!prev) return ink
    return active.value - prev.value >= 0.01 ? gold : ink
  }, [active, pts])

  const segments = useMemo(() => {
    const out: Array<{ d: string; color: string; key: string }> = []
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i]!
      const b = pts[i + 1]!
      const up = b.value - a.value >= 0.01
      out.push({
        key: `${i}-${a.idx}-${b.idx}`,
        d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
        color: up ? gold : ink,
      })
    }
    return out
  }, [pts])

  const pickIndexFromClientX = (clientX: number) => {
    const el = rootRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = clamp(((clientX - r.left) / r.width) * width, 0, width)
    const nearest = pts.reduce(
      (acc, p) => {
        const d = Math.abs(p.x - x)
        return d < acc.d ? { d, idx: p.idx } : acc
      },
      { d: Number.POSITIVE_INFINITY, idx: 0 },
    )
    setActiveIdx(nearest.idx)
  }

  return (
    <div className={`relative ${className}`} style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}>
      <svg
        ref={rootRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', cursor: 'default' }}
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          try {
            ;(e.currentTarget as any).setPointerCapture?.(e.pointerId)
          } catch {
            // ignore
          }
          pickIndexFromClientX(e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.buttons) {
            e.preventDefault()
            pickIndexFromClientX(e.clientX)
          }
        }}
        onPointerUp={() => setActiveIdx(null)}
        onPointerCancel={() => setActiveIdx(null)}
        onPointerLeave={() => setActiveIdx(null)}
        role="img"
        aria-label="资产走势图"
      >
        <defs>
          <linearGradient id={`wealth-area-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={tone === 'positive' ? 'rgba(182,148,87,0.22)' : 'rgba(17,17,17,0.12)'} />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* y grid */}
        {yTicks.map((t, i) => {
          const y = height - padY - ((t - min) / Math.max(1, max - min)) * (height - padY * 2)
          return (
            <g key={i} aria-hidden>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke={grid} strokeWidth="1" />
              <text x={width - padX} y={y - 6} textAnchor="end" fontSize="10" fill="rgba(0,0,0,0.28)">
                {Math.round(t).toLocaleString('zh-CN')}
              </text>
            </g>
          )
        })}

        {/* area + line */}
        <motion.path
          d={dArea}
          fill={`url(#wealth-area-${uid})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
        />
        {/* segmented line: each segment colors by slope */}
        {segments.map((s) => (
          <motion.path
            key={s.key}
            d={s.d}
            fill="none"
            stroke={s.color}
            strokeWidth="2.2"
            strokeLinecap="round"
            initial={{ opacity: 0.25 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          />
        ))}

        {/* x labels (show 7 days) */}
        {pts.map((p, i) => {
          if (i === 0 || i === pts.length - 1 || i === Math.floor((pts.length - 1) / 2) || (pts.length <= 7 && i % 1 === 0)) {
            return (
              <text key={i} x={p.x} y={height - 8} textAnchor="middle" fontSize="10" fill="rgba(0,0,0,0.38)" aria-hidden>
                {series[i]?.labelZh ?? ''}
              </text>
            )
          }
          return null
        })}

        {/* active marker */}
        {active ? (
          <g aria-hidden>
            <line x1={active.x} y1={padY - 2} x2={active.x} y2={height - padY} stroke="rgba(0,0,0,0.10)" strokeWidth="1" />
            <circle cx={active.x} cy={active.y} r={5.2} fill="white" stroke={activeSegmentColor} strokeWidth="2" />
          </g>
        ) : null}
      </svg>

      <AnimatePresence>
        {activeIdx != null && series[activeIdx] ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none absolute left-3 top-3 rounded-[16px] border border-white/70 bg-white/85 px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.10)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12px] font-semibold text-black">{formatMoney(series[activeIdx]!.value)}</p>
              <p className="text-[10px] text-gray-500">{series[activeIdx]!.dateText}</p>
            </div>
            <p className="mt-0.5 text-[10px] text-gray-500">
              {series[activeIdx]!.labelZh}
              {series[activeIdx]!.labelEn ? <span className="ml-2 text-gray-400">{series[activeIdx]!.labelEn}</span> : null}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

