import { ChevronLeft, CreditCard, Landmark, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { CustomNumericKeyboard } from '../redPacket/CustomNumericKeyboard'
import type { WalletBankCard, WalletBankName } from './walletMockStore'
import { useWalletMockStore } from './walletMockStore'

import walletBg from '../../../../../image/钱包页背景图.png'

import bankBgLumi from '../../../../../image/银行卡1.png'
import bankBgLuBao from '../../../../../image/银行卡2.jpg'
import bankBgLuum from '../../../../../image/银行卡3.jpg'

function bankBgByName(name: WalletBankName) {
  if (name === 'Lumi银行') return bankBgLumi
  if (name === 'LU宝银行') return bankBgLuBao
  return bankBgLuum
}

function formatCardNumber(num: string) {
  const digits = String(num || '').replace(/[^\d]/g, '').slice(-16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function applyDigits(prev: string, key: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'back') {
  if (key === 'back') return prev.slice(0, -1)
  const next = `${prev}${key}`.replace(/[^\d]/g, '').slice(0, 4)
  return next
}

export function WalletBankCardsPage({ onBack }: { onBack: () => void }) {
  const { snapshot, addBankCard, banks, maxCardsPerBank } = useWalletMockStore()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [bankNameInput, setBankNameInput] = useState<WalletBankName>('Lumi银行')
  const [bankDigits, setBankDigits] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const bankCountByName = useMemo(() => {
    const m = new Map<WalletBankName, number>()
    banks.forEach((b) => m.set(b, 0))
    snapshot.bankCards.forEach((c) => m.set(c.bankName, (m.get(c.bankName) ?? 0) + 1))
    return m
  }, [banks, snapshot.bankCards])

  const canSubmit = bankDigits.replace(/[^\d]/g, '').length === 4

  const submit = () => {
    const res = addBankCard(bankNameInput, bankDigits)
    if (!res.ok) {
      setToast('该银行已达上限')
      return
    }
    setToast('银行卡已添加')
    setSheetOpen(false)
    setBankDigits('')
  }

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
          className="absolute inset-0 bg-no-repeat opacity-[0.85]"
          style={{
            backgroundImage: `url(${walletBg})`,
            backgroundPosition: 'center bottom',
            backgroundSize: 'cover',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/35 to-white/10" />
      </div>

      <header
        className="relative z-[1] flex shrink-0 items-center border-b border-white/60 bg-white/55 px-2 py-1 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
        style={{ paddingTop: 'max(6px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable type="button" aria-label="返回" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-full active:scale-[0.98]">
          <ChevronLeft className="size-6 text-black" strokeWidth={1.5} />
        </Pressable>
        <div className="min-w-0 flex-1 pr-11 text-center">
          <div className="text-[16px] font-semibold text-black">银行卡</div>
        </div>
      </header>

      <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto max-w-[560px]">
          <p className="text-[11px] tracking-[0.28em] text-gray-400">BANK CARDS</p>
          <p className="mt-2 text-[13px] text-gray-400">Bank Cards</p>

          <div className="mt-5 grid gap-3">
            {snapshot.bankCards.map((card: WalletBankCard) => (
              <div
                key={card.id}
                className={`relative overflow-hidden rounded-[24px] border px-5 py-4 text-black shadow-sm ${card.tone === 'gray' ? 'border-gray-200' : 'border-gray-200'}`}
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage: `url(${bankBgByName(card.bankName)})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <div className="pointer-events-none absolute inset-0 bg-gray-50/50 backdrop-blur-[2px]" />

                <div className="relative z-[1] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Landmark size={16} className="text-black" />
                    <p className="text-[14px] text-black">{card.bankName}</p>
                  </div>
                  <CreditCard size={16} className="text-black opacity-70" />
                </div>
                <p className="relative z-[1] mt-8 text-[18px] tracking-[0.22em] tabular-nums text-black">
                  {formatCardNumber((card as any).number ?? '')}
                </p>
              </div>
            ))}

            <Pressable
              type="button"
              onClick={() => {
                setBankDigits('')
                setBankNameInput('Lumi银行')
                setSheetOpen(true)
              }}
              className="flex min-h-[112px] items-center justify-center rounded-[24px] border border-dashed border-gray-200 bg-white text-gray-500 shadow-sm"
            >
              <div className="text-center">
                <Plus className="mx-auto" size={18} />
                <p className="mt-2 text-[14px] font-medium text-gray-700">添加新银行卡</p>
              </div>
            </Pressable>
          </div>
        </div>
      </div>

      {sheetOpen ? (
        <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/25">
          <Pressable type="button" onClick={() => setSheetOpen(false)} className="min-h-0 flex-1" />
          <div className="rounded-t-[28px] bg-white px-5 pb-6 pt-5">
            <p className="text-center text-[16px] font-semibold text-black">添加银行卡</p>
            <p className="mt-2 text-center text-[12px] text-gray-400">每家银行最多 {maxCardsPerBank} 张</p>

            <div className="mt-5 flex gap-2">
              {banks.map((b) => {
                const active = b === bankNameInput
                const count = bankCountByName.get(b) ?? 0
                const disabled = count >= maxCardsPerBank
                return (
                  <Pressable
                    key={b}
                    type="button"
                    disabled={disabled}
                    onClick={() => setBankNameInput(b)}
                    className={`flex-1 rounded-full border px-3 py-2 text-center text-[12px] ${
                      active ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-black'
                    } ${disabled ? 'opacity-40' : ''}`}
                  >
                    {b}
                  </Pressable>
                )
              })}
            </div>

            <div className="mt-5 rounded-[20px] border border-gray-200 bg-gray-50 px-5 py-4">
              <p className="text-[12px] text-gray-400">卡号后四位</p>
              <p className="mt-2 text-[26px] font-semibold tracking-[0.28em] tabular-nums text-black">
                {bankDigits.padEnd(4, '•')}
              </p>
            </div>

            <div className="mt-5">
              <CustomNumericKeyboard
                variant="pin"
                onKey={(k) => {
                  if (k === '.') return
                  setBankDigits((prev) => applyDigits(prev, k))
                }}
              />
            </div>

            <Pressable
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className={`mt-5 w-full rounded-full px-5 py-3 text-center text-[14px] font-medium ${
                canSubmit ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              确认添加
            </Pressable>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top,0px)+16px)] z-40 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-[12px] text-white">
          {toast}
        </div>
      ) : null}
    </motion.div>
  )
}

