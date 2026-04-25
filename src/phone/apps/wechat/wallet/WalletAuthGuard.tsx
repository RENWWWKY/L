import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { CustomNumericKeyboard } from '../redPacket/CustomNumericKeyboard'

type Props = {
  isReady: boolean
  onComplete: (pin: string) => void
  children: ReactNode
}

export function WalletAuthGuard({ isReady, onComplete, children }: Props) {
  const [firstPin, setFirstPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [success, setSuccess] = useState(false)
  const [hint, setHint] = useState('请输入 6 位支付密码')

  useEffect(() => {
    if (isReady) {
      setFirstPin('')
      setConfirmPin('')
      setSuccess(false)
      setHint('请输入 6 位支付密码')
    }
  }, [isReady])

  const currentLength = useMemo(() => (firstPin.length < 6 ? firstPin.length : confirmPin.length), [confirmPin.length, firstPin.length])

  if (isReady) return <>{children}</>

  const activeConfirm = firstPin.length >= 6

  const handleKey = (key: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back') => {
    if (success) return
    if (key === '.') return
    if (key === 'back') {
      if (activeConfirm) {
        setConfirmPin((prev) => prev.slice(0, -1))
      } else {
        setFirstPin((prev) => prev.slice(0, -1))
      }
      return
    }

    if (!activeConfirm) {
      const next = `${firstPin}${key}`.slice(0, 6)
      setFirstPin(next)
      if (next.length === 6) setHint('请再次输入确认')
      return
    }

    const next = `${confirmPin}${key}`.slice(0, 6)
    setConfirmPin(next)
    if (next.length !== 6) return
    if (next !== firstPin) {
      setFirstPin('')
      setConfirmPin('')
      setHint('两次输入不一致，请重新设定')
      return
    }

    setSuccess(true)
    setHint('设定成功')
    window.setTimeout(() => {
      onComplete(next)
    }, 720)
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <AnimatePresence>
        {success ? (
          <motion.div
            className="pointer-events-none absolute inset-0 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'radial-gradient(circle at center, rgba(214,214,214,0.42) 0%, rgba(255,255,255,0.96) 44%, rgba(255,255,255,1) 72%)' }}
          />
        ) : null}
      </AnimatePresence>

      <div className="flex flex-1 flex-col items-center justify-center px-8 pb-10">
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-[12px] tracking-[0.3em] text-gray-400">
          WALLET SECURITY
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-4 text-center text-[30px] font-semibold tracking-tight text-black"
        >
          Set Payment Password
        </motion.h1>
        <p className="mt-3 text-[13px] text-gray-400">{hint}</p>

        <div className="mt-10 flex items-center gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <motion.span
              key={i}
              animate={i < currentLength ? { scale: [1.2, 1], backgroundColor: '#111111' } : { scale: 1, backgroundColor: 'rgba(255,255,255,0)' }}
              transition={{ duration: 0.22 }}
              className="h-3.5 w-3.5 rounded-full border border-gray-300"
            />
          ))}
        </div>
      </div>

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.32 }}
        className="rounded-t-[32px] border-t border-[#ede9e2] bg-gradient-to-b from-white to-[#faf8f4] px-5 pb-[max(18px,env(safe-area-inset-bottom,0px))] pt-5"
      >
        <CustomNumericKeyboard variant="pin" onKey={handleKey} tone="platinum" />
      </motion.div>
    </div>
  )
}
