import { ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import type { Character } from '../newFriendsPersona/types'
import { personaDb } from '../newFriendsPersona/idb'
import { WECHAT_LUMI_PEER_CHARACTER_ID } from '../wechatConversationKey'
import { CustomNumericKeyboard } from './CustomNumericKeyboard'
import { maskRealName } from './maskRealName'
import { PasswordPaymentSheet } from './PasswordPaymentSheet'

/** Mock：钱包是否已绑定支付密码；改为 false 可测未绑定提示 */
const WALLET_BOUND_MOCK = true

const REMARK_PRESETS = ['Best Wishes', '恭喜发财', '谢谢老板', '大吉大利', '新年快乐'] as const
const MIN_RED_PACKET_YUAN = 0.01
const MAX_RED_PACKET_YUAN = 200

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
  if (!Number.isFinite(v) || v < MIN_RED_PACKET_YUAN) return null
  if (v > MAX_RED_PACKET_YUAN) return null
  return Math.round(v * 100) / 100
}

export type WxChatTarget = { kind: 'lumi' } | { kind: 'persona'; characterId: string }

/**
 * 发红包独立页。
 * 嵌入方式：在 WeChatApp 增加 route `red-packet-send`，从 ChatRoom 加号或长按面板跳转至此页；
 * 支付完成后由上层写入 IndexedDB 并 `setRoute` 回聊天。
 */
export function RedPacketPage({
  chat,
  peerRemarkName,
  peerAvatarUrl,
  onBack,
  onPaidSend,
}: {
  chat: WxChatTarget
  peerRemarkName: string
  peerAvatarUrl?: string
  onBack: () => void
  onPaidSend: (payload: { packetId: string; amountYuan: number; remark: string }) => void | Promise<void>
}) {
  const [character, setCharacter] = useState<Character | null>(null)
  const [amountStr, setAmountStr] = useState('')
  const [remark, setRemark] = useState<string>(REMARK_PRESETS[0])
  const [remarkSheet, setRemarkSheet] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pwdOpen, setPwdOpen] = useState(false)

  const characterId = chat.kind === 'persona' ? chat.characterId : WECHAT_LUMI_PEER_CHARACTER_ID

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const c = await personaDb.getCharacter(characterId)
        if (!cancelled) setCharacter(c ?? null)
      } catch {
        if (!cancelled) setCharacter(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [characterId])

  const legalName = useMemo(() => {
    if (chat.kind === 'lumi') return 'Lumi'
    return character?.name?.trim() || '未设置'
  }, [chat.kind, character?.name])

  const masked = useMemo(() => maskRealName(legalName), [legalName])

  const onAmountKey = useCallback((key: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back') => {
    setAmountStr((p) => applyAmountKey(p, key))
  }, [])

  /** 大屏展示用原始串，避免输入中途被 toFixed 打断 */
  const displayAmount = amountStr === '' ? '0.00' : amountStr
  const amountNumber = useMemo(() => {
    if (!amountStr.trim()) return null
    const v = parseFloat(amountStr)
    return Number.isFinite(v) ? v : null
  }, [amountStr])

  const startPay = useCallback(() => {
    const yuan = parseAmountYuan(amountStr)
    if (yuan == null) {
      setToast(`请输入有效金额（${MIN_RED_PACKET_YUAN.toFixed(2)} ~ ${MAX_RED_PACKET_YUAN.toFixed(2)}）`)
      window.setTimeout(() => setToast(null), 2200)
      return
    }
    if (!WALLET_BOUND_MOCK) {
      setToast('Please bind your wallet first')
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
      const packetId = `wxrp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      await Promise.resolve(
        onPaidSend({
          packetId,
          amountYuan: yuan,
          remark: remark.trim() || 'Best Wishes',
        }),
      )
    },
    [amountStr, onPaidSend, remark],
  )

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full min-h-0 flex-col bg-[#f9f9f9]"
    >
      <header
        className="flex shrink-0 items-center gap-2 border-b border-[#ececec] bg-white px-1 py-1"
        style={{ paddingTop: 'max(6px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable type="button" aria-label="返回" onClick={onBack} className="flex h-11 w-11 items-center justify-center active:scale-[0.98]">
          <ChevronLeft className="size-6 text-black" strokeWidth={1.5} />
        </Pressable>
        <div className="min-w-0 flex-1 pr-2 text-center">
          <div className="truncate text-[16px] font-semibold text-black">发红包</div>
        </div>
        <div className="w-11 shrink-0" aria-hidden />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-6">
        <div className="flex items-center gap-3 rounded-2xl border border-[#ececec] bg-white px-4 py-4">
          {peerAvatarUrl?.trim() ? (
            <img src={peerAvatarUrl.trim()} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#eee] text-[#aaa]">?</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold text-black">{peerRemarkName.trim() || '对方'}</p>
            <p className="mt-1 text-[13px] text-[#888]">
              实名 <span className="text-[#bbb]">REAL NAME</span>（{masked}）
            </p>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-[11px] font-medium tracking-[0.18em] text-[#9a9a9a]">AMOUNT</p>
          <div
            role="textbox"
            aria-readonly
            tabIndex={0}
            className="mt-2 flex items-baseline justify-center gap-1 border-b border-[#e5e5e5] pb-3"
            style={{ touchAction: 'manipulation' }}
            onFocus={(e) => e.target.blur()}
          >
            <span className="text-[22px] font-medium text-black">¥</span>
            <span
              className="text-[40px] font-semibold tabular-nums tracking-tight text-black"
              style={{
                fontFamily: 'ui-rounded, system-ui, "SF Pro Display", "DIN Alternate", sans-serif',
              }}
            >
              {displayAmount}
            </span>
          </div>
          {amountNumber != null && amountNumber > MAX_RED_PACKET_YUAN ? (
            <p className="mt-2 text-center text-[12px] font-medium text-red-600">
              超出单个红包上限：¥{MAX_RED_PACKET_YUAN.toFixed(2)}
            </p>
          ) : (
            <p className="mt-2 text-center text-[12px] text-[#9a9a9a]">
              单个红包金额范围：¥{MIN_RED_PACKET_YUAN.toFixed(2)} - ¥{MAX_RED_PACKET_YUAN.toFixed(2)}
            </p>
          )}
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium tracking-[0.18em] text-[#9a9a9a]">REMARK</p>
            <Pressable type="button" onClick={() => setRemarkSheet(true)} className="text-[12px] text-[#666] active:scale-[0.98]">
              更换
            </Pressable>
          </div>
          <p className="mt-2 text-[16px] text-black">{remark}</p>
        </div>
      </div>

      <div className="shrink-0 border-t border-[#ececec] bg-white px-4 pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-3">
        <CustomNumericKeyboard variant="amount" onKey={onAmountKey} className="pb-3" />
        <Pressable
          type="button"
          onClick={startPay}
          className="flex h-12 w-full items-center justify-center rounded-[12px] bg-black text-[16px] font-medium text-white transition-transform active:scale-[0.98]"
        >
          SEND
        </Pressable>
      </div>

      {remarkSheet ? (
        <div className="fixed inset-0 z-[190] flex flex-col justify-end bg-black/35" onMouseDown={() => setRemarkSheet(false)}>
          <div
            className="rounded-t-[18px] bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-center text-[15px] font-medium text-black">选择备注</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {REMARK_PRESETS.map((t) => (
                <Pressable
                  key={t}
                  type="button"
                  onClick={() => {
                    setRemark(t)
                    setRemarkSheet(false)
                  }}
                  className={`rounded-full border px-3 py-2 text-[13px] transition-transform active:scale-[0.98] ${
                    remark === t ? 'border-black bg-black text-white' : 'border-[#e5e5e5] bg-white text-black'
                  }`}
                >
                  {t}
                </Pressable>
              ))}
            </div>
            <input
              className="mt-4 w-full rounded-xl border border-[#e5e5e5] px-3 py-3 text-[15px] outline-none"
              placeholder="自定义备注（可使用系统键盘）"
              maxLength={24}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      <PasswordPaymentSheet
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
