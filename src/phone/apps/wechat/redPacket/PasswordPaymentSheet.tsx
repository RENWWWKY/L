import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { CustomNumericKeyboard } from './CustomNumericKeyboard'

/**
 * 6 位支付密码底部面板：展示应付金额、圆点进度、专用数字键盘。
 * 输满 6 位后触发 onComplete（由上层 Mock 扣款并关闭）。
 *
 * 注意：不要在 setState 的 updater 里调 onComplete / 写库。
 * React 18 开发模式下会双调 updater，会导致「一次支付、两条红包消息」。
 */
export function PasswordPaymentSheet({
  open,
  amountYuan,
  onClose,
  onComplete,
}: {
  open: boolean
  amountYuan: number
  onClose: () => void
  onComplete: (pin: string) => void | Promise<void>
}) {
  const [pin, setPin] = useState('')
  const completeRef = useRef(onComplete)
  completeRef.current = onComplete
  /** 同一串 6 位密码只提交一次（防 StrictMode / 重复 effect） */
  const lastSubmittedPinRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) {
      setPin('')
      lastSubmittedPinRef.current = null
    }
  }, [open])

  const onKey = useCallback(
    (key: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back') => {
      if (key === 'back') {
        setPin((p) => p.slice(0, -1))
        return
      }
      if (key === '.') return
      setPin((p) => {
        if (p.length >= 6) return p
        return p + key
      })
    },
    [],
  )

  useLayoutEffect(() => {
    if (!open || pin.length !== 6) return
    if (lastSubmittedPinRef.current === pin) return
    lastSubmittedPinRef.current = pin
    void Promise.resolve(completeRef.current(pin)).finally(() => {
      setPin('')
    })
  }, [open, pin])

  const fmt = amountYuan.toFixed(2)

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="pwd-sheet"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/45"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-t-[20px] bg-white px-5 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-5"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-1 text-center text-[11px] font-medium tracking-[0.2em] text-[#9a9a9a]">SECURE PAY</div>
            <div className="text-center text-[13px] text-[#666]">支付金额 · AMOUNT</div>
            <div
              className="mt-2 text-center text-[32px] font-semibold tabular-nums text-black"
              style={{
                fontFamily: 'ui-rounded, system-ui, "SF Pro Display", "DIN Alternate", sans-serif',
              }}
            >
              ¥{fmt}
            </div>
            <div className="mt-6 flex justify-center gap-3" aria-label="密码位数">
              {Array.from({ length: 6 }, (_, i) => (
                <span
                  key={i}
                  className="h-3 w-3 rounded-full border border-[#ccc]"
                  style={{ backgroundColor: i < pin.length ? '#111' : 'transparent' }}
                />
              ))}
            </div>
            <div className="mt-8">
              <CustomNumericKeyboard variant="pin" onKey={onKey} />
            </div>
            <Pressable
              type="button"
              onClick={onClose}
              className="mt-4 w-full py-3 text-center text-[14px] text-[#888] transition-transform active:scale-[0.98]"
            >
              取消
            </Pressable>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
