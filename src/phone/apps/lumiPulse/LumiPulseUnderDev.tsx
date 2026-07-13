import { ArrowLeft, Construction } from 'lucide-react'

import { PULSE_COLORS } from './constants'

export type LumiPulseUnderDevProps = {
  onBack: () => void
  className?: string
}

/** 微博广场 · 开发中占位（保留返回发现页） */
export function LumiPulseUnderDev({ onBack, className = '' }: LumiPulseUnderDevProps) {
  return (
    <div
      className={`relative flex h-full min-h-0 flex-col ${className}`}
      style={{ backgroundColor: PULSE_COLORS.bg, fontFamily: 'var(--phone-font)' }}
      data-phone-page="app"
      data-app-id="weibo"
    >
      <header
        className="shrink-0 border-b backdrop-blur-sm"
        style={{
          borderColor: PULSE_COLORS.hairline,
          backgroundColor: 'rgba(252,252,252,0.95)',
          paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
        }}
      >
        <div className="relative flex min-h-[52px] items-center justify-center px-12">
          <button
            type="button"
            onClick={onBack}
            className="absolute left-3 flex size-9 items-center justify-center rounded-full text-[#1C1C1E]/70 transition-colors hover:bg-black/[0.04]"
            aria-label="返回发现"
          >
            <ArrowLeft className="size-5" strokeWidth={1.5} />
          </button>
          <div className="pointer-events-none w-full text-center">
            <h1 className="text-[17px] font-semibold tracking-[0.02em] text-[#1C1C1E]">微博广场</h1>
            <p className="mt-0.5 text-[10px] tracking-[0.18em] text-[#9CA3AF]">Social Pulse · Lumi Square</p>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10">
        <div
          className="w-full max-w-[320px] rounded-2xl border px-6 py-10 text-center"
          style={{
            borderColor: PULSE_COLORS.hairline,
            backgroundColor: PULSE_COLORS.surface,
            boxShadow: '0 8px 32px -12px rgba(28,28,30,0.08)',
          }}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: `${PULSE_COLORS.dustyRose}22`, color: PULSE_COLORS.dustyRose }}
          >
            <Construction className="size-7" strokeWidth={1.5} aria-hidden />
          </div>
          <p className="mt-5 text-[17px] font-semibold tracking-[0.04em] text-[#1C1C1E]">功能开发中</p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#9CA3AF]">
            动态广场、热搜、发布与私信等功能正在打磨中，完成后将在此接入。
          </p>
          <p className="mt-4 text-[13px] tracking-[0.12em] text-[#9CA3AF]/80">敬请期待</p>
        </div>
      </main>
    </div>
  )
}
