import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { mockWealthData, type StoryStock, type TimeDepositProduct } from './mockWealthData'
import { walletAddTransaction, walletAdjustBalance } from './walletMockStore'

type DepositHolding = {
  id: string
  productId: string
  principal: number
  apy: number
  buyAt: number
  expiresAt: number
  settled: boolean
}

type StockHolding = {
  stockId: string
  shares: number
  avgCost: number
}

type WealthState = {
  /** 首次生成理财数据的真实系统时间（用于图表起始日等） */
  createdWallMs: number
  vaultBalance: number
  vaultAccumulatedInterest: number
  /** @deprecated 仅兼容旧存档；活期计息以 lastVaultAccrualWallMs + 真实时间为准 */
  lastVaultAccrualAt: number
  /** 真实系统时间轴：上次活期按秒累计计息的时刻 */
  lastVaultAccrualWallMs: number
  /** 本地日历 YYYY-MM-DD，与 stockQuotes 对齐；跨日则触发股市重随机 */
  marketLocalDate: string
  stockQuotes: Record<string, number>
  /** 当日开盘参考（用于涨跌幅展示），换日时更新 */
  stockDayOpen: Record<string, number>
  /** 活期利息不足 1 分时累积，避免舍入丢零 */
  vaultAccrualDust: number
  deposits: DepositHolding[]
  stocks: StockHolding[]
}

type WealthContextValue = {
  state: WealthState
  stocksWithQuote: Array<StoryStock & { quote: number; quoteChangePct: number }>
  totalAssets: number
  yesterdayPnl: number
  availableDeposits: TimeDepositProduct[]
  currentTimeMs: number
  buyVault: (amount: number) => void
  redeemVault: (amount: number) => void
  buyDeposit: (productId: string, amount: number) => void
  settleMaturedDeposits: () => number
  buyStockByAmount: (stockId: string, amount: number) => void
  sellStockByAmount: (stockId: string, amount: number) => void
  getHoldingByStockId: (stockId: string) => StockHolding | null
}

const STORAGE_KEY = 'wechat-wealth-state-v1'

function localDateKey(wallMs: number): string {
  const d = new Date(wallMs)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function initialStockMaps() {
  const stockQuotes: Record<string, number> = {}
  const stockDayOpen: Record<string, number> = {}
  for (const s of mockWealthData.stocks) {
    stockQuotes[s.id] = s.price
    stockDayOpen[s.id] = s.price
  }
  return { stockQuotes, stockDayOpen }
}

function readState(nowMs: number): WealthState {
  const wall = typeof window !== 'undefined' ? Date.now() : nowMs
  const { stockQuotes: sq0, stockDayOpen: so0 } = initialStockMaps()
  const fallback: WealthState = {
    createdWallMs: wall,
    vaultBalance: 120000,
    vaultAccumulatedInterest: 0,
    lastVaultAccrualAt: nowMs,
    lastVaultAccrualWallMs: wall,
    marketLocalDate: localDateKey(wall),
    stockQuotes: sq0,
    stockDayOpen: so0,
    vaultAccrualDust: 0,
    deposits: [],
    stocks: [],
  }
  if (typeof window === 'undefined') return applyWallClock(fallback, wall)
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return applyWallClock(fallback, wall)
    const parsed = JSON.parse(raw) as Partial<WealthState>
    const merged: WealthState = {
      ...fallback,
      ...parsed,
      deposits: Array.isArray(parsed.deposits) ? parsed.deposits : [],
      stocks: Array.isArray(parsed.stocks) ? parsed.stocks : [],
      createdWallMs: typeof parsed.createdWallMs === 'number' ? parsed.createdWallMs : wall,
      lastVaultAccrualWallMs: typeof parsed.lastVaultAccrualWallMs === 'number' ? parsed.lastVaultAccrualWallMs : wall,
      marketLocalDate: typeof parsed.marketLocalDate === 'string' ? parsed.marketLocalDate : localDateKey(wall),
      stockQuotes:
        parsed.stockQuotes && typeof parsed.stockQuotes === 'object' ? { ...sq0, ...parsed.stockQuotes } : { ...sq0 },
      stockDayOpen:
        parsed.stockDayOpen && typeof parsed.stockDayOpen === 'object' ? { ...so0, ...parsed.stockDayOpen } : { ...so0 },
      vaultAccrualDust: typeof parsed.vaultAccrualDust === 'number' ? parsed.vaultAccrualDust : 0,
    }
    return applyWallClock(merged, wall)
  } catch {
    return applyWallClock(fallback, wall)
  }
}

function writeState(next: WealthState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

function pseudo(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

/** 活期：按真实时间连续计息，APY 3%（与页面文案一致）；dust 保留分以下尾数 */
function accrueVaultWall(state: WealthState, wallNow: number): WealthState {
  const last = state.lastVaultAccrualWallMs
  const elapsed = Math.max(0, wallNow - last)
  if (elapsed < 1000) return state

  const yearMs = 365 * 24 * 60 * 60 * 1000

  if (state.vaultBalance <= 0) {
    return { ...state, lastVaultAccrualWallMs: wallNow, vaultAccrualDust: 0 }
  }

  const apy = 0.03
  const gainRaw = state.vaultBalance * apy * (elapsed / yearMs)
  const total = gainRaw + (state.vaultAccrualDust ?? 0)
  const add = Math.round(total * 100) / 100
  const dust = Math.max(0, total - add)

  return {
    ...state,
    vaultBalance: Math.round((state.vaultBalance + add) * 100) / 100,
    vaultAccumulatedInterest: Math.round((state.vaultAccumulatedInterest + add) * 100) / 100,
    vaultAccrualDust: dust,
    lastVaultAccrualWallMs: wallNow,
  }
}

/** 本地日历跨日：每支股票在昨收基础上随机涨跌（约 ±12%，可重复种子稳定） */
function rollMarketIfNewDay(state: WealthState, wallMs: number): WealthState {
  const dayKey = localDateKey(wallMs)
  if (!state.marketLocalDate) {
    const { stockQuotes, stockDayOpen } = initialStockMaps()
    return { ...state, marketLocalDate: dayKey, stockQuotes, stockDayOpen }
  }
  if (state.marketLocalDate === dayKey) return state

  const nextOpen: Record<string, number> = { ...state.stockDayOpen }
  const nextQuotes: Record<string, number> = { ...state.stockQuotes }
  for (const s of mockWealthData.stocks) {
    const prevClose = state.stockQuotes[s.id] ?? s.price
    nextOpen[s.id] = prevClose
    const mult = 0.88 + pseudo(`${dayKey}-${s.id}-droll`) * 0.24
    nextQuotes[s.id] = Math.max(0.01, Math.round(prevClose * mult * 100) / 100)
  }
  return {
    ...state,
    marketLocalDate: dayKey,
    stockQuotes: nextQuotes,
    stockDayOpen: nextOpen,
  }
}

function applyWallClock(state: WealthState, wallMs: number): WealthState {
  let next = rollMarketIfNewDay(state, wallMs)
  next = accrueVaultWall(next, wallMs)
  return next
}

const WealthContext = createContext<WealthContextValue | null>(null)

export function WealthProvider({
  currentTimeMs,
  children,
}: {
  currentTimeMs: number
  children: React.ReactNode
}) {
  const [state, setState] = useState<WealthState>(() => readState(currentTimeMs))

  /** 真实系统时间：活期连续计息 + 本地跨日随机股价（不依赖 API） */
  useEffect(() => {
    const tick = () => {
      setState((prev) => {
        const n = applyWallClock(prev, Date.now())
        if (n !== prev) writeState(n)
        return n
      })
    }
    tick()
    const id = window.setInterval(tick, 2000)
    return () => window.clearInterval(id)
  }, [])

  const stocksWithQuote = useMemo(() => {
    return mockWealthData.stocks.map((s) => {
      const quote = state.stockQuotes[s.id] ?? s.price
      const open = state.stockDayOpen[s.id] ?? quote
      const rawPct = open > 0 ? (quote / open - 1) * 100 : 0
      const quoteChangePct = Math.round(rawPct * 10) / 10
      return { ...s, quote, quoteChangePct }
    })
  }, [state.stockQuotes, state.stockDayOpen])

  const stockAssets = useMemo(() => {
    return state.stocks.reduce((sum, h) => {
      const q = stocksWithQuote.find((s) => s.id === h.stockId)?.quote ?? 0
      return sum + q * h.shares
    }, 0)
  }, [state.stocks, stocksWithQuote])

  const depositAssets = useMemo(() => {
    return state.deposits.filter((d) => !d.settled).reduce((sum, d) => sum + d.principal, 0)
  }, [state.deposits])

  const totalAssets = Math.round((state.vaultBalance + depositAssets + stockAssets) * 100) / 100

  /** 近似「昨日/当日」展示：活期按日息 + 持仓相对今日开盘价的浮动 */
  const yesterdayPnl = useMemo(() => {
    const vaultDaily = state.vaultBalance * (0.03 / 365)
    const stockDayPnl = state.stocks.reduce((sum, h) => {
      const row = stocksWithQuote.find((s) => s.id === h.stockId)
      if (!row) return sum
      const open = state.stockDayOpen[h.stockId] ?? row.quote
      return sum + (row.quote - open) * h.shares
    }, 0)
    return Math.round((vaultDaily + stockDayPnl) * 100) / 100
  }, [state.stocks, state.vaultBalance, stocksWithQuote, state.stockDayOpen])

  const update = (fn: (prev: WealthState) => WealthState) => {
    setState((prev) => {
      const next = fn(prev)
      writeState(next)
      return next
    })
  }

  const buyVault = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    update((prev) => {
      const a = applyWallClock(prev, Date.now())
      return { ...a, vaultBalance: Math.round((a.vaultBalance + amount) * 100) / 100 }
    })
    walletAdjustBalance(-amount)
    walletAddTransaction({ type: 'spend', title: 'Lumi活期买入', amount: -amount })
  }

  const redeemVault = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    update((prev) => {
      const a = applyWallClock(prev, Date.now())
      if (a.vaultBalance < amount) return a
      return { ...a, vaultBalance: Math.round((a.vaultBalance - amount) * 100) / 100 }
    })
    walletAdjustBalance(amount)
    walletAddTransaction({ type: 'topup', title: 'Lumi活期赎回', amount })
  }

  const buyDeposit = (productId: string, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    const product = mockWealthData.deposits.find((d) => d.id === productId)
    if (!product) return
    const expiresAt = currentTimeMs + product.lockDays * 24 * 60 * 60 * 1000
    update((prev) => {
      const a = applyWallClock(prev, Date.now())
      return {
        ...a,
        deposits: [
          {
            id: `dep-h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            productId,
            principal: Math.round(amount * 100) / 100,
            apy: product.apy,
            buyAt: currentTimeMs,
            expiresAt,
            settled: false,
          },
          ...a.deposits,
        ],
      }
    })
    walletAdjustBalance(-amount)
    walletAddTransaction({ type: 'spend', title: `${product.name}买入`, amount: -amount })
  }

  const settleMaturedDeposits = () => {
    let paid = 0
    update((prev) => {
      const a = applyWallClock(prev, Date.now())
      const next = a.deposits.map((d) => {
        if (d.settled || d.expiresAt > currentTimeMs) return d
        const years = Math.max(0, (d.expiresAt - d.buyAt) / (365 * 24 * 60 * 60 * 1000))
        const interest = d.principal * (d.apy / 100) * years
        paid += d.principal + interest
        return { ...d, settled: true }
      })
      return { ...a, deposits: next }
    })
    if (paid > 0) {
      const amt = Math.round(paid * 100) / 100
      walletAdjustBalance(amt)
      walletAddTransaction({ type: 'topup', title: '定期契约到期返还', amount: amt })
    }
    return Math.round(paid * 100) / 100
  }

  const buyStockByAmount = (stockId: string, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    const qPreview = stocksWithQuote.find((s) => s.id === stockId)?.quote
    if (!qPreview || qPreview <= 0) return
    update((prev) => {
      const a = applyWallClock(prev, Date.now())
      const base = mockWealthData.stocks.find((s) => s.id === stockId)
      const q = a.stockQuotes[stockId] ?? base?.price ?? 0
      if (!q || q <= 0) return a
      const shares = amount / q
      const idx = a.stocks.findIndex((s) => s.stockId === stockId)
      if (idx < 0) {
        return {
          ...a,
          stocks: [{ stockId, shares, avgCost: q }, ...a.stocks],
        }
      }
      const row = a.stocks[idx]
      const totalShares = row.shares + shares
      const avgCost = (row.shares * row.avgCost + shares * q) / totalShares
      const next = [...a.stocks]
      next[idx] = { ...row, shares: totalShares, avgCost }
      return { ...a, stocks: next }
    })
    walletAdjustBalance(-amount)
    const name = mockWealthData.stocks.find((s) => s.id === stockId)?.companyName ?? '股票'
    walletAddTransaction({ type: 'spend', title: `买入 ${name}`, amount: -amount })
  }

  const sellStockByAmount = (stockId: string, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    const qPreview = stocksWithQuote.find((s) => s.id === stockId)?.quote
    if (!qPreview || qPreview <= 0) return
    let cashIn = 0
    update((prev) => {
      const a = applyWallClock(prev, Date.now())
      const base = mockWealthData.stocks.find((s) => s.id === stockId)
      const q = a.stockQuotes[stockId] ?? base?.price ?? 0
      if (!q || q <= 0) return a
      const idx = a.stocks.findIndex((s) => s.stockId === stockId)
      if (idx < 0) return a
      const row = a.stocks[idx]
      const sharesToSell = Math.min(row.shares, amount / q)
      if (sharesToSell <= 0) return a
      cashIn = sharesToSell * q
      const left = row.shares - sharesToSell
      const next = [...a.stocks]
      if (left <= 1e-6) next.splice(idx, 1)
      else next[idx] = { ...row, shares: left }
      return { ...a, stocks: next }
    })
    if (cashIn > 0) {
      const amt = Math.round(cashIn * 100) / 100
      walletAdjustBalance(amt)
      const name = mockWealthData.stocks.find((s) => s.id === stockId)?.companyName ?? '股票'
      walletAddTransaction({ type: 'topup', title: `卖出 ${name}`, amount: amt })
    }
  }

  const getHoldingByStockId = (stockId: string) => state.stocks.find((s) => s.stockId === stockId) ?? null

  const value: WealthContextValue = {
    state,
    stocksWithQuote,
    totalAssets,
    yesterdayPnl,
    availableDeposits: mockWealthData.deposits,
    currentTimeMs,
    buyVault,
    redeemVault,
    buyDeposit,
    settleMaturedDeposits,
    buyStockByAmount,
    sellStockByAmount,
    getHoldingByStockId,
  }

  return <WealthContext.Provider value={value}>{children}</WealthContext.Provider>
}

export function useWealth() {
  const ctx = useContext(WealthContext)
  if (!ctx) throw new Error('useWealth must be used within WealthProvider')
  return ctx
}

