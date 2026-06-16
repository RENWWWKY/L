import type { ArtistStatKey } from '../agentTypes'
import { STAT_LABELS } from '../agentTypes'

const AXES: ArtistStatKey[] = ['vocal', 'acting', 'variety', 'charm']

export function RadarChart({
  stats,
  size = 120,
}: {
  stats: Record<ArtistStatKey, number>
  size?: number
}) {
  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.38

  const points = AXES.map((key, i) => {
    const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2
    const r = (stats[key] / 100) * maxR
    return {
      key,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      lx: cx + Math.cos(angle) * (maxR + 14),
      ly: cy + Math.sin(angle) * (maxR + 14),
    }
  })

  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <polygon
          key={scale}
          points={AXES.map((_, i) => {
            const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2
            const r = maxR * scale
            return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`
          }).join(' ')}
          fill="none"
          stroke="rgba(251,207,232,0.6)"
          strokeWidth="1"
        />
      ))}
      <polygon points={polygon} fill="rgba(249,168,212,0.35)" stroke="#f9a8c4" strokeWidth="1.5" />
      {points.map((p) => (
        <g key={p.key}>
          <circle cx={p.x} cy={p.y} r="3" fill="#e879a9" />
          <text
            x={p.lx}
            y={p.ly}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[#8a7a75] text-[8px] font-medium"
          >
            {STAT_LABELS[p.key]}
          </text>
        </g>
      ))}
    </svg>
  )
}
