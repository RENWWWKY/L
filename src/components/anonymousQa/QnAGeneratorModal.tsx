import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Sparkles, X } from 'lucide-react'
import { useState } from 'react'

import type { GeneratorStyle } from './aiGeneration'

type Props = {
  open: boolean
  loading?: boolean
  onClose: () => void
  onGenerate: (params: { style: GeneratorStyle; count: number; includeContacts: boolean }) => void
}

const STYLES: GeneratorStyle[] = ['情感八卦', '灵魂拷问', '奇葩吐槽', '深度探讨']

export function QnAGeneratorModal({ open, loading = false, onClose, onGenerate }: Props) {
  const [style, setStyle] = useState<GeneratorStyle>('情感八卦')
  const [count, setCount] = useState(5)
  const [includeContacts, setIncludeContacts] = useState(true)

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[1700] flex items-end justify-center bg-black/40 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[560px] rounded-t-3xl border border-black/8 bg-white p-4 shadow-[0_-12px_32px_rgba(0,0,0,0.14)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[#111827]" />
                <h3 className="text-[15px] font-semibold text-[#111827]">AI 生成</h3>
              </div>
              <button type="button" onClick={onClose} className="rounded-full p-1 text-[#6B7280]">
                <X className="size-4" />
              </button>
            </div>

            <p className="mt-4 text-[11px] tracking-[0.2em] text-[#9CA3AF]">STYLE</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STYLES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStyle(item)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] ${
                    style === item ? 'border-[#111827] bg-[#111827] text-white' : 'border-black/10 text-[#374151]'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] tracking-[0.2em] text-[#9CA3AF]">COUNT</p>
                <span className="text-[12px] text-[#111827]">{count}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-black/8 px-3 py-2">
              <div>
                <p className="text-[13px] text-[#111827]">包含通讯录好友</p>
                <p className="text-[11px] text-[#9CA3AF]">Include Contacts</p>
              </div>
              <button
                type="button"
                onClick={() => setIncludeContacts((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  includeContacts ? 'bg-[#111827]' : 'bg-[#D1D5DB]'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    includeContacts ? 'translate-x-[22px]' : 'translate-x-[2px]'
                  }`}
                />
              </button>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              onClick={() => onGenerate({ style, count, includeContacts })}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] py-3 text-[14px] font-medium text-white disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {loading ? '生成中...' : '开始生成'}
            </motion.button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

