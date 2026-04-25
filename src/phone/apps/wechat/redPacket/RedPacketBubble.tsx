import { Gift } from 'lucide-react'

/** 暗金描边的极简红包轮廓，避免高饱和金红 */
function RedPacketGlyph({ muted = false }: { muted?: boolean }) {
  const stroke = muted ? 'rgba(201,169,98,0.35)' : 'rgba(201,169,98,0.65)'
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
      style={{
        borderColor: '#333333',
        background: 'linear-gradient(145deg, #1e1e1e 0%, #121212 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <Gift className="size-[18px]" strokeWidth={1.35} style={{ color: stroke }} aria-hidden />
    </div>
  )
}

export type RedPacketBubbleData = {
  remark: string
  opened: boolean
  amountYuan: number
}

/**
 * 黑金高定风红包气泡：磨砂黑底 + 细白/灰描边，英文 TRANSFER。
 * 已拆开：整体透明度降低，主文案为「Red Packet Opened」。
 */
export function RedPacketBubble({ data, isSelf: _isSelf }: { data: RedPacketBubbleData; isSelf: boolean }) {
  const opened = data.opened
  const matteBg = 'linear-gradient(180deg, #1a1a1a 0%, #101010 100%)'
  const border = '1px solid #333333'

  return (
    <div
      className={`select-none text-left transition-opacity duration-300 ease-out ${
        opened
          ? 'max-w-[min(280px,72vw)]'
          : 'w-[min(220px,72vw)] max-w-full shrink-0 overflow-hidden'
      }`}
      style={{
        borderRadius: 14,
        border,
        background: matteBg,
        padding: '12px 14px',
        opacity: opened ? 0.5 : 1,
        userSelect: 'none',
        WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'],
        WebkitTouchCallout: 'none' as React.CSSProperties['WebkitTouchCallout'],
        boxShadow: opened ? 'none' : '0 8px 24px rgba(0,0,0,0.25)',
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <RedPacketGlyph muted={opened} />
        <div className="min-w-0 flex-1">
          {opened ? (
            <>
              <p className="truncate text-[14px] font-medium tracking-wide text-white/75">Red Packet Opened</p>
              <p className="mt-1 text-[10px] font-medium tracking-[0.2em] text-[#c9a962]/80">TRANSFER</p>
            </>
          ) : (
            <>
              <p className="truncate text-[15px] font-medium text-white/92">{data.remark || 'Best Wishes'}</p>
              <p className="mt-1 text-[10px] font-medium tracking-[0.2em] text-[#c9a962]/90">TRANSFER</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
