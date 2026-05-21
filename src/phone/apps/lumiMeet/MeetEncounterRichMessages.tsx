import { motion } from 'framer-motion'
import { Pressable } from '../../components/Pressable'
import type {
  MeetEchoRevealPayload,
  MeetMusicSharePayload,
  MeetTruthMirrorRecordPayload,
} from './meetTypes'
import { resolveMeetTruthPeerCeremonyCopy } from './encounterTruthMirrorData'

const PLATINUM = '#D4AF37'

export function MeetSystemCenterLine({ text }: { text: string }) {
  return (
    <div className="flex w-full justify-center px-6 py-2">
      <p className="max-w-[min(320px,92%)] text-center font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-[#7a736b]">
        <span className="text-[#b8973a]">[ FIELD ]</span> {text}
      </p>
    </div>
  )
}

export function MeetMusicShareCard({ payload }: { payload: MeetMusicSharePayload }) {
  const sub = [payload.artist, payload.catalog?.toUpperCase()].filter(Boolean).join(' · ')
  return (
    <div className="flex w-full justify-center px-4 py-3">
      <div
        className="flex w-full max-w-[min(300px,94%)] gap-4 rounded-[14px] border-[0.5px] border-gray-200 bg-white/90 p-4 shadow-[0_12px_40px_rgba(22,18,14,0.08)] backdrop-blur-md"
        style={{ borderTopColor: `${PLATINUM}66`, borderTopWidth: 2 }}
      >
        <div className="relative size-[72px] shrink-0">
          <div
            className="absolute inset-0 rounded-full border-[0.5px] border-gray-300 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] shadow-inner"
            aria-hidden
          />
          <div
            className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gray-600 bg-black"
            aria-hidden
          />
          {payload.artworkUrl ? (
            <img
              src={payload.artworkUrl}
              alt=""
              className="relative z-[1] size-[72px] rounded-full object-cover"
            />
          ) : (
            <div
              className="relative z-[1] flex size-[72px] items-center justify-center rounded-full font-mono text-[9px] uppercase tracking-[0.2em] text-white/50"
              aria-hidden
            >
              MONO
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="meet-caption-en text-[8px] uppercase tracking-[0.32em] text-[#b8a994]">Resonance · 同频</p>
          <p className="mt-1 truncate text-[15px] font-medium tracking-[0.06em] text-[#2c2a26]">{payload.title}</p>
          {sub ? <p className="meet-caption-en mt-1 truncate text-[10px] tracking-[0.12em] text-[#8c8883]">{sub}</p> : null}
        </div>
      </div>
    </div>
  )
}

export function MeetTruthMirrorRecordCard({
  payload,
  npcGender,
}: {
  payload: MeetTruthMirrorRecordPayload
  npcGender?: string
}) {
  const peer = resolveMeetTruthPeerCeremonyCopy(npcGender ?? '')
  return (
    <div className="flex w-full flex-col gap-3 px-3 py-5">
      <div className="mx-auto h-px w-12 bg-gradient-to-r from-transparent via-[#D4AF37]/55 to-transparent" aria-hidden />
      <p className="meet-caption-en text-center text-[9px] uppercase tracking-[0.32em] text-[#b8973a]">
        Truth Exchange · 交换真心话
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[12px] border-[0.5px] border-[#1a1918] bg-[#faf9f7] p-4 shadow-[0_16px_48px_rgba(12,10,8,0.12)]">
          <p className="meet-caption-en text-[8px] uppercase tracking-[0.26em] text-[#b8973a]">{peer.peerTruthLabelEn}</p>
          <p className="meet-caption-en mt-0.5 text-[7px] tracking-[0.12em] text-[#7a736b]">{peer.peerTruthLabelZh}</p>
          <p className="meet-caption-en mt-3 text-[7px] uppercase tracking-[0.2em] text-[#a8a4a0]">Q</p>
          <p className="mt-1 font-dossier-serif text-[11px] leading-snug tracking-[0.04em] text-[#5b574f]">{payload.question}</p>
          <p className="meet-caption-en mt-3 text-[7px] uppercase tracking-[0.2em] text-[#a8a4a0]">A</p>
          <p className="mt-1 font-dossier-serif text-[12px] leading-relaxed tracking-[0.05em] text-[#0f0f0f]">{payload.npcAnswer}</p>
        </div>
        <div className="rounded-[12px] border-[0.5px] border-[#e8e3dc] bg-gradient-to-b from-white to-[#faf8f5] p-4 shadow-[0_14px_40px_rgba(28,22,16,0.07)]">
          <p className="meet-caption-en text-[8px] uppercase tracking-[0.26em] text-[#8c8883]">Your Truth</p>
          <p className="meet-caption-en mt-0.5 text-[7px] tracking-[0.12em] text-[#b8a994]">你的真心</p>
          <p className="meet-caption-en mt-3 text-[7px] uppercase tracking-[0.2em] text-[#c9c4bc]">Q</p>
          <p className="mt-1 font-dossier-serif text-[11px] leading-snug tracking-[0.04em] text-[#4a463f]">{payload.question}</p>
          <p className="meet-caption-en mt-3 text-[7px] uppercase tracking-[0.2em] text-[#c9c4bc]">A</p>
          <p className="mt-1 font-dossier-serif text-[12px] leading-relaxed tracking-[0.05em] text-[#141312]">{payload.userAnswer}</p>
        </div>
      </div>
    </div>
  )
}

export function MeetEchoRevealCards({ payload }: { payload: MeetEchoRevealPayload }) {
  return (
    <div className="flex w-full flex-col gap-3 px-3 py-4">
      <p className="meet-caption-en text-center text-[9px] uppercase tracking-[0.28em] text-[#b8a994]">Echo · 双盲揭晓</p>
      <div className="grid grid-cols-2 gap-2">
        <motion.div
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          className="rounded-[12px] border border-black bg-[#0c0c0c] p-3 text-white shadow-[0_16px_48px_rgba(0,0,0,0.35)]"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <p className="meet-caption-en text-[8px] uppercase tracking-[0.24em] text-white/45">You · 玩家</p>
          <p className="meet-caption-en mt-2 text-[9px] uppercase tracking-[0.18em] text-white/35">Q</p>
          <p className="mt-1 text-[11px] leading-snug text-white/80">{payload.question}</p>
          <p className="meet-caption-en mt-3 text-[9px] uppercase tracking-[0.18em] text-white/35">A</p>
          <p className="mt-1 font-dossier-serif text-[12px] leading-relaxed text-white">{payload.userAnswer}</p>
        </motion.div>
        <motion.div
          initial={{ rotateY: -90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.08 }}
          className="rounded-[12px] border-[0.5px] border-gray-200 bg-white p-3 text-[#2c2a26] shadow-[0_16px_48px_rgba(40,36,30,0.12)]"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <p className="meet-caption-en text-[8px] uppercase tracking-[0.24em] text-[#b8973a]">They · 角色</p>
          <p className="meet-caption-en mt-2 text-[9px] uppercase tracking-[0.18em] text-[#a8a4a0]">Q</p>
          <p className="mt-1 text-[11px] leading-snug text-[#5b574f]">{payload.question}</p>
          <p className="meet-caption-en mt-3 text-[9px] uppercase tracking-[0.18em] text-[#a8a4a0]">A</p>
          <p className="mt-1 font-dossier-serif text-[12px] leading-relaxed text-[#2c2a26]">{payload.npcAnswer}</p>
        </motion.div>
      </div>
    </div>
  )
}

export function MeetTruthMirrorCharRequestCard({
  resolved = false,
  outcome,
  otherAvatarUrl,
  showAvatar = true,
  avatarRadiusPx = 8,
  onAccept,
  onDecline,
  disabled = false,
}: {
  resolved?: boolean
  outcome?: 'accepted' | 'declined'
  otherAvatarUrl?: string
  showAvatar?: boolean
  avatarRadiusPx?: number
  onAccept?: () => void
  onDecline?: () => void
  disabled?: boolean
}) {
  const avatarSrc = otherAvatarUrl?.trim()
  return (
    <motion.div className="flex w-full max-w-full shrink-0 overflow-x-visible">
      <motion.div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-3">
        {showAvatar ? (
          avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-cover"
              style={{
                borderRadius: `${avatarRadiusPx}px`,
                border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
              }}
              aria-hidden
            />
          ) : (
            <motion.div
              className="h-10 w-10 shrink-0"
              style={{
                borderRadius: `${avatarRadiusPx}px`,
                background: 'rgba(0,0,0,0.06)',
                border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
              }}
              aria-hidden
            />
          )
        ) : null}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0 max-w-[min(320px,calc(100vw-24px-24px-40px-12px))] rounded-[14px] border-[0.5px] border-[#ebe7e0] bg-white px-4 py-3.5 shadow-[0_14px_40px_rgba(22,18,14,0.07)]"
          style={{ borderTopColor: `${PLATINUM}55`, borderTopWidth: 2 }}
        >
          <p className="meet-caption-en text-[9px] uppercase tracking-[0.18em] text-[#b8973a]">Truth · 真心话邀约</p>
          <p className="mt-2 font-elegant-serif text-[15px] italic leading-relaxed tracking-[0.05em] text-[#1a1918]">
            想与你玩一局交换真心话——双盲抽题，各自作答后再一起揭晓。
          </p>
          {resolved ? (
            <p className="mt-3 text-[11px] font-light text-[#8a847b]">
              {outcome === 'accepted' ? '你已应允，仪式进行中或已归档。' : '你已选择暂不参与。'}
            </p>
          ) : (
            <motion.div className="mt-4 flex gap-2">
              <Pressable
                type="button"
                disabled={disabled}
                onClick={onDecline}
                className="flex-1 rounded-full border border-[#e8e4dc] bg-[#f7f5f2] py-2.5 text-[12px] tracking-[0.06em] text-[#6e6860] transition-opacity disabled:opacity-45"
              >
                暂不参与
              </Pressable>
              <Pressable
                type="button"
                disabled={disabled}
                onClick={onAccept}
                className="flex-1 rounded-full border border-[#1a1918] bg-[#141312] py-2.5 text-[12px] tracking-[0.06em] text-[#f7f4ef] transition-opacity disabled:opacity-45"
              >
                同意开始
              </Pressable>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

export function MeetTruthMirrorUserResponseCard({
  outcome,
  selfAvatarUrl,
  showAvatar = true,
  avatarRadiusPx = 8,
}: {
  outcome: 'accepted' | 'declined'
  selfAvatarUrl?: string
  showAvatar?: boolean
  avatarRadiusPx?: number
}) {
  const accepted = outcome === 'accepted'
  const avatarSrc = selfAvatarUrl?.trim()
  return (
    <motion.div className="flex w-full max-w-full shrink-0 justify-end overflow-x-visible">
      <motion.div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`max-w-[min(300px,calc(100vw-24px-24px-40px-12px))] rounded-[14px] border-[0.5px] px-4 py-3 shadow-[0_12px_36px_rgba(28,22,16,0.06)] ${
            accepted ? 'border-[#ebe7e0] border-l-[3px] border-l-[#D4AF37] bg-[#FDFCFA]' : 'border-[#ebe7e0] bg-[#F9F8F6]'
          }`}
        >
          <p className={`text-[9px] tracking-[0.18em] ${accepted ? 'text-[#b8973a]' : 'text-[#a8a4a0]'}`}>
            {accepted ? '你已应允' : '你已暂缓'}
          </p>
          <p className="mt-2 font-dossier-serif text-[14px] italic leading-relaxed tracking-[0.05em] text-[#3d3a34]">
            {accepted ? '同意与对方交换真心话。' : '暂不参与本轮真心话。'}
          </p>
        </motion.div>
        {showAvatar ? (
          avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-cover"
              style={{
                borderRadius: `${avatarRadiusPx}px`,
                border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
              }}
              aria-hidden
            />
          ) : (
            <motion.div
              className="h-10 w-10 shrink-0"
              style={{
                borderRadius: `${avatarRadiusPx}px`,
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
              }}
              aria-hidden
            />
          )
        ) : null}
      </motion.div>
    </motion.div>
  )
}
