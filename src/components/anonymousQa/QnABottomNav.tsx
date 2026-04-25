import { Home, User } from 'lucide-react'
import { motion } from 'framer-motion'

export type QnATab = 'home' | 'profile'

type QnABottomNavProps = {
  active: QnATab
  onHome: () => void
  onProfile: () => void
  onAsk: () => void
}

export function QnABottomNav({ active, onHome, onProfile, onAsk }: QnABottomNavProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center pb-[max(12px,env(safe-area-inset-bottom))]">
      <div
        className="pointer-events-auto flex items-end gap-10 rounded-[28px] border border-black/8 bg-white/78 px-10 py-2.5 shadow-[0_-8px_32px_rgba(0,0,0,0.06)] backdrop-blur-xl"
        style={{ marginBottom: 4 }}
      >
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={onHome}
          className={`flex flex-col items-center gap-0.5 ${active === 'home' ? 'text-[#111827]' : 'text-[#9CA3AF]'}`}
        >
          <Home className="size-5" strokeWidth={1.5} />
          <span className="text-[9px] tracking-[0.2em]">HOME</span>
        </motion.button>

        <div className="relative -mt-7 flex flex-col items-center">
          <motion.span
            aria-hidden
            className="pointer-events-none absolute top-2 h-14 w-14 rounded-full border border-[#111827]/15"
            animate={{ scale: [1, 1.28, 1], opacity: [0.34, 0.06, 0.34] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.span
            aria-hidden
            className="pointer-events-none absolute top-2 h-14 w-14 rounded-full bg-[radial-gradient(circle,rgba(17,24,39,0.22),rgba(17,24,39,0.01)_62%)]"
            animate={{ scale: [0.95, 1.18, 0.95], opacity: [0.36, 0.12, 0.36] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.16 }}
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onAsk}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-black/10 bg-[#111827] text-white shadow-[0_8px_28px_rgba(0,0,0,0.18)]"
            animate={{
              boxShadow: [
                '0 8px 28px rgba(0,0,0,0.18)',
                '0 8px 36px rgba(17,24,39,0.35)',
                '0 8px 28px rgba(0,0,0,0.18)',
              ],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="text-[28px] font-light leading-none">+</span>
          </motion.button>
          <span className="mt-1 text-[9px] tracking-[0.2em] text-[#9CA3AF]">ASK</span>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={onProfile}
          className={`flex flex-col items-center gap-0.5 ${active === 'profile' ? 'text-[#111827]' : 'text-[#9CA3AF]'}`}
        >
          <User className="size-5" strokeWidth={1.5} />
          <span className="text-[9px] tracking-[0.2em]">PROFILE</span>
        </motion.button>
      </div>
    </div>
  )
}
