import { AnimatePresence, motion } from 'framer-motion'
import { Coffee, ScrollText, Sparkles, X } from 'lucide-react'

import { Pressable } from '../../components/Pressable'
import { phoneNumStyle } from '../../types'
import { LIVE_PLATINUM, LIVE_SERIF, LIVE_Z } from './constants'
import { LIVE_GIFTS } from './gifts'
import type { LiveGift, LiveGiftId } from './types'

const GIFT_ICONS: Record<LiveGiftId, typeof Coffee> = {
  americano: Coffee,
  letter: ScrollText,
  stardust: Sparkles,
}

export function GiftBottomSheet({
  open,
  balanceYuan,
  balanceLabel,
  busy,
  error,
  onClose,
  onSelect,
}: {
  open: boolean
  balanceYuan: number
  balanceLabel: string
  busy?: boolean
  error?: string
  onClose: () => void
  onSelect: (gift: LiveGift) => void
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="关闭心意赞助"
            className="absolute inset-0 bg-black/40"
            style={{ zIndex: LIVE_Z.giftSheet }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[20px] border-t border-white/15 bg-black/50 shadow-[0_-12px_40px_rgba(0,0,0,0.35)] backdrop-blur-3xl"
            style={{ zIndex: LIVE_Z.giftSheet + 1 }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            role="dialog"
            aria-label="心意赞助"
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <div>
                <p
                  className="text-[15px] tracking-[0.18em] text-white/90"
                  style={{ fontFamily: LIVE_SERIF }}
                >
                  心意赞助
                </p>
                <p className="mt-1 text-[11px] tracking-[0.12em] text-white/40">RESONANCE DROP</p>
              </div>
              <Pressable
                type="button"
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-full border border-white/20 text-white/70"
                aria-label="关闭"
              >
                <X className="size-4" strokeWidth={1.5} />
              </Pressable>
            </div>

            <div className="grid grid-cols-3 gap-3 px-5 pb-4 pt-2">
              {LIVE_GIFTS.map((gift) => {
                const Icon = GIFT_ICONS[gift.id]
                const unaffordable = balanceYuan < gift.priceYuan
                return (
                  <Pressable
                    key={gift.id}
                    type="button"
                    disabled={busy || unaffordable}
                    onClick={() => onSelect(gift)}
                    className="flex flex-col items-center gap-2 rounded-[14px] border border-white/12 bg-white/[0.04] px-2 py-4 text-center transition-colors enabled:hover:border-[#D4AF37]/45 enabled:hover:bg-white/[0.07] disabled:opacity-40"
                  >
                    <span
                      className="flex size-11 items-center justify-center rounded-full border border-[#D4AF37]/35"
                      style={{ color: LIVE_PLATINUM }}
                    >
                      <Icon className="size-5" strokeWidth={1.4} />
                    </span>
                    <span className="text-[12px] leading-tight text-white/90">{gift.name}</span>
                    <span
                      className="text-[12px] tracking-wide"
                      style={{ ...phoneNumStyle, color: LIVE_PLATINUM }}
                    >
                      ¥{gift.priceYuan}
                    </span>
                    <span className="text-[10px] leading-snug text-white/35">{gift.blurb}</span>
                  </Pressable>
                )
              })}
            </div>

            <div className="border-t border-white/10 px-5 py-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] tracking-[0.08em] text-white/45">Lumi 钱包余额</span>
                <span className="text-[16px] text-white/90" style={phoneNumStyle}>
                  {balanceLabel}
                </span>
              </div>
              {error ? <p className="mt-2 text-[12px] text-rose-300/90">{error}</p> : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
