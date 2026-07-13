import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { PersonaRosterAvatar } from '../wechat/newFriendsPersona/personaRoster/PersonaRosterAvatar'
import { PULSE_COLORS } from './constants'
import type { PulsePovOption } from './pulseTypes'

type Props = {
  options: PulsePovOption[]
  onSelect: (povId: string) => void
  onBack?: () => void
  backLabel?: string
  playerName?: string
}

export function PulseAuthGuard({ options, onSelect, onBack, backLabel = '返回主页', playerName }: Props) {
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const handlePick = (opt: PulsePovOption) => {
    if (syncingId) return
    setSyncingId(opt.povId)
    window.setTimeout(() => onSelect(opt.povId), 920)
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#FCFCFC]">
      {onBack ? (
        <header
          className="relative z-20 flex shrink-0 items-center gap-2 px-3 pb-2"
          style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 0px))' }}
        >
          <Pressable
            type="button"
            onClick={onBack}
            disabled={!!syncingId}
            className="flex items-center gap-0.5 rounded-full py-1.5 pr-2 opacity-70 disabled:opacity-40"
            aria-label={backLabel}
          >
            <ChevronLeft className="size-5" strokeWidth={1.4} />
            <span className="text-[13px] tracking-wide text-[#1C1C1E]">{backLabel}</span>
          </Pressable>
        </header>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <div className="pointer-events-none absolute inset-0 bg-white/75 backdrop-blur-2xl" aria-hidden />
        <div className="relative z-10 w-full max-w-[360px] text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.38em] text-neutral-400">
            WORLD SELECT
          </p>
          <h1 className="mt-2 font-serif text-[1.4rem] font-medium tracking-[0.1em] text-[#1C1C1E]">
            选择世界
          </h1>
          <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">
            以你的微博账号{playerName ? `（${playerName}）` : ''}浏览不同世界的动态。选择一位主要角色，进入 ta 的世界观舆论场。
          </p>

          {options.length === 0 ? (
            <p className="mt-10 text-[12px] leading-relaxed text-neutral-400">
              暂无主要角色。请先在微信人脉中创建主要角色，再来探索各世界的微博。
            </p>
          ) : (
            <div className="mt-10 flex flex-wrap items-start justify-center gap-5">
              {options.map((opt) => {
                const syncing = syncingId === opt.povId
                return (
                  <Pressable
                    key={opt.povId}
                    type="button"
                    onClick={() => handlePick(opt)}
                    className="group flex w-[96px] flex-col items-center gap-2"
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
                          kind="wechat"
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
                    <span className="line-clamp-2 text-center text-[11px] font-medium tracking-[0.04em] text-[#1C1C1E]">
                      {opt.label}
                    </span>
                    <span className="line-clamp-1 text-center text-[10px] tracking-wide text-neutral-400">
                      {opt.worldName}
                    </span>
                  </Pressable>
                )
              })}
            </div>
          )}

          <AnimatePresence>
            {syncingId ? (
              <motion.p
                className="mt-10 text-[11px] tracking-[0.14em] text-neutral-500"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                World Linked. <span style={{ color: PULSE_COLORS.dustyRose }}>世界已接入</span>
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
