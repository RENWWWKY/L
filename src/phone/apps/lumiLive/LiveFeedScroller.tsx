import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Eye } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import type { ApiConfig } from '../api/types'
import { LIVE_PLATINUM, LIVE_SERIF, LIVE_Z } from './constants'
import { ImmersiveLiveRoom } from './ImmersiveLiveRoom'
import { coverToneForId, formatViewerLabel } from './liveRooms'
import type { LiveRoom } from './types'

function FeedSlide({ room, active }: { room: LiveRoom; active: boolean }) {
  const mediaUrl = room.coverUrl || room.avatarUrl
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0c0c0d]">
      {mediaUrl ? (
        <motion.img
          src={mediaUrl}
          alt=""
          className="h-full w-full object-cover"
          animate={active ? { scale: [1, 1.05, 1] } : { scale: 1.02 }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <motion.div
          className="h-full w-full"
          style={{ background: coverToneForId(room.id) }}
          animate={active ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1.5px]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-[max(3.5rem,calc(env(safe-area-inset-top,0px)+2.75rem))]">
        <div className="flex items-center gap-2">
          <div className="size-9 overflow-hidden rounded-full border border-white/25 bg-white/10">
            {room.avatarUrl ? (
              <img src={room.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-[12px] text-white/70"
                style={{ background: coverToneForId(room.id) }}
              >
                {room.hostName.slice(0, 1)}
              </div>
            )}
          </div>
          <div>
            <p className="text-[13px] font-medium text-white/95">{room.hostName}</p>
            <p className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] text-white/55">
              <span
                className="inline-block size-1.5 rounded-full bg-white"
                style={{
                  animation: active ? 'lumiLivePulse 1.8s ease-in-out infinite' : undefined,
                }}
              />
              LIVE
            </p>
          </div>
        </div>
        <p className="flex items-center gap-1 pt-1 text-[12px] tabular-nums text-white/75">
          <Eye className="size-3.5 opacity-70" strokeWidth={1.5} />
          {formatViewerLabel(room.viewerCount)}
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-16 px-5">
        <p className="text-[13px] tracking-[0.06em] text-white/55" style={{ fontFamily: LIVE_SERIF }}>
          {room.title}
        </p>
        <p className="mt-2 text-[12px] text-white/40">轻触进入连线</p>
      </div>
    </div>
  )
}

export function LiveFeedScroller({
  rooms,
  userNick,
  apiConfig,
  danmakuApiConfig,
  onBack,
  className = '',
}: {
  rooms: LiveRoom[]
  userNick: string
  apiConfig?: ApiConfig | null
  danmakuApiConfig?: ApiConfig | null
  onBack: () => void
  className?: string
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [enteredId, setEnteredId] = useState<string | null>(null)

  const onScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const h = el.clientHeight || 1
    const next = Math.round(el.scrollTop / h)
    setIndex(Math.max(0, Math.min(rooms.length - 1, next)))
  }, [rooms.length])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [onScroll])

  const enteredRoom = enteredId ? rooms.find((r) => r.id === enteredId) : null

  return (
    <div className={`lumi-live-root relative h-full min-h-0 w-full overflow-hidden bg-black ${className}`}>
      <div
        className="absolute inset-x-0 top-0 flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))]"
        style={{ zIndex: LIVE_Z.chrome + 5 }}
      >
        <Pressable
          type="button"
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white/90 backdrop-blur-2xl"
          aria-label="返回发现"
        >
          <ChevronLeft className="size-5" strokeWidth={1.5} />
        </Pressable>
        <p
          className="pr-2 text-[13px] tracking-[0.22em]"
          style={{ fontFamily: LIVE_SERIF, color: LIVE_PLATINUM }}
        >
          浮光
        </p>
        <span className="w-10" />
      </div>

      <div
        ref={scrollerRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {rooms.map((room, i) => (
          <div key={room.id} className="h-full w-full shrink-0 snap-start snap-always">
            <button
              type="button"
              className="block h-full w-full border-0 bg-transparent p-0 text-left"
              onClick={() => setEnteredId(room.id)}
              aria-label={`进入 ${room.hostName} 的直播间`}
            >
              <FeedSlide room={room} active={i === index && !enteredId} />
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {enteredRoom ? (
          <motion.div
            key={enteredRoom.id}
            className="absolute inset-0"
            style={{ zIndex: LIVE_Z.chrome + 20 }}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <ImmersiveLiveRoom
              room={enteredRoom}
              active
              userNick={userNick}
              apiConfig={apiConfig}
              danmakuApiConfig={danmakuApiConfig}
              onExit={() => setEnteredId(null)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!enteredId ? (
        <p className="pointer-events-none absolute bottom-5 left-0 right-0 text-center text-[10px] tracking-[0.18em] text-white/30">
          上下滑动切换 · {index + 1}/{rooms.length}
        </p>
      ) : null}
    </div>
  )
}
