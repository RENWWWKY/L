import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, HeartHandshake } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { CustomNumericKeyboard } from '../redPacket/CustomNumericKeyboard'
import type { AffectionCard } from './walletMockStore'
import { useWalletMockStore } from './walletMockStore'

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

export function AffectionPayPage({
  peerName,
  peerAvatarUrl,
  onBack,
  onPaid,
}: {
  peerName: string
  peerAvatarUrl?: string
  onBack: () => void
  onPaid: (payload: { amountYuan: number; cardId: string; giverName: string; title: string }) => void | Promise<void>
}) {
  const { snapshot, verifyPaymentPassword, payWithAffection } = useWalletMockStore()
  const [selectedCardId, setSelectedCardId] = useState(snapshot.affectionCards[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('购买咖啡')
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const lastSubmitRef = useRef<string | null>(null)

  const selectedCard = useMemo(() => snapshot.affectionCards.find((c) => c.id === selectedCardId) ?? null, [selectedCardId, snapshot.affectionCards])

  const parsedAmount = useMemo(() => {
    const v = parseFloat(amount)
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
  }, [amount])

  const displayAmount = amount.trim() ? amount : '0.00'

  const startPay = () => {
    if (!snapshot.isPaymentPasswordSet) {
      window.alert('请先在「我-卡包」设定支付密码')
      return
    }
    if (!selectedCard) {
      window.alert('请选择亲情卡')
      return
    }
    if (!parsedAmount) {
      window.alert('请输入有效金额')
      return
    }
    if (selectedCard.monthlyRemaining < parsedAmount) {
      window.alert('本月剩余额度不足')
      return
    }
    setPin('')
    setPinError('')
    lastSubmitRef.current = null
    setPwdOpen(true)
  }

  const onPinKey = async (key: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back') => {
    if (key === '.') return
    if (key === 'back') {
      setPin((p) => p.slice(0, -1))
      return
    }
    const next = `${pin}${key}`.slice(0, 6)
    setPin(next)
    if (next.length !== 6) return
    if (lastSubmitRef.current === next) return
    lastSubmitRef.current = next
    const ok = await verifyPaymentPassword(next)
    if (!ok) {
      setPin('')
      setPinError('支付密码错误')
      lastSubmitRef.current = null
      return
    }
    if (!selectedCard || !parsedAmount) return
    const result = payWithAffection(selectedCard.id, parsedAmount, title.trim() || '亲情卡代付')
    if (!result.ok) {
      setPwdOpen(false)
      window.alert('支付失败：额度不足或卡片不可用')
      return
    }
    await Promise.resolve(onPaid({ amountYuan: parsedAmount, cardId: selectedCard.id, giverName: result.giverName, title: title.trim() || '亲情卡代付' }))
    setPwdOpen(false)
    onBack()
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full min-h-0 flex-col bg-white"
    >
      <header className="flex shrink-0 items-center border-b border-gray-100 bg-white px-2 py-1" style={{ paddingTop: 'max(6px, env(safe-area-inset-top, 0px))' }}>
        <Pressable type="button" aria-label="返回" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-full active:scale-[0.98]">
          <ChevronLeft className="size-6 text-black" strokeWidth={1.5} />
        </Pressable>
        <div className="min-w-0 flex-1 pr-11 text-center">
          <div className="text-[16px] font-semibold text-black">亲情卡支付</div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto max-w-[560px]">
          <div className="flex items-center gap-3 rounded-[22px] border border-gray-100 bg-white px-4 py-4 shadow-sm">
            {peerAvatarUrl?.trim() ? (
              <img src={peerAvatarUrl.trim()} alt="" className="h-12 w-12 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">?</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-black">给 {peerName}</p>
              <p className="mt-1 text-[11px] tracking-[0.18em] text-gray-400">AFFECTION PAY</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-100 bg-white">
              <HeartHandshake size={18} className="text-gray-700" />
            </div>
          </div>

          <div className="mt-7">
            <p className="text-[11px] tracking-[0.28em] text-gray-400">AMOUNT</p>
            <div
              role="textbox"
              aria-readonly
              tabIndex={0}
              className="mt-3 flex items-baseline justify-center gap-1 border-b border-gray-200 pb-3"
              style={{ touchAction: 'manipulation' }}
              onFocus={(e) => e.target.blur()}
            >
              <span className="text-[22px] font-medium text-black">¥</span>
              <span className="text-[44px] font-semibold tabular-nums tracking-tight text-black" style={{ fontFamily: 'ui-rounded, system-ui, "DIN Alternate", "SF Pro Display", sans-serif' }}>
                {displayAmount}
              </span>
            </div>
            <div className="mt-5">
              <CustomNumericKeyboard variant="amount" tone="platinum" onKey={(k) => setAmount((p) => applyAmountInput(p, k))} />
            </div>
          </div>

          <div className="mt-8">
            <p className="text-[11px] tracking-[0.28em] text-gray-400">TITLE</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 24))}
              className="mt-3 w-full rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-[14px] text-black outline-none"
              placeholder="消费说明（允许系统键盘）"
            />
          </div>

          <div className="mt-8">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] tracking-[0.28em] text-gray-400">CARDS</p>
                <p className="mt-2 text-[18px] font-semibold text-black">选择亲情卡</p>
              </div>
              {selectedCard ? <p className="text-[12px] text-gray-400">剩余 ¥{selectedCard.monthlyRemaining.toLocaleString()}</p> : null}
            </div>
            <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {snapshot.affectionCards.map((c: AffectionCard) => {
                const active = c.id === selectedCardId
                return (
                  <Pressable
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCardId(c.id)}
                    className={`relative min-w-[260px] snap-start overflow-hidden rounded-[24px] border px-4 py-4 text-left shadow-sm transition-transform active:scale-[0.99] ${
                      active ? 'border-black' : 'border-gray-100'
                    }`}
                    style={{
                      background:
                        'linear-gradient(145deg, rgba(242,242,242,0.95) 0%, rgba(214,214,214,0.84) 34%, rgba(158,158,158,0.78) 100%)',
                    }}
                  >
                    <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 -translate-x-full animate-[shimmer_3s_infinite]" />
                    <div className="relative z-[1] flex items-center gap-3">
                      <img src={c.giverAvatar} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/60" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-[#111]">{c.giverName}</p>
                        <p className="mt-1 text-[11px] tracking-[0.16em] text-[#666]">PLATINUM LINE</p>
                      </div>
                    </div>
                    <p className="relative z-[1] mt-5 text-[12px] text-[#555]">
                      Balance: ¥{c.monthlyRemaining.toLocaleString()} / Limit: ¥{c.monthlyLimit.toLocaleString()}
                    </p>
                  </Pressable>
                )
              })}
            </div>
          </div>

          <Pressable
            type="button"
            onClick={startPay}
            className="mt-10 flex h-12 w-full items-center justify-center rounded-full bg-black text-[15px] font-medium text-white transition-transform active:scale-[0.985]"
          >
            支付
          </Pressable>
        </div>
      </div>

      <AnimatePresence>
        {pwdOpen ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2400] flex flex-col justify-end bg-black/25">
            <Pressable type="button" onClick={() => setPwdOpen(false)} className="min-h-0 flex-1" aria-label="关闭支付密码面板">
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
              <p className="mt-2 text-center text-[13px] text-gray-500">支付金额</p>
              <p className="mt-2 text-center text-[32px] font-semibold tabular-nums text-black">¥{(parsedAmount ?? 0).toFixed(2)}</p>
              <div className="mt-5 flex justify-center gap-3">
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
                <CustomNumericKeyboard variant="pin" tone="platinum" onKey={onPinKey} />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}

