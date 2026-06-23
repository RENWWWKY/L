import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

type Props = {
  open: boolean
}

export function AccountStatusCheckingOverlay({ open }: Props) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[10001] flex items-center justify-center px-5 py-6 sm:px-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-label="正在检测账号状态"
          aria-busy="true"
        >
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" />
          <motion.div
            className="relative w-full max-w-[400px] rounded-[20px] border border-black/10 bg-white px-5 py-6 text-center text-[#1C1C1E] shadow-[0_24px_60px_rgba(28,28,30,0.2)] sm:px-6 sm:py-7"
            initial={{ y: 12, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F6]">
              <Loader2 className="h-6 w-6 animate-spin text-[#4F46E5]" aria-hidden />
            </div>
            <h2 className="mt-4 text-[18px] font-semibold sm:text-[20px]">正在检测账号状态</h2>
            <p className="mt-3 text-[13px] leading-6 text-[#1C1C1E]/65 sm:text-[14px]">
              本次打开页面后将联网验证账号状态一次，最多等待 10 秒。
            </p>
            <p className="mt-2 text-[12px] leading-5 text-[#1C1C1E]/45">
              若超时或连不上服务器，请打开梯子（VPN）后点击重新验证；验证成功前无法进入。
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
