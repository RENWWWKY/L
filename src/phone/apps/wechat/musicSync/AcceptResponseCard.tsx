import { motion } from 'framer-motion'
import { Headphones } from 'lucide-react'

import type { WeChatMusicSyncAcceptPayload } from '../newFriendsPersona/types'

const CARD_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
}

type Props = {
  data: WeChatMusicSyncAcceptPayload
  /** 旧消息无 coverUrl 时，从同 inviteId 的邀约卡回退 */
  coverUrl?: string
}

/** 角色同意共听的回应卡（左对齐） */
export function AcceptResponseCard({ data, coverUrl: coverUrlProp }: Props) {
  const coverSrc = (coverUrlProp ?? data.coverUrl)?.trim() || ''

  return (
    <motion.div
      className="w-[min(260px,calc(100vw-120px))] overflow-hidden rounded-[16px] border border-white/70 bg-white/75 shadow-[0_4px_24px_rgba(255,192,203,0.18)] ring-1 ring-rose-100/50 backdrop-blur-md"
      {...CARD_MOTION}
    >
      <div className="flex gap-3 p-3.5">
        {coverSrc ? (
          <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[10px] shadow-[0_2px_10px_rgba(255,192,203,0.25)] ring-1 ring-rose-100/60">
            <img
              src={coverSrc}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-rose-50 via-[#FFF0F3] to-emerald-50/70 ring-1 ring-rose-100/60 shadow-[0_2px_10px_rgba(255,192,203,0.15)]">
            <Headphones className="size-6 text-rose-400/90" strokeWidth={1.5} />
          </div>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-500/85">
            Connected
          </p>
          <p className="mt-1 text-[15px] font-medium leading-snug text-[#2D2422]">一起听</p>
          <p className="mt-0.5 truncate text-[12px] text-stone-400">
            {data.trackTitle?.trim() || '频率已接轨'}
          </p>
        </div>
      </div>
      <div className="border-t border-rose-100/50 bg-gradient-to-r from-emerald-50/30 via-rose-50/25 to-white/30 px-3.5 py-2.5">
        <p className="font-serif text-[11px] italic leading-relaxed tracking-wide text-stone-400/95">
          Resonance established.
        </p>
      </div>
    </motion.div>
  )
}
