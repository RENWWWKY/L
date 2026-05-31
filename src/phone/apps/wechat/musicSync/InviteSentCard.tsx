import { motion } from 'framer-motion'

import type { WeChatMusicSyncInvitePayload } from '../newFriendsPersona/types'

const CARD_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
}

type Props = {
  data: WeChatMusicSyncInvitePayload
}

/** 用户发出的音乐共听邀约卡（右对齐气泡内容） */
export function InviteSentCard({ data }: Props) {
  return (
    <motion.div
      className="w-[min(260px,calc(100vw-120px))] overflow-hidden rounded-[16px] border border-white/70 bg-white/75 shadow-[0_4px_24px_rgba(255,192,203,0.22)] ring-1 ring-rose-100/50 backdrop-blur-md"
      {...CARD_MOTION}
    >
      <div className="flex gap-3 p-3.5">
        {data.coverUrl ? (
          <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[10px] shadow-[0_2px_10px_rgba(255,192,203,0.25)] ring-1 ring-rose-100/60">
            <img src={data.coverUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          </div>
        ) : (
          <div className="h-[52px] w-[52px] shrink-0 rounded-[10px] bg-gradient-to-br from-rose-50 to-[#FFF0F3] ring-1 ring-rose-100/60" />
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-rose-400/90">
            Listen Together
          </p>
          <p className="mt-1 truncate text-[15px] font-medium leading-snug text-[#2D2422]">{data.trackTitle}</p>
          <p className="mt-0.5 truncate text-[12px] text-stone-400">{data.trackArtist || 'Unknown Artist'}</p>
        </div>
      </div>
      <div className="border-t border-rose-100/50 bg-gradient-to-r from-rose-50/40 to-white/30 px-3.5 py-2.5">
        <p className="font-serif text-[11px] italic leading-relaxed tracking-wide text-stone-400/95">
          I want to share this frequency with you.
        </p>
      </div>
    </motion.div>
  )
}
