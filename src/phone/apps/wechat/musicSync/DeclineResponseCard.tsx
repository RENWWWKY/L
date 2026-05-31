import { motion } from 'framer-motion'
import { Unlink } from 'lucide-react'

import type { WeChatMusicSyncDeclinePayload } from '../newFriendsPersona/types'

const CARD_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
}

type Props = {
  data: WeChatMusicSyncDeclinePayload
}

/** 角色拒绝共听的回应卡（左对齐） */
export function DeclineResponseCard({ data }: Props) {
  return (
    <motion.div
      className="w-[min(260px,calc(100vw-120px))] overflow-hidden rounded-[12px] border border-stone-100 bg-gray-50 opacity-80 shadow-sm"
      style={{ borderLeftWidth: 2, borderLeftColor: '#4A4A4A' }}
      {...CARD_MOTION}
    >
      <div className="px-3.5 py-3">
        <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-stone-400 line-through">
          SIGNAL LOST | 错失的波段
        </p>
        <div className="my-3 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100/80">
            <Unlink className="size-5 text-stone-400" strokeWidth={1.5} />
          </div>
        </div>
        <p className="font-serif text-[13px] leading-relaxed text-stone-500">{data.replyText}</p>
      </div>
    </motion.div>
  )
}
