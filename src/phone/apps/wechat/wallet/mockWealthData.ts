export type WealthTabId = 'vault' | 'deposits' | 'market'

export type VaultProduct = {
  id: string
  name: string
  apy: number
  description: string
  minBuy: number
}

export type TimeDepositProduct = {
  id: string
  name: string
  apy: number
  lockDays: number
  minBuy: number
  expiresAt: string
  contractLabel: string
}

export type StoryStock = {
  id: string
  code: string
  companyName: string
  price: number
  dailyYieldPct: number
  sparkline: number[]
}

export type WealthSummary = {
  totalAssets: number
  yesterdayPnl: number
  yieldPct: number
  assetCurve: number[]
}

export type MockWealthData = {
  summary: WealthSummary
  vault: VaultProduct
  deposits: TimeDepositProduct[]
  stocks: StoryStock[]
}

const now = Date.now()

export const mockWealthData: MockWealthData = {
  summary: {
    totalAssets: 286520.88,
    yesterdayPnl: 1268.36,
    yieldPct: 2.5,
    assetCurve: [41, 44, 42, 46, 48, 47, 50, 53, 56, 58, 61, 63, 67, 72],
  },
  vault: {
    id: 'vault-lumi',
    name: '活期小金库',
    apy: 3.5,
    description: '随存随取，按日计息',
    minBuy: 100,
  },
  deposits: [
    {
      id: 'dep-7d',
      name: '定期契约 · 7日',
      apy: 4.2,
      lockDays: 7,
      minBuy: 1000,
      expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      contractLabel: 'SEVEN-DAY COMPACT',
    },
    {
      id: 'dep-30d',
      name: '定期契约 · 30日',
      apy: 5.6,
      lockDays: 30,
      minBuy: 5000,
      expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      contractLabel: 'THIRTY-DAY COVENANT',
    },
  ],
  stocks: [
    {
      id: 'stk-osborn',
      code: 'OSB',
      companyName: 'Osborn Corp · 奥斯本集团',
      price: 128.4,
      dailyYieldPct: 1.8,
      sparkline: [34, 36, 35, 37, 39, 40, 43, 45],
    },
    {
      id: 'stk-starlight',
      code: 'SLE',
      companyName: 'Starlight Ent. · 星光娱乐',
      price: 76.2,
      dailyYieldPct: -0.7,
      sparkline: [52, 51, 50, 49, 51, 50, 49, 48],
    },
    {
      id: 'stk-midnight',
      code: 'MDS',
      companyName: 'Midnight Systems · 子夜系统',
      price: 203.9,
      dailyYieldPct: 2.5,
      sparkline: [28, 29, 31, 30, 33, 36, 38, 40],
    },
    {
      id: 'stk-lumi',
      code: 'LUM',
      companyName: 'Lumi Biotech · 琉光生科',
      price: 94.7,
      dailyYieldPct: 0.4,
      sparkline: [43, 44, 44, 45, 46, 45, 46, 47],
    },
  ],
}

