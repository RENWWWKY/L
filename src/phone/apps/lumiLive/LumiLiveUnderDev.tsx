import { ArrowLeft, Construction, Radio } from 'lucide-react'

export type LumiLiveUnderDevProps = {
  onBack: () => void
  className?: string
}

/** 浮光直播 · 开发中占位（保留返回发现页） */
export function LumiLiveUnderDev({ onBack, className = '' }: LumiLiveUnderDevProps) {
  return (
    <div
      className={`relative flex h-full min-h-0 flex-col bg-[#0B0B0C] ${className}`}
      style={{ fontFamily: 'var(--phone-font)' }}
      data-phone-page="app"
      data-app-id="lumi-live"
    >
      <header
        className="shrink-0 border-b border-white/[0.08] backdrop-blur-sm"
        style={{
          backgroundColor: 'rgba(11,11,12,0.92)',
          paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
        }}
      >
        <div className="relative flex min-h-[52px] items-center justify-center px-12">
          <button
            type="button"
            onClick={onBack}
            className="absolute left-3 flex size-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/[0.06]"
            aria-label="返回发现"
          >
            <ArrowLeft className="size-5" strokeWidth={1.5} />
          </button>
          <div className="pointer-events-none w-full text-center">
            <h1 className="text-[17px] font-semibold tracking-[0.02em] text-white">浮光直播</h1>
            <p className="mt-0.5 text-[10px] tracking-[0.18em] text-white/40">Lumi Live · Under Construction</p>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-[320px] rounded-2xl border border-white/[0.1] bg-white/[0.04] px-6 py-10 text-center shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F43F5E]/15 text-[#FB7185]">
            <Construction className="size-7" strokeWidth={1.5} aria-hidden />
          </div>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-white/35">
            <Radio className="size-3.5" strokeWidth={1.5} aria-hidden />
            <span className="text-[11px] tracking-[0.14em]">LIVE SOON</span>
          </div>
          <p className="mt-4 text-[17px] font-semibold tracking-[0.04em] text-white">功能开发中</p>
          <p className="mt-2 text-[14px] leading-relaxed text-white/45">
            拟真连麦、弹幕互动与礼物场次仍在打磨，完成后将在此接入。
          </p>
          <p className="mt-4 text-[13px] tracking-[0.12em] text-white/30">敬请期待</p>
        </div>
      </main>
    </div>
  )
}
