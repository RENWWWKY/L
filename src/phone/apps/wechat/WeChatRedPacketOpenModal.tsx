import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { toMoneyText } from './redPacketUtils'

const EASE = [0.4, 0, 0.2, 1] as const

export function WeChatRedPacketOpenModal({
  open,
  senderName,
  remark,
  amount,
  opened,
  onClose,
  onOpen,
}: {
  open: boolean
  senderName: string
  remark: string
  amount: number
  opened: boolean
  onClose: () => void
  onOpen: () => Promise<void>
}) {
  const [opening, setOpening] = useState(false)
  const [done, setDone] = useState(opened)

  const showDone = opened || done

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/50 px-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 14, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="w-full max-w-[320px] overflow-hidden rounded-3xl bg-[#bd4f2f]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="h-28 bg-[#a94227]" />
            <div className="-mt-6 px-6 pb-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e8be74] text-[16px] text-[#5f2d16]">
                福
              </div>
              <p className="mt-3 text-[14px] text-[#fbe4c5]">{senderName} 的红包</p>
              <p className="mt-1 text-[12px] text-[#f4ceb2]">{remark || '恭喜发财，大吉大利'}</p>

              {!showDone ? (
                <Pressable
                  type="button"
                  disabled={opening}
                  onClick={async () => {
                    if (opening) return
                    setOpening(true)
                    await new Promise((r) => window.setTimeout(r, 650))
                    await onOpen()
                    setDone(true)
                    setOpening(false)
                  }}
                  className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#f0c56f] text-[24px] text-[#7a3e1a] active:opacity-90"
                  style={{
                    transformStyle: 'preserve-3d',
                    animation: opening ? 'wx-rp-open-spin 0.8s linear infinite' : undefined,
                  }}
                >
                  開
                </Pressable>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: EASE }}
                  className="mt-6 rounded-2xl bg-white/90 py-4"
                >
                  <p className="text-[30px] font-semibold tabular-nums text-black">￥{toMoneyText(amount)}</p>
                  <p className="mt-1 text-[12px] text-[#666]">已存入钱包，可直接提现</p>
                </motion.div>
              )}

              <Pressable
                type="button"
                onClick={onClose}
                className="mt-5 text-[13px] text-[#f6d8be] underline underline-offset-2 active:opacity-80"
              >
                关闭
              </Pressable>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
