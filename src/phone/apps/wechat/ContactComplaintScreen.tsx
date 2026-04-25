import { ChevronLeft } from 'lucide-react'

import { Pressable } from '../../components/Pressable'

export function ContactComplaintScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f5f5]">
      <header
        className="flex shrink-0 items-center bg-[#f5f5f5] px-2 pb-2 pt-[max(6px,env(safe-area-inset-top,0px))]"
      >
        <Pressable
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center active:opacity-60"
        >
          <ChevronLeft className="size-7 text-black" strokeWidth={1.6} />
        </Pressable>
        <h1 className="flex-1 text-center text-[17px] font-medium text-black">投诉</h1>
        <div className="w-11 shrink-0" />
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-8 text-center">
        <div>
          <p className="text-[16px] text-black">投诉页面预留中</p>
          <p className="mt-2 text-[13px] leading-6 text-[#8e8e8e]">后续可在这里接入微信同款投诉表单与提交流程。</p>
        </div>
      </div>
    </div>
  )
}
