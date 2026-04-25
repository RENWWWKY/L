import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { CustomNumericKeyboard } from '../redPacket/CustomNumericKeyboard'

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

type SheetPhase = 'input' | 'sealing'

export function InvestmentSheet({
  open,
  productName,
  hint,
  onClose,
  onConfirm,
  onSealStart,
  onSealDone,
  panelRef,
  confirmButtonRef,
  presetAmount,
  overlayClassName,
}: {
  open: boolean
  productName: string
  hint?: string
  onClose: () => void
  onConfirm: (amountYuan: number) => void
  onSealStart?: () => void
  onSealDone?: () => void
  panelRef?: React.RefObject<HTMLDivElement | null>
  confirmButtonRef?: React.RefObject<HTMLButtonElement | null>
  presetAmount?: number
  /** 教程签约步需盖在 z-140 暗色层之上，默认 z-[120] */
  overlayClassName?: string
}) {
  const [amount, setAmount] = useState('')
  const [phase, setPhase] = useState<SheetPhase>('input')
  const parsed = useMemo(() => {
    const v = parseFloat(amount)
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
  }, [amount])

  useEffect(() => {
    if (!open) {
      setAmount('')
      setPhase('input')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (!Number.isFinite(presetAmount as number) || (presetAmount as number) <= 0) return
    setAmount(String(presetAmount))
  }, [open, presetAmount])

  const sealAndSubmit = () => {
    if (!parsed) return
    setPhase('sealing')
    onSealStart?.()
    window.setTimeout(() => {
      onConfirm(parsed)
      onSealDone?.()
      onClose()
    }, 960)
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={overlayClassName ?? 'absolute inset-0 z-[120] flex flex-col justify-end bg-black/28'}
        >
          <Pressable type="button" className="min-h-0 flex-1" onClick={onClose} aria-label="关闭">
            <span className="sr-only">关闭</span>
          </Pressable>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            ref={panelRef}
            className="relative overflow-hidden rounded-t-[32px] border-t border-white/60 bg-white/65 px-5 pb-[max(18px,env(safe-area-inset-bottom,0px))] pt-5 backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]"
          >
            <div className="pointer-events-none absolute inset-0 opacity-[0.1]" style={{ background: 'linear-gradient(140deg, rgba(255,255,255,0.95), transparent 48%)' }} />
            <div className="relative z-[1]">
              <p className="text-center text-[11px] tracking-[0.26em] text-gray-500">THE CONTRACT</p>
              <h3 className="mt-2 text-center text-[24px] font-semibold tracking-tight text-black">{productName}</h3>
              <p className="mt-1 text-center text-[12px] text-gray-500">{hint || '输入金额后签署契约'}</p>

              <div className="mt-5 rounded-[22px] border border-white/65 bg-white/45 px-4 py-5 text-center backdrop-blur-[12px] [-webkit-backdrop-filter:blur(12px)]">
                <p className="text-[11px] tracking-[0.22em] text-gray-400">AMOUNT</p>
                <p
                  className="mt-2 text-[40px] font-semibold tabular-nums text-black"
                  style={{ fontFamily: '"DIN Alternate", "SF Pro Display", ui-sans-serif, system-ui, sans-serif' }}
                >
                  {parsed ? `¥ ${parsed.toFixed(2)}` : '¥ 0.00'}
                </p>
              </div>

              <div className="mt-4">
                <CustomNumericKeyboard variant="amount" tone="platinum" onKey={(k) => setAmount((prev) => applyAmountInput(prev, k))} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div aria-hidden />
                <Pressable
                  type="button"
                  ref={confirmButtonRef}
                  disabled={!parsed || phase !== 'input'}
                  onClick={sealAndSubmit}
                  className={`flex h-12 w-[120%] items-center justify-center justify-self-center rounded-full text-[15px] font-medium ${
                    parsed && phase === 'input' ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  签署并买入
                </Pressable>
                <div aria-hidden />
              </div>
            </div>

            <AnimatePresence>
              {phase === 'sealing' ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[2] flex items-center justify-center bg-white/76 backdrop-blur-[8px]"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative rounded-[24px] border border-[#d6c39c] bg-white px-10 py-8 text-center shadow-[0_18px_46px_rgba(0,0,0,0.18)]"
                  >
                    <motion.div
                      initial={{ x: '-120%', opacity: 0 }}
                      animate={{ x: '120%', opacity: [0, 0.8, 0] }}
                      transition={{ duration: 0.78, ease: 'easeInOut' }}
                      className="pointer-events-none absolute inset-y-0 left-0 w-1/2 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white to-transparent"
                    />
                    <motion.p
                      initial={{ scale: 1.22, rotate: -8, opacity: 0 }}
                      animate={{ scale: 1, rotate: -8, opacity: 1 }}
                      transition={{ duration: 0.32, ease: [0.2, 1.2, 0.2, 1] }}
                      className="text-[34px] font-semibold tracking-[0.08em] text-[#b8995d]"
                      style={{ fontFamily: '"DIN Alternate", "Times New Roman", serif' }}
                    >
                      SEALED
                    </motion.p>
                    <p className="mt-2 text-[12px] tracking-[0.22em] text-gray-500">CONTRACT SIGNED</p>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

