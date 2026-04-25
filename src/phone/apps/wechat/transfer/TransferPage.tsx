import { ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { personaDb } from '../newFriendsPersona/idb'
import { WECHAT_LUMI_PEER_CHARACTER_ID } from '../wechatConversationKey'
import { CustomNumericKeyboard } from '../redPacket/CustomNumericKeyboard'
import { maskRealName } from '../redPacket/maskRealName'
import { TransferPasswordSheet } from './TransferPasswordSheet'

const WALLET_BOUND_MOCK = true
const GOLD = '#c9a76a'

function applyAmountKey(prev: string, k: string): string {
  if (k === 'back') return prev.slice(0, -1)
  if (k === '.') {
    if (prev.includes('.')) return prev
    return prev === '' ? '0.' : `${prev}.`
  }
  if (!/^\d$/.test(k)) return prev
  const next = `${prev}${k}`
  if (!/^\d*\.?\d{0,2}$/.test(next)) return prev
  return next
}

function parseAmountYuan(s: string): number | null {
  const v = parseFloat(s)
  if (!Number.isFinite(v) || v < 0.01) return null
  return Math.round(v * 100) / 100
}

/**
 * Lumi 转账发起页：白金风、专属数字键盘、最低 0.01 元、无上限。
 */
export function TransferPage({
  peerCharacterId,
  peerRemarkName,
  peerAvatarUrl,
  onBack,
  onPaidTransfer,
}: {
  peerCharacterId: string
  peerRemarkName: string
  peerAvatarUrl?: string
  onBack: () => void
  onPaidTransfer: (payload: { transferId: string; amountYuan: number; remark: string }) => void | Promise<void>
}) {
  const [character, setCharacter] = useState<{ name?: string } | null>(null)
  const [amountStr, setAmountStr] = useState('')
  const [remark, setRemark] = useState('')
  const [pwdOpen, setPwdOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const c = await personaDb.getCharacter(peerCharacterId)
        if (!cancelled) setCharacter(c ?? null)
      } catch {
        if (!cancelled) setCharacter(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [peerCharacterId])

  const legalName = character?.name?.trim() || 'Lumi'
  const masked = useMemo(() => maskRealName(legalName), [legalName])

  const onAmountKey = useCallback((key: Parameters<typeof applyAmountKey>[1]) => {
    setAmountStr((p) => applyAmountKey(p, key))
  }, [])

  const displayAmount = amountStr === '' ? '0.00' : amountStr

  const startPay = useCallback(() => {
    const yuan = parseAmountYuan(amountStr)
    if (yuan == null) {
      setToast('请输入有效金额（最低 ¥0.01）')
      window.setTimeout(() => setToast(null), 2200)
      return
    }
    if (!WALLET_BOUND_MOCK) {
      setToast('请先绑定支付')
      window.setTimeout(() => setToast(null), 2600)
      return
    }
    setPwdOpen(true)
  }, [amountStr])

  const handlePwdComplete = useCallback(
    async (_pin: string) => {
      const yuan = parseAmountYuan(amountStr)
      if (yuan == null) return
      setPwdOpen(false)
      const transferId = `wxtr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      await Promise.resolve(
        onPaidTransfer({
          transferId,
          amountYuan: yuan,
          remark: remark.trim().slice(0, 40),
        }),
      )
    },
    [amountStr, onPaidTransfer, remark],
  )

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full min-h-0 flex-col bg-white"
    >
      <header
        className="flex shrink-0 items-center gap-2 border-b border-[#efefef] bg-white px-1 py-1"
        style={{ paddingTop: 'max(6px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable type="button" aria-label="返回" onClick={onBack} className="flex h-11 w-11 items-center justify-center active:scale-[0.98]">
          <ChevronLeft className="size-6 text-[#333]" strokeWidth={1.5} />
        </Pressable>
        <div className="min-w-0 flex-1 pr-2 text-center">
          <div className="truncate text-[16px] font-semibold text-[#333]">Lumi转账</div>
        </div>
        <div className="w-11 shrink-0" aria-hidden />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-6">
        {/* 轻量收款方信息：避免和红包“头像卡片”雷同 */}
        <div className="flex items-center justify-between rounded-2xl border border-[#f0f0f0] bg-[#fbfbfb] px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            {peerAvatarUrl?.trim() ? (
              <img src={peerAvatarUrl.trim()} alt="" className="h-11 w-11 shrink-0 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#efefef] text-[#aaa]">?</div>
            )}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-[#222]">{peerRemarkName.trim() || '对方'}</p>
              <p className="mt-0.5 text-[12px] text-[#999]">{masked}</p>
            </div>
          </div>
          <span className="text-[10px] font-medium tracking-[0.22em] text-[#bdbdbd]">TRANSFER</span>
        </div>

        {/* 金融感金额区：大留白 + 中轴数字 */}
        <div className="mt-10 rounded-[22px] border border-[#f0f0f0] bg-white px-4 pb-6 pt-7">
          <p className="text-center text-[11px] font-medium tracking-[0.22em] text-[#b0b0b0]">AMOUNT</p>
          <div
            role="textbox"
            aria-readonly
            tabIndex={0}
            className="mt-4 flex items-baseline justify-center gap-1"
            onFocus={(e) => e.target.blur()}
          >
            <span className="text-[26px] font-medium tabular-nums" style={{ color: GOLD }}>
              ¥
            </span>
            <span
              className="text-[46px] font-semibold tabular-nums tracking-tight text-[#111]"
              style={{ fontFamily: 'ui-rounded, system-ui, \"SF Pro Display\", \"DIN Alternate\", sans-serif' }}
            >
              {displayAmount}
            </span>
          </div>
          <p className="mt-3 text-center text-[12px] text-[#a8a8a8]">最低 ¥0.01 · 无单笔上限</p>
        </div>

        {/* 备注说明：展示到气泡中 */}
        <div className="mt-6 rounded-[18px] border border-[#f0f0f0] bg-white px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium tracking-[0.22em] text-[#b0b0b0]">REMARK</p>
            <span className="text-[11px] tabular-nums text-[#c0c0c0]">{remark.trim().length}/40</span>
          </div>
          <input
            className="mt-3 w-full rounded-xl border border-[#ededed] bg-[#fafafa] px-3 py-3 text-[15px] text-[#222] outline-none placeholder:text-[#bdbdbd]"
            placeholder="备注说明（可选）"
            value={remark}
            maxLength={40}
            onChange={(e) => setRemark(e.target.value)}
          />
        </div>
      </div>

      <div className="shrink-0 border-t border-[#ececec] bg-white px-4 pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-3">
        <CustomNumericKeyboard variant="amount" onKey={onAmountKey} className="pb-3" />
        <Pressable
          type="button"
          onClick={startPay}
          className="flex h-12 w-full items-center justify-center rounded-[12px] bg-black text-[16px] font-medium text-white transition-transform active:scale-[0.98]"
        >
          转账
        </Pressable>
      </div>

      <TransferPasswordSheet
        open={pwdOpen}
        amountYuan={parseAmountYuan(amountStr) ?? 0}
        onClose={() => setPwdOpen(false)}
        onComplete={handlePwdComplete}
      />

      {toast ? (
        <div className="pointer-events-none fixed left-1/2 top-[max(80px,env(safe-area-inset-top,0px)+48px)] z-[220] max-w-[88vw] -translate-x-1/2 rounded-[10px] bg-neutral-900 px-4 py-2 text-center text-[13px] text-white">
          {toast}
        </div>
      ) : null}
    </motion.div>
  )
}
