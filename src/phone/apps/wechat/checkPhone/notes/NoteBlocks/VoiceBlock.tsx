import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Play } from 'lucide-react'

export function VoiceBlock({ duration, transcript }: { duration: string; transcript: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="my-4">
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.985 }}
        className="flex w-full items-center justify-between rounded-full border border-black/10 bg-[#1f1f1f] px-4 py-3 text-left shadow-[0_6px_18px_rgba(0,0,0,0.12)]"
      >
        <span className="flex items-center gap-3 text-white/90">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/12">
            <Play size={14} />
          </span>
          <span className="text-[13px] tracking-[0.08em]">{open ? '收起转录' : '语音备忘'}</span>
        </span>
        <span className="font-mono text-[12px] text-white/65">{duration}</span>
      </motion.button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-2xl border border-black/10 bg-black/[0.04] px-4 py-3 text-[14px] leading-7 text-[#3b3b3b]">
              {transcript}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

