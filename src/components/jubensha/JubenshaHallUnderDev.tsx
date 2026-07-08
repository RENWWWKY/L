import './jubensha.css'

import { Construction, ArrowLeft } from 'lucide-react'

export type JubenshaHallUnderDevProps = {
  onBack: () => void
  className?: string
}

/** 剧本杀馆 · 开发中占位（保留返回发现页） */
export function JubenshaHallUnderDev({ onBack, className = '' }: JubenshaHallUnderDevProps) {
  return (
    <div className={`jbs-hall relative flex h-full min-h-0 flex-col ${className}`}>
      <header className="jbs-safe-header relative z-10 shrink-0 border-b border-[#5c3d2e]/15 bg-[#f4f1ea]/95 backdrop-blur-sm">
        <div className="relative flex min-h-[52px] items-center justify-center px-12">
          <button
            type="button"
            onClick={onBack}
            className="absolute left-0 flex size-9 items-center justify-center rounded-full border border-[#5c3d2e]/25 text-[#5c3d2e] transition-colors hover:bg-[#5c3d2e]/8"
            aria-label="返回发现"
          >
            <ArrowLeft className="size-5" strokeWidth={1.5} />
          </button>
          <div className="pointer-events-none w-full text-center">
            <h1 className="jbs-font-handwriting text-[22px] leading-none text-[#1a1a1a]">剧本杀馆</h1>
            <p className="jbs-font-serif mt-0.5 text-[10px] tracking-[0.2em] text-[#1a1a1a]/45">
              Classic Library · Mystery Archives
            </p>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-[320px] rounded-2xl border border-[#5c3d2e]/12 bg-[#faf8f3]/95 px-6 py-10 text-center shadow-[0_8px_32px_-12px_rgba(92,61,46,0.18)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#5c3d2e]/8 text-[#5c3d2e]/70">
            <Construction className="size-7" strokeWidth={1.5} aria-hidden />
          </div>
          <p className="jbs-font-serif mt-5 text-[17px] font-semibold tracking-[0.06em] text-[#1a1a1a]">
            功能开发中
          </p>
          <p className="jbs-font-serif mt-2 text-[14px] leading-relaxed text-[#1a1a1a]/55">
            典藏书架、选角入局、DM 主持与对局流程正在打磨中，暂未对外开放。
          </p>
          <p className="jbs-font-serif mt-4 text-[13px] tracking-[0.12em] text-[#1a1a1a]/40">敬请期待</p>
        </div>
      </main>
    </div>
  )
}
