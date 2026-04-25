import { ChevronLeft, BookOpenText, ReceiptText } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { useWeChatCurrentTime } from '../time/useWeChatCurrentTime'
import { AssetBreakdown } from './AssetBreakdown'
import { AssetChart, type AssetChartPoint } from './AssetChart'
import { InvestmentSheet } from './InvestmentSheet'
import { type WealthTabId } from './mockWealthData'
import { WealthProvider, useWealth } from './WealthContext'
import { WealthTutorial, type WealthTutorialPick } from './WealthTutorial'
import { walletReadSnapshot } from './walletMockStore'
import { StockDetailSheet } from './StockDetailSheet'

import walletBg from '../../../../../image/钱包页背景图.png'

function formatCurrency(v: number) {
  return `¥ ${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const WEALTH_DEV_MODE_KEY = 'wechat-wealth-dev-mode'
const WEALTH_DEV_WALL_OFFSET_KEY = 'wechat-wealth-dev-wall-offset-days'

function miniSpark(values: number[]) {
  if (values.length < 2) return ''
  const w = 92
  const h = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)
  const step = w / (values.length - 1)
  return values
    .map((v, i) => {
      const x = i * step
      const y = h - ((v - min) / range) * h
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function formatMmDd(wallMs: number) {
  const d = new Date(wallMs)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

function formatMmDdHms(wallMs: number) {
  const d = new Date(wallMs)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}:${ss}`
}

function settleStampAt1500(wallMs: number) {
  const d = new Date(wallMs)
  const today1500 = new Date(d)
  today1500.setHours(15, 0, 0, 0)
  if (d.getTime() >= today1500.getTime()) return today1500.getTime()
  return today1500.getTime() - 24 * 60 * 60 * 1000
}

function buildSeriesFromStart(totalAssets: number, startWallMs: number, wallNow = Date.now()): AssetChartPoint[] {
  const dayMs = 24 * 60 * 60 * 1000
  const startDay = new Date(startWallMs)
  startDay.setHours(0, 0, 0, 0)
  const nowDay = new Date(wallNow)
  nowDay.setHours(0, 0, 0, 0)
  const maxDays = 7
  const totalDays = Math.max(1, Math.floor((nowDay.getTime() - startDay.getTime()) / dayMs) + 1)
  const take = Math.min(maxDays, totalDays)
  const out: AssetChartPoint[] = []
  const base = Math.max(100, totalAssets)

  // 只在“已存在的数据天数范围内”生成轻微波动；若仅 1 天，则不制造莫名的历史涨跌
  const deltas: number[] = []
  let acc = 0
  for (let i = 0; i < take - 1; i += 1) {
    const seed = (Math.sin(((nowDay.getTime() - (take - 1 - i) * dayMs) / dayMs) * 1.9) + 1) / 2
    const pct = (seed - 0.5) * 0.012
    const d = Math.round(base * pct * 100) / 100
    acc += d
    deltas.push(acc)
  }
  const firstVal = take <= 1 ? Math.round(totalAssets * 100) / 100 : Math.round((base - acc) * 100) / 100

  for (let i = 0; i < take; i += 1) {
    const dateMs = nowDay.getTime() - (take - 1 - i) * dayMs
    const value = i === take - 1 ? Math.round(totalAssets * 100) / 100 : Math.round((firstVal + (deltas[i] ?? 0)) * 100) / 100
    out.push({
      labelZh: i === take - 1 ? '今日' : formatMmDd(dateMs),
      labelEn: i === take - 1 ? 'TODAY' : undefined,
      dateText: formatMmDd(dateMs),
      value,
    })
  }

  // 保障至少 2 个点，避免只有 1 天时画不出线
  if (out.length === 1) {
    out.unshift({ ...out[0]!, labelZh: out[0]!.dateText, labelEn: undefined })
  }
  return out
}

function pseudo(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

function buildStockSparkline(stockId: string, quoteNow: number, wallNow: number, points = 8) {
  const out: number[] = []
  let v = quoteNow
  for (let i = points - 1; i >= 0; i -= 1) {
    const rnd = pseudo(`spark-${stockId}-${formatMmDd(wallNow)}-${i}`)
    const pct = (rnd - 0.5) * 0.02
    v = Math.max(0.01, Math.round((v / (1 + pct)) * 100) / 100)
    out[i] = v
  }
  out[points - 1] = Math.round(quoteNow * 100) / 100
  return out
}
type SheetIntent =
  | { kind: 'vault'; name: string; hint: string }
  | { kind: 'deposit'; id: string; name: string; hint: string }
  | { kind: 'stock'; id: string; name: string; hint: string }

type TutorialPhase = 'hub' | { track: WealthTutorialPick; step: number }

const WEALTH_TUTORIAL_SEEN_KEY = 'wechat-wealth-tutorial-seen-v2'

const TUTORIAL_LAST_STEP = 6

const COPY: Record<WealthTutorialPick, Record<number, { title: string; text: string }>> = {
  vault: {
    1: {
      title: '活期 · 总资产',
      text: "这里汇总你名下活期、定期和股票。Yesterday's P&L 反映昨日整体涨跌，金色为赚、灰色为亏。",
    },
    2: {
      title: '活期 · 切到小金库',
      text: '点「活期小金库」查看随存随取的余额池，利息按日结算。',
    },
    3: {
      title: '活期 · 转入',
      text: '点「转入」输入金额，把零钱放进活期；需要用时再取出。下一步将体验签约流程。',
    },
    4: {
      title: '活期 · 签约',
      text: '活期也是一份小契约，确认金额后完成签署即可入账。',
    },
    5: {
      title: '活期 · 持仓汇总',
      text: '下方持仓明细会显示活期余额与笔数。之后可随时在「取出」里赎回。',
    },
    6: {
      title: '活期 · 回看教程',
      text: '右上角书本图标随时可点开，重新选择活期 / 定期 / 股市教程。',
    },
  },
  deposit: {
    1: {
      title: '定期 · 总资产',
      text: '总资产同样包含锁定中的定期。定期适合中期闲置资金，提前赎回一般不可行。',
    },
    2: {
      title: '定期 · 切到契约',
      text: '点「定期契约」浏览不同锁定期与年化，选一款适合自己的产品。',
    },
    3: {
      title: '定期 · 签署契约',
      text: '点「签署契约」输入买入金额。锁定期内资金冻结，到期本息按规则结算。',
    },
    4: {
      title: '定期 · 签约',
      text: '确认金额后完成签署，契约生效并开始计息。',
    },
    5: {
      title: '定期 · 持仓汇总',
      text: '持仓明细里的「定期 X 笔」会随你买入增加；到期后记得查看结算。',
    },
    6: {
      title: '定期 · 回看教程',
      text: '想重温步骤时点右上角教程图标，可再选定期或其他玩法。',
    },
  },
  market: {
    1: {
      title: '股市 · 看大盘',
      text: "这里是你所有的钱。Yesterday's P&L 代表你昨天是赚了还是亏了。金色代表赚，灰色代表亏。",
    },
    2: {
      title: '股市 · 入股怎么看',
      text: '点击一支股票。Price 是当前买入价格。曲线往上走，说明最近在涨。理财核心是低买高卖。',
    },
    3: {
      title: '股市 · 如何投资',
      text: '点击买入，输入你想投入的金额。记住，投资有风险，不要一次性花光所有余额。',
    },
    4: {
      title: '股市 · 签约仪式',
      text: '理财是一份契约，我们要有仪式感地签下它。',
    },
    5: {
      title: '股市 · 查看收益',
      text: '买完后在这里看你赚了多少。盈亏会随时间跳动。点击卖出即可落袋为安。',
    },
    6: {
      title: '股市 · 随时回看教程',
      text: '右上角的教程图标随时可点，想重温步骤时打开这里即可。',
    },
  },
}

function WealthDashboardInner({ onBack }: { onBack: () => void }) {
  const {
    totalAssets,
    yesterdayPnl,
    stocksWithQuote,
    availableDeposits,
    currentTimeMs,
    state,
    buyVault,
    redeemVault,
    buyDeposit,
    buyStockByAmount,
    sellStockByAmount,
    getHoldingByStockId,
    settleMaturedDeposits,
  } = useWealth()
  const [tab, setTab] = useState<WealthTabId>('vault')
  const [displayAssets, setDisplayAssets] = useState(0)
  const [displayPnl, setDisplayPnl] = useState(0)
  const [sheet, setSheet] = useState<SheetIntent | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(() => {
    try {
      const seen = window.localStorage.getItem(WEALTH_TUTORIAL_SEEN_KEY)
      if (!seen) {
        window.localStorage.setItem(WEALTH_TUTORIAL_SEEN_KEY, '1')
        return true
      }
      return false
    } catch {
      return true
    }
  })
  const [tutorialPhase, setTutorialPhase] = useState<TutorialPhase>('hub')
  const tutorialPhaseRef = useRef<TutorialPhase>('hub')
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [moneyPulse, setMoneyPulse] = useState(0)
  const [wallNow, setWallNow] = useState(() => Date.now())
  const [devMode, setDevMode] = useState(() => {
    try {
      return window.localStorage.getItem(WEALTH_DEV_MODE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [devWallOffsetDays, setDevWallOffsetDays] = useState(() => {
    try {
      const raw = window.localStorage.getItem(WEALTH_DEV_WALL_OFFSET_KEY)
      const n = raw ? parseInt(raw, 10) : 0
      return Number.isFinite(n) ? n : 0
    } catch {
      return 0
    }
  })

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const overviewRef = useRef<HTMLDivElement | null>(null)
  const vaultTabRef = useRef<HTMLDivElement | null>(null)
  const depositTabRef = useRef<HTMLDivElement | null>(null)
  const marketTabRef = useRef<HTMLDivElement | null>(null)
  const vaultSectionRef = useRef<HTMLElement | null>(null)
  const vaultTransferRef = useRef<HTMLDivElement | null>(null)
  const depositFirstCardRef = useRef<HTMLDivElement | null>(null)
  const stockListRef = useRef<HTMLDivElement | null>(null)
  const firstBuyRef = useRef<HTMLDivElement | null>(null)
  const holdingRef = useRef<HTMLDivElement | null>(null)
  const sheetPanelRef = useRef<HTMLDivElement | null>(null)
  const sheetConfirmRef = useRef<HTMLButtonElement | null>(null)
  const tutorialButtonRef = useRef<HTMLDivElement | null>(null)
  const [highlightTargetEl, setHighlightTargetEl] = useState<HTMLElement | null>(null)
  const [stockDetailId, setStockDetailId] = useState<string | null>(null)
  const [pendingSell, setPendingSell] = useState<{
    stockId: string
    stockName: string
    amount: number
    pnl: number
  } | null>(null)

  useEffect(() => {
    const duration = 1050
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplayAssets(totalAssets * eased)
      setDisplayPnl(yesterdayPnl * eased)
      if (p < 1) raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [totalAssets, yesterdayPnl])

  // “钱在跳动”的轻微获得感：只影响展示，不改变真实资产
  useEffect(() => {
    const id = window.setInterval(() => setMoneyPulse((x) => x + 1), 2600)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setWallNow(Date.now()), 2000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    tutorialPhaseRef.current = tutorialPhase
  }, [tutorialPhase])

  const getHighlightEl = (phase: TutorialPhase): HTMLElement | null => {
    if (phase === 'hub') return null
    const { track, step } = phase
    if (track === 'vault') {
      if (step === 1) return overviewRef.current
      if (step === 2) return vaultTabRef.current
      if (step === 3) return vaultTransferRef.current ?? vaultSectionRef.current
      if (step === 4) return sheetConfirmRef.current ?? sheetPanelRef.current
      if (step === 5) return holdingRef.current
      return tutorialButtonRef.current
    }
    if (track === 'deposit') {
      if (step === 1) return overviewRef.current
      if (step === 2) return depositTabRef.current
      if (step === 3) return depositFirstCardRef.current
      if (step === 4) return sheetConfirmRef.current ?? sheetPanelRef.current
      if (step === 5) return holdingRef.current
      return tutorialButtonRef.current
    }
    if (step === 1) return overviewRef.current
    if (step === 2) return stockListRef.current
    if (step === 3) return firstBuyRef.current
    if (step === 4) return sheetConfirmRef.current ?? sheetPanelRef.current
    if (step === 5) return holdingRef.current
    return tutorialButtonRef.current
  }

  const scheduleHighlightUpdate = (phase: TutorialPhase) => {
    if (!tutorialOpen || phase === 'hub') {
      setHighlightTargetEl(null)
      return
    }
    let tries = 0
    let timer: number | null = null
    const run = () => {
      const el = getHighlightEl(phase)
      if (el) {
        setHighlightTargetEl(el)
        return
      }
      tries += 1
      if (tries <= 8) timer = window.setTimeout(run, 80)
    }
    window.requestAnimationFrame(run)
    return () => {
      if (timer) window.clearTimeout(timer)
    }
  }

  const displayTab = useMemo(() => {
    if (!tutorialOpen || tutorialPhase === 'hub') return tab
    const { track, step } = tutorialPhase
    if (track === 'vault' && step >= 2 && step <= 5) return 'vault'
    if (track === 'deposit' && step >= 2 && step <= 5) return 'deposits'
    if (track === 'market' && (step === 2 || step === 3 || step === 5)) return 'market'
    return tab
  }, [tab, tutorialOpen, tutorialPhase])

  useEffect(() => {
    if (!tutorialOpen || tutorialPhase === 'hub') return
    const p = tutorialPhaseRef.current
    const signing =
      p !== 'hub' && p.step === 4 && !!sheet
    if (signing) return
    let tries = 0
    let timer: number | null = null
    const run = () => {
      const target = getHighlightEl(tutorialPhaseRef.current)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
        return
      }
      tries += 1
      if (tries <= 8) timer = window.setTimeout(run, 80)
    }
    window.requestAnimationFrame(run)
    return () => {
      if (timer) window.clearTimeout(timer)
    }
  }, [tutorialOpen, tutorialPhase, sheet])

  const tabs: { id: WealthTabId; zh: string; en: string }[] = [
    { id: 'vault', zh: '活期小金库', en: 'Lumi Vault' },
    { id: 'deposits', zh: '定期契约', en: 'Time Deposits' },
    { id: 'market', zh: '星空股市', en: 'Market / Stocks' },
  ]

  const tabRefFor = (id: WealthTabId) => {
    if (id === 'vault') return vaultTabRef
    if (id === 'deposits') return depositTabRef
    return marketTabRef
  }

  const isPnlPositive = displayPnl >= 0
  const activeDepositHoldings = useMemo(() => {
    return state.deposits.filter((d) => !d.settled).sort((a, b) => a.expiresAt - b.expiresAt)
  }, [state.deposits])

  const effectiveWallNow = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000
    const offset = Math.max(-120, Math.min(120, devWallOffsetDays))
    return devMode ? wallNow + offset * dayMs : wallNow
  }, [devMode, devWallOffsetDays, wallNow])

  const stocksWithQuoteUi = useMemo(() => {
    if (!devMode || devWallOffsetDays === 0) return stocksWithQuote
    const dayKey = formatMmDd(effectiveWallNow)
    const days = devWallOffsetDays
    return stocksWithQuote.map((s) => {
      // 每支股票独立的日波动（可重复种子），用于预览“涨跌会不会动、颜色对不对”
      const rnd = pseudo(`wealth-dev-stock-${dayKey}-${s.id}`)
      const perDay = (rnd - 0.5) * 0.08 // ±4%/日
      const factor = Math.pow(1 + perDay, days)
      const quote = Math.max(0.01, Math.round(s.quote * factor * 100) / 100)
      const rawPct = s.quote > 0 ? (quote / s.quote - 1) * 100 : 0
      const quoteChangePct = Math.round(rawPct * 10) / 10
      return { ...s, quote, quoteChangePct }
    })
  }, [devMode, devWallOffsetDays, effectiveWallNow, stocksWithQuote])

  const activeStockDetail = useMemo(() => {
    if (!stockDetailId) return null
    return stocksWithQuoteUi.find((s) => s.id === stockDetailId) ?? null
  }, [stockDetailId, stocksWithQuoteUi])

  const projectedTotalAssets = useMemo(() => {
    if (!devMode || devWallOffsetDays === 0) return totalAssets
    const days = devWallOffsetDays
    // 活期：按日息推进（近似）
    const vaultDaily = (state.vaultBalance * 0.03) / 365
    const vaultDelta = vaultDaily * days

    // 股票：用“按日随机波动”模拟（仅用于预览线条/配色，不写回存档）
    const stockExposure = state.stocks.reduce((sum, h) => {
      const q = stocksWithQuoteUi.find((s) => s.id === h.stockId)?.quote ?? h.avgCost
      return sum + q * h.shares
    }, 0)
    const dayKey = formatMmDd(effectiveWallNow)
    const rnd = pseudo(`wealth-dev-${dayKey}`)
    const driftPct = (rnd - 0.5) * 0.06 // ±3%/日 的预览波动
    const stockDelta = stockExposure * driftPct * days

    return Math.round((totalAssets + vaultDelta + stockDelta) * 100) / 100
  }, [devMode, devWallOffsetDays, effectiveWallNow, state.vaultBalance, state.stocks, stocksWithQuoteUi, totalAssets])

  const chartSeries = useMemo(
    () => buildSeriesFromStart(projectedTotalAssets, state.createdWallMs, effectiveWallNow),
    [projectedTotalAssets, state.createdWallMs, effectiveWallNow],
  )
  const chartTone = useMemo(() => {
    const first = chartSeries[0]?.value ?? projectedTotalAssets
    const last = chartSeries[chartSeries.length - 1]?.value ?? projectedTotalAssets
    return last - first >= 0.01 ? 'positive' : 'neutral'
  }, [chartSeries, projectedTotalAssets])
  const chartDebug = useMemo(() => {
    const rows = chartSeries.map((p, i) => {
      const prev = chartSeries[i - 1]?.value
      const delta = prev == null ? null : Math.round((p.value - prev) * 100) / 100
      return { ...p, delta }
    })
    const last = rows[rows.length - 1]?.value ?? totalAssets
    const prev = rows[rows.length - 2]?.value ?? last
    const lastDelta = Math.round((last - prev) * 100) / 100
    return { rows, lastDelta }
  }, [chartSeries, totalAssets])

  const stockBreakdown = useMemo(() => {
    return state.stocks
      .map((h) => {
        const row = stocksWithQuoteUi.find((s) => s.id === h.stockId)
        const pnl = row ? (row.quote - h.avgCost) * h.shares : 0
        return {
          id: h.stockId,
          name: row?.companyName ?? '股票',
          pnl: Math.round(pnl * 100) / 100,
        }
      })
      .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
  }, [state.stocks, stocksWithQuoteUi])

  const depositBreakdown = useMemo(() => {
    return activeDepositHoldings.map((h) => {
      const product = availableDeposits.find((d) => d.id === h.productId)
      return {
        id: h.id,
        name: product?.name ?? '定期契约',
        principal: h.principal,
        apyPct: h.apy,
        buyAtMs: h.buyAt,
        expiresAtMs: h.expiresAt,
        nowMs: currentTimeMs,
      }
    })
  }, [activeDepositHoldings, availableDeposits, currentTimeMs])

  const ledgerItems = useMemo(() => {
    const snap = walletReadSnapshot()
    const tx = snap.transactions
      .filter((t) => /活期|定期|契约|买入|卖出|返还|股票/.test(t.title))
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        date: formatMmDdHms(new Date(t.createdAt).getTime()),
        title: t.title.replace('Lumi', 'Lumi理财'),
        amount: t.amount,
      }))

    // 额外补一条“今日活期收益”近似展示（获得感）
    const vaultDaily = Math.round((state.vaultBalance * (0.03 / 365)) * 100) / 100
    const settleTs = settleStampAt1500(effectiveWallNow)
    const head = { id: 'vault-yield-today', date: formatMmDdHms(settleTs), title: '活期收益', amount: vaultDaily }
    return [head, ...tx].slice(0, 10)
  }, [state.vaultBalance, effectiveWallNow])

  const ensureTutorialVaultSheet = () => {
    if (sheet) return
    setSheet({ kind: 'vault', name: 'Lumi活期', hint: '随存随取，按日计息' })
  }

  const ensureTutorialDepositSheet = () => {
    if (sheet) return
    const first = availableDeposits[0]
    if (!first) return
    setSheet({
      kind: 'deposit',
      id: first.id,
      name: first.name,
      hint: `锁定 ${first.lockDays} 天，期间不可提前赎回`,
    })
  }

  const ensureTutorialStockSheet = () => {
    if (sheet) return
    const first = stocksWithQuote[0]
    if (!first) return
    setSheet({
      kind: 'stock',
      id: first.id,
      name: first.companyName,
      hint: '先体验签署，再观察持仓收益变化',
    })
  }

  const closeTutorial = () => {
    setTutorialOpen(false)
    setSheet(null)
  }

  const nextTutorial = () => {
    const p = tutorialPhaseRef.current
    if (p === 'hub') return

    const { track, step } = p

    const go = (nextStep: number) => {
      const nextPhase: TutorialPhase = { track, step: nextStep }
      setTutorialPhase(nextPhase)
      scheduleHighlightUpdate(nextPhase)
    }

    if (track === 'vault') {
      if (step === 3) {
        ensureTutorialVaultSheet()
        go(4)
        return
      }
      if (step === 4) {
        if (sheetConfirmRef.current) sheetConfirmRef.current.click()
        else ensureTutorialVaultSheet()
        return
      }
      if (step === 5) {
        go(6)
        return
      }
      if (step >= TUTORIAL_LAST_STEP) {
        closeTutorial()
        return
      }
      go(step + 1)
      return
    }

    if (track === 'deposit') {
      if (step === 3) {
        ensureTutorialDepositSheet()
        go(4)
        return
      }
      if (step === 4) {
        if (sheetConfirmRef.current) sheetConfirmRef.current.click()
        else ensureTutorialDepositSheet()
        return
      }
      if (step === 5) {
        go(6)
        return
      }
      if (step >= TUTORIAL_LAST_STEP) {
        closeTutorial()
        return
      }
      go(step + 1)
      return
    }

    if (step === 3) {
      ensureTutorialStockSheet()
      go(4)
      return
    }
    if (step === 4) {
      if (sheetConfirmRef.current) sheetConfirmRef.current.click()
      else ensureTutorialStockSheet()
      return
    }
    if (step === 5) {
      go(6)
      return
    }
    if (step >= TUTORIAL_LAST_STEP) {
      closeTutorial()
      return
    }
    go(step + 1)
  }

  const prevTutorial = () => {
    const p = tutorialPhaseRef.current
    if (p === 'hub') return
    if (p.step <= 1) {
      setTutorialPhase('hub')
      setSheet(null)
      setHighlightTargetEl(null)
      return
    }
    const prev = p.step - 1
    const nextPhase: TutorialPhase = { track: p.track, step: prev }
    setTutorialPhase(nextPhase)
    scheduleHighlightUpdate(nextPhase)
    if (p.step === 4 || prev <= 3) setSheet(null)
  }

  const onPickTrack = (t: WealthTutorialPick) => {
    const nextPhase: TutorialPhase = { track: t, step: 1 }
    setTutorialPhase(nextPhase)
    setSheet(null)
    scheduleHighlightUpdate(nextPhase)
  }

  const onBuy = (amountYuan: number) => {
    if (!sheet) return
    const p = tutorialPhaseRef.current
    // 教程前四步内若打开签署面板，均为演示：动画结束后关面板，不实际扣款/买入（含第 3 步误点「转入」等情况）
    if (tutorialOpen && p !== 'hub' && p.step <= 4) return
    if (sheet.kind === 'vault') buyVault(amountYuan)
    else if (sheet.kind === 'deposit') buyDeposit(sheet.id, amountYuan)
    else buyStockByAmount(sheet.id, amountYuan)
  }

  const tutorialStepCopy =
    tutorialPhase === 'hub' ? { title: '', text: '' } : COPY[tutorialPhase.track][tutorialPhase.step] ?? { title: '', text: '' }

  const tutorialSealStep = tutorialPhase !== 'hub' && tutorialPhase.step === 4
  const signingSheetMode = tutorialOpen && tutorialSealStep && !!sheet

  const tutorialKey =
    tutorialPhase === 'hub' ? 'hub' : `${tutorialPhase.track}-${tutorialPhase.step}`

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent"
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-no-repeat opacity-[0.9]"
          style={{ backgroundImage: `url(${walletBg})`, backgroundPosition: 'center bottom', backgroundSize: 'cover' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/18 to-white/0" />
      </div>

      <header
        className="relative z-[1] flex shrink-0 items-center border-b border-white/60 bg-white/55 px-2 py-1 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
        style={{ paddingTop: 'max(6px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable type="button" aria-label="返回" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-full active:scale-[0.98]">
          <ChevronLeft className="size-6 text-black" strokeWidth={1.5} />
        </Pressable>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[16px] font-semibold text-black">Lumi理财</div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pr-1">
          <Pressable
            type="button"
            aria-label="收益明细"
            onClick={() => setLedgerOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/45 text-gray-700 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)] active:scale-[0.98]"
          >
            <ReceiptText className="size-5" strokeWidth={1.7} />
          </Pressable>
          <div ref={tutorialButtonRef} className="flex h-11 w-11 items-center justify-center">
            <Pressable
              type="button"
              aria-label="查看理财教程"
              onClick={() => {
                setTutorialOpen(true)
                setTutorialPhase('hub')
              setHighlightTargetEl(null)
              }}
              className="flex h-full w-full items-center justify-center rounded-full border border-white/60 bg-white/45 text-gray-700 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)] active:scale-[0.98]"
            >
              <BookOpenText className="size-5" strokeWidth={1.7} />
            </Pressable>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto max-w-[640px]">
          <section ref={overviewRef} className="relative overflow-hidden rounded-[30px] border border-white/60 bg-white/35 px-6 pb-6 pt-5 shadow-[0_16px_40px_rgba(0,0,0,0.08)] backdrop-blur-[16px] [-webkit-backdrop-filter:blur(16px)]">
            <p className="text-center text-[11px] tracking-[0.2em] text-gray-500">
              总资产 <span className="ml-2 text-gray-400">TOTAL ASSETS</span>
            </p>
            <p
              className="mt-2 text-center text-[44px] font-semibold tracking-tight text-black sm:text-[52px]"
              style={{ fontFamily: '"DIN Alternate", "SF Pro Display", ui-sans-serif, system-ui, sans-serif' }}
            >
              <motion.span
                key={`${moneyPulse}-${Math.round(displayAssets * 100)}`}
                initial={{ opacity: 0.88, y: 1 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
              >
                {formatCurrency(displayAssets)}
              </motion.span>
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <p className="text-[12px] tracking-[0.12em] text-gray-500">
                昨日收益 <span className="ml-2 text-gray-400">YESTERDAY'S PROFIT</span>
              </p>
              <p className={`text-[13px] ${isPnlPositive ? 'text-[#b69457]' : 'text-gray-400'}`}>
                {isPnlPositive ? '↑' : '↓'} {formatCurrency(Math.abs(displayPnl))}
              </p>
            </div>
            <div className="mt-5">
              <AssetChart series={chartSeries} tone={chartTone} className="h-[168px] w-full" />
            </div>

            {devMode ? (
              <div className="mt-3 rounded-[18px] border border-white/70 bg-white/55 px-4 py-3 text-[11px] text-gray-700">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">DEV · 走势判定</p>
                  <p className="text-gray-500">
                    tone={chartTone} · lastΔ {chartDebug.lastDelta >= 0 ? '+' : '-'}{formatCurrency(Math.abs(chartDebug.lastDelta))}
                  </p>
                </div>
                <div className="mt-2 grid gap-1 text-gray-600">
                  {chartDebug.rows.map((r, i) => (
                    <div key={`${r.dateText}-${i}`} className="flex items-center justify-between gap-2">
                      <span className="shrink-0">{r.dateText}</span>
                      <span className="min-w-0 truncate">{formatCurrency(r.value)}</span>
                      <span className="shrink-0 text-gray-500">
                        {r.delta == null ? '—' : `${r.delta >= 0 ? '+' : '-'}${formatCurrency(Math.abs(r.delta))}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <AssetBreakdown
              vaultBalance={state.vaultBalance}
              vaultApyPct={3.0}
              deposits={depositBreakdown}
              stocks={stockBreakdown}
              onOpenDeposits={() => setTab('deposits')}
              onOpenMarket={() => setTab('market')}
            />
          </section>

          <div className="mt-5 grid grid-cols-3 gap-2 rounded-[18px] border border-white/60 bg-white/35 p-1.5 backdrop-blur-[12px] [-webkit-backdrop-filter:blur(12px)]">
            {tabs.map((t) => {
              const active = displayTab === t.id
              const tRef = tabRefFor(t.id)
              return (
                <div key={t.id} ref={tRef} className="min-w-0">
                  <Pressable
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`w-full rounded-[14px] px-2 py-2 text-center transition ${active ? 'bg-black text-white shadow-sm' : 'bg-transparent text-gray-500'}`}
                  >
                    <p className="text-[13px] font-medium">{t.zh}</p>
                    <p className={`mt-0.5 text-[10px] tracking-[0.16em] ${active ? 'text-white/80' : 'text-gray-400'}`}>{t.en}</p>
                  </Pressable>
                </div>
              )
            })}
          </div>

          {displayTab === 'vault' ? (
            <section
              ref={vaultSectionRef}
              className="mt-4 rounded-[24px] border border-white/60 bg-white/35 px-5 py-5 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
            >
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] tracking-[0.24em] text-gray-400">LUMI VAULT · 活期</p>
                  <h3 className="mt-2 text-[22px] font-semibold text-black">当前持有 {formatCurrency(state.vaultBalance)}</h3>
                </div>
                <p className="text-[14px] text-[#b69457]">3.0% APY</p>
              </div>
              <p className="mt-2 text-[13px] text-gray-500">今日利息按日累计。保姆提示：今日收益 = 存入金额 × (0.03 / 365)</p>
              <div className="mt-4 flex gap-2">
                <div ref={vaultTransferRef} className="inline-flex">
                  <Pressable
                    type="button"
                    onClick={() => setSheet({ kind: 'vault', name: 'Lumi活期', hint: '随存随取，按日计息' })}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-black bg-black px-5 text-[13px] font-medium text-white"
                  >
                    转入
                  </Pressable>
                </div>
                <Pressable
                  type="button"
                  onClick={() => redeemVault(Math.min(1000, state.vaultBalance))}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-gray-300 bg-white/65 px-5 text-[13px] font-medium text-gray-700"
                >
                  取出 ¥1000
                </Pressable>
              </div>
            </section>
          ) : null}

          {displayTab === 'deposits' ? (
            <section className="mt-4 grid gap-3">
              {availableDeposits.map((dep, idx) => {
                const remainMs = Math.max(0, new Date(dep.expiresAt).getTime() - currentTimeMs)
                const remainDays = Math.ceil(remainMs / (24 * 60 * 60 * 1000))
                const card = (
                  <div className="rounded-[24px] border border-white/60 bg-white/35 px-5 py-5 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
                    <p className="text-[10px] tracking-[0.24em] text-gray-400">{dep.contractLabel}</p>
                    <div className="mt-2 flex items-end justify-between">
                      <h3 className="text-[20px] font-semibold text-black">{dep.name}</h3>
                      <p className="text-[14px] text-[#b69457]">{dep.apy}% APY</p>
                    </div>
                    <p className="mt-2 text-[12px] text-gray-500">锁定 {dep.lockDays} 天 · 到期约 {remainDays} 天后（兼容双时间推进）</p>
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-[12px] text-gray-400">MIN ¥{dep.minBuy.toLocaleString('zh-CN')}</p>
                      <Pressable
                        type="button"
                        onClick={() => setSheet({ kind: 'deposit', id: dep.id, name: dep.name, hint: `锁定 ${dep.lockDays} 天，期间不可提前赎回` })}
                        className="inline-flex h-9 items-center justify-center rounded-full border border-black bg-black px-4 text-[12px] font-medium text-white"
                      >
                        签署契约
                      </Pressable>
                    </div>
                  </div>
                )
                return idx === 0 ? (
                  <div key={dep.id} ref={depositFirstCardRef}>
                    {card}
                  </div>
                ) : (
                  <div key={dep.id}>{card}</div>
                )
              })}

              <div className="mt-1 rounded-[24px] border border-white/60 bg-white/35 px-5 py-4 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
                <p className="text-[11px] tracking-[0.2em] text-gray-500">MY DEPOSITS · 我的定期持仓</p>
                {activeDepositHoldings.length === 0 ? (
                  <p className="mt-2 text-[13px] text-gray-500">暂无持仓，先签一份定期契约吧。</p>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {activeDepositHoldings.map((h) => {
                      const product = availableDeposits.find((d) => d.id === h.productId)
                      const remainMs = Math.max(0, h.expiresAt - currentTimeMs)
                      const canRedeem = remainMs <= 0
                      const remainDays = Math.floor(remainMs / (24 * 60 * 60 * 1000))
                      const remainHours = Math.ceil((remainMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
                      const lockYears = Math.max(0, (h.expiresAt - h.buyAt) / (365 * 24 * 60 * 60 * 1000))
                      const expectedInterest = h.principal * (h.apy / 100) * lockYears
                      const expectedRedeem = h.principal + expectedInterest
                      return (
                        <div key={h.id} className="rounded-[18px] border border-white/70 bg-white/45 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-black">{product?.name ?? '定期契约'}</p>
                              <p className="mt-1 text-[12px] text-gray-500">
                                本金 {formatCurrency(h.principal)} · 预计到期 {formatCurrency(expectedRedeem)}
                              </p>
                              <p className="mt-1 text-[12px] text-gray-500">
                                {canRedeem ? '已到期，可立即取出' : `剩余 ${remainDays} 天 ${Math.max(0, remainHours)} 小时可取`}
                              </p>
                            </div>
                            <Pressable
                              type="button"
                              onClick={() => settleMaturedDeposits()}
                              disabled={!canRedeem}
                              className={`inline-flex h-8 shrink-0 items-center justify-center rounded-full px-3 text-[11px] ${
                                canRedeem
                                  ? 'border border-black bg-black text-white'
                                  : 'border border-gray-300 bg-white/70 text-gray-400'
                              }`}
                            >
                              取出本息
                            </Pressable>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {displayTab === 'market' ? (
            <section ref={stockListRef} className="mt-4 grid gap-3">
              {stocksWithQuoteUi.map((s, idx) => {
                const positive = s.quoteChangePct >= 0
                const d = miniSpark(buildStockSparkline(s.id, s.quote, effectiveWallNow))
                const holding = getHoldingByStockId(s.id)
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setStockDetailId(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setStockDetailId(s.id)
                    }}
                    className="cursor-default rounded-[24px] border border-white/60 bg-white/35 px-5 py-4 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] tracking-[0.22em] text-gray-400">{s.code}</p>
                        <p className="mt-1 truncate text-[15px] font-medium text-black">{s.companyName}</p>
                        <p className="mt-2 text-[18px] font-semibold tabular-nums text-black">Price {s.quote.toFixed(2)}</p>
                        <p className={`mt-1 text-[12px] ${positive ? 'text-[#b69457]' : 'text-gray-400'}`}>
                          {positive ? '↑' : '↓'} {Math.abs(s.quoteChangePct).toFixed(1)}%
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <svg viewBox="0 0 92 28" className="h-8 w-[96px]" aria-hidden>
                          <path d={d} fill="none" stroke="#111111" strokeWidth="1.1" strokeLinecap="round" />
                        </svg>
                        <div ref={idx === 0 ? firstBuyRef : undefined} className="mt-3 flex items-center justify-end gap-2">
                          <Pressable
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setStockDetailId(s.id)
                            }}
                            className="inline-flex h-8 items-center justify-center rounded-full border border-gray-300 bg-white/65 px-3 text-[12px] font-medium text-gray-700"
                          >
                            趋势
                          </Pressable>
                          <Pressable
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSheet({ kind: 'stock', id: s.id, name: s.companyName, hint: '输入金额买入，后续可随时卖出' })
                            }}
                            className="inline-flex h-8 items-center justify-center rounded-full border border-black bg-black px-4 text-[12px] font-medium text-white"
                          >
                            买入
                          </Pressable>
                        </div>
                      </div>
                    </div>
                    {holding ? (
                      <div className="mt-3 border-t border-white/60 pt-3 text-[12px] text-gray-600">
                        持有 {holding.shares.toFixed(2)} 份 · 均价 {holding.avgCost.toFixed(2)} · 当前盈亏 {(holding.shares * (s.quote - holding.avgCost)).toFixed(2)}
                        <Pressable
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const amount = Math.min(500, s.quote * holding.shares)
                            const shares = amount / Math.max(0.01, s.quote)
                            const pnl = shares * (s.quote - holding.avgCost)
                            setPendingSell({
                              stockId: s.id,
                              stockName: s.companyName,
                              amount: Math.round(amount * 100) / 100,
                              pnl: Math.round(pnl * 100) / 100,
                            })
                          }}
                          className="ml-3 inline-flex h-7 items-center justify-center rounded-full border border-gray-300 bg-white/65 px-3 text-[11px] text-gray-700"
                        >
                          卖出¥500
                        </Pressable>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </section>
          ) : null}

          <section ref={holdingRef} className="mt-4 rounded-[24px] border border-white/60 bg-white/35 px-5 py-4 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
            <p className="text-[11px] tracking-[0.2em] text-gray-500">HOLDINGS · 持仓明细</p>
            <p className="mt-2 text-[13px] text-gray-700">活期余额 {formatCurrency(state.vaultBalance)} · 定期 {state.deposits.filter((d) => !d.settled).length} 笔 · 股票持仓 {state.stocks.length} 支</p>
          </section>
        </div>
      </div>

      {signingSheetMode ? (
        <div className="pointer-events-none absolute inset-0 z-[140] bg-black/45" aria-hidden />
      ) : null}

      <InvestmentSheet
        open={!!sheet}
        productName={sheet?.name ?? ''}
        hint={sheet?.hint}
        onClose={() => setSheet(null)}
        onConfirm={onBuy}
        onSealDone={() => {
          setSheet(null)
          const p = tutorialPhaseRef.current
          if (tutorialOpen && p !== 'hub' && p.step === 4) {
            const nextPhase: TutorialPhase = { track: p.track, step: 5 }
            setTutorialPhase(nextPhase)
            scheduleHighlightUpdate(nextPhase)
          }
        }}
        panelRef={sheetPanelRef}
        confirmButtonRef={sheetConfirmRef}
        presetAmount={tutorialOpen && tutorialSealStep ? 500 : undefined}
        overlayClassName={
          signingSheetMode
            ? 'absolute inset-0 z-[145] flex flex-col justify-end bg-black/28'
            : undefined
        }
      />

      <WealthTutorial
        key={tutorialKey}
        open={tutorialOpen}
        phase={tutorialPhase === 'hub' ? 'hub' : 'step'}
        signingSheetMode={signingSheetMode}
        onPickTrack={onPickTrack}
        stepTitle={tutorialStepCopy.title}
        stepText={tutorialStepCopy.text}
        targetElement={highlightTargetEl}
        onNext={nextTutorial}
        onPrev={prevTutorial}
        onClose={closeTutorial}
        canGoPrev={tutorialPhase !== 'hub'}
        nextLabel={
          tutorialPhase !== 'hub' && tutorialPhase.step >= TUTORIAL_LAST_STEP ? '完成' : '下一步'
        }
      />

      <StockDetailSheet
        open={!!stockDetailId}
        onClose={() => setStockDetailId(null)}
        stock={activeStockDetail}
        wallNow={effectiveWallNow}
      />

      <AnimatePresence>
        {pendingSell ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[158] flex items-end justify-center bg-black/35 p-4"
          >
            <Pressable type="button" className="absolute inset-0" onClick={() => setPendingSell(null)} aria-label="关闭卖出确认">
              <span className="sr-only">关闭</span>
            </Pressable>
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="relative z-[1] w-full max-w-[560px] rounded-[24px] border border-white/70 bg-white/90 px-5 py-5 shadow-[0_20px_48px_rgba(0,0,0,0.18)] backdrop-blur-[16px] [-webkit-backdrop-filter:blur(16px)]"
            >
              <p className="text-[11px] tracking-[0.24em] text-gray-500">SELL CONFIRM · 卖出确认</p>
              <h3 className="mt-2 text-[20px] font-semibold text-black">{pendingSell.stockName}</h3>
              <p className="mt-2 text-[13px] text-gray-600">本次卖出金额 {formatCurrency(pendingSell.amount)}</p>
              <p className={`mt-1 text-[13px] font-medium ${pendingSell.pnl >= 0 ? 'text-[#b69457]' : 'text-gray-500'}`}>
                当前盈亏 {pendingSell.pnl >= 0 ? '+' : '-'} {formatCurrency(Math.abs(pendingSell.pnl))}
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Pressable
                  type="button"
                  onClick={() => setPendingSell(null)}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-gray-300 bg-white/70 px-4 text-[12px] text-gray-700"
                >
                  取消
                </Pressable>
                <Pressable
                  type="button"
                  onClick={() => {
                    sellStockByAmount(pendingSell.stockId, pendingSell.amount)
                    setPendingSell(null)
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black bg-black px-4 text-[12px] font-medium text-white"
                >
                  确认卖出
                </Pressable>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {ledgerOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[160] flex flex-col justify-end bg-black/35"
          >
            <Pressable type="button" className="min-h-0 flex-1" onClick={() => setLedgerOpen(false)} aria-label="关闭收益明细">
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
                  理财日志 <span className="ml-2 text-gray-400">WEALTH LOG</span>
                </p>
                <h3 className="mt-2 text-center text-[22px] font-semibold text-black">理财日志</h3>
                <p className="mt-1 text-center text-[12px] text-gray-500">看得见的 +¥ 才有获得感。</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Pressable
                    type="button"
                    onClick={() => {
                      const next = !devMode
                      setDevMode(next)
                      try {
                        window.localStorage.setItem(WEALTH_DEV_MODE_KEY, next ? '1' : '0')
                      } catch {
                        // ignore
                      }
                    }}
                    className="rounded-full border border-gray-300 bg-white/70 px-3 py-1.5 text-[11px] text-gray-700"
                  >
                    开发模式 {devMode ? 'ON' : 'OFF'}
                  </Pressable>
                </div>

                {devMode ? (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <Pressable
                      type="button"
                      onClick={() => {
                        const next = devWallOffsetDays - 7
                        setDevWallOffsetDays(next)
                        try {
                          window.localStorage.setItem(WEALTH_DEV_WALL_OFFSET_KEY, String(next))
                        } catch {
                          // ignore
                        }
                      }}
                      className="rounded-full border border-gray-300 bg-white/70 px-3 py-1.5 text-[11px] text-gray-700"
                    >
                      -7天
                    </Pressable>
                    <Pressable
                      type="button"
                      onClick={() => {
                        const next = devWallOffsetDays - 1
                        setDevWallOffsetDays(next)
                        try {
                          window.localStorage.setItem(WEALTH_DEV_WALL_OFFSET_KEY, String(next))
                        } catch {
                          // ignore
                        }
                      }}
                      className="rounded-full border border-gray-300 bg-white/70 px-3 py-1.5 text-[11px] text-gray-700"
                    >
                      -1天
                    </Pressable>
                    <Pressable
                      type="button"
                      onClick={() => {
                        const next = 0
                        setDevWallOffsetDays(next)
                        try {
                          window.localStorage.setItem(WEALTH_DEV_WALL_OFFSET_KEY, '0')
                        } catch {
                          // ignore
                        }
                      }}
                      className="rounded-full border border-black bg-black px-3 py-1.5 text-[11px] text-white"
                    >
                      今天
                    </Pressable>
                    <Pressable
                      type="button"
                      onClick={() => {
                        const next = devWallOffsetDays + 1
                        setDevWallOffsetDays(next)
                        try {
                          window.localStorage.setItem(WEALTH_DEV_WALL_OFFSET_KEY, String(next))
                        } catch {
                          // ignore
                        }
                      }}
                      className="rounded-full border border-gray-300 bg-white/70 px-3 py-1.5 text-[11px] text-gray-700"
                    >
                      +1天
                    </Pressable>
                    <Pressable
                      type="button"
                      onClick={() => {
                        const next = devWallOffsetDays + 7
                        setDevWallOffsetDays(next)
                        try {
                          window.localStorage.setItem(WEALTH_DEV_WALL_OFFSET_KEY, String(next))
                        } catch {
                          // ignore
                        }
                      }}
                      className="rounded-full border border-gray-300 bg-white/70 px-3 py-1.5 text-[11px] text-gray-700"
                    >
                      +7天
                    </Pressable>
                    <span className="text-[11px] text-gray-500">
                      模拟日期 {formatMmDd(effectiveWallNow)}（偏移 {devWallOffsetDays >= 0 ? '+' : ''}{devWallOffsetDays} 天）
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-2">
                {ledgerItems.map((it) => {
                  const positive = it.amount >= 0
                  return (
                    <div key={it.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-white/70 bg-white/55 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[12px] text-gray-500">[{it.date}]</p>
                        <p className="mt-0.5 truncate text-[13px] font-medium text-black">{it.title}</p>
                      </div>
                      <p className={`shrink-0 text-[13px] font-semibold ${positive ? 'text-[#b69457]' : 'text-gray-500'}`}>
                        {positive ? '+' : '-'} {formatCurrency(Math.abs(it.amount))}
                      </p>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 flex justify-center">
                <Pressable
                  type="button"
                  onClick={() => setLedgerOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-black bg-black px-6 text-[13px] font-medium text-white"
                >
                  知道了
                </Pressable>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}

export function WealthDashboardPage({ onBack }: { onBack: () => void }) {
  const { currentTimeMs } = useWeChatCurrentTime()
  return (
    <WealthProvider currentTimeMs={currentTimeMs}>
      <WealthDashboardInner onBack={onBack} />
    </WealthProvider>
  )
}
