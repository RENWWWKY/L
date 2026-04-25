import { ChevronLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { formatRedPacketHistoryDateTime } from '../redPacket/redPacketHistoryFromMessages'
import {
  acceptLumiTransfer,
  getLumiTransferFresh,
  returnLumiTransfer,
  type LumiTransferRecord,
} from './lumiTransferStorage'

const GOLD = '#c9a76a'
const BG = '#ffffff'

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Lumi 转账详情：pending 倒计时 + 确认收款；accepted / returned 展示结果。
 */
export function TransferDetailPage({
  transferId,
  playerIdentityId,
  getCurrentTime,
  onBack,
}: {
  transferId: string
  playerIdentityId: string
  getCurrentTime: () => number
  onBack: () => void
}) {
  const [rec, setRec] = useState<LumiTransferRecord | null>(() => getLumiTransferFresh(transferId, getCurrentTime))
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setRec(getLumiTransferFresh(transferId, getCurrentTime))
  }, [transferId, getCurrentTime])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onEvt = () => refresh()
    window.addEventListener('lumi-transfer-changed', onEvt)
    return () => window.removeEventListener('lumi-transfer-changed', onEvt)
  }, [refresh])

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((x) => x + 1)
      refresh()
    }, 1000)
    return () => window.clearInterval(id)
  }, [refresh])

  const now = getCurrentTime()
  const timeLeft = rec ? Math.max(0, rec.expiresAt - now) : 0

  const isSender = rec?.senderId === playerIdentityId
  /** 规则：只有收款方可确认收款；自发转账不可自领（群聊后续另做）。 */
  const canConfirmAsReceiver = rec?.status === 'pending' && rec.receiverId === playerIdentityId && timeLeft > 0

  const onConfirm = useCallback(() => {
    if (!canConfirmAsReceiver) return
    if (acceptLumiTransfer(transferId, getCurrentTime)) refresh()
  }, [canConfirmAsReceiver, transferId, getCurrentTime, refresh])

  const onReturn = useCallback(() => {
    if (!canConfirmAsReceiver) return
    if (returnLumiTransfer(transferId, getCurrentTime)) refresh()
  }, [canConfirmAsReceiver, transferId, getCurrentTime, refresh])

  const acceptedTimeLabel = useMemo(() => {
    if (!rec?.acceptedAt) return ''
    return formatRedPacketHistoryDateTime(rec.acceptedAt)
  }, [rec?.acceptedAt])

  if (!rec) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-white" style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 0px))' }}>
        <header className="flex shrink-0 items-center border-b border-[#eee] px-2 py-2">
          <Pressable type="button" aria-label="返回" onClick={onBack} className="flex h-10 w-10 items-center justify-center text-[#333]">
            <ChevronLeft className="size-6" strokeWidth={1.5} />
          </Pressable>
          <span className="flex-1 text-center text-[16px] font-medium text-[#333]">转账详情</span>
          <span className="w-10" />
        </header>
        <div className="flex flex-1 items-center justify-center px-6 text-[14px] text-[#999]">未找到该转账</div>
      </div>
    )
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{
        paddingTop: 'max(8px, env(safe-area-inset-top, 0px))',
        background: BG,
      }}
    >
      <header className="flex shrink-0 items-center border-b border-[#f0f0f0] px-2 py-2">
        <Pressable type="button" aria-label="返回" onClick={onBack} className="flex h-10 w-10 items-center justify-center text-[#333] active:opacity-80">
          <ChevronLeft className="size-6" strokeWidth={1.5} />
        </Pressable>
        <span className="flex-1 text-center text-[16px] font-medium text-[#333]">转账详情</span>
        <span className="w-10" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-10">
        <p className="text-center text-[11px] font-medium tracking-[0.2em] text-[#b0b0b0]">AMOUNT</p>
        <p
          className="mt-2 text-center text-[44px] font-semibold tabular-nums text-[#333]"
          style={{
            fontFamily: 'ui-monospace, "DIN Alternate", sans-serif',
            color: GOLD,
          }}
        >
          ¥{rec.amount.toFixed(2)}
        </p>

        {rec.status === 'pending' && timeLeft > 0 ? (
          <>
            <p className="mt-8 text-center text-[28px] font-medium tabular-nums tracking-wide text-[#333]">{formatCountdown(timeLeft)}</p>
            <p className="mx-auto mt-4 max-w-[300px] text-center text-[13px] leading-relaxed text-[#888]">
              24小时内未查收，将自动退还
              <span className="mt-1 block text-[11px] tracking-[0.08em] text-[#b8b8b8]">
                Will be returned automatically if not accepted within 24 hours
              </span>
            </p>
            {canConfirmAsReceiver ? (
              <div className="mx-auto mt-10 flex w-full max-w-[320px] gap-3">
                <Pressable
                  type="button"
                  onClick={onReturn}
                  className="flex h-12 flex-1 items-center justify-center rounded-[12px] border border-[#e6e6e6] bg-white text-[15px] font-medium text-[#333] transition-transform active:scale-[0.98]"
                >
                  退还
                </Pressable>
                <Pressable
                  type="button"
                  onClick={onConfirm}
                  className="flex h-12 flex-1 items-center justify-center rounded-[12px] text-[15px] font-medium text-white transition-transform active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(180deg, ${GOLD} 0%, #a88b4a 100%)`,
                    boxShadow: '0 4px 16px rgba(201, 167, 106, 0.35)',
                  }}
                >
                  确认收款
                </Pressable>
              </div>
            ) : isSender ? (
              <p className="mt-10 text-center text-[14px] text-[#aaa]">等待对方查收</p>
            ) : null}
          </>
        ) : null}

        {rec.status === 'pending' && timeLeft <= 0 ? (
          <p className="mt-10 text-center text-[15px] font-medium text-[#666]">处理中…</p>
        ) : null}

        {rec.status === 'accepted' ? (
          <div className="mt-12 text-center">
            <p className="text-[17px] font-medium text-[#333]">已收款</p>
            <p className="mt-2 text-[13px] text-[#888]">{acceptedTimeLabel}</p>
          </div>
        ) : null}

        {rec.status === 'returned' ? (
          <div className="mt-12 text-center">
            <p className="text-[17px] font-medium text-[#333]">已退还</p>
            <p className="mt-1 text-[12px] text-[#aaa]">Returned</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
