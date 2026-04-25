import { motion } from 'framer-motion'

import { Pressable } from '../../../components/Pressable'

function formatMoney(v: number) {
  return `¥ ${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export type DepositBreakdownItem = {
  id: string
  name: string
  principal: number
  apyPct: number
  buyAtMs: number
  expiresAtMs: number
  nowMs: number
}

export type StockBreakdownItem = {
  id: string
  name: string
  pnl: number
}

export function AssetBreakdown({
  vaultBalance,
  vaultApyPct = 3.0,
  deposits,
  stocks,
  onOpenDeposits,
  onOpenMarket,
}: {
  vaultBalance: number
  vaultApyPct?: number
  deposits: DepositBreakdownItem[]
  stocks: StockBreakdownItem[]
  onOpenDeposits?: () => void
  onOpenMarket?: () => void
}) {
  const vaultDaily = (vaultBalance * (vaultApyPct / 100)) / 365
  const stockPnl = stocks.reduce((s, r) => s + r.pnl, 0)

  const soonest = deposits
    .slice()
    .sort((a, b) => a.expiresAtMs - b.expiresAtMs)[0]

  const depRemainMs = soonest ? Math.max(0, soonest.expiresAtMs - soonest.nowMs) : 0
  const depTotalMs = soonest ? Math.max(1, soonest.expiresAtMs - soonest.buyAtMs) : 1
  const depProgress = soonest ? clamp(1 - depRemainMs / depTotalMs, 0, 1) : 0
  const depRemainDays = soonest ? Math.ceil(depRemainMs / (24 * 60 * 60 * 1000)) : 0

  return (
    <section className="mt-4 rounded-[26px] border border-white/60 bg-white/35 px-5 py-5 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-gray-500">资产构成 · <span className="text-gray-400">ASSET BREAKDOWN</span></p>
          <p className="mt-1 text-[13px] text-gray-600">钱都在哪里、每天怎么涨，一眼看懂。</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {/* vault */}
        <div className="rounded-[20px] border border-white/70 bg-white/50 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-black">活期存入 <span className="ml-1 text-[11px] font-normal text-gray-400">VAULT</span></p>
              <p className="mt-1 text-[12px] text-gray-600">余额 {formatMoney(vaultBalance)} · 年化 {vaultApyPct.toFixed(1)}%</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-gray-500">每日利息</p>
              <p className="mt-0.5 text-[14px] font-semibold text-black">+ {formatMoney(vaultDaily)}</p>
            </div>
          </div>
        </div>

        {/* deposits */}
        <div className="rounded-[20px] border border-white/70 bg-white/50 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-black">定期契约 <span className="ml-1 text-[11px] font-normal text-gray-400">FIXED</span></p>
              <p className="mt-1 text-[12px] text-gray-600">
                {deposits.length === 0
                  ? '暂无持仓 · 选一份锁定期换更高年化'
                  : `持仓 ${deposits.length} 笔 · 最近一笔 ${depRemainDays} 天后到期`}
              </p>
            </div>
            <Pressable
              type="button"
              onClick={onOpenDeposits}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white/70 px-3 text-[11px] text-gray-700"
            >
              查看
            </Pressable>
          </div>
          {deposits.length > 0 ? (
            <div className="mt-3">
              <div className="h-2.5 overflow-hidden rounded-full bg-black/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(depProgress * 100)}%` }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-[#b69457]"
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                <span>锁定进度</span>
                <span>{Math.round(depProgress * 100)}%</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* stocks */}
        <div className="rounded-[20px] border border-white/70 bg-white/50 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-black">股票持仓 <span className="ml-1 text-[11px] font-normal text-gray-400">STOCKS</span></p>
              <p className="mt-1 text-[12px] text-gray-600">
                {stocks.length === 0 ? '暂无持仓 · 试试用小额体验涨跌' : `持仓 ${stocks.length} 支 · 今日浮动 ${stockPnl >= 0 ? '+' : '-'}${formatMoney(Math.abs(stockPnl))}`}
              </p>
            </div>
            <Pressable
              type="button"
              onClick={onOpenMarket}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white/70 px-3 text-[11px] text-gray-700"
            >
              去看盘
            </Pressable>
          </div>

          {stocks.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {stocks.slice(0, 3).map((s) => {
                const positive = s.pnl >= 0
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-white/70 bg-white/55 px-3 py-2">
                    <p className="min-w-0 truncate text-[12px] text-gray-700">{s.name}</p>
                    <p className={`shrink-0 text-[12px] font-semibold ${positive ? 'text-[#b69457]' : 'text-gray-500'}`}>
                      {positive ? '+' : '-'} {formatMoney(Math.abs(s.pnl))}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

