/** 微信 8.x 经典聊天气泡 / 卡片 UI 片段 */

export const WECHAT_CLASSIC = {
  chatBg: '#F3F3F3',
  headerBg: '#EDEDED',
  inputBg: '#F7F7F7',
  text: '#191919',
  selfBubble: '#95EC69',
  otherBubble: '#FFFFFF',
  wechatGreen: '#07C160',
  quoteBg: '#EBEBEB',
  bubbleRadiusPx: 8,
  tailTopPx: 14,
} as const

/** 聊天气泡最大宽：100vw − 左右 24px − 对方头像列 80px（40 头像 + 12 间距 + 28 冗余） */
export const WECHAT_CHAT_BUBBLE_MAX_CLASS = 'max-w-[calc(100vw-24px-24px-80px)]'

const SELF_TAIL_PATH = 'M0,0 L6,5 L0,10 Z'
const OTHER_TAIL_PATH = 'M6,0 L0,5 L6,10 Z'

export function WechatBubbleTail({ isSelf, bubbleColor }: { isSelf: boolean; bubbleColor: string }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute z-[3] h-[10px] w-[6px] fill-current"
      style={{
        color: bubbleColor,
        top: WECHAT_CLASSIC.tailTopPx,
        ...(isSelf ? { right: -6 } : { left: -6 }),
      }}
      viewBox="0 0 6 10"
    >
      <path d={isSelf ? SELF_TAIL_PATH : OTHER_TAIL_PATH} />
    </svg>
  )
}

/** 位置 / 红包等卡片左侧尖角（与卡片顶栏同色） */
export function WechatCardTail({ color, topPx = WECHAT_CLASSIC.tailTopPx }: { color: string; topPx?: number }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute z-[3] h-[10px] w-[6px] fill-current"
      style={{ color, top: topPx, left: -6 }}
      viewBox="0 0 6 10"
    >
      <path d={OTHER_TAIL_PATH} />
    </svg>
  )
}

/** 微信经典语音波形：圆点 + 双弧线（右向；己方镜像为左向） */
export function WechatVoiceWaveIcon({ isSelf, className = 'h-4 w-6' }: { isSelf: boolean; className?: string }) {
  return (
    <svg
      className={`${className} shrink-0 text-[#191919]`}
      viewBox="0 0 18 16"
      fill="none"
      aria-hidden
      style={isSelf ? { transform: 'scaleX(-1)' } : undefined}
    >
      <circle cx="3" cy="8" r="2.25" fill="currentColor" />
      <path
        d="M7 5.5c2.2 2.5 2.2 2.5 0 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M9.5 3c3.8 5 3.8 5 0 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

/** 微信语音气泡最大宽度（秒数再长也不超过此值） */
export const WECHAT_VOICE_BUBBLE_MAX_PX = 240

/** 微信语音气泡宽度：约 88px + 每秒钟 8px，上限 {@link WECHAT_VOICE_BUBBLE_MAX_PX} */
export function wechatVoiceBubbleWidthPx(durationSec: number): number {
  const sec = Math.max(1, Math.round(durationSec || 1))
  return Math.min(WECHAT_VOICE_BUBBLE_MAX_PX, Math.max(88, 56 + sec * 8))
}

function WechatRedPacketIconClosed() {
  return (
    <svg viewBox="0 0 36 44" className="h-11 w-9 shrink-0" aria-hidden>
      <rect x="3" y="10" width="30" height="32" rx="2.5" fill="#E03E2F" />
      <path d="M3 14 L18 26 L33 14" fill="#C93527" />
      <circle cx="18" cy="30" r="7.5" fill="#FFF" />
      <text
        x="18"
        y="33.5"
        textAnchor="middle"
        fill="#F5A623"
        fontSize="12"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        ¥
      </text>
    </svg>
  )
}

function WechatRedPacketIconOpened() {
  return (
    <svg viewBox="0 0 36 44" className="h-11 w-9 shrink-0" aria-hidden>
      <path d="M3 16 L18 6 L33 16 Z" fill="#FFF" />
      <rect x="3" y="16" width="30" height="26" rx="2.5" fill="#E03E2F" />
      <circle cx="18" cy="22" r="4.5" fill="#F5A623" />
      <path d="M3 16 L18 28 L33 16" fill="#C93527" opacity="0.85" />
    </svg>
  )
}

export function WechatRedPacketBubbleFace({
  remark,
  kind,
  isSelf,
}: {
  remark: string
  kind: 'unclaimed' | 'claimed' | 'expired'
  isSelf: boolean
}) {
  const bg = kind === 'unclaimed' ? '#FA9D3B' : kind === 'claimed' ? '#FCE4C5' : '#E8D0BC'
  const dividerCls = kind === 'unclaimed' ? 'border-white/20' : 'border-white/30'

  let statusLabel: string | null = null
  if (kind === 'claimed') statusLabel = '已领取'
  else if (kind === 'expired') statusLabel = '已过期'

  return (
    <div
      className="relative w-[min(240px,72vw)] max-w-full shrink-0 select-none overflow-hidden rounded-lg text-white shadow-sm"
      style={{ backgroundColor: bg }}
    >
      <WechatBubbleTail isSelf={isSelf} bubbleColor={bg} />
      <div className="flex items-center gap-3 px-3 pt-3 pb-2.5">
        {kind === 'unclaimed' ? <WechatRedPacketIconClosed /> : <WechatRedPacketIconOpened />}
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[16px] font-normal leading-snug ${kind === 'expired' ? 'line-through opacity-90' : ''}`}
          >
            {remark}
          </p>
          {statusLabel ? <p className="mt-0.5 text-[12px] leading-snug text-white/90">{statusLabel}</p> : null}
        </div>
      </div>
      <div className={`border-t px-3 py-1.5 ${dividerCls}`}>
        <p className="text-[11px] leading-none text-white/70">微信红包</p>
      </div>
    </div>
  )
}

function WechatTransferIcon({ kind }: { kind: 'pending' | 'done' | 'returned' }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white">
      {kind === 'pending' ? (
        <svg className="h-[18px] w-[18px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4 4-4M17 8l4 4-4 4M3 12h18" />
        </svg>
      ) : kind === 'done' ? (
        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 14L4 9l5-5M15 10h7" />
        </svg>
      )}
    </span>
  )
}

export function WechatTransferBubbleFace({
  status,
  amountYuan,
  perspective = 'incoming',
}: {
  status: 'pending' | 'accepted' | 'returned'
  amountYuan: number | null
  perspective?: 'incoming' | 'outgoing'
}) {
  const pending = status === 'pending'
  const accepted = status === 'accepted'
  const outgoing = perspective === 'outgoing'
  const bg = pending ? '#FA9D3B' : '#FBD1A2'

  const amount =
    amountYuan != null && Number.isFinite(amountYuan)
      ? `¥${amountYuan.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '¥—'

  let statusLabel = '请收款'
  if (pending) {
    statusLabel = outgoing ? '待朋友确认收钱' : '请收款'
  } else if (accepted) {
    statusLabel = outgoing ? '已被接收' : '已收款'
  } else {
    statusLabel = outgoing ? '已被退还' : '已退还'
  }

  const iconKind = pending ? 'pending' : accepted ? 'done' : 'returned'

  return (
    <div
      className="relative w-[min(250px,72vw)] max-w-full shrink-0 select-none rounded-lg p-3 text-white shadow-sm"
      style={{ backgroundColor: bg }}
    >
      <WechatBubbleTail isSelf={outgoing} bubbleColor={bg} />
      <div className="flex items-center gap-3">
        <WechatTransferIcon kind={iconKind} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-normal tabular-nums leading-tight">{amount}</p>
          <p className="mt-0.5 truncate text-[13px] leading-snug opacity-95">{statusLabel}</p>
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-none text-white/80">转账</p>
    </div>
  )
}

export function WechatDetachedQuoteReply({
  senderName,
  content,
  isSelf,
  showAvatarGutter = false,
  onClick,
}: {
  senderName: string
  content: string
  isSelf: boolean
  showAvatarGutter?: boolean
  onClick?: () => void
}) {
  const label = `"${senderName}"：${content}`
  const shell = (
    <div
      className={`max-w-[min(280px,calc(100vw-24px-24px-80px))] truncate rounded bg-[#EBEBEB] px-2.5 py-1 text-xs text-gray-500 ${
        isSelf ? 'mr-1.5' : 'ml-1.5'
      }`}
    >
      {label}
    </div>
  )

  if (isSelf) {
    return (
      <div className="mb-1 w-full max-w-full">
        <div className="mr-[24px] ml-auto flex max-w-full flex-row justify-end gap-[12px]">
          <div className="flex min-w-0 flex-col items-end">{onClick ? <button type="button" onClick={onClick} className="text-left">{shell}</button> : shell}</div>
          {showAvatarGutter ? <div className="h-10 w-10 shrink-0" aria-hidden /> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-1 w-full max-w-full">
      <div className="ml-[24px] mr-auto flex max-w-full flex-row gap-[12px]">
        {showAvatarGutter ? <div className="h-10 w-10 shrink-0" aria-hidden /> : null}
        <div className="flex min-w-0 flex-1 flex-col items-start">
          {onClick ? <button type="button" onClick={onClick} className="text-left">{shell}</button> : shell}
        </div>
      </div>
    </div>
  )
}
