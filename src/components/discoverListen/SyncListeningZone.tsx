import { motion } from 'framer-motion'
import { Infinity as InfinityIcon } from 'lucide-react'

import type { SyncListeningState } from '../../stores/useMusicStore'

const DEMO_SYNC_LISTENING: SyncListeningState = {
  companion: {
    name: '屿岸',
    avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=yuan',
  },
  user: {
    name: '我',
    avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=me-rose',
  },
}

export function SyncListeningZone({
  sync,
  useDemo = true,
}: {
  sync: SyncListeningState | null
  useDemo?: boolean
}) {
  const state = sync ?? (useDemo ? DEMO_SYNC_LISTENING : null)
  if (!state) return null

  return (
    <div className="mb-4 rounded-[20px] bg-gradient-to-br from-[#FFF0F3]/90 via-[#FFE4E8]/40 to-white/80 px-3.5 py-3 ring-1 ring-rose-100/70">
      <p className="text-center font-serif text-[11px] italic leading-relaxed text-stone-500">
        Synchronizing heartbeats with{' '}
        <span className="font-medium text-[#2D2422]">{state.companion.name}</span>
        …
      </p>
      <p className="mt-0.5 text-center text-[10px] tracking-wide text-stone-400/90">
        正与他共享此时的心跳频率
      </p>

      <div className="relative mx-auto mt-3 flex w-fit items-center justify-center">
        <div className="relative z-10 -mr-3 h-11 w-11 overflow-hidden rounded-full ring-4 ring-rose-50/80 shadow-[0_4px_16px_rgba(255,192,203,0.25)]">
          <img
            src={state.user.avatar}
            alt={state.user.name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        <div
          className="relative z-20 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/90 text-rose-300 shadow-[0_0_12px_rgba(255,192,203,0.45)] ring-1 ring-rose-100/80"
          aria-hidden
        >
          <motion.span
            animate={{ opacity: [0.65, 1, 0.65], scale: [0.96, 1.04, 0.96] }}
            transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
            className="flex items-center justify-center"
          >
            <InfinityIcon className="size-4" strokeWidth={1.75} />
          </motion.span>
        </div>

        <div className="relative z-10 -ml-3 h-11 w-11 overflow-hidden rounded-full ring-4 ring-rose-50/80 shadow-[0_4px_16px_rgba(255,192,203,0.25)]">
          <img
            src={state.companion.avatar}
            alt={state.companion.name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  )
}
