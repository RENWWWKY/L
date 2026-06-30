import { Construction } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import { Pressable } from '../../../components/Pressable'

export function MiniGameUnderDevOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1400] flex flex-col bg-[#F9FAFB]"
        >
          <header
            className="flex shrink-0 items-center border-b border-[#E5E7EB]/80 px-3 pb-3"
            style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
          >
            <Pressable
              type="button"
              aria-label="返回"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Pressable>
            <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold text-[#0A0A0C]">
              一起玩游戏
            </h1>
            <div className="w-10 shrink-0" />
          </header>

          <div className="flex flex-1 flex-col items-center justify-center px-8">
            <div className="w-full max-w-[300px] rounded-2xl border border-[#E5E7EB] bg-white px-6 py-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F4F6] text-[#9CA3AF]">
                <Construction className="size-7" strokeWidth={1.5} aria-hidden />
              </div>
              <p className="mt-5 text-[17px] font-semibold text-[#0A0A0C]">功能开发中</p>
              <p className="mt-2 text-[14px] leading-relaxed text-[#6B7280]">
                小游戏沙盒正在打磨，完成后可在此与 TA 对局、旁观伴玩。
              </p>
              <p className="mt-4 text-[13px] text-[#9CA3AF]">敬请期待</p>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
