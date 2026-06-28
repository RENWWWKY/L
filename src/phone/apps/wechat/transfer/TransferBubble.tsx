import { Check, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { LumiTransferRecord } from './lumiTransferStorage'
import { getLumiTransferFresh } from './lumiTransferStorage'
import {
  ImessageApplePayCashCard,
  TalkmakerPayCard,
  TelegramInvoiceCard,
  type MessengerBubbleStyle,
} from '../wechatMessengerSpecialBubbles'
import { WechatTransferBubbleFace } from '../wechatBubbleWechatUi'

export type TransferBubbleVisualStatus = 'pending' | 'accepted' | 'returned'

/** outgoing：会话里己方气泡上的转账（我发出的）；incoming：对方发来的转账 */
export type TransferBubblePerspective = 'outgoing' | 'incoming'

export type TransferBubbleFaceProps = {
  status: TransferBubbleVisualStatus
  /** null 表示记录未就绪，金额展示占位 */
  amountYuan: number | null
  remark?: string
  perspective?: TransferBubblePerspective
}

function formatAmountLine(amountYuan: number | null): string {
  if (amountYuan == null || !Number.isFinite(amountYuan)) return '¥ —'
  const s = amountYuan.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `¥ ${s}`
}

/**
 * 转账气泡纯 UI 面：私人银行式左铂金锚线 + 金额 mono + 状态文案。
 */
export function TransferBubbleFace({
  status,
  amountYuan,
  remark,
  perspective = 'incoming',
  messengerStyle = 'lumi',
  onAction,
  replyPreview,
  replyIsSelf,
}: TransferBubbleFaceProps & {
  messengerStyle?: MessengerBubbleStyle
  onAction?: () => void
  replyPreview?: { senderName: string; content: string; onClick?: () => void }
  replyIsSelf?: boolean
}) {
  if (messengerStyle === 'imessage') {
    return <ImessageApplePayCashCard amountYuan={amountYuan} remark={remark} />
  }
  if (messengerStyle === 'talkmaker') {
    return (
      <TalkmakerPayCard
        amountYuan={amountYuan}
        remark={remark}
        status={status}
        onAction={onAction}
      />
    )
  }
  if (messengerStyle === 'telegram') {
    const title = status === 'pending' ? 'Payment Request' : status === 'accepted' ? 'Payment Received' : 'Payment Returned'
    const desc =
      remark?.trim() ||
      (status === 'pending'
        ? perspective === 'outgoing'
          ? 'Awaiting acceptance'
          : 'Transfer to you'
        : status === 'accepted'
          ? 'Completed'
          : 'Returned')
    const btn =
      status === 'pending'
        ? `Pay ${amountYuan != null ? `¥${amountYuan.toFixed(2)}` : ''}`.trim()
        : status === 'accepted'
          ? 'View Receipt'
          : 'View Details'
    return (
      <TelegramInvoiceCard
        title={title}
        description={desc}
        amountYuan={amountYuan}
        buttonLabel={btn}
        emoji={status === 'pending' ? '🧾' : status === 'accepted' ? '✅' : '↩️'}
        onAction={onAction}
        replyPreview={replyPreview}
        replyIsSelf={replyIsSelf}
      />
    )
  }

  if (messengerStyle === 'wechat') {
    return <WechatTransferBubbleFace status={status} amountYuan={amountYuan} perspective={perspective} />
  }

  const pending = status === 'pending'
  const accepted = status === 'accepted'
  const returned = status === 'returned'
  const outgoing = perspective === 'outgoing'
  const r = (remark ?? '').trim()

  const leftBarVar =
    pending
      ? 'var(--wx-special-tf-accent-pending, #D4AF37)'
      : accepted
        ? 'var(--wx-special-tf-accent-accepted, #B8D4C8)'
        : 'var(--wx-special-tf-accent-returned, #9CA3AF)'
  const faceShadow =
    returned
      ? 'shadow-[0_2px_10px_rgba(15,23,42,0.04)]'
      : accepted
        ? 'shadow-[0_4px_12px_rgba(15,23,42,0.05)]'
        : 'shadow-[0_4px_15px_rgba(212,175,55,0.08)]'

  return (
    <div
      data-wx-msg-kind="transfer"
      className={`select-none text-left transition-opacity duration-150 ease-out ${
        pending ? 'w-[min(240px,72vw)] max-w-full shrink-0' : 'max-w-[min(280px,72vw)]'
      } ${accepted ? 'opacity-60' : 'opacity-100'}`}
    >
      <div
        data-wx-special-card
        className={`rounded-[14px] border-l-2 pl-[14px] pr-3.5 py-3 transition-[background-color,box-shadow,border-color] duration-150 ease-out ${faceShadow} ${
          returned ? 'bg-[#F9FAFB]' : ''
        }`}
        style={{
          borderLeftColor: leftBarVar,
          backgroundColor: returned ? undefined : 'var(--wx-special-tf-bg, #ffffff)',
        }}
      >
        <p
          className={`text-[17px] tabular-nums tracking-tight transition-colors duration-300 ${
            returned ? 'text-[#CBD5E1]' : ''
          }`}
          style={returned ? undefined : { color: 'var(--wx-special-tf-amount, #0f172a)' }}
        >
          {formatAmountLine(amountYuan)}
        </p>
        {r ? (
          <p
            className={`mt-1 truncate text-[11px] transition-colors duration-300 ${
              returned ? 'text-[#CBD5E1]' : accepted ? 'text-[#94a3b8]' : ''
            }`}
            style={returned || accepted ? undefined : { color: 'var(--wx-special-tf-muted, #64748B)' }}
          >
            {r}
          </p>
        ) : null}

        <div
          className={`mt-1.5 flex items-center gap-1.5 text-[11px] ${returned ? 'w-full justify-between text-[#64748B]' : 'text-[#475569]'}`}
        >
          {pending ? (
            outgoing ? (
              <>
                <span className="font-medium">待对方收款</span>
                <span className="text-[#94a3b8]">· Awaiting acceptance</span>
              </>
            ) : (
              <>
                <span className="font-medium">转账给您</span>
                <span className="text-[#94a3b8]">· Transfer to you</span>
              </>
            )
          ) : accepted ? (
            outgoing ? (
              <>
                <span className="font-medium">对方已收款</span>
                <span className="text-[#94a3b8]">· Received</span>
                <Check className="size-3.5 shrink-0 text-[#94a3b8]" strokeWidth={2} aria-hidden />
              </>
            ) : (
              <>
                <span className="font-medium">已收款</span>
                <span className="text-[#94a3b8]">· Accepted</span>
                <Check className="size-3.5 shrink-0 text-[#94a3b8]" strokeWidth={2} aria-hidden />
              </>
            )
          ) : outgoing ? (
            <>
              <span className="font-medium">对方已退还</span>
              <span className="text-[#94a3b8]">· Returned</span>
              <RotateCcw className="size-3.5 shrink-0 text-[#94a3b8]" strokeWidth={2} aria-hidden />
            </>
          ) : (
            <>
              <span className="font-medium">已退还</span>
              <span className="text-[#94a3b8]">· Returned</span>
              <RotateCcw className="size-3.5 shrink-0 text-[#94a3b8]" strokeWidth={2} aria-hidden />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function recordToFace(rec: LumiTransferRecord | null): TransferBubbleFaceProps {
  if (!rec) return { status: 'pending', amountYuan: null, remark: undefined }
  if (rec.status === 'pending') return { status: 'pending', amountYuan: rec.amount, remark: rec.remark }
  if (rec.status === 'accepted') return { status: 'accepted', amountYuan: rec.amount, remark: rec.remark }
  return { status: 'returned', amountYuan: rec.amount, remark: rec.remark }
}

/**
 * Lumi 转账聊天气泡：浅色铂金锚线 + 金额 mono；状态来自 localStorage。
 */
export function TransferBubble({
  transferId,
  getCurrentTime,
  onRefresh,
  perspective = 'incoming',
  messengerStyle = 'lumi',
  onAction,
  replyPreview,
  replyIsSelf,
}: {
  transferId: string
  getCurrentTime: () => number
  onRefresh?: number
  perspective?: TransferBubblePerspective
  messengerStyle?: MessengerBubbleStyle
  onAction?: () => void
  replyPreview?: { senderName: string; content: string; onClick?: () => void }
  replyIsSelf?: boolean
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

  const face = recordToFace(rec)
  return (
    <TransferBubbleFace
      {...face}
      perspective={perspective}
      messengerStyle={messengerStyle}
      onAction={onAction}
      replyPreview={replyPreview}
      replyIsSelf={replyIsSelf}
    />
  )
}

/** Story / 验收：四种转账视觉（含记录未就绪占位） */
export function TransferBubbleVisualMocks() {
  const rows: { label: string; props: TransferBubbleFaceProps }[] = [
    { label: 'A · 待收款', props: { status: 'pending', amountYuan: 5200, remark: '房租' } },
    { label: 'B · 已收款', props: { status: 'accepted', amountYuan: 5200, remark: '房租' } },
    { label: 'C · 已退还', props: { status: 'returned', amountYuan: 5200, remark: '房租' } },
    { label: 'D · 待收款（无本地记录）', props: { status: 'pending', amountYuan: null } },
    { label: 'E · 己方发出·待收', props: { status: 'pending', amountYuan: 88, remark: '咖啡', perspective: 'outgoing' } },
    { label: 'F · 己方发出·对方已收', props: { status: 'accepted', amountYuan: 88, remark: '咖啡', perspective: 'outgoing' } },
  ]
  return (
    <div className="space-y-3 rounded-2xl bg-[#ececec] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Transfer · mock</p>
      {rows.map((r) => (
        <div key={r.label} className="space-y-1">
          <p className="text-[10px] text-neutral-500">{r.label}</p>
          <TransferBubbleFace {...r.props} />
        </div>
      ))}
    </div>
  )
}
