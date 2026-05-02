import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { PLATINUM } from './constants'
import type { StorageSegment } from './scanLocalStorage'
import { formatWithCommas } from './useCountUp'

export type StoragePieVariant = 'indexeddb' | 'localstorage' | 'merged'

function mixHex(a: string, b: string, t: number): string {
  const pa = a.replace('#', '')
  const pb = b.replace('#', '')
  const ra = parseInt(pa.slice(0, 2), 16)
  const ga = parseInt(pa.slice(2, 4), 16)
  const ba = parseInt(pa.slice(4, 6), 16)
  const rb = parseInt(pb.slice(0, 2), 16)
  const gb = parseInt(pb.slice(2, 4), 16)
  const bb = parseInt(pb.slice(4, 6), 16)
  const r = Math.round(ra + (rb - ra) * t)
  const g = Math.round(ga + (gb - ga) * t)
  const bl = Math.round(ba + (bb - ba) * t)
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(bl)}`
}

function sliceColor(i: number, n: number): string {
  if (n <= 1) return PLATINUM.gold
  const t = i / (n - 1)
  if (t <= 0.5) return mixHex(PLATINUM.ink, PLATINUM.gold, t * 2)
  return mixHex(PLATINUM.gold, PLATINUM.mist, (t - 0.5) * 2)
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(2)} MB`
}

type RingSeg = { color: string; len: number; rot: number; key: string }

export function StoragePieChart({
  variant = 'indexeddb',
  segments,
  estimateUsageBytes,
  localStorageOutsideRingBytes = 0,
  indexedDbOutsideRingBytes = 0,
  tokenSummary,
}: {
  variant?: StoragePieVariant
  segments: StorageSegment[]
  estimateUsageBytes: number | null
  /** IndexedDB 环图下：未计入环的 localStorage 总字节 */
  localStorageOutsideRingBytes?: number
  /** localStorage 环图下：未计入环的 IndexedDB 总字节 */
  indexedDbOutsideRingBytes?: number
  /** 灵感累计（localStorage 计数，单独展示） */
  tokenSummary?: { count: number } | null
}) {
  const cx = 100
  const cy = 100
  const rMid = 46
  const strokeW = 18
  const C = 2 * Math.PI * rMid

  const ringSegs = useMemo(() => {
    const chartTotal = segments.reduce((a, s) => a + s.size, 0)
    const merged: StorageSegment[] = []
    const OTHER = 0.004 * (chartTotal || 1)
    let tiny = 0
    for (const s of segments) {
      if (s.size < OTHER && segments.length > 4) tiny += s.size
      else merged.push(s)
    }
    if (tiny > 0)
      merged.push({
        name: '其他（极小块已合并）',
        size: tiny,
        percentage: (tiny / (chartTotal || 1)) * 100,
      })
    const list = merged.length ? merged : [{ name: '（空）', size: 1, percentage: 100 }]
    const total = list.reduce((a, s) => a + s.size, 0) || 1
    let rot = -90
    const out: RingSeg[] = []
    list.forEach((s, i) => {
      const len = (s.size / total) * C
      out.push({
        color: sliceColor(i, list.length),
        len,
        rot,
        key: `${s.name}-${i}`,
      })
      rot += (len / C) * 360
    })
    return out
  }, [segments])

  const chartTotal = useMemo(() => segments.reduce((a, s) => a + s.size, 0), [segments])

  const centerUsed =
    estimateUsageBytes != null && estimateUsageBytes > 0 ? estimateUsageBytes : chartTotal

  const centerSubLine = useMemo(() => {
    const v = formatBytes(chartTotal)
    if (variant === 'localstorage') return `localStorage 分项合计 ${v}`
    if (variant === 'merged') return `合并分项合计 ${v}`
    return `IndexedDB 分项合计 ${v}`
  }, [chartTotal, variant])

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative mx-auto w-full max-w-[280px]">
        <svg viewBox="0 0 200 200" className="mx-auto w-full max-w-[260px]" aria-hidden>
          <circle
            cx={cx}
            cy={cy}
            r={rMid}
            fill="none"
            stroke="rgba(28,28,30,0.06)"
            strokeWidth={strokeW}
          />
          {ringSegs.map((seg, i) => (
            <motion.circle
              key={seg.key}
              cx={cx}
              cy={cy}
              r={rMid}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeW}
              strokeLinecap="butt"
              strokeDasharray={`${seg.len} ${C}`}
              transform={`rotate(${seg.rot} ${cx} ${cy})`}
              initial={{ strokeDashoffset: seg.len }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.88, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
        </svg>
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
          style={{ paddingTop: 4 }}
        >
          <p className="text-[9px] font-medium tracking-[0.08em]" style={{ color: PLATINUM.ash }}>
            估算已用
          </p>
          <p className="text-[15px] font-semibold tabular-nums" style={{ color: PLATINUM.ink }}>
            {formatBytes(centerUsed)}
          </p>
          <p className="text-[10px]" style={{ color: PLATINUM.ash }}>
            {centerSubLine}
          </p>
        </div>
      </div>

      {tokenSummary != null ? (
        <div
          className="mt-4 w-full max-w-[320px] rounded-xl border px-3 py-2.5"
          style={{ borderColor: PLATINUM.line, background: 'rgba(255,255,255,0.45)' }}
        >
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className="font-medium" style={{ color: PLATINUM.ink }}>
              灵感累计消耗
            </span>
            <span className="tabular-nums font-semibold" style={{ color: PLATINUM.gold }}>
              {formatWithCommas(tokenSummary.count)} tok
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed" style={{ color: PLATINUM.ash }}>
            键名 <span className="font-mono text-[9px]">lumi_sys_tokens_total</span>
            ，为累计调用次数；环图按<strong>存储字节</strong>占比，故 token 单独列出。
          </p>
        </div>
      ) : null}

      <ul className="mt-4 w-full max-w-[320px] space-y-2 px-1">
        {segments.slice(0, 10).map((s, i) => (
          <li key={`${s.name}-${i}`} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: sliceColor(Math.min(i, ringSegs.length - 1), Math.max(ringSegs.length, 1)) }}
              />
              <span className="truncate font-medium" style={{ color: PLATINUM.ink }}>
                {s.name}
              </span>
            </span>
            <span className="shrink-0 tabular-nums" style={{ color: PLATINUM.ash }}>
              {formatBytes(s.size)}
            </span>
          </li>
        ))}
        {segments.length > 10 ? (
          <li className="text-center text-[11px]" style={{ color: PLATINUM.ash }}>
            +{segments.length - 10} 项…
          </li>
        ) : null}
      </ul>

      {variant === 'indexeddb' && localStorageOutsideRingBytes > 0 ? (
        <p
          className="mt-3 max-w-[320px] px-2 text-center text-[10px] leading-relaxed"
          style={{ color: PLATINUM.ash }}
        >
          浏览器 <span className="font-mono">localStorage</span> 合计 {formatBytes(localStorageOutsideRingBytes)}
          <span className="block mt-0.5">（未计入上环）</span>
        </p>
      ) : null}

      {variant === 'localstorage' && indexedDbOutsideRingBytes > 0 ? (
        <p
          className="mt-3 max-w-[320px] px-2 text-center text-[10px] leading-relaxed"
          style={{ color: PLATINUM.ash }}
        >
          IndexedDB 已扫描侧合计 {formatBytes(indexedDbOutsideRingBytes)}
          <span className="block mt-0.5">（未计入上环，与「索引库」标签同源）</span>
        </p>
      ) : null}

      {variant === 'merged' ? (
        <p className="mt-3 max-w-[320px] px-2 text-center text-[10px] leading-relaxed" style={{ color: PLATINUM.ash }}>
          本标签为 IndexedDB 与 localStorage 字节估算合并占比。
        </p>
      ) : null}
    </div>
  )
}
