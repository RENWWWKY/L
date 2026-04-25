import { AnimatePresence, motion } from 'framer-motion'
import { Phone, PhoneOff } from 'lucide-react'
import { useMemo } from 'react'

import { Pressable } from '../../../components/Pressable'

function fallbackBgStyle(backgroundImage?: string): React.CSSProperties {
  const url = (backgroundImage ?? '').trim()
  if (url) {
    return {
      backgroundImage: `url(${url})`,
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
    }
  }
  return {
    backgroundImage:
      'radial-gradient(1200px 700px at 20% 10%, rgba(255,255,255,0.95) 0%, rgba(245,245,247,0.82) 46%, rgba(240,240,242,0.88) 100%)',
  }
}

export function IncomingCallScreen({
  open,
  peerAvatarUrl,
  peerRemarkName,
  backgroundImage,
  onAccept,
  onReject,
}: {
  open: boolean
  peerAvatarUrl?: string
  peerRemarkName: string
  backgroundImage?: string
  onAccept: () => void
  onReject: () => void
}) {
  const peerName = useMemo(() => peerRemarkName.trim() || '对方', [peerRemarkName])
  const bgStyle = useMemo(() => fallbackBgStyle(backgroundImage), [backgroundImage])

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        key="incoming-call-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[286] flex h-full w-full flex-col"
        style={{ background: '#fff' }}
      >
        <div className="absolute inset-0" aria-hidden style={bgStyle} />
        <div className="absolute inset-0" aria-hidden style={{ background: 'rgba(255,255,255,0.62)', backdropFilter: 'blur(18px)' }} />

        <main className="relative z-[1] flex min-h-0 flex-1 flex-col items-center justify-center px-6">
          {peerAvatarUrl?.trim() ? (
            <img src={peerAvatarUrl.trim()} alt="" className="h-[96px] w-[96px] rounded-full object-cover shadow-[0_8px_26px_rgba(0,0,0,0.10)]" />
          ) : (
            <div className="flex h-[96px] w-[96px] items-center justify-center rounded-full bg-white/80 text-[#b3b3b3] shadow-[0_8px_26px_rgba(0,0,0,0.10)]">
              ?
            </div>
          )}
          <p className="mt-5 text-[20px] font-semibold text-[#1c1c1e]">{peerName}</p>
          <p className="mt-2 text-[14px] text-[#1c1c1e]/60">邀请你进行语音通话</p>
        </main>

        <footer className="pointer-events-none absolute inset-x-0 top-[66%] z-[2] -translate-y-1/2 px-8">
          <div className="pointer-events-auto mx-auto flex w-full max-w-[320px] items-center justify-center gap-12">
            <Pressable
              type="button"
              aria-label="拒绝"
              onClick={onReject}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ff3b30] text-white shadow-sm active:scale-[0.97]"
            >
              <PhoneOff className="size-6" />
            </Pressable>
            <Pressable
              type="button"
              aria-label="接听"
              onClick={onAccept}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[#34c759] text-white shadow-sm active:scale-[0.97]"
            >
              <Phone className="size-6" />
            </Pressable>
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  )
}

