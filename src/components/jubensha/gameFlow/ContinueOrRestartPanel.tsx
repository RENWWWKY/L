import './jbs-game-flow.css'

import { motion } from 'framer-motion'
import { ArrowLeft, BookOpen, RotateCcw } from 'lucide-react'

import type { JubenshaScript } from '../types'

import { summarizeJbsProgress, type JbsScriptProgress } from './jbsProgressStore'

export type ContinueOrRestartPanelProps = {
  script: JubenshaScript
  progress: JbsScriptProgress
  onContinue: () => void
  onRestart: () => void
  onExit: () => void
}

export function ContinueOrRestartPanel({
  script,
  progress,
  onContinue,
  onRestart,
  onExit,
}: ContinueOrRestartPanelProps) {
  const summary = summarizeJbsProgress(progress)

  return (
    <motion.div
      className="jbs-gf-root jbs-gf-obsidian-bg absolute inset-0 z-[60] flex min-h-0 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <header className="jbs-safe-header relative z-10 shrink-0 px-4 pb-2 pt-2">
        <button
          type="button"
          onClick={onExit}
          className="flex size-9 items-center justify-center rounded-full border border-[#5c3d2e]/25 text-[#5c3d2e] transition-colors hover:bg-[#5c3d2e]/8"
          aria-label="返回"
        >
          <ArrowLeft className="size-5" strokeWidth={1.5} />
        </button>
      </header>

      <motion.div
        className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-12"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="jbs-font-serif text-[10px] tracking-[0.28em] text-[#5c3d2e]/55">未完成的卷宗</p>
        <h2 className="jbs-font-handwriting mt-2 text-center text-[26px] leading-tight text-[#1a1a1a]">
          《{script.title}》
        </h2>
        <p className="jbs-font-serif mt-2 text-center text-[12px] leading-relaxed text-[#5c3d2e]/70">
          检测到本局尚有存档，是否从上次进度继续？
        </p>

        <motion.div
          className="jbs-gf-resume-card mt-8 w-full max-w-[340px] rounded-[14px] border border-[#5c3d2e]/18 bg-[#faf8f5]/95 px-5 py-4 shadow-[0_12px_32px_rgba(92,61,46,0.08)]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.4 }}
        >
          <dl className="space-y-3">
            <motion.div
              className="flex items-start justify-between gap-3"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
            >
              <dt className="jbs-font-serif shrink-0 text-[11px] tracking-[0.12em] text-[#5c3d2e]/55">扮演角色</dt>
              <dd className="jbs-font-handwriting text-right text-[15px] text-[#1a1a1a]">{summary.roleName}</dd>
            </motion.div>
            <motion.div
              className="flex items-start justify-between gap-3"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <dt className="jbs-font-serif shrink-0 text-[11px] tracking-[0.12em] text-[#5c3d2e]/55">当前进程</dt>
              <dd className="jbs-font-serif text-right text-[13px] leading-snug text-[#5c3d2e]">{summary.stepLabel}</dd>
            </motion.div>
            <motion.div
              className="flex items-start justify-between gap-3"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
            >
              <dt className="jbs-font-serif shrink-0 text-[11px] tracking-[0.12em] text-[#5c3d2e]/55">所在环节</dt>
              <dd className="jbs-font-serif text-right text-[13px] text-[#5c3d2e]/80">{summary.phaseLabel}</dd>
            </motion.div>
            <motion.div
              className="flex items-start justify-between gap-3 border-t border-[#5c3d2e]/10 pt-3"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <dt className="jbs-font-serif shrink-0 text-[11px] tracking-[0.12em] text-[#5c3d2e]/55">上次存档</dt>
              <dd className="jbs-font-serif text-right text-[12px] tabular-nums text-[#1a1a1a]/45">
                {summary.savedAtLabel}
              </dd>
            </motion.div>
          </dl>
        </motion.div>

        <div className="mt-10 flex w-full max-w-[340px] flex-col gap-3">
          <button type="button" className="jbs-gf-btn-fate jbs-font-serif text-[14px]" onClick={onContinue}>
            <span className="inline-flex items-center justify-center gap-2">
              <BookOpen className="size-4" strokeWidth={1.5} />
              继续游玩
            </span>
            <span className="jbs-gf-btn-fate-sub">从存档处接续</span>
          </button>
          <button
            type="button"
            className="jbs-gf-btn-fate jbs-gf-btn-invite jbs-font-serif text-[13px]"
            onClick={onRestart}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <RotateCcw className="size-4" strokeWidth={1.5} />
              重新开始
            </span>
            <span className="jbs-gf-btn-fate-sub">清除本剧本进度</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
