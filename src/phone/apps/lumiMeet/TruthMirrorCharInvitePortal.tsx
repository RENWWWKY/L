import { AnimatePresence, motion } from 'framer-motion'
import { Aperture, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pressable } from '../../components/Pressable'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import { resolveMeetTruthPeerCeremonyCopy } from './encounterTruthMirrorData'

function TruthMirrorInviteExpandedBody({
  nickname,
  npcGender,
  onAccept,
  onDecline,
}: {
  nickname: string
  npcGender?: string
  onAccept: () => void
  onDecline: () => void
}) {
  const peer = resolveMeetTruthPeerCeremonyCopy(npcGender ?? '')
  const [phase, setPhase] = useState<'pulse' | 'choice'>('pulse')

  useEffect(() => {
    const t = window.setTimeout(() => setPhase('choice'), 2200)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <motion.div
      className="relative z-[1] flex max-w-sm flex-col items-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <motion.div
        className="relative flex size-28 items-center justify-center"
        animate={{
          scale: phase === 'pulse' ? [1, 1.06, 1] : 1,
          opacity: 1,
        }}
        transition={
          phase === 'pulse' ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.35 }
        }
      >
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-full border border-[#D4AF37]/25"
          animate={{ scale: phase === 'pulse' ? [1, 1.35, 1] : 1, opacity: phase === 'pulse' ? [0.55, 0, 0.55] : 0.2 }}
          transition={{ duration: 2, repeat: phase === 'pulse' ? Infinity : 0, ease: 'easeOut' }}
          aria-hidden
        />
        <motion.span
          className="pointer-events-none absolute inset-2 rounded-full border border-[#D4AF37]/35"
          animate={{ rotate: phase === 'pulse' ? 360 : 0 }}
          transition={{ duration: 8, repeat: phase === 'pulse' ? Infinity : 0, ease: 'linear' }}
          aria-hidden
        />
        <motion.div
          className="relative flex size-20 items-center justify-center rounded-full border border-[#e6e1d8] bg-white shadow-[0_16px_48px_rgba(212,175,55,0.18)]"
          style={{ boxShadow: '0 0 0 1px rgba(212,175,55,0.12), 0 16px 48px rgba(28,22,16,0.08)' }}
        >
          <Aperture className="size-9 text-[#b8973a]" strokeWidth={1.15} aria-hidden />
        </motion.div>
      </motion.div>

      <p className="meet-caption-en mt-8 text-center text-[9px] uppercase tracking-[0.34em] text-[#b8a994]">
        TRUTH · 交换真心话
      </p>
      <p id="truth-mirror-invite-title" className="mt-3 text-center font-elegant-serif text-[17px] tracking-[0.06em] text-[#2c2a26]">
        {phase === 'pulse' ? (
          <>
            <span className="text-[#1a1918]">{nickname}</span> 正在发起真心话
          </>
        ) : (
          <>
            <span className="text-[#1a1918]">{nickname}</span> 想与你交换真心话
          </>
        )}
      </p>
      <p className="mt-2 text-center text-[12px] font-light leading-relaxed text-[#8a847b]">
        {phase === 'pulse'
          ? '双盲问答 · 命运抽牌 · 封存后揭晓'
          : '同意后将自动为你抽题，流程与主动发起相同'}
      </p>

      <AnimatePresence mode="wait">
        {phase === 'choice' ? (
          <motion.div
            key="choice"
            className="relative z-[2] mt-10 flex w-full gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Pressable type="button" onClick={onDecline} className="meet-btn-secondary flex-1 py-3 text-[12px]">
              暂不参与
            </Pressable>
            <Pressable type="button" onClick={onAccept} className="meet-btn-primary flex-1 py-3 text-[12px]">
              同意 · 开始
            </Pressable>
          </motion.div>
        ) : (
          <motion.p
            key="pulse-hint"
            className="meet-caption-en mt-10 text-center text-[10px] tracking-[0.2em] text-[#c9c4bc]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            Summoning · 请稍候
          </motion.p>
        )}
      </AnimatePresence>

      {phase === 'choice' ? (
        <p className="meet-caption-en mt-6 text-center text-[9px] tracking-[0.14em] text-[#c4bfb8]">
          {peer.peerWritingEn} · 双盲封存后揭晓
        </p>
      ) : null}
    </motion.div>
  )
}

export function TruthMirrorCharInvitePortal({
  open,
  minimized,
  nickname,
  npcGender,
  onMinimize,
  onExpand,
  onAccept,
  onDecline,
}: {
  open: boolean
  minimized: boolean
  nickname: string
  npcGender?: string
  onMinimize: () => void
  onExpand: () => void
  onAccept: () => void
  onDecline: () => void
}) {
  const el = getLumiMeetPortalTarget()
  if (!el || !open) return null

  if (minimized) {
    return createPortal(
      <motion.div
        key="truth-mirror-invite-chip"
        role="status"
        className="fixed left-3 z-[400] flex max-w-[min(280px,calc(100vw-24px))]"
        style={{ top: 'max(12px, env(safe-area-inset-top, 0px))' }}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
      >
        <Pressable
          type="button"
          onClick={onExpand}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-[#e8e4dc] bg-white/95 py-2 pl-2.5 pr-3 shadow-[0_10px_32px_rgba(22,18,14,0.12)] backdrop-blur-md"
          aria-label={`展开 ${nickname} 的真心话邀约`}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#faf8f5]">
            <Aperture className="size-4 text-[#b8973a]" strokeWidth={1.2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[12px] font-medium tracking-[0.04em] text-[#2c2a26]">
              {nickname} · 真心话邀约
            </span>
            <span className="meet-caption-en block truncate text-[9px] tracking-[0.12em] text-[#a8a4a0]">
              点击展开 · TRUTH
            </span>
          </span>
        </Pressable>
      </motion.div>,
      el,
    )
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="truth-mirror-invite"
        role="dialog"
        aria-modal="true"
        aria-labelledby="truth-mirror-invite-title"
        className="fixed inset-0 z-[400] flex flex-col items-center justify-center bg-[#faf8f5]/96 px-6 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <Pressable
          type="button"
          onClick={onMinimize}
          className="absolute left-4 flex size-9 items-center justify-center rounded-full border border-[#e8e4dc] bg-white/90 text-[#6e6860] shadow-sm backdrop-blur-sm"
          style={{ top: 'max(12px, env(safe-area-inset-top, 0px))' }}
          aria-label="收起真心话邀约"
        >
          <Minus className="size-4" strokeWidth={2} aria-hidden />
        </Pressable>

        <TruthMirrorInviteExpandedBody
          key="truth-mirror-invite-body"
          nickname={nickname}
          npcGender={npcGender}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      </motion.div>
    </AnimatePresence>,
    el,
  )
}
