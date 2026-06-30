import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { PersonaRosterAvatar } from '../wechat/newFriendsPersona/personaRoster/PersonaRosterAvatar'
import { PULSE_COLORS } from './constants'
import type { PulsePovOption } from './pulseTypes'

type Props = {
  options: PulsePovOption[]
  onSelect: (povId: string) => void
}

export function PulseAuthGuard({ options, onSelect }: Props) {
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const handlePick = (opt: PulsePovOption) => {
    if (syncingId) return
    setSyncingId(opt.povId)
    window.setTimeout(() => onSelect(opt.povId), 920)
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col items-center justify-center overflow-hidden bg-[#FCFCFC] px-6">
      <div className="pointer-events-none absolute inset-0 bg-white/75 backdrop-blur-2xl" aria-hidden />
      <div className="relative z-10 w-full max-w-[360px] text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.38em] text-neutral-400">
          SELECT PERSPECTIVE
        </p>
        <h1 className="mt-2 font-serif text-[1.4rem] font-medium tracking-[0.1em] text-[#1C1C1E]">
          视角接入
        </h1>
        <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">
          选择当前登录账号。你可以是自己，也可以是任意主要角色。
        </p>

        <div className="mt-10 flex flex-wrap items-start justify-center gap-5">
          {options.map((opt) => {
            const syncing = syncingId === opt.povId
            return (
              <Pressable
                key={opt.povId}
                type="button"
                onClick={() => handlePick(opt)}
                className="group flex w-[88px] flex-col items-center gap-2"
                disabled={!!syncingId}
              >
                <div className="relative">
                  {opt.avatarUrl ? (
                    <img
                      src={opt.avatarUrl}
                      alt=""
                      className="size-[68px] rounded-full border-2 border-white object-cover shadow-[0_2px_15px_rgba(0,0,0,0.06)]"
                    />
                  ) : (
                    <PersonaRosterAvatar
                      character={{ avatarUrl: opt.avatarUrl, mbti: undefined }}
                      size={68}
                      kind={opt.kind === 'player' ? 'identity' : 'wechat'}
                    />
                  )}
                  <AnimatePresence>
                    {syncing ? (
                      <motion.div
                        className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] origin-left rounded-full"
                        style={{
                          background: `linear-gradient(90deg, transparent, ${PULSE_COLORS.lightGold}, transparent)`,
                        }}
                        initial={{ scaleX: 0, opacity: 0.2 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      />
                    ) : null}
                  </AnimatePresence>
                </div>
                <span className="line-clamp-2 text-center text-[11px] tracking-[0.04em] text-[#1C1C1E]">
                  {opt.label}
                </span>
              </Pressable>
            )
          })}
        </div>

        <AnimatePresence>
          {syncingId ? (
            <motion.p
              className="mt-10 text-[11px] tracking-[0.14em] text-neutral-500"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              Identity Synced. <span style={{ color: PULSE_COLORS.dustyRose }}>身份已同步</span>
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
