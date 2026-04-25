import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { Pressable } from '../../../../components/Pressable'

const CEREMONY_LINES = [
  '正在解析近期记忆...',
  '正在同步情绪脉络...',
  '正在比对已删除片段...',
  '正在重建私密备忘录...',
]

export function AIGenerateModal({
  open,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: (params: { count: number; bias: string }) => void
}) {
  const [countInput, setCountInput] = useState('2')
  const [bias, setBias] = useState('吃醋、日常细节、隐藏情绪')
  const [lineIndex, setLineIndex] = useState(0)

  useEffect(() => {
    if (!busy) return
    const id = window.setInterval(() => {
      setLineIndex((v) => (v + 1) % CEREMONY_LINES.length)
    }, 900)
    return () => window.clearInterval(id)
  }, [busy])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[1420] flex items-end bg-black/22 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) onClose()
          }}
        >
          {busy ? (
            <motion.div
              className="absolute inset-0 flex items-center justify-center bg-black/25"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-[320px] rounded-2xl border border-black/10 bg-white/86 p-5 backdrop-blur-md">
                <div className="text-center text-[12px] tracking-[0.14em] text-gray-500">记忆同步中</div>
                <motion.div
                  className="mt-4 h-px w-full bg-black"
                  animate={{ opacity: [0.2, 1, 0.2], scaleX: [0.94, 1, 0.94] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  key={lineIndex}
                  className="mt-4 h-5 text-center font-mono text-[12px] text-gray-700"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  {CEREMONY_LINES[lineIndex]}
                </motion.div>
              </div>
            </motion.div>
          ) : null}

          {!busy ? (
            <motion.div
              className="relative w-full rounded-[20px] border border-gray-200 bg-white/86 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] backdrop-blur-lg"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
            >
              <div className="text-[16px] text-gray-800">AI 生成备忘录</div>
              <div className="mt-3 text-[12px] text-gray-400">生成条数（1-10）</div>
              <input
                type="number"
                min={1}
                max={10}
                value={countInput}
                onChange={(e) => setCountInput(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none"
              />
              <div className="mt-3 text-[12px] text-gray-400">内容偏向</div>
              <textarea
                rows={3}
                value={bias}
                onChange={(e) => setBias(e.target.value)}
                className="mt-1 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none"
              />
              {error ? <div className="mt-2 text-[12px] text-red-500">{error}</div> : null}
              <Pressable
                type="button"
                className="mt-4 h-11 w-full rounded-xl bg-black text-[14px] text-white active:scale-[0.99]"
                onClick={() => {
                  const parsed = Number(countInput)
                  const count = Number.isFinite(parsed) ? Math.min(10, Math.max(1, Math.round(parsed))) : 1
                  onSubmit({ count, bias })
                }}
              >
                开始生成
              </Pressable>
            </motion.div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

