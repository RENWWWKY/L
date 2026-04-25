import { ArrowLeftRight } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { LumiTransferRecord } from './lumiTransferStorage'
import { getLumiTransferFresh } from './lumiTransferStorage'

const GOLD = '#c9a76a'
const GOLD_SOFT = 'rgba(201, 167, 106, 0.85)'

function statusLabel(rec: LumiTransferRecord | null): { line: string; sub: string } {
  if (!rec) return { line: '¥ —', sub: '…' }
  const amt = `¥ ${rec.amount.toFixed(2)}`
  if (rec.status === 'pending') return { line: amt, sub: '待查收 · Pending' }
  if (rec.status === 'accepted') return { line: amt, sub: '已查收 · Accepted' }
  return { line: amt, sub: '已退还 · Returned' }
}

/**
 * Lumi 转账聊天气泡：白卡片 + 铂金钱标 + 金额 + 状态（状态来自 localStorage）。
 */
export function TransferBubble({
  transferId,
  getCurrentTime,
  onRefresh,
}: {
  transferId: string
  getCurrentTime: () => number
  /** 父级 tick 时递增以触发重读 */
  onRefresh?: number
}) {
  const [rec, setRec] = useState<LumiTransferRecord | null>(() => getLumiTransferFresh(transferId, getCurrentTime))

  useEffect(() => {
    setRec(getLumiTransferFresh(transferId, getCurrentTime))
  }, [transferId, getCurrentTime, onRefresh])

  useEffect(() => {
    const onEvt = () => setRec(getLumiTransferFresh(transferId, getCurrentTime))
    window.addEventListener('lumi-transfer-changed', onEvt)
    return () => window.removeEventListener('lumi-transfer-changed', onEvt)
  }, [transferId, getCurrentTime])

  const pending = rec?.status === 'pending'
  useEffect(() => {
    if (!pending) return
    const id = window.setInterval(() => {
      setRec(getLumiTransferFresh(transferId, getCurrentTime))
    }, 1000)
    return () => window.clearInterval(id)
  }, [pending, transferId, getCurrentTime])

  const { line, sub } = statusLabel(rec)
  const remark = (rec?.remark ?? '').trim()
  const muted = rec?.status === 'accepted' || rec?.status === 'returned'
  const returned = rec?.status === 'returned'
  return (
    <div
      className={`select-none text-left transition-opacity duration-300 ${
        pending ? 'w-[min(220px,72vw)] max-w-full shrink-0 overflow-hidden' : 'max-w-[min(280px,72vw)]'
      }`}
      style={{
        borderRadius: 14,
        border: returned ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.10)',
        background: returned
          ? 'linear-gradient(180deg, #151515 0%, #0b0b0b 100%)'
          : 'linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%)',
        padding: '12px 14px',
        opacity: muted ? 0.55 : 1,
        boxShadow: '0 10px 28px rgba(0,0,0,0.32)',
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
          style={{
            borderColor: returned ? 'rgba(201, 167, 106, 0.20)' : 'rgba(201, 167, 106, 0.42)',
            background: 'rgba(255,255,255,0.04)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <ArrowLeftRight
            className="size-[18px]"
            strokeWidth={1.5}
            style={{ color: returned ? 'rgba(201, 167, 106, 0.55)' : GOLD }}
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[16px] font-semibold tabular-nums ${returned ? 'text-white/70' : 'text-white/90'}`}
            style={{ fontFamily: 'ui-monospace, \"DIN Alternate\", sans-serif' }}
          >
            {line}
          </p>
          {remark ? (
            <p className="mt-1 truncate text-[12px]" style={{ color: returned ? 'rgba(255,255,255,0.45)' : GOLD_SOFT }}>
              {remark}
            </p>
          ) : null}
          <p
            className={`${remark ? 'mt-1' : 'mt-1'} truncate text-[11px] ${returned ? 'text-white/35' : 'text-white/45'}`}
          >
            {sub}
          </p>
        </div>
      </div>
    </div>
  )
}
