import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'

import { LIVE_PLATINUM, LIVE_SERIF, LIVE_Z } from './constants'
import type { SponsorshipCeremonyPayload } from './types'

export function SponsorshipCeremony({
  payload,
  onDone,
}: {
  payload: SponsorshipCeremonyPayload | null
  onDone: () => void
}) {
  useEffect(() => {
    if (!payload) return
    const t = window.setTimeout(onDone, 2200)
    return () => window.clearTimeout(t)
  }, [onDone, payload])

  return (
    <AnimatePresence>
      {payload ? (
        <motion.div
          key={payload.id}
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          style={{ zIndex: LIVE_Z.ceremony }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* 极细铂金流光 */}
          <motion.div
            className="absolute left-1/2 w-px"
            style={{
              top: '18%',
              height: '42%',
              background: `linear-gradient(to top, transparent, ${LIVE_PLATINUM}, transparent)`,
              boxShadow: `0 0 8px ${LIVE_PLATINUM}`,
            }}
            initial={{ scaleY: 0, opacity: 0, x: '-50%' }}
            animate={{ scaleY: 1, opacity: [0, 1, 0.35], x: '-50%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.p
            className="relative mt-[18%] max-w-[82%] px-4 text-center text-[17px] leading-relaxed tracking-[0.04em] text-white/95"
            style={{
              fontFamily: LIVE_SERIF,
              fontStyle: 'italic',
              textShadow: '0 0 18px rgba(212,175,55,0.25), 0 1px 8px rgba(0,0,0,0.55)',
            }}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0, filter: 'blur(4px)' }}
            transition={{ delay: 0.35, duration: 0.55 }}
          >
            {payload.userNick} 为 {payload.hostName} 点亮了 {payload.giftLabel}
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
