import { AnimatePresence, motion } from 'framer-motion'
import { BookMarked, Edit2, Heart, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { MeetMemoryEntryBody } from './MeetMemoryEntryBody'
import { createPortal } from 'react-dom'
import type { CharacterMemory } from '../wechat/newFriendsPersona/types'
import { DestinyArchiveMemoryEntrySheet } from './DestinyArchiveMemoryEntrySheet'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import { MeetRewindMissedConfirmModal } from './MeetRewindMissedConfirmModal'
import { useMeetRewindMissedNpc } from './useMeetRewindMissedNpc'
import type { EncounterMemory, EncounterNPC, MeetPublicProfile } from './meetTypes'

function formatMemoryTs(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

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

export function DestinyArchiveMemoriesPanel({
  open,
  onClose,
  memory,
  memoryEntries,
  npc,
  meetProfile,
  intimacyScore: _intimacyScore = 0,
  onSaveMemoryEntry,
  onDeleteMemoryEntry,
  onOpenWorldbook,
}: {
  open: boolean
  onClose: () => void
  memory: EncounterMemory
  memoryEntries: CharacterMemory[]
  npc: EncounterNPC | null
  meetProfile: MeetPublicProfile
  intimacyScore?: number
  onSaveMemoryEntry: (body: string, existing: CharacterMemory | null) => void
  onDeleteMemoryEntry: (id: string) => void
  onOpenWorldbook?: () => void
}) {
  const portalEl = getLumiMeetPortalTarget()
  const faded = memory.matchType === 'faded'
  const dossier = npc?.comprehensivePersona

  const [entryOpen, setEntryOpen] = useState(false)
  const [entryMode, setEntryMode] = useState<'create' | 'edit'>('create')
  const [editingEntry, setEditingEntry] = useState<CharacterMemory | null>(null)
  const { charges, confirmNpc, canRewindNpc, requestRewind, cancelRewind, confirmRewind } = useMeetRewindMissedNpc()

  const showRewind = faded && npc?.status === 'missed'
  const rewindReady = canRewindNpc(npc)

  const sortedEntries = useMemo(
    () => [...memoryEntries].sort((a, b) => b.updatedAt - a.updatedAt),
    [memoryEntries],
  )

  const openAdd = () => {
    setEntryMode('create')
    setEditingEntry(null)
    setEntryOpen(true)
  }

  const openEditEntry = (mem: CharacterMemory) => {
    setEntryMode('edit')
    setEditingEntry(mem)
    setEntryOpen(true)
  }

  if (!portalEl) return null

  return createPortal(
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="destiny-memories-panel"
            className="fixed inset-0 z-[335] flex flex-col justify-end bg-black/22 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            role="presentation"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="destiny-memories-panel-title"
              className="flex max-h-[min(88vh,640px)] w-full flex-col overflow-hidden rounded-t-[22px] border border-white/70 bg-[#faf9f7]/95 shadow-[0_-24px_80px_rgba(28,24,18,0.18)] backdrop-blur-xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-black/10" aria-hidden />

              <div className="flex items-start justify-between gap-3 border-b border-black/[0.05] px-5 pb-4 pt-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="size-11 shrink-0 overflow-hidden rounded-[14px] ring-1 ring-black/[0.06]">
                    {memory.avatarUrl ? (
                      <img src={memory.avatarUrl} alt="" className="size-full object-cover" draggable={false} />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-[#f0ede8] text-[10px] text-[#b8b5ad]">
                        —
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p id="destiny-memories-panel-title" className="font-elegant-serif text-[16px] font-medium text-[#2c2a26]">
                      {memory.nickname}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <MatchTypeBadge memory={memory} />
                      <span className="meet-caption-en text-[9px] tracking-[0.16em] text-[#c4bfb8]">
                        {sortedEntries.length} 条 [遇见] 记忆
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-full p-2 text-[#a39e96] hover:bg-black/[0.04]"
                  aria-label="关闭"
                >
                  <X className="size-4" strokeWidth={1.5} aria-hidden />
                </button>
              </div>

              <div className="meet-scrollbar-hide min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {showRewind ? (
                  <div className="mb-4 rounded-[14px] border border-[rgba(212,175,55,0.28)] bg-white/80 px-4 py-3">
                    <p className="text-[12px] font-light leading-relaxed text-[#6e6860]">
                      波长曾擦肩而过，仍可消耗回溯机会重新发送心动信号；成功后可在「消息」中继续临时会话。
                    </p>
                    <p className="meet-caption-en mt-2 text-[9px] tracking-[0.18em] text-[#c4bfb8]">
                      Rewinds remaining · {charges}
                    </p>
                    {charges <= 0 ? (
                      <p className="mt-2 text-[11px] font-light text-[#a89090]">回溯机会已用尽，请稍后再试或等待星轨重逢。</p>
                    ) : null}
                  </div>
                ) : null}
                {sortedEntries.length === 0 ? (
                  <p className="py-10 text-center text-[13px] font-light leading-relaxed text-[#a39e96]">
                    {faded
                      ? showRewind
                        ? '尚未留下可收录的会话残响；可先回溯心动，再在消息中对话。'
                        : '信号微弱，尚未留下可收录的会话残响。'
                      : '尚无 [遇见] 记忆。继续在临时会话中对话，满设定轮数后将自动写入；也可点击下方添加。'}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {sortedEntries.map((mem) => (
                      <li
                        key={mem.id}
                        className="group rounded-[14px] border border-black/[0.06] bg-white/80 px-4 py-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="meet-caption-en text-[9px] tracking-[0.14em] text-[#c4bfb8]">
                            {mem.isAutoGenerated ? '自动总结' : '手动'}
                            <span className="mx-1 text-[#ddd8cf]">·</span>
                            {formatMemoryTs(mem.updatedAt)}
                          </p>
                          <div className="flex shrink-0 gap-0.5">
                            <button
                              type="button"
                              onClick={() => openEditEntry(mem)}
                              className="rounded-md p-1.5 text-[#8a847b] hover:bg-black/[0.04]"
                              aria-label="编辑记忆"
                            >
                              <Edit2 className="size-3.5" strokeWidth={1.35} aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteMemoryEntry(mem.id)}
                              className="rounded-md p-1.5 text-[#a89090] hover:bg-black/[0.04]"
                              aria-label="删除记忆"
                            >
                              <Trash2 className="size-3.5" strokeWidth={1.35} aria-hidden />
                            </button>
                          </div>
                        </div>
                        <MeetMemoryEntryBody
                          mem={mem}
                          characterId={memory.charId}
                          npc={npc}
                          meetProfile={meetProfile}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-black/[0.05] px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
                {showRewind ? (
                  <button
                    type="button"
                    disabled={!rewindReady}
                    onClick={() => npc && requestRewind(npc)}
                    className="meet-btn-primary inline-flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[12px] disabled:opacity-45"
                  >
                    <Heart className="size-3.5" strokeWidth={1.35} aria-hidden />
                    回溯心动
                  </button>
                ) : null}
                {dossier && npc ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onOpenWorldbook?.()
                    }}
                    className="meet-platinum-pill inline-flex flex-1 items-center justify-center gap-1.5 border py-2.5 text-[12px] font-light text-[#5c534c]"
                    style={{ borderColor: 'rgba(212, 175, 55, 0.35)' }}
                  >
                    <BookMarked className="size-3.5 opacity-70" strokeWidth={1.25} aria-hidden />
                    世界书
                  </button>
                ) : null}
                {!faded ? (
                  <button
                    type="button"
                    onClick={openAdd}
                    className="meet-btn-primary inline-flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[12px]"
                  >
                    <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
                    添加记忆
                  </button>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <DestinyArchiveMemoryEntrySheet
        open={entryOpen}
        mode={entryMode}
        nickname={memory.nickname}
        characterId={memory.charId}
        npc={npc}
        meetProfile={meetProfile}
        initial={editingEntry}
        onClose={() => {
          setEntryOpen(false)
          setEditingEntry(null)
        }}
        onSave={(body) => {
          onSaveMemoryEntry(body, editingEntry)
          setEntryOpen(false)
          setEditingEntry(null)
        }}
      />

      <MeetRewindMissedConfirmModal
        npc={confirmNpc}
        charges={charges}
        onClose={cancelRewind}
        onConfirm={() => {
          if (confirmRewind()) onClose()
        }}
      />
    </>,
    portalEl,
  )
}
