import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

type AnswerComposePageProps = {
  questionBody: string
  onBack: () => void
  onSubmit: (text: string) => void
}

export function AnswerComposePage({ questionBody, onBack, onSubmit }: AnswerComposePageProps) {
  const [draft, setDraft] = useState('')

  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col bg-[#FAFAFA]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <header
        className="flex shrink-0 items-center justify-between border-b border-black/6 bg-white/95 px-3 pb-2 backdrop-blur-md"
        style={{ paddingTop: 'max(0px, env(safe-area-inset-top, 0px))' }}
      >
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#111827]"
        >
          <ArrowLeft className="size-5" />
        </motion.button>
        <h1 className="text-[16px] font-semibold text-[#111827]">匿问我答</h1>
        <div className="h-9 w-9" aria-hidden />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-6">
        <div className="relative overflow-hidden rounded-2xl border border-black/8 bg-[#FFFCF7] px-4 py-4 shadow-[0_4px_18px_rgba(0,0,0,0.05)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,245,238,0.7)), repeating-linear-gradient(0deg, rgba(17,24,39,0.035) 0, rgba(17,24,39,0.035) 1px, transparent 1px, transparent 24px)',
            }}
          />
          <div className="relative">
            <p className="text-[10px] tracking-[0.28em] text-[#9CA3AF]">QUESTION</p>
            <p className="mt-2 min-h-[4.5rem] text-[18px] leading-relaxed text-[#111827]">
              {questionBody}
            </p>
          </div>
        </div>

        <div className="relative mt-8 overflow-hidden rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(17,24,39,0.03),transparent_42%)]" />
          <p className="text-[11px] tracking-widest text-[#9CA3AF]">YOUR ANSWER</p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="写下你的回答……"
            className="mt-2 min-h-[160px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-[#111827] outline-none placeholder:text-[#9CA3AF]"
          />
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            const t = draft.trim()
            if (!t) return
            onSubmit(t)
          }}
          className="mt-6 w-full rounded-2xl bg-[#111827] py-3.5 text-[14px] font-medium text-white"
        >
          发送回答
        </motion.button>
      </div>
    </motion.div>
  )
}
