import { motion } from 'framer-motion'

import type { WeChatLocationPayload } from '../newFriendsPersona/types'
import { WechatCardTail } from '../wechatBubbleWechatUi'
import { resolveLocationMapSrc } from './resolveLocationMapSrc'

const CARD_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
}

type Props = {
  data: WeChatLocationPayload
  compact?: boolean
  /** 微信 8.x 经典位置卡片 */
  wechatClassic?: boolean
}

/** 聊天流中的坐标覆写位置卡片 */
export function LocationMessageCard({ data, compact = false, wechatClassic = false }: Props) {
  const name = data.name.trim()
  const address = data.address?.trim()
  const distance = data.distance.trim()
  const mapSrc = resolveLocationMapSrc(data)

  if (wechatClassic) {
    const subtitle = [distance ? `距离你 ${distance}` : '', address].filter(Boolean).join(' · ')
    return (
      <motion.div
        className={`relative overflow-hidden rounded-lg border border-[#EBEBEB] bg-white shadow-sm ${
          compact ? 'w-full' : 'w-60 max-w-full'
        }`}
        {...CARD_MOTION}
      >
        <div className="flex flex-col p-3">
          <span className="truncate text-[15px] font-medium leading-tight text-[#191919]">{name || '位置'}</span>
          {subtitle ? (
            <span className="mt-1 truncate text-[11px] text-gray-400">{subtitle}</span>
          ) : null}
        </div>
        <div className="h-28 bg-gray-100">
          <img src={mapSrc} alt="" className="h-full w-full object-cover" draggable={false} />
        </div>
        <WechatCardTail color="#FFFFFF" />
      </motion.div>
    )
  }

  return (
    <motion.div
      data-wx-msg-kind="location"
      className={`overflow-hidden rounded-[12px] border-[0.5px] border-gray-200 bg-white text-left shadow-[0_2px_15px_rgba(0,0,0,0.03)] ${
        compact ? 'w-full' : 'w-[min(280px,calc(100vw-120px))]'
      }`}
      {...CARD_MOTION}
    >
      <div className="relative h-[96px] w-full overflow-hidden bg-[#e8e8e8]">
        <img
          src={mapSrc}
          alt=""
          className="absolute inset-0 size-full object-cover contrast-[1.15] saturate-0"
          draggable={false}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/10" />
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <span
            className="block size-3 rounded-full ring-4"
            style={{
              backgroundColor: 'var(--wx-special-loc-pin, #D4AF37)',
              boxShadow: '0 0 0 4px color-mix(in srgb, var(--wx-special-loc-pin, #D4AF37) 30%, transparent)',
            }}
            aria-hidden
          />
        </div>
      </div>
      <div data-wx-special-card className="bg-white px-3.5 py-3">
        <p
          className="truncate font-serif text-[15px] leading-snug"
          style={{ color: 'var(--wx-special-loc-title, #0a0a0a)' }}
        >
          {name || 'TARGET'}
        </p>
        {address ? (
          <p
            className="mt-1 truncate text-[10px] leading-relaxed"
            style={{ color: 'var(--wx-special-loc-muted, #9ca3af)' }}
          >
            {address}
          </p>
        ) : (
          <p className="mt-1 text-[10px] text-gray-300">—</p>
        )}
        <div className="mt-3 border-t border-dashed border-gray-200 pt-2.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gray-400">Target Distance</p>
          <p
            className="mt-0.5 font-mono text-[11px] tracking-wide"
            style={{ color: 'var(--wx-special-loc-distance, #8B7355)' }}
          >
            [ {distance || 'Unknown'} ]
          </p>
        </div>
      </div>
    </motion.div>
  )
}

/** @deprecated 使用 LocationMessageCard */
export const LocationShareCard = LocationMessageCard
