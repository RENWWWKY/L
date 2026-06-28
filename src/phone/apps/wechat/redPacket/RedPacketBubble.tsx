import { Check, Hourglass } from 'lucide-react'

import {
  ImessageApplePayCashCard,
  TelegramInvoiceCard,
  type MessengerBubbleStyle,
} from '../wechatMessengerSpecialBubbles'
import { WechatRedPacketBubbleFace } from '../wechatBubbleWechatUi'

const PLATINUM = '#D4AF37'

export type RedPacketBubbleData = {
  remark: string
  opened: boolean
  amountYuan: number
  /** 过期未领；为 true 时优先展示过期态（祝福语可带删除线） */
  expired?: boolean
}

type VisualKind = 'unclaimed' | 'claimed' | 'expired'

function resolveVisual(data: RedPacketBubbleData): VisualKind {
  if (data.expired && !data.opened) return 'expired'
  if (data.opened) return 'claimed'
  return 'unclaimed'
}

/** 闭合信封 + 中央火漆圆（铂金色线稿） */
function IconClosedEnvelope() {
  const stroke = `${PLATINUM}99`
  const soft = `${PLATINUM}55`
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden>
      <defs>
        <linearGradient id="rp-env-shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="5" y="11" width="30" height="23" rx="2.5" fill="none" stroke={soft} strokeWidth="1" />
      <path d="M5 14 L20 24 L35 14" fill="none" stroke={stroke} strokeWidth="1.15" strokeLinejoin="round" />
      <circle cx="20" cy="22" r="5.5" fill="none" stroke={stroke} strokeWidth="1" />
      <circle cx="20" cy="22" r="2.2" fill={stroke} fillOpacity={0.25} stroke="none" />
      <rect x="5" y="11" width="30" height="23" rx="2.5" fill="url(#rp-env-shine)" stroke="none" />
    </svg>
  )
}

/** 已拆：浅灰勾（克制） */
function IconOpenedMark() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200/90 bg-gray-50/80">
      <Check className="size-[18px] text-gray-400" strokeWidth={1.65} aria-hidden />
    </div>
  )
}

/** 过期：沙漏线稿 */
function IconExpired() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-100/60">
      <Hourglass className="size-[17px] text-gray-400" strokeWidth={1.5} aria-hidden />
    </div>
  )
}

/**
 * 柔和浅色铂金风红包气泡：高定邀请函式卡片，摒弃高饱和金红。
 */
export function RedPacketBubble({
  data,
  isSelf,
  messengerStyle = 'lumi',
  onAction,
  replyPreview,
  replyIsSelf = false,
}: {
  data: RedPacketBubbleData
  isSelf: boolean
  messengerStyle?: MessengerBubbleStyle
  onAction?: () => void
  replyPreview?: { senderName: string; content: string; onClick?: () => void }
  replyIsSelf?: boolean
}) {
  const kind = resolveVisual(data)
  if (messengerStyle === 'imessage') {
    return <ImessageApplePayCashCard amountYuan={data.amountYuan} remark={data.remark} />
  }
  if (messengerStyle === 'telegram') {
    const title = kind === 'unclaimed' ? 'Gift' : kind === 'claimed' ? 'Gift Opened' : 'Gift Expired'
    const btn =
      kind === 'unclaimed' ? `Open ¥${Number(data.amountYuan || 0).toFixed(2)}` : kind === 'claimed' ? 'View Gift' : 'Expired'
    return (
      <TelegramInvoiceCard
        title={title}
        description={data.remark?.trim() || '恭喜发财，大吉大利'}
        amountYuan={data.amountYuan}
        buttonLabel={btn}
        emoji="🎁"
        onAction={onAction}
        replyPreview={replyPreview}
        replyIsSelf={replyIsSelf}
      />
    )
  }

  const remark = (data.remark || '恭喜发财，大吉大利').trim() || '恭喜发财，大吉大利'

  if (messengerStyle === 'wechat') {
    return <WechatRedPacketBubbleFace remark={remark} kind={kind} isSelf={isSelf} />
  }

  const remarkLegacy = (data.remark || 'Best Wishes').trim() || 'Best Wishes'
  const tag = kind === 'unclaimed' ? 'RED PACKET' : kind === 'claimed' ? 'OPENED' : 'EXPIRED'

  const isClaimed = kind === 'claimed'
  const isExpired = kind === 'expired'
  const shadowCls = isClaimed
    ? 'shadow-none'
    : isExpired
      ? 'shadow-[0_2px_10px_rgba(15,23,42,0.04)]'
      : 'shadow-[0_4px_15px_rgba(212,175,55,0.08)]'

  return (
    <div
      data-wx-msg-kind="red-packet"
      className={`select-none text-left transition-opacity duration-150 ease-out ${
        kind === 'unclaimed' ? 'w-[min(220px,72vw)] max-w-full shrink-0' : 'max-w-[min(280px,72vw)]'
      } ${isClaimed ? 'opacity-60' : 'opacity-100'}`}
      style={{ borderRadius: 14 }}
    >
      <div
        data-wx-special-card
        className={`overflow-hidden rounded-[14px] px-3.5 py-3 transition-[box-shadow,background-color,border-color] duration-150 ease-out ${shadowCls}`}
        style={{
          backgroundColor: isExpired ? '#f9fafb' : 'var(--wx-special-rp-bg, #ffffff)',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: isClaimed
            ? 'rgba(229, 231, 235, 0.9)'
            : isExpired
              ? 'rgba(229, 231, 235, 0.7)'
              : 'var(--wx-special-rp-border, rgba(212, 175, 55, 0.3))',
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          {kind === 'unclaimed' ? <IconClosedEnvelope /> : null}
          {kind === 'claimed' ? <IconOpenedMark /> : null}
          {kind === 'expired' ? <IconExpired /> : null}
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-[14px] font-medium leading-snug tracking-wide ${
                isExpired ? 'text-gray-400 line-through decoration-gray-300' : ''
              }`}
              style={isExpired ? undefined : { color: 'var(--wx-special-rp-text, #1f2937)' }}
            >
              {remarkLegacy}
            </p>
            <p
              className={`mt-1 text-[9px] font-semibold tracking-[0.28em] transition-colors duration-300 ${
                isExpired ? 'text-gray-400' : isClaimed ? 'text-gray-400' : ''
              }`}
              style={
                isExpired || isClaimed ? undefined : { color: 'var(--wx-special-rp-tag, rgba(212, 175, 55, 0.55))' }
              }
            >
              {tag}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Story / 验收：四种红包气泡状态纵向陈列 */
export function RedPacketBubbleVisualMocks() {
  const samples: { label: string; data: RedPacketBubbleData }[] = [
    { label: 'A · 未领取', data: { remark: 'Best Wishes', opened: false, amountYuan: 88, expired: false } },
    { label: 'B · 已领取', data: { remark: '生日快乐', opened: true, amountYuan: 88, expired: false } },
    { label: 'C · 过期未领', data: { remark: '生日快乐', opened: false, amountYuan: 88, expired: true } },
    { label: 'D · 长文案截断', data: { remark: 'May your days be gentle and bright forever', opened: false, amountYuan: 1, expired: false } },
  ]
  return (
    <div className="space-y-3 rounded-2xl bg-[#ececec] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Red packet · mock</p>
      {samples.map((s) => (
        <div key={s.label} className="space-y-1">
          <p className="text-[10px] text-neutral-500">{s.label}</p>
          <RedPacketBubble data={s.data} isSelf={false} />
        </div>
      ))}
    </div>
  )
}
