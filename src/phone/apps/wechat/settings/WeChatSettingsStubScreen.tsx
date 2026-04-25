import { Pressable } from '../../../components/Pressable'

export function WeChatSettingsStubScreen({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f5f5]">
      <header
        className="flex shrink-0 items-center border-b border-[#e5e5e5] bg-[#f5f5f5] px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
        <h1 className="min-w-0 flex-1 truncate text-center text-[18px] font-bold text-black">{title}</h1>
        <div className="w-10 shrink-0" />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <p className="text-center text-[15px] text-[#666666]">功能开发中，敬请期待</p>
      </div>
    </div>
  )
}
