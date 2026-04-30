import { useCallback, useEffect, useMemo, useState } from 'react'

export type WalletTransactionType = 'topup' | 'withdraw' | 'spend' | 'affection'

export type WalletBankName = 'Lumi银行' | 'LU宝银行' | 'Luum银行'

export type WalletBankCard = {
  id: string
  bankName: WalletBankName
  /** 16 位卡号，纯数字 */
  number: string
  last4: string
  tone?: 'black' | 'gray'
}

export type AffectionCard = {
  id: string
  giverName: string
  giverAvatar: string
  message: string
  signature: string
  monthlyRemaining: number
  monthlyLimit: number
  blessing: string
}

export type WalletTransaction = {
  id: string
  type: WalletTransactionType
  title: string
  subtitle: string
  amount: number
  createdAt: string
  meta?: {
    /** 亲情卡：用于“按卡筛选流水” */
    affectionCardId?: string
    giverName?: string
  }
}

type WalletSnapshot = {
  balance: number
  isPaymentPasswordSet: boolean
  paymentPassword: string
  bankCards: WalletBankCard[]
  affectionCards: AffectionCard[]
  transactions: WalletTransaction[]
}

const STORAGE_KEY = 'wechat-wallet-cards-v1'
const WALLET_CHANGED_EVENT = 'wallet-storage-changed'

export function emitWalletStorageChanged() {
  try {
    window.dispatchEvent(new Event(WALLET_CHANGED_EVENT))
  } catch {
    // ignore
  }
}

const BANKS: WalletBankName[] = ['Lumi银行', 'LU宝银行', 'Luum银行']
const MAX_CARDS_PER_BANK = 3
const LEGACY_MOCK_AFFECTION_CARD_IDS = new Set(['aff-1', 'aff-2'])
const LEGACY_MOCK_TRANSACTION_IDS = new Set([
  'txn-aff-6',
  'txn-aff-5',
  'txn-1',
  'txn-aff-4',
  'txn-2',
  'txn-aff-3',
  'txn-aff-2',
  'txn-3',
  'txn-aff-1',
])

const DEFAULT_SNAPSHOT: WalletSnapshot = {
  balance: 5000,
  isPaymentPasswordSet: false,
  paymentPassword: '',
  bankCards: [
    { id: 'bank-1', bankName: 'Lumi银行', number: '6222000011114321', last4: '4321', tone: 'black' },
    { id: 'bank-2', bankName: 'LU宝银行', number: '6222000022221886', last4: '1886', tone: 'gray' },
    { id: 'bank-3', bankName: 'Luum银行', number: '6222000033339001', last4: '9001', tone: 'black' },
  ],
  affectionCards: [],
  transactions: [],
}

export function walletReadSnapshot(): WalletSnapshot {
  if (typeof window === 'undefined') return DEFAULT_SNAPSHOT
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SNAPSHOT
    const parsed = JSON.parse(raw) as Partial<WalletSnapshot>
    const bankCardsRaw = Array.isArray(parsed.bankCards) ? parsed.bankCards : DEFAULT_SNAPSHOT.bankCards
    const bankCards = bankCardsRaw
      .filter((c): c is WalletBankCard => !!c && typeof c === 'object')
      .map((c) => {
        const rawName = String((c as any).bankName ?? '').trim()
        const mapped =
          rawName === '中国银行' ? 'Lumi银行' : rawName === '招商银行' ? 'LU宝银行' : normalizeBankName(rawName || 'Luum银行')
        const last4 = String((c as any).last4 ?? '').replace(/[^\d]/g, '').slice(-4).padStart(4, '0')
        const rawNumber = String((c as any).number ?? '').replace(/[^\d]/g, '')
        const number = (rawNumber.length >= 16 ? rawNumber.slice(-16) : `622200000000${last4}`.slice(0, 16)).padStart(16, '0')
        return {
          id: typeof (c as any).id === 'string' ? (c as any).id : `bank-migrated-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          bankName: mapped,
          number,
          last4,
          tone: (c as any).tone === 'gray' ? 'gray' : 'black',
        } satisfies WalletBankCard
      })

    // 兼容旧存档：若缺少 Luum 银行卡，补一张用于样式预览（不超过单行上限）
    const luumCount = bankCards.filter((c) => c.bankName === 'Luum银行').length
    const canAddLuum = luumCount < MAX_CARDS_PER_BANK
    const bankCardsFilled =
      luumCount === 0 && canAddLuum
        ? [
            {
              id: 'bank-mock-luum-1',
              bankName: 'Luum银行',
              number: '6222000033339001',
              last4: '9001',
              tone: 'black',
            } satisfies WalletBankCard,
            ...bankCards,
          ]
        : bankCards

    const affectionCards = (Array.isArray(parsed.affectionCards) ? (parsed.affectionCards as AffectionCard[]) : [])
      .filter((c) => !LEGACY_MOCK_AFFECTION_CARD_IDS.has(String(c?.id || '').trim()))
      .map((c) => ({
        ...c,
        blessing:
          typeof c.blessing === 'string' && c.blessing.trim()
            ? c.blessing.trim()
            : '把这份底气，都留给你。',
      }))

    const giverIdByName = new Map(affectionCards.map((c) => [c.giverName, c.id] as const))
    const fallbackAff = affectionCards[0] ?? DEFAULT_SNAPSHOT.affectionCards[0] ?? null
    const migrateOneTransaction = (t: WalletTransaction): WalletTransaction => {
      if (t.type !== 'affection') return t
      const meta = (t.meta ?? {}) as NonNullable<WalletTransaction['meta']>
      if (meta.affectionCardId?.trim()) return { ...t, meta }
      const giverName = (meta.giverName ?? '').trim()
      const mappedId = giverName ? giverIdByName.get(giverName) : undefined
      if (mappedId) return { ...t, meta: { ...meta, affectionCardId: mappedId, giverName } }
      // 旧存档无法推断具体哪张卡：至少归入第一张卡，避免“按卡筛选全空白”
      return fallbackAff
        ? { ...t, meta: { ...meta, affectionCardId: fallbackAff.id, giverName: giverName || fallbackAff.giverName } }
        : t
    }

    const transactionsFromStorage = Array.isArray(parsed.transactions)
      ? (parsed.transactions as WalletTransaction[])
          .filter((t) => !LEGACY_MOCK_TRANSACTION_IDS.has(String(t?.id || '').trim()))
          .map(migrateOneTransaction)
      : []
    const transactions = transactionsFromStorage

    return {
      ...DEFAULT_SNAPSHOT,
      ...parsed,
      bankCards: bankCardsFilled,
      affectionCards,
      transactions,
    }
  } catch {
    return DEFAULT_SNAPSHOT
  }
}

function walletWriteSnapshot(next: WalletSnapshot) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  emitWalletStorageChanged()
}

function formatStamp(date = new Date()) {
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const min = `${date.getMinutes()}`.padStart(2, '0')
  return `${mm}-${dd} ${hh}:${min}`
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function normalizeBankName(name: string): WalletBankName {
  const trimmed = name.trim()
  if (trimmed === 'Lumi银行') return 'Lumi银行'
  if (trimmed === 'LU宝银行') return 'LU宝银行'
  return 'Luum银行'
}

export function walletAddTransaction(entry: Omit<WalletTransaction, 'id' | 'subtitle' | 'createdAt'>) {
  const now = new Date()
  const prev = walletReadSnapshot()
  const next: WalletSnapshot = {
    ...prev,
    transactions: [
      {
        ...entry,
        id: uid('txn'),
        subtitle: formatStamp(now),
        createdAt: now.toISOString(),
      },
      ...prev.transactions,
    ],
  }
  walletWriteSnapshot(next)
}

export function walletAdjustBalance(delta: number) {
  const prev = walletReadSnapshot()
  const nextBalance = Math.round((prev.balance + delta) * 100) / 100
  walletWriteSnapshot({ ...prev, balance: nextBalance })
}

export function walletSpend(amountYuan: number, title: string) {
  if (!Number.isFinite(amountYuan) || amountYuan <= 0) return false
  const prev = walletReadSnapshot()
  if (prev.balance < amountYuan) return false
  walletWriteSnapshot({ ...prev, balance: Math.round((prev.balance - amountYuan) * 100) / 100 })
  walletAddTransaction({ type: 'spend', title, amount: -amountYuan })
  return true
}

export function walletAddBankCard(bankName: WalletBankName, last4: string) {
  const prev = walletReadSnapshot()
  const count = prev.bankCards.filter((c) => c.bankName === bankName).length
  if (count >= MAX_CARDS_PER_BANK) return { ok: false as const, reason: 'limit' as const }
  const last4Digits = String(last4).replace(/[^\d]/g, '').slice(-4).padStart(4, '0')
  const prefix = bankName === 'Lumi银行' ? '622200001111' : bankName === 'LU宝银行' ? '622200002222' : '622200003333'
  const number = `${prefix}${last4Digits}`.slice(0, 16)
  const next: WalletSnapshot = {
    ...prev,
    bankCards: [
      {
        id: uid('bank'),
        bankName,
        number,
        last4: last4Digits,
        tone: prev.bankCards.length % 2 === 0 ? 'black' : 'gray',
      },
      ...prev.bankCards,
    ],
  }
  walletWriteSnapshot(next)
  return { ok: true as const, reason: null }
}

export function walletSetPaymentPassword(pin: string) {
  if (!/^\d{6}$/.test(pin)) return
  const prev = walletReadSnapshot()
  walletWriteSnapshot({ ...prev, isPaymentPasswordSet: true, paymentPassword: pin })
}

export function useWalletMockStore() {
  const [snapshot, setSnapshot] = useState<WalletSnapshot>(() => walletReadSnapshot())

  useEffect(() => {
    const onChanged = () => setSnapshot(walletReadSnapshot())
    window.addEventListener(WALLET_CHANGED_EVENT, onChanged)
    window.addEventListener('storage', onChanged)
    return () => {
      window.removeEventListener(WALLET_CHANGED_EVENT, onChanged)
      window.removeEventListener('storage', onChanged)
    }
  }, [])

  const verifyPaymentPassword = useCallback(
    async (pin: string) => {
      await new Promise((resolve) => window.setTimeout(resolve, 240))
      return snapshot.isPaymentPasswordSet && snapshot.paymentPassword === pin
    },
    [snapshot.isPaymentPasswordSet, snapshot.paymentPassword],
  )

  const setPaymentPassword = useCallback((pin: string) => {
    walletSetPaymentPassword(pin)
    setSnapshot(walletReadSnapshot())
  }, [])

  const addBankCard = useCallback((bankName: WalletBankName, last4: string) => {
    const res = walletAddBankCard(bankName, last4)
    setSnapshot(walletReadSnapshot())
    return res
  }, [])

  const topUp = useCallback(
    (amount: number) => {
      walletAdjustBalance(amount)
      walletAddTransaction({
        type: 'topup',
        title: 'Lumi 钱包充值',
        amount,
      })
      setSnapshot(walletReadSnapshot())
    },
    [],
  )

  const withdraw = useCallback(
    (amount: number, bankName: string) => {
      if (!Number.isFinite(amount) || amount <= 0) return false
      const prev = walletReadSnapshot()
      if (prev.balance < amount) return false
      walletAdjustBalance(-amount)
      walletAddTransaction({
        type: 'withdraw',
        title: `提现到${bankName}`,
        amount: -amount,
      })
      setSnapshot(walletReadSnapshot())
      return true
    },
    [],
  )

  const payWithAffection = useCallback(
    (cardId: string, amount: number, title: string) => {
      let ok = true
      let giverName = '亲情卡'
      setSnapshot((prev) => {
        const idx = prev.affectionCards.findIndex((c) => c.id === cardId)
        if (idx < 0) {
          ok = false
          return prev
        }
        const card = prev.affectionCards[idx]!
        giverName = card.giverName
        if (card.monthlyRemaining < amount) {
          ok = false
          return prev
        }
        const nextCards = [...prev.affectionCards]
        nextCards[idx] = { ...card, monthlyRemaining: Math.round((card.monthlyRemaining - amount) * 100) / 100 }
        return { ...prev, affectionCards: nextCards }
      })
      if (!ok) return { ok: false as const, giverName }
      walletAddTransaction({
        type: 'affection',
        title: `${title}（由亲情卡支付）`,
        amount: -amount,
        meta: { affectionCardId: cardId, giverName },
      })
      setSnapshot(walletReadSnapshot())
      return { ok: true as const, giverName }
    },
    [],
  )

  const balanceText = useMemo(() => `¥ ${snapshot.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, [snapshot.balance])

  return {
    snapshot,
    balanceText,
    verifyPaymentPassword,
    setPaymentPassword,
    addBankCard,
    topUp,
    withdraw,
    payWithAffection,
    banks: BANKS,
    maxCardsPerBank: MAX_CARDS_PER_BANK,
    normalizeBankName,
  }
}
