import { AnimatePresence, motion } from 'framer-motion'
import { CreditCard, HeartHandshake, Landmark, Plus, Settings2, ReceiptText, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { CustomNumericKeyboard } from '../redPacket/CustomNumericKeyboard'
import type { AffectionCard as AffectionCardModel, WalletBankCard, WalletBankName, WalletTransaction } from './walletMockStore'
import { WealthNavCard } from './WealthNavCard'

type OperationType = 'topup' | 'withdraw' | 'add-bank' | null

type Props = {
  balance: number
  balanceText: string
  bankCards: WalletBankCard[]
  affectionCards: AffectionCardModel[]
  transactions: WalletTransaction[]
  verifyPaymentPassword: (pin: string) => Promise<boolean>
  onTopUp: (amount: number) => void
  onWithdraw: (amount: number, bankName: string) => boolean
  onAddBankCard: (bankName: WalletBankName, last4: string) => { ok: true; reason: null } | { ok: false; reason: 'limit' }
  onChangePassword: (pin: string) => void
  onOpenTransactions: () => void
  onOpenAffectionCards: () => void
  onOpenBankCards: () => void
  onOpenWealth: () => void
}

function applyAmountInput(prev: string, key: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back') {
  if (key === 'back') return prev.slice(0, -1)
  if (key === '.') {
    if (prev.includes('.')) return prev
    return prev ? `${prev}.` : '0.'
  }
  const next = `${prev}${key}`
  if (!/^\d*\.?\d{0,2}$/.test(next)) return prev
  return next
}

function formatCurrency(value: number) {
  return `¥ ${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// bank card background & formatting moved to bank cards page

export function WalletDashboard({
  balance,
  balanceText,
  bankCards,
  affectionCards,
  transactions,
  verifyPaymentPassword,
  onTopUp,
  onWithdraw,
  onAddBankCard,
  onChangePassword,
  onOpenTransactions,
  onOpenAffectionCards,
  onOpenBankCards,
  onOpenWealth,
}: Props) {
  const [displayBalance, setDisplayBalance] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [sheet, setSheet] = useState<OperationType>(null)
  const [amount, setAmount] = useState('')
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [bankNameInput, setBankNameInput] = useState<WalletBankName>('Lumi银行')
  const [bankDigits, setBankDigits] = useState('')
  const [changePwdOpen, setChangePwdOpen] = useState(false)
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const duration = 900
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      setDisplayBalance(balance * (1 - Math.pow(1 - progress, 3)))
      if (progress < 1) raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [balance])

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
  }, [])

  const showToast = (text: string) => {
    setToast(text)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200)
  }

  const parsedAmount = useMemo(() => {
    const value = parseFloat(amount)
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null
  }, [amount])

  const openOperation = (type: Exclude<OperationType, 'add-bank' | null>) => {
    if (bankCards.length === 0) {
      showToast('请先添加银行卡')
      return
    }
    setAmount('')
    setSheet(type)
  }

  const requestPay = () => {
    if (!parsedAmount) {
      showToast('请输入有效金额')
      return
    }
    setPin('')
    setPinError('')
    setPasswordOpen(true)
  }

  const submitPin = async (digit: string) => {
    const next = `${pin}${digit}`.slice(0, 6)
    setPin(next)
    if (next.length !== 6) return
    const ok = await verifyPaymentPassword(next)
    if (!ok) {
      setPin('')
      setPinError('支付密码错误')
      return
    }
    if (!parsedAmount || !sheet) return
    if (sheet === 'topup') {
      onTopUp(parsedAmount)
      showToast('充值成功')
    } else if (!onWithdraw(parsedAmount, bankCards[0]?.bankName || '银行卡')) {
      showToast('余额不足')
      setPasswordOpen(false)
      return
    } else {
      showToast('提现成功')
    }
    setPasswordOpen(false)
    setSheet(null)
    setAmount('')
    setPin('')
  }

  const activeChangeDots = nextPassword.length < 6 ? nextPassword.length : confirmPassword.length

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-transparent">
      <div className="h-full overflow-y-auto px-5 pb-8 pt-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto max-w-[560px]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] tracking-[0.28em] text-gray-400">WALLET</p>
              <p className="mt-2 text-[13px] text-gray-400">Lumi Balance</p>
            </div>
            <Pressable
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-100 bg-white shadow-sm"
            >
              <Settings2 size={18} className="text-gray-700" />
            </Pressable>
          </div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mt-8 text-center">
            <p
              className="text-[42px] font-semibold tracking-tight text-black tabular-nums sm:text-[54px]"
              style={{ fontFamily: 'ui-rounded, system-ui, "DIN Alternate", "SF Pro Display", sans-serif' }}
            >
              {formatCurrency(displayBalance)}
            </p>
            <p className="mt-2 text-[12px] text-gray-400">{balanceText}</p>
          </motion.div>

          <WealthNavCard onOpen={onOpenWealth} />

          <div className="mt-7 flex gap-3">
            {[
              { key: 'topup', label: '充值', en: 'Top Up' },
              { key: 'withdraw', label: '提现', en: 'Withdraw' },
            ].map((item) => (
              <Pressable
                key={item.key}
                type="button"
                onClick={() => openOperation(item.key as 'topup' | 'withdraw')}
                className="flex-1 rounded-full border border-gray-200 bg-white px-5 py-3 text-center shadow-sm transition-transform active:scale-[0.985]"
              >
                <span className="block text-[14px] font-medium text-black">{item.label}</span>
                <span className="mt-1 block text-[11px] tracking-[0.18em] text-gray-400">{item.en}</span>
              </Pressable>
            ))}
          </div>

          <div className="mt-10 grid gap-3">
            <Pressable
              type="button"
              onClick={onOpenAffectionCards}
              className="group relative overflow-hidden rounded-[28px] border border-white/60 bg-white/40 px-5 py-5 text-left shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] transition-transform active:scale-[0.99]"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ background: 'radial-gradient(circle at 22% 20%, rgba(255,255,255,0.55), transparent 58%)' }}
              />
              <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.75), transparent 45%)' }} />
              <div className="relative z-[1] flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/45 text-gray-700 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]">
                    <HeartHandshake size={18} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] tracking-[0.28em] text-gray-400">CARDS</p>
                    <p className="mt-2 truncate text-[18px] font-semibold text-black">亲情卡</p>
                    <p className="mt-1 text-[12px] text-gray-400">查看全部 {affectionCards.length} 张</p>
                  </div>
                </div>
                <ChevronRight className="size-5 text-gray-300" strokeWidth={1.8} />
              </div>
            </Pressable>

            <Pressable
              type="button"
              onClick={onOpenBankCards}
              className="group relative overflow-hidden rounded-[28px] border border-white/60 bg-white/40 px-5 py-5 text-left shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] transition-transform active:scale-[0.99]"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ background: 'radial-gradient(circle at 22% 20%, rgba(255,255,255,0.55), transparent 58%)' }}
              />
              <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.75), transparent 45%)' }} />
              <div className="relative z-[1] flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/45 text-gray-700 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]">
                    <CreditCard size={18} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] tracking-[0.28em] text-gray-400">BANK CARDS</p>
                    <p className="mt-2 truncate text-[18px] font-semibold text-black">银行卡</p>
                    <p className="mt-1 text-[12px] text-gray-400">查看全部 {bankCards.length} 张</p>
                  </div>
                </div>
                <ChevronRight className="size-5 text-gray-300" strokeWidth={1.8} />
              </div>
            </Pressable>
          </div>

          <div className="mt-10">
            <Pressable
              type="button"
              onClick={onOpenTransactions}
              className="group relative overflow-hidden rounded-[28px] border border-white/60 bg-white/40 px-5 py-5 text-left shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] transition-transform active:scale-[0.99]"
            >
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: 'radial-gradient(circle at 22% 20%, rgba(255,255,255,0.55), transparent 58%)' }} />
              <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.75), transparent 45%)' }} />
              <div className="relative z-[1] flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/45 text-gray-700 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]">
                    <ReceiptText size={18} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] tracking-[0.28em] text-gray-400">TRANSACTIONS</p>
                    <p className="mt-2 truncate text-[18px] font-semibold text-black">交易流水</p>
                    <p className="mt-1 text-[12px] text-gray-400">查看全部 {transactions.length} 笔记录</p>
                  </div>
                </div>
                <ChevronRight className="size-5 text-gray-300" strokeWidth={1.8} />
              </div>
            </Pressable>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 bg-black/10" onMouseDown={() => setMenuOpen(false)}>
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute right-5 top-16 w-[220px] rounded-[20px] border border-gray-100 bg-white p-2 shadow-lg"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Pressable
                type="button"
                onClick={() => {
                  setChangePwdOpen(true)
                  setMenuOpen(false)
                  setNextPassword('')
                  setConfirmPassword('')
                }}
                className="w-full rounded-[14px] px-4 py-3 text-left text-[14px] text-black hover:bg-gray-50"
              >
                修改支付密码
              </Pressable>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {sheet ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 flex flex-col justify-end bg-black/25">
            <Pressable type="button" onClick={() => setSheet(null)} className="min-h-0 flex-1">
              {null}
            </Pressable>
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-t-[30px] border-t border-[#ece8e2] bg-gradient-to-b from-white to-[#faf8f4] px-5 pb-[max(18px,env(safe-area-inset-bottom,0px))] pt-5"
            >
              {sheet === 'add-bank' ? (
                <>
                  <p className="text-center text-[11px] tracking-[0.28em] text-gray-400">BANK BINDING</p>
                  <h3 className="mt-2 text-center text-[24px] font-semibold text-black">添加银行卡</h3>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {(['Lumi银行', 'LU宝银行', 'Luum银行'] as WalletBankName[]).map((bn) => (
                      <Pressable
                        key={bn}
                        type="button"
                        onClick={() => setBankNameInput(bn)}
                        className={`rounded-full border px-4 py-2 text-[13px] transition-transform active:scale-[0.98] ${
                          bankNameInput === bn ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-black'
                        }`}
                      >
                        {bn}
                      </Pressable>
                    ))}
                  </div>
                  <div className="mt-4 rounded-[20px] border border-gray-200 bg-white px-4 py-4">
                    <p className="text-[11px] tracking-[0.22em] text-gray-400">LAST 4 DIGITS</p>
                    <p className="mt-3 text-[28px] font-semibold tracking-[0.32em] text-black">{bankDigits.padEnd(4, '•')}</p>
                  </div>
                  <div className="mt-4">
                    <CustomNumericKeyboard
                      variant="pin"
                      tone="platinum"
                      onKey={(key) => {
                        if (key === '.') return
                        if (key === 'back') {
                          setBankDigits((prev) => prev.slice(0, -1))
                          return
                        }
                        setBankDigits((prev) => (prev.length >= 4 ? prev : `${prev}${key}`))
                      }}
                    />
                  </div>
                  <Pressable
                    type="button"
                    onClick={() => {
                      if (bankDigits.length !== 4) {
                        showToast('请输入尾号 4 位')
                        return
                      }
                      const res = onAddBankCard(bankNameInput, bankDigits)
                      if (!res.ok) {
                        showToast('该银行最多可申请 3 张卡')
                        return
                      }
                      setSheet(null)
                      showToast('银行卡已添加')
                    }}
                    className="mt-4 flex h-12 items-center justify-center rounded-full bg-black text-[15px] font-medium text-white"
                  >
                    确认添加
                  </Pressable>
                </>
              ) : (
                <>
                  <p className="text-center text-[11px] tracking-[0.28em] text-gray-400">{sheet === 'topup' ? 'TOP UP' : 'WITHDRAW'}</p>
                  <h3 className="mt-2 text-center text-[24px] font-semibold text-black">{sheet === 'topup' ? '充值金额' : '提现金额'}</h3>
                  <div className="mt-6 rounded-[24px] border border-gray-100 bg-white px-4 py-5 text-center shadow-sm">
                    <p className="text-[12px] text-gray-400">{sheet === 'topup' ? '请选择充值金额' : `默认到账 ${bankCards[0]?.bankName || '银行卡'}`}</p>
                    <p className="mt-3 text-[36px] font-semibold tabular-nums text-black">{parsedAmount ? formatCurrency(parsedAmount) : '¥ 0.00'}</p>
                  </div>
                  <div className="mt-5">
                    <CustomNumericKeyboard variant="amount" tone="platinum" onKey={(key) => setAmount((prev) => applyAmountInput(prev, key))} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div aria-hidden />
                    <Pressable
                      type="button"
                      onClick={requestPay}
                      className="flex h-12 w-[120%] items-center justify-center justify-self-center rounded-full bg-black text-[15px] font-medium text-white"
                    >
                      继续
                    </Pressable>
                    <div aria-hidden />
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {passwordOpen ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col justify-end bg-black/25">
            <Pressable type="button" onClick={() => setPasswordOpen(false)} className="min-h-0 flex-1">
              {null}
            </Pressable>
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-t-[30px] border-t border-[#ece8e2] bg-gradient-to-b from-white to-[#faf8f4] px-5 pb-[max(18px,env(safe-area-inset-bottom,0px))] pt-5"
            >
              <p className="text-center text-[11px] tracking-[0.28em] text-gray-400">SECURE PAY</p>
              <h3 className="mt-2 text-center text-[24px] font-semibold text-black">输入支付密码</h3>
              <div className="mt-4 flex justify-center gap-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <motion.span
                    key={i}
                    animate={i < pin.length ? { scale: [1.18, 1], backgroundColor: '#111111' } : { scale: 1, backgroundColor: 'rgba(255,255,255,0)' }}
                    transition={{ duration: 0.18 }}
                    className="h-3.5 w-3.5 rounded-full border border-gray-300"
                  />
                ))}
              </div>
              {pinError ? <p className="mt-3 text-center text-[12px] text-[#d95050]">{pinError}</p> : null}
              <div className="mt-5">
                <CustomNumericKeyboard
                  variant="pin"
                  tone="platinum"
                  onKey={(key) => {
                    if (key === '.') return
                    if (key === 'back') {
                      setPin((prev) => prev.slice(0, -1))
                      return
                    }
                    void submitPin(key)
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {changePwdOpen ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex flex-col justify-end bg-black/25">
            <Pressable type="button" onClick={() => setChangePwdOpen(false)} className="min-h-0 flex-1">
              {null}
            </Pressable>
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-t-[30px] border-t border-[#ece8e2] bg-gradient-to-b from-white to-[#faf8f4] px-5 pb-[max(18px,env(safe-area-inset-bottom,0px))] pt-5"
            >
              <p className="text-center text-[11px] tracking-[0.28em] text-gray-400">PASSWORD RESET</p>
              <h3 className="mt-2 text-center text-[24px] font-semibold text-black">修改支付密码</h3>
              <p className="mt-2 text-center text-[12px] text-gray-400">{nextPassword.length < 6 ? '请输入新的 6 位密码' : '请再次输入确认'}</p>
              <div className="mt-4 flex justify-center gap-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <motion.span
                    key={i}
                    animate={i < activeChangeDots ? { scale: [1.18, 1], backgroundColor: '#111111' } : { scale: 1, backgroundColor: 'rgba(255,255,255,0)' }}
                    transition={{ duration: 0.18 }}
                    className="h-3.5 w-3.5 rounded-full border border-gray-300"
                  />
                ))}
              </div>
              <div className="mt-5">
                <CustomNumericKeyboard
                  variant="pin"
                  tone="platinum"
                  onKey={(key) => {
                    if (key === '.') return
                    if (key === 'back') {
                      if (nextPassword.length >= 6) {
                        setConfirmPassword((prev) => prev.slice(0, -1))
                      } else {
                        setNextPassword((prev) => prev.slice(0, -1))
                      }
                      return
                    }
                    if (nextPassword.length < 6) {
                      setNextPassword((prev) => `${prev}${key}`.slice(0, 6))
                      return
                    }
                    const next = `${confirmPassword}${key}`.slice(0, 6)
                    setConfirmPassword(next)
                    if (next.length !== 6) return
                    if (next !== nextPassword) {
                      setNextPassword('')
                      setConfirmPassword('')
                      showToast('两次输入不一致')
                      return
                    }
                    onChangePassword(next)
                    setChangePwdOpen(false)
                    showToast('支付密码已更新')
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-none absolute left-1/2 top-6 z-[60] -translate-x-1/2 rounded-full bg-black px-4 py-2 text-[12px] text-white shadow-lg"
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
