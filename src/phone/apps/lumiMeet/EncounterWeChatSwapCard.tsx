import type { MeetChatSwapCardPayload } from './meetTypes'

/** 互换成功：插入会话流的铂金边框卡片（无 Emoji） */
export function EncounterWeChatSwapCard({ payload }: { payload: MeetChatSwapCardPayload }) {
  return (
    <div className="flex w-full justify-center px-6 py-3">
      <div
        className="w-full max-w-[min(92vw,380px)] rounded-[14px] border border-[#D4AF37]/40 px-5 py-4 text-center shadow-[0_10px_40px_rgba(40,36,28,0.06)] backdrop-blur-[2px]"
        style={{
          background: 'color-mix(in oklab, white 88%, transparent)',
        }}
      >
        <p className="text-[15px] font-medium tracking-[0.08em] text-[#3d3a34]">已建立深度联络</p>
        <p className="mt-1 text-[11px] font-light tracking-wide text-[#8a8478]">双方微信号已互换备案</p>

        <div className="mt-5 grid grid-cols-2 gap-4 text-left text-[11px] leading-snug text-[#5c574f]">
          <div>
            <div className="text-[10px] tracking-[0.06em] text-[#b8b4ae]">对方微信号</div>
            <div className="mt-0.5 break-all font-mono text-[12px] text-[#3d3a34]">{payload.charWechatId}</div>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.06em] text-[#b8b4ae]">你的微信号</div>
            <div className="mt-0.5 break-all font-mono text-[12px] text-[#3d3a34]">{payload.userWechatId}</div>
          </div>
        </div>

        <p
          className="mt-5 font-serif text-[13px] font-light italic leading-relaxed text-[#4a463f]"
          style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
        >
          {payload.note}
        </p>
      </div>
    </div>
  )
}
