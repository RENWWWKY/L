import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { resolveCharacterAvatarUrl } from '../../../utils/characterAvatarUrl'

const BOUNCE_MS = 90
const SLOWDOWN_ROUNDS = 14
const REVEAL_HOLD_MS = 900

type Props = {
  open: boolean
  playerAvatarUrl?: string
  charAvatarUrl?: string
  charName?: string
  onComplete: (playerGoesFirst: boolean) => void
  /** gomoku=五子棋先手抽签；claw=抓娃娃机先手抽签 */
  variant?: 'gomoku' | 'claw'
}

function DrawAvatar({
  url,
  fallback,
  label,
  active,
  winner,
}: {
  url?: string
  fallback: string
  label: string
  active: boolean
  winner: boolean
}) {
  const resolved = resolveCharacterAvatarUrl({ avatarUrl: url }) || undefined
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        animate={{
          scale: active ? 1.08 : winner ? 1.05 : 1,
          opacity: active || winner ? 1 : 0.55,
        }}
        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        className={`relative h-[76px] w-[76px] overflow-hidden rounded-full border-[3px] bg-white shadow-md ${
          winner
            ? 'border-emerald-400 shadow-[0_8px_28px_rgba(16,185,129,0.28)]'
            : active
              ? 'border-[#0A0A0C]/80'
              : 'border-[#E5E7EB]'
        }`}
      >
        {resolved ? (
          <img src={resolved} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#F3F4F6] text-[20px] text-[#9CA3AF]">
            {fallback}
          </div>
        )}
        {winner ? (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
          >
            先手
          </motion.span>
        ) : null}
      </motion.div>
      <p className="max-w-[88px] truncate text-[13px] font-medium text-[#374151]">{label}</p>
    </div>
  )
}

/** 进入对局前：五五开随机抽取先手并播放动画 */
export function GomokuFirstMoveDraw({
  open,
  playerAvatarUrl,
  charAvatarUrl,
  charName,
  onComplete,
  variant = 'gomoku',
}: Props) {
  const peer = charName?.trim() || '对方'
  const isClaw = variant === 'claw'
  const [phase, setPhase] = useState<'idle' | 'drawing' | 'reveal'>('idle')
  const [highlight, setHighlight] = useState<'player' | 'char'>('player')
  const resultRef = useRef<boolean>(Math.random() < 0.5)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!open) {
      setPhase('idle')
      setHighlight('player')
      return
    }

    resultRef.current = Math.random() < 0.5
    setPhase('drawing')
    setHighlight('player')

    let step = 0
    let cancelled = false
    let timer: number | undefined

    const schedule = (delayMs: number, fn: () => void) => {
      timer = window.setTimeout(() => {
        if (!cancelled) fn()
      }, delayMs)
    }

    const runBounce = () => {
      if (cancelled) return
      setHighlight(step % 2 === 0 ? 'player' : 'char')
      step += 1
      if (step >= SLOWDOWN_ROUNDS) {
        const playerWins = resultRef.current
        setHighlight(playerWins ? 'player' : 'char')
        setPhase('reveal')
        schedule(REVEAL_HOLD_MS, () => {
          if (!cancelled) onCompleteRef.current(playerWins)
        })
        return
      }
      const delay = BOUNCE_MS + Math.floor(step * step * 2.2)
      schedule(delay, runBounce)
    }

    schedule(320, runBounce)

    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
    }
  }, [open])

  const playerWins = resultRef.current
  const showReveal = phase === 'reveal'

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#F9FAFB]/92 px-6 backdrop-blur-[3px]"
        >
          <p className="mb-2 text-[11px] tracking-[0.18em] text-[#9CA3AF]">
            {showReveal ? '抽取完成' : '正在抽取先手'}
          </p>
          <motion.h2
            key={showReveal ? 'reveal-title' : 'draw-title'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 text-[20px] font-medium tracking-tight text-[#0A0A0C]"
            style={{ fontFamily: 'var(--phone-font, "Noto Serif SC", serif)' }}
          >
            {showReveal
              ? playerWins
                ? isClaw
                  ? '你先抓'
                  : '你先手'
                : isClaw
                  ? `${peer} 先抓`
                  : `${peer} 先手`
              : isClaw
                ? '谁先抓？'
                : '谁先下？'}
          </motion.h2>

          <div className="flex items-start justify-center gap-10">
            <DrawAvatar
              url={playerAvatarUrl}
              fallback="我"
              label="你"
              active={!showReveal && highlight === 'player'}
              winner={showReveal && playerWins}
            />
            <div className="mt-9 text-[13px] font-medium tracking-widest text-[#D1D5DB]">VS</div>
            <DrawAvatar
              url={charAvatarUrl}
              fallback={peer.slice(0, 1)}
              label={peer}
              active={!showReveal && highlight === 'char'}
              winner={showReveal && !playerWins}
            />
          </div>

          {!showReveal ? (
            <motion.div
              className="mt-10 flex gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-[#0A0A0C]/35"
                  animate={{ opacity: [0.25, 1, 0.25] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </motion.div>
          ) : (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 text-[13px] text-[#6B7280]"
            >
              {playerWins
                ? isClaw
                  ? '你先下爪，祝好运'
                  : '黑棋先行，请落子'
                : isClaw
                  ? `${peer} 即将先抓`
                  : `${peer} 即将落第一子`}
            </motion.p>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
