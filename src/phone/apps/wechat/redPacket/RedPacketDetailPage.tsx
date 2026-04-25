import { ChevronLeft, MoreHorizontal } from 'lucide-react'

import { Pressable } from '../../../components/Pressable'

type DetailRow = { label: string; value: string }

const platinumGold = '#9a7b4a'
const platinumGoldSoft = 'rgba(154, 123, 74, 0.85)'

/**
 * 红包详情全屏页：白金极简排版；右上角 … 直接进入收发记录（无底部菜单）。
 */
export function RedPacketDetailPage({
  amountYuan,
  remark,
  senderName,
  senderAvatarUrl,
  chatPeerName,
  fromSelf,
  onBack,
  onOpenHistory,
}: {
  amountYuan: number
  remark: string
  senderName: string
  senderAvatarUrl?: string
  chatPeerName: string
  fromSelf: boolean
  onBack: () => void
  onOpenHistory: () => void
}) {
  const rows: DetailRow[] = [
    { label: 'STATUS', value: 'Opened' },
    { label: 'REMARK', value: remark.trim() || '—' },
    { label: fromSelf ? 'TO' : 'CHAT', value: chatPeerName },
  ]

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{
        paddingTop: 'max(8px, env(safe-area-inset-top, 0px))',
        background: 'linear-gradient(180deg, #faf9f6 0%, #f0ede6 100%)',
      }}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-[#e5e0d8] px-2 py-2">
        <Pressable
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#2a2a2a] active:scale-[0.98]"
        >
          <ChevronLeft className="size-6" strokeWidth={1.5} />
        </Pressable>
        <span className="text-[13px] font-medium tracking-[0.2em] text-[#8a8580]">DETAIL</span>
        <Pressable
          type="button"
          aria-label="红包收发记录"
          onClick={onOpenHistory}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#2a2a2a] active:scale-[0.98]"
        >
          <MoreHorizontal className="size-5" strokeWidth={1.8} />
        </Pressable>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-8">
        <div className="flex flex-col items-center text-center">
          {senderAvatarUrl?.trim() ? (
            <img
              src={senderAvatarUrl.trim()}
              alt=""
              className="h-[72px] w-[72px] rounded-2xl border border-[#e0d8cc] object-cover shadow-sm"
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
            />
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-[#e0d8cc] bg-white text-[22px] text-[#b0a99c] shadow-sm">
              ?
            </div>
          )}
          <p className="mt-4 text-[17px] font-medium text-[#1a1a1a]">{senderName}</p>
          <p className="mt-1 text-[11px] tracking-[0.18em]" style={{ color: platinumGoldSoft }}>
            {fromSelf ? 'OUTGOING' : 'INCOMING'}
          </p>
        </div>

        <p className="mt-10 text-center text-[11px] font-medium tracking-[0.24em] text-[#9a958c]">AMOUNT</p>
        <p
          className="mt-2 text-center text-[48px] font-semibold tabular-nums leading-none text-[#1c1c1c]"
          style={{
            fontFamily: 'ui-monospace, "DIN Alternate", "SF Pro Display", system-ui, sans-serif',
          }}
        >
          ¥{amountYuan.toFixed(2)}
        </p>

        <div className="mt-12 space-y-0 rounded-2xl border border-[#e8e2d8] bg-white/90 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-start justify-between gap-4 border-b border-[#efe9e0] px-4 py-3.5 last:border-b-0"
            >
              <span className="shrink-0 text-[11px] font-medium tracking-[0.14em] text-[#9a958c]">{r.label}</span>
              <span className="min-w-0 text-right text-[14px] text-[#3d3d3d]">{r.value}</span>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[11px] text-[#a8a299]">领取记录</p>
        <div className="mt-3 rounded-xl border border-[#e8e2d8] bg-white/95 px-4 py-3 text-[13px] text-[#4a4a4a] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="flex justify-between gap-2">
            <span>{senderName}</span>
            <span className="tabular-nums font-medium" style={{ color: platinumGold }}>
              ¥{amountYuan.toFixed(2)}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-[#8c877c]">已领取 · Opened</p>
        </div>
      </div>
    </div>
  )
}
