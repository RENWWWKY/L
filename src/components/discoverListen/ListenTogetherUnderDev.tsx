import { Headphones } from 'lucide-react'

type Props = {
  onBack: () => void
  className?: string
}

/** 听一听暂不可用 · 开发占位页 */
export function ListenTogetherUnderDev({ onBack, className = '' }: Props) {
  return (
    <div className={`flex h-full min-h-0 flex-col bg-[#FAF8F5] ${className}`}>
      <header
        className="flex shrink-0 items-center border-b border-[#E7E2D9] bg-[#FAF8F5]/95 px-3 pb-3 backdrop-blur-sm"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#2D2422] transition-colors active:bg-black/[0.04]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center font-serif text-[18px] font-medium text-[#2D2422]">
          听一听
        </h1>
        <div className="w-10 shrink-0" />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-8 pb-[max(24px,env(safe-area-inset-bottom,0px))]">
        <div className="w-full max-w-[300px] rounded-[20px] border border-[#E7E2D9] bg-white/80 px-6 py-10 text-center shadow-[0_8px_32px_rgba(45,36,34,0.06)] backdrop-blur-md">
          <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[#E7E2D9] bg-[#FAF8F5] text-[#8A7F78]">
            <Headphones className="size-8" strokeWidth={1.35} aria-hidden />
          </div>
          <p className="mt-6 font-serif text-[20px] font-medium tracking-tight text-[#2D2422]">暂时不可用</p>
          <p className="mt-3 text-[14px] leading-relaxed text-[#8A7F78]">
            听一听正在开发与联调中，当前版本暂不开放。请稍后再来，或先在微信里继续聊天。
          </p>
          <p className="mt-5 text-[12px] tracking-wide text-[#B8AFA8]">开发占位 · UNDER DEVELOPMENT</p>
        </div>
      </div>
    </div>
  )
}
