/** 细密灰度噪点（略高频 = 更细的「砂」），data URL 避免 id 冲突 */
const AFF_CARD_MATTE_GRAIN_BG = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="1.08" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#g)" fill="#fff"/></svg>',
)}")`

/** 卡面磨砂：颗粒叠在半透明底+blur 之上才明显；避免 soft-light（近黑底几乎不可见） */
function AffectionCardMatteSurface() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.38] mix-blend-overlay"
        style={{
          backgroundImage: AFF_CARD_MATTE_GRAIN_BG,
          backgroundSize: '48px 48px',
          backgroundRepeat: 'repeat',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/[0.09] via-transparent to-black/[0.28]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_12px_28px_-10px_rgba(255,255,255,0.05),inset_0_-24px_44px_rgba(0,0,0,0.5)]"
      />
    </>
  )
}

/** 卡背寄语展示上限（按 Unicode 码点计，兼容 emoji / 汉字） */
export function clampAffectionBlessingDisplay(text: string, maxChars = 15): string {
  const t = text.trim()
  if (!t) return ''
  const seq = [...t]
  return seq.length <= maxChars ? t : seq.slice(0, maxChars).join('')
}

export function AffectionCard({
  senderName,
  senderAvatar,
  signature,
  quote,
  balance,
  limit,
  onOpenTransactions,
}: {
  senderName: string
  senderAvatar: string
  signature: string
  quote: string
  balance: number
  limit: number
  onOpenTransactions?: () => void
}) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 1
  const safeBalance = Number.isFinite(balance) && balance >= 0 ? balance : 0
  const pct = Math.max(0, Math.min(1, safeBalance / safeLimit))

  const money = (v: number) =>
    `¥ ${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="relative isolate aspect-[1.586/1] w-[320px] overflow-hidden rounded-[26px] border border-white/[0.09] bg-gradient-to-br from-[#1a1a1d]/80 via-[#121214]/85 to-black/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.11)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
      <style>
        {String.raw`
@keyframes aff_shimmer {
  0% { transform: translateX(-140%) skewX(-18deg); opacity: 0; }
  6% { opacity: 0.55; }
  20% { transform: translateX(140%) skewX(-18deg); opacity: 0; }
  100% { transform: translateX(140%) skewX(-18deg); opacity: 0; }
}
`}
      </style>

      {/* Shimmer */}
      <div
        className="pointer-events-none absolute -left-1/2 top-0 h-full w-[180%]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 42%, rgba(212,175,55,0.10) 50%, rgba(255,255,255,0.14) 58%, transparent 100%)',
          animation: 'aff_shimmer 4s ease-in-out infinite',
        }}
      />

      {/* Soft texture */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.55]" style={{ background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.08), transparent 55%)' }} />

      <AffectionCardMatteSurface />

      <div className="relative z-[1] flex h-full flex-col px-5 py-5 text-white">
        {onOpenTransactions ? (
          <button
            type="button"
            aria-label="查看亲情卡交易流水"
            onClick={(e) => {
              e.stopPropagation()
              onOpenTransactions()
            }}
            className="absolute right-4 top-4 z-[2] inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)] transition-colors hover:bg-white/10"
          >
            {/* 内联 SVG：避免增加额外依赖 import，保持图标纤细 */}
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V5a2 2 0 0 1 2-2z" />
              <path d="M9 8h6" />
              <path d="M9 12h6" />
            </svg>
          </button>
        ) : null}

        {/* Top: 赠送方头像与署名 */}
        <div className="flex min-w-0 items-start gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full ring-[1.5px] ring-[#D4AF37]/55 ring-offset-2 ring-offset-black/40">
            <img src={senderAvatar} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="truncate text-[14px] font-medium text-white/90">{senderName}</p>
            <p
              className="mt-0.5 line-clamp-2 text-[12px] italic leading-snug"
              style={{ color: '#D4AF37', fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}
            >
              {signature}
            </p>
          </div>
        </div>

        {/* Middle: quote */}
        <div className="mt-6 flex-1 pr-6">
          <p className="text-[18px] leading-[1.45] text-white/60" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            {quote}
          </p>
        </div>

        {/* Bottom: financial + progress */}
        <div className="mt-3">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] tracking-widest text-gray-500">REMAINING BALANCE</p>
              <p
                className="mt-2 truncate text-[22px] font-semibold tabular-nums text-white"
                style={{ fontFamily: 'ui-rounded, system-ui, "DIN Alternate", "SF Pro Display", sans-serif' }}
              >
                {money(safeBalance)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] tracking-widest text-gray-500">MONTHLY LIMIT</p>
              <p className="mt-2 text-[16px] font-medium tabular-nums text-white/70" style={{ fontFamily: 'ui-rounded, system-ui, "DIN Alternate", "SF Pro Display", sans-serif' }}>
                / {money(safeLimit)}
              </p>
            </div>
          </div>

          {/* 1px progress line */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10">
            <div
              className="h-full bg-white"
              style={{
                width: `${Math.round(pct * 1000) / 10}%`,
                boxShadow: '0 0 10px rgba(212,175,55,0.25)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/** 卡背：纤细手写感（独立于全局 UI）；Zhi Mang Xing 偏细行草，Long Cang 行书回退 */
const AFF_CARD_BACK_ART_FONT = '"Zhi Mang Xing", "Long Cang", "ZCOOL XiaoWei", "KaiTi", "STKaiti", serif'

export function AffectionCardBack({
  giverName,
  blessing,
}: {
  giverName: string
  blessing: string
}) {
  return (
    <div className="relative isolate aspect-[1.586/1] w-[320px] overflow-hidden rounded-[26px] border border-white/[0.09] bg-gradient-to-br from-[#1a1a1d]/80 via-[#121214]/85 to-black/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.11)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
      <style>
        {String.raw`
@keyframes aff_back_shimmer {
  0% { transform: translateX(-120%) skewX(-14deg); opacity: 0; }
  8% { opacity: 0.35; }
  22% { transform: translateX(120%) skewX(-14deg); opacity: 0; }
  100% { transform: translateX(120%) skewX(-14deg); opacity: 0; }
}
`}
      </style>

      <div
        className="pointer-events-none absolute -left-1/2 top-0 h-full w-[160%]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.06) 48%, rgba(255,255,255,0.08) 52%, transparent 100%)',
          animation: 'aff_back_shimmer 5.5s ease-in-out infinite',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{ background: 'radial-gradient(circle at 78% 18%, rgba(212,175,55,0.12), transparent 50%)' }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{ background: 'radial-gradient(circle at 12% 88%, rgba(255,255,255,0.06), transparent 45%)' }}
      />

      <AffectionCardMatteSurface />

      <div className="relative z-[1] flex h-full flex-col px-6 py-6 text-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#D4AF37]/25 pb-4">
          <p className="text-[10px] tracking-[0.32em] text-[#D4AF37]/85">赠予寄语</p>
          <p className="truncate text-[11px] tracking-[0.14em] text-white/45">FROM · {giverName}</p>
        </div>

        <div className="mt-5 flex flex-1 flex-col justify-center px-0.5">
          <p
            className="text-[22px] font-normal leading-[1.72] tracking-[0.06em] text-white/[0.86] antialiased [text-shadow:0_1px_10px_rgba(212,175,55,0.06)]"
            style={{ fontFamily: AFF_CARD_BACK_ART_FONT, fontWeight: 400, fontSynthesis: 'none' as const }}
          >
            {clampAffectionBlessingDisplay(blessing)}
          </p>
        </div>

        <p className="text-center text-[11px] tracking-[0.12em] text-white/35">轻触卡面返回正面</p>
      </div>
    </div>
  )
}
