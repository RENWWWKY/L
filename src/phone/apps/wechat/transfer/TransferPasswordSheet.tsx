import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { CustomNumericKeyboard } from '../redPacket/CustomNumericKeyboard'

const GOLD = '#c9a76a'

/**
 * Lumi 转账：白金风 6 位支付面板（与红包逻辑一致，避免在 setState updater 内提交）。
 */
export function TransferPasswordSheet({
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
          key="transfer-pwd"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)' }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-t-[22px] border-t border-[#ebe4d8] px-5 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-5"
            style={{
              background: 'linear-gradient(180deg, #ffffff 0%, #faf8f4 100%)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.06)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-1 text-center text-[11px] font-medium tracking-[0.22em] text-[#a8a299]">SECURE PAY</div>
            <div className="text-center text-[13px] text-[#6b6b6b]">支付金额</div>
            <div
              className="mt-2 text-center text-[32px] font-semibold tabular-nums"
              style={{
                fontFamily: 'ui-rounded, system-ui, "SF Pro Display", "DIN Alternate", sans-serif',
                color: GOLD,
              }}
            >
              ¥{fmt}
            </div>
            <div className="mt-6 flex justify-center gap-3" aria-label="密码位数">
              {Array.from({ length: 6 }, (_, i) => (
                <span
                  key={i}
                  className="h-3 w-3 rounded-full border transition-colors duration-150"
                  style={{
                    borderColor: GOLD,
                    backgroundColor: i < pin.length ? GOLD : 'transparent',
                    opacity: i < pin.length ? 0.95 : 0.35,
                  }}
                />
              ))}
            </div>
            <div className="mt-6">
              <CustomNumericKeyboard variant="pin" onKey={onKey} />
            </div>
            <Pressable type="button" onClick={onClose} className="mt-3 w-full py-2 text-center text-[14px] text-[#9a958c]">
              取消
            </Pressable>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
