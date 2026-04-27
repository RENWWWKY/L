import { Pressable } from '../../components/Pressable'

function fmt(ts?: number): string {
  if (!ts || !Number.isFinite(ts)) return '-'
  const d = new Date(ts)
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

export type RecallHistoryRecord = {
  sender: 'self' | 'other'
  senderName: string
  sentAt: number
  recalledAt?: number
  originalText: string
}

export function RecallHistoryModal({
  open,
  record,
  onClose,
}: {
  open: boolean
  record: RecallHistoryRecord | null
  onClose: () => void
}) {
  if (!open || !record) return null
  const senderLabel = record.sender === 'self' ? '你' : record.senderName
  return (
    <div className="fixed inset-0 z-[1220] flex items-center justify-center bg-black/25 px-4" onMouseDown={onClose} role="presentation">
      <div
        className="w-full max-w-[360px] rounded-2xl border border-white/50 bg-white/75 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="text-center text-[15px] font-semibold text-[#111]">撤回记录</div>
        <div className="mt-3 space-y-1 text-[12px] text-[#666]">
          <div>发送者：{senderLabel}</div>
          <div>发送时间：{fmt(record.sentAt)}</div>
          <div>撤回时间：{fmt(record.recalledAt)}</div>
        </div>
        <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-[14px] leading-[1.5] text-[#222]">{record.originalText || '（无内容）'}</div>
        <Pressable type="button" className="mt-4 w-full rounded-xl bg-[#f5f5f5] py-2 text-[14px] text-[#222] active:bg-[#ededed]" onClick={onClose}>
          关闭
        </Pressable>
      </div>
    </div>
  )
}

