import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { AssetChart, type AssetChartPoint } from './AssetChart'

function formatMoney(v: number) {
  return `¥ ${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pseudo(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

function hhmm(ms: number) {
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function mmdd(ms: number) {
  const d = new Date(ms)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

function buildIntradaySeries({
  stockId,
  quoteNow,
  wallNow,
}: {
  stockId: string
  quoteNow: number
  wallNow: number
}): AssetChartPoint[] {
  const d0 = new Date(wallNow)
  d0.setHours(9, 30, 0, 0)
  const start = d0.getTime()
  const points = 10
  const step = Math.max(1, Math.floor((wallNow - start) / (points - 1)))
  const out: AssetChartPoint[] = []

  // 让最后一个点严格等于 quoteNow；前面用小扰动形成可读走势
  let v = quoteNow
  for (let i = points - 2; i >= 0; i -= 1) {
    const t = start + i * step
    const rnd = pseudo(`intraday-${stockId}-${mmdd(t)}-${i}`)
    const pct = (rnd - 0.5) * 0.007
    v = Math.max(0.01, Math.round((v / (1 + pct)) * 100) / 100)
    out[i] = {
      labelZh: i % 3 === 0 ? hhmm(t) : '',
      labelEn: undefined,
      dateText: hhmm(t),
      value: v,
    }
  }
  const lastT = start + (points - 1) * step
  out[points - 1] = { labelZh: '现在', labelEn: 'NOW', dateText: hhmm(Math.max(lastT, wallNow)), value: Math.round(quoteNow * 100) / 100 }
  return out
}

function build7dSeries({
  stockId,
  quoteNow,
  wallNow,
}: {
  stockId: string
  quoteNow: number
  wallNow: number
}): AssetChartPoint[] {
  const dayMs = 24 * 60 * 60 * 1000
  const nowDay = new Date(wallNow)
  nowDay.setHours(0, 0, 0, 0)
  const out: AssetChartPoint[] = []

  // 用日期种子生成每天的倍率；最后一天等于 quoteNow，前面回推
  const mults: number[] = []
  for (let i = 0; i < 7; i += 1) {
    const t = nowDay.getTime() - (6 - i) * dayMs
    const rnd = pseudo(`d7-${stockId}-${mmdd(t)}`)
    const perDay = 0.985 + rnd * 0.03 // [0.985, 1.015]
    mults.push(perDay)
  }

  const vals: number[] = Array(7).fill(quoteNow)
  for (let i = 5; i >= 0; i -= 1) {
    vals[i] = Math.max(0.01, Math.round((vals[i + 1]! / mults[i + 1]!) * 100) / 100)
  }

  for (let i = 0; i < 7; i += 1) {
    const t = nowDay.getTime() - (6 - i) * dayMs
    out.push({
      labelZh: i === 6 ? '今日' : mmdd(t),
      labelEn: i === 6 ? 'TODAY' : undefined,
      dateText: mmdd(t),
      value: vals[i]!,
    })
  }
  return out
}

export function StockDetailSheet({
  open,
  onClose,
  stock,
  wallNow,
}: {
  open: boolean
  onClose: () => void
  stock: { id: string; code: string; companyName: string; quote: number; quoteChangePct: number } | null
  wallNow: number
}) {
  const [range, setRange] = useState<'day' | '7d'>('day')

  const series = useMemo(() => {
    if (!stock) return []
    return range === 'day'
      ? buildIntradaySeries({ stockId: stock.id, quoteNow: stock.quote, wallNow })
      : build7dSeries({ stockId: stock.id, quoteNow: stock.quote, wallNow })
  }, [range, stock, wallNow])

  const tone = useMemo(() => {
    const first = series[0]?.value ?? 0
    const last = series[series.length - 1]?.value ?? first
    return last - first >= 0.01 ? 'positive' : 'neutral'
  }, [series])

  return (
    <AnimatePresence>
      {open && stock ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[155] flex flex-col justify-end bg-black/35">
          <Pressable type="button" className="min-h-0 flex-1" onClick={onClose} aria-label="关闭股票详情">
            <span className="sr-only">关闭</span>
          </Pressable>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-h-[86vh] overflow-y-auto rounded-t-[30px] border-t border-white/60 bg-white/70 px-5 pb-[max(18px,env(safe-area-inset-bottom,0px))] pt-0 backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]"
          >
            <div
              className="sticky top-0 z-[1] -mx-5 border-b border-white/60 bg-white/75 px-5 backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]"
              style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))', paddingBottom: 12 }}
            >
              <p className="text-center text-[11px] tracking-[0.26em] text-gray-500">
                股市详情 <span className="ml-2 text-gray-400">MARKET DETAIL</span>
              </p>
              <h3 className="mt-2 text-center text-[20px] font-semibold text-black">{stock.companyName}</h3>
              <p className="mt-1 text-center text-[12px] text-gray-500">
                {stock.code} · 现价 {formatMoney(stock.quote)} · {stock.quoteChangePct >= 0 ? '↑' : '↓'} {Math.abs(stock.quoteChangePct).toFixed(1)}%
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <Pressable
                  type="button"
                  onClick={() => setRange('day')}
                  className={`rounded-full border px-3 py-1.5 text-[11px] ${range === 'day' ? 'border-black bg-black text-white' : 'border-gray-300 bg-white/70 text-gray-700'}`}
                >
                  今日
                </Pressable>
                <Pressable
                  type="button"
                  onClick={() => setRange('7d')}
                  className={`rounded-full border px-3 py-1.5 text-[11px] ${range === '7d' ? 'border-black bg-black text-white' : 'border-gray-300 bg-white/70 text-gray-700'}`}
                >
                  近7日
                </Pressable>
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-white/60 bg-white/45 px-4 py-4 backdrop-blur-[12px] [-webkit-backdrop-filter:blur(12px)]">
              <p className="text-[11px] tracking-[0.2em] text-gray-500">
                时段涨幅 · <span className="text-gray-400">PERIOD CHANGE</span>
              </p>
              <div className="mt-3">
                <AssetChart series={series} tone={tone} className="h-[190px] w-full" />
              </div>
              <p className="mt-2 text-[12px] text-gray-500">提示：按住曲线滑动查看任意时间点的具体价格。</p>
            </div>

            <div className="mt-4 flex justify-center">
              <Pressable type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-full border border-black bg-black px-6 text-[13px] font-medium text-white">
                关闭
              </Pressable>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

