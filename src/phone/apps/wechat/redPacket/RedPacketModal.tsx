import { useCallback, useEffect, useRef, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import './redPacketMotion.css'

const GOLD = '#c9a962'
const GOLD_DEEP = '#8a7344'

/**
 * 居中黑金拆红包：磨砂遮罩 + 竖向封套 + 中央暗金金币（繁体「開」）。
 * 点击金币后 CSS rotateY 约 1s，随后由 onFlowComplete 写库并跳转详情（由上层处理）。
 */
export function RedPacketModal({
  open,
  remark,
  senderName,
  senderAvatarUrl,
  onClose,
  onFlowComplete,
}: {
  open: boolean
  remark: string
  senderAvatarUrl?: string
  senderName: string
  onClose: () => void
  /** 动画结束后调用：上层负责 patch opened、关弹窗、navigate 详情 */
  onFlowComplete: () => void | Promise<void>
}) {
  const [coinFlipping, setCoinFlipping] = useState(false)
  const finishedRef = useRef(false)
  const flowRef = useRef(onFlowComplete)
  flowRef.current = onFlowComplete

  useEffect(() => {
    if (!open) {
      setCoinFlipping(false)
      finishedRef.current = false
    }
  }, [open])

  const runComplete = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    void Promise.resolve(flowRef.current()).catch(() => {})
  }, [])

  const onCoinAnimationEnd = useCallback(
    (e: React.AnimationEvent<HTMLButtonElement>) => {
      if (!coinFlipping) return
      const name = e.animationName || ''
      if (!name.includes('wx-redpacket-coin-flip-y')) return
      runComplete()
    },
    [coinFlipping, runComplete],
  )

  useEffect(() => {
    if (!open || !coinFlipping) return
    const t = window.setTimeout(() => runComplete(), 1100)
    return () => window.clearTimeout(t)
  }, [open, coinFlipping, runComplete])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center px-5 py-8"
      style={{
        background: 'rgba(0,0,0,0.42)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        paddingTop: 'max(16px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !coinFlipping) onClose()
      }}
      role="presentation"
    >
      <div
        className="relative w-full max-w-[320px] overflow-hidden rounded-[22px] border border-white/10"
        style={{
          background: 'linear-gradient(180deg, #1c1c1c 0%, #0d0d0d 100%)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <div className="px-6 pb-8 pt-7 text-center">
          <p className="text-[10px] font-medium tracking-[0.28em] text-white/35">RED PACKET</p>

          <div className="mt-5 flex flex-col items-center gap-2">
            {senderAvatarUrl?.trim() ? (
              <img
                src={senderAvatarUrl.trim()}
                alt=""
                className="h-14 w-14 rounded-2xl border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[18px] text-white/35">
                ?
              </div>
            )}
            <p className="max-w-[240px] truncate text-[16px] font-medium text-white/88">{senderName}</p>
          </div>

          <p className="mx-auto mt-5 max-w-[260px] text-[14px] leading-relaxed text-white/50">
            {remark.trim() || 'Best Wishes'}
          </p>

          <div className="mt-8 flex justify-center">
            <Pressable
              type="button"
              disabled={coinFlipping}
              onClick={() => {
                if (coinFlipping || finishedRef.current) return
                setCoinFlipping(true)
              }}
              onAnimationEnd={onCoinAnimationEnd}
              className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 transition-transform active:scale-[0.97] disabled:opacity-90 ${
                coinFlipping ? 'wx-rp-coin-flip' : 'wx-rp-coin-idle'
              }`}
              style={{
                borderColor: `${GOLD_DEEP}`,
                background: `radial-gradient(circle at 30% 28%, ${GOLD} 0%, ${GOLD_DEEP} 48%, #3d3424 100%)`,
                boxShadow: '0 6px 20px rgba(0,0,0,0.45), inset 0 2px 4px rgba(255,255,255,0.12)',
              }}
              aria-label="開"
            >
              <span
                className="select-none text-[22px] font-semibold text-[#1a1510]"
                style={{ fontFamily: 'ui-serif, "Songti SC", "Noto Serif SC", serif', textShadow: '0 1px 0 rgba(255,255,255,0.15)' }}
              >
                開
              </span>
            </Pressable>
          </div>

          <p className="mt-4 text-[11px] tracking-[0.12em] text-white/30">TAP COIN · OPEN</p>
        </div>
      </div>
    </div>
  )
}
