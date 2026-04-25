import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DatingStyleTuning } from './styleTuningStorage'
import { loadDatingStyleTuning, saveDatingStyleTuning } from './styleTuningStorage'

type Props = {
  open: boolean
  characterId: string
  onClose: () => void
  /** 保存后回传，便于父组件在发送时注入 genOptions */
  onSaved?: (v: DatingStyleTuning) => void
}

export function StyleSettingsDrawer({ open, characterId, onClose, onSaved }: Props) {
  const [stylePrompt, setStylePrompt] = useState('')
  const [referenceSnippet, setReferenceSnippet] = useState('')

  useEffect(() => {
    if (!open || !characterId.trim()) return
    const v = loadDatingStyleTuning(characterId)
    setStylePrompt(v.stylePrompt)
    setReferenceSnippet(v.referenceSnippet)
  }, [open, characterId])

  const save = () => {
    const v: DatingStyleTuning = { stylePrompt, referenceSnippet }
    saveDatingStyleTuning(characterId, v)
    onSaved?.(v)
    onClose()
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="style-drawer-root"
          className="fixed inset-0 z-[80] flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <motion.div
            role="presentation"
            className="absolute inset-0 bg-stone-900/25 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="style-drawer-title"
            className="relative z-[1] mx-auto w-full max-w-lg overflow-hidden rounded-t-[20px] border border-stone-200/80 bg-white/88 shadow-[0_-12px_40px_rgba(0,0,0,0.08)] backdrop-blur-xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-stone-300/80" />
            <div className="flex items-center justify-between border-b border-stone-100/90 px-4 py-3">
              <p id="style-drawer-title" className="text-[15px] font-semibold tracking-tight text-stone-900">
                文风设定
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[min(72vh,560px)] space-y-4 overflow-y-auto px-4 py-4 [scrollbar-width:thin]">
              <div>
                <label className="text-[12px] font-medium text-stone-600">目标文风描述（Style Prompt）</label>
                <textarea
                  value={stylePrompt}
                  onChange={(e) => setStylePrompt(e.target.value)}
                  rows={3}
                  placeholder="例如：古风、意识流、忧郁；或「克制白描、少形容词、对话推进」"
                  className="mt-1.5 w-full resize-y rounded-xl border border-stone-200/90 bg-white/90 px-3 py-2.5 text-[14px] leading-relaxed text-stone-900 outline-none ring-stone-300/0 transition-shadow focus:border-stone-400 focus:ring-2 focus:ring-stone-300/40"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-stone-600">参考片段示例（Few-shot Snippet）</label>
                <p className="mt-1 text-[10px] leading-snug text-stone-400">
                  请输入一段你喜欢的文字片段，AI 将深度模仿其行文节奏、句式和用词风格生成剧情（建议 400 字内）。
                </p>
                <textarea
                  value={referenceSnippet}
                  onChange={(e) => setReferenceSnippet(e.target.value)}
                  rows={8}
                  placeholder="粘贴节选：句式、标点节奏、感官密度越典型，模仿越稳。"
                  className="mt-1.5 w-full resize-y rounded-xl border border-stone-200/90 bg-white/90 px-3 py-2.5 text-[14px] leading-relaxed text-stone-900 outline-none transition-shadow focus:border-stone-400 focus:ring-2 focus:ring-stone-300/40"
                />
              </div>
              <p className="text-[11px] leading-relaxed text-stone-400">
                保存后写入本机；下次点击「发送」或「重新回复」时作为 System Prompt 的补充注入（与全局剧情规则并存，冲突时以更保守侧为准）。
              </p>
            </div>
            <div className="flex gap-2 border-t border-stone-100/90 px-4 py-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-stone-200 bg-white py-2.5 text-[14px] font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={save}
                className="flex-1 rounded-xl bg-stone-900 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-stone-800"
              >
                保存
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
