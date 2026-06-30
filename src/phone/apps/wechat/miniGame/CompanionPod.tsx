import { motion, AnimatePresence } from 'framer-motion'

import { resolveCharacterAvatarUrl } from '../../../utils/characterAvatarUrl'

export function CompanionPod({
  avatarUrl,
  reactionText,
  visible,
}: {
  avatarUrl?: string
  reactionText: string | null
  visible: boolean
}) {
  const resolved = resolveCharacterAvatarUrl({ avatarUrl }) || undefined

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start px-3"
      style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
    >
      <div className="flex min-w-0 max-w-full items-center gap-2">
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[#E5E7EB] bg-white shadow-sm">
          {resolved ? (
            <img src={resolved} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#F3F4F6] text-[10px] text-[#9CA3AF]">
              ?
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {visible && reactionText ? (
            <motion.div
              key={reactionText}
              initial={{ width: 0, opacity: 0, y: 5 }}
              animate={{ width: 'auto', opacity: 1, y: 0 }}
              exit={{ width: 0, opacity: 0, y: 4 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="overflow-hidden"
            >
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.08 }}
                className="whitespace-nowrap rounded-full border border-white/60 bg-white/75 px-3 py-1.5 text-[13px] italic leading-snug text-[#0A0A0C] shadow-sm backdrop-blur-md"
                style={{ fontFamily: 'var(--phone-font, "Noto Serif SC", serif)' }}
              >
                {reactionText}
              </motion.p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
