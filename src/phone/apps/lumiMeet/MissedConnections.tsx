import { AnimatePresence, motion } from 'framer-motion'
import { BookMarked } from 'lucide-react'
import { useState } from 'react'
import { MeetRewindMissedConfirmModal } from './MeetRewindMissedConfirmModal'
import { MeetWorldbookShelfModal } from './MeetWorldbookShelfModal'
import { useMeetStore } from './LumiMeetStore'
import { useMeetRewindMissedNpc } from './useMeetRewindMissedNpc'
import type { EncounterNPC, MeetPublicProfile } from './meetTypes'

const BLUR_STYLE = {
  filter: 'blur(4px) grayscale(50%)',
  opacity: 0.4,
} as const

export function MissedConnections({ meetProfile }: { meetProfile: MeetPublicProfile }) {
  const { state } = useMeetStore()
  const { charges, confirmNpc, revealingId, requestRewind, cancelRewind, confirmRewind } = useMeetRewindMissedNpc()
  const missed = state.npcs.filter((n) => n.status === 'missed')
  const [worldbookNpc, setWorldbookNpc] = useState<EncounterNPC | null>(null)

  if (!missed.length) return null

  return (
    <section className="relative mt-12 border-t border-black/[0.06] pt-10">
      <div className="mb-5">
        <h3 className="meet-caption-en text-[10px] uppercase tracking-[0.42em] text-[#b8b5ad]">
          MISSED CONNECTIONS
        </h3>
        <p className="mt-1 font-elegant-serif text-[15px] font-medium tracking-[0.06em] text-[#6e6860]">
          擦肩而过
        </p>
        <p className="meet-caption-en mt-1 text-[9px] tracking-[0.28em] text-[#c9c4bc]">
          Rewinds remaining · {charges}
        </p>
        <p className="mt-2 text-center text-[10px] font-light leading-relaxed text-[#a39e96]">
          点头像可消耗回溯机会重新心动；点「世界书」可查看该角色的九维档案与分册设定。
        </p>
      </div>

      <motion.div className="-mx-1 flex gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]">
        {missed.map((n) => {
          const activeReveal = revealingId === n.id
          const hasDossier = !!n.comprehensivePersona
          return (
            <div
              key={n.id}
              className="flex w-[108px] shrink-0 flex-col items-center gap-2 rounded-[20px] border border-black/[0.05] bg-[#faf9f7] px-2.5 py-3"
            >
              <button
                type="button"
                onClick={() => requestRewind(n)}
                className="flex w-full flex-col items-center gap-1.5 focus:outline-none"
                aria-label={`回溯 ${n.nickname}`}
              >
                <motion.div
                  className="relative size-[56px] overflow-hidden rounded-[18px] ring-1 ring-black/[0.06]"
                  initial={false}
                  animate={
                    activeReveal
                      ? {
                          filter: 'blur(0px) grayscale(0%)',
                          opacity: 1,
                          boxShadow:
                            '0 0 0 1px rgba(212,175,140,0.35), 0 12px 40px rgba(200,180,150,0.35)',
                        }
                      : {
                          filter: BLUR_STYLE.filter,
                          opacity: BLUR_STYLE.opacity,
                          boxShadow: 'none',
                        }
                  }
                  transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <img src={n.avatarUrl} alt="" className="size-full object-cover" draggable={false} />
                </motion.div>
                <span className="max-w-full truncate text-center text-[11px] font-light text-[#5c574f]">
                  {n.nickname}
                </span>
              </button>
              {hasDossier ? (
                <button
                  type="button"
                  onClick={() => setWorldbookNpc(n)}
                  className="meet-platinum-pill flex w-full items-center justify-center gap-1 border py-1.5 text-[10px] font-light text-[#5c534c]"
                  style={{ borderColor: 'rgba(212, 175, 55, 0.35)' }}
                >
                  <BookMarked className="size-3 opacity-70" strokeWidth={1.25} aria-hidden />
                  <span>世界书</span>
                </button>
              ) : (
                <span className="text-center text-[9px] font-light text-[#c4bfb8]">档案生成中</span>
              )}
            </div>
          )
        })}
      </motion.div>

      {worldbookNpc?.comprehensivePersona ? (
        <MeetWorldbookShelfModal
          open
          onClose={() => setWorldbookNpc(null)}
          npcId={worldbookNpc.id}
          nickname={worldbookNpc.nickname}
          avatarUrl={worldbookNpc.avatarUrl}
          dossier={worldbookNpc.comprehensivePersona}
          meetProfile={meetProfile}
          intimacyScore={state.intimacyByNpcId[worldbookNpc.id] ?? 0}
        />
      ) : null}

      <MeetRewindMissedConfirmModal
        npc={confirmNpc}
        charges={charges}
        onClose={cancelRewind}
        onConfirm={confirmRewind}
      />
    </section>
  )
}
