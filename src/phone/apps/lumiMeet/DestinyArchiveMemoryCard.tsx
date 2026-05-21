import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { DestinyArchiveMemoriesPanel } from './DestinyArchiveMemoriesPanel'
import { MeetWorldbookShelfModal } from './MeetWorldbookShelfModal'
import { resolveDestinyArchiveCardMotto } from './destinyArchiveMotto'
import type { CharacterMemory } from '../wechat/newFriendsPersona/types'
import type { EncounterMemory, EncounterNPC, MeetPublicProfile } from './meetTypes'

const PLATINUM = '#D4AF37'

function MatchTypeBadge({ memory }: { memory: EncounterMemory }) {
  if (memory.matchType === 'resonated') {
    return (
      <span
        className="meet-caption-en rounded-full border px-2 py-0.5 text-[8px] uppercase tracking-[0.18em]"
        style={{ borderColor: 'rgba(212, 175, 55, 0.45)', color: '#9a7d3a' }}
      >
        一击即中 | 1ST TRY
      </span>
    )
  }
  if (memory.matchType === 'reconnected') {
    return (
      <span
        className="meet-caption-en rounded-full border px-2 py-0.5 text-[8px] uppercase tracking-[0.14em]"
        style={{ borderColor: 'rgba(212, 175, 55, 0.35)', color: '#8a7a5c' }}
      >
        兜兜转转 | {memory.matchAttempts} ATTEMPTS
      </span>
    )
  }
  return (
    <span className="meet-caption-en rounded-full border border-black/[0.08] px-2 py-0.5 text-[8px] uppercase tracking-[0.16em] text-[#a8a39c]">
      错失的波长 | FADED
    </span>
  )
}

function TimelineNode({ memory }: { memory: EncounterMemory }) {
  const faded = memory.matchType === 'faded'
  if (memory.matchType === 'reconnected') {
    return (
      <div className="relative size-4 shrink-0" aria-hidden>
        <span className="absolute inset-0 rounded-full border-[1.5px]" style={{ borderColor: PLATINUM }} />
        <span
          className="absolute inset-[3px] rounded-full border"
          style={{ borderColor: 'rgba(212, 175, 55, 0.55)' }}
        />
      </div>
    )
  }
  if (faded) {
    return (
      <span
        className="mt-0.5 size-3.5 shrink-0 rounded-full border border-[#c8c4bc] bg-transparent"
        aria-hidden
      />
    )
  }
  return (
    <span
      className="mt-0.5 size-3 shrink-0 rounded-full shadow-[0_0_0_3px_rgba(212,175,55,0.15)]"
      style={{ backgroundColor: PLATINUM }}
      aria-hidden
    />
  )
}

export function DestinyArchiveMemoryCard({
  memory,
  memoryEntries,
  index,
  npc,
  meetProfile,
  intimacyScore = 0,
  onSaveMemoryEntry,
  onDeleteMemoryEntry,
  canRewindMissed = false,
}: {
  memory: EncounterMemory
  memoryEntries: CharacterMemory[]
  index: number
  npc: EncounterNPC | null
  meetProfile: MeetPublicProfile
  intimacyScore?: number
  onSaveMemoryEntry: (body: string, existing: CharacterMemory | null) => void
  onDeleteMemoryEntry: (id: string) => void
  /** 擦肩而过且仍有回溯次数 */
  canRewindMissed?: boolean
}) {
  const faded = memory.matchType === 'faded'
  const [panelOpen, setPanelOpen] = useState(false)
  const [worldbookOpen, setWorldbookOpen] = useState(false)
  const motto = resolveDestinyArchiveCardMotto(npc, memory)
  const dossier = npc?.comprehensivePersona
  const memoryCount = memoryEntries.length

  return (
    <motion.li
      className="relative flex gap-4 pl-0"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.12 + index * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex w-8 shrink-0 flex-col items-center pt-5">
        <TimelineNode memory={memory} />
      </div>

      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className={`group relative min-w-0 flex-1 rounded-[18px] border border-white/80 bg-white/70 p-4 text-left shadow-[0_12px_40px_rgba(35,30,24,0.06)] backdrop-blur-md transition-shadow hover:shadow-[0_16px_48px_rgba(35,30,24,0.1)] ${
          faded ? 'opacity-60 grayscale-[30%]' : ''
        }`}
        aria-label={`查看 ${memory.nickname} 的邂逅记忆`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`size-12 shrink-0 overflow-hidden rounded-[14px] ring-1 ring-black/[0.06] ${
              faded ? 'blur-[2px]' : ''
            }`}
          >
            {memory.avatarUrl ? (
              <img src={memory.avatarUrl} alt="" className="size-full object-cover" draggable={false} />
            ) : (
              <div className="flex size-full items-center justify-center bg-[#f0ede8] text-[10px] font-light text-[#b8b5ad]">
                —
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-elegant-serif text-[15px] font-medium tracking-[0.04em] text-[#2c2a26]">
                {memory.nickname}
              </p>
              <MatchTypeBadge memory={memory} />
            </div>
            <p className="meet-caption-en mt-1 text-[9px] tracking-[0.2em] text-[#c4bfb8]">
              {new Date(memory.timestamp).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
              {memoryCount > 0 ? ` · ${memoryCount} 条记忆` : ''}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="meet-caption-en text-[8px] uppercase tracking-[0.28em] text-[#c4bfb8]">Motto | 座右铭</p>
          <div className="mt-2 flex gap-3">
          <span
            className="mt-1 w-[2px] shrink-0 self-stretch rounded-full"
            style={{
              background: `linear-gradient(180deg, ${PLATINUM} 0%, rgba(212,175,55,0.15) 100%)`,
              minHeight: '2.25rem',
            }}
            aria-hidden
          />
          <p
            className={`min-w-0 flex-1 font-elegant-serif text-[13px] italic leading-relaxed ${
              faded ? 'text-[#9a9590]' : 'text-[#4a4540]'
            }`}
          >
            {motto}
          </p>
          </div>
        </div>

        <p className="meet-caption-en mt-4 flex items-center justify-end gap-1 text-[10px] uppercase tracking-[0.14em] text-[#b8b5ad] group-hover:text-[#8a847b]">
          {canRewindMissed ? '回溯心动 · 查看记忆' : '查看记忆'}
          <ChevronRight className="size-3.5 opacity-60" strokeWidth={1.5} aria-hidden />
        </p>
      </button>

      <DestinyArchiveMemoriesPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        memory={memory}
        memoryEntries={memoryEntries}
        npc={npc}
        meetProfile={meetProfile}
        intimacyScore={intimacyScore}
        onSaveMemoryEntry={onSaveMemoryEntry}
        onDeleteMemoryEntry={onDeleteMemoryEntry}
        onOpenWorldbook={() => setWorldbookOpen(true)}
      />

      {dossier && npc ? (
        <MeetWorldbookShelfModal
          open={worldbookOpen}
          onClose={() => setWorldbookOpen(false)}
          npcId={npc.id}
          nickname={npc.nickname}
          avatarUrl={npc.avatarUrl}
          dossier={dossier}
          meetProfile={meetProfile}
          intimacyScore={intimacyScore}
        />
      ) : null}
    </motion.li>
  )
}
